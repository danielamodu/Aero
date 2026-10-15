"use client"

import { createElement, useState, type ReactElement, type ReactNode } from "react"
import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { avalancheFuji } from "@reown/appkit/networks"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"

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

/** Reown connect button (web component — created imperatively to dodge JSX typing). */
export function AppKitConnectButton() {
  return createElement("appkit-button") as unknown as ReactElement
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
