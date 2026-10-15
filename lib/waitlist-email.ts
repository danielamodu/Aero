import { Resend } from "resend"

export function confirmationHtml(username: string, confirmUrl: string): string {
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

export function confirmationText(username: string, confirmUrl: string): string {
  return `One tap to lock in @${username}.\n\nConfirm your email to reserve your handle:\n${confirmUrl}\n\nAfter confirming: invite email when your spot opens, then send, pay, and earn from one balance.\n\nAero · useaero.org\n\nDidn't sign up? Just ignore this email.`
}

/** Sends the double-opt-in confirmation. Returns true when Resend accepted it. */
export async function sendConfirmation(email: string, username: string, confirmUrl: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  try {
    const resend = new Resend(key)
    const from = process.env.WAITLIST_FROM ?? "Aero <hello@useaero.org>"
    const result = await resend.emails.send({
      from,
      to: email,
      subject: `Confirm your Aero spot (@${username})`,
      html: confirmationHtml(username, confirmUrl),
      text: confirmationText(username, confirmUrl),
    })
    if (result.error) {
      console.error("Resend error:", result.error)
      return false
    }
    return true
  } catch (err) {
    console.error("Resend failed:", err)
    return false
  }
}

/** Internal heads-up for the team. Non-fatal. */
export async function notifyTeam(subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const notify = process.env.WAITLIST_NOTIFY
  if (!key || !notify) return
  try {
    const resend = new Resend(key)
    const from = process.env.WAITLIST_FROM ?? "Aero <hello@useaero.org>"
    await resend.emails.send({ from, to: notify, subject, text })
  } catch (err) {
    console.error("Notify failed:", err)
  }
}
