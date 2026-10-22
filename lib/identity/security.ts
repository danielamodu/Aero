import { createHmac } from "node:crypto"
import { equalSecret, sha256 } from "./primitives.mjs"
import { withIdentityRead } from "./db"
import { isIdentityDatabaseUnavailableCode } from "./error-codes.mjs"

export const SESSION_COOKIE = "__Host-aero_session"
export const CSRF_COOKIE = "__Host-aero_csrf"
export const FUJI_CHAIN_ID = 43113

export function configuredOrigin(): URL {
  const raw = process.env.AERO_AUTH_ORIGIN
  if (!raw) throw new Error("IDENTITY_ORIGIN_UNCONFIGURED")
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("IDENTITY_ORIGIN_INVALID")
  }
  const localHost =
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname === "127.0.0.1"
  if (url.origin !== raw || (url.protocol !== "https:" && !localHost)) {
    throw new Error("IDENTITY_ORIGIN_INVALID")
  }
  return url
}

export function assertTrustedOrigin(request: Request): void {
  const origin = configuredOrigin().origin
  if (request.headers.get("origin") !== origin)
    throw new Error("IDENTITY_ORIGIN_REJECTED")
  const fetchSite = request.headers.get("sec-fetch-site")
  if (fetchSite && fetchSite !== "same-origin")
    throw new Error("IDENTITY_ORIGIN_REJECTED")
}

function readCookie(request: Request, key: string): string | null {
  const all = request.headers.get("cookie") ?? ""
  for (const part of all.split(";")) {
    const index = part.indexOf("=")
    if (index < 0 || part.slice(0, index).trim() !== key) continue
    return part.slice(index + 1).trim()
  }
  return null
}

export type IdentitySession = {
  id: string
  userId: string
  authenticatedWalletId: string
  tokenHash: Buffer
  csrfHash: Buffer
  idleExpiresAt: string
  absoluteExpiresAt: string
  reauthenticatedAt: string | null
  reauthenticatedWalletId: string | null
}

export async function resolveSession(
  request: Request
): Promise<IdentitySession | null> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token || token.length < 40 || token.length > 128) return null
  const tokenHash = sha256(token)
  return withIdentityRead(async (client) => {
    const result = await client.query(
      `SELECT s.id, s.user_id, s.authenticated_wallet_id, s.token_hash, s.csrf_token_hash,
              s.idle_expires_at, s.absolute_expires_at, s.reauthenticated_at,
              s.reauthenticated_wallet_id
         FROM identity.sessions s
         JOIN identity.users u ON u.id = s.user_id
         JOIN identity.wallets aw ON aw.id = s.authenticated_wallet_id AND aw.user_id = s.user_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL
          AND s.idle_expires_at > now() AND s.absolute_expires_at > now()
          AND u.status = 'active' AND aw.verification_status = 'verified' AND aw.revoked_at IS NULL`,
      [tokenHash]
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      id: row.id,
      userId: row.user_id,
      authenticatedWalletId: row.authenticated_wallet_id,
      tokenHash: Buffer.from(row.token_hash),
      csrfHash: Buffer.from(row.csrf_token_hash),
      idleExpiresAt: new Date(row.idle_expires_at).toISOString(),
      absoluteExpiresAt: new Date(row.absolute_expires_at).toISOString(),
      reauthenticatedAt: row.reauthenticated_at
        ? new Date(row.reauthenticated_at).toISOString()
        : null,
      reauthenticatedWalletId: row.reauthenticated_wallet_id,
    }
  })
}

export function assertCsrf(request: Request, session: IdentitySession): void {
  const cookie = readCookie(request, CSRF_COOKIE)
  const header = request.headers.get("x-aero-csrf")
  if (!cookie || !header || !equalSecret(cookie, header))
    throw new Error("IDENTITY_CSRF_REJECTED")
  const digest = sha256(cookie)
  if (
    digest.length !== session.csrfHash.length ||
    !equalSecret(digest.toString("hex"), session.csrfHash.toString("hex"))
  ) {
    throw new Error("IDENTITY_CSRF_REJECTED")
  }
}

export function rateLimitDigest(key: string): Buffer {
  const secret = process.env.AERO_SESSION_SECRET
  if (!secret || Buffer.byteLength(secret) < 32)
    throw new Error("IDENTITY_SESSION_SECRET_INVALID")
  return createHmac("sha256", secret)
    .update(`aero-identity-rate:${key}`)
    .digest()
}

export function sessionDurations() {
  const idle = Number(process.env.AERO_SESSION_IDLE_SECONDS ?? 43200)
  const absolute = Number(process.env.AERO_SESSION_ABSOLUTE_SECONDS ?? 604800)
  if (
    !Number.isSafeInteger(idle) ||
    !Number.isSafeInteger(absolute) ||
    idle < 60 ||
    absolute < idle ||
    absolute > 2592000
  ) {
    throw new Error("IDENTITY_SESSION_POLICY_INVALID")
  }
  return { idle, absolute }
}

export function securityFailureStatus(code: string): number {
  if (
    [
      "IDENTITY_DATABASE_UNAVAILABLE",
      "IDENTITY_ORIGIN_UNCONFIGURED",
      "IDENTITY_ORIGIN_INVALID",
      "IDENTITY_SESSION_SECRET_INVALID",
      "IDENTITY_SESSION_POLICY_INVALID",
      "IDENTITY_FUJI_RPC_UNCONFIGURED",
      "IDENTITY_FUJI_RPC_UNAVAILABLE",
      "IDENTITY_FUJI_RPC_CHAIN_MISMATCH",
      "IDENTITY_FUJI_RPC_RESPONSE_INVALID",
      "IDENTITY_RATE_LIMIT_UNAVAILABLE",
    ].includes(code)
  )
    return 503
  if (code === "IDENTITY_ORIGIN_REJECTED" || code === "IDENTITY_CSRF_REJECTED")
    return 403
  if (
    [
      "IDENTITY_SESSION_REQUIRED",
      "IDENTITY_CHALLENGE_INVALID",
      "IDENTITY_ACCOUNT_UNAVAILABLE",
    ].includes(code)
  )
    return 401
  return 400
}

export function errorCode(error: unknown): string {
  if (error instanceof Error && /^[A-Z0-9_]+$/.test(error.message))
    return error.message
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code)
    // Connection failures, shutdown and missing schema/table mean the identity
    // store is not usable. Report unavailable rather than a generic 400 so
    // operators can distinguish drift from a malformed request.
    if (isIdentityDatabaseUnavailableCode(code))
      return "IDENTITY_DATABASE_UNAVAILABLE"
    if (["23505", "23503", "23514"].includes(code))
      return "IDENTITY_CONFLICT"
  }
  return "IDENTITY_REQUEST_FAILED"
}
