import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { BrandLockup } from "@/components/aero/brand-logo"

export const metadata: Metadata = {
  title: "Pay with Aero",
  description: "Someone requested money via Aero. Pay any @username in seconds.",
}

function validHandle(h: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(h)
}

function validAmount(a: string | undefined): string | null {
  if (!a) return null
  const n = Number(a)
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function PayHandlePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ amount?: string }>
}) {
  const { handle: raw } = await params
  const { amount: amountRaw } = await searchParams
  const handle = raw.toLowerCase()
  if (!validHandle(handle)) notFound()
  const amount = validAmount(amountRaw)

  const appUrl =
    `https://testnet.useaero.org?to=${encodeURIComponent(`@${handle}`)}` +
    (amountRaw && validAmount(amountRaw) ? `&amount=${encodeURIComponent(amountRaw)}` : "")

  return (
    <div className="flex min-h-svh flex-col bg-white font-sans text-neutral-900 antialiased">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-16 w-full max-w-[110rem] items-center px-5 lg:px-10">
          <Link href="/" aria-label="Aero home">
            <BrandLockup tone="dark" height={28} />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-aero-800 font-mono text-2xl font-bold text-white">
            {handle.slice(0, 1).toUpperCase()}
          </span>
          <h1 className="mt-6 text-4xl font-medium tracking-[-0.02em] text-balance">
            @{handle} {amount ? `is requesting $${amount}` : "wants to get paid"}
          </h1>
          <p className="mx-auto mt-3 max-w-sm leading-relaxed text-neutral-600">
            {amount
              ? "One tap and it's settled in under a second — no addresses, no gas confusion."
              : "Pick an amount and settle up in under a second — no addresses, no gas confusion."}
          </p>
          <a
            href={appUrl}
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-aero-800 px-8 text-[15px] font-medium text-white transition hover:bg-aero-900"
          >
            Pay with Aero <ArrowRight className="size-4" />
          </a>
          <p className="mt-4 text-[13px] text-neutral-400">
            Testnet · Fuji play money ·{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-neutral-600">
              What is Aero?
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
