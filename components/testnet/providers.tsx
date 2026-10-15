"use client"

import { useState, type ReactNode } from "react"
import { createAppKit, useAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { avalancheFuji } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider, useAccount } from "wagmi"
import { cn } from "@/lib/utils"

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? ""

export const reownConfigured = projectId.length > 8

let wagmiConfig: WagmiAdapter["wagmiConfig"] | null = null

if (reownConfigured) {
  const adapter = new WagmiAdapter({ ssr: true, projectId, networks: [avalancheFuji] })
  createAppKit({
    adapters: [adapter],
    projectId,
    networks: [avalancheFuji],
    defaultNetwork: avalancheFuji,
    metadata: {
      name: "Aero Testnet",
      description: "Send, pay, and earn test dollars on Avalanche Fuji.",
      url: "https://testnet.useaero.org",
      icons: ["https://useaero.org/brand/aero-icon.png"],
    },
    themeVariables: { "--w3m-accent": "#1800AD" },
    features: { analytics: false },
  })
  wagmiConfig = adapter.wagmiConfig
}

/** Our own connect button in Aero blue — opens the Reown modal. */
export function AppKitConnectButton({ className }: { className?: string }) {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  return (
    <button
      type="button"
      onClick={() => open(isConnected ? { view: "Account" } : undefined)}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-aero-800 px-6 text-[15px] font-medium text-white transition hover:bg-aero-900",
        className
      )}
    >
      {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect Wallet"}
    </button>
  )
}

export function TestnetProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  if (!wagmiConfig) return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
