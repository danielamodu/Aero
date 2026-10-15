import { NextResponse } from "next/server"
import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { clientIp, throttle } from "@/lib/rate-limit"
import { confirmToken, genReferralCode } from "@/lib/waitlist"
import { notifyTeam, sendConfirmation } from "@/lib/waitlist-email"
import { db } from "@/lib/db"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const u = raw.trim().replace(/^@+/, "").toLowerCase()
  return /^[a-z0-9_]{3,20}$/.test(u) ? u : null
}

function cleanRef(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const r = raw.trim().toUpperCase()
  return /^[A-Z2-9]{8}$/.test(r) ? r : null
}

/** Best-effort local record (dev fallback when DATABASE_URL is unset). */
async function storeFile(entry: Record<string, string>) {
  try {
    const dir = process.env.WAITLIST_DIR ?? join(process.cwd(), "data")
    await mkdir(dir, { recursive: true })
    await appendFile(join(dir, "waitlist.jsonl"), JSON.stringify(entry) + "\n")
  } catch {
    /* non-fatal */
  }
}

type DbRow = {
  id: number
  email: string
  username: string
  referral_code: string
  confirmed: boolean
  created_at: string
}

async function sendConfirmAndNotify(email: string, username: string, confirmUrl: string): Promise<boolean> {
  const emailed = await sendConfirmation(email, username, confirmUrl)
  await notifyTeam(`Waitlist signup: @${username}`, `@${username} <${email}> joined the waitlist (unconfirmed).`)
  return emailed
}

export async function POST(req: Request) {
  if (!throttle(`wl:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "Slow down — too many signups from here. Try again in a few minutes." },
      { status: 429 }
    )
  }

  let body: { email?: unknown; username?: unknown; referred_by?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const username = cleanUsername(body.username)
  const refCode = cleanRef(body.referred_by)

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 })
  }
  if (!username) {
    return NextResponse.json(
      { ok: false, error: "Usernames are 3–20 characters: letters, numbers, underscores." },
      { status: 400 }
    )
  }

  const sql = db()
  const origin = new URL(req.url).origin
  const confirmUrlFor = (e: string, u: string) =>
    `${origin}/api/waitlist/confirm?email=${encodeURIComponent(e)}&username=${encodeURIComponent(u)}&token=${confirmToken(e, u)}`

  // ---- Postgres path ----
  // Position = signups ahead of you minus confirmed referrals you drove (min 1).
  const standing = async (id: number, code: string) => {
    const [{ count }] = (await sql!`SELECT COUNT(*)::int AS count FROM waitlist WHERE id <= ${id}`) as { count: number }[]
    const [{ refs }] = (await sql!`SELECT COUNT(*)::int AS refs FROM waitlist WHERE referred_by = ${code} AND confirmed = TRUE`) as { refs: number }[]
    return { position: Math.max(1, count - refs), referrals: refs }
  }
  if (sql) {
    const existing = (await sql`SELECT id, email, username, referral_code, confirmed FROM waitlist WHERE email = ${email}`) as DbRow[]
    if (existing.length > 0) {
      const row = existing[0]
      const { position, referrals } = await standing(row.id, row.referral_code)
      let emailed = false
      if (!row.confirmed) {
        emailed = await sendConfirmAndNotify(row.email, row.username, confirmUrlFor(row.email, row.username))
      }
      return NextResponse.json({ ok: true, emailed, already: true, position, referrals, referral_code: row.referral_code })
    }

    let referredBy: string | null = null
    if (refCode) {
      const ref = (await sql`SELECT email FROM waitlist WHERE referral_code = ${refCode}`) as { email: string }[]
      if (ref.length > 0 && ref[0].email !== email) referredBy = refCode
    }

    let row: DbRow | null = null
    for (let attempt = 0; attempt < 5 && !row; attempt++) {
      const code = genReferralCode()
      try {
        const inserted = (await sql`INSERT INTO waitlist (email, username, referral_code, referred_by) VALUES (${email}, ${username}, ${code}, ${referredBy}) RETURNING id, email, username, referral_code, confirmed`) as DbRow[]
        row = inserted[0]
      } catch {
        /* code collision — retry */
      }
    }
    if (!row) {
      return NextResponse.json({ ok: false, error: "Couldn't save that — try again." }, { status: 500 })
    }
    const { position, referrals } = await standing(row.id, row.referral_code)
    const emailed = await sendConfirmAndNotify(email, username, confirmUrlFor(email, username))
    return NextResponse.json({ ok: true, emailed, position, referrals, referral_code: row.referral_code })
  }

  // ---- File fallback (dev without DATABASE_URL) ----
  await storeFile({ event: "signup", email, username, created_at: new Date().toISOString() })
  const emailed = await sendConfirmAndNotify(email, username, confirmUrlFor(email, username))
  return NextResponse.json({ ok: true, emailed })
}
