"use client"

import { useEffect, useState } from "react"
import { useReadContract } from "wagmi"
import { Check, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { bankAbi, usdcAbi } from "@/lib/contracts"
import { CONTRACTS, bankConfigured, formatUsdc } from "@/lib/testnet"
import { useTx, TxStatus } from "./views"

const PACKS = [25, 100, 500]

/**
 * Sandbox card purchase: the card step is simulated, settlement is a real
 * on-chain transfer from the pre-funded bank till. Mainnet swaps this
 * sheet's settler for a provider (Transak/MoonPay) without touching the UI.
 */
export function BuySheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [usd, setUsd] = useState("100")
  const [processing, setProcessing] = useState(false)
  const tx = useTx()

  const { data: till, refetch: refetchTill } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [CONTRACTS.bank],
    query: { enabled: bankConfigured },
  })

  useEffect(() => {
    if (tx.done) {
      setProcessing(false)
      refetchTill()
    }
  }, [tx.done, refetchTill])

  if (!bankConfigured) return null

  const amount = Math.floor(Number(usd))
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 1000
  const raw = valid ? BigInt(amount) * BigInt(1_000_000) : null
  const done = tx.done && !tx.error

  const pay = async () => {
    if (raw === null || tx.busy) return
    setProcessing(true)
    // Simulated processor beat — the money movement below is real.
    await new Promise((r) => setTimeout(r, 1600))
    tx.write({ address: CONTRACTS.bank, abi: bankAbi, functionName: "buy", args: [raw] })
  }

  const close = (o: boolean) => {
    if (!o) {
      setProcessing(false)
      tx.reset()
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90svh] w-[calc(100vw-2rem)] overflow-y-auto rounded-[24px] border-neutral-200 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-medium tracking-tight">Add test dollars</DialogTitle>
          <DialogDescription className="text-[15px]">
            Sandbox checkout — no real charge. Settlement is a real on-chain transfer.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="py-4 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="size-6" strokeWidth={3} />
            </span>
            <p className="mt-4 text-xl font-medium">${amount} → {amount.toLocaleString()} tUSDC settled.</p>
            <div className="mt-3 flex justify-center">
              <TxStatus hash={tx.hash} error={tx.error} />
            </div>
            <Button onClick={() => close(false)} className="mt-5 h-11 rounded-full bg-aero-800 px-7 font-medium text-white hover:bg-aero-900">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {PACKS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setUsd(String(p))}
                  className={cn(
                    "h-12 rounded-2xl border text-[15px] font-medium transition",
                    amount === p ? "border-aero-800 bg-aero-50/60 text-aero-900" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  )}
                >
                  ${p}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-neutral-200 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-aero-800 text-white">
                <CreditCard className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[15px] font-medium tracking-wider">4242 ···· ···· 4242</p>
                <p className="text-[13px] text-neutral-400">Test card · any name · any expiry</p>
              </div>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-[11px] font-bold text-neutral-500">
                SANDBOX
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-neutral-500">Custom USD</span>
              <Input
                value={usd}
                onChange={(e) => setUsd(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                inputMode="numeric"
                aria-label="Custom amount in USD"
                className="h-11 w-28 rounded-2xl border-neutral-200 text-base tabular-nums"
              />
              <span className="ml-auto font-mono text-xs text-neutral-400 tabular-nums">
                till ${formatUsdc(till)}
              </span>
            </div>
            <Button
              disabled={!valid || tx.busy || processing}
              onClick={pay}
              className="mt-4 h-12 w-full rounded-full bg-aero-800 text-[15px] font-medium text-white hover:bg-aero-900 disabled:opacity-60"
            >
              {processing || tx.busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Processing…
                </span>
              ) : (
                <>Pay ${valid ? amount.toLocaleString() : "0"}</>
              )}
            </Button>
            {(processing || tx.busy) && (
              <p className="mt-2 text-center text-[13px] text-neutral-400">
                {tx.hash ? "Settling on Fuji…" : "Talking to the sandbox processor…"}
              </p>
            )}
            {tx.error && !tx.busy && (
              <p role="alert" className="mt-2 text-center text-sm font-medium text-red-600">
                {tx.error.message.split("\n")[0].slice(0, 140)}
              </p>
            )}
            <TxStatus hash={tx.hash} error={null} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
