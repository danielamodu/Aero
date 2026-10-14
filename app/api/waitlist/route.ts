import { NextResponse } from "next/server"
import { appendFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { Resend } from "resend"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const u = raw.trim().replace(/^@+/, "").toLowerCase()
  return /^[a-z0-9_]{3,20}$/.test(u) ? u : null
}

function confirmationHtml(username: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your @${username} username is reserved — invite coming.</div>
<div style="max-width:520px;margin:0 auto;padding:40px 20px;">
<div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;">
<div style="background:#1800ad;padding:30px 32px;text-align:center;">
<img src="https://useaero.org/brand/aero-lockup-white-clear.png" alt="Aero" width="140" style="display:inline-block;width:140px;height:auto;border:0;" />
</div>
<div style="padding:32px;">
<p style="margin:0 0 8px;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#171717;">You're on the list.</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#525252;">We'll email you the moment your invite is ready — early signups get first pick of handles.</p>
<div style="background:#f7f7f7;border:1px dashed #d4d4d4;border-radius:14px;padding:20px;text-align:center;margin:0 0 24px;">
<p style="margin:0;font-size:28px;font-weight:700;letter-spacing:-0.01em;color:#1800ad;">@${username}</p>
<p style="margin:6px 0 0;font-size:11px;font-weight:700;letter-spacing:0.16em;color:#737373;">USERNAME RESERVED</p>
</div>
<p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.12em;color:#a3a3a3;">WHAT HAPPENS NEXT</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
<tr><td style="padding:10px 0;border-top:1px solid #f0f0f0;font-size:15px;color:#404040;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:9999px;background:#f3f2fb;color:#1800ad;font-size:13px;font-weight:700;margin-right:10px;">1</span>Invite email when your spot opens</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid #f0f0f0;font-size:15px;color:#404040;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:9999px;background:#f3f2fb;color:#1800ad;font-size:13px;font-weight:700;margin-right:10px;">2</span>Claim @${username} in the app</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid #f0f0f0;border-bottom:1px solid #f0f0f0;font-size:15px;color:#404040;"><span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:9999px;background:#f3f2fb;color:#1800ad;font-size:13px;font-weight:700;margin-right:10px;">3</span>Send, pay, and earn from one balance</td></tr>
</table>
<div style="text-align:center;padding-top:28px;">
<a href="https://useaero.org" style="display:inline-block;background:#1800ad;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:9999px;">Visit Aero</a>
</div>
</div>
</div>
<p style="margin:20px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#a3a3a3;">You got this because you joined the Aero waitlist.<br />Aero · dollars on Avalanche · useaero.org</p>
</div></body></html>`
}

function confirmationText(username: string): string {
  return `You're on the Aero waitlist, @${username}.\n\nYour username is reserved. We'll email you the moment your invite is ready.\n\nWhat happens next:\n- Invite email when your spot opens\n- Claim @${username} in the app\n- Send, pay, and earn from one balance\n\nAero · useaero.org`
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

  await store({ email, username, created_at: new Date().toISOString() })

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
          subject: `You're on the Aero waitlist (@${username})`,
          html: confirmationHtml(username),
          text: confirmationText(username),
        }),
      ]
      if (notify) {
        jobs.push(
          resend.emails.send({
            from,
            to: notify,
            subject: `Waitlist signup: @${username}`,
            text: `@${username} <${email}> joined the waitlist.`,
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
