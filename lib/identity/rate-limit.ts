import { withIdentityTransaction, type IdentityClient } from "./db"
import {
  challengeIpLimits,
  challengeUserLimits,
  sessionLimits,
  verifyLimits,
  type RateLimit,
} from "./rate-limit-policy.mjs"
import { requestRateLimitSubject } from "./request-ip.mjs"
import { SESSION_COOKIE, rateLimitDigest } from "./security"

function hasCookieHeader(request: Request, name: string): boolean {
  const all = request.headers.get("cookie") ?? ""
  for (const part of all.split(";")) {
    const index = part.indexOf("=")
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) return true
  }
  return false
}

async function consumeRateLimit(client: IdentityClient, entry: RateLimit) {
  const key = rateLimitDigest(`${entry.scope}:${entry.subject}`)
  const result = await client.query(
    `SELECT allowed, remaining, reset_at
       FROM identity.consume_rate_limit($1, $2, $3, now())`,
    [key, entry.limit, entry.windowSeconds]
  )
  const row = result.rows[0]
  if (!row || typeof row.allowed !== "boolean")
    throw new Error("IDENTITY_RATE_LIMIT_UNAVAILABLE")
  if (!row.allowed) throw new Error("IDENTITY_RATE_LIMITED")
}

export async function consumeRateLimits(
  client: IdentityClient,
  limits: RateLimit[]
): Promise<void> {
  for (const entry of limits) await consumeRateLimit(client, entry)
}

/**
 * Consume the unauthenticated/per-IP and global challenge budgets in their own
 * committed transaction. Keeping this outside challenge creation means a
 * failed lookup, invalid address, or rolled-back insert cannot refund an abuse
 * attempt.
 */
export async function enforceChallengeLimits(
  request: Request,
  userId?: string
): Promise<void> {
  const subject = requestRateLimitSubject(request.headers)
  const limits = challengeIpLimits(subject)
  if (userId) limits.push(...challengeUserLimits(userId))
  await withIdentityTransaction((client) => consumeRateLimits(client, limits))
}

export async function enforceVerifyLimits(request: Request): Promise<void> {
  const subject = requestRateLimitSubject(request.headers)
  await withIdentityTransaction((client) =>
    consumeRateLimits(client, verifyLimits(subject))
  )
}

/**
 * Cookie-bearing requests are limited even when the token is invalid or
 * expired, so a syntactically valid cookie cannot force unlimited database
 * reads. Requests without a session cookie are handled by the route's own
 * public budget (challenge/verify) or return immediately.
 */
export async function enforceSessionRequestLimit(
  request: Request
): Promise<void> {
  if (!hasCookieHeader(request, SESSION_COOKIE)) return
  const subject = requestRateLimitSubject(request.headers)
  await withIdentityTransaction((client) =>
    consumeRateLimits(client, sessionLimits(subject))
  )
}
