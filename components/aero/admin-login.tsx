"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BrandIcon } from "./brand-logo"

export function AdminLogin() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Login failed.")
        setBusy(false)
        return
      }
      window.location.reload()
    } catch {
      setError("Network hiccup. Try again.")
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-5 py-24">
      <div className="text-center">
        <BrandIcon className="mx-auto size-12 rounded-2xl text-aero-800" />
        <h1 className="mt-6 text-3xl font-medium tracking-[-0.02em] text-neutral-900">Admin</h1>
        <p className="mt-2 text-[15px] text-neutral-500">This area is restricted.</p>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Admin password"
          autoComplete="current-password"
          className="h-12 rounded-2xl border-neutral-200 bg-white text-base text-neutral-900 placeholder:text-neutral-400"
        />
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-full bg-aero-800 text-[15px] font-medium text-white hover:bg-aero-900">
          {busy ? "Checking…" : "Unlock"}
        </Button>
        {error && <p role="alert" className="pt-1 text-center text-sm font-medium text-red-600">{error}</p>}
      </form>
    </div>
  )
}

export function AdminLogout() {
  return (
    <button
      type="button"
      onClick={() => fetch("/api/admin/logout", { method: "POST" }).finally(() => window.location.reload())}
      className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-700"
    >
      Log out
    </button>
  )
}
