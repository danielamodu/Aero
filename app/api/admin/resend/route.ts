import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/admin-auth"
import { clientIp, throttle } from "@/lib/rate-limit"
import { confirmToken } from "@/lib/waitlist"
import { sendConfirmation } from "@/lib/waitlist-email"
import { db } from "@/lib/db"
import { readSignups } from "@/lib/waitlist-store"

function originOf(req: Request): string {
  return new URL(req.url).origin
}

export async function POST(req: Request) {
  const authed = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  if (!throttle(`ar:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
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
  let username: string | null = null
  if (sql) {
    const rows = (await sql`SELECT username FROM waitlist WHERE email = ${email}`) as { username: string }[]
    if (rows.length > 0) username = rows[0].username
  } else {
    const found = (await readSignups()).find((s) => s.email === email)
    if (found) username = found.username
  }
  if (!username) return NextResponse.json({ ok: false, error: "Signup not found." }, { status: 404 })

  const confirmUrl = `${originOf(req)}/api/waitlist/confirm?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&token=${confirmToken(email, username)}`
  const emailed = await sendConfirmation(email, username, confirmUrl)
  return NextResponse.json({ ok: emailed, error: emailed ? undefined : "Email failed to send." })
}
