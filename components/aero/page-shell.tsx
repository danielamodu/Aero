"use client"

import type { ReactNode } from "react"
import { BrandLockup } from "./brand-logo"
import { Footer } from "./landing"

export function DocSection({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-neutral-200 py-10">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-medium tracking-[-0.01em] text-neutral-900">{title}</h2>
      <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-neutral-600">{children}</div>
    </section>
  )
}

export function DocsShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-white font-sans text-neutral-900 antialiased">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[110rem] items-center justify-between px-5 lg:px-10">
          <a href="/" aria-label="Aero home">
            <BrandLockup tone="dark" height={28} />
          </a>
          <nav className="flex items-center gap-6 text-[15px] font-medium text-neutral-600">
            <a href="/docs" className="transition hover:text-neutral-950">Docs</a>
            <a href="/#top" className="transition hover:text-neutral-950">Early access</a>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

export function DocsHero({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="pb-4">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">{eyebrow}</p>
      <h1 className="mt-3 max-w-2xl text-4xl font-medium tracking-[-0.02em] text-neutral-900 text-balance sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-neutral-600">{body}</p>
    </div>
  )
}
