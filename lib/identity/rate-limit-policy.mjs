// Operational abuse-control defaults. They are deliberately conservative and
// are not a product retention or identity policy decision.
export const CHALLENGE_IP_LIMIT = 30
export const CHALLENGE_GLOBAL_LIMIT = 600
export const CHALLENGE_USER_LIMIT = 20
export const CHALLENGE_WINDOW_SECONDS = 15 * 60
export const VERIFY_IP_LIMIT = 60
export const VERIFY_GLOBAL_LIMIT = 1200
export const VERIFY_WINDOW_SECONDS = 15 * 60
export const SESSION_IP_LIMIT = 120
export const SESSION_GLOBAL_LIMIT = 3000
export const SESSION_WINDOW_SECONDS = 60

function limit(scope, subject, value, windowSeconds) {
  return { scope, subject, limit: value, windowSeconds }
}

export function challengeIpLimits(subject) {
  return [
    limit("challenge:ip", subject, CHALLENGE_IP_LIMIT, CHALLENGE_WINDOW_SECONDS),
    limit(
      "challenge:global",
      "all",
      CHALLENGE_GLOBAL_LIMIT,
      CHALLENGE_WINDOW_SECONDS
    ),
  ]
}

export function challengeUserLimits(userId) {
  return [
    limit(
      "challenge:user",
      userId,
      CHALLENGE_USER_LIMIT,
      CHALLENGE_WINDOW_SECONDS
    ),
  ]
}

export function verifyLimits(subject) {
  return [
    limit("verify:ip", subject, VERIFY_IP_LIMIT, VERIFY_WINDOW_SECONDS),
    limit("verify:global", "all", VERIFY_GLOBAL_LIMIT, VERIFY_WINDOW_SECONDS),
  ]
}

export function sessionLimits(subject) {
  return [
    limit("session:ip", subject, SESSION_IP_LIMIT, SESSION_WINDOW_SECONDS),
    limit("session:global", "all", SESSION_GLOBAL_LIMIT, SESSION_WINDOW_SECONDS),
  ]
}
