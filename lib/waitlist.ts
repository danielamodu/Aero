import { createHmac } from "node:crypto"

function secret(): string {
  return process.env.WAITLIST_SECRET ?? "dev-only-waitlist-secret"
}

/** Stable, unguessable confirmation token for an (email, username) pair. */
export function confirmToken(email: string, username: string): string {
  return createHmac("sha256", secret()).update(`${email}|${username}`).digest("hex").slice(0, 32)
}
