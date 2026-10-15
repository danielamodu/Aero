"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const DEFAULT_SUBJECT = "Aero testnet is live — come break it"
const DEFAULT_HEADING = "Testnet is live."
const DEFAULT_BODY = `You joined the waitlist for real dollars. Today you get play dollars.

testnet.useaero.org is live on Avalanche Fuji: claim 10,000 test USDC, grab a @username, and run the full loop — send, pay bills, earn mock yield.

Everything is worthless by design. Break things and tell us what snapped: reply to this email.`

export function AdminBroadcast({ confirmedCount }: { confirmedCount: number }) {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [heading, setHeading] = useState(DEFAULT_HEADING)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [testEmail, setTestEmail] = useState("")
  const [busy, setBusy] = useState<"test" | "all" | null>(null)
  const [note, setNote] = useState("")

  const send = async (e: FormEvent, mode: "test" | "all") => {
    e.preventDefault()
    if (busy) return
    if (mode === "all") {
      const ok = window.confirm(
        `Send to all ${confirmedCount} confirmed signups? This can't be undone. Send yourself a test first.`
      )
      if (!ok) return
    }
    if (mode === "test" && !testEmail.trim()) {
      setNote("Enter a test email first.")
      return
    }
    setBusy(mode)
    setNote("")
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          heading,
          body,
          ...(mode === "test" ? { test_email: testEmail.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setNote(mode === "test" ? `Test sent to ${testEmail.trim()}.` : `Sent to ${data.sent} of ${data.total}.`)
      } else {
        setNote(data.error ?? "Failed.")
      }
    } catch {
      setNote("Failed.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-6 rounded-[20px] border border-neutral-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-medium tracking-tight text-neutral-900">Broadcast</h2>
        <p className="font-mono text-xs text-neutral-400 tabular-nums">{confirmedCount} confirmed recipients</p>
      </div>
      <div className="mt-4 space-y-3">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject"
          className="h-11 rounded-2xl border-neutral-200 text-[15px] font-medium" />
        <Input value={heading} onChange={(e) => setHeading(e.target.value)} aria-label="Heading"
          className="h-11 rounded-2xl border-neutral-200 text-[15px]" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          aria-label="Body"
          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Test email first…"
            aria-label="Test email"
            type="email"
            className="h-11 flex-1 rounded-2xl border-neutral-200 text-[15px]"
          />
          <Button
            onClick={(e) => send(e, "test")}
            disabled={busy !== null}
            variant="outline"
            className="h-11 shrink-0 rounded-full border-neutral-300 px-6 font-medium"
          >
            {busy === "test" ? "Sending…" : "Send test"}
          </Button>
          <Button
            onClick={(e) => send(e, "all")}
            disabled={busy !== null || confirmedCount === 0}
            className="h-11 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900"
          >
            {busy === "all" ? "Sending…" : `Send to all (${confirmedCount})`}
          </Button>
        </div>
        {note && <p className="text-sm font-medium text-neutral-600">{note}</p>}
      </div>
    </div>
  )
}
