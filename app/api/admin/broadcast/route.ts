import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { Resend } from "resend"
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/admin-auth"
import { clientIp, throttle } from "@/lib/rate-limit"
import { readSignups } from "@/lib/waitlist-store"

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function broadcastHtml(heading: string, body: string): string {
  const paras = esc(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#525252;">${p.replace(/\n/g, "<br />")}</p>`)
    .join("")
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:40px 20px;">
<div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;">
<div style="background:#1800ad;padding:26px 32px;text-align:center;">
<img src="https://useaero.org/brand/aero-lockup-white-clear.png" alt="Aero" width="120" style="display:inline-block;width:120px;height:auto;border:0;" />
</div>
<div style="padding:32px;">
<p style="margin:0 0 16px;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#171717;">${esc(heading)}</p>
${paras}
<div style="text-align:center;padding-top:12px;">
<a href="https://testnet.useaero.org" style="display:inline-block;background:#1800ad;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:9999px;">Open the testnet</a>
</div>
<p style="margin:24px 0 0;border-top:1px solid #f0f0f0;padding-top:20px;font-size:13px;line-height:1.6;color:#a3a3a3;">Aero · dollars on Avalanche · useaero.org</p>
</div>
</div>
<p style="margin:20px 0 0;text-align:center;font-size:12px;line-height:1.6;color:#a3a3a3;">You got this because you're on the Aero waitlist.<br />Done with these? Reply STOP and we'll remove you.</p>
</div></body></html>`
}

type Payload = { subject?: unknown; heading?: unknown; body?: unknown; test_email?: unknown; dry_run?: unknown }

export async function POST(req: Request) {
  const authed = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 })
  if (!throttle(`ab:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Slow down." }, { status: 429 })
  }

  let p: Payload
  try {
    p = (await req.json()) as Payload
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
  }
  const subject = typeof p.subject === "string" ? p.subject.trim() : ""
  const heading = typeof p.heading === "string" ? p.heading.trim() : ""
  const body = typeof p.body === "string" ? p.body.trim() : ""
  const testEmail = typeof p.test_email === "string" ? p.test_email.trim().toLowerCase() : ""

  if (subject.length < 3 || subject.length > 120) {
    return NextResponse.json({ ok: false, error: "Subject must be 3–120 characters." }, { status: 400 })
  }
  if (heading.length < 3 || heading.length > 80) {
    return NextResponse.json({ ok: false, error: "Heading must be 3–80 characters." }, { status: 400 })
  }
  if (body.length < 10 || body.length > 3000) {
    return NextResponse.json({ ok: false, error: "Body must be 10–3000 characters." }, { status: 400 })
  }

  const confirmed = (await readSignups()).filter((s) => s.confirmed).map((s) => s.email)
  if (p.dry_run) return NextResponse.json({ ok: true, count: confirmed.length })

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: "Email is not configured." }, { status: 503 })

  const recipients = testEmail ? [testEmail] : confirmed
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "No confirmed signups yet." }, { status: 400 })
  }

  const resend = new Resend(key)
  const from = process.env.WAITLIST_FROM ?? "Aero <hello@useaero.org>"
  const html = broadcastHtml(heading, body)
  let sent = 0
  for (let i = 0; i < recipients.length; i += 100) {
    try {
      const result = await resend.batch.send(
        recipients.slice(i, i + 100).map((to) => ({ from, to, subject, html }))
      )
      if (!result.error) sent += Math.min(100, recipients.length - i)
    } catch (err) {
      console.error("Broadcast batch failed:", err)
    }
  }
  return NextResponse.json({ ok: sent > 0, sent, total: recipients.length })
}
