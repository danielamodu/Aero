import test from "node:test"
import assert from "node:assert/strict"
import { createHash, randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { Pool, neonConfig } from "@neondatabase/serverless"
import WebSocket from "ws"
import {
  closeIdentityPool,
  getIdentityPool,
  identityPoolStats,
  resetIdentityPoolForTests,
} from "../../lib/identity/pool.mjs"

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const migrationDir = join(root, "migrations", "identity")
const runFile = promisify(execFile)

const integrationUrl = process.env.AERO_TEST_DATABASE_URL
const integrationOptIn =
  process.env.AERO_TEST_DATABASE_CONFIRM === "I_AM_USING_A_DISPOSABLE_DATABASE"
const skip =
  integrationUrl && integrationOptIn
    ? false
    : "set AERO_TEST_DATABASE_URL and AERO_TEST_DATABASE_CONFIRM=I_AM_USING_A_DISPOSABLE_DATABASE for a disposable DB"

// These tests exercise the SQL predicates and constraints that the identity
// service relies on. They are deliberately SQL-level: the service module is
// TypeScript with Next path aliases and is not importable by the Node test
// runner without a build step.
async function applyMigrations() {
  await runFile(process.execPath, [join(root, "scripts", "migrate-identity.mjs")], {
    env: { ...process.env, DATABASE_URL: integrationUrl },
  })
}

function address(seed) {
  return `0x${createHash("sha256").update(seed).digest("hex").slice(0, 40)}`
}

function bytes(seed) {
  return createHash("sha256").update(seed).digest()
}

async function seedUser(client, label) {
  const userId = randomUUID()
  const walletId = randomUUID()
  const walletAddress = address(label)
  await client.query("INSERT INTO identity.users (id) VALUES ($1)", [userId])
  await client.query(
    `INSERT INTO identity.wallets
       (id, user_id, namespace, wallet_kind, address_normalized, verification_status, is_primary)
     VALUES ($1, $2, 'eip155', 'eoa', $3, 'verified', true)`,
    [walletId, userId, walletAddress]
  )
  return { userId, walletId, walletAddress }
}

async function seedSession(client, userId, walletId, options = {}) {
  const sessionId = randomUUID()
  const tokenHash = options.tokenHash ?? bytes(`token:${sessionId}`)
  await client.query(
    `INSERT INTO identity.sessions
       (id, user_id, authenticated_wallet_id, token_hash, csrf_token_hash,
        created_at, last_seen_at, idle_expires_at, absolute_expires_at)
     VALUES ($1, $2, $3, $4, $5,
        now() - ($6 * interval '1 second'),
        now() - ($7 * interval '1 second'),
        now() + ($8 * interval '1 second'),
        now() + ($9 * interval '1 second'))`,
    [
      sessionId,
      userId,
      walletId,
      tokenHash,
      bytes(`csrf:${sessionId}`),
      options.createdAgo ?? 0,
      options.lastSeenAgo ?? 0,
      options.idle ?? 43200,
      options.absolute ?? 604800,
    ]
  )
  return { sessionId, tokenHash }
}

async function seedChallenge(client, { userId, sessionId, walletId, targetAddress }) {
  const id = randomUUID()
  const target = targetAddress ?? address(`target:${id}`)
  await client.query(
    `INSERT INTO identity.wallet_challenges
       (id, purpose, operation, user_id, initiating_session_id, initiating_wallet_id,
        subject_wallet_id, target_namespace, target_wallet_kind, target_address_normalized,
        chain_id, domain, uri, statement, message_hash, nonce_hash, rate_limit_key_hash,
        issued_at, expires_at)
     VALUES ($1, 'link_wallet', 'none', $2, $3, $4, NULL, 'eip155', 'eoa', $5,
        43113, 'testnet.useaero.org', 'https://testnet.useaero.org/api/identity/verify',
        'Link this wallet to your Aero account.',
        $6, $7, $8, now(), now() + interval '5 minutes')`,
    [
      id,
      userId,
      sessionId,
      walletId,
      target,
      bytes(`message:${id}`),
      bytes(`nonce:${id}`),
      bytes(`rate:${target}`),
    ]
  )
  return { id, target }
}

// Mirrors lib/identity/security.ts resolveSession().
async function resolvableSession(client, tokenHash) {
  const result = await client.query(
    `SELECT s.id
       FROM identity.sessions s
       JOIN identity.users u ON u.id = s.user_id
       JOIN identity.wallets aw ON aw.id = s.authenticated_wallet_id AND aw.user_id = s.user_id
      WHERE s.token_hash = $1 AND s.revoked_at IS NULL
        AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
        AND u.status = 'active' AND aw.verification_status = 'verified' AND aw.revoked_at IS NULL`,
    [tokenHash]
  )
  return result.rows.length === 1
}

// Mirrors the consume-once step in lib/identity/service.ts.
async function consumeOnce(pool, challengeId, holdMs) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const locked = await client.query(
      "SELECT * FROM identity.wallet_challenges WHERE id = $1 FOR UPDATE",
      [challengeId]
    )
    const challenge = locked.rows[0]
    if (holdMs) await client.query("SELECT pg_sleep($1)", [holdMs / 1000])
    let won = false
    if (challenge && !challenge.consumed_at && !challenge.invalidated_at) {
      const marked = await client.query(
        `UPDATE identity.wallet_challenges SET consumed_at = now()
          WHERE id = $1 AND consumed_at IS NULL AND invalidated_at IS NULL RETURNING id`,
        [challengeId]
      )
      won = marked.rows.length === 1
    }
    await client.query("COMMIT")
    return won
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      /* already aborted */
    }
    throw error
  } finally {
    client.release()
  }
}

test(
  "Postgres identity integration: migration ledger, rollback, concurrency, sessions, audit, constraints",
  { skip },
  async (t) => {
    if (!integrationUrl) return
    neonConfig.webSocketConstructor = WebSocket
    await applyMigrations()
    const pool = new Pool({ connectionString: integrationUrl, max: 5 })
    try {
      await t.test("repeat migration is a checksum-verified no-op", async () => {
        const ledger = await pool.query(
          "SELECT migration_id, checksum_sha256, applied_at FROM public.identity_schema_migrations ORDER BY migration_id"
        )
        assert.equal(ledger.rows.length, 3)
        for (const row of ledger.rows) {
          const source = await readFile(
            join(migrationDir, row.migration_id),
            "utf8"
          )
          const checksum = createHash("sha256").update(source).digest("hex")
          assert.equal(row.checksum_sha256.trim(), checksum)
        }
        const before = ledger.rows.map((row) => row.applied_at.toISOString())
        await applyMigrations()
        const after = await pool.query(
          "SELECT applied_at FROM public.identity_schema_migrations ORDER BY migration_id"
        )
        assert.deepEqual(
          after.rows.map((row) => row.applied_at.toISOString()),
          before
        )
      })

      await t.test("failed identity work rolls back users, wallets, sessions and audit rows together", async () => {
        const client = await pool.connect()
        const userId = randomUUID()
        const walletId = randomUUID()
        const sessionId = randomUUID()
        const auditId = randomUUID()
        const walletAddress = address(`rollback:${userId}`)
        try {
          await client.query("BEGIN")
          await client.query("INSERT INTO identity.users (id) VALUES ($1)", [
            userId,
          ])
          await client.query(
            `INSERT INTO identity.wallets
               (id, user_id, namespace, wallet_kind, address_normalized, verification_status, is_primary)
             VALUES ($1, $2, 'eip155', 'eoa', $3, 'verified', true)`,
            [walletId, userId, walletAddress]
          )
          await client.query(
            `INSERT INTO identity.sessions
               (id, user_id, authenticated_wallet_id, token_hash, csrf_token_hash,
                idle_expires_at, absolute_expires_at)
             VALUES ($1, $2, $3, $4, $5, now() + interval '1 hour', now() + interval '1 day')`,
            [sessionId, userId, walletId, bytes("rollback-token"), bytes("rollback-csrf")]
          )
          await client.query(
            `INSERT INTO identity.identity_audit_events (id, actor_kind, action_code)
             VALUES ($1, 'system', 'test.rollback')`,
            [auditId]
          )
          // Force a failure after all four writes.
          await assert.rejects(
            client.query(
              "INSERT INTO identity.wallets (id, user_id, namespace, wallet_kind, address_normalized, verification_status) VALUES ($1, $2, 'eip155', 'eoa', $3, 'verified')",
              [randomUUID(), userId, walletAddress]
            )
          )
          await client.query("ROLLBACK")
          const counts = await client.query(
            `SELECT
               (SELECT count(*)::int FROM identity.users WHERE id = $1) AS users,
               (SELECT count(*)::int FROM identity.wallets WHERE id = $2) AS wallets,
               (SELECT count(*)::int FROM identity.sessions WHERE id = $3) AS sessions,
               (SELECT count(*)::int FROM identity.identity_audit_events WHERE id = $4) AS audit`,
            [userId, walletId, sessionId, auditId]
          )
          assert.deepEqual(counts.rows[0], {
            users: 0,
            wallets: 0,
            sessions: 0,
            audit: 0,
          })
        } finally {
          try {
            await client.query("ROLLBACK")
          } catch {
            /* no active transaction */
          }
          client.release()
        }
      })

      await t.test("concurrent consumption commits exactly one session-side effect", async () => {
        const client = await pool.connect()
        let seeded
        try {
          seeded = await seedUser(client, `consume:${randomUUID()}`)
          const session = await seedSession(
            client,
            seeded.userId,
            seeded.walletId
          )
          seeded.session = session
        } finally {
          client.release()
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const client2 = await pool.connect()
          let challenge
          try {
            challenge = await seedChallenge(client2, {
              userId: seeded.userId,
              sessionId: seeded.session.sessionId,
              walletId: seeded.walletId,
            })
          } finally {
            client2.release()
          }
          const [first, second] = await Promise.all([
            consumeOnce(pool, challenge.id, 400),
            consumeOnce(pool, challenge.id, 0),
          ])
          assert.equal(
            [first, second].filter(Boolean).length,
            1,
            "exactly one concurrent consumer wins"
          )
          const replay = await consumeOnce(pool, challenge.id, 0)
          assert.equal(replay, false, "consumed challenge cannot be replayed")
        }
      })

      await t.test("concurrent same-address linking is decided by the active-wallet unique index", async () => {
        const owner = await pool.connect()
        const a = await pool.connect()
        const b = await pool.connect()
        try {
          const userA = randomUUID()
          const userB = randomUUID()
          await owner.query("INSERT INTO identity.users (id) VALUES ($1), ($2)", [
            userA,
            userB,
          ])
          const shared = address(`race:${userA}`)
          await a.query("BEGIN")
          await b.query("BEGIN")
          const insert = (client, userId) =>
            client.query(
              `INSERT INTO identity.wallets
                 (id, user_id, namespace, wallet_kind, address_normalized, verification_status, is_primary)
               VALUES ($1, $2, 'eip155', 'eoa', $3, 'verified', false)`,
              [randomUUID(), userId, shared]
            )
          const results = await Promise.allSettled([
            insert(a, userA).then(() => a.query("COMMIT")),
            insert(b, userB).then(() => b.query("COMMIT")),
          ])
          const fulfilled = results.filter((r) => r.status === "fulfilled")
          const rejected = results.filter((r) => r.status === "rejected")
          assert.equal(fulfilled.length, 1)
          assert.equal(rejected.length, 1)
          assert.equal(rejected[0].reason.code, "23505")
          const rows = await owner.query(
            `SELECT count(*)::int AS count FROM identity.wallets
              WHERE address_normalized = $1 AND verification_status = 'verified' AND revoked_at IS NULL`,
            [shared]
          )
          assert.equal(rows.rows[0].count, 1)
        } finally {
          try {
            await a.query("ROLLBACK")
          } catch {
            /* no active transaction */
          }
          try {
            await b.query("ROLLBACK")
          } catch {
            /* no active transaction */
          }
          a.release()
          b.release()
          owner.release()
        }
      })

      await t.test("session creation, rotation, revocation and expiry follow the resolver predicates", async () => {
        const client = await pool.connect()
        try {
          const seeded = await seedUser(client, `session:${randomUUID()}`)
          const session = await seedSession(client, seeded.userId, seeded.walletId)
          assert.equal(await resolvableSession(client, session.tokenHash), true)

          const rotated = bytes(`rotated:${session.sessionId}`)
          const update = await client.query(
            `UPDATE identity.sessions
                SET token_hash = $4
              WHERE id = $1 AND user_id = $2 AND token_hash = $3 AND revoked_at IS NULL
                AND idle_expires_at > now() AND absolute_expires_at > now()
              RETURNING id`,
            [session.sessionId, seeded.userId, session.tokenHash, rotated]
          )
          assert.equal(update.rows.length, 1)
          assert.equal(await resolvableSession(client, session.tokenHash), false)
          assert.equal(await resolvableSession(client, rotated), true)

          const stale = await client.query(
            `UPDATE identity.sessions SET token_hash = $4
              WHERE id = $1 AND user_id = $2 AND token_hash = $3 AND revoked_at IS NULL
              RETURNING id`,
            [session.sessionId, seeded.userId, session.tokenHash, bytes("stale")]
          )
          assert.equal(stale.rows.length, 0, "previous token is unusable")

          await client.query(
            "UPDATE identity.sessions SET revoked_at = now(), revoke_reason_code = 'logout' WHERE id = $1",
            [session.sessionId]
          )
          assert.equal(await resolvableSession(client, rotated), false)

          const idle = await seedSession(client, seeded.userId, seeded.walletId, {
            createdAgo: 7200,
            lastSeenAgo: 7200,
            idle: -1,
            absolute: 86400,
          })
          assert.equal(await resolvableSession(client, idle.tokenHash), false)
          const absolute = await seedSession(
            client,
            seeded.userId,
            seeded.walletId,
            {
              createdAgo: 7200,
              lastSeenAgo: 7200,
              idle: -2,
              absolute: -1,
            }
          )
          assert.equal(await resolvableSession(client, absolute.tokenHash), false)

          const live = await seedSession(client, seeded.userId, seeded.walletId)
          await client.query(
            "UPDATE identity.wallets SET verification_status = 'revoked', revoked_at = now(), is_primary = false WHERE id = $1",
            [seeded.walletId]
          )
          assert.equal(
            await resolvableSession(client, live.tokenHash),
            false,
            "revoking the authenticated wallet invalidates its sessions"
          )
        } finally {
          client.release()
        }
      })

      await t.test("primary-wallet invariants survive revocation and promotion", async () => {
        const client = await pool.connect()
        try {
          const seeded = await seedUser(client, `primary:${randomUUID()}`)
          const secondWallet = randomUUID()
          await client.query(
            `INSERT INTO identity.wallets
               (id, user_id, namespace, wallet_kind, address_normalized, verification_status, is_primary)
             VALUES ($1, $2, 'eip155', 'eoa', $3, 'verified', false)`,
            [secondWallet, seeded.userId, address(`second:${seeded.userId}`)]
          )
          const duplicatePrimary = await client
            .query(
              `INSERT INTO identity.wallets
                 (id, user_id, namespace, wallet_kind, address_normalized, verification_status, is_primary)
               VALUES ($1, $2, 'eip155', 'eoa', $3, 'verified', true)`,
              [randomUUID(), seeded.userId, address(`third:${seeded.userId}`)]
            )
            .then(
              () => null,
              (error) => error
            )
          assert.equal(duplicatePrimary?.code, "23505")

          await client.query("BEGIN")
          await client.query(
            "UPDATE identity.wallets SET verification_status = 'revoked', revoked_at = now(), is_primary = false WHERE id = $1",
            [seeded.walletId]
          )
          await client.query(
            "UPDATE identity.wallets SET is_primary = true WHERE id = $1",
            [secondWallet]
          )
          await client.query("COMMIT")

          const primaries = await client.query(
            `SELECT id FROM identity.wallets
              WHERE user_id = $1 AND is_primary AND verification_status = 'verified' AND revoked_at IS NULL`,
            [seeded.userId]
          )
          assert.deepEqual(
            primaries.rows.map((row) => row.id),
            [secondWallet]
          )
        } finally {
          client.release()
        }
      })

      await t.test("cross-user foreign keys reject mixed ownership", async () => {
        const client = await pool.connect()
        try {
          const a = await seedUser(client, `fka:${randomUUID()}`)
          const b = await seedUser(client, `fkb:${randomUUID()}`)
          const session = await seedSession(client, a.userId, a.walletId)
          await assert.rejects(
            client.query(
              `INSERT INTO identity.sessions
                 (id, user_id, authenticated_wallet_id, token_hash, csrf_token_hash,
                  idle_expires_at, absolute_expires_at)
               VALUES ($1, $2, $3, $4, $5, now() + interval '1 hour', now() + interval '1 day')`,
              [randomUUID(), b.userId, a.walletId, bytes("cross"), bytes("cross")]
            ),
            (error) => error.code === "23503"
          )
          await assert.rejects(
            client.query(
              `INSERT INTO identity.wallet_challenges
                 (id, purpose, operation, user_id, initiating_session_id, initiating_wallet_id,
                  target_namespace, target_wallet_kind, target_address_normalized, chain_id,
                  domain, uri, statement, message_hash, nonce_hash, rate_limit_key_hash,
                  issued_at, expires_at)
               VALUES ($1, 'link_wallet', 'none', $2, $3, $4, 'eip155', 'eoa', $5, 43113,
                  'x', 'https://x/verify', 's', $6, $7, $8, now(), now() + interval '5 minutes')`,
              [
                randomUUID(),
                b.userId,
                session.sessionId,
                b.walletId,
                address("cross-challenge"),
                bytes("m"),
                bytes("n"),
                bytes("r"),
              ]
            ),
            (error) => error.code === "23503"
          )
        } finally {
          client.release()
        }
      })

      await t.test("challenge purpose, chain and wallet-kind constraints reject unsafe rows", async () => {
        const client = await pool.connect()
        try {
          const seeded = await seedUser(client, `purpose:${randomUUID()}`)
          const session = await seedSession(client, seeded.userId, seeded.walletId)
          const base = {
            user_id: seeded.userId,
            session_id: session.sessionId,
            wallet_id: seeded.walletId,
            address: address(`purpose-target:${seeded.userId}`),
            chain: 43113,
          }
          const insert = (overrides = {}) => {
            const row = { ...base, ...overrides }
            return client.query(
              `INSERT INTO identity.wallet_challenges
                 (id, purpose, operation, user_id, initiating_session_id, initiating_wallet_id,
                  subject_wallet_id, target_namespace, target_wallet_kind,
                  target_address_normalized, chain_id, domain, uri, statement,
                  message_hash, nonce_hash, rate_limit_key_hash, issued_at, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'eip155', $8, $9, $10, 'x',
                  'https://x/verify', 's', $11, $12, $13, now(), now() + interval '5 minutes')`,
              [
                randomUUID(),
                row.purpose ?? "link_wallet",
                row.operation ?? "none",
                row.user_id,
                row.session_id,
                row.wallet_id,
                row.subject_wallet_id ?? null,
                row.kind ?? "eoa",
                row.address,
                row.chain,
                bytes(`m:${randomUUID()}`),
                bytes(`n:${randomUUID()}`),
                bytes(`r:${randomUUID()}`),
              ]
            )
          }
          const outcomes = await Promise.allSettled([
            insert({ chain: 1 }),
            insert({ kind: "contract" }),
            insert({ purpose: "link_wallet", subject_wallet_id: seeded.walletId }),
            insert({ purpose: "reauthenticate", operation: "switch_primary" }),
          ])
          assert.equal(
            outcomes.filter((entry) => entry.status === "rejected").length,
            4
          )
          for (const entry of outcomes) {
            assert.equal(entry.reason.code, "23514")
          }
          const valid = await insert()
          assert.equal(valid.rowCount, 1)
        } finally {
          client.release()
        }
      })

      await t.test("audit rows reject UPDATE, DELETE and TRUNCATE", async () => {
        const client = await pool.connect()
        try {
          const auditId = randomUUID()
          await client.query(
            `INSERT INTO identity.identity_audit_events (id, actor_kind, action_code)
             VALUES ($1, 'system', 'test.immutable')`,
            [auditId]
          )
          await assert.rejects(
            client.query(
              "UPDATE identity.identity_audit_events SET action_code = 'changed' WHERE id = $1",
              [auditId]
            ),
            /append-only/
          )
          await assert.rejects(
            client.query("DELETE FROM identity.identity_audit_events WHERE id = $1", [
              auditId,
            ]),
            /append-only/
          )
          await assert.rejects(
            client.query("TRUNCATE identity.identity_audit_events"),
            /append-only/
          )
          const remaining = await client.query(
            "SELECT count(*)::int AS count FROM identity.identity_audit_events WHERE id = $1",
            [auditId]
          )
          assert.equal(remaining.rows[0].count, 1)
        } finally {
          client.release()
        }
      })

      await t.test("distributed rate limiter counts, refuses, and resets atomically", async () => {
        const client = await pool.connect()
        try {
          const key = bytes(`rate:${randomUUID()}`)
          const now = new Date("2026-01-01T00:00:00.000Z")
          const consume = async (at = now, limit = 2) => {
            const result = await client.query(
              `SELECT allowed, remaining, reset_at
                 FROM identity.consume_rate_limit($1, $2, $3, $4)`,
              [key, limit, 60, at]
            )
            return result.rows[0]
          }

          assert.deepEqual(await consume(), {
            allowed: true,
            remaining: 1,
            reset_at: new Date(now.getTime() + 60_000),
          })
          assert.equal((await consume()).allowed, true)
          const refused = await consume()
          assert.equal(refused.allowed, false)
          assert.equal(refused.remaining, 0)

          const other = await client.query(
            `SELECT allowed FROM identity.consume_rate_limit($1, 2, 60, $2)`,
            [bytes(`rate-other:${randomUUID()}`), now]
          )
          assert.equal(other.rows[0].allowed, true, "keys are independent")

          const reset = await consume(new Date(now.getTime() + 61_000))
          assert.equal(reset.allowed, true)
          assert.equal(reset.remaining, 1)

          await assert.rejects(
            client.query(
              `SELECT * FROM identity.consume_rate_limit($1, 2, 60, $2)`,
              [Buffer.alloc(31), now]
            ),
            (error) => error.code === "22023"
          )
          await assert.rejects(
            client.query(
              `SELECT * FROM identity.consume_rate_limit($1, 0, 60, $2)`,
              [key, now]
            ),
            (error) => error.code === "22023"
          )
        } finally {
          client.release()
        }
      })

      await t.test("rate-limit backend failure is observable and recovers after rollback", async () => {
        const client = await pool.connect()
        try {
          await client.query("BEGIN")
          await client.query(
            "ALTER TABLE identity.rate_limits RENAME TO rate_limits_offline_test"
          )
          await assert.rejects(
            client.query(
              `SELECT * FROM identity.consume_rate_limit($1, 2, 60, now())`,
              [bytes(`offline:${randomUUID()}`)]
            ),
            (error) => error.code === "42P01"
          )
          await client.query("ROLLBACK")
          const recovered = await client.query(
            `SELECT allowed FROM identity.consume_rate_limit($1, 2, 60, now())`,
            [bytes(`recovered:${randomUUID()}`)]
          )
          assert.equal(recovered.rows[0].allowed, true)
        } finally {
          try {
            await client.query("ROLLBACK")
          } catch {
            /* no active transaction */
          }
          client.release()
        }
      })

      await t.test("runtime role cannot mutate audit, DDL, or rate-limit state", async () => {
        const role = `aero_identity_runtime_test_${randomUUID().slice(0, 8)}`
        const password = `test-${randomUUID()}-${randomUUID()}`
        const admin = await pool.connect()
        try {
          await seedUser(admin, `runtime-role:${randomUUID()}`)
          await runFile(
            process.execPath,
            [join(root, "scripts", "provision-identity-roles.mjs")],
            {
              env: {
                ...process.env,
                AERO_IDENTITY_ADMIN_DATABASE_URL: integrationUrl,
                AERO_IDENTITY_RUNTIME_ROLE: role,
                AERO_IDENTITY_RUNTIME_PASSWORD: password,
              },
            }
          )

          await admin.query(`SET ROLE "${role}"`)
          assert.equal(
            (await admin.query("SELECT count(*)::int AS count FROM identity.users"))
              .rows[0].count >= 1,
            true
          )
          await assert.rejects(
            admin.query("UPDATE identity.identity_audit_events SET action_code = 'x'"),
            (error) => error.code === "42501"
          )
          await assert.rejects(
            admin.query("TRUNCATE identity.identity_audit_events"),
            (error) => error.code === "42501"
          )
          await assert.rejects(
            admin.query(
              "ALTER TABLE identity.identity_audit_events DISABLE TRIGGER identity_audit_append_only"
            ),
            (error) => error.code === "42501"
          )
          await assert.rejects(
            admin.query("DROP TABLE identity.identity_audit_events"),
            (error) => error.code === "42501"
          )
          await assert.rejects(
            admin.query("CREATE TABLE identity.runtime_should_not_create (id int)"),
            (error) => error.code === "42501"
          )
          await assert.rejects(
            admin.query("SELECT * FROM identity.rate_limits"),
            (error) => error.code === "42501"
          )
          await assert.rejects(
            admin.query("INSERT INTO identity.users (id) VALUES ($1)", [randomUUID()]),
            (error) => error.code === "42501"
          )
          const limiter = await admin.query(
            `SELECT allowed FROM identity.consume_rate_limit($1, 2, 60, now())`,
            [bytes(`runtime:${randomUUID()}`)]
          )
          assert.equal(limiter.rows[0].allowed, true)
          await admin.query(
            `INSERT INTO identity.identity_audit_events (id, actor_kind, action_code)
             VALUES ($1, 'system', 'test.runtime_insert')`,
            [randomUUID()]
          )
        } finally {
          try {
            await admin.query("RESET ROLE")
          } catch {
            /* session may be aborted */
          }
          try {
            await admin.query(`DROP OWNED BY "${role}"`)
            await admin.query(`DROP ROLE "${role}"`)
          } catch {
            /* role may not have been created */
          }
          admin.release()
        }
      })

      await t.test("identity pool is reused across operations and does not end per request", async () => {
        await closeIdentityPool()
        resetIdentityPoolForTests()
        try {
          const first = getIdentityPool({
            connectionString: integrationUrl,
            max: 2,
          })
          const second = getIdentityPool({
            connectionString: integrationUrl,
            max: 2,
          })
          assert.equal(first, second, "same process reuses the pool")
          assert.equal(identityPoolStats().creations, 1)

          const one = await first.query("SELECT 1 AS value")
          assert.equal(one.rows[0].value, 1)
          await Promise.all([
            first.query("SELECT pg_sleep(0.05)"),
            second.query("SELECT 1 AS value"),
          ])
          assert.equal(identityPoolStats().creations, 1)
          assert.ok(identityPoolStats().totalCount <= 2)
        } finally {
          await closeIdentityPool()
        }
        assert.equal(identityPoolStats().totalCount, 0)
        resetIdentityPoolForTests()
      })
    } finally {
      await pool.end()
    }
  }
)
