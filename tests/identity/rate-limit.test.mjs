import test from "node:test"
import assert from "node:assert/strict"
import {
  requestRateLimitSubject,
  UNATTRIBUTED,
} from "../../lib/identity/request-ip.mjs"
import {
  CHALLENGE_GLOBAL_LIMIT,
  CHALLENGE_IP_LIMIT,
  CHALLENGE_USER_LIMIT,
  SESSION_IP_LIMIT,
  VERIFY_IP_LIMIT,
  challengeIpLimits,
  challengeUserLimits,
  sessionLimits,
  verifyLimits,
} from "../../lib/identity/rate-limit-policy.mjs"
import { isIdentityDatabaseUnavailableCode } from "../../lib/identity/error-codes.mjs"

function headers(values) {
  return { get: (name) => values[name.toLowerCase()] ?? null }
}

test("forwarded IP headers are ignored unless an explicit trusted proxy is configured", () => {
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-forwarded-for": "203.0.113.10" }),
      { AERO_TRUST_PROXY: "none" }
    ),
    UNATTRIBUTED
  )
  assert.equal(
    requestRateLimitSubject(headers({}), { AERO_TRUST_PROXY: "none" }),
    UNATTRIBUTED
  )
})

test("Vercel mode uses platform-set addresses and never accepts an invalid spoof", () => {
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-vercel-forwarded-for": "203.0.113.10" }),
      { AERO_TRUST_PROXY: "vercel" }
    ),
    "203.0.113.10"
  )
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-forwarded-for": "203.0.113.11, 10.0.0.2" }),
      { AERO_TRUST_PROXY: "vercel" }
    ),
    "203.0.113.11"
  )
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-vercel-forwarded-for": "not-an-ip" }),
      { AERO_TRUST_PROXY: "vercel" }
    ),
    UNATTRIBUTED
  )
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-vercel-forwarded-for": "1.2.3.4:443" }),
      { AERO_TRUST_PROXY: "vercel" }
    ),
    "1.2.3.4"
  )
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-vercel-forwarded-for": "[2001:db8::1]:443" }),
      { AERO_TRUST_PROXY: "vercel" }
    ),
    "2001:db8::1"
  )
})

test("a generic trusted-proxy header must be named explicitly", () => {
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-real-ip": "198.51.100.4" }),
      { AERO_TRUST_PROXY: "header:x-real-ip" }
    ),
    "198.51.100.4"
  )
  assert.equal(
    requestRateLimitSubject(
      headers({ "x-real-ip": "198.51.100.4" }),
      { AERO_TRUST_PROXY: "header:not valid" }
    ),
    UNATTRIBUTED
  )
})

test("challenge IP limits do not contain the wallet address; random addresses share the IP/global bucket", () => {
  const ip = challengeIpLimits("203.0.113.10")
  assert.deepEqual(
    ip.map((entry) => [entry.scope, entry.subject, entry.limit]),
    [
      ["challenge:ip", "203.0.113.10", CHALLENGE_IP_LIMIT],
      ["challenge:global", "all", CHALLENGE_GLOBAL_LIMIT],
    ]
  )
  for (const address of ["0x" + "a".repeat(40), "0x" + "b".repeat(40)]) {
    assert.equal(
      JSON.stringify(challengeIpLimits("203.0.113.10")).includes(address),
      false
    )
  }
  assert.deepEqual(
    challengeUserLimits("user-1").map((entry) => [entry.scope, entry.limit]),
    [["challenge:user", CHALLENGE_USER_LIMIT]]
  )
})

test("verify and session policies are layered and bounded", () => {
  assert.deepEqual(
    verifyLimits("203.0.113.10").map((entry) => [entry.scope, entry.limit]),
    [
      ["verify:ip", VERIFY_IP_LIMIT],
      ["verify:global", 1200],
    ]
  )
  assert.deepEqual(
    sessionLimits("203.0.113.10").map((entry) => [entry.scope, entry.limit]),
    [
      ["session:ip", SESSION_IP_LIMIT],
      ["session:global", 3000],
    ]
  )
})

test("database-unavailable SQLSTATEs fail closed, including a missing limiter function or grant", () => {
  for (const code of ["08006", "53300", "57P03", "42P01", "3F000", "42883", "42501"])
    assert.equal(isIdentityDatabaseUnavailableCode(code), true, code)
  for (const code of ["23505", "23514", "22023", "XX000"])
    assert.equal(isIdentityDatabaseUnavailableCode(code), false, code)
})
