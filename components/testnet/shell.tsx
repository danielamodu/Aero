"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { useDisconnect, useReadContract } from "wagmi"
import {
  ArrowUpRight,
  LayoutGrid,
  LogOut,
  ReceiptText,
  Send,
  Sprout,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AeroMark } from "@/components/aero/logo"
import { BrandLockup, BrandWordmark } from "@/components/aero/brand-logo"
import { AppKitConnectButton } from "@/components/testnet/providers"
import { namesAbi, usdcAbi, vaultAbi } from "@/lib/contracts"
import type { Address } from "viem"
import { CONTRACTS, FUJI_AVAX_FAUCET, formatUsdc } from "@/lib/testnet"
import { readActivity, type ActivityItem } from "@/lib/testnet-activity"
import type { TestnetTab } from "@/app/testnet/page"

/* ---------------------------------- login --------------------------------- */

const LOGIN_STEPS = [
  { n: "01", title: "Connect a Fuji wallet", body: "Any wallet works — Core, MetaMask, Rabby. We never see your keys." },
  { n: "02", title: "Claim test dollars", body: "10,000 tUSDC from the in-app faucet. Worthless by design, priceless for practice." },
  { n: "03", title: "Send to @usernames", body: "Claim a handle on-chain, then move money in under a second." },
]

export function LoginView() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative flex flex-col justify-between overflow-hidden bg-aero-800 px-8 py-10 text-white sm:px-12">
        <AeroMark aria-hidden className="pointer-events-none absolute -right-20 -bottom-24 size-[380px] text-white/[0.07]" />
        <div className="relative flex items-center gap-2.5">
          <BrandWordmark tone="light" height={30} />
          <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider">
            TESTNET
          </span>
        </div>
        <div className="relative py-14">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-md text-5xl leading-[1.02] font-medium tracking-[-0.025em] text-balance sm:text-6xl"
          >
            Play money, real rails.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 max-w-md text-lg leading-relaxed text-white/70"
          >
            The full Aero experience on Avalanche Fuji — send, pay, and earn with test
            dollars before a single real cent moves.
          </motion.p>
          <div className="mt-10 space-y-6">
            {LOGIN_STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.12 }}
                className="flex gap-4"
              >
                <span className="font-mono text-sm font-bold text-white/40 tabular-nums">{s.n}</span>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="mt-0.5 max-w-sm text-[15px] leading-relaxed text-white/60">{s.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="relative font-mono text-xs text-white/40">
          FUJI · CHAIN 43113 · CONTRACTS UNVERIFIED EXPERIMENTS
        </p>
      </div>

      <div className="flex items-center justify-center bg-white px-5 py-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          className="w-full max-w-sm text-center"
        >
          <BrandLockup tone="dark" height={32} />
          <h2 className="mt-8 text-3xl font-medium tracking-[-0.02em] text-neutral-900">
            Get started
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-neutral-500">
            Connect a wallet on Avalanche Fuji. Returning users land straight in the dashboard.
          </p>
          <div className="mt-7 flex justify-center">
            <AppKitConnectButton />
          </div>
          <div className="mt-7 rounded-2xl bg-[#f7f7f7] p-5 text-left">
            <p className="text-[13px] font-semibold tracking-[0.12em] text-neutral-400 uppercase">
              You&apos;ll need
            </p>
            <ul className="mt-2.5 space-y-1.5 text-sm leading-relaxed text-neutral-600">
              <li>· A wallet (Core, MetaMask, Rabby…)</li>
              <li>
                · A little Fuji AVAX for gas —{" "}
                <a href={FUJI_AVAX_FAUCET} target="_blank" rel="noreferrer" className="font-medium text-aero-800 hover:underline">
                  free from the faucet <ArrowUpRight className="inline size-3.5" />
                </a>
              </li>
              <li>· About 30 seconds</li>
            </ul>
          </div>
          <p className="mt-6 text-[13px] text-neutral-400">
            Test dollars only ·{" "}
            <a href="https://useaero.org/docs" className="underline underline-offset-4 hover:text-neutral-600">
              Read the docs
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

/* --------------------------------- sidebar -------------------------------- */

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "send", label: "Send", icon: Send },
  { id: "pay", label: "Pay", icon: ReceiptText },
  { id: "earn", label: "Earn", icon: Sprout },
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
  const { data: handle } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveUsername",
    args: [address],
  })
  return (
    <aside className="sticky top-0 hidden h-svh w-[260px] shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-5 lg:flex">
      <div className="flex items-center gap-2 px-2">
        <BrandLockup tone="dark" height={24} />
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-800">
          TESTNET
        </span>
      </div>
      <nav className="mt-8 space-y-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setTab(n.id)}
            className={cn(
              "flex h-11 w-full items-center gap-3 rounded-2xl px-3.5 text-[15px] transition",
              tab === n.id
                ? "bg-neutral-100 font-semibold text-neutral-900"
                : "font-medium text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            )}
          >
            <n.icon className="size-[18px]" />
            {n.label}
            {tab === n.id && <span className="ml-auto size-1.5 rounded-full bg-aero-800" />}
          </button>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <a
          href="https://useaero.org/docs#testnet"
          className="flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] font-medium text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
        >
          <ArrowUpRight className="size-[18px]" />
          Testnet guide
        </a>
        <div className="rounded-2xl bg-[#f7f7f7] p-3.5">
          <p className="font-mono text-sm font-bold text-neutral-900">
            {handle ? `@${handle}` : shortAddress(address)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
            {handle ? shortAddress(address) : "No handle yet"} · Fuji
          </p>
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

export function MobileTop() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-5 backdrop-blur-xl lg:hidden">
      <span className="flex items-center gap-2">
        <BrandLockup tone="dark" height={24} />
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-800">
          TESTNET
        </span>
      </span>
      <AppKitConnectButton />
    </header>
  )
}

export function MobileTabs({ tab, setTab }: { tab: TestnetTab; setTab: (t: TestnetTab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-neutral-200 bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      {NAV.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => setTab(n.id)}
          className={cn(
            "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
            tab === n.id ? "text-aero-800" : "text-neutral-400"
          )}
        >
          <n.icon className="size-5" />
          {n.label}
        </button>
      ))}
    </nav>
  )
}

/* -------------------------------- overview -------------------------------- */

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function Overview({
  address,
  go,
}: {
  address: Address
  go: (t: TestnetTab) => void
}) {
  const [activity] = useState(readActivity)
  const { data: myName } = useReadContract({ address: CONTRACTS.names, abi: namesAbi, functionName: "resolveUsername", args: [address] })
  const { data: usdc } = useReadContract({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "balanceOf", args: [address] })
  const { data: shares } = useReadContract({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "balanceOf", args: [address] })
  const { data: index } = useReadContract({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "index" })
  const { data: rate } = useReadContract({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "ratePerSecond" })

  const earning = shares && index ? (shares * index) / BigInt(1e18) : BigInt(0)
  const total = (usdc ?? BigInt(0)) + earning
  const apr = rate !== undefined ? (((Number(rate) * 31_557_600) / 1e18) * 100).toFixed(2) : "—"

  return (
    <div className="mx-auto w-full max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Overview</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.02em] text-neutral-900 sm:text-4xl">
          {greeting()}{myName ? `, @${myName}` : ""}.
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="mt-6 rounded-[20px] border border-neutral-200 bg-white p-6 sm:p-8"
      >
        <p className="text-[13px] font-medium text-neutral-500">Total balance</p>
        <p className="mt-1 text-5xl font-medium tracking-tight tabular-nums sm:text-6xl">
          ${(Number(total) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-5 text-[15px] tabular-nums">
          <div>
            <p className="text-[13px] text-neutral-500">Available</p>
            <p className="mt-0.5 font-medium">${formatUsdc(usdc)}</p>
          </div>
          <div>
            <p className="text-[13px] text-neutral-500">
              Earning · <span className="font-medium text-emerald-600">{apr}% APR</span>
            </p>
            <p className="mt-0.5 font-medium">${formatUsdc(earning === BigInt(0) && !shares ? undefined : earning)}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          {(
            [
              ["Send", "send"],
              ["Pay", "pay"],
              ["Earn", "earn"],
            ] as const
          ).map(([label, id]) => (
            <Button
              key={id}
              onClick={() => go(id)}
              className="h-11 rounded-full bg-aero-800 font-medium text-white hover:bg-aero-900"
            >
              {label}
            </Button>
          ))}
        </div>
      </motion.div>

      <div className="mt-5 rounded-[20px] border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Recent activity</p>
          {activity.length > 0 && (
            <span className="font-mono text-xs text-neutral-400 tabular-nums">{activity.length}</span>
          )}
        </div>
        {activity.length === 0 ? (
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-500">
            Nothing yet — send your first payment and it&apos;ll show up here with its receipt.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-neutral-100">
            {activity.slice(0, 6).map((a) => (
              <div key={a.hash} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate font-medium text-neutral-700">
                  {a.label} · <span className="tabular-nums">{a.amount}</span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
