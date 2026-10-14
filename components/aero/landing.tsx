"use client"

import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react"
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Check,
  ReceiptText,
  Send,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sprout,
  Wallet,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { AeroMark } from "./logo"
import { BrandIcon, BrandLockup } from "./brand-logo"

/* ---------------------------------- utils --------------------------------- */

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
} as const

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(target * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])
  return value
}

/* ----------------------------------- nav ---------------------------------- */

function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-aero-100 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" className="text-aero-800" aria-label="Aero home">
          <BrandLockup tone="dark" height={32} />
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-neutral-600 md:flex">
          <a href="#send" className="transition hover:text-aero-800">
            Send
          </a>
          <a href="#pay" className="transition hover:text-aero-800">
            Pay
          </a>
          <a href="#earn" className="transition hover:text-aero-800">
            Earn
          </a>
          <a href="#network" className="transition hover:text-aero-800">
            Network
          </a>
        </nav>
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            className="hidden text-aero-800 hover:bg-aero-50 sm:inline-flex"
          >
            Log in
          </Button>
          <Button className="bg-aero-800 font-semibold text-white hover:bg-aero-900">
            Get early access
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}

/* ----------------------------------- hero --------------------------------- */

const HERO_FEED = [
  { from: "@you", to: "@maya", amount: "$45.00", time: "0.8s" },
  { from: "@leo", to: "@you", amount: "$120.00", time: "0.6s" },
  { from: "@you", to: "@sam", amount: "$12.50", time: "0.9s" },
]

function HeroPhone() {
  const [balance, setBalance] = useState(2480.16)
  useEffect(() => {
    const id = setInterval(
      () => setBalance((b) => b + 0.02 + Math.random() * 0.03),
      2000
    )
    return () => clearInterval(id)
  }, [])
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* balance card */}
      <motion.div
        initial={{ opacity: 0, y: 32, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.7, delay: 0.35 }}
        className="animate-aero-float relative z-10 rounded-3xl bg-aero-800 p-6 text-white shadow-2xl shadow-aero-800/40"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandIcon className="size-7 rounded-md text-white" />
            <span className="text-sm font-semibold tracking-wide">
              @you · USDC
            </span>
          </div>
          <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/15">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
            </span>
            Earning 5.24%
          </Badge>
        </div>
        <p className="mt-6 text-xs font-medium tracking-widest text-white/60 uppercase">
          Balance
        </p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight tabular-nums">
          ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="mt-2 text-sm text-emerald-300">
          +$3.41 earned this week · automatic
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button className="bg-white font-semibold text-aero-800 hover:bg-aero-50">
            <Send className="size-4" /> Send
          </Button>
          <Button
            variant="outline"
            className="border-white/25 bg-transparent font-semibold text-white hover:bg-white/10 hover:text-white"
          >
            <Wallet className="size-4" /> Pay bill
          </Button>
        </div>
      </motion.div>

      {/* send confirmation */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="absolute -right-3 -bottom-10 z-20 w-60 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-900/10 sm:-right-8"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <div>
            <p className="text-sm font-bold">Sent to @maya</p>
            <p className="text-xs text-neutral-500">$45.00 · settled in 0.8s</p>
          </div>
        </div>
      </motion.div>

      {/* yield toast */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.8 }}
        className="absolute -top-8 -left-3 z-20 w-56 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl shadow-neutral-900/10 sm:-left-8"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-aero-50 text-aero-800">
            <Sprout className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold">Yield routed</p>
            <p className="text-xs text-neutral-500">Benqi → Trader Joe · best rate</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-white pt-32 pb-20">
      {/* backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-aero-100 blur-3xl" />
        <div className="absolute top-40 -left-32 h-96 w-96 rounded-full bg-aero-50 blur-3xl" />
        <div className="absolute top-64 -right-24 h-80 w-80 rounded-full bg-violet-100 blur-3xl" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="border-aero-200 bg-aero-50 font-semibold text-aero-800 hover:bg-aero-100">
              <Snowflake className="size-3.5" />
              Built on Avalanche · sub-second finality
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 text-5xl leading-[1.02] font-extrabold tracking-tight text-neutral-950 sm:text-6xl lg:text-7xl"
          >
            Digital dollars that{" "}
            <span className="text-aero-800">move</span> and{" "}
            <span className="relative inline-block text-aero-800">
              work.
              <svg
                viewBox="0 0 220 14"
                aria-hidden
                className="absolute -bottom-2 left-0 w-full text-aero-200"
              >
                <path
                  d="M3 10 C 60 3, 160 3, 217 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600"
          >
            Aero is the consumer payments app on Avalanche. Send USDC to{" "}
            <span className="font-semibold text-neutral-900">@usernames</span>{" "}
            instantly, pay bills straight from your balance, and let idle money
            earn yield automatically. No addresses. No gas confusion. No chain
            switching.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button
              size="lg"
              className="h-12 bg-aero-800 px-7 text-base font-semibold text-white hover:bg-aero-900"
            >
              Claim your @username
              <ArrowRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 border-neutral-300 px-7 text-base font-semibold"
            >
              See how it works
            </Button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-sm text-neutral-500"
          >
            {HERO_FEED.map((s) => (
              <span key={`${s.to}-${s.amount}`} className="inline-flex items-center gap-1.5">
                <Zap className="size-3.5 text-aero-700" />
                <span className="font-semibold text-neutral-700">
                  {s.from} → {s.to}
                </span>{" "}
                {s.amount} · {s.time}
              </span>
            ))}
          </motion.div>
        </div>
        <HeroPhone />
      </div>
    </section>
  )
}

/* --------------------------------- ticker --------------------------------- */

const TICKER = [
  "@priya → @marcus $88.00 · 0.7s",
  "@you earned +$0.14 while you slept",
  "@cafe-luna got paid $212.40",
  "Best route: Trader Joe 5.31%",
  "@sofia → @ben $25.00 · 0.6s",
  "Best route: Benqi 4.92%",
  "@landlord got rent $1,400.00",
  "@you → @maya $45.00 · 0.8s",
]

function Ticker() {
  const reduce = useReducedMotion()
  return (
    <div className="overflow-hidden bg-aero-800 py-3.5 text-white">
      <div
        className={cn(
          "flex w-max items-center gap-10 pr-10 text-sm font-medium whitespace-nowrap",
          !reduce && "animate-aero-marquee"
        )}
      >
        {[...TICKER, ...TICKER].map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2.5">
            <AeroMark className="size-4 text-white/60" />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- pillars -------------------------------- */

const PILLARS = [
  {
    icon: Zap,
    tag: "Send",
    title: "Send to @usernames, not addresses",
    body: "Type @maya, hit send. USDC settles in under a second on Avalanche. No 0x strings, no waiting, no “did it go through?”",
    points: ["Sub-second finality", "Zero address anxiety", "Works for anyone"],
  },
  {
    icon: ReceiptText,
    tag: "Pay",
    title: "Bills, merchants, freelancers",
    body: "Pay rent, power, and people straight from your Aero balance. No bank transfers, no delays — money just arrives.",
    points: ["Rent & utilities", "In-person merchants", "Freelancer payouts"],
  },
  {
    icon: Sprout,
    tag: "Earn",
    title: "Idle money grows itself",
    body: "Aero's agent routes your USDC across Benqi and Trader Joe to chase the best rate. You do nothing — your balance just grows.",
    points: ["Automatic routing", "Best-rate hunting", "Withdraw anytime"],
  },
]

function Pillars() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-sm font-bold tracking-widest text-aero-700 uppercase">
            Send · Pay · Earn
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-neutral-950 sm:text-5xl">
            Three things. Zero crypto homework.
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Built for normal people who want digital dollars that move fast and
            don&apos;t sit idle — not for crypto natives.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.tag}
              {...fadeUp}
              transition={{ duration: 0.55, delay: i * 0.1 }}
            >
              <Card className="group h-full gap-0 rounded-3xl border-neutral-200 p-7 transition duration-300 hover:-translate-y-1.5 hover:border-aero-200 hover:shadow-xl hover:shadow-aero-800/10">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-aero-800 text-white transition group-hover:scale-110">
                  <p.icon className="size-6" />
                </span>
                <p className="mt-5 text-xs font-bold tracking-widest text-aero-700 uppercase">
                  {p.tag}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-3 leading-relaxed text-neutral-600">{p.body}</p>
                <Separator className="my-5" />
                <ul className="space-y-2 text-sm font-medium text-neutral-700">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600" strokeWidth={3} />
                      {pt}
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------- send demo ------------------------------- */

type FeedItem = { to: string; amount: string }

function SendDemo() {
  const [to, setTo] = useState("@maya")
  const [amount, setAmount] = useState("45.00")
  const [sending, setSending] = useState(false)
  const [feed, setFeed] = useState<FeedItem[]>([
    { to: "@leo", amount: "$120.00" },
    { to: "@sam", amount: "$12.50" },
  ])
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  const send = () => {
    if (sending || !to.trim()) return
    setSending(true)
    setTimeout(() => {
      setFeed((f) =>
        [{ to: to.startsWith("@") ? to : `@${to}`, amount: `$${amount || "0.00"}` }, ...f].slice(0, 4)
      )
      setSending(false)
    }, 900)
  }

  return (
    <section id="send" ref={ref} className="bg-aero-50/60 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <p className="text-sm font-bold tracking-widest text-aero-700 uppercase">
            01 — Send
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-neutral-950 sm:text-5xl">
            If you can tag someone, you can pay them.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            No wallet addresses to copy. No network to pick. Just a username
            and an amount — Aero handles the chain, the gas, and the
            finality under the hood.
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-aero-800">
            <BadgeCheck className="size-5" />
            Try it — this demo actually “sends”
          </div>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="rounded-3xl border-neutral-200 p-6 shadow-xl shadow-aero-800/10 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="font-extrabold tracking-tight">Send USDC</p>
              <Badge className="bg-emerald-100 font-semibold text-emerald-800 hover:bg-emerald-100">
                Instant · ~0.8s
              </Badge>
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor="send-to" className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
                  To
                </label>
                <Input
                  id="send-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="@username"
                  className="mt-1.5 h-12 rounded-xl text-base font-semibold"
                />
              </div>
              <div>
                <label htmlFor="send-amount" className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
                  Amount (USDC)
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 text-lg font-bold text-neutral-400">
                    $
                  </span>
                  <Input
                    id="send-amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="h-12 rounded-xl pl-8 text-base font-semibold"
                  />
                </div>
              </div>
              <Button
                onClick={send}
                disabled={sending}
                className="h-12 w-full bg-aero-800 text-base font-semibold text-white hover:bg-aero-900"
              >
                {sending ? (
                  <motion.span
                    key="sending"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="inline-flex items-center gap-2"
                  >
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                      className="inline-block"
                    >
                      <Send className="size-4" />
                    </motion.span>
                    Sending…
                  </motion.span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Send className="size-4" /> Send {to || "@someone"}
                  </span>
                )}
              </Button>
              <p className="text-center text-xs text-neutral-400">
                No address · No gas settings · No chain picker
              </p>
            </div>
            <Separator className="my-5" />
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {inView &&
                  feed.map((f) => (
                    <motion.div
                      key={`${f.to}-${f.amount}`}
                      layout
                      initial={{ opacity: 0, y: -12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm"
                    >
                      <span className="font-semibold">
                        You → <span className="text-aero-800">{f.to}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 font-bold tabular-nums">
                        {f.amount}
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <Check className="size-3.5" strokeWidth={3} /> Settled
                        </span>
                      </span>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------------------------- earn ---------------------------------- */

function Earn() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const apy = useCountUp(5.31, inView)
  const earned = useCountUp(184.27, inView)
  const [auto, setAuto] = useState(true)

  return (
    <section id="earn" ref={ref} className="relative overflow-hidden bg-aero-950 py-24 text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-aero-700/50 blur-3xl" />
        <div className="absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-violet-700/40 blur-3xl" />
        <AeroMark className="absolute -right-16 top-10 size-[420px] text-white/[0.04]" />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <motion.div {...fadeUp}>
          <p className="text-sm font-bold tracking-widest text-aero-200 uppercase">
            03 — Earn
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Your balance works the night shift.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            Leave USDC sitting and Aero&apos;s agent puts it to work across
            Avalanche DeFi — Benqi, Trader Joe, and beyond — always chasing the
            best rate. You never lift a finger.
          </p>
          <div className="mt-8 flex items-end gap-8">
            <div>
              <p className="text-xs font-bold tracking-widest text-white/50 uppercase">
                Live best rate
              </p>
              <p className="mt-1 text-6xl font-extrabold tracking-tight text-emerald-300 tabular-nums">
                {apy.toFixed(2)}%
              </p>
              <p className="mt-1 text-sm text-white/60">APY · auto-routed</p>
            </div>
            <div className="pb-1.5">
              <p className="text-xs font-bold tracking-widest text-white/50 uppercase">
                Earned to date
              </p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">
                ${earned.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={auto}
              onClick={() => setAuto((a) => !a)}
              className={cn(
                "relative h-7 w-12 rounded-full transition",
                auto ? "bg-emerald-400" : "bg-white/20"
              )}
            >
              <motion.span
                layout
                className="absolute top-1 left-1 size-5 rounded-full bg-white shadow"
                animate={{ x: auto ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            </button>
            <span className="text-sm font-semibold">
              Auto-yield {auto ? "on" : "off"}
              <span className="text-white/50"> — of course it&apos;s on</span>
            </span>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
          <Card className="gap-0 rounded-3xl border-white/10 bg-white/[0.06] p-6 text-white backdrop-blur sm:p-7">
            <div className="flex items-center justify-between">
              <p className="font-extrabold tracking-tight">Agent routing · live</p>
              <Badge className="border-emerald-300/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/20">
                Optimizing
              </Badge>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { name: "Trader Joe", detail: "USDC lending", rate: "5.31%", best: true },
                { name: "Benqi", detail: "USDC supply", rate: "4.92%", best: false },
                { name: "Aero reserve", detail: "Instant liquidity", rate: "0.00%", best: false },
              ].map((r, i) => (
                <motion.div
                  key={r.name}
                  initial={{ opacity: 0, x: 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.5 }}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border px-4 py-3.5",
                    r.best
                      ? "border-emerald-300/40 bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.03]"
                  )}
                >
                  <div>
                    <p className="font-bold">
                      {r.name}{" "}
                      {r.best && (
                        <span className="ml-1.5 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
                          BEST
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/55">{r.detail}</p>
                  </div>
                  <p className={cn("text-xl font-extrabold tabular-nums", r.best ? "text-emerald-300" : "text-white/70")}>
                    {r.rate}
                  </p>
                </motion.div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-white/[0.04] p-4 text-sm leading-relaxed text-white/65">
              <span className="font-semibold text-white">2:41 AM —</span> agent
              moved $1,200 from Benqi to Trader Joe for +0.39%. You were asleep.
              That&apos;s the point.
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}

/* --------------------------------- network -------------------------------- */

const L1S = ["C-Chain", "Benqi L1", "Gaming L1", "PayFi L1", "DeFi L1", "FX L1", "Social L1", "RWA L1"]

function Network() {
  return (
    <section id="network" className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-5 text-center">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl">
          <p className="text-sm font-bold tracking-widest text-aero-700 uppercase">
            Under the hood
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-neutral-950 sm:text-5xl">
            80+ Avalanche L1s. You see none of them.
          </h2>
          <p className="mt-4 text-lg text-neutral-600">
            Aero runs a cross-L1 intelligence layer on Avalanche Warp Messaging
            that routes funds to optimize yield and execution. All the user
            sees: money working.
          </p>
        </motion.div>
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative mx-auto mt-12 max-w-3xl rounded-3xl border border-neutral-200 bg-neutral-950 p-8 text-white shadow-2xl shadow-aero-800/20 sm:p-12"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-aero-700 shadow-lg shadow-aero-700/50">
              <BrandIcon className="size-10 rounded-md text-white" />
            </span>
            <div className="text-left">
              <p className="font-extrabold">Aero router</p>
              <p className="text-xs text-white/55">Warp Messaging · live</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {L1S.map((l1, i) => (
              <motion.span
                key={l1}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold",
                  i < 2
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/70"
                )}
              >
                {i < 2 && <span className="size-1.5 rounded-full bg-emerald-300" />}
                {l1}
              </motion.span>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-md text-sm leading-relaxed text-white/55">
            Funds flow to wherever execution is fastest and yield is highest —
            then collapse back into one simple balance.
          </p>
        </motion.div>
        <div className="mx-auto mt-10 grid max-w-3xl gap-4 text-left sm:grid-cols-3">
          {[
            { icon: Zap, t: "Sub-second", d: "Avalanche finality on every send." },
            { icon: ShieldCheck, t: "Self-custodied", d: "Your keys, your dollars. Always." },
            { icon: Sparkles, t: "Invisible crypto", d: "No gas, no chains, no jargon." },
          ].map((f, i) => (
            <motion.div key={f.t} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }} className="flex gap-3 rounded-2xl border border-neutral-200 p-5">
              <f.icon className="mt-0.5 size-5 shrink-0 text-aero-700" />
              <div>
                <p className="font-bold">{f.t}</p>
                <p className="mt-1 text-sm text-neutral-600">{f.d}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- pay ---------------------------------- */

const BILLS = [
  { id: "rent", name: "Rent · Maple Apartments", detail: "Due May 1", amount: "$1,400.00", icon: "🏠" },
  { id: "power", name: "City Power & Light", detail: "Due Apr 28", amount: "$86.20", icon: "💡" },
  { id: "designer", name: "@lena · logo design", detail: "Invoice #042", amount: "$320.00", icon: "🎨" },
]

function Pay() {
  const [paid, setPaid] = useState<string[]>([])
  const toggle = (id: string) =>
    setPaid((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return (
    <section id="pay" className="bg-aero-50/60 py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        <motion.div {...fadeUp} className="order-2 lg:order-1">
          <Card className="gap-0 rounded-3xl border-neutral-200 p-3 shadow-xl shadow-aero-800/10 sm:p-4">
            <AnimatePresence initial={false}>
              {BILLS.map((b) => {
                const isPaid = paid.includes(b.id)
                return (
                  <motion.div
                    key={b.id}
                    layout
                    className="flex items-center gap-4 rounded-2xl p-4 transition hover:bg-neutral-50"
                  >
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-aero-50 text-2xl">
                      {b.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate font-bold", isPaid && "text-neutral-400 line-through")}>
                        {b.name}
                      </p>
                      <p className="text-xs text-neutral-500">{b.detail}</p>
                    </div>
                    <span className="font-extrabold tabular-nums">{b.amount}</span>
                    <Button
                      size="sm"
                      onClick={() => toggle(b.id)}
                      className={cn(
                        "font-semibold",
                        isPaid
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          : "bg-aero-800 text-white hover:bg-aero-900"
                      )}
                    >
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1">
                          <Check className="size-3.5" strokeWidth={3} /> Paid
                        </span>
                      ) : (
                        "Pay"
                      )}
                    </Button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div className="flex items-center gap-2 rounded-2xl bg-aero-800 p-4 text-sm font-semibold text-white">
              <Bell className="size-4" />
              {paid.length === 0
                ? "3 bills due — pay them all in under a minute."
                : paid.length === BILLS.length
                  ? "All clear. Nothing due. Beautiful."
                  : `${BILLS.length - paid.length} to go — you're almost done.`}
            </div>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} className="order-1 lg:order-2">
          <p className="text-sm font-bold tracking-widest text-aero-700 uppercase">
            02 — Pay
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-neutral-950 sm:text-5xl">
            Your balance pays for real life.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            Rent, power, groceries, freelancers — paid directly from Aero. The
            same dollars that earn yield in the morning buy dinner at night.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm font-medium text-neutral-700">
            {["No bank transfers, no 3-day waits", "Pay anyone — they don't need Aero", "Every idle dollar still earns until spent"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-emerald-600" strokeWidth={3} />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

/* ----------------------------------- cta ---------------------------------- */

function CTA() {
  const [name, setName] = useState("")
  return (
    <section className="bg-white px-5 py-24">
      <motion.div
        {...fadeUp}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-aero-800 px-6 py-16 text-center text-white shadow-2xl shadow-aero-800/30 sm:px-12 sm:py-20"
      >
        <AeroMark className="pointer-events-none absolute -bottom-20 -left-20 size-72 text-white/[0.06]" />
        <AeroMark className="pointer-events-none absolute -top-24 -right-16 size-80 text-white/[0.06]" />
        <div className="relative">
          <Badge className="border-white/20 bg-white/10 font-semibold text-white hover:bg-white/15">
            <Sparkles className="size-3.5" /> Early access · usernames are first-come
          </Badge>
          <h2 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Claim your @username before someone else does.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            One handle for sending, getting paid, and growing. Free to claim —
            yours forever.
          </p>
          <form
            className="mx-auto mt-8 flex max-w-md flex-col gap-2.5 sm:flex-row"
            onSubmit={(e) => e.preventDefault()}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="@yourname"
              aria-label="Desired username"
              className="h-13 rounded-2xl border-white/20 bg-white/10 px-5 text-base font-semibold text-white placeholder:text-white/40"
            />
            <Button className="h-13 shrink-0 bg-white px-7 text-base font-bold text-aero-800 hover:bg-aero-50">
              Claim <ArrowRight className="size-4" />
            </Button>
          </form>
          <p className="mt-4 text-xs text-white/50">
            {name ? `${name.startsWith("@") ? name : `@${name}`} — nice choice. 🎯` : "No wallet needed to reserve."}
          </p>
        </div>
      </motion.div>
    </section>
  )
}

/* ---------------------------------- footer -------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-12 sm:flex-row sm:items-center">
        <div className="text-aero-800">
          <BrandLockup tone="dark" height={32} />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-500">
            Consumer payments on Avalanche. Send, pay, earn — without the
            crypto homework.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-neutral-600">
          <a href="#send" className="hover:text-aero-800">Send</a>
          <a href="#pay" className="hover:text-aero-800">Pay</a>
          <a href="#earn" className="hover:text-aero-800">Earn</a>
          <a href="#network" className="hover:text-aero-800">Network</a>
        </div>
      </div>
      <div className="border-t border-neutral-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-neutral-400">
          <span>© 2026 Aero. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5">
            <Snowflake className="size-3.5" /> Built on Avalanche · USDC
          </span>
        </div>
      </div>
    </footer>
  )
}

/* ---------------------------------- export --------------------------------- */

export default function AeroLanding() {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-950 antialiased">
      <SiteNav />
      <main>
        <Hero />
        <Ticker />
        <Pillars />
        <SendDemo />
        <Earn />
        <Pay />
        <Network />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
