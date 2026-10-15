import type { Metadata } from "next"
import { cookies } from "next/headers"
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/admin-auth"
import { readSignups } from "@/lib/waitlist-store"
import { storeKind } from "@/lib/db"
import { AdminLogin, AdminLogout } from "@/components/aero/admin-login"
import { AdminRowActions } from "@/components/aero/admin-actions"
import { BrandLockup } from "@/components/aero/brand-logo"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Admin — Aero",
  robots: { index: false, follow: false },
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const authed = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)

  if (!authed) {
    return (
      <div className="flex min-h-svh flex-col bg-white font-sans antialiased">
        <header className="border-b border-neutral-200">
          <div className="mx-auto flex h-16 w-full max-w-[110rem] items-center px-5 lg:px-10">
            <a href="/" aria-label="Aero home">
              <BrandLockup tone="dark" height={28} />
            </a>
          </div>
        </header>
        <main className="flex-1">
          <AdminLogin />
        </main>
      </div>
    )
  }

  const { q = "", status = "all" } = await searchParams
  const query = q.trim().toLowerCase()
  const all = await readSignups()
  const signups = all.filter((s) => {
    if (status === "confirmed" && !s.confirmed) return false
    if (status === "pending" && s.confirmed) return false
    if (query && !s.email.includes(query) && !s.username.includes(query)) return false
    return true
  })

  const confirmed = all.filter((s) => s.confirmed).length
  const referrals = all.reduce((n, s) => n + s.referrals, 0)
  const rate = all.length ? Math.round((confirmed / all.length) * 100) : 0
  const store = storeKind()

  const tab = (value: string, label: string) => (
    <a
      key={value}
      href={`/admin${value === "all" && !query ? "" : `?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(value !== "all" ? { status: value } : {}) }).toString()}`}`}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-medium transition",
        status === value ? "bg-aero-800 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
      )}
    >
      {label}
    </a>
  )

  return (
    <div className="min-h-svh bg-white font-sans text-neutral-900 antialiased">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5">
          <a href="/" aria-label="Aero home">
            <BrandLockup tone="dark" height={28} />
          </a>
          <AdminLogout />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Waitlist</p>
            <h1 className="mt-2 text-4xl font-medium tracking-[-0.02em]">
              {all.length} signup{all.length === 1 ? "" : "s"}
              <span className="text-neutral-400"> · {confirmed} confirmed</span>
            </h1>
            <p className="mt-1.5 font-mono text-xs text-neutral-400">
              store: {store} · confirm rate {rate}% · {referrals} referral signups
            </p>
          </div>
          <a
            href="/api/admin/export"
            className="inline-flex h-11 items-center rounded-full bg-aero-800 px-6 text-[15px] font-medium text-white transition hover:bg-aero-900"
          >
            Export CSV
          </a>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5">
            {tab("all", "All")}
            {tab("confirmed", "Confirmed")}
            {tab("pending", "Pending")}
          </div>
          <form method="GET" action="/admin" className="flex gap-2">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Search email or @username"
              className="h-10 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-400 sm:w-64"
            />
            <button type="submit" className="h-10 shrink-0 rounded-full border border-neutral-200 px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
              Search
            </button>
          </form>
        </div>

        {signups.length === 0 ? (
          <p className="mt-6 rounded-[20px] border border-neutral-200 bg-[#f7f7f7] p-10 text-center text-neutral-500">
            {all.length === 0
              ? `No signups yet. Reading from ${store}.`
              : "Nothing matches that search."}
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[20px] border border-neutral-200">
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_auto_auto_auto] items-center gap-4 border-b border-neutral-200 bg-[#f7f7f7] px-5 py-3 text-[13px] font-medium text-neutral-500 sm:grid">
              <span>Email</span>
              <span>Username</span>
              <span>Signed up</span>
              <span className="text-right">Refs</span>
              <span className="text-right">Status</span>
              <span className="text-right">Actions</span>
            </div>
            {signups.map((s) => (
              <div key={s.email} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-neutral-100 px-5 py-3.5 text-[15px] last:border-0 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto_auto]">
                <span className="truncate font-medium">{s.email}</span>
                <span className={`justify-self-end rounded-full px-2.5 py-1 text-xs font-medium sm:order-5 ${s.confirmed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {s.confirmed ? "Confirmed" : "Pending"}
                </span>
                <span className="hidden text-neutral-600 sm:block">@{s.username}</span>
                <span className="hidden text-neutral-400 tabular-nums sm:block">{s.created_at.slice(0, 10)}</span>
                <span className="hidden text-right text-neutral-500 tabular-nums sm:block">{s.referrals}</span>
                <span className="col-span-2 sm:col-span-1 sm:justify-self-end">
                  <AdminRowActions email={s.email} />
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
