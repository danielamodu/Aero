import { redirect } from "next/navigation"
import { timingSafeEqual } from "node:crypto"
import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { confirmToken } from "@/lib/waitlist"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function same(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase()
  const username = (url.searchParams.get("username") ?? "").trim().toLowerCase()
  const token = url.searchParams.get("token") ?? ""

  if (!EMAIL_RE.test(email) || !username || !same(token, confirmToken(email, username))) {
    redirect("/confirmed?error=1")
  }

  try {
    const dir = process.env.WAITLIST_DIR ?? join(process.cwd(), "data")
    await mkdir(dir, { recursive: true })
    await appendFile(
      join(dir, "waitlist.jsonl"),
      JSON.stringify({ event: "confirmed", email, username, created_at: new Date().toISOString() }) + "\n"
    )
  } catch {
    /* non-fatal */
  }

  redirect(`/confirmed?user=${encodeURIComponent(`@${username}`)}`)
}
