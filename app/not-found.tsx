import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { BrandIcon } from "@/components/aero/brand-logo"
import { AeroMark } from "@/components/aero/logo"

export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-white px-5 text-center">
      <AeroMark
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 text-aero-50"
      />
      <div className="relative">
        <span className="inline-flex size-16 items-center justify-center overflow-hidden rounded-3xl bg-aero-800 shadow-xl shadow-aero-800/25">
          <BrandIcon className="size-9 rounded-md text-white" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-widest text-aero-700 uppercase">
          Lost in transit
        </p>
        <h1 className="mt-2 text-8xl font-extrabold tracking-tight text-neutral-950">
          404
        </h1>
        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-neutral-600">
          This route settled nowhere. Your money is safe — only this page is
          missing.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-aero-800 px-6 font-semibold text-white transition hover:bg-aero-900"
          >
            <ArrowLeft className="size-4" />
            Back home
          </Link>
          <Link
            href="/#top"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-neutral-300 px-6 font-semibold text-neutral-900 transition hover:border-aero-300 hover:text-aero-800"
          >
            Claim @username
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
