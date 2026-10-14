"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
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
  Menu,
  Send,
  ShieldCheck,
  Sprout,
  Wallet,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { AeroMark } from "./logo"
import { BrandIcon, BrandLockup, BrandWordmark } from "./brand-logo"

/* ---------------------------------- atoms --------------------------------- */

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
} as const

const SOFT = "shadow-[0_12px_40px_-16px_rgba(11,0,78,0.25)]"

/** Smooth-scroll to a section without putting the hash in the URL. Falls back to home when the target isn't on this page. */
function goTo(e: { preventDefault: () => void }, id: string) {
  e.preventDefault()
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    history.replaceState(null, "", window.location.pathname + window.location.search)
  } else {
    window.location.href = `/#${id}`
  }
}

function Kicker({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <p className={cn("text-[13px] font-semibold tracking-[0.14em] uppercase", tone === "dark" ? "text-neutral-500" : "text-white/55")}>
      {children}
    </p>
  )
}

function SectionHead({
  eyebrow,
  title,
  body,
  tone = "dark",
}: {
  eyebrow: string
  title: ReactNode
  body?: string
  tone?: "dark" | "light"
}) {
  return (
    <motion.div {...fadeUp} className="max-w-2xl">
      <Kicker tone={tone}>{eyebrow}</Kicker>
      <h2 className={cn("mt-4 text-4xl font-medium tracking-[-0.02em] text-balance sm:text-5xl", tone === "dark" ? "text-neutral-900" : "text-white")}>
        {title}
      </h2>
      {body && (
        <p className={cn("mt-4 text-lg leading-relaxed", tone === "dark" ? "text-neutral-600" : "text-white/65")}>
          {body}
        </p>
      )}
    </motion.div>
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

function Word({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: ReactNode }) {
  const opacity = useTransform(progress, range, [0.12, 1])
  return <motion.span style={{ opacity }}>{children} </motion.span>
}

function RevealWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] })
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuGo = (id: string) => (e: { preventDefault: () => void }) => {
    goTo(e, id)
    setMenuOpen(false)
  }
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[110rem] items-center justify-between px-5 lg:px-10">
        <a href="#top" aria-label="Aero home" onClick={(e) => goTo(e, "top")}>
          <BrandLockup tone="dark" height={28} />
        </a>
        <nav className="hidden items-center gap-8 text-[15px] font-medium text-neutral-600 md:flex">
          <a href="#send" onClick={(e) => goTo(e, "send")} className="transition hover:text-neutral-950">Send</a>
          <a href="#pay" onClick={(e) => goTo(e, "pay")} className="transition hover:text-neutral-950">Pay</a>
          <a href="#earn" onClick={(e) => goTo(e, "earn")} className="transition hover:text-neutral-950">Earn</a>
          <a href="#network" onClick={(e) => goTo(e, "network")} className="transition hover:text-neutral-950">Network</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden rounded-full font-medium text-neutral-700 hover:bg-neutral-100 sm:inline-flex">
            Log in
          </Button>
          <Button onClick={(e) => goTo(e, "waitlist")} className="rounded-full bg-aero-800 font-medium text-white hover:bg-aero-900">
            Get early access
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="h-11 w-11 rounded-full text-neutral-900 hover:bg-neutral-100 md:hidden"
          >
            <Menu className="size-5" />
          </Button>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="right" className="w-72 border-neutral-200 bg-white p-6">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="mt-10 flex flex-col gap-1">
              {[
                ["Send", "send"],
                ["Pay", "pay"],
                ["Earn", "earn"],
                ["Network", "network"],
              ].map(([label, id]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={menuGo(id)}
                  className="rounded-2xl px-4 py-3.5 text-lg font-medium text-neutral-900 transition hover:bg-neutral-100"
                >
                  {label}
                </a>
              ))}
            </div>
            <Button
              className="mt-6 h-12 w-full rounded-full bg-aero-800 font-medium text-white hover:bg-aero-900"
              onClick={menuGo("waitlist")}
            >
              Get early access
            </Button>
          </SheetContent>
        </Sheet>
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
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.3 }}
        className={cn("animate-aero-float relative z-10 rounded-[24px] border border-neutral-200 bg-white p-6", SOFT)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandIcon className="size-8 rounded-lg text-aero-800" />
            <div>
              <p className="text-[15px] font-semibold text-neutral-900">@you</p>
              <p className="text-xs text-neutral-500">USDC · Avalanche</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Earning 5.24%
          </span>
        </div>
        <p className="mt-7 text-[13px] font-medium tracking-wide text-neutral-500">Balance</p>
        <p className="mt-1 text-[44px] leading-none font-medium tracking-tight text-neutral-900 tabular-nums">
          ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="mt-2 text-[13px] text-neutral-500">+$3.41 earned this week, automatically</p>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Button className="h-11 rounded-full bg-aero-800 font-medium text-white hover:bg-aero-900">
            <Send className="size-4" /> Send
          </Button>
          <Button variant="outline" className="h-11 rounded-full border-neutral-200 font-medium text-neutral-900 hover:bg-neutral-50">
            <Wallet className="size-4" /> Pay bill
          </Button>
        </div>
        <div className="mt-5 border-t border-neutral-100 pt-3 text-[13px]">
          {[
            ["You → @maya", "$45.00 · settled"],
            ["@leo → You", "$120.00 · settled"],
          ].map(([a, b]) => (
            <div key={a} className="flex items-center justify-between py-1">
              <span className="font-medium text-neutral-700">{a}</span>
              <span className="text-neutral-400 tabular-nums">{b}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
        className={cn("absolute -right-3 -bottom-10 z-20 w-60 rounded-2xl border border-neutral-200 bg-white p-3.5 sm:-right-8", SOFT)}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">Sent to @maya</p>
            <p className="text-xs text-neutral-500 tabular-nums">$45.00 · 0.8s</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -32 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className={cn("absolute -top-8 -left-3 z-20 w-60 rounded-2xl border border-neutral-200 bg-white p-3.5 sm:-left-8", SOFT)}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-aero-50 text-aero-800">
            <Sprout className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">Yield routed</p>
            <p className="text-xs text-neutral-500">Benqi → Trader Joe · best rate</p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Hero() {
  return (
    <section id="top" className="flex min-h-svh items-center bg-white pt-24 pb-20">
      <div className="mx-auto grid w-full max-w-[110rem] items-center gap-16 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3.5 py-1.5 text-[13px] font-medium text-neutral-700">
              <span className="size-1.5 rounded-full bg-aero-800" />
              Live on Avalanche · sub-second finality
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-6 max-w-3xl text-[clamp(2.9rem,6.2vw,5.6rem)] leading-[1.02] font-medium tracking-[-0.025em] text-neutral-900 text-balance"
          >
            Money that moves like a{" "}
            <span className="inline-flex items-center gap-[0.1em] text-aero-800">
              message
              <AeroMark className="size-[0.62em]" />
            </span>
            .
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600"
          >
            Aero is dollars on Avalanche. Send to any @username in under a second, pay real
            bills from the same balance, and let the rest earn yield on its own.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button size="lg" onClick={(e) => goTo(e, "waitlist")} className="h-12 rounded-full bg-aero-800 px-7 text-[15px] font-medium text-white hover:bg-aero-900">
              Claim your @username
              <ArrowRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-1" />
            </Button>
            <Button size="lg" variant="outline" onClick={(e) => goTo(e, "features")} className="h-12 rounded-full border-neutral-300 px-7 text-[15px] font-medium text-neutral-900 hover:bg-neutral-50">
              See how it works
            </Button>
          </motion.div>
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.42 }}
            className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-neutral-200 pt-6"
          >
            {[
              ["<1s", "Settlement time"],
              ["$0", "Gas fees to think about"],
              ["5.31%", "Best APY, right now"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd className="text-[22px] font-medium tracking-tight text-neutral-900 tabular-nums sm:text-[26px]">{v}</dd>
                <dd className="mt-1 text-[13px] text-neutral-500">{l}</dd>
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
  "@priya → @marcus · $88.00 · 0.7s",
  "@you earned +$0.14 in your sleep",
  "@cafe-luna got paid $212.40",
  "Best route: Trader Joe 5.31%",
  "@sofia → @ben · $25.00 · 0.6s",
  "@landlord got rent $1,400.00",
]

function Ticker() {
  const reduce = useReducedMotion()
  return (
    <div className="overflow-hidden border-y border-neutral-200 bg-white py-3 text-neutral-400">
      <div
        className={cn("flex w-max items-center gap-10 pr-10 text-xs whitespace-nowrap tabular-nums", !reduce && "animate-aero-marquee")}
        style={reduce ? undefined : { animationDuration: "48s" }}
      >
        {[...TICKER, ...TICKER].map((t, i) => (
          <span key={i} className="inline-flex items-center gap-10">
            {t}
            <AeroMark className="size-3 text-aero-300" />
          </span>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------- manifesto ------------------------------- */

function Manifesto() {
  return (
    <section className="flex min-h-[80svh] items-center bg-[#f7f7f7] py-24">
      <div className="mx-auto w-full max-w-[110rem] px-5 lg:px-10">
        <Kicker>Why Aero exists</Kicker>
        <RevealWords
          className="mt-6 max-w-5xl text-3xl leading-[1.18] font-medium tracking-[-0.02em] text-neutral-900 text-balance sm:text-5xl"
          text="No wallet addresses. No gas fees to decode. No chains to switch. Just money that arrives in under a second — and quietly grows while you sleep."
        />
        <motion.p {...fadeUp} className="mt-8 font-mono text-[13px] text-neutral-400">
          {"// 80+ Avalanche L1s work underneath via Warp Messaging. You'll never see them."}
        </motion.p>
      </div>
    </section>
  )
}

/* --------------------------------- pillars -------------------------------- */

const PILLARS = [
  {
    icon: Send,
    tag: "Send",
    title: "Pay people, not addresses",
    body: "Type @maya, tap send. USDC settles in under a second — no copied strings, no waiting, no wondering if it arrived.",
  },
  {
    icon: Wallet,
    tag: "Pay",
    title: "One balance for real life",
    body: "Rent, utilities, freelancers — paid straight from Aero. The dollars that earn in the morning buy dinner at night.",
  },
  {
    icon: Sprout,
    tag: "Earn",
    title: "Savings that run themselves",
    body: "An agent routes idle USDC across Benqi and Trader Joe, always chasing the best rate. Withdraw anytime.",
  },
]

function Pillars() {
  return (
    <section id="features" className="scroll-mt-16 bg-white py-24">
      <div className="mx-auto w-full max-w-[110rem] px-5 lg:px-10">
        <SectionHead
          eyebrow="What Aero does"
          title="Send, spend, and grow — from one balance"
          body="Built for people who want digital dollars that simply work, not for crypto natives."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <motion.div key={p.tag} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }}>
              <Card className="h-full gap-0 rounded-[20px] border-neutral-200 p-8 transition duration-300 hover:-translate-y-1 hover:border-aero-200 hover:shadow-[0_20px_50px_-20px_rgba(24,0,173,0.25)]">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-aero-50 text-aero-800">
                  <p.icon className="size-5" />
                </span>
                <p className="mt-6 text-[13px] font-semibold tracking-[0.12em] text-aero-700 uppercase">{p.tag}</p>
                <h3 className="mt-2 text-[22px] leading-snug font-semibold tracking-tight text-neutral-900">{p.title}</h3>
                <p className="mt-2.5 leading-relaxed text-neutral-600">{p.body}</p>
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
    <section id="send" ref={ref} className="flex min-h-svh scroll-mt-16 items-center bg-[#f7f7f7] py-24">
      <div className="mx-auto grid w-full max-w-[110rem] items-center gap-14 px-5 lg:grid-cols-2 lg:px-10">
        <SectionHead
          eyebrow="Send"
          title="If you can tag someone, you can pay them"
          body="No address to copy, no network to pick, no gas setting to look up. This demo actually sends — try it."
        />
        <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.1 }}>
          <Card className={cn("gap-0 rounded-[24px] border-neutral-200 bg-white p-6 sm:p-8", SOFT)}>
            <div className="flex items-center justify-between">
              <p className="text-[17px] font-semibold text-neutral-900">Send USDC</p>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 tabular-nums">Instant · ~0.8s</span>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="send-to" className="text-[13px] font-medium text-neutral-500">To</label>
                <Input id="send-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="@username"
                  className="mt-1.5 h-12 rounded-2xl border-neutral-200 bg-white text-base font-medium text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-aero-800/20" />
              </div>
              <div>
                <label htmlFor="send-amount" className="text-[13px] font-medium text-neutral-500">Amount (USDC)</label>
                <div className="relative mt-1.5">
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 text-[15px] font-medium text-neutral-400">$</span>
                  <Input id="send-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
                    className="h-12 rounded-2xl border-neutral-200 bg-white pr-4 pl-8 text-base font-medium text-neutral-900 tabular-nums placeholder:text-neutral-400 focus-visible:ring-aero-800/20" />
                </div>
              </div>
              <Button onClick={send} disabled={sending}
                className="h-12 w-full rounded-full bg-aero-800 text-[15px] font-medium text-white hover:bg-aero-900">
                {sending ? (
                  <motion.span key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2">
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }} className="inline-block">
                      <Send className="size-4" />
                    </motion.span>
                    Sending…
                  </motion.span>
                ) : (
                  <span className="inline-flex items-center gap-2"><Send className="size-4" /> Send {to || "@someone"}</span>
                )}
              </Button>
            </div>
            <div className="mt-6 border-t border-neutral-100 pt-4 text-sm">
              <AnimatePresence initial={false}>
                {inView && feed.map((f) => (
                  <motion.div key={`${f.to}-${f.amount}`} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between py-1.5">
                    <span className="font-medium text-neutral-700">You → <span className="text-aero-800">{f.to}</span></span>
                    <span className="tabular-nums text-neutral-900">{f.amount} <span className="ml-1 text-[13px] font-medium text-emerald-600">· Settled</span></span>
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
  const inView = useInView(ref, { once: true, margin: "-70px" })
  const apy = useCountUp(5.31, inView)
  const earned = useCountUp(184.27, inView)
  const [auto, setAuto] = useState(true)

  return (
    <section id="earn" ref={ref} className="flex min-h-svh scroll-mt-16 items-center bg-aero-950 py-24 text-white">
      <div className="mx-auto grid w-full max-w-[110rem] items-start gap-14 px-5 lg:grid-cols-[1fr_1fr] lg:px-10">
        <div>
          <motion.div {...fadeUp}>
            <Kicker tone="light">Earn</Kicker>
            <h2 className="mt-4 max-w-md text-4xl font-medium tracking-[-0.02em] text-balance sm:text-5xl">
              Your balance works the night shift
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-white/60">
              Idle USDC is routed across Avalanche DeFi for the best available rate.
              Withdraw anytime — even at 2:41 AM.
            </p>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.1 }} className="mt-10 flex items-end gap-10 border-t border-white/10 pt-8">
            <div>
              <p className="text-[13px] text-white/45">Live best rate</p>
              <p className="mt-1 text-6xl font-medium tracking-tight text-emerald-300 tabular-nums sm:text-7xl">{apy.toFixed(2)}%</p>
              <p className="mt-1.5 text-[13px] text-white/45">APY · auto-routed</p>
            </div>
            <div className="pb-1">
              <p className="text-[13px] text-white/45">Earned to date</p>
              <p className="mt-1 text-3xl font-medium tabular-nums">${earned.toFixed(2)}</p>
              <button type="button" role="switch" aria-checked={auto} onClick={() => setAuto((a) => !a)}
                className="mt-4 inline-flex items-center gap-2.5">
                <span className={cn("relative h-6 w-11 rounded-full transition", auto ? "bg-emerald-400" : "bg-white/15")}>
                  <motion.span layout animate={{ x: auto ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white" />
                </span>
                <span className="text-[13px] font-medium text-white/70">Auto-yield {auto ? "on" : "off"}</span>
              </button>
            </div>
          </motion.div>
        </div>

        <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.15 }}>
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04]">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <p className="text-sm font-medium">Agent routing · live</p>
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-300" /> Optimizing
              </p>
            </div>
            {[
              { rank: "1", name: "Trader Joe", detail: "USDC lending", rate: "5.31%", best: true },
              { rank: "2", name: "Benqi", detail: "USDC supply", rate: "4.92%", best: false },
              { rank: "3", name: "Aero reserve", detail: "Instant liquidity", rate: "0.00%", best: false },
            ].map((r, i) => (
              <motion.div key={r.name} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1, duration: 0.45 }}
                className={cn("flex items-center gap-4 border-b border-white/[0.07] px-6 py-4 last:border-0", r.best && "bg-white/[0.05]")}>
                <span className="text-sm text-white/30 tabular-nums">{r.rank}</span>
                <span className="flex-1">
                  <span className="block text-[15px] font-medium">
                    {r.name}{" "}
                    {r.best && <span className="ml-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">Best rate</span>}
                  </span>
                  <span className="text-xs text-white/40">{r.detail}</span>
                </span>
                <span className={cn("text-xl font-medium tabular-nums", r.best ? "text-emerald-300" : "text-white/55")}>{r.rate}</span>
              </motion.div>
            ))}
            <p className="border-t border-white/10 px-6 py-4 text-[13px] leading-relaxed text-white/45">
              02:41 — the agent moved $1,200 from Benqi to Trader Joe for +0.39%. You were asleep. That&apos;s the point.
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
    <section id="network" className="flex min-h-[80svh] scroll-mt-16 items-center bg-white py-24">
      <div className="mx-auto w-full max-w-[110rem] px-5 lg:px-10">
        <SectionHead
          eyebrow="Under the hood"
          title="Powered by 80+ Avalanche networks. You'll never notice."
          body="A routing layer built on Warp Messaging sends every dollar wherever execution is fastest and yield is highest — then shows you one simple balance."
        />
        <motion.div {...fadeUp} transition={{ duration: 0.55, delay: 0.1 }}
          className="mt-12 flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
          <div className="grid flex-1 grid-cols-2 gap-2.5">
            {["C-Chain", "Benqi L1", "PayFi L1", "DeFi L1"].map((l1, i) => (
              <motion.div key={l1} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className={cn("rounded-full border px-4 py-2.5 text-center text-[13px] font-medium",
                  i < 2 ? "border-aero-200 bg-aero-50 text-aero-800" : "border-neutral-200 text-neutral-400")}>
                {l1}
              </motion.div>
            ))}
          </div>
          <div aria-hidden className="hidden h-px min-w-14 flex-1 text-aero-200 aero-warp-line lg:block" />
          <div className={cn("flex items-center gap-3 rounded-[20px] border border-neutral-200 bg-white px-5 py-4", SOFT)}>
            <BrandIcon className="size-9 rounded-lg text-aero-800" />
            <div>
              <p className="text-[15px] font-semibold text-neutral-900">Aero router</p>
              <p className="text-xs text-neutral-500">Warp Messaging · live</p>
            </div>
          </div>
          <div aria-hidden className="hidden h-px min-w-14 flex-1 text-aero-200 aero-warp-line lg:block" />
          <div className="rounded-[20px] bg-[#f7f7f7] px-5 py-4">
            <p className="text-[13px] text-neutral-500">Best execution</p>
            <p className="mt-0.5 font-mono text-[26px] font-medium text-neutral-900 tabular-nums">0.8s</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ----------------------------------- pay ---------------------------------- */

const BILLS = [
  { id: "rent", initials: "MR", name: "Maple Apartments · rent", detail: "Due May 1", amount: "$1,400.00" },
  { id: "power", initials: "CP", name: "City Power & Light", detail: "Due Apr 28", amount: "$86.20" },
  { id: "designer", initials: "@L", name: "@lena · logo design", detail: "Invoice #042", amount: "$320.00" },
]

function Pay() {
  const [paid, setPaid] = useState<string[]>([])
  const toggle = (id: string) => setPaid((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return (
    <section id="pay" className="flex min-h-svh scroll-mt-16 items-center bg-[#f7f7f7] py-24">
      <div className="mx-auto grid w-full max-w-[110rem] items-center gap-14 px-5 lg:grid-cols-2 lg:px-10">
        <motion.div {...fadeUp} className="order-2 lg:order-1">
          <Card className={cn("gap-0 overflow-hidden rounded-[20px] border-neutral-200 bg-white p-0", SOFT)}>
            <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
              <p className="text-[15px] font-semibold text-neutral-900">Bills · May</p>
              <AeroMark className="size-4 text-aero-800" />
            </div>
            <div className="px-3 py-2">
              <AnimatePresence initial={false}>
                {BILLS.map((b) => {
                  const isPaid = paid.includes(b.id)
                  return (
                    <motion.div key={b.id} layout
                      className="flex items-center gap-4 border-b border-dashed border-neutral-200 px-3 py-4 last:border-0">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                        {b.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-[15px] font-medium text-neutral-900", isPaid && "text-neutral-400 line-through")}>{b.name}</p>
                        <p className="text-xs text-neutral-400">{b.detail}</p>
                      </div>
                      <span className="font-medium text-neutral-900 tabular-nums">{b.amount}</span>
                      {isPaid ? (
                        <motion.span initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-medium text-emerald-700">
                          <Check className="size-3.5" strokeWidth={3} /> Paid
                        </motion.span>
                      ) : (
                        <Button size="sm" onClick={() => toggle(b.id)} className="rounded-full bg-aero-800 px-5 font-medium text-white hover:bg-aero-900">
                          Pay
                        </Button>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
            <div className="bg-aero-50 px-6 py-3.5 text-[13px] font-medium text-aero-800">
              {paid.length === 0
                ? "3 bills due — clear them all in under a minute."
                : paid.length === BILLS.length
                  ? "All clear. Nothing due."
                  : `${BILLS.length - paid.length} to go.`}
            </div>
          </Card>
        </motion.div>
        <div className="order-1 lg:order-2">
          <SectionHead
            eyebrow="Pay"
            title="Your balance pays for real life"
            body="Rent, utilities, freelancers — straight from Aero. The payee doesn't need the app, and every idle dollar keeps earning until the moment it's spent."
          />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------- faq ---------------------------------- */

const FAQS = [
  {
    q: "Do my friends need Aero to receive money?",
    a: "No. Send to anyone — they'll get a link to claim it with a username, or straight to their own wallet. If they're already on Aero, it just lands in under a second.",
  },
  {
    q: "Where does the yield actually come from?",
    a: "Your idle USDC is supplied to established Avalanche lending markets like Benqi and Trader Joe. Aero's agent watches the rates and moves funds to wherever pays best. You never touch any of it.",
  },
  {
    q: "Is my money safe?",
    a: "You stay self-custodied — your keys, your dollars — and funds sit in audited, battle-tested lending markets, never in experimental vaults. Withdraw anytime; liquidity for spending is always reserved first.",
  },
  {
    q: "What can I pay with Aero?",
    a: "Rent, utilities, merchants, and freelancers — anyone with a bill or an invoice. If they don't use Aero, they still get paid in dollars like any normal transfer.",
  },
]

function FAQ() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto w-full max-w-3xl px-5">
        <SectionHead eyebrow="Questions" title="Asked often, answered plainly" />
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="mt-10">
          <Accordion className="border-t border-neutral-200">
            {FAQS.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-b border-neutral-200">
                <AccordionTrigger className="py-5 text-left text-[17px] font-medium text-neutral-900 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-neutral-600">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}

/* ----------------------------------- cta ---------------------------------- */

function CTA() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [savedName, setSavedName] = useState("")

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === "sending") return
    setStatus("sending")
    setMessage("")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setStatus("error")
        setMessage(data.error ?? "Something went wrong. Try again.")
        return
      }
      setSavedName(username.trim().replace(/^@+/, "").toLowerCase())
      setStatus("done")
      setMessage(
        data.emailed
          ? `Confirmation sent to ${email.trim()}.`
          : "You're on the list — email confirmations switch on soon."
      )
    } catch {
      setStatus("error")
      setMessage("Network hiccup. Try again.")
    }
  }

  return (
    <section id="waitlist" className="scroll-mt-16 bg-white px-4 pb-24 sm:px-6">
      <motion.div
        {...fadeUp}
        className="mx-auto max-w-[110rem] rounded-[2.5rem] bg-aero-800 px-6 py-20 text-center text-white sm:px-12"
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex justify-center">
            <BrandWordmark tone="light" height={64} />
          </div>
          <h2 className="mt-8 text-4xl font-medium tracking-[-0.02em] text-balance sm:text-5xl">
            Join the waitlist
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-white/65">
            Reserve your @username and get first access. One email when your invite is ready —
            nothing else, ever.
          </p>
          {status === "done" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mt-8 max-w-md rounded-[20px] bg-white/10 p-8"
            >
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-400 text-aero-950">
                <Check className="size-6" strokeWidth={3} />
              </span>
              <p className="mt-4 text-xl font-medium">You&apos;re on the list{savedName ? `, @${savedName}` : ""}.</p>
              <p className="mt-2 text-[15px] text-white/65">{message}</p>
              <button
                type="button"
                onClick={() => { setStatus("idle"); setMessage("") }}
                className="mt-4 text-sm text-white/60 underline underline-offset-4 hover:text-white"
              >
                Add another email
              </button>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="mx-auto mt-8 max-w-md space-y-2.5">
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@yourname"
                  aria-label="Desired username"
                  autoComplete="username"
                  className="h-12 flex-1 rounded-full border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/40 focus-visible:ring-white/30"
                />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-label="Email address"
                  type="email"
                  autoComplete="email"
                  className="h-12 flex-1 rounded-full border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/40 focus-visible:ring-white/30"
                />
              </div>
              <Button
                type="submit"
                disabled={status === "sending"}
                className="h-12 w-full rounded-full bg-white px-7 text-[15px] font-medium text-aero-900 hover:bg-aero-50 disabled:opacity-70"
              >
                {status === "sending" ? "Joining…" : (
                  <>Join the waitlist <ArrowRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-1" /></>
                )}
              </Button>
              {status === "error" && (
                <p role="alert" className="pt-1 text-sm font-medium text-amber-200">{message}</p>
              )}
              <p className="pt-1 text-[13px] text-white/50">No wallet needed. No spam, ever.</p>
            </form>
          )}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-white/15 pt-8 text-sm text-white/60">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4" /> Self-custodied</span>
            <span className="inline-flex items-center gap-2"><Zap className="size-4" /> Sub-second settlement</span>
            <span className="inline-flex items-center gap-2"><Sprout className="size-4" /> Withdraw anytime</span>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
/* ---------------------------------- footer -------------------------------- */

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto grid w-full max-w-[110rem] gap-10 px-5 py-14 md:grid-cols-[1.2fr_1fr_1fr] lg:px-10">
        <div>
          <BrandLockup tone="dark" height={28} />
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-neutral-500">
            Consumer payments on Avalanche. Send, pay, earn — without the crypto homework.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-[15px]">
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-neutral-400">Product</p>
            <a href="#send" onClick={(e) => goTo(e, "send")} className="block text-neutral-600 hover:text-neutral-950">Send</a>
            <a href="#pay" onClick={(e) => goTo(e, "pay")} className="block text-neutral-600 hover:text-neutral-950">Pay</a>
            <a href="#earn" onClick={(e) => goTo(e, "earn")} className="block text-neutral-600 hover:text-neutral-950">Earn</a>
          </div>
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-neutral-400">Company</p>
            <a href="#network" onClick={(e) => goTo(e, "network")} className="block text-neutral-600 hover:text-neutral-950">Network</a>
            <a href="#waitlist" onClick={(e) => goTo(e, "waitlist")} className="block text-neutral-600 hover:text-neutral-950">Early access</a>
            <a href="/docs" className="block text-neutral-600 hover:text-neutral-950">Docs</a>
          </div>
        </div>
        <div className="space-y-3 text-[15px]">
          <p className="text-[13px] font-medium text-neutral-400">Legal</p>
          <a href="/privacy" className="block text-neutral-600 hover:text-neutral-950">Privacy</a>
          <a href="/terms" className="block text-neutral-600 hover:text-neutral-950">Terms</a>
        </div>
      </div>
      <div className="border-t border-neutral-100">
        <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center justify-between gap-2 px-5 py-5 text-[13px] text-neutral-400 lg:px-10">
          <span>© 2026 Aero</span>
          <span>Built on Avalanche · USDC</span>
        </div>
      </div>
    </footer>
  )
}

/* ---------------------------------- export --------------------------------- */

export default function AeroLanding() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white font-sans text-neutral-900 antialiased [-webkit-tap-highlight-color:transparent]">
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
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
