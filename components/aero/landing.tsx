"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"

declare global {
  interface Window {
    plausible?: (event: string) => void
  }
}
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react"
import {
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Check,
  FlaskConical,
  Menu,
  ReceiptText,
  Route,
  Send,
  Sprout,
  X,
} from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { BrandLockup, BrandWordmark } from "@/components/aero/brand-logo"

/* ---------------------------------- atoms --------------------------------- */

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-70px" },
} as const

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

function Eyebrow({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "white" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase",
        tone === "blue" ? "bg-aero-50 text-aero-800" : "border border-white/25 bg-white/10 text-white"
      )}
    >
      <span className={cn("size-1.5 rounded-full", tone === "blue" ? "bg-aero-800" : "bg-white")} />
      {children}
    </span>
  )
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  const menuGo = (id: string) => (e: { preventDefault: () => void }) => {
    goTo(e, id)
    setMenuOpen(false)
  }
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 transition-all duration-300 sm:px-5",
          scrolled
            ? "mt-3 rounded-full border border-neutral-200/80 bg-white/70 shadow-[0_12px_40px_-16px_rgba(11,0,78,0.25)] backdrop-blur-xl"
            : "mt-0 border border-transparent bg-transparent"
        )}
      >
        <a href="#top" aria-label="Aero home" onClick={(e) => goTo(e, "top")}>
          <BrandLockup tone="dark" height={24} />
        </a>
        <nav className="hidden items-center gap-7 text-sm font-medium text-neutral-600 md:flex">
          <a href="#how" onClick={(e) => goTo(e, "how")} className="transition hover:text-neutral-950">How it works</a>
          <a href="#features" onClick={(e) => goTo(e, "features")} className="transition hover:text-neutral-950">Features</a>
          <a href="#faq" onClick={(e) => goTo(e, "faq")} className="transition hover:text-neutral-950">FAQ</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            onClick={(e) => goTo(e, "waitlist")}
            className="h-10 rounded-full bg-aero-800 px-5 text-sm font-medium text-white hover:bg-aero-900"
          >
            Get early access
            <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/button:translate-x-0.5 group-hover/button:-translate-y-0.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="h-10 w-10 rounded-full text-neutral-900 hover:bg-neutral-100 md:hidden"
          >
            <Menu className="size-5" />
          </Button>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="right" className="w-72 border-neutral-200 bg-white p-6">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="mt-10 flex flex-col gap-1">
              {[
                ["How it works", "how"],
                ["Features", "features"],
                ["FAQ", "faq"],
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

/* ------------------------------- phone mock ------------------------------- */

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-[250px] shrink-0 rounded-[2.4rem] border border-white/25 bg-white/95 p-2 shadow-[0_30px_60px_rgba(0,0,0,0.25)] backdrop-blur sm:w-[270px]">
      <div className="overflow-hidden rounded-[1.9rem] bg-white">
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="font-mono text-[10px] font-bold text-neutral-900">9:41</span>
          <span className="h-4 w-16 rounded-full bg-neutral-900" />
          <span className="flex gap-1">
            <span className="size-1 rounded-full bg-neutral-900" />
            <span className="size-1 rounded-full bg-neutral-900" />
            <span className="size-1 rounded-full bg-neutral-300" />
          </span>
        </div>
        <div className="px-4 pt-3 pb-5">{children}</div>
      </div>
    </div>
  )
}

function PhoneHome() {
  return (
    <PhoneShell>
      <p className="text-[11px] font-semibold text-neutral-900">@you</p>
      <p className="mt-0.5 font-mono text-[26px] leading-none font-medium tracking-tight text-neutral-900 tabular-nums">
        $2,480.42
      </p>
      <p className="mt-1 text-[10px] font-medium text-emerald-600">+$3.41 this week · automatic</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <span className="rounded-full bg-aero-800 py-2 text-center text-[11px] font-semibold text-white">Send</span>
        <span className="rounded-full border border-neutral-200 py-2 text-center text-[11px] font-semibold text-neutral-900">Pay bill</span>
      </div>
      <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-2.5 text-[10px]">
        {[
          ["You → @maya", "$45.00"],
          ["@leo → You", "$120.00"],
          ["Yield routed", "+$0.14"],
        ].map(([a, b]) => (
          <div key={a} className="flex items-center justify-between">
            <span className="font-medium text-neutral-700">{a}</span>
            <span className="font-mono text-neutral-500 tabular-nums">{b}</span>
          </div>
        ))}
      </div>
    </PhoneShell>
  )
}

function PhoneEarn() {
  return (
    <PhoneShell>
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        <span className="size-1 rounded-full bg-emerald-500" /> Earning 5.24%
      </span>
      <p className="mt-2 font-mono text-[26px] leading-none font-medium tracking-tight text-neutral-900 tabular-nums">
        $184.27
      </p>
      <p className="mt-1 text-[10px] text-neutral-400">earned to date</p>
      <div className="mt-3 flex h-16 items-end gap-1">
        {[35, 45, 40, 55, 50, 65, 60, 75, 70, 88].map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className={cn("flex-1 rounded-sm", i >= 8 ? "bg-aero-800" : "bg-aero-100")}
          />
        ))}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-2.5 text-[10px]">
        {[
          ["Trader Joe", "5.31%"],
          ["Benqi", "4.92%"],
        ].map(([a, b]) => (
          <div key={a} className="flex items-center justify-between">
            <span className="font-medium text-neutral-700">{a}</span>
            <span className="font-mono font-bold text-emerald-600 tabular-nums">{b}</span>
          </div>
        ))}
      </div>
    </PhoneShell>
  )
}

/* ----------------------------------- hero --------------------------------- */

function Hero() {
  const reduce = useReducedMotion()

  return (
    <section id="top" className="relative overflow-hidden bg-[#bcd7f0] pt-32 text-neutral-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/hero-sky.jpg)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent via-white/50 to-white"
      />

      <div className="relative mx-auto max-w-4xl px-5 pb-20 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mx-auto mt-6 max-w-3xl font-semibold text-[clamp(2.9rem,7vw,5.2rem)] leading-[1.04] tracking-[-0.01em] text-balance"
        >
          Money that moves like a message.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-neutral-600"
        >
          Send dollars to any @username in under a second, pay real bills from the same
          balance, and let the rest earn while you sleep.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28 }}
          className="mt-8 flex justify-center"
        >
          <a
            href="https://testnet.useaero.org"
            className="inline-flex h-13 items-center gap-2 rounded-full bg-neutral-900 px-8 text-[15px] font-medium text-white transition hover:bg-neutral-800"
          >
            Try the testnet <ArrowRight className="size-4" />
          </a>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.42 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 font-mono text-xs text-neutral-600 tabular-nums"
        >
          <span>&lt;1s finality</span>
          <span>$0 gas confusion</span>
        </motion.div>

        <div className="mt-14 flex items-end justify-center gap-5 sm:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 60, rotate: -7 }}
            animate={{ opacity: 1, y: 0, rotate: -5 }}
            transition={{ duration: 0.8, delay: 0.35 }}
            className={cn(!reduce && "animate-aero-float")}
          >
            <PhoneHome />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 60, rotate: 7 }}
            animate={{ opacity: 1, y: 0, rotate: 4 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className={cn("hidden sm:block", !reduce && "animate-aero-float")}
            style={{ animationDelay: "1.4s" }}
          >
            <PhoneEarn />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- intro ---------------------------------- */

function Intro() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-10">
        <motion.div {...fadeUp}>
          <Eyebrow>Why Aero exists</Eyebrow>
        </motion.div>
        <div>
          <RevealWords
            className="text-2xl leading-[1.25] font-medium tracking-[-0.015em] text-neutral-900 text-balance sm:text-[2rem]"
            text="No wallet addresses. No gas fees to decode. No chains to switch. Just money that arrives in under a second — and quietly grows while you sleep."
          />
          <motion.p {...fadeUp} className="mt-6 font-mono text-[13px] text-neutral-400">
            {"// 80+ Avalanche networks hum underneath. You'll never see them."}
          </motion.p>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------- how it works ------------------------------ */

const STEPS = [
  {
    n: "01",
    title: "Claim your @username",
    body: "Free, first-come, first-served. It becomes your address, your payment link, and your identity in one.",
    chip: "@you",
  },
  {
    n: "02",
    title: "Move money in a tap",
    body: "Send to any handle or pay any bill. Settlement finalizes on Avalanche in under a second.",
    chip: "$45.00 → @maya · 0.8s",
  },
  {
    n: "03",
    title: "Let the rest earn",
    body: "Idle USDC routes across Benqi and Trader Joe for the best live rate. Withdraw anytime.",
    chip: "+5.31% APY · auto",
  },
]

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-[#f7f7f7] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-10">
        <motion.div {...fadeUp} className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 font-semibold text-[clamp(1.9rem,4vw,3.1rem)] leading-[1.08] tracking-[-0.01em] text-neutral-900 text-balance">
            Three steps. Zero crypto homework.
          </h2>
        </motion.div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group rounded-[20px] border border-neutral-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(24,0,173,0.25)]"
            >
              <p className="font-mono text-sm font-bold text-aero-800 tabular-nums">{s.n}</p>
              <h3 className="mt-3 text-[22px] leading-snug font-medium tracking-tight text-neutral-900">{s.title}</h3>
              <p className="mt-2.5 leading-relaxed text-neutral-600">{s.body}</p>
              <p className="mt-5 inline-block rounded-full bg-aero-50 px-3.5 py-1.5 font-mono text-xs font-bold text-aero-800 tabular-nums">
                {s.chip}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------ integrations ------------------------------ */

const INTEGRATIONS: {
  label: string
  short: string
  size: number
  x: string
  y: string
  dx: string
  dy: string
  img?: string
  dashed?: boolean
}[] = [
  { label: "Avalanche", short: "AVAX", size: 72, x: "50%", y: "0%", dx: "-50%", dy: "0%", img: "/partners/avax.png" },
  { label: "Benqi", short: "B", size: 68, x: "7%", y: "50%", dx: "-50%", dy: "-50%", img: "/partners/benqi.jpg" },
  { label: "USDC", short: "$", size: 64, x: "93%", y: "50%", dx: "-50%", dy: "-50%", img: "/partners/usdc.png" },
  { label: "More soon", short: "+", size: 56, x: "50%", y: "100%", dx: "-50%", dy: "-100%", dashed: true },
]

function PartnerMark({
  label,
  short,
  size,
  img,
  dashed,
  delay = 0,
}: {
  label: string
  short: string
  size: number
  img?: string
  dashed?: boolean
  delay?: number
}) {
  return (
    <span
      title={label}
      style={{ width: size, height: size, animationDelay: `${delay}s` }}
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full animate-aero-float",
        dashed
          ? "border-2 border-dashed border-neutral-300 text-sm font-bold text-neutral-400"
          : "border border-neutral-200 bg-white shadow-[0_10px_30px_-12px_rgba(11,0,78,0.2)]"
      )}
    >
      {img ? (
        <Image src={img} alt={label} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-aero-900">{short}</span>
      )}
    </span>
  )
}

function Integrations() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-10">
        <div className="relative mx-auto hidden max-w-4xl md:block" style={{ height: 440 }}>
          <div aria-hidden className="absolute top-1/2 left-1/2 h-[340px] w-[min(92%,700px)] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-neutral-200" />
          {INTEGRATIONS.map((b, i) => (
            <motion.span
              key={b.label}
              initial={{ opacity: 0, scale: 0.7 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              title={b.label}
              style={{ left: b.x, top: b.y, transform: `translate(${b.dx}, ${b.dy})` }}
              className="absolute flex flex-col items-center gap-1.5"
            >
              <span
                style={{ width: b.size, height: b.size }}
                className="flex items-center justify-center"
              >
                <PartnerMark label={b.label} short={b.short} size={b.size} img={b.img} dashed={b.dashed} delay={i * 0.8} />
              </span>
              <span className="text-[11px] font-medium whitespace-nowrap text-neutral-400">{b.label}</span>
            </motion.span>
          ))}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8 text-center">
            <h2 className="max-w-sm font-semibold text-[clamp(1.9rem,4vw,3rem)] leading-[1.08] text-neutral-900 text-balance">
              Riding rails you already trust.
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-neutral-500">
              Settlement, yield, and messaging — plugged into the best of Avalanche, so you never think about chains.
            </p>
            <Button
              onClick={(e) => goTo(e, "waitlist")}
              className="mt-6 h-11 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Get early access <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="md:hidden">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-semibold text-4xl leading-[1.08] text-neutral-900 text-balance">
              Riding rails you already trust.
            </h2>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {INTEGRATIONS.map((b) => (
              <span key={b.label} className="flex flex-col items-center gap-1.5">
                <PartnerMark label={b.label} short={b.short} size={56} img={b.img} dashed={b.dashed} />
                <span className="text-[10px] font-medium text-neutral-400">{b.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------- bento --------------------------------- */

function MiniSend() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-neutral-900">
            You → <span className="text-aero-800">@maya</span>
          </p>
          <p className="font-mono text-xs text-neutral-400 tabular-nums">settled in 0.8s</p>
        </div>
        <span className="shrink-0 font-mono text-lg font-medium tabular-nums">$45.00</span>
      </div>
      <div className="mt-3 h-11 rounded-full bg-aero-800 text-center text-sm leading-11 font-medium text-white">
        Sent
      </div>
    </div>
  )
}

function MiniEarnBars() {
  return (
    <div className="flex h-20 items-end gap-1.5">
      {[30, 42, 38, 55, 50, 68, 62, 80, 76, 92].map((h, i) => (
        <span key={i} style={{ height: `${h}%` }} className={cn("flex-1 rounded-sm", i >= 8 ? "bg-emerald-300" : "bg-white/20")} />
      ))}
    </div>
  )
}

const BENTO_SMALL = [
  {
    icon: ReceiptText,
    label: "Pay",
    title: "Bills pay themselves-ish",
    body: "Rent, power, freelancers — straight from your balance. The payee never touches crypto.",
  },
  {
    icon: Route,
    label: "Routing",
    title: "Always the best rate",
    body: "An agent watches Benqi and Trader Joe around the clock and moves funds when it matters.",
  },
  {
    icon: AtSign,
    label: "Usernames",
    title: "Your money's @handle",
    body: "Claim it free, keep it forever. No addresses to copy, ever.",
  },
  {
    icon: FlaskConical,
    label: "Testnet",
    title: "Try it on Fuji first",
    body: "Play money, real rails. Claim 10,000 test dollars and run the whole loop today.",
    href: "https://testnet.useaero.org",
  },
]

function Bento() {
  return (
    <section id="features" className="scroll-mt-20 bg-[#f7f7f7] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-end">
          <motion.div {...fadeUp}>
            <Eyebrow>Features</Eyebrow>
            <h2 className="mt-4 max-w-xl font-semibold text-[clamp(1.9rem,4vw,3.1rem)] leading-[1.08] tracking-[-0.01em] text-neutral-900 text-balance">
              Everything money should do, in one balance.
            </h2>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="font-mono text-2xl font-medium tabular-nums">&lt;1s</p>
              <p className="mt-1 text-sm text-neutral-500">Avalanche finality on every send</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <p className="font-mono text-2xl font-medium text-emerald-600 tabular-nums">5.31%</p>
              <p className="mt-1 text-sm text-neutral-500">Best live APY, auto-routed</p>
            </div>
          </motion.div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          <motion.div {...fadeUp} className="rounded-[20px] border border-neutral-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(24,0,173,0.25)] sm:p-8 lg:col-span-2">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-aero-50 text-aero-800">
              <Send className="size-5" />
            </span>
            <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-aero-700 uppercase">Send</p>
            <h3 className="mt-2 text-2xl font-medium tracking-tight text-neutral-900">If you can tag someone, you can pay them.</h3>
            <p className="mt-2 max-w-md leading-relaxed text-neutral-600">Type @maya, hit send. No 0x strings, no waiting, no “did it go through?”</p>
            <div className="mt-6 max-w-md"><MiniSend /></div>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.08 }} className="rounded-[20px] bg-aero-950 p-7 text-white transition duration-300 hover:-translate-y-1 sm:p-8 lg:row-span-2">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <Sprout className="size-5" />
            </span>
            <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-white/50 uppercase">Earn</p>
            <h3 className="mt-2 text-2xl font-medium tracking-tight">Your balance works nights.</h3>
            <p className="mt-2 font-mono text-5xl font-medium tracking-tight text-emerald-300 tabular-nums">5.31%</p>
            <div className="mt-5"><MiniEarnBars /></div>
            <p className="mt-5 text-[15px] leading-relaxed text-white/60">
              2:41 AM — the agent moved $1,200 to Trader Joe for +0.39%. You were asleep. That&apos;s the point.
            </p>
          </motion.div>

          {BENTO_SMALL.slice(0, 2).map((c, i) => (
            <BentoCard key={c.label} icon={c.icon} label={c.label} title={c.title} body={c.body} delay={0.05 * (i + 1)} />
          ))}

          <motion.a
            href="https://testnet.useaero.org"
            {...fadeUp}
            className="group rounded-[20px] border border-neutral-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:border-aero-200 hover:shadow-[0_20px_50px_-20px_rgba(24,0,173,0.25)] sm:p-8 lg:col-span-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-aero-50 text-aero-800">
                  <FlaskConical className="size-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-aero-700 uppercase">Testnet</p>
                  <h3 className="mt-1 text-2xl font-medium tracking-tight text-neutral-900">Run the whole loop on Fuji today.</h3>
                </div>
              </div>
              <span className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition group-hover:bg-aero-800">
                Open testnet <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </motion.a>
          <BentoCard icon={AtSign} label="Usernames" title="Your money's @handle" body="Claim it free, keep it forever. No addresses to copy, ever." delay={0.1} />
        </div>
      </div>
    </section>
  )
}

function BentoCard({
  icon: Icon,
  label,
  title,
  body,
  delay = 0,
}: {
  icon: typeof Send
  label: string
  title: string
  body: string
  delay?: number
}) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.5, delay }}
      className="rounded-[20px] border border-neutral-200 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-20px_rgba(24,0,173,0.25)] sm:p-8"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-aero-50 text-aero-800">
        <Icon className="size-5" />
      </span>
      <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-aero-700 uppercase">{label}</p>
      <h3 className="mt-2 text-2xl font-medium tracking-tight text-neutral-900">{title}</h3>
      <p className="mt-2 leading-relaxed text-neutral-600">{body}</p>
    </motion.div>
  )
}

/* ----------------------------------- cta ---------------------------------- */

function CTA() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState(() => {
    try {
      return window.localStorage.getItem("aero_email_prefill") ?? ""
    } catch {
      return ""
    }
  })
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [savedName, setSavedName] = useState("")
  const [position, setPosition] = useState<number | null>(null)
  const [myCode, setMyCode] = useState("")
  const [already, setAlready] = useState(false)
  const [referrals, setReferrals] = useState(0)
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    const link = `https://useaero.org?ref=${myCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (status === "sending") return
    setStatus("sending")
    setMessage("")
    let referredBy: string | null = null
    try {
      referredBy = window.localStorage.getItem("aero_ref")
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, referred_by: referredBy }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setStatus("error")
        setMessage(data.error ?? "Something went wrong. Try again.")
        return
      }
      setSavedName(username.trim().replace(/^@+/, "").toLowerCase())
      setPosition(typeof data.position === "number" ? data.position : null)
      setMyCode(typeof data.referral_code === "string" ? data.referral_code : "")
      setAlready(!!data.already)
      setReferrals(typeof data.referrals === "number" ? data.referrals : 0)
      setStatus("done")
      window.plausible?.("waitlist-signup")
      setMessage(
        data.emailed
          ? `Confirmation link sent to ${email.trim()} — tap it to lock in your handle.`
          : "You're on the list — email confirmations switch on soon."
      )
    } catch {
      setStatus("error")
      setMessage("Network hiccup. Try again.")
    }
  }

  return (
    <section id="waitlist" className="scroll-mt-20 bg-white px-4 pt-4 pb-24 sm:px-6">
      <motion.div
        {...fadeUp}
        className="mx-auto max-w-[110rem] overflow-hidden rounded-[2.5rem] bg-aero-800 px-6 py-20 text-center text-white sm:px-12"
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex justify-center">
            <BrandWordmark tone="light" height={64} />
          </div>
          <h2 className="mt-8 font-semibold text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.05] text-balance">
            Claim your @username
          </h2>
          <p className="mx-auto mt-4 max-w-md text-lg text-white/65">
            One handle for sending, getting paid, and growing. Free to reserve, yours to keep.
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
              <p className="mt-4 text-xl font-medium">
                {already ? "You're already on the list" : "You're on the list"}
                {savedName ? `, @${savedName}` : ""}.
                {position ? (
                  <span className="mt-1 block font-mono text-base text-white/80 tabular-nums">#{position} in line</span>
                ) : null}
              </p>
              <p className="mt-2 text-[15px] text-white/65">{message}</p>
              {myCode ? (
                <div className="mx-auto mt-5 flex max-w-sm items-center gap-2 rounded-full border border-white/25 bg-white/10 py-1.5 pr-1.5 pl-5">
                  <span className="flex-1 truncate text-left font-mono text-sm text-white tabular-nums">
                    useaero.org?ref={myCode}
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-aero-900 transition hover:bg-aero-50"
                  >
                    {copied ? (
                      <><Check className="size-3.5" strokeWidth={3} /> Copied</>
                    ) : (
                      "Copy invite link"
                    )}
                  </button>
                </div>
              ) : null}
              <p className="mt-3 text-[13px] text-white/50">
                {referrals > 0
                  ? `${referrals} friend${referrals === 1 ? "" : "s"} joined through your link — you've moved up ${referrals} spot${referrals === 1 ? "" : "s"} already.`
                  : "Friends who join through your link move you up the line."}
              </p>
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
                  className="h-13 flex-1 rounded-full border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/40 focus-visible:ring-white/30"
                />
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  aria-label="Email address"
                  type="email"
                  autoComplete="email"
                  className="h-13 flex-1 rounded-full border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/40 focus-visible:ring-white/30"
                />
              </div>
              <Button
                type="submit"
                disabled={status === "sending"}
                className="h-13 w-full rounded-full bg-white px-7 text-base font-medium text-aero-900 hover:bg-aero-50 disabled:opacity-70"
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
            <span className="inline-flex items-center gap-2"><Check className="size-4" strokeWidth={3} /> Self-custodied</span>
            <span className="inline-flex items-center gap-2"><Check className="size-4" strokeWidth={3} /> Sub-second settlement</span>
            <span className="inline-flex items-center gap-2"><Check className="size-4" strokeWidth={3} /> Withdraw anytime</span>
          </div>
        </div>
      </motion.div>
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
    <section id="faq" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-10">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <motion.div {...fadeUp}>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="mt-4 font-semibold text-[clamp(1.9rem,4vw,3rem)] leading-[1.08] text-neutral-900 text-balance">
              Asked often, answered plainly.
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed text-neutral-600">
              Anything else on your mind? A human replies — usually within a day.
            </p>
            <a
              href="mailto:support@useaero.org"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition hover:bg-aero-800"
            >
              Talk to us <ArrowUpRight className="size-4" />
            </a>
          </motion.div>
        </div>
        <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
          <Accordion className="space-y-3">
            {FAQS.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="rounded-2xl border border-neutral-200 bg-white px-6">
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

/* ---------------------------------- footer -------------------------------- */

export function Footer() {
  return (
    <footer className="overflow-hidden bg-[#f7f7f7]">
      <div className="mx-auto w-full max-w-6xl px-5 pt-14 lg:px-10">
        <div className="grid gap-10 pb-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <BrandLockup tone="dark" height={28} />
            <p className="mt-4 max-w-xs font-sans text-[15px] leading-relaxed text-neutral-500">
              Consumer payments on Avalanche. Send, pay, earn — without the crypto homework.
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <a
                href="https://x.com/aeroxbx"
                target="_blank"
                rel="noreferrer"
                aria-label="Aero on X"
                className="flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-aero-800 hover:text-aero-800"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
                </svg>
              </a>
              <a
                href="https://github.com/danielamodu/Aero"
                target="_blank"
                rel="noreferrer"
                aria-label="Aero on GitHub"
                className="flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-aero-800 hover:text-aero-800"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[18px]">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 text-[15px]">
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-neutral-400">Product</p>
              <a href="#how" onClick={(e) => goTo(e, "how")} className="block text-neutral-600 hover:text-neutral-950">How it works</a>
              <a href="#features" onClick={(e) => goTo(e, "features")} className="block text-neutral-600 hover:text-neutral-950">Features</a>
              <a href="#faq" onClick={(e) => goTo(e, "faq")} className="block text-neutral-600 hover:text-neutral-950">FAQ</a>
              <a href="/docs" className="block text-neutral-600 hover:text-neutral-950">Docs</a>
            </div>
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-neutral-400">Company</p>
              <a href="#waitlist" onClick={(e) => goTo(e, "waitlist")} className="block text-neutral-600 hover:text-neutral-950">Early access</a>
              <a href="https://testnet.useaero.org" className="block text-neutral-600 hover:text-neutral-950">Testnet</a>
            </div>
          </div>
          <div className="space-y-3 text-[15px]">
            <p className="text-[13px] font-medium text-neutral-400">Legal</p>
            <a href="/privacy" className="block text-neutral-600 hover:text-neutral-950">Privacy</a>
            <a href="/terms" className="block text-neutral-600 hover:text-neutral-950">Terms</a>
          </div>
        </div>
      </div>
      <div aria-hidden className="select-none overflow-hidden">
        <p className="bg-gradient-to-b from-neutral-900 to-neutral-300 bg-clip-text text-center text-[27vw] leading-[0.82] font-extrabold tracking-[-0.04em] text-transparent">
          AERO
        </p>
        <div className="-mt-[0.24em] border-t border-neutral-200 bg-[#f7f7f7]">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-[13px] text-neutral-400 lg:px-10">
            <span>© 2026 Aero</span>
            <span>Built on Avalanche · USDC</span>
          </div>
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
        <Intro />
        <HowItWorks />
        <Integrations />
        <Bento />
        <CTA />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
