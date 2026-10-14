"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react"
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Send,
  Sprout,
  Wallet,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { AeroMark } from "./logo"
import { BrandIcon, BrandLockup, BrandWordmark } from "./brand-logo"

/* ---------------------------------- atoms --------------------------------- */

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
} as const

function Kicker({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <p
      className={cn(
        "font-mono text-xs font-bold tracking-[0.22em] uppercase",
        tone === "dark" ? "text-aero-800" : "text-white/70"
      )}
    >
      <span className={cn("mr-2 inline-block size-2", tone === "dark" ? "bg-aero-800" : "bg-emerald-300")} />
      {children}
    </p>
  )
}

function SectionHead({
  index,
  title,
  body,
  tone = "dark",
}: {
  index: string
  title: ReactNode
  body?: string
  tone?: "dark" | "light"
}) {
  return (
    <motion.div {...fadeUp} className="max-w-3xl">
      <div className="flex items-baseline gap-4">
        <span className={cn("font-mono text-sm font-bold", tone === "dark" ? "text-aero-800" : "text-emerald-300")}>
          {index}
        </span>
        <span className={cn("h-px flex-1", tone === "dark" ? "bg-aero-950/15" : "bg-white/20")} />
      </div>
      <h2
        className={cn(
          "mt-5 text-4xl font-extrabold tracking-tight text-balance uppercase sm:text-5xl",
          tone === "dark" ? "text-aero-950" : "text-white"
        )}
      >
        {title}
      </h2>
      {body && (
        <p className={cn("mt-4 max-w-xl text-lg leading-relaxed", tone === "dark" ? "text-aero-950/65" : "text-white/70")}>
          {body}
        </p>
      )}
    </motion.div>
  )
}

/** Outlined version of the Aero arrow — graphic texture, not the logo. */
function OutlineArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="7" aria-hidden className={cn("size-8", className)}>
      <rect x="8" y="8" width="80" height="22" />
      <rect x="66" y="8" width="22" height="80" />
      <polygon points="51,27 15,63 29,77 67,43" />
    </svg>
  )
}

function ArrowStrip({ dark = false }: { dark?: boolean }) {
  const reduce = useReducedMotion()
  const row = Array.from({ length: 12 })
  return (
    <div className={cn("overflow-hidden py-5", dark ? "bg-aero-950 text-white/25" : "bg-aero-800 text-white/25")}>
      <div className={cn("flex w-max items-center gap-8 pr-8", !reduce && "animate-aero-marquee")}>
        {[...row, ...row].map((_, i) => (
          <OutlineArrow key={i} className="size-10 shrink-0" />
        ))}
      </div>
    </div>
  )
}

function useCountUp(target: number, active: boolean, duration = 1600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target, duration])
  return value
}

/* --------------------------- scroll word reveal ---------------------------- */

function Word({
  progress,
  range,
  children,
}: {
  progress: MotionValue<number>
  range: [number, number]
  children: ReactNode
}) {
  const opacity = useTransform(progress, range, [0.13, 1])
  return <motion.span style={{ opacity }}>{children} </motion.span>
}

function RevealWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.45"],
  })
  const words = text.split(" ")
  return (
    <p ref={ref} className={className}>
      {words.map((w, i) => (
        <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
          {w}
        </Word>
      ))}
    </p>
  )
}

/* ----------------------------------- nav ---------------------------------- */

function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-aero-950 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-[110rem] items-center justify-between px-5 lg:px-10">
        <a href="#top" aria-label="Aero home">
          <BrandLockup tone="dark" height={30} />
        </a>
        <nav className="hidden items-center gap-7 font-mono text-xs font-bold tracking-[0.18em] text-aero-950/70 uppercase md:flex">
          <a href="#send" className="transition hover:text-aero-800">Send</a>
          <a href="#pay" className="transition hover:text-aero-800">Pay</a>
          <a href="#earn" className="transition hover:text-aero-800">Earn</a>
          <a href="#network" className="transition hover:text-aero-800">Network</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" className="hidden font-semibold text-aero-950 hover:bg-aero-50 sm:inline-flex">
            Log in
          </Button>
          <Button className="bg-aero-800 font-bold text-white hover:bg-aero-900">
            Get early access
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}

/* ----------------------------------- hero --------------------------------- */

function HeroPhone() {
  const [balance, setBalance] = useState(2480.16)
  useEffect(() => {
    const id = setInterval(() => setBalance((b) => b + 0.02 + Math.random() * 0.03), 2000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="animate-aero-float relative z-10 border-2 border-aero-950 bg-aero-800 p-6 text-white aero-hard-shadow"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandIcon className="size-7 rounded text-white" />
            <span className="font-mono text-sm font-bold tracking-wide">@you · USDC</span>
          </div>
          <span className="inline-flex items-center gap-1.5 border border-white/30 px-2.5 py-1 font-mono text-[11px] font-bold">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping bg-emerald-300" />
              <span className="relative inline-flex size-1.5 bg-emerald-300" />
            </span>
            EARNING 5.24%
          </span>
        </div>
        <p className="mt-7 font-mono text-[11px] font-bold tracking-[0.22em] text-white/60 uppercase">Balance</p>
        <p className="mt-1 font-mono text-5xl font-extrabold tracking-tight tabular-nums">
          ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="mt-2 font-mono text-xs text-emerald-300">+$3.41 this week · automatic</p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button className="h-11 bg-white font-bold text-aero-900 hover:bg-aero-100">
            <Send className="size-4" /> Send
          </Button>
          <Button variant="outline" className="h-11 border-white/40 bg-transparent font-bold text-white hover:bg-white/10 hover:text-white">
            <Wallet className="size-4" /> Pay bill
          </Button>
        </div>
        <div className="mt-5 border-t-2 border-dashed border-white/25 pt-4 font-mono text-xs">
          {[
            ["YOU → @MAYA", "$45.00 · 0.8S ✓"],
            ["@LEO → YOU", "$120.00 · 0.6S ✓"],
          ].map(([a, b]) => (
            <div key={a} className="flex items-center justify-between py-1">
              <span className="font-bold">{a}</span>
              <span className="text-white/70 tabular-nums">{b}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className="absolute -right-3 -bottom-12 z-20 w-60 border-2 border-aero-950 bg-white p-4 aero-hard-shadow-sm sm:-right-8"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center bg-emerald-500 text-white">
            <Check className="size-5" strokeWidth={3.5} />
          </span>
          <div>
            <p className="text-sm font-extrabold">Sent to @maya</p>
            <p className="font-mono text-[11px] text-aero-950/60">$45.00 · SETTLED 0.8S</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="absolute -top-10 -left-3 z-20 w-60 border-2 border-aero-950 bg-white p-4 aero-hard-shadow-sm sm:-left-8"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center bg-aero-800 text-white">
            <Sprout className="size-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold">Yield routed</p>
            <p className="font-mono text-[11px] text-aero-950/60">BENQI → TRADER JOE</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Hero() {
  return (
    <section id="top" className="flex min-h-svh items-center border-b-2 border-aero-950 bg-white pt-24 pb-20">
      <div className="mx-auto grid w-full max-w-[110rem] items-center gap-16 px-5 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Kicker>Live on Avalanche · Sub-second finality</Kicker>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-5 text-[clamp(3.4rem,9vw,10rem)] leading-[0.93] font-extrabold tracking-tight text-aero-950 uppercase"
          >
            Send it.{" "}
            <span className="inline-flex items-center gap-[0.08em]">
              Spend it.
              <AeroMark className="size-[0.72em] text-aero-800" />
            </span>
            <br />
            <span className="text-aero-800">Grow it.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-aero-950/70"
          >
            Aero is dollars on Avalanche. Pay any <span className="font-bold text-aero-950">@username</span> in
            under a second, cover real bills from the same balance, and let the rest earn while you
            sleep. No addresses. No gas. No chains.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button size="lg" className="h-13 bg-aero-800 px-7 text-base font-bold text-white hover:bg-aero-900">
              Claim your @username
              <ArrowRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" className="h-13 border-2 border-aero-950 px-7 text-base font-bold text-aero-950 hover:bg-aero-50">
              See how it works
            </Button>
          </motion.div>
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.42 }}
            className="mt-10 grid max-w-xl grid-cols-3 gap-6 border-t-2 border-aero-950 pt-5"
          >
            {[
              ["<1s", "finality"],
              ["$0", "gas confusion"],
              ["5.31%", "best APY live"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="font-mono text-2xl font-extrabold text-aero-950 tabular-nums sm:text-3xl">{v}</dd>
                <dd className="mt-1 font-mono text-[11px] font-bold tracking-[0.18em] text-aero-950/50 uppercase">{l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
        <HeroPhone />
      </div>
    </section>
  )
}

/* --------------------------------- ticker --------------------------------- */

const TICKER = [
  "@PRIYA → @MARCUS $88.00 · 0.7S",
  "@YOU EARNED +$0.14 IN YOUR SLEEP",
  "@CAFE-LUNA GOT PAID $212.40",
  "BEST ROUTE: TRADER JOE 5.31%",
  "@SOFIA → @BEN $25.00 · 0.6S",
  "@LANDLORD GOT RENT $1,400.00",
]

function Ticker() {
  const reduce = useReducedMotion()
  return (
    <div className="overflow-hidden border-b-2 border-aero-950 bg-aero-950 py-3.5 text-white">
      <div className={cn("flex w-max items-center gap-8 pr-8 font-mono text-xs font-bold tracking-wider whitespace-nowrap", !reduce && "animate-aero-marquee")}>
        {[...TICKER, ...TICKER].map((t, i) => (
          <span key={i} className="inline-flex items-center gap-8">
            {t}
            <AeroMark className="size-3.5 text-aero-200" />
          </span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- manifesto ------------------------------- */

function Manifesto() {
  return (
    <section className="flex min-h-svh items-center border-b-2 border-aero-950 bg-aero-800 py-24 text-white">
      <div className="mx-auto w-full max-w-[110rem] px-5 lg:px-10">
        <Kicker tone="light">The pitch</Kicker>
        <RevealWords
          className="mt-6 max-w-6xl text-3xl leading-[1.12] font-extrabold tracking-tight text-balance sm:text-6xl"
          text="Wallet addresses are serial numbers. Gas fees are homework. Chains are someone else's problem. Aero is just dollars — moving in under a second, growing while you sleep."
        />
        <motion.p {...fadeUp} className="mt-8 max-w-2xl font-mono text-sm leading-relaxed text-white/60">
          {"// 80+ Avalanche L1s hum underneath via Warp Messaging. You never see them."}
        </motion.p>
      </div>
    </section>
  )
}

/* --------------------------------- pillars -------------------------------- */

const PILLARS = [
  {
    n: "01",
    tag: "SEND",
    title: "If you can tag someone, you can pay them.",
    body: "@maya, $45, done. USDC settles in under a second — no 0x strings, no network picker, no 'did it go through?'",
    href: "#send",
  },
  {
    n: "02",
    tag: "PAY",
    title: "One balance for real life.",
    body: "Rent, power, freelancers — paid straight from Aero. The same dollars that earn in the morning buy dinner at night.",
    href: "#pay",
  },
  {
    n: "03",
    tag: "EARN",
    title: "Idle money is a bug. We fixed it.",
    body: "An agent routes your USDC across Benqi and Trader Joe, always chasing the best rate. You do nothing. It compounds.",
    href: "#earn",
  },
]

function Pillars() {
  return (
    <section className="flex min-h-svh items-center border-b-2 border-aero-950 bg-white py-24">
      <div className="mx-auto w-full max-w-[110rem] px-5 lg:px-10">
        <SectionHead index="A" title="Three things. Zero crypto homework." />
        <div className="mt-12 border-t-2 border-aero-950">
          {PILLARS.map((p, i) => (
            <motion.a
              key={p.n}
              href={p.href}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="group grid items-center gap-4 border-b-2 border-aero-950/10 px-2 py-8 transition-colors duration-200 hover:bg-aero-50 sm:grid-cols-[80px_140px_1fr_auto] sm:gap-8"
            >
              <span className="font-mono text-5xl font-extrabold text-aero-800/25 transition-colors group-hover:text-aero-800 sm:text-6xl tabular-nums">
                {p.n}
              </span>
              <span className="w-fit border-2 border-aero-950 bg-white px-3 py-1 font-mono text-xs font-bold tracking-[0.2em]">{p.tag}</span>
              <span>
                <span className="block text-2xl font-extrabold tracking-tight text-aero-950 uppercase sm:text-3xl">{p.title}</span>
                <span className="mt-2 block max-w-2xl leading-relaxed text-aero-950/65">{p.body}</span>
              </span>
              <AeroMark className="hidden size-10 text-aero-950 transition-transform duration-300 group-hover:translate-x-2 group-hover:text-aero-800 sm:block" />
            </motion.a>
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
  const inView = useInView(ref, { once: true, margin: "-70px" })

  const send = () => {
    if (sending || !to.trim()) return
    setSending(true)
    setTimeout(() => {
      setFeed((f) => [{ to: to.startsWith("@") ? to : `@${to}`, amount: `$${amount || "0.00"}` }, ...f].slice(0, 4))
      setSending(false)
    }, 900)
  }

  return (
    <section id="send" ref={ref} className="flex min-h-svh scroll-mt-16 items-center border-b-2 border-aero-950 bg-aero-50 py-24">
      <div className="mx-auto grid w-full max-w-[110rem] items-center gap-14 px-5 lg:grid-cols-2 lg:px-10">
        <SectionHead
          index="01 / SEND"
          title="Type a name. Hit send. It's there."
          body="No address to copy. No chain to pick. No gas setting to google. Aero handles the chain, the fee, and the finality — you handle the @."
        />
        <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.1 }}>
          <div className="border-2 border-aero-950 bg-white p-6 aero-hard-shadow sm:p-8">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs font-bold tracking-[0.22em] uppercase">Send USDC</p>
              <p className="border border-emerald-600 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700">INSTANT · ~0.8S</p>
            </div>
            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor="send-to" className="font-mono text-[11px] font-bold tracking-[0.2em] text-aero-950/50 uppercase">To</label>
                <Input id="send-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="@username"
                  className="mt-1.5 h-12 rounded-none border-2 border-aero-950 text-base font-bold" />
              </div>
              <div>
                <label htmlFor="send-amount" className="font-mono text-[11px] font-bold tracking-[0.2em] text-aero-950/50 uppercase">Amount</label>
                <div className="relative mt-1.5">
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 text-lg font-extrabold text-aero-950/40">$</span>
                  <Input id="send-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
                    className="h-12 rounded-none border-2 border-aero-950 pr-4 pl-8 font-mono text-base font-bold" />
                </div>
              </div>
              <Button onClick={send} disabled={sending}
                className="h-12 w-full rounded-none bg-aero-800 text-base font-bold text-white hover:bg-aero-900 active:translate-y-0.5">
                {sending ? (
                  <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2">
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="inline-block">
                      <Send className="size-4" />
                    </motion.span>
                    SENDING…
                  </motion.span>
                ) : (
                  <span className="inline-flex items-center gap-2">SEND {to || "@SOMEONE"} <Zap className="size-4" /></span>
                )}
              </Button>
            </div>
            <div className="mt-5 border-t-2 border-dashed border-aero-950/20 pt-4 font-mono text-xs">
              <AnimatePresence initial={false}>
                {inView && feed.map((f) => (
                  <motion.div key={`${f.to}-${f.amount}`} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between py-1.5">
                    <span className="font-bold">YOU → <span className="text-aero-800">{f.to.toUpperCase()}</span></span>
                    <span className="tabular-nums">{f.amount} <span className="font-bold text-emerald-700">✓ SETTLED</span></span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------------------------- earn ---------------------------------- */

function Earn() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-70px" })
  const apy = useCountUp(5.31, inView)
  const earned = useCountUp(184.27, inView)
  const [auto, setAuto] = useState(true)

  return (
    <section id="earn" ref={ref} className="flex min-h-svh scroll-mt-16 items-center border-b-2 border-aero-950 bg-aero-950 py-24 text-white">
      <div className="mx-auto grid w-full max-w-[110rem] items-start gap-14 px-5 lg:grid-cols-[1fr_1fr] lg:px-10">
        <div>
          <motion.div {...fadeUp}>
            <Kicker tone="light">03 / Earn</Kicker>
            <h2 className="mt-5 text-4xl font-extrabold tracking-tight uppercase sm:text-6xl">
              Your balance works <span className="text-emerald-300">nights.</span>
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/65">
              Leave USDC sitting and the agent puts it to work across Avalanche DeFi — always
              chasing the best rate. Withdraw anytime. Sleep through all of it.
            </p>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.1 }} className="mt-10 grid grid-cols-2 gap-8 border-t border-white/15 pt-8">
            <div>
              <p className="font-mono text-[11px] font-bold tracking-[0.22em] text-white/45 uppercase">Live best rate</p>
              <p className="mt-2 font-mono text-6xl font-extrabold text-emerald-300 tabular-nums sm:text-7xl">{apy.toFixed(2)}%</p>
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold tracking-[0.22em] text-white/45 uppercase">Earned to date</p>
              <p className="mt-2 font-mono text-6xl font-extrabold tabular-nums sm:text-7xl">${earned.toFixed(2)}</p>
              <button type="button" role="switch" aria-checked={auto} onClick={() => setAuto((a) => !a)}
                className="mt-4 inline-flex items-center gap-3">
                <span className={cn("relative h-7 w-12 border border-white/30 transition", auto ? "bg-emerald-400" : "bg-white/10")}>
                  <motion.span layout animate={{ x: auto ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className="absolute top-0.5 left-0.5 size-5 bg-white" />
                </span>
                <span className="font-mono text-xs font-bold">AUTO-YIELD {auto ? "ON" : "OFF"}</span>
              </button>
            </div>
          </motion.div>
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.15 }}>
          <div className="border border-white/15">
            <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
              <p className="font-mono text-xs font-bold tracking-[0.22em] uppercase">Agent routing · Live</p>
              <p className="font-mono text-[11px] font-bold text-emerald-300">● OPTIMIZING</p>
            </div>
            {[
              { rank: "1", name: "TRADER JOE", detail: "USDC lending", rate: "5.31%", best: true },
              { rank: "2", name: "BENQI", detail: "USDC supply", rate: "4.92%", best: false },
              { rank: "3", name: "AERO RESERVE", detail: "instant liquidity", rate: "0.00%", best: false },
            ].map((r, i) => (
              <motion.div key={r.name} initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1, duration: 0.45 }}
                className={cn("flex items-center gap-4 border-b border-white/10 px-5 py-4 last:border-0", r.best && "bg-aero-800")}>
                <span className="font-mono text-sm font-bold text-white/40 tabular-nums">{r.rank}</span>
                <span className="flex-1">
                  <span className="block font-extrabold tracking-tight uppercase">
                    {r.name}{" "}
                    {r.best && <span className="ml-1 bg-emerald-300 px-1.5 py-0.5 font-mono text-[10px] font-bold text-aero-950">BEST</span>}
                  </span>
                  <span className="font-mono text-[11px] text-white/45 uppercase">{r.detail}</span>
                </span>
                <span className={cn("font-mono text-2xl font-extrabold tabular-nums", r.best ? "text-emerald-300" : "text-white/60")}>{r.rate}</span>
              </motion.div>
            ))}
            <p className="border-t border-white/15 px-5 py-4 font-mono text-xs leading-relaxed text-white/50">
              <span className="text-white">02:41 —</span> agent moved $1,200 Benqi → Trader Joe, +0.39%. You were asleep. That&apos;s the point.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* --------------------------------- network -------------------------------- */

function Network() {
  return (
    <section id="network" className="flex min-h-svh scroll-mt-16 items-center border-b-2 border-aero-950 bg-aero-800 py-24 text-white">
      <div className="mx-auto w-full max-w-[110rem] px-5 lg:px-10">
        <SectionHead tone="light" index="UNDER THE HOOD"
          title="80+ Avalanche L1s. You see none of them."
          body="A cross-L1 intelligence layer on Warp Messaging routes every dollar to wherever execution is fastest and yield is highest — then collapses it back into one simple balance." />
        <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.1 }}
          className="mt-12 flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
          <div className="grid flex-1 grid-cols-2 gap-2.5">
            {["C-CHAIN", "BENQI L1", "PAYFI L1", "DEFI L1"].map((l1, i) => (
              <motion.div key={l1} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className={cn("border px-4 py-3 font-mono text-xs font-bold",
                  i < 2 ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-200" : "border-white/20 text-white/60")}>
                {i < 2 ? "● " : "○ "}{l1}
              </motion.div>
            ))}
          </div>
          <div aria-hidden className="hidden h-0.5 min-w-16 flex-1 text-emerald-300 aero-warp-line lg:block" />
          <div className="flex items-center gap-3 border-2 border-white bg-white px-5 py-4 text-aero-950 aero-hard-shadow-sm">
            <BrandIcon className="size-9 rounded text-aero-800" />
            <div>
              <p className="font-extrabold tracking-tight uppercase">Aero router</p>
              <p className="font-mono text-[11px] text-aero-950/55">WARP MESSAGING · LIVE</p>
            </div>
          </div>
          <div aria-hidden className="hidden h-0.5 min-w-16 flex-1 text-emerald-300 aero-warp-line lg:block" />
          <div className="border-2 border-emerald-300 bg-aero-950 px-5 py-4">
            <p className="font-mono text-[11px] font-bold tracking-[0.2em] text-emerald-300 uppercase">Best execution</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tabular-nums">0.8s</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ----------------------------------- pay ---------------------------------- */

const BILLS = [
  { id: "rent", name: "Rent · Maple Apartments", detail: "DUE MAY 1", amount: "$1,400.00" },
  { id: "power", name: "City Power & Light", detail: "DUE APR 28", amount: "$86.20" },
  { id: "designer", name: "@lena · logo design", detail: "INVOICE #042", amount: "$320.00" },
]

function Pay() {
  const [paid, setPaid] = useState<string[]>([])
  const toggle = (id: string) => setPaid((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return (
    <section id="pay" className="flex min-h-svh scroll-mt-16 items-center border-b-2 border-aero-950 bg-white py-24">
      <div className="mx-auto grid w-full max-w-[110rem] items-center gap-14 px-5 lg:grid-cols-2 lg:px-10">
        <motion.div {...fadeUp} className="order-2 lg:order-1">
          <div className="border-2 border-aero-950 bg-white aero-hard-shadow">
            <div className="flex items-center justify-between border-b-2 border-aero-950 px-5 py-3">
              <p className="font-mono text-xs font-bold tracking-[0.22em] uppercase">Aero Pay — May</p>
              <AeroMark className="size-5 text-aero-800" />
            </div>
            <div className="px-2 py-2">
              <AnimatePresence initial={false}>
                {BILLS.map((b) => {
                  const isPaid = paid.includes(b.id)
                  return (
                    <motion.div key={b.id} layout className="relative flex items-center gap-4 border-b-2 border-dashed border-aero-950/15 px-3 py-4 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className={cn("font-extrabold tracking-tight uppercase", isPaid && "text-aero-950/35 line-through")}>{b.name}</p>
                        <p className="font-mono text-[11px] text-aero-950/50">{b.detail}</p>
                      </div>
                      <span className="font-mono font-extrabold tabular-nums">{b.amount}</span>
                      {isPaid ? (
                        <motion.span initial={{ scale: 1.6, opacity: 0, rotate: -18 }} animate={{ scale: 1, opacity: 1, rotate: -12 }}
                          className="border-2 border-emerald-600 px-2 py-0.5 font-mono text-xs font-extrabold text-emerald-700">
                          PAID
                        </motion.span>
                      ) : (
                        <Button size="sm" onClick={() => toggle(b.id)} className="rounded-none bg-aero-800 font-bold text-white hover:bg-aero-900">
                          PAY
                        </Button>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
            <div className="bg-aero-800 px-5 py-3 font-mono text-xs font-bold text-white">
              {paid.length === 0 ? "3 DUE — CLEAR THEM ALL IN UNDER A MINUTE." : paid.length === BILLS.length ? "ALL CLEAR. NOTHING DUE." : `${BILLS.length - paid.length} TO GO.`}
            </div>
          </div>
        </motion.div>
        <div className="order-1 lg:order-2">
          <SectionHead index="02 / PAY"
            title="Your balance pays for real life."
            body="The same dollars that earn yield in the morning buy dinner at night. No bank transfers, no 3-day waits — and the payee doesn't even need Aero." />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- cta ---------------------------------- */

function CTA() {
  const [name, setName] = useState("")
  const clean = name.trim().replace(/^@+/, "")
  return (
    <section className="bg-white">
      <ArrowStrip />
      <div className="flex min-h-[92svh] items-center justify-center border-b-2 border-aero-950 bg-aero-800 px-5 py-24 text-center text-white lg:px-10">
        <motion.div {...fadeUp} className="mx-auto w-full max-w-3xl">
          <div className="flex justify-center">
            <BrandWordmark tone="light" height={72} />
          </div>
          <h2 className="mx-auto mt-8 max-w-2xl text-4xl font-extrabold tracking-tight text-balance uppercase sm:text-6xl">
            Claim your @ before someone else does.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
            One handle for sending, getting paid, and growing. Free to claim — yours forever.
          </p>
          <form className="mx-auto mt-8 flex max-w-md flex-col gap-2.5 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="@yourname" aria-label="Desired username"
              className="h-13 rounded-none border-2 border-white bg-white/10 px-5 text-base font-bold text-white placeholder:text-white/40" />
            <Button className="h-13 shrink-0 rounded-none bg-white px-7 text-base font-extrabold text-aero-900 hover:bg-aero-100">
              CLAIM <ArrowRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-1" />
            </Button>
          </form>
          <p className="mt-4 font-mono text-xs text-white/50">
            {clean ? `@${clean} — NICE CHOICE.` : "NO WALLET NEEDED TO RESERVE."}
          </p>
        </motion.div>
      </div>
    </section>
  )
}

/* ---------------------------------- footer -------------------------------- */

function Footer() {
  return (
    <footer className="bg-aero-950 text-white">
      <div className="mx-auto grid max-w-[110rem] gap-10 px-5 py-14 md:grid-cols-[1.2fr_1fr] lg:px-10">
        <div>
          <BrandLockup tone="light" height={34} />
          <p className="mt-4 max-w-xs leading-relaxed text-white/55">
            Consumer payments on Avalanche. Send, pay, earn — without the crypto homework.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 font-mono text-xs font-bold tracking-[0.18em] uppercase">
          <div className="space-y-3">
            <p className="text-white/35">Product</p>
            <a href="#send" className="block hover:text-emerald-300">Send</a>
            <a href="#pay" className="block hover:text-emerald-300">Pay</a>
            <a href="#earn" className="block hover:text-emerald-300">Earn</a>
          </div>
          <div className="space-y-3">
            <p className="text-white/35">Company</p>
            <a href="#network" className="block hover:text-emerald-300">Network</a>
            <a href="#top" className="block hover:text-emerald-300">Early access</a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-2 px-5 py-5 font-mono text-[11px] text-white/40 lg:px-10">
          <span>© 2026 AERO</span>
          <span>BUILT ON AVALANCHE · USDC</span>
        </div>
      </div>
    </footer>
  )
}

/* ---------------------------------- export --------------------------------- */

export default function AeroLanding() {
  return (
    <div className="min-h-screen bg-white font-sans text-aero-950 antialiased">
      <div aria-hidden className="aero-noise pointer-events-none fixed inset-0 z-[60] opacity-[0.05]" />
      <SiteNav />
      <main>
        <Hero />
        <Ticker />
        <Manifesto />
        <Pillars />
        <SendDemo />
        <Earn />
        <Network />
        <Pay />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
