import { NextResponse } from "next/server"
import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { Resend } from "resend"
import { clientIp, throttle } from "@/lib/rate-limit"
import { confirmToken } from "@/lib/waitlist"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const u = raw.trim().replace(/^@+/, "").toLowerCase()
  return /^[a-z0-9_]{3,20}$/.test(u) ? u : null
}

function confirmationHtml(username: string, confirmUrl: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">One tap to lock in your @${username} username.</div>
<div style="max-width:520px;margin:0 auto;padding:40px 20px;">
<div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;">
<div style="background:#1800ad;padding:30px 32px;text-align:center;">
<img src="https://useaero.org/brand/aero-lockup-white-clear.png" alt="Aero" width="140" style="display:inline-block;width:140px;height:auto;border:0;" />
</div>
<div style="padding:32px;">
<p style="margin:0 0 8px;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#171717;">One tap to lock it in.</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#525252;">Confirm your email to reserve your handle and get first access when invites open.</p>
<div style="background:#f7f7f7;border:1px dashed #d4d4d4;border-radius:14px;padding:20px;text-align:center;margin:0 0 24px;">
<p style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.01em;color:#1800ad;">@${username}</p>
<p style="margin:6px 0 0;font-size:11px;font-weight:700;letter-spacing:0.16em;color:#737373;">USERNAME RESERVED · PENDING CONFIRMATION</p>
</div>
<div style="text-align:center;padding-bottom:8px;">
<a href="${confirmUrl}" style="display:inline-block;background:#1800ad;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:9999px;">Confirm my spot</a>
</div>
<p style="margin:16px 0 0;text-align:center;font-size:13px;color:#737373;">Button not working? Paste this link:<br /><a href="${confirmUrl}" style="color:#1800ad;word-break:break-all;">${confirmUrl}</a></p>
<p style="margin:24px 0 0;border-top:1px solid #f0f0f0;padding-top:20px;font-size:13px;line-height:1.6;color:#a3a3a3;">After confirming: invite email when your spot opens, then send, pay, and earn from one balance.<br /><br />Aero · dollars on Avalanche · useaero.org</p>
</div>
</div>
<p style="margin:20px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#a3a3a3;">You got this because you joined the Aero waitlist.<br />Didn't sign up? Just ignore this email.</p>
</div></body></html>`
}

function confirmationText(username: string, confirmUrl: string): string {
  return `One tap to lock in @${username}.\n\nConfirm your email to reserve your handle:\n${confirmUrl}\n\nAfter confirming: invite email when your spot opens, then send, pay, and earn from one balance.\n\nAero · useaero.org\n\nDidn't sign up? Just ignore this email.`
}

/** Best-effort local record (durable in dev; ephemeral on serverless — the emails are the source of truth there). */
async function store(entry: Record<string, string>) {
  try {
    const dir = process.env.WAITLIST_DIR ?? join(process.cwd(), "data")
    await mkdir(dir, { recursive: true })
    await appendFile(join(dir, "waitlist.jsonl"), JSON.stringify(entry) + "\n")
  } catch {
    /* non-fatal */
  }
}

export async function POST(req: Request) {
  if (!throttle(`wl:${clientIp(req)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "Slow down — too many signups from here. Try again in a few minutes." },
      { status: 429 }
    )
  }

  let body: { email?: unknown; username?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const username = cleanUsername(body.username)

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 })
  }
  if (!username) {
    return NextResponse.json(
      { ok: false, error: "Usernames are 3–20 characters: letters, numbers, underscores." },
      { status: 400 }
    )
  }

  await store({ event: "signup", email, username, created_at: new Date().toISOString() })

  const token = confirmToken(email, username)
  const origin = new URL(req.url).origin
  const confirmUrl = `${origin}/api/waitlist/confirm?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&token=${token}`

  let emailed = false
  const key = process.env.RESEND_API_KEY
  if (key) {
    try {
      const resend = new Resend(key)
      const from = process.env.WAITLIST_FROM ?? "Aero <hello@useaero.org>"
      const notify = process.env.WAITLIST_NOTIFY
      const jobs = [
        resend.emails.send({
          from,
          to: email,
          subject: `Confirm your Aero spot (@${username})`,
          html: confirmationHtml(username, confirmUrl),
          text: confirmationText(username, confirmUrl),
        }),
      ]
      if (notify) {
        jobs.push(
          resend.emails.send({
            from,
            to: notify,
            subject: `Waitlist signup: @${username}`,
            text: `@${username} <${email}> joined the waitlist (unconfirmed).`,
          })
        )
      }
      const [confirm] = await Promise.allSettled(jobs)
      emailed = confirm.status === "fulfilled" && !confirm.value.error
      if (!emailed && confirm.status === "fulfilled") {
        console.error("Resend error:", confirm.value.error)
      }
    } catch (err) {
      console.error("Resend failed:", err)
    }
  }

  return NextResponse.json({ ok: true, emailed })
}
