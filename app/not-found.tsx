import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"
import { BrandIcon } from "@/components/aero/brand-logo"

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-white px-5 text-center">
      <BrandIcon className="size-14 rounded-2xl text-aero-800" />
      <p className="mt-8 text-[13px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
        Lost in transit
      </p>
      <h1 className="mt-3 text-7xl font-medium tracking-[-0.02em] text-neutral-900">404</h1>
      <p className="mx-auto mt-4 max-w-sm leading-relaxed text-neutral-600">
        This page settled nowhere. Your money is safe — only this route is missing.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-aero-800 px-6 text-[15px] font-medium text-white transition hover:bg-aero-900"
        >
          <ArrowLeft className="size-4" />
          Back home
        </Link>
        <Link
          href="/#top"
          className="inline-flex h-12 items-center gap-2 rounded-full border border-neutral-300 px-6 text-[15px] font-medium text-neutral-900 transition hover:bg-neutral-50"
        >
          Claim @username
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
