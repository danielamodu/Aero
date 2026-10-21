import { randomUUID, randomBytes } from "node:crypto"
import { getAddress, isAddress, type Address } from "viem"
import { avalancheFuji } from "viem/chains"
import { createPublicClient, http } from "viem"
import { buildSiweMessage, createOpaqueToken, sha256 } from "./primitives.mjs"
import {
  withIdentityRead,
  withIdentityTransaction,
  type IdentityClient,
} from "./db"
import {
  configuredOrigin,
  FUJI_CHAIN_ID,
  rateLimitDigest,
  sessionDurations,
} from "./security"

export type ChallengePurpose =
  "login" | "link_wallet" | "reauthenticate" | "revoke_wallet"
export type ChallengeOperation = "none" | "switch_primary"

type ChallengeInput = {
  purpose: ChallengePurpose
  address?: string
  sessionId?: string
  userId?: string
  proofWalletId?: string
  subjectWalletId?: string
  operation?: ChallengeOperation
}

type ChallengeSession = {
  id: string
  user_id: string
  reauthenticated_at: Date | string | null
  reauthenticated_wallet_id: string | null
}

function normalizedAddress(raw: string | undefined): {
  checksum: Address
  normalized: string
} {
  if (!raw || !isAddress(raw)) throw new Error("IDENTITY_ADDRESS_INVALID")
  const checksum = getAddress(raw)
  return { checksum, normalized: checksum.toLowerCase() }
}

function statementFor(
  input: ChallengeInput,
  target: Address,
  subjectAddress?: string
): string {
  if (input.purpose === "login")
    return "Sign in to Aero. This signature does not authorize token transfers."
  if (input.purpose === "link_wallet")
    return "Link this wallet to your Aero account. This signature does not authorize token transfers."
  if (input.purpose === "revoke_wallet" && subjectAddress) {
    return `Revoke wallet ${subjectAddress} from your Aero account. This signature does not authorize token transfers.`
  }
  if (input.operation === "switch_primary" && subjectAddress) {
    return `Set wallet ${subjectAddress} as your primary Aero wallet. This signature does not authorize token transfers.`
  }
  return `Confirm control of ${target} for your Aero account. This signature does not authorize token transfers.`
}

async function activeWallet(
  client: IdentityClient,
  userId: string,
  walletId: string
) {
  const result = await client.query(
    `SELECT id, address_normalized FROM identity.wallets
      WHERE id = $1 AND user_id = $2 AND wallet_kind = 'eoa'
        AND verification_status = 'verified' AND revoked_at IS NULL`,
    [walletId, userId]
  )
  return result.rows[0] as
    { id: string; address_normalized: string } | undefined
}

export async function createWalletChallenge(input: ChallengeInput) {
  const origin = configuredOrigin()
  let target = input.address ? normalizedAddress(input.address) : null
  let subjectAddress: string | undefined

  if (input.purpose !== "login") {
    if (!input.sessionId || !input.userId || !input.proofWalletId)
      throw new Error("IDENTITY_SESSION_REQUIRED")
  }
  if (
    input.purpose === "link_wallet" &&
    input.operation &&
    input.operation !== "none"
  ) {
    throw new Error("IDENTITY_REQUEST_INVALID")
  }
  if (
    input.operation === "switch_primary" &&
    input.purpose !== "reauthenticate"
  ) {
    throw new Error("IDENTITY_REQUEST_INVALID")
  }

  const id = randomUUID()
  const nonce = randomBytes(32).toString("hex")
  const now = new Date()
  const expires = new Date(now.getTime() + 5 * 60 * 1000)
  const issuedAt = now.toISOString().replace(".000Z", "Z")
  const expiresAt = expires.toISOString().replace(".000Z", "Z")
  const uri = new URL("/api/identity/verify", origin).toString()
  const domain = origin.host
  const operation: ChallengeOperation = input.operation ?? "none"

  const result = await withIdentityTransaction(async (client) => {
    let initiatingWalletId: string | null = null
    const subjectWalletId: string | null = input.subjectWalletId ?? null
    let boundUserId: string | null = input.userId ?? null
    let session: ChallengeSession | null = null

    if (input.purpose !== "login") {
      const rows = await client.query(
        `SELECT s.id, s.user_id, s.reauthenticated_at, s.reauthenticated_wallet_id
           FROM identity.sessions s JOIN identity.users u ON u.id = s.user_id
           JOIN identity.wallets aw ON aw.id = s.authenticated_wallet_id AND aw.user_id = s.user_id
          WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL
            AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
            AND u.status = 'active' AND aw.verification_status = 'verified' AND aw.revoked_at IS NULL
          FOR UPDATE OF s`,
        [input.sessionId, input.userId]
      )
      session = rows.rows[0]
      if (!session) throw new Error("IDENTITY_SESSION_REQUIRED")
      boundUserId = session.user_id
      await client.query(
        `UPDATE identity.sessions SET last_seen_at = now(),
           idle_expires_at = LEAST(absolute_expires_at, now() + ($2 * interval '1 second'))
          WHERE id = $1`,
        [session.id, sessionDurations().idle]
      )

      if (input.purpose === "link_wallet") {
        if (!target) throw new Error("IDENTITY_ADDRESS_INVALID")
        const fresh =
          session.reauthenticated_at &&
          Date.now() - new Date(session.reauthenticated_at).getTime() <=
            5 * 60 * 1000
        if (
          !fresh ||
          !session.reauthenticated_wallet_id ||
          session.reauthenticated_wallet_id !== input.proofWalletId
        ) {
          throw new Error("IDENTITY_RECENT_WALLET_PROOF_REQUIRED")
        }
        const linked = await activeWallet(
          client,
          boundUserId!,
          input.proofWalletId!
        )
        if (!linked) throw new Error("IDENTITY_WALLET_NOT_LINKED")
        initiatingWalletId = linked.id
      } else {
        const linked = await activeWallet(
          client,
          boundUserId!,
          input.proofWalletId!
        )
        if (!linked) throw new Error("IDENTITY_WALLET_NOT_LINKED")
        initiatingWalletId = linked.id
        target = normalizedAddress(linked.address_normalized)
      }

      if (input.purpose === "revoke_wallet" || operation === "switch_primary") {
        if (!subjectWalletId) throw new Error("IDENTITY_WALLET_REQUIRED")
        const subject = await activeWallet(
          client,
          boundUserId!,
          subjectWalletId
        )
        if (!subject) throw new Error("IDENTITY_WALLET_NOT_LINKED")
        subjectAddress = getAddress(subject.address_normalized)
      }
      if (
        input.purpose === "revoke_wallet" &&
        subjectWalletId === initiatingWalletId
      ) {
        const count = await client.query(
          `SELECT count(*)::int AS count FROM identity.wallets
            WHERE user_id = $1 AND verification_status = 'verified' AND revoked_at IS NULL`,
          [boundUserId]
        )
        if (count.rows[0].count <= 1)
          throw new Error("IDENTITY_LAST_WALLET_CANNOT_BE_REVOKED")
      }
    }

    if (!target) throw new Error("IDENTITY_ADDRESS_INVALID")
    const messageStatement = statementFor(
      { ...input, operation },
      target.checksum,
      subjectAddress
    )
    const message = buildSiweMessage({
      domain,
      address: target.checksum,
      uri,
      chainId: FUJI_CHAIN_ID,
      nonce,
      issuedAt,
      expiresAt,
      requestId: id,
      statement: messageStatement,
    })
    const rateHash = rateLimitDigest(`wallet:${target.normalized}`)
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended(encode($1::bytea, 'hex'), 0))`,
      [rateHash]
    )
    const rate = await client.query(
      `SELECT count(*)::int AS count FROM identity.wallet_challenges
        WHERE rate_limit_key_hash = $1 AND issued_at > now() - interval '15 minutes'`,
      [rateHash]
    )
    if (rate.rows[0].count >= 10) throw new Error("IDENTITY_RATE_LIMITED")

    await client.query(
      `INSERT INTO identity.wallet_challenges
        (id, purpose, operation, user_id, initiating_session_id, initiating_wallet_id,
         subject_wallet_id, target_namespace, target_wallet_kind, target_address_normalized,
         chain_id, domain, uri, statement, message_hash, nonce_hash, rate_limit_key_hash, issued_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'eip155', 'eoa', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        id,
        input.purpose,
        operation,
        boundUserId,
        input.sessionId ?? null,
        initiatingWalletId,
        subjectWalletId,
        target.normalized,
        FUJI_CHAIN_ID,
        domain,
        uri,
        messageStatement,
        sha256(message),
        sha256(nonce),
        rateHash,
        issuedAt,
        expiresAt,
      ]
    )
    await appendAudit(client, {
      actorKind: "system",
      actorUserId: null,
      subjectUserId: boundUserId,
      subjectWalletId: initiatingWalletId,
      actionCode: "challenge.issued",
      requestId: id,
      metadata: { purpose: input.purpose, chain_id: FUJI_CHAIN_ID },
    })
    return { id, message, expiresAt }
  })
  return result
}

export async function getChallenge(id: string) {
  return withIdentityRead(async (client) => {
    const result = await client.query(
      `SELECT id, purpose, operation, user_id, initiating_session_id, initiating_wallet_id,
              subject_wallet_id, target_address_normalized, chain_id, domain, uri,
              statement, message_hash, nonce_hash, issued_at, expires_at, consumed_at, invalidated_at, attempt_count
         FROM identity.wallet_challenges WHERE id = $1`,
      [id]
    )
    return result.rows[0] ?? null
  })
}

export async function incrementChallengeFailure(id: string) {
  await withIdentityTransaction(async (client) => {
    await client.query(
      `UPDATE identity.wallet_challenges
          SET attempt_count = attempt_count + 1,
              invalidated_at = CASE WHEN attempt_count + 1 >= 5 THEN now() ELSE invalidated_at END
        WHERE id = $1 AND consumed_at IS NULL AND invalidated_at IS NULL AND attempt_count < 5`,
      [id]
    )
  })
}

export async function fujiAddressIsEoa(address: Address): Promise<boolean> {
  const rpc = process.env.AERO_FUJI_RPC_URL
  if (!rpc) throw new Error("IDENTITY_FUJI_RPC_UNCONFIGURED")
  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpc, { timeout: 5000 }),
  })
  const code = await client.getBytecode({ address })
  return !code || code === "0x"
}

export async function consumeChallenge(id: string, exactMessageHash: Buffer) {
  return withIdentityTransaction(async (client) => {
    const locked = await client.query(
      `SELECT * FROM identity.wallet_challenges WHERE id = $1 FOR UPDATE`,
      [id]
    )
    const challenge = locked.rows[0]
    if (
      !challenge ||
      !Buffer.from(challenge.message_hash).equals(exactMessageHash) ||
      challenge.consumed_at ||
      challenge.invalidated_at ||
      challenge.attempt_count >= 5 ||
      new Date(challenge.expires_at).getTime() <= Date.now()
    ) {
      throw new Error("IDENTITY_CHALLENGE_INVALID")
    }

    const marked = await client.query(
      `UPDATE identity.wallet_challenges SET consumed_at = now()
        WHERE id = $1 AND consumed_at IS NULL AND invalidated_at IS NULL RETURNING id`,
      [id]
    )
    if (!marked.rows.length) throw new Error("IDENTITY_CHALLENGE_INVALID")

    if (challenge.purpose === "login") {
      const rows = await client.query(
        `SELECT w.id AS wallet_id, w.user_id, u.status
           FROM identity.wallets w JOIN identity.users u ON u.id = w.user_id
          WHERE w.namespace = 'eip155' AND w.wallet_kind = 'eoa'
            AND w.address_normalized = $1 AND w.verification_status = 'verified'
            AND w.revoked_at IS NULL`,
        [challenge.target_address_normalized]
      )
      const row = rows.rows[0]
      if (!row || row.status !== "active") {
        await appendAudit(client, {
          actorKind: "system",
          actorUserId: null,
          subjectUserId: row?.user_id ?? null,
          subjectWalletId: row?.wallet_id ?? null,
          actionCode: "auth.login_denied",
          requestId: challenge.id,
          metadata: { reason: "unavailable" },
        })
        return { authenticated: false as const }
      }
      await client.query(
        "UPDATE identity.wallets SET last_authenticated_at = now() WHERE id = $1",
        [row.wallet_id]
      )
      const issued = await issueSession(client, row.user_id, row.wallet_id)
      await appendAudit(client, {
        actorKind: "user",
        actorUserId: row.user_id,
        subjectUserId: row.user_id,
        subjectWalletId: row.wallet_id,
        actionCode: "auth.session_created",
        requestId: challenge.id,
        metadata: { chain_id: FUJI_CHAIN_ID },
      })
      return {
        authenticated: true as const,
        userId: row.user_id,
        sessionId: issued.sessionId,
        token: issued.token,
        csrf: issued.csrf,
        absoluteExpiresAt: issued.absoluteExpiresAt,
      }
    }

    const userRows = await client.query(
      `SELECT id, status FROM identity.users WHERE id = $1 FOR UPDATE`,
      [challenge.user_id]
    )
    const user = userRows.rows[0]
    if (!user || user.status !== "active")
      throw new Error("IDENTITY_ACCOUNT_UNAVAILABLE")
    const sessionRows = await client.query(
      `SELECT s.* FROM identity.sessions s
        JOIN identity.wallets aw ON aw.id = s.authenticated_wallet_id AND aw.user_id = s.user_id
       WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL
         AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
         AND aw.verification_status = 'verified' AND aw.revoked_at IS NULL
       FOR UPDATE OF s`,
      [challenge.initiating_session_id, challenge.user_id]
    )
    const session = sessionRows.rows[0]
    if (!session) throw new Error("IDENTITY_SESSION_REQUIRED")
    await client.query(
      `UPDATE identity.sessions SET last_seen_at = now(),
         idle_expires_at = LEAST(absolute_expires_at, now() + ($2 * interval '1 second'))
        WHERE id = $1`,
      [session.id, sessionDurations().idle]
    )

    if (challenge.purpose !== "link_wallet") {
      const signer = await activeWallet(
        client,
        challenge.user_id,
        challenge.initiating_wallet_id
      )
      if (
        !signer ||
        signer.address_normalized !== challenge.target_address_normalized
      )
        throw new Error("IDENTITY_WALLET_NOT_LINKED")
      await client.query(
        "UPDATE identity.wallets SET last_authenticated_at = now() WHERE id = $1",
        [signer.id]
      )
    }

    if (challenge.purpose === "link_wallet") {
      const freshness = await client.query(
        `SELECT 1 FROM identity.sessions
          WHERE id = $1 AND user_id = $2 AND reauthenticated_wallet_id = $3
            AND reauthenticated_at > now() - interval '5 minutes'`,
        [session.id, user.id, challenge.initiating_wallet_id]
      )
      if (!freshness.rows.length)
        throw new Error("IDENTITY_RECENT_WALLET_PROOF_REQUIRED")
      const insert = await client.query(
        `INSERT INTO identity.wallets
          (id, user_id, namespace, wallet_kind, address_normalized, chain_id, verification_status,
           is_primary, linked_at, verified_at)
         VALUES ($1, $2, 'eip155', 'eoa', $3, NULL, 'verified', false, now(), now())
         RETURNING id`,
        [randomUUID(), user.id, challenge.target_address_normalized]
      )
      await appendAudit(client, {
        actorKind: "user",
        actorUserId: user.id,
        subjectUserId: user.id,
        subjectWalletId: insert.rows[0].id,
        actionCode: "wallet.linked",
        requestId: challenge.id,
        metadata: { chain_id: FUJI_CHAIN_ID },
      })
      return {
        authenticated: true as const,
        linked: true as const,
        userId: user.id,
      }
    }

    if (challenge.purpose === "reauthenticate") {
      if (challenge.operation === "switch_primary") {
        const targetWallet = await activeWallet(
          client,
          user.id,
          challenge.subject_wallet_id
        )
        if (!targetWallet) throw new Error("IDENTITY_WALLET_NOT_LINKED")
        await client.query(
          `UPDATE identity.wallets SET is_primary = false
            WHERE user_id = $1 AND verification_status = 'verified' AND revoked_at IS NULL AND is_primary`,
          [user.id]
        )
        await client.query(
          "UPDATE identity.wallets SET is_primary = true WHERE id = $1",
          [targetWallet.id]
        )
        await appendAudit(client, {
          actorKind: "user",
          actorUserId: user.id,
          subjectUserId: user.id,
          subjectWalletId: targetWallet.id,
          actionCode: "wallet.primary_changed",
          requestId: challenge.id,
          metadata: { proof_wallet_id: challenge.initiating_wallet_id },
        })
      }
      await client.query(
        `UPDATE identity.sessions SET reauthenticated_at = now(), reauthenticated_wallet_id = $2
          WHERE id = $1`,
        [session.id, challenge.initiating_wallet_id]
      )
      await appendAudit(client, {
        actorKind: "user",
        actorUserId: user.id,
        subjectUserId: user.id,
        subjectWalletId: challenge.initiating_wallet_id,
        actionCode: "auth.wallet_reauthenticated",
        requestId: challenge.id,
        metadata: { operation: challenge.operation },
      })
      return {
        authenticated: true as const,
        reauthenticated: true as const,
        userId: user.id,
      }
    }

    if (challenge.purpose === "revoke_wallet") {
      const targetWallet = await activeWallet(
        client,
        user.id,
        challenge.subject_wallet_id
      )
      if (!targetWallet) throw new Error("IDENTITY_WALLET_NOT_LINKED")
      const wallets = await client.query(
        `SELECT id, is_primary FROM identity.wallets
          WHERE user_id = $1 AND verification_status = 'verified' AND revoked_at IS NULL
          ORDER BY linked_at ASC, id ASC FOR UPDATE`,
        [user.id]
      )
      if (wallets.rows.length <= 1)
        throw new Error("IDENTITY_LAST_WALLET_CANNOT_BE_REVOKED")
      const wasPrimary = wallets.rows.some(
        (wallet) => wallet.id === targetWallet.id && wallet.is_primary
      )
      await client.query(
        `UPDATE identity.wallets SET verification_status = 'revoked', revoked_at = now(), is_primary = false
          WHERE id = $1 AND user_id = $2`,
        [targetWallet.id, user.id]
      )
      if (wasPrimary) {
        const nextPrimary = wallets.rows.find(
          (wallet) => wallet.id !== targetWallet.id
        )
        if (nextPrimary)
          await client.query(
            "UPDATE identity.wallets SET is_primary = true WHERE id = $1",
            [nextPrimary.id]
          )
      }
      await client.query(
        `UPDATE identity.sessions SET revoked_at = now(), revoke_reason_code = 'wallet_revoked'
          WHERE user_id = $1 AND revoked_at IS NULL
            AND (authenticated_wallet_id = $2 OR reauthenticated_wallet_id = $2)`,
        [user.id, targetWallet.id]
      )
      await appendAudit(client, {
        actorKind: "user",
        actorUserId: user.id,
        subjectUserId: user.id,
        subjectWalletId: targetWallet.id,
        actionCode: "wallet.revoked",
        requestId: challenge.id,
        metadata: {
          sessions_revoked_for_wallet: true,
          primary_reassigned: wasPrimary,
        },
      })
      return {
        authenticated: true as const,
        revoked: true as const,
        userId: user.id,
        currentSessionRevoked:
          session.authenticated_wallet_id === targetWallet.id ||
          session.reauthenticated_wallet_id === targetWallet.id,
      }
    }

    throw new Error("IDENTITY_CHALLENGE_INVALID")
  })
}

async function issueSession(
  client: IdentityClient,
  userId: string,
  walletId: string
) {
  const sessionId = randomUUID()
  const token = createOpaqueToken()
  const csrf = createOpaqueToken()
  const { idle, absolute } = sessionDurations()
  const result = await client.query(
    `INSERT INTO identity.sessions
      (id, user_id, authenticated_wallet_id, token_hash, csrf_token_hash,
       last_seen_at, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, $4, $5, now(), now() + ($6 * interval '1 second'), now() + ($7 * interval '1 second'))
     RETURNING absolute_expires_at`,
    [sessionId, userId, walletId, sha256(token), sha256(csrf), idle, absolute]
  )
  return {
    sessionId,
    token,
    csrf,
    absoluteExpiresAt: new Date(
      result.rows[0].absolute_expires_at
    ).toISOString(),
  }
}

export async function appendAudit(
  client: IdentityClient,
  event: {
    actorKind: "user" | "staff" | "system"
    actorUserId: string | null
    subjectUserId: string | null
    subjectWalletId: string | null
    actionCode: string
    requestId: string | null
    metadata?: Record<string, unknown>
  }
) {
  const serialized = JSON.stringify(event.metadata ?? {})
  if (Buffer.byteLength(serialized, "utf8") > 4096)
    throw new Error("IDENTITY_AUDIT_METADATA_TOO_LARGE")
  await client.query(
    `INSERT INTO identity.identity_audit_events
      (id, actor_kind, actor_user_id, subject_user_id, subject_wallet_id, action_code, request_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      randomUUID(),
      event.actorKind,
      event.actorUserId,
      event.subjectUserId,
      event.subjectWalletId,
      event.actionCode,
      event.requestId,
      serialized,
    ]
  )
}

export async function getAccount(userId: string) {
  return withIdentityRead(async (client) => {
    const [user, wallets] = await Promise.all([
      client.query(
        "SELECT id, status, created_at FROM identity.users WHERE id = $1",
        [userId]
      ),
      client.query(
        `SELECT id, address_normalized AS address, is_primary, linked_at, last_authenticated_at
           FROM identity.wallets WHERE user_id = $1 AND verification_status = 'verified' AND revoked_at IS NULL
          ORDER BY is_primary DESC, linked_at ASC`,
        [userId]
      ),
    ])
    if (!user.rows[0] || user.rows[0].status !== "active") return null
    return {
      id: user.rows[0].id,
      status: user.rows[0].status,
      createdAt: new Date(user.rows[0].created_at).toISOString(),
      wallets: wallets.rows,
    }
  })
}

export async function touchSession(sessionId: string, userId: string) {
  return withIdentityTransaction(async (client) => {
    const { idle } = sessionDurations()
    const result = await client.query(
      `UPDATE identity.sessions s SET last_seen_at = now(),
          idle_expires_at = LEAST(s.absolute_expires_at, now() + ($3 * interval '1 second'))
        FROM identity.users u
       WHERE s.id = $1 AND s.user_id = $2 AND u.id = s.user_id AND u.status = 'active'
         AND s.revoked_at IS NULL AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
         AND EXISTS (SELECT 1 FROM identity.wallets aw WHERE aw.id = s.authenticated_wallet_id
           AND aw.user_id = s.user_id AND aw.verification_status = 'verified' AND aw.revoked_at IS NULL)
       RETURNING s.idle_expires_at`,
      [sessionId, userId, idle]
    )
    if (!result.rows[0]) throw new Error("IDENTITY_SESSION_REQUIRED")
    return new Date(result.rows[0].idle_expires_at).toISOString()
  })
}

export async function rotateSession(
  sessionId: string,
  userId: string,
  oldTokenHash: Buffer
) {
  return withIdentityTransaction(async (client) => {
    const token = createOpaqueToken()
    const csrf = createOpaqueToken()
    const result = await client.query(
      `UPDATE identity.sessions s SET token_hash = $4, csrf_token_hash = $5,
          last_seen_at = now(), idle_expires_at = LEAST(s.absolute_expires_at, now() + ($6 * interval '1 second'))
        FROM identity.users u
       WHERE s.id = $1 AND s.user_id = $2 AND s.token_hash = $3 AND u.id = s.user_id AND u.status = 'active'
         AND s.revoked_at IS NULL AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
         AND EXISTS (SELECT 1 FROM identity.wallets aw WHERE aw.id = s.authenticated_wallet_id
           AND aw.user_id = s.user_id AND aw.verification_status = 'verified' AND aw.revoked_at IS NULL)
       RETURNING s.absolute_expires_at`,
      [
        sessionId,
        userId,
        oldTokenHash,
        sha256(token),
        sha256(csrf),
        sessionDurations().idle,
      ]
    )
    if (!result.rows[0]) throw new Error("IDENTITY_SESSION_REQUIRED")
    await appendAudit(client, {
      actorKind: "user",
      actorUserId: userId,
      subjectUserId: userId,
      subjectWalletId: null,
      actionCode: "auth.session_rotated",
      requestId: null,
    })
    return {
      token,
      csrf,
      absoluteExpiresAt: new Date(
        result.rows[0].absolute_expires_at
      ).toISOString(),
    }
  })
}

export async function revokeCurrentSession(sessionId: string, userId: string) {
  await withIdentityTransaction(async (client) => {
    const result = await client.query(
      `UPDATE identity.sessions SET revoked_at = now(), revoke_reason_code = 'logout'
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
      [sessionId, userId]
    )
    if (result.rows.length)
      await appendAudit(client, {
        actorKind: "user",
        actorUserId: userId,
        subjectUserId: userId,
        subjectWalletId: null,
        actionCode: "auth.session_revoked",
        requestId: null,
        metadata: { scope: "current" },
      })
  })
}

export async function revokeOtherSessions(sessionId: string, userId: string) {
  await withIdentityTransaction(async (client) => {
    const result = await client.query(
      `UPDATE identity.sessions SET revoked_at = now(), revoke_reason_code = 'logout_others'
        WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL RETURNING id`,
      [userId, sessionId]
    )
    await appendAudit(client, {
      actorKind: "user",
      actorUserId: userId,
      subjectUserId: userId,
      subjectWalletId: null,
      actionCode: "auth.other_sessions_revoked",
      requestId: null,
      metadata: { count: result.rows.length },
    })
  })
}

export async function suspendIdentityUser(userId: string, reasonCode: string) {
  if (!/^[a-z0-9_]{1,64}$/.test(reasonCode))
    throw new Error("IDENTITY_REQUEST_INVALID")
  await withIdentityTransaction(async (client) => {
    await client.query(
      `UPDATE identity.users SET status = 'suspended', suspended_at = now(), updated_at = now(), status_reason_code = $2
        WHERE id = $1 AND status = 'active'`,
      [userId, reasonCode]
    )
    await client.query(
      `UPDATE identity.sessions SET revoked_at = now(), revoke_reason_code = 'account_suspended'
        WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    )
    await appendAudit(client, {
      actorKind: "system",
      actorUserId: null,
      subjectUserId: userId,
      subjectWalletId: null,
      actionCode: "account.suspended",
      requestId: null,
      metadata: { reason_code: reasonCode },
    })
  })
}

export async function requestAccountClosure() {
  throw new Error("IDENTITY_RETENTION_POLICY_REQUIRED")
}
