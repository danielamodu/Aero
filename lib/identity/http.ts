import { NextResponse } from "next/server"
import { cookieOptions } from "./primitives.mjs"
import { enforceSessionRequestLimit } from "./rate-limit"
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  assertCsrf,
  assertTrustedOrigin,
  errorCode,
  resolveSession,
  securityFailureStatus,
  type IdentitySession,
} from "./security"

export async function readIdentityJson(
  request: Request
): Promise<Record<string, unknown>> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json")
  ) {
    throw new Error("IDENTITY_REQUEST_INVALID")
  }
  const length = Number(request.headers.get("content-length") ?? 0)
  if (Number.isFinite(length) && length > 8192)
    throw new Error("IDENTITY_BODY_TOO_LARGE")
  const text = await request.text()
  if (Buffer.byteLength(text, "utf8") > 8192)
    throw new Error("IDENTITY_BODY_TOO_LARGE")
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("IDENTITY_REQUEST_INVALID")
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("IDENTITY_REQUEST_INVALID")
  return value as Record<string, unknown>
}

export function identityJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set("cache-control", "no-store")
  return response
}

export function identityError(error: unknown) {
  const code = errorCode(error)
  const status =
    code === "IDENTITY_BODY_TOO_LARGE"
      ? 413
      : code === "IDENTITY_RATE_LIMITED"
        ? 429
        : code === "IDENTITY_LAST_WALLET_CANNOT_BE_REVOKED"
          ? 409
          : code === "IDENTITY_WALLET_ALREADY_LINKED" ||
              code === "IDENTITY_CONFLICT" ||
              code === "IDENTITY_RETENTION_POLICY_REQUIRED"
            ? 409
            : code === "IDENTITY_RECENT_WALLET_PROOF_REQUIRED"
              ? 428
              : securityFailureStatus(code)
  if (
    code.startsWith("IDENTITY_") &&
    ![
      "IDENTITY_ADDRESS_INVALID",
      "IDENTITY_BODY_TOO_LARGE",
      "IDENTITY_REQUEST_INVALID",
      "IDENTITY_WALLET_REQUIRED",
      "IDENTITY_WALLET_NOT_LINKED",
      "IDENTITY_LAST_WALLET_CANNOT_BE_REVOKED",
      "IDENTITY_RECENT_WALLET_PROOF_REQUIRED",
      "IDENTITY_RATE_LIMITED",
      "IDENTITY_CHALLENGE_INVALID",
      "IDENTITY_SIGNUP_CLOSED",
      "IDENTITY_ACCOUNT_UNAVAILABLE",
      "IDENTITY_SESSION_REQUIRED",
      "IDENTITY_WALLET_ALREADY_LINKED",
      "IDENTITY_RETENTION_POLICY_REQUIRED",
    ].includes(code)
  ) {
    // Log only the stable category; query errors and request data may contain sensitive values.
    console.warn("identity request failed", code)
  }
  const publicMessage =
    code === "IDENTITY_RATE_LIMITED"
      ? "Too many attempts. Try again later."
      : code === "IDENTITY_RECENT_WALLET_PROOF_REQUIRED"
        ? "Reauthenticate with a linked wallet, then try again."
        : code === "IDENTITY_LAST_WALLET_CANNOT_BE_REVOKED"
          ? "Link another verified wallet before revoking this one."
          : code === "IDENTITY_SIGNUP_CLOSED"
            ? "Aero account creation is currently closed."
            : code === "IDENTITY_SESSION_REQUIRED"
              ? "Your Aero session has expired. Sign in again."
              : code === "IDENTITY_ADDRESS_INVALID"
                ? "Enter a valid EVM wallet address."
                : code === "IDENTITY_WALLET_NOT_LINKED"
                  ? "That wallet is not available for this account action."
                  : "Identity request could not be completed."
  return identityJson({ ok: false, error: publicMessage }, { status })
}

export async function requireSession(
  request: Request,
  csrf = true
): Promise<IdentitySession> {
  assertTrustedOrigin(request)
  await enforceSessionRequestLimit(request)
  const session = await resolveSession(request)
  if (!session) throw new Error("IDENTITY_SESSION_REQUIRED")
  if (csrf) assertCsrf(request, session)
  return session
}

export function setSessionCookies(
  response: NextResponse,
  token: string,
  csrf: string,
  absoluteExpiresAt: string
) {
  const maxAge = Math.max(
    0,
    Math.floor((new Date(absoluteExpiresAt).getTime() - Date.now()) / 1000)
  )
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge))
  response.cookies.set(CSRF_COOKIE, csrf, {
    ...cookieOptions(maxAge),
    httpOnly: false,
  })
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0))
  response.cookies.set(CSRF_COOKIE, "", {
    ...cookieOptions(0),
    httpOnly: false,
  })
}
