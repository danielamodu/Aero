import { redirect } from "next/navigation"
import { timingSafeEqual } from "node:crypto"
import { confirmToken } from "@/lib/waitlist"
import { db } from "@/lib/db"
import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"

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

  const sql = db()
  if (sql) {
    const rows = (await sql`UPDATE waitlist SET confirmed = TRUE, confirmed_at = NOW() WHERE email = ${email} AND username = ${username} RETURNING id`) as { id: number }[]
    if (rows.length === 0) redirect("/confirmed?error=1")
  } else {
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
  }

  redirect(`/confirmed?user=${encodeURIComponent(`@${username}`)}`)
}
