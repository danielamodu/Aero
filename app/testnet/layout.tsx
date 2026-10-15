import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { TestnetProviders } from "@/components/testnet/providers"

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  title: "Aero Testnet — play money on Fuji",
  description: "Try sending, paying, and earning test dollars on Avalanche Fuji. Worthless by design.",
  robots: { index: false, follow: false },
}

// Wallet state can't prerender — always render on demand.
export const dynamic = "force-dynamic"

export default function TestnetLayout({ children }: { children: ReactNode }) {
  return (
    <TestnetProviders>
      <div className="min-h-svh bg-white font-sans text-neutral-900 antialiased">{children}</div>
    </TestnetProviders>
  )
}
