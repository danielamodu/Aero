"use client"

import { useEffect, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  useAccount,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import { maxUint256, zeroAddress, type Address } from "viem"
import { ArrowUpRight, Check, Droplets, ExternalLink, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { BrandLockup } from "@/components/aero/brand-logo"
import { AppKitConnectButton, reownConfigured } from "@/components/testnet/providers"
import { namesAbi, usdcAbi, vaultAbi } from "@/lib/contracts"
import {
  CONTRACTS,
  FUJI_AVAX_FAUCET,
  FUJI_CHAIN_ID,
  aprFromRate,
  contractsConfigured,
  formatUsdc,
  isAddress,
  isUsername,
  normalizeUsername,
  parseUsdc,
  snowtraceAddress,
  snowtraceTx,
} from "@/lib/testnet"

/* ---------------------------------- atoms --------------------------------- */

function useTx() {
  const { data: hash, writeContract, isPending, error, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  return { hash, write: writeContract, busy: isPending || confirming, done: isSuccess, error, reset }
}

function TxStatus({ hash, error }: { hash: `0x${string}` | undefined; error: Error | null }) {
  if (error)
    return (
      <p role="alert" className="text-sm font-medium text-red-600">
        {(error as Error).message.split("\n")[0].slice(0, 160)}
      </p>
    )
  if (!hash) return null
  return (
    <a
      href={snowtraceTx(hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-aero-800 hover:underline"
    >
      View on Snowtrace <ExternalLink className="size-3.5" />
    </a>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

/** Resolves "@name or 0x…" input to an address via the on-chain registry. */
function useRecipient(input: string): { address: Address | null; hint: string } {
  const t = input.trim()
  const { data } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveAddress",
    args: [normalizeUsername(t)],
    query: { enabled: t.length > 0 && !isAddress(t) },
  })
  if (!t) return { address: null, hint: "" }
  if (isAddress(t)) return { address: t as Address, hint: "Raw address — double-check it" }
  if (!isUsername(t)) return { address: null, hint: "Usernames are 3–20 lowercase letters, numbers, _" }
  if (data === undefined) return { address: null, hint: "Looking up…" }
  if (data === zeroAddress) return { address: null, hint: "Not registered yet" }
  return { address: data, hint: "Registered on-chain" }
}

/* --------------------------------- header --------------------------------- */

function TestnetHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-5">
        <span className="flex items-center gap-2.5">
          <BrandLockup tone="dark" height={26} />
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-amber-800">
            TESTNET
          </span>
          <span className="hidden rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-neutral-500 sm:inline">
            FUJI · 43113
          </span>
        </span>
        <AppKitConnectButton />
      </div>
    </header>
  )
}

/* --------------------------------- faucet --------------------------------- */

function FaucetBar({ address }: { address: Address }) {
  const tx = useTx()
  const { data: balance, refetch } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: lastClaim } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "lastClaim",
    args: [address],
  })
  useEffect(() => {
    if (tx.done) refetch()
  }, [tx.done, refetch])

  const nextIn =
    lastClaim !== undefined ? Number(lastClaim) + 86400 - Math.floor(Date.now() / 1000) : 0
  const ready = nextIn <= 0

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-neutral-200 bg-[#f7f7f7] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[13px] font-medium text-neutral-500">Test balance</p>
        <p className="mt-0.5 text-3xl font-medium tracking-tight tabular-nums">
          {formatUsdc(balance)} <span className="text-base text-neutral-400">tUSDC</span>
        </p>
        <p className="mt-1 text-[13px] text-neutral-500">
          Worthless by design ·{" "}
          <a href={FUJI_AVAX_FAUCET} target="_blank" rel="noreferrer" className="font-medium text-aero-800 hover:underline">
            Get Fuji AVAX for gas <ArrowUpRight className="inline size-3.5" />
          </a>
        </p>
      </div>
      <div className="shrink-0">
        <Button
          disabled={!ready || tx.busy}
          onClick={() => tx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "faucet" })}
          className="h-11 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:opacity-60"
        >
          <Droplets className="size-4" />
          {tx.busy ? "Claiming…" : ready ? "Claim 10,000 tUSDC" : `Next claim in ${Math.ceil(nextIn / 3600)}h`}
        </Button>
        <div className="mt-2">
          <TxStatus hash={tx.hash} error={tx.error} />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------- username -------------------------------- */

function UsernameCard({ address }: { address: Address }) {
  const [name, setName] = useState("")
  const tx = useTx()
  const { data: mine, refetch } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveUsername",
    args: [address],
  })
  useEffect(() => {
    if (tx.done) {
      refetch()
      setName("")
    }
  }, [tx.done, refetch])

  const clean = normalizeUsername(name)
  return (
    <div className="rounded-[20px] border border-neutral-200 bg-white p-6">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Your handle</p>
      {mine ? (
        <p className="mt-2 text-2xl font-medium tracking-tight">
          @{mine} <span className="text-sm font-normal text-neutral-400">· yours on Fuji</span>
        </p>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-neutral-600">No handle yet — claim one. It&apos;s yours across the testnet app.</p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="@yourname"
              aria-label="Desired handle"
              className="h-12 flex-1 rounded-2xl border-neutral-200 text-base text-neutral-900 placeholder:text-neutral-400"
            />
            <Button
              disabled={!isUsername(name) || tx.busy}
              onClick={() => tx.write({ address: CONTRACTS.names, abi: namesAbi, functionName: "register", args: [clean] })}
              className="h-12 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:opacity-60"
            >
              {tx.busy ? "Claiming…" : "Claim handle"}
            </Button>
          </div>
        </>
      )}
      <div className="mt-3">
        <TxStatus hash={tx.hash} error={tx.error} />
      </div>
    </div>
  )
}

/* ---------------------------------- send ---------------------------------- */

type Receipt = { label: string; amount: string; hash: string }

function SendTab({ address }: { address: Address }) {
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const resolved = useRecipient(to)
  const tx = useTx()
  const raw = parseUsdc(amount)

  useEffect(() => {
    if (tx.done && tx.hash && raw !== null) {
      setReceipts((r) => [{ label: `You → ${to.trim()}`, amount: `$${amount}`, hash: tx.hash as string }, ...r].slice(0, 4))
      setAmount("")
      tx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <UsernameCard address={address} />
      <div className="rounded-[20px] border border-neutral-200 bg-white p-6">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Send tUSDC</p>
        <div className="mt-4 space-y-4">
          <Field label="To">
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="@username or 0x…"
              className="h-12 rounded-2xl border-neutral-200 text-base text-neutral-900 placeholder:text-neutral-400"
            />
            {resolved.hint && (
              <p className={cn("mt-1.5 text-[13px]", resolved.address ? "font-medium text-emerald-600" : "text-neutral-400")}>
                {resolved.address ? (
                  <a href={`https://testnet.snowtrace.io/address/${resolved.address}`} target="_blank" rel="noreferrer" className="hover:underline">
                    {resolved.hint} · {resolved.address.slice(0, 6)}…{resolved.address.slice(-4)}
                  </a>
                ) : resolved.hint}
              </p>
            )}
          </Field>
          <Field label="Amount (tUSDC)">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="h-12 rounded-2xl border-neutral-200 text-base tabular-nums placeholder:text-neutral-400"
            />
          </Field>
          <Button
            disabled={!resolved.address || raw === null || tx.busy}
            onClick={() => resolved.address && raw !== null && tx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "transfer", args: [resolved.address, raw] })}
            className="h-12 w-full rounded-full bg-aero-800 text-[15px] font-medium text-white hover:bg-aero-900 disabled:opacity-60"
          >
            <Send className="size-4" /> {tx.busy ? "Sending…" : "Send"}
          </Button>
          <TxStatus hash={tx.hash} error={tx.error} />
        </div>
        {receipts.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-neutral-100 pt-4">
            <AnimatePresence initial={false}>
              {receipts.map((r) => (
                <motion.div key={r.hash} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-neutral-700">{r.label} · {r.amount}</span>
                  <a href={snowtraceTx(r.hash)} target="_blank" rel="noreferrer" className="font-medium text-aero-800 hover:underline">
                    Receipt
                  </a>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------- pay ---------------------------------- */

const BILLS = [
  { id: "rent", label: "Rent · Maple Apartments", amount: "1400" },
  { id: "power", label: "City Power & Light", amount: "86.20" },
  { id: "freelancer", label: "@lena · invoice #042", amount: "320" },
]

function PayTab({ address }: { address: Address }) {
  const [billId, setBillId] = useState(BILLS[0].id)
  const [to, setTo] = useState("")
  const [paid, setPaid] = useState<string[]>([])
  const resolved = useRecipient(to)
  const tx = useTx()
  const bill = BILLS.find((b) => b.id === billId)!
  const raw = parseUsdc(bill.amount)

  useEffect(() => {
    if (tx.done && tx.hash) {
      setPaid((p) => (p.includes(bill.id) ? p : [...p, bill.id]))
      tx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  return (
    <div className="mx-auto max-w-2xl rounded-[20px] border border-neutral-200 bg-white p-6 sm:p-8">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Pay a bill</p>
      <div className="mt-4 grid gap-2">
        {BILLS.map((b) => {
          const done = paid.includes(b.id)
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBillId(b.id)}
              className={cn(
                "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition",
                billId === b.id ? "border-aero-800 bg-aero-50/50" : "border-neutral-200 hover:border-neutral-300"
              )}
            >
              <span className="flex items-center gap-2.5 text-[15px] font-medium text-neutral-900">
                {done && <Check className="size-4 text-emerald-600" strokeWidth={3} />}
                {b.label}
              </span>
              <span className="font-medium tabular-nums">${b.amount}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-5">
        <Field label="Pay to (@username or 0x…)">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="@landlord or 0x…"
            className="h-12 rounded-2xl border-neutral-200 text-base text-neutral-900 placeholder:text-neutral-400"
          />
        </Field>
        {resolved.hint && (
          <p className={cn("mt-1.5 text-[13px]", resolved.address ? "font-medium text-emerald-600" : "text-neutral-400")}>
            {resolved.hint}
          </p>
        )}
      </div>
      <Button
        disabled={!resolved.address || raw === null || tx.busy}
        onClick={() => resolved.address && raw !== null && tx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "transfer", args: [resolved.address, raw] })}
        className="mt-5 h-12 w-full rounded-full bg-aero-800 text-[15px] font-medium text-white hover:bg-aero-900 disabled:opacity-60"
      >
        {tx.busy ? "Paying…" : `Pay $${bill.amount}`}
      </Button>
      <div className="mt-3">
        <TxStatus hash={tx.hash} error={tx.error} />
      </div>
      <p className="mt-3 text-[13px] text-neutral-400">Recipient: {address ? "any Fuji address or registered handle" : ""} — test money only.</p>
    </div>
  )
}

/* ---------------------------------- earn ---------------------------------- */

function EarnTab({ address }: { address: Address }) {
  const [depositAmt, setDepositAmt] = useState("")
  const [withdrawAmt, setWithdrawAmt] = useState("")
  const approveTx = useTx()
  const depositTx = useTx()
  const withdrawTx = useTx()

  const { data: rate, refetch: refetchRate } = useReadContract({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "ratePerSecond" })
  const { data: shares, refetch: refetchShares } = useReadContract({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "balanceOf", args: [address] })
  const { data: index } = useReadContract({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "index" })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "allowance", args: [address, CONTRACTS.vault] })
  const { data: tvl } = useReadContract({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "balanceOf", args: [CONTRACTS.vault] })

  const refresh = () => {
    refetchRate()
    refetchShares()
    refetchAllowance()
  }
  useEffect(() => {
    if (depositTx.done || withdrawTx.done) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTx.done, withdrawTx.done])

  const depositRaw = parseUsdc(depositAmt)
  const needsApprove = depositRaw !== null && (allowance ?? BigInt(0)) < depositRaw
  const myAssets = shares && index ? (shares * index) / BigInt(1e18) : undefined

  const doDeposit = () => {
    if (depositRaw === null) return
    if (needsApprove) {
      approveTx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "approve", args: [CONTRACTS.vault, maxUint256] })
    } else {
      depositTx.write({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "deposit", args: [depositRaw] })
    }
  }
  useEffect(() => {
    if (approveTx.done) {
      refetchAllowance()
      approveTx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveTx.done])

  const withdrawRaw = parseUsdc(withdrawAmt)
  const withdrawShares = withdrawRaw !== null && index ? (withdrawRaw * BigInt(1e18)) / index : null
  const doWithdraw = (all: boolean) => {
    if (all && shares) {
      withdrawTx.write({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "withdraw", args: [shares] })
    } else if (withdrawShares) {
      withdrawTx.write({ address: CONTRACTS.vault, abi: vaultAbi, functionName: "withdraw", args: [withdrawShares] })
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[20px] bg-aero-950 p-6 text-white sm:p-8">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-white/50 uppercase">Mock vault · testnet rate</p>
        <p className="mt-2 font-mono text-6xl font-medium tracking-tight text-emerald-300 tabular-nums">{aprFromRate(rate)}%</p>
        <p className="mt-1 text-sm text-white/50">APR · simulated by contract, not live markets</p>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 font-mono tabular-nums">
          <div>
            <p className="font-sans text-[13px] text-white/45">Your position</p>
            <p className="mt-1 text-xl">${formatUsdc(myAssets)}</p>
          </div>
          <div>
            <p className="font-sans text-[13px] text-white/45">Vault TVL</p>
            <p className="mt-1 text-xl">${formatUsdc(tvl)}</p>
          </div>
        </div>
      </div>
      <div className="space-y-5">
        <div className="rounded-[20px] border border-neutral-200 bg-white p-6">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Deposit</p>
          <div className="mt-3 flex gap-2.5">
            <Input
              value={depositAmt}
              onChange={(e) => setDepositAmt(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="h-12 flex-1 rounded-2xl border-neutral-200 text-base tabular-nums placeholder:text-neutral-400"
            />
            <Button
              disabled={depositRaw === null || approveTx.busy || depositTx.busy}
              onClick={doDeposit}
              className="h-12 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:opacity-60"
            >
              {approveTx.busy ? "Approving…" : depositTx.busy ? "Depositing…" : needsApprove ? "Approve + deposit" : "Deposit"}
            </Button>
          </div>
          <div className="mt-2">
            <TxStatus hash={approveTx.hash ?? depositTx.hash} error={approveTx.error ?? depositTx.error} />
          </div>
        </div>
        <div className="rounded-[20px] border border-neutral-200 bg-white p-6">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Withdraw</p>
          <div className="mt-3 flex gap-2.5">
            <Input
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="h-12 flex-1 rounded-2xl border-neutral-200 text-base tabular-nums placeholder:text-neutral-400"
            />
            <Button
              disabled={(!withdrawShares && !shares) || withdrawTx.busy}
              onClick={() => doWithdraw(!withdrawAmt)}
              className="h-12 shrink-0 rounded-full border border-neutral-300 px-6 font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
            >
              {withdrawTx.busy ? "…" : withdrawAmt ? "Withdraw" : "Withdraw all"}
            </Button>
          </div>
          <div className="mt-2">
            <TxStatus hash={withdrawTx.hash} error={withdrawTx.error} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- page ---------------------------------- */

const TABS = [
  { id: "send", label: "Send" },
  { id: "pay", label: "Pay" },
  { id: "earn", label: "Earn" },
] as const

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <TestnetHeader />
      <main className="mx-auto w-full max-w-6xl px-5 pb-24">{children}</main>
    </>
  )
}

function SetupCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded-[20px] border border-neutral-200 bg-white p-8 text-center">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Setup needed</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">{title}</h1>
      <div className="mx-auto mt-5 max-w-md space-y-2.5 text-left text-[15px] leading-relaxed text-neutral-600">
        {children}
      </div>
    </div>
  )
}

export default function TestnetPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("send")
  if (!reownConfigured) {
    return (
      <Shell>
        <SetupCard title="Connect a Reown project">
          <p><span className="font-mono font-bold text-neutral-900">1.</span> Create a free project at cloud.reown.com</p>
          <p><span className="font-mono font-bold text-neutral-900">2.</span> Set <span className="font-mono text-[13px] text-neutral-900">NEXT_PUBLIC_REOWN_PROJECT_ID</span> and redeploy</p>
          <p><span className="font-mono font-bold text-neutral-900">3.</span> Wallets unlock on Avalanche Fuji</p>
        </SetupCard>
      </Shell>
    )
  }
  if (!contractsConfigured) {
    return (
      <Shell>
        <SetupCard title="Deploy the contracts first">
          <p><span className="font-mono font-bold text-neutral-900">1.</span> Fund a throwaway key with Fuji AVAX (faucet.avax.network)</p>
          <p><span className="font-mono font-bold text-neutral-900">2.</span> <span className="font-mono text-[13px] text-neutral-900">cd contracts && forge script script/Deploy.s.sol --rpc-url fuji --broadcast</span></p>
          <p><span className="font-mono font-bold text-neutral-900">3.</span> Set <span className="font-mono text-[13px] text-neutral-900">NEXT_PUBLIC_TEST_USDC / _AERO_VAULT / _AERO_NAMES</span> and redeploy</p>
        </SetupCard>
      </Shell>
    )
  }
  return <TestnetApp tab={tab} setTab={setTab} />
}

function TestnetApp({
  tab,
  setTab,
}: {
  tab: (typeof TABS)[number]["id"]
  setTab: (t: (typeof TABS)[number]["id"]) => void
}) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: switching } = useSwitchChain()
  const wrongNetwork = isConnected && chainId !== FUJI_CHAIN_ID

  if (!isConnected || !address) {
    return (
      <Shell>
        <div className="mx-auto mt-16 max-w-xl rounded-[20px] border border-neutral-200 bg-white p-8 text-center">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Testnet · Fuji</p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.02em] text-balance">Play money, real rails</h1>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-neutral-600">
            Connect a wallet on Avalanche Fuji to claim test dollars, send to @usernames,
            pay bills, and earn mock yield. Worthless by design.
          </p>
          <div className="mt-6 flex justify-center">
            <AppKitConnectButton />
          </div>
        </div>
      </Shell>
    )
  }

  if (wrongNetwork) {
    return (
      <Shell>
        <div className="mx-auto mt-16 max-w-xl rounded-[20px] border border-neutral-200 bg-white p-8 text-center">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Wrong network</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">Switch to Fuji to continue</h1>
          <Button
            disabled={switching}
            onClick={() => switchChain({ chainId: FUJI_CHAIN_ID })}
            className="mt-6 h-12 rounded-full bg-aero-800 px-7 font-medium text-white hover:bg-aero-900"
          >
            {switching ? "Switching…" : "Switch to Avalanche Fuji"}
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mt-8">
        <FaucetBar address={address} />
        <div className="mt-6 inline-flex rounded-full bg-neutral-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "h-10 rounded-full px-6 text-[15px] font-medium transition",
                tab === t.id ? "bg-aero-800 text-white" : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-5">
          {tab === "send" && <SendTab address={address} />}
          {tab === "pay" && <PayTab address={address} />}
          {tab === "earn" && <EarnTab address={address} />}
        </div>
        <p className="mt-10 text-center text-[13px] text-neutral-400">
          Testnet only · tUSDC has no value · mock vault rate, not live markets ·{" "}
          <a href="https://useaero.org/docs" className="underline underline-offset-4 hover:text-neutral-600">Docs</a>
        </p>
      </div>
    </Shell>
  )
}
