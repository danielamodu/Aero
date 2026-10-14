import type { Metadata } from "next"
import Link from "next/link"
import { Check } from "lucide-react"
import { BrandIcon } from "@/components/aero/brand-logo"

export const metadata: Metadata = {
  title: "Confirmed — Aero",
  description: "Your Aero waitlist spot is confirmed.",
  robots: { index: false, follow: false },
}

export default async function ConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; error?: string }>
}) {
  const { user, error } = await searchParams
  const failed = error === "1"

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-white px-5 text-center font-sans antialiased">
      <BrandIcon className="size-14 rounded-2xl text-aero-800" />
      {failed ? (
        <>
          <h1 className="mt-8 max-w-md text-4xl font-medium tracking-[-0.02em] text-neutral-900 text-balance">
            That link didn&apos;t check out
          </h1>
          <p className="mx-auto mt-4 max-w-sm leading-relaxed text-neutral-600">
            Confirmation links are tied to the exact email and username. Try signing up again
            and use the newest email.
          </p>
          <Link
            href="/#waitlist"
            className="mt-8 inline-flex h-12 items-center rounded-full bg-aero-800 px-7 text-[15px] font-medium text-white transition hover:bg-aero-900"
          >
            Back to the waitlist
          </Link>
        </>
      ) : (
        <>
          <span className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-7" strokeWidth={3} />
          </span>
          <h1 className="mt-6 max-w-md text-4xl font-medium tracking-[-0.02em] text-neutral-900 text-balance">
            You&apos;re confirmed{user ? `, ${user}` : ""}.
          </h1>
          <p className="mx-auto mt-4 max-w-sm leading-relaxed text-neutral-600">
            Your handle is locked in. We&apos;ll email you the moment your invite is ready.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex h-12 items-center rounded-full border border-neutral-300 px-7 text-[15px] font-medium text-neutral-900 transition hover:bg-neutral-50"
          >
            Back home
          </Link>
        </>
      )}
    </div>
  )
}
