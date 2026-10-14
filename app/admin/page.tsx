import type { Metadata } from "next"
import { cookies } from "next/headers"
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/admin-auth"
import { readSignups } from "@/lib/waitlist-store"
import { AdminLogin, AdminLogout } from "@/components/aero/admin-login"
import { BrandLockup } from "@/components/aero/brand-logo"

export const metadata: Metadata = {
  title: "Admin — Aero",
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
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

  const signups = await readSignups()
  const confirmed = signups.filter((s) => s.confirmed).length

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
              {signups.length} signup{signups.length === 1 ? "" : "s"}
              <span className="text-neutral-400"> · {confirmed} confirmed</span>
            </h1>
          </div>
          <a
            href="/api/admin/export"
            className="inline-flex h-11 items-center rounded-full bg-aero-800 px-6 text-[15px] font-medium text-white transition hover:bg-aero-900"
          >
            Export CSV
          </a>
        </div>
        {signups.length === 0 ? (
          <p className="mt-12 rounded-[20px] border border-neutral-200 bg-[#f7f7f7] p-10 text-center text-neutral-500">
            No signups yet. On production the file store is ephemeral — confirmation emails
            (and WAITLIST_NOTIFY copies) are the durable record until a database lands.
          </p>
        ) : (
          <div className="mt-8 overflow-hidden rounded-[20px] border border-neutral-200">
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-neutral-200 bg-[#f7f7f7] px-5 py-3 text-[13px] font-medium text-neutral-500 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
              <span>Email</span>
              <span className="hidden sm:block">Username</span>
              <span className="hidden sm:block">Signed up</span>
              <span className="hidden text-right sm:block">Refs</span>
              <span className="text-right">Status</span>
            </div>
            {signups.map((s) => (
              <div key={s.email} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-neutral-100 px-5 py-3.5 text-[15px] last:border-0 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
                <span className="truncate font-medium">{s.email}</span>
                <span className="hidden text-neutral-600 sm:block">@{s.username}</span>
                <span className="hidden text-neutral-400 tabular-nums sm:block">{s.created_at.slice(0, 10)}</span>
                <span className="hidden text-right text-neutral-500 tabular-nums sm:block">{s.referrals}</span>
                <span className={`justify-self-end rounded-full px-2.5 py-1 text-xs font-medium ${s.confirmed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                  {s.confirmed ? "Confirmed" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
