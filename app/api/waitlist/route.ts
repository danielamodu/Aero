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
  return `<!doctype html><html><body style="margin:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">
<div style="background:#1800ad;border-radius:20px 20px 0 0;padding:28px;text-align:center;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">AERO</div>
<div style="background:#fff;border:1px solid #e5e5e5;border-top:0;border-radius:0 0 20px 20px;padding:32px;">
<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#171717;">You're on the list, @${username}.</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#525252;">Your username is reserved. We'll email you the moment your invite is ready — early signups get first pick of handles.</p>
<p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:0.08em;color:#737373;">WHAT HAPPENS NEXT</p>
<ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.7;color:#404040;">
<li>Invite email when your spot opens</li>
<li>Claim @${username} in the app</li>
<li>Send, pay, and earn from one balance</li>
</ul>
<p style="margin:24px 0 0;font-size:13px;color:#a3a3a3;">Aero · dollars on Avalanche · <a href="https://useaero.org" style="color:#1800ad;">useaero.org</a></p>
</div></div></body></html>`
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
