import { createHmac, timingSafeEqual } from "node:crypto"

export const ADMIN_COOKIE = "aero_admin"

function signature(): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "").update("aero-admin-v1").digest("hex")
}

export function verifyAdminCookie(value: string | undefined): boolean {
  if (!process.env.ADMIN_PASSWORD || !value) return false
  const a = Buffer.from(value)
  const b = Buffer.from(signature())
  return a.length === b.length && timingSafeEqual(a, b)
}

export function adminCookieValue(): string {
  return signature()
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  const a = Buffer.from(createHmac("sha256", "salt").update(input).digest("hex"))
  const b = Buffer.from(createHmac("sha256", "salt").update(expected).digest("hex"))
  return timingSafeEqual(a, b)
}
