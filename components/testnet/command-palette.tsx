"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAccount, useDisconnect, useWriteContract } from "wagmi"
import {
  Copy,
  Droplets,
  LayoutGrid,
  LogOut,
  Send,
  Sprout,
  SquareTerminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usdcAbi } from "@/lib/contracts"
import { CONTRACTS } from "@/lib/testnet"
import { pushNotice } from "@/lib/notifications"
import type { TestnetTab } from "@/app/testnet/page"

type Action = {
  id: string
  label: string
  hint: string
  icon: typeof Send
  run: () => void
}

export function CommandPalette({ go }: { go: (t: TestnetTab) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { writeContractAsync } = useWriteContract()

  useEffect(() => {
    const focus = () => setTimeout(() => inputRef.current?.focus(), 30)
    const reset = () => {
      setQ("")
      setCursor(0)
    }
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setQ("")
        setCursor(0)
        setOpen((o) => !o)
        focus()
      } else if (e.key === "/" && !typing) {
        e.preventDefault()
        setQ("")
        setCursor(0)
        setOpen(true)
        focus()
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    const onExternal = () => {
      reset()
      setOpen(true)
      focus()
    }
    window.addEventListener("aero:palette", onExternal)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("aero:palette", onExternal)
    }
  }, [])

  const copyAddr = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
    } catch {
      /* ignore */
    }
  }

  const actions: Action[] = useMemo(
    () => [
      {
        id: "home",
        label: "Go home",
        hint: "balance + activity",
        icon: LayoutGrid,
        run: () => go("home"),
      },
      {
        id: "pay",
        label: "Pay someone",
        hint: "send, request, bills",
        icon: Send,
        run: () => go("pay"),
      },
      {
        id: "earn",
        label: "Earn yield",
        hint: "vaults + router",
        icon: Sprout,
        run: () => go("earn"),
      },
      {
        id: "term",
        label: "Open terminal",
        hint: "type to transact",
        icon: SquareTerminal,
        run: () => go("terminal"),
      },
      {
        id: "faucet",
        label: "Claim test dollars",
        hint: "10,000 tUSDC",
        icon: Droplets,
        run: async () => {
          try {
            await writeContractAsync({
              address: CONTRACTS.usdc,
              abi: usdcAbi,
              functionName: "faucet",
            })
            pushNotice(
              "Faucet claimed",
              "+10,000 test dollars landed in your balance."
            )
          } catch {
            /* user rejected or cooling down */
          }
        },
      },
      {
        id: "copy",
        label: "Copy wallet address",
        hint: address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "",
        icon: Copy,
        run: copyAddr,
      },
      {
        id: "bye",
        label: "Disconnect wallet",
        hint: "",
        icon: LogOut,
        run: () => disconnect(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address]
  )

  const filtered = actions.filter((a) =>
    `${a.label} ${a.hint}`.toLowerCase().includes(q.trim().toLowerCase())
  )
  const clamped = Math.min(
    Math.max(cursor, 0),
    Math.max(filtered.length - 1, 0)
  )

  const runAt = (i: number) => {
    const a = filtered[i]
    if (!a) return
    setOpen(false)
    a.run()
  }

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-neutral-950/30 px-4 pt-[14vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_30px_80px_-20px_rgba(11,0,78,0.4)]"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, filtered.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === "Enter") {
              runAt(clamped)
            }
          }}
          placeholder="Type a command…"
          aria-label="Command palette"
          className="h-14 w-full border-b border-neutral-100 bg-transparent px-5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-neutral-400">
              Nothing matches “{q}”.
            </p>
          )}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onMouseEnter={() => setCursor(i)}
              onClick={() => runAt(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
                i === clamped ? "bg-aero-50/70" : "bg-transparent"
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  i === clamped
                    ? "bg-aero-800 text-white"
                    : "bg-neutral-100 text-neutral-500"
                )}
              >
                <a.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-neutral-900">
                  {a.label}
                </span>
                {a.hint && (
                  <span className="block truncate text-[13px] text-neutral-400">
                    {a.hint}
                  </span>
                )}
              </span>
              {i === clamped && (
                <span className="font-mono text-xs text-neutral-300">↵</span>
              )}
            </button>
          ))}
        </div>
        <p className="border-t border-neutral-100 px-5 py-2.5 font-mono text-[11px] text-neutral-300">
          ↑↓ navigate · ↵ run · esc close · ⌘K anywhere
        </p>
      </div>
    </div>
  )
}
