"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import { useDisconnect, useReadContract, useReadContracts } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  Copy,
  HandCoins,
  LayoutGrid,
  LogOut,
  ReceiptText,
  RefreshCw,
  Send,
  Sprout,
  SquareTerminal,
  Wallet,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AeroMark } from "@/components/aero/logo"
import { BrandLockup } from "@/components/aero/brand-logo"
import { AppKitConnectButton } from "@/components/testnet/providers"
import { FaucetMini } from "./views"
import {
  adapterAbi,
  namesAbi,
  routerAbi,
  usdcAbi,
  vaultAbi,
} from "@/lib/contracts"
import type { Address } from "viem"
import {
  CONTRACTS,
  FUJI_AVAX_FAUCET,
  formatUsdc,
  routerConfigured,
} from "@/lib/testnet"
import { readActivity } from "@/lib/testnet-activity"
import { buildContacts } from "@/lib/contacts"
import {
  addSeenHashes,
  markAllRead,
  pushNotice,
  readNotices,
  seenHashes,
  unreadCount,
  type Notice,
} from "@/lib/notifications"
import {
  fetchOnchainActivity,
  fetchRecentTransfers,
  fetchMemos,
  getLatestBlockNumber,
  hasOnchainSends,
  type ChainActivity,
  type RecentTransfer,
} from "@/lib/onchain-activity"
import type { TestnetTab } from "@/app/testnet/page"

/* ---------------------------------- login --------------------------------- */

export function LoginView() {
  const reduce = useReducedMotion()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const ax = useTransform(mx, [-0.5, 0.5], [-22, 22])
  const ay = useTransform(my, [-0.5, 0.5], [-14, 14])
  const [block, setBlock] = useState<bigint | null>(null)
  const [recent, setRecent] = useState<RecentTransfer[]>([])

  useEffect(() => {
    let live = true
    const tick = async () => {
      try {
        const [b, txs] = await Promise.all([
          getLatestBlockNumber(),
          fetchRecentTransfers(5),
        ])
        if (live) {
          setBlock(b)
          setRecent(txs)
        }
      } catch {
        /* offline — stay quiet */
      }
    }
    tick()
    const id = setInterval(tick, 12_000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [])

  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    if (reduce) return
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }

  return (
    <section
      onMouseMove={onMove}
      className="relative flex min-h-svh flex-col overflow-hidden bg-aero-800 text-white"
    >
      <motion.div
        aria-hidden
        style={reduce ? undefined : { x: ax, y: ay }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <AeroMark className="size-[135vmin] shrink-0 text-white/[0.07]" />
      </motion.div>

      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <BrandLockup tone="light" height={26} />
        <span className="font-mono text-[11px] font-bold tracking-[0.18em] text-white/50">
          FUJI · 43113
        </span>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center px-5 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl text-5xl leading-[1.0] font-medium tracking-[-0.025em] text-balance sm:text-7xl"
        >
          Play money, real rails.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-5 max-w-md text-lg leading-relaxed text-white/65"
        >
          Connect a wallet — 30 seconds, test dollars only.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8"
        >
          <AppKitConnectButton className="h-13 bg-white px-8 text-base text-aero-900 hover:bg-aero-50" />
        </motion.div>
        <motion.a
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          href={FUJI_AVAX_FAUCET}
          target="_blank"
          rel="noreferrer"
          className="mt-5 text-sm text-white/50 underline underline-offset-4 transition hover:text-white"
        >
          Need gas? Free Fuji AVAX
        </motion.a>
      </div>

      <footer className="relative border-t border-white/10 px-5 py-4 sm:px-8">
        <div className="flex items-center justify-between gap-4 font-mono text-[11px] text-white/45 tabular-nums">
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
            </span>
            {block
              ? `FUJI #${block.toString()} · ~2s finality`
              : "Connecting to Fuji…"}
          </span>
          <span className="hidden min-w-0 items-center gap-4 truncate md:flex">
            {recent.slice(0, 3).map((t) => (
              <span key={t.hash} className="truncate">
                {t.from.slice(0, 6)}…{t.from.slice(-4)} → {t.to.slice(0, 6)}…
                {t.to.slice(-4)} $
                {(Number(t.value) / 1e6).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
            ))}
          </span>
        </div>
      </footer>
    </section>
  )
}

/* --------------------------------- sidebar -------------------------------- */

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "send", label: "Send", icon: Send },
  { id: "request", label: "Request", icon: HandCoins },
  { id: "pay", label: "Pay", icon: ReceiptText },
  { id: "earn", label: "Earn", icon: Sprout },
  { id: "terminal", label: "Terminal", icon: SquareTerminal },
] as const

function shortAddress(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function Sidebar({
  tab,
  setTab,
  address,
}: {
  tab: TestnetTab
  setTab: (t: TestnetTab) => void
  address: Address
}) {
  const { disconnect } = useDisconnect()
  const [copiedAddr, setCopiedAddr] = useState(false)
  const { data: handle } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveUsername",
    args: [address],
  })
  const { data: sidebarUsdc } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [address],
  })
  return (
    <aside className="sticky top-0 hidden h-svh w-[260px] shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-5 lg:flex">
      <div className="flex items-center gap-2 px-2">
        <BrandLockup tone="dark" height={24} />
        <span className="ml-auto">
          <NotificationBell address={address} align="left" />
        </span>
      </div>
      <nav className="mt-8 space-y-1">
        {NAV.map((n) => {
          const active = tab === n.id
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={cn(
                "relative flex h-11 w-full items-center gap-3 rounded-2xl px-3.5 text-[15px] transition-colors",
                active
                  ? "font-semibold text-aero-900"
                  : "font-medium text-neutral-500 hover:text-neutral-900"
              )}
            >
              {active && (
                <motion.span
                  layoutId="side-active"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-2xl bg-aero-50"
                />
              )}
              <n.icon className="relative size-[18px]" />
              <span className="relative">{n.label}</span>
              {active && (
                <span className="relative ml-auto size-1.5 rounded-full bg-aero-800" />
              )}
            </button>
          )
        })}
      </nav>
      <div className="mt-auto space-y-3">
        <FaucetMini address={address} />
        <Checklist
          address={address}
          funded={(sidebarUsdc ?? BigInt(0)) > BigInt(0)}
          handle={handle ?? ""}
          compact
        />
        <a
          href="https://useaero.org/docs#testnet"
          className="flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
        >
          <ArrowUpRight className="size-[18px]" />
          Testnet guide
        </a>
        <div className="rounded-2xl bg-[#f7f7f7] p-3.5">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(address)
                setCopiedAddr(true)
                setTimeout(() => setCopiedAddr(false), 1500)
              } catch {
                /* clipboard unavailable */
              }
            }}
            title="Copy wallet address"
            className="block w-full text-left"
          >
            <p className="font-mono text-sm font-bold text-neutral-900">
              {handle ? `@${handle}` : shortAddress(address)}
            </p>
            <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-neutral-400">
              {handle ? shortAddress(address) : "No handle yet"} · Fuji ·{" "}
              {copiedAddr ? (
                <span className="font-bold text-emerald-600">Copied</span>
              ) : (
                <Copy className="size-3" />
              )}
            </p>
          </button>
          <button
            type="button"
            onClick={() => disconnect()}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 transition hover:text-neutral-700"
          >
            <LogOut className="size-3.5" /> Disconnect
          </button>
        </div>
      </div>
    </aside>
  )
}

export function MobileTop({ address }: { address: Address }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-5 backdrop-blur-xl lg:hidden">
      <span className="flex items-center gap-2">
        <BrandLockup tone="dark" height={24} />
      </span>
      <span className="flex items-center gap-2">
        <NotificationBell address={address} />
        <AppKitConnectButton />
      </span>
    </header>
  )
}

export function MobileTabs({
  tab,
  setTab,
}: {
  tab: TestnetTab
  setTab: (t: TestnetTab) => void
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-neutral-200 bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {NAV.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => setTab(n.id)}
          className={cn(
            "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
            tab === n.id ? "text-aero-800" : "text-neutral-400"
          )}
        >
          <n.icon className="size-5" />
          {n.label}
          <span className="flex h-1 items-center justify-center">
            {tab === n.id && (
              <motion.span
                layoutId="mtab-dot"
                className="size-1 rounded-full bg-aero-800"
              />
            )}
          </span>
        </button>
      ))}
    </nav>
  )
}

/* ------------------------------- checklist -------------------------------- */

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? "Yesterday" : `${d}d ago`
}

export function Checklist({
  address,
  funded,
  handle,
  compact = false,
}: {
  address: Address
  funded: boolean
  handle: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState<boolean>(() =>
    readActivity().some((a) => /→|sent|paid/i.test(`${a.label} ${a.amount}`))
  )
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("aero_check_done") === "1"
    } catch {
      return false
    }
  })
  useEffect(() => {
    let live = true
    hasOnchainSends(address, CONTRACTS.usdc, CONTRACTS.vault)
      .then((v) => {
        if (live && v) setSent(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [address])

  const steps = [
    { done: true, label: "Connect a Fuji wallet" },
    { done: funded, label: "Claim test dollars" },
    { done: handle !== "", label: "Claim your @handle" },
    { done: sent, label: "Send your first payment" },
  ]
  const doneCount = steps.filter((s) => s.done).length

  if (doneCount === steps.length) {
    if (dismissed) return null
    const hide = () => {
      try {
        window.localStorage.setItem("aero_check_done", "1")
      } catch {
        /* ignore */
      }
      setDismissed(true)
    }
    if (compact) {
      return (
        <div className="rounded-2xl bg-emerald-50 p-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800">
            <Check className="size-3.5" strokeWidth={3.5} /> Setup complete
          </p>
          <button
            type="button"
            onClick={hide}
            className="mt-1.5 text-xs font-medium text-emerald-700 hover:underline"
          >
            Hide
          </button>
        </div>
      )
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 rounded-[20px] bg-aero-800 p-5 text-white"
      >
        <div>
          <p className="font-medium">
            Testnet complete — you ran the whole loop.
          </p>
          <p className="mt-0.5 text-sm text-white/65">
            Connected, funded, named, and sending. Mainnet will feel familiar.
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          className="shrink-0 rounded-full border border-white/30 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
        >
          Hide
        </button>
      </motion.div>
    )
  }

  if (compact) {
    return (
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Setup progress"
          className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
        >
          <span className="shrink-0 text-xs font-semibold text-neutral-900">
            Setup
          </span>
          <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <motion.span
              className="block h-full rounded-full bg-aero-800"
              animate={{ width: `${(doneCount / steps.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </span>
          <span className="shrink-0 font-mono text-[11px] text-neutral-400 tabular-nums">
            {doneCount}/{steps.length}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-neutral-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {open && (
          <div className="space-y-2 px-3.5 pb-3.5">
            {steps.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2.5 text-[13px]"
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    s.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-neutral-300 text-transparent"
                  )}
                >
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
                <span
                  className={
                    s.done
                      ? "text-neutral-400 line-through"
                      : "font-medium text-neutral-800"
                  }
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-neutral-200/80 bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
          Getting started
        </p>
        <p className="font-mono text-xs text-neutral-400 tabular-nums">
          {doneCount}/{steps.length}
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <motion.div
          className="h-full rounded-full bg-aero-800"
          animate={{ width: `${(doneCount / steps.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
      <div className="mt-4 space-y-2.5">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-3 text-[15px]">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                s.done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-neutral-300 text-transparent"
              )}
            >
              <Check className="size-3" strokeWidth={3.5} />
            </span>
            <span
              className={
                s.done
                  ? "text-neutral-400 line-through"
                  : "font-medium text-neutral-900"
              }
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/* -------------------------------- portfolio ------------------------------- */

function mockBalance(seed: string, min: number, max: number): number {
  let h = 7
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return min + (h % Math.floor((max - min) * 100)) / 100
}

const L1_META = [
  { id: "beam", name: "Beam L1", dot: "bg-sky-500" },
  { id: "dfk", name: "DFK Chain", dot: "bg-emerald-500" },
] as const

export function Portfolio({
  address,
  fujiUsdc,
  goSend,
}: {
  address: Address
  fujiUsdc: bigint | undefined
  goSend: (amountUsdc: string) => void
}) {
  const chains = [
    {
      name: "C-Chain · Fuji",
      dot: "bg-aero-800",
      balance: fujiUsdc !== undefined ? Number(fujiUsdc) / 1e6 : null,
      live: true,
    },
    ...L1_META.map((l1) => ({
      name: l1.name,
      dot: l1.dot,
      balance: mockBalance(
        `${address}-${l1.id}`,
        l1.id === "beam" ? 20 : 5,
        l1.id === "beam" ? 400 : 150
      ),
      live: false,
    })),
  ]
  const total = chains.reduce((n, c) => n + (c.balance ?? 0), 0)

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
          Your Avalanche portfolio
        </p>
        <p className="font-mono text-xl font-medium tabular-nums">
          $
          {total.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>
      <div className="mt-2 divide-y divide-neutral-100">
        {chains.map((c) => (
          <div key={c.name} className="flex items-center gap-3 py-3.5">
            <span className={cn("size-2.5 shrink-0 rounded-full", c.dot)} />
            <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-neutral-900">
              {c.name}{" "}
              {!c.live && (
                <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 align-middle font-mono text-[10px] font-bold text-neutral-500">
                  SIMULATED
                </span>
              )}
            </p>
            <span className="shrink-0 font-mono tabular-nums">
              {c.balance === null ? (
                "—"
              ) : (
                <>
                  {`$${c.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}{" "}
                  <span className="text-xs text-neutral-400">
                    {total > 0 ? Math.round((c.balance / total) * 100) : 0}%
                  </span>
                </>
              )}
            </span>
            <button
              type="button"
              disabled={c.balance === null || c.balance <= 0}
              onClick={() => c.balance !== null && goSend(c.balance.toFixed(2))}
              className="shrink-0 rounded-full px-2 py-1 text-[13px] font-medium text-neutral-400 transition hover:text-aero-800 disabled:opacity-30"
            >
              Move →
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-neutral-400">
        Beam and DFK balances are simulated — those chains have no testnet.
        Moves settle on Fuji for now.
      </p>
    </div>
  )
}

/* ------------------------------ notifications ----------------------------- */

const WEEK = 7 * 24 * 60 * 60 * 1000

function yieldBaseline(): { ts: number; value: number } | null {
  try {
    const raw = window.localStorage.getItem("aero_yield_base")
    if (!raw) return null
    const b = JSON.parse(raw) as { ts: number; value: number }
    return typeof b.ts === "number" && typeof b.value === "number" ? b : null
  } catch {
    return null
  }
}

function saveYieldBaseline(ts: number, value: number): void {
  try {
    window.localStorage.setItem(
      "aero_yield_base",
      JSON.stringify({ ts, value })
    )
  } catch {
    /* ignore */
  }
}

export function NotificationBell({
  address,
  align = "right",
}: {
  address: Address
  align?: "left" | "right"
}) {
  const [open, setOpen] = useState(false)
  const [notices, setNotices] = useState<Notice[]>(() => readNotices())
  const [unread, setUnread] = useState<number>(() => unreadCount())
  const refresh = () => {
    setNotices(readNotices())
    setUnread(unreadCount())
  }

  const { data: positions } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.vault,
        abi: vaultAbi,
        functionName: "balanceOf",
        args: [address],
      },
      { address: CONTRACTS.vault, abi: vaultAbi, functionName: "index" },
      {
        address: CONTRACTS.adapter,
        abi: adapterAbi,
        functionName: "balanceOf",
        args: [address],
      },
      {
        address: CONTRACTS.adapter,
        abi: adapterAbi,
        functionName: "sharePrice",
      },
      {
        address: CONTRACTS.router,
        abi: routerAbi,
        functionName: "balanceOf",
        args: [address],
      },
      { address: CONTRACTS.router, abi: routerAbi, functionName: "sharePrice" },
    ],
    query: { enabled: routerConfigured },
  })

  useEffect(() => {
    let live = true
    const poll = async () => {
      try {
        const items = await fetchOnchainActivity(address, CONTRACTS)
        if (!live) return
        const seen = seenHashes()
        const fresh = items.filter(
          (i) =>
            (i.kind === "in" || i.kind === "faucet") &&
            !seen.has(i.hash.toLowerCase())
        )
        if (seen.size > 0) {
          for (const f of fresh.slice(0, 3)) {
            pushNotice(
              f.kind === "faucet"
                ? "Faucet claim confirmed"
                : `You received ${f.amount}`,
              f.kind === "faucet"
                ? "10,000 test dollars landed in your balance."
                : "A payment just settled. Nice."
            )
          }
        }
        addSeenHashes(items.map((i) => i.hash))

        // Weekly yield digest from position growth.
        if (positions) {
          const [vShares, vIndex, aShares, aPrice, rShares, rPrice] =
            positions.map((p) =>
              p.status === "success" ? (p.result as bigint) : BigInt(0)
            )
          const total =
            Number(vShares * vIndex + aShares * aPrice + rShares * rPrice) /
            1e24
          const base = yieldBaseline()
          const now = Date.now()
          if (!base) {
            saveYieldBaseline(now, total)
          } else if (now - base.ts > WEEK) {
            if (total > base.value + 0.01) {
              pushNotice(
                `Your yield earned $${(total - base.value).toFixed(2)} this week`,
                "Idle money, working nights. Keep it rolling."
              )
            }
            saveYieldBaseline(now, total)
          }
        }
        refresh()
      } catch {
        /* poll quietly */
      }
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => {
      live = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  const toggle = () => {
    if (!open) {
      setNotices(markAllRead())
      setUnread(0)
    }
    setOpen((o) => !o)
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unread > 0 ? `${unread} unread notifications` : "Notifications"
        }
        className="relative flex size-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-aero-800 px-1 font-mono text-[10px] font-bold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className={`absolute top-12 z-50 w-80 overflow-hidden rounded-[20px] border border-neutral-200 bg-white shadow-[0_20px_50px_-20px_rgba(11,0,78,0.3)] ${align === "left" ? "left-0" : "right-0"}`}
        >
          <p className="border-b border-neutral-100 px-5 py-3.5 text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
            Notifications
          </p>
          <div className="max-h-80 overflow-y-auto">
            {notices.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-neutral-400">
                Quiet for now. Incoming payments and yield updates land here.
              </p>
            ) : (
              notices.slice(0, 12).map((n) => (
                <div
                  key={n.id}
                  className="border-b border-neutral-100 px-5 py-3.5 last:border-0"
                >
                  <p className="text-sm font-medium text-neutral-900">
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">
                    {n.body}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-neutral-300">
                    {timeAgo(n.ts)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </span>
  )
}

/* -------------------------------- overview -------------------------------- */

function useTweenNumber(target: number): number {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    let raf = 0
    const from = prev.current
    const start = performance.now()
    const dur = 900
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (target - from) * eased
      setVal(v)
      prev.current = v
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return val
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

/* ------------------------------ balance chart ----------------------------- */

function BalanceChart({
  feed,
  current,
}: {
  feed: { hash: string; label: string; amount: string; ts: number }[]
  current: number
}) {
  const [now] = useState(() => Date.now())
  const { pts, flows } = useMemo(() => {
    const seen = new Set<string>()
    const deltas = feed
      .filter((a) => {
        const k = a.hash.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map((a) => {
        const num = parseFloat(a.amount.replace(/[^0-9.]/g, "")) || 0
        const plus = /^(Received|Faucet)/.test(a.label)
        const minus = /^(Sent|You)/.test(a.label)
        return {
          ts: a.ts > 0 ? a.ts : now,
          v: plus ? num : minus ? -num : 0,
        }
      })
      .filter((f) => f.v !== 0)
      .sort((x, y) => x.ts - y.ts)
    if (deltas.length === 0) {
      return {
        pts: [
          { t: now - 86400000, v: current },
          { t: now, v: current },
        ],
        flows: 0,
      }
    }
    let run = current
    const pts = [{ t: now, v: current }]
    for (let i = deltas.length - 1; i >= 0; i--) {
      run = Math.max(0, run - deltas[i].v)
      pts.push({ t: deltas[i].ts, v: run })
    }
    const ordered = pts.reverse()
    if (ordered.length === 1)
      ordered.unshift({ t: ordered[0].t - 86400000, v: ordered[0].v })
    return { pts: ordered, flows: deltas.length }
  }, [feed, current, now])

  const W = 600
  const H = 220
  const L = 46
  const R = 14
  const T = 12
  const B = 26
  const tVals = pts.map((p) => p.t)
  const vVals = pts.map((p) => p.v)
  const t0 = Math.min(...tVals)
  const t1 = Math.max(...tVals)
  const lo = Math.min(...vVals)
  const hi = Math.max(...vVals)
  const span = Math.max(t1 - t0, 3600000)
  const pad = Math.max((hi - lo) * 0.15, hi * 0.02, 1)
  const y0 = Math.max(0, lo - pad)
  const y1 = hi + pad
  const X = (t: number) => L + ((t - t0) / span) * (W - L - R)
  const Y = (v: number) =>
    T + (1 - (v - y0) / Math.max(y1 - y0, 1e-9)) * (H - T - B)
  const line = pts
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`
    )
    .join(" ")
  const area = `${line} L${X(t1).toFixed(1)},${H - B} L${X(t0).toFixed(1)},${H - B} Z`
  const grid = [0, 1, 2, 3].map((i) => y0 + ((y1 - y0) * i) / 3)
  const fmtD = (t: number) =>
    new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const last = pts[pts.length - 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label="Balance history"
      >
        <defs>
          <linearGradient id="aero-bal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-aero-800)"
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              stopColor="var(--color-aero-800)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        {grid.map((g, i) => (
          <g key={i}>
            <line
              x1={L}
              x2={W - R}
              y1={Y(g)}
              y2={Y(g)}
              stroke="#E4E4E7"
              strokeWidth="1"
            />
            <text
              x={L - 8}
              y={Y(g) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="#A3A3A3"
              fontFamily="monospace"
            >
              ${g >= 1000 ? `${(g / 1000).toFixed(1)}K` : g.toFixed(0)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#aero-bal-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-aero-800)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={X(last.t)}
          cy={Y(last.v)}
          r="4"
          fill="var(--color-aero-800)"
          stroke="#fff"
          strokeWidth="2"
        />
        <text x={L} y={H - 8} fontSize="10" fill="#A3A3A3">
          {fmtD(t0)}
        </text>
        <text x={W - R} y={H - 8} textAnchor="end" fontSize="10" fill="#A3A3A3">
          {fmtD(t1)}
        </text>
      </svg>
      {flows === 0 && (
        <p className="mt-1 text-xs text-neutral-400">
          History builds as you transact — claim, send, or deposit to draw the
          line.
        </p>
      )}
    </div>
  )
}

export function Overview({
  address,
  go,
}: {
  address: Address
  go: (t: TestnetTab) => void
}) {
  const [activity] = useState(readActivity)
  const [chain, setChain] = useState<ChainActivity[] | null>(null)
  const [memos, setMemos] = useState<Map<string, string>>(new Map())
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const queryClient = useQueryClient()
  const [nonce, setNonce] = useState(0)
  const [spinning, setSpinning] = useState(false)
  useEffect(() => {
    let live = true
    fetchOnchainActivity(address, CONTRACTS)
      .then((r) => {
        if (live) setChain(r)
      })
      .catch(() => {
        if (live) setChain([])
      })
    fetchMemos(address, CONTRACTS.pay)
      .then((m) => {
        if (live) setMemos(m)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [address, nonce])
  useEffect(() => {
    if (!chain) return
    let live = true
    // Counterparty @handles for the feed (nicety — falls back to addresses).
    buildContacts(chain)
      .then((cs) => {
        if (live)
          setNames(new Map(cs.map((c) => [c.address.toLowerCase(), c.label])))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [chain])
  const feed = useMemo(() => {
    const seen = new Set(activity.map((a) => a.hash.toLowerCase()))
    type Row = {
      label: string
      amount: string
      hash: string
      ts: number
      memo?: string
      dir: "in" | "out"
      peer: string | null
    }
    const merged: Row[] = activity.map((a) => ({
      label: a.label,
      amount: a.amount,
      hash: a.hash,
      ts: a.ts,
      memo: a.memo ?? memos.get(a.hash.toLowerCase()),
      dir: a.amount.trim().startsWith("+") ? "in" : "out",
      peer: a.to ?? null,
    }))
    for (const c of chain ?? []) {
      if (!seen.has(c.hash.toLowerCase())) {
        merged.push({
          label: c.label,
          amount: c.amount,
          hash: c.hash,
          ts: c.ts,
          memo: memos.get(c.hash.toLowerCase()),
          dir: c.kind === "in" || c.kind === "faucet" ? "in" : "out",
          peer: c.counterparty,
        })
      }
    }
    return merged.sort((a, b) => b.ts - a.ts)
  }, [activity, chain, memos])
  const { data: myName } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveUsername",
    args: [address],
  })
  const { data: usdc } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: shares } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: index } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "index",
  })
  const { data: rate } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "ratePerSecond",
  })

  const earning = shares && index ? (shares * index) / BigInt(1e18) : BigInt(0)
  const total = (usdc ?? BigInt(0)) + earning
  const apr =
    rate !== undefined
      ? (((Number(rate) * 31_557_600) / 1e18) * 100).toFixed(2)
      : "—"
  const animatedTotal = useTweenNumber(Number(total) / 1e6)

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
          Overview
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em] text-neutral-900 sm:text-4xl">
          {greeting()}
          {myName ? `, @${myName}` : ""}.
        </h1>
      </motion.div>

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            icon: Wallet,
            label: "Total balance",
            value: `$${animatedTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sub: "tUSDC · Fuji",
          },
          {
            icon: HandCoins,
            label: "Available",
            value: `$${formatUsdc(usdc)}`,
            sub: "Ready to send",
          },
          {
            icon: Sprout,
            label: "Earning",
            value: `$${formatUsdc(earning === BigInt(0) && !shares ? undefined : earning)}`,
            sub: `${apr}% APR`,
          },
          {
            icon: Zap,
            label: "Transactions",
            value: `${feed.length}`,
            sub: "Confirmed on-chain",
          },
        ].map((s) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="rounded-2xl border border-neutral-200/80 bg-white p-5"
          >
            <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
              <s.icon className="size-3.5 text-neutral-400" /> {s.label}
            </p>
            <p className="mt-2 text-[26px] font-semibold tracking-tight text-neutral-900 tabular-nums">
              {s.value}
            </p>
            <p className="mt-1 text-xs text-neutral-400">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="mt-4 rounded-2xl border border-neutral-200/80 bg-white p-5 sm:p-6"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
            Balance
          </p>
          <p className="font-mono text-xs text-neutral-400">
            All history · Fuji
          </p>
        </div>
        <BalanceChart feed={feed} current={Number(total) / 1e6} />
      </motion.div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.8fr_1fr]">
        <div className="rounded-2xl border border-neutral-200/80 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
              Recent activity
            </p>
            <span className="flex items-center gap-2">
              {feed.length > 0 && (
                <span className="font-mono text-xs text-neutral-400 tabular-nums">
                  {feed.length}
                </span>
              )}
              <button
                type="button"
                aria-label="Refresh activity"
                onClick={() => {
                  setSpinning(true)
                  queryClient
                    .invalidateQueries()
                    .finally(() => setSpinning(false))
                  setNonce((n) => n + 1)
                }}
                className="flex size-7 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              >
                <RefreshCw
                  className={cn("size-3.5", spinning && "animate-spin")}
                />
              </button>
            </span>
          </div>
          {chain === null ? (
            <div className="mt-3 space-y-2.5" aria-label="Loading activity">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-xl bg-neutral-100"
                />
              ))}
            </div>
          ) : feed.length === 0 ? (
            <div className="mt-3">
              <p className="text-[15px] leading-relaxed text-neutral-500">
                Nothing yet — send your first payment and it&apos;ll show up
                here with its receipt.
              </p>
              <button
                type="button"
                onClick={() => go("send")}
                className="pressable pressable mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-aero-800 px-6 text-[15px] font-medium text-white transition hover:bg-aero-900"
              >
                <Send className="size-4" /> Send your first payment
              </button>
            </div>
          ) : (
            <div className="mt-2 divide-y divide-neutral-100">
              {feed.slice(0, 10).map((a) => {
                const peerLabel = a.peer
                  ? (names.get(a.peer.toLowerCase()) ??
                    `${a.peer.slice(0, 6)}…${a.peer.slice(-4)}`)
                  : null
                const Incoming = a.dir === "in"
                return (
                  <div
                    key={a.hash}
                    className="flex items-center gap-3 py-2.5 text-sm"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        Incoming
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-neutral-100 text-neutral-500"
                      )}
                    >
                      {Incoming ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate font-medium text-neutral-900">
                        {Incoming ? "Received" : "Sent"}
                        {peerLabel ? (
                          <span className="font-normal text-neutral-500">
                            {" "}
                            · {peerLabel}
                          </span>
                        ) : null}{" "}
                        <span className="tabular-nums">{a.amount}</span>
                      </span>
                      <span className="block truncate text-[13px] text-neutral-400">
                        {a.ts > 0 ? `${timeAgo(a.ts)} · ` : ""}Confirmed
                        {a.memo ? ` · “${a.memo}”` : ""}
                      </span>
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 sm:inline">
                      Confirmed
                    </span>
                    <a
                      href={`https://testnet.snowtrace.io/tx/${a.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-medium text-aero-800 hover:underline"
                    >
                      Receipt
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="space-y-5">
          <Portfolio
            address={address}
            fujiUsdc={usdc}
            goSend={(amt) => {
              try {
                window.localStorage.setItem(
                  "aero_send_prefill",
                  JSON.stringify({ amount: amt })
                )
              } catch {
                /* ignore */
              }
              go("send")
            }}
          />
        </div>
      </div>
      <div className="mt-5 space-y-5 lg:hidden">
        <FaucetMini address={address} />
        <Checklist
          address={address}
          funded={(usdc ?? BigInt(0)) > BigInt(0)}
          handle={myName ?? ""}
        />
      </div>
    </div>
  )
}
