"use client"

import { useState } from "react"

export function AdminRowActions({ email }: { email: string }) {
  const [busy, setBusy] = useState<"resend" | "remove" | null>(null)
  const [note, setNote] = useState("")

  const resend = async () => {
    setBusy("resend")
    setNote("")
    try {
      const res = await fetch("/api/admin/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setNote(res.ok && data.ok ? "Sent" : (data.error ?? "Failed"))
    } catch {
      setNote("Failed")
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remove ${email} from the waitlist? This can't be undone.`)) return
    setBusy("remove")
    setNote("")
    try {
      const res = await fetch("/api/admin/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        window.location.reload()
        return
      }
      setNote("Failed")
    } catch {
      setNote("Failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={resend}
        disabled={busy !== null}
        className="text-[13px] font-medium text-aero-800 underline underline-offset-4 hover:text-aero-900 disabled:opacity-50"
      >
        {busy === "resend" ? "Sending…" : "Resend email"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="text-[13px] font-medium text-neutral-400 underline underline-offset-4 hover:text-red-600 disabled:opacity-50"
      >
        {busy === "remove" ? "Removing…" : "Remove"}
      </button>
      {note && <span className="text-xs text-neutral-400">{note}</span>}
    </span>
  )
}
