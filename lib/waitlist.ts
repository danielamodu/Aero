import { createHmac, randomBytes } from "node:crypto"

function secret(): string {
  return process.env.WAITLIST_SECRET ?? "dev-only-waitlist-secret"
}

/** Stable, unguessable confirmation token for an (email, username) pair. */
export function confirmToken(email: string, username: string): string {
  return createHmac("sha256", secret()).update(`${email}|${username}`).digest("hex").slice(0, 32)
}

/** Absolute confirmation link for an origin (request origin, so previews work too). */
export function confirmUrlFor(origin: string, email: string, username: string): string {
  return `${origin}/api/waitlist/confirm?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&token=${confirmToken(email, username)}`
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

/** 8-char unambiguous referral code (no 0/O, 1/I/L). */
export function genReferralCode(): string {
  const b = randomBytes(8)
  let s = ""
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[b[i] % CODE_ALPHABET.length]
  return s
}
