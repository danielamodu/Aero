import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/admin-auth"
import { clientIp, throttle } from "@/lib/rate-limit"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  const authed = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  if (!throttle(`adel:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Slow down." }, { status: 429 })
  }

  let email = ""
  try {
    email = (((await req.json()) as { email?: unknown }).email as string ?? "").trim().toLowerCase()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
  }
  if (!email) return NextResponse.json({ ok: false, error: "Email required." }, { status: 400 })

  const sql = db()
  if (sql) {
    await sql`DELETE FROM waitlist WHERE email = ${email}`
  } else {
    try {
      const dir = process.env.WAITLIST_DIR ?? join(process.cwd(), "data")
      const raw = await readFile(join(dir, "waitlist.jsonl"), "utf8")
      const kept = raw.split("\n").filter((line) => {
        if (!line.trim()) return false
        try {
          return (JSON.parse(line) as { email?: string }).email !== email
        } catch {
          return true
        }
      })
      await writeFile(join(dir, "waitlist.jsonl"), kept.join("\n") + (kept.length ? "\n" : ""))
    } catch {
      /* nothing to delete */
    }
  }
  return NextResponse.json({ ok: true })
}
