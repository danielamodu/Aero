"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const DEFAULT_SUBJECT = "Aero testnet is live — come break it"
const DEFAULT_HEADING = "Testnet is live."
const DEFAULT_BODY = `You joined the waitlist for real dollars. Today you get play dollars.

testnet.useaero.org is live on Avalanche Fuji: claim 10,000 test USDC, grab a @username, and run the full loop — send, pay bills, earn mock yield.

Everything is worthless by design. Break things and tell us what snapped: reply to this email.`

const FROM_PRESETS = ["hello@useaero.org", "szr@useaero.org"]

export function AdminBroadcast({ confirmedCount }: { confirmedCount: number }) {
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [heading, setHeading] = useState(DEFAULT_HEADING)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [from, setFrom] = useState("hello@useaero.org")
  const [customFrom, setCustomFrom] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [audience, setAudience] = useState<"all" | "custom">("all")
  const [customList, setCustomList] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [busy, setBusy] = useState<"test" | "all" | null>(null)
  const [note, setNote] = useState("")

  const effectiveFrom = from === "custom" ? customList && customFrom.trim() : from
  void effectiveFrom

  const send = async (e: FormEvent, mode: "test" | "all") => {
    e.preventDefault()
    if (busy) return
    const fromAddr = from === "custom" ? customFrom.trim() : from
    if (!/^[a-z0-9._%+-]+@useaero\.org$/.test(fromAddr)) {
      setNote("Sender must be an @useaero.org address.")
      return
    }
    const to =
      mode === "all" && audience === "custom"
        ? customList.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
        : undefined
    if (mode === "all") {
      const who = audience === "custom" ? `${to?.length ?? 0} pasted addresses` : `all ${confirmedCount} confirmed signups`
      if (!window.confirm(`Send as ${fromAddr} to ${who}? This can't be undone. Send yourself a test first.`)) return
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
          from: fromAddr,
          ...(replyTo.trim() ? { reply_to: replyTo.trim() } : {}),
          ...(mode === "test" ? { test_email: testEmail.trim() } : {}),
          ...(mode === "all" && audience === "custom" ? { to } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setNote(mode === "test" ? `Test sent to ${testEmail.trim()} from ${fromAddr}.` : `Sent ${data.sent} of ${data.total} from ${fromAddr}.`)
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
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-neutral-500">From</p>
          <div className="flex flex-wrap gap-2">
            {FROM_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFrom(p)}
                className={cn(
                  "h-10 rounded-full border px-4 font-mono text-sm transition",
                  from === p
                    ? "border-aero-800 bg-aero-50/60 font-medium text-aero-900"
                    : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
                )}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFrom("custom")}
              className={cn(
                "h-10 rounded-full border px-4 font-mono text-sm transition",
                from === "custom"
                  ? "border-aero-800 bg-aero-50/60 font-medium text-aero-900"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
              )}
            >
              custom…
            </button>
          </div>
          {from === "custom" && (
            <Input
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              placeholder="you@useaero.org"
              aria-label="Custom sender"
              className="mt-2 h-11 max-w-xs rounded-2xl border-neutral-200 font-mono text-sm"
            />
          )}
        </div>

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-neutral-500">To</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAudience("all")}
              className={cn(
                "h-10 rounded-full border px-4 text-sm transition",
                audience === "all"
                  ? "border-aero-800 bg-aero-50/60 font-medium text-aero-900"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
              )}
            >
              All confirmed ({confirmedCount})
            </button>
            <button
              type="button"
              onClick={() => setAudience("custom")}
              className={cn(
                "h-10 rounded-full border px-4 text-sm transition",
                audience === "custom"
                  ? "border-aero-800 bg-aero-50/60 font-medium text-aero-900"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
              )}
            >
              Custom list…
            </button>
          </div>
          {audience === "custom" && (
            <textarea
              value={customList}
              onChange={(e) => setCustomList(e.target.value)}
              rows={3}
              placeholder={"a@email.com\nb@email.com (comma or newline separated)"}
              aria-label="Custom recipients"
              className="mt-2 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-mono text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          )}
        </div>

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
        <Input
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="Reply-to (optional, defaults to sender)"
          aria-label="Reply to"
          className="h-11 rounded-2xl border-neutral-200 font-mono text-sm"
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
            disabled={busy !== null || (audience === "all" && confirmedCount === 0)}
            className="h-11 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900"
          >
            {busy === "all" ? "Sending…" : "Send"}
          </Button>
        </div>
        {note && <p className="text-sm font-medium text-neutral-600">{note}</p>}
      </div>
    </div>
  )
}
