"use client"

import { useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useAccount, useSwitchChain } from "wagmi"
import { Button } from "@/components/ui/button"
import { LoginView, MobileTabs, MobileTop, Overview, Sidebar } from "@/components/testnet/shell"
import { EarnTab, FaucetBar, PayTab, RequestTab, SendTab } from "@/components/testnet/views"
import { reownConfigured } from "@/components/testnet/providers"
import { contractsConfigured, FUJI_CHAIN_ID, missingContractEnvs } from "@/lib/testnet"

export type TestnetTab = "overview" | "send" | "request" | "pay" | "earn"

function SetupNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-16 w-full max-w-xl px-5">
      <div className="rounded-[20px] border border-neutral-200 bg-white p-8 text-center">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Setup needed</p>
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
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Wrong network</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">Switch to Fuji to continue</h1>
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
  // Payment-link prefill (?to=@x&amount=1.5) — read once, land on Send.
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
  const [tab, setTab] = useState<TestnetTab>(prefill.to ? "send" : "overview")

  // No wallet hooks before these gates: without a provider they throw.
  if (!reownConfigured) {
    return (
      <SetupNotice title="Connect a Reown project">
        <p><span className="font-mono font-bold text-neutral-900">1.</span> Create a free project at cloud.reown.com</p>
        <p><span className="font-mono font-bold text-neutral-900">2.</span> Set <span className="font-mono text-[13px] text-neutral-900">NEXT_PUBLIC_REOWN_PROJECT_ID</span> and redeploy</p>
        <p><span className="font-mono font-bold text-neutral-900">3.</span> Wallets unlock on Avalanche Fuji</p>
      </SetupNotice>
    )
  }
  if (!contractsConfigured) {
    const missing = missingContractEnvs()
    return (
      <SetupNotice title="Deploy the contracts first">
        <p><span className="font-mono font-bold text-neutral-900">1.</span> Fund a throwaway key with Fuji AVAX (faucet.avax.network)</p>
        <p><span className="font-mono font-bold text-neutral-900">2.</span> <span className="font-mono text-[13px] text-neutral-900">cd contracts && forge script script/Deploy.s.sol --rpc-url fuji --broadcast</span></p>
        <p><span className="font-mono font-bold text-neutral-900">3.</span> Set the three <span className="font-mono text-[13px] text-neutral-900">NEXT_PUBLIC_*</span> addresses and redeploy</p>
        {missing.length > 0 && (
          <p className="rounded-2xl bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-800">
            This build can&apos;t see: <span className="font-mono text-[13px]">{missing.join(", ")}</span> — check
            the values (no extra spaces) and redeploy.
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
  const { address, isConnected, chainId } = useAccount()

  if (!isConnected || !address) return <LoginView />
  if (chainId !== FUJI_CHAIN_ID) return <WrongNetwork />

  return (
    <div className="min-h-svh bg-white lg:flex">
      <Sidebar tab={tab} setTab={setTab} address={address} />
      <div className="min-w-0 flex-1">
        <MobileTop address={address} />
        <main className="mx-auto w-full max-w-5xl px-5 pt-6 pb-28 lg:px-8 lg:pb-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
          {tab === "overview" && <Overview address={address} go={setTab} />}
          {tab === "send" && <SendTab address={address} initialTo={prefill.to} initialAmount={prefill.amount} />}
          {tab === "request" && <RequestTab address={address} go={setTab} />}
          {tab === "pay" && <PayTab address={address} />}
          {tab === "earn" && <EarnTab address={address} />}
          {tab !== "overview" && (
            <div className="mt-6">
              <FaucetBar address={address} />
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileTabs tab={tab} setTab={setTab} />
    </div>
  )
}
