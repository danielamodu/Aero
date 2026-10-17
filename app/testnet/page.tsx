"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useAccount, useSwitchChain } from "wagmi"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import {
  LoginView,
  MobileTabs,
  MobileTop,
  Overview,
  ReconnectingSplash,
  Sidebar,
} from "@/components/testnet/shell"
import { EarnTab, PayScreen } from "@/components/testnet/views"
import { TerminalView } from "@/components/testnet/terminal"
import { CommandPalette } from "@/components/testnet/command-palette"
import { reownConfigured } from "@/components/testnet/providers"
import {
  contractsConfigured,
  FUJI_CHAIN_ID,
  missingContractEnvs,
} from "@/lib/testnet"

export type TestnetTab = "home" | "pay" | "earn" | "terminal"

const TAB_LABELS: Record<TestnetTab, string> = {
  home: "Home",
  pay: "Pay",
  earn: "Earn",
  terminal: "Terminal",
}

function SetupNotice({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto mt-16 w-full max-w-xl px-5">
      <div className="rounded-[20px] border border-neutral-200 bg-white p-8 text-center">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
          Setup needed
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">{title}</h1>
        <div className="mx-auto mt-5 max-w-md space-y-2.5 text-left text-[15px] leading-relaxed text-neutral-600">
          {children}
        </div>
      </div>
    </div>
  )
}

function WrongNetwork() {
  const { switchChain, isPending } = useSwitchChain()
  return (
    <div className="mx-auto mt-16 w-full max-w-xl px-5">
      <div className="rounded-[20px] border border-neutral-200 bg-white p-8 text-center">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
          Wrong network
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          Switch to Fuji to continue
        </h1>
        <Button
          disabled={isPending}
          onClick={() => switchChain({ chainId: FUJI_CHAIN_ID })}
          className="mt-6 h-12 rounded-full bg-aero-800 px-7 font-medium text-white hover:bg-aero-900"
        >
          {isPending ? "Switching…" : "Switch to Avalanche Fuji"}
        </Button>
      </div>
    </div>
  )
}

export default function TestnetPage() {
  // Payment-link prefill (?to=@x&amount=1.5) — read once, land on Pay.
  const [prefill] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      return {
        to: (q.get("to") ?? "").slice(0, 42),
        amount: (q.get("amount") ?? "").slice(0, 20),
      }
    } catch {
      return { to: "", amount: "" }
    }
  })
  const [tab, setTab] = useState<TestnetTab>(prefill.to ? "pay" : "home")

  // No wallet hooks before these gates: without a provider they throw.
  if (!reownConfigured) {
    return (
      <SetupNotice title="Connect a Reown project">
        <p>
          <span className="font-mono font-bold text-neutral-900">1.</span>{" "}
          Create a free project at cloud.reown.com
        </p>
        <p>
          <span className="font-mono font-bold text-neutral-900">2.</span> Set{" "}
          <span className="font-mono text-[13px] text-neutral-900">
            NEXT_PUBLIC_REOWN_PROJECT_ID
          </span>{" "}
          and redeploy
        </p>
        <p>
          <span className="font-mono font-bold text-neutral-900">3.</span>{" "}
          Wallets unlock on Avalanche Fuji
        </p>
      </SetupNotice>
    )
  }
  if (!contractsConfigured) {
    const missing = missingContractEnvs()
    return (
      <SetupNotice title="Deploy the contracts first">
        <p>
          <span className="font-mono font-bold text-neutral-900">1.</span> Fund
          a throwaway key with Fuji AVAX (faucet.avax.network)
        </p>
        <p>
          <span className="font-mono font-bold text-neutral-900">2.</span>{" "}
          <span className="font-mono text-[13px] text-neutral-900">
            cd contracts && forge script script/Deploy.s.sol --rpc-url fuji
            --broadcast
          </span>
        </p>
        <p>
          <span className="font-mono font-bold text-neutral-900">3.</span> Set
          the three{" "}
          <span className="font-mono text-[13px] text-neutral-900">
            NEXT_PUBLIC_*
          </span>{" "}
          addresses and redeploy
        </p>
        {missing.length > 0 && (
          <p className="rounded-2xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-800">
            This build can&apos;t see:{" "}
            <span className="font-mono text-[13px]">{missing.join(", ")}</span>{" "}
            — check the values (no extra spaces) and redeploy.
          </p>
        )}
      </SetupNotice>
    )
  }

  return <TestnetConnected tab={tab} setTab={setTab} prefill={prefill} />
}

function TestnetConnected({
  tab,
  setTab,
  prefill,
}: {
  tab: TestnetTab
  setTab: (t: TestnetTab) => void
  prefill: { to: string; amount: string }
}) {
  const { address, isConnected, chainId, status } = useAccount()
  const isTerm = tab === "terminal"

  useEffect(() => {
    if (isConnected && address) {
      try {
        window.localStorage.setItem("aero_last_user", address)
      } catch {
        /* ignore */
      }
    }
  }, [isConnected, address])

  if (status === "reconnecting") return <ReconnectingSplash />
  if (!isConnected || !address) return <LoginView />
  if (chainId !== FUJI_CHAIN_ID) return <WrongNetwork />

  return (
    <div
      className={
        isTerm
          ? "flex h-svh flex-col overflow-hidden bg-[#F6F6F8] lg:flex-row"
          : "min-h-svh bg-[#F6F6F8] lg:flex"
      }
    >
      <Sidebar tab={tab} setTab={setTab} address={address} />
      <div
        className={
          isTerm ? "flex min-h-0 min-w-0 flex-1 flex-col" : "min-w-0 flex-1"
        }
      >
        <MobileTop address={address} />
        <main
          className={
            isTerm
              ? "flex min-h-0 w-full flex-1 flex-col px-5 pt-6 pb-24 lg:px-8 lg:pb-8"
              : "mx-auto w-full px-5 pt-6 pb-28 lg:px-8 lg:pb-16"
          }
        >
          {!isTerm && (
            <header className="mb-6 hidden items-center justify-between lg:flex">
              <p className="text-sm text-neutral-400">
                Testnet <span className="mx-1 text-neutral-300">/</span>{" "}
                <span className="font-medium text-neutral-900">
                  {TAB_LABELS[tab]}
                </span>
              </p>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("aero:palette"))
                }
                className="flex h-9 items-center gap-2.5 rounded-full border border-neutral-200/80 bg-white pr-2 pl-4 text-sm text-neutral-400 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:text-neutral-600"
              >
                <Search className="size-4" />
                Search…
                <kbd className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-500">
                  ⌘K
                </kbd>
              </button>
            </header>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              className={isTerm ? "flex min-h-0 flex-1 flex-col" : undefined}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {tab === "home" && <Overview address={address} go={setTab} />}
              {tab === "pay" && (
                <PayScreen
                  address={address}
                  initialTo={prefill.to}
                  initialAmount={prefill.amount}
                />
              )}
              {tab === "earn" && <EarnTab address={address} />}
              {tab === "terminal" && <TerminalView address={address} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileTabs tab={tab} setTab={setTab} />
      <CommandPalette go={setTab} />
    </div>
  )
}
