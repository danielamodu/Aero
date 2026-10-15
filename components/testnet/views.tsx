"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import { maxUint256, zeroAddress, type Address } from "viem"
import { ArrowUpRight, Check, Copy, Droplets, ExternalLink, Send, Share, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { adapterAbi, namesAbi, payAbi, routerAbi, usdcAbi, vaultAbi } from "@/lib/contracts"
import {
  CONTRACTS,
  FUJI_AVAX_FAUCET,
  adapterConfigured,
  formatUsdc,
  isAddress,
  isUsername,
  normalizeUsername,
  parseUsdc,
  payConfigured,
  routerConfigured,
  snowtraceTx,
} from "@/lib/testnet"
import { pushActivity } from "@/lib/testnet-activity"
import { buildContacts, getFavorites, toggleFavorite, type Contact } from "@/lib/contacts"
import { BuySheet } from "./buy-sheet"
import { QRCodeSVG } from "qrcode.react"
import type { TestnetTab } from "@/app/testnet/page"

/* ---------------------------------- atoms --------------------------------- */

export function useTx() {
  const { data: hash, writeContract, isPending, error, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  return { hash, write: writeContract, busy: isPending || confirming, done: isSuccess, error, reset }
}

export function TxStatus({ hash, error }: { hash: `0x${string}` | undefined; error: Error | null }) {
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

/** Resolves "@name or 0x…" input to an address via the on-chain registry. */
export function useRecipient(input: string): { address: Address | null; hint: string } {
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

/* --------------------------------- faucet --------------------------------- */

export function FaucetBar({ address }: { address: Address }) {
  const tx = useTx()
  const [buyOpen, setBuyOpen] = useState(false)
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
    if (tx.done) {
      refetch()
      if (tx.hash) pushActivity({ label: "Faucet claim", amount: "+10,000 tUSDC", hash: tx.hash })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

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
        <div className="flex gap-2.5">
          <Button
            disabled={!ready || tx.busy}
            onClick={() => tx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "faucet" })}
            className="h-11 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:opacity-60"
          >
            <Droplets className="size-4" />
            {tx.busy ? "Claiming…" : ready ? "Claim 10,000 tUSDC" : `Next claim in ${Math.ceil(nextIn / 3600)}h`}
          </Button>
          <Button
            onClick={() => setBuyOpen(true)}
            variant="outline"
            className="h-11 rounded-full border-neutral-300 px-6 font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Buy
          </Button>
        </div>
        <div className="mt-2">
          <TxStatus hash={tx.hash} error={tx.error} />
        </div>
        <BuySheet open={buyOpen} onOpenChange={setBuyOpen} />
      </div>
    </div>
  )
}

/* -------------------------------- username -------------------------------- */

export function UsernameCard({ address }: { address: Address }) {
  const [name, setName] = useState("")
  const tx = useTx()
  const { data: mine, refetch } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveUsername",
    args: [address],
  })
  const clean = normalizeUsername(name)
  const { data: takenBy } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveAddress",
    args: [clean],
    query: { enabled: isUsername(name) },
  })
  useEffect(() => {
    if (tx.done) {
      refetch()
      setName("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  const available = isUsername(name) && takenBy !== undefined && takenBy === zeroAddress
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
              disabled={!available || tx.busy}
              onClick={() => tx.write({ address: CONTRACTS.names, abi: namesAbi, functionName: "register", args: [clean] })}
              className="h-12 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:opacity-60"
            >
              {tx.busy ? "Claiming…" : "Claim handle"}
            </Button>
          </div>
          {isUsername(name) && (
            <p className={`mt-2 text-[13px] font-medium ${available ? "text-emerald-600" : "text-neutral-400"}`}>
              {takenBy === undefined ? "Checking availability…" : available ? `@${clean} is available` : `@${clean} is taken — try another`}
            </p>
          )}
        </>
      )}
      <div className="mt-3">
        <TxStatus hash={tx.hash} error={tx.error} />
      </div>
    </div>
  )
}

/* ---------------------------------- send ---------------------------------- */

type Receipt = { label: string; amount: string; hash: string; memo?: string }

export function SendTab({
  address,
  initialTo = "",
  initialAmount = "",
}: {
  address: Address
  initialTo?: string
  initialAmount?: string
}) {
  const [to, setTo] = useState(initialTo)
  const [amount, setAmount] = useState(initialAmount)
  const [memo, setMemo] = useState("")
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [favs, setFavs] = useState<string[]>(() => getFavorites())
  const resolved = useRecipient(to)
  const tx = useTx()
  const raw = parseUsdc(amount)

  const { data: payAllowance, refetch: refetchPayAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "allowance",
    args: [address, CONTRACTS.pay],
    query: { enabled: payConfigured },
  })
  const needsPayApprove = payConfigured && raw !== null && (payAllowance ?? BigInt(0)) < raw

  const reloadContacts = () => {
    buildContacts([]).then(setContacts).catch(() => {})
  }
  useEffect(reloadContacts, [])

  const onStar = (addr: string) => {
    setFavs(toggleFavorite(addr))
    reloadContacts()
  }

  const send = () => {
    if (!resolved.address || raw === null || tx.busy) return
    const note = memo.trim().slice(0, 140)
    if (payConfigured) {
      if (needsPayApprove) {
        tx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "approve", args: [CONTRACTS.pay, maxUint256] })
        return
      }
      if (!isAddress(to.trim())) {
        tx.write({
          address: CONTRACTS.pay,
          abi: payAbi,
          functionName: "payUsername",
          args: [CONTRACTS.names, CONTRACTS.usdc, normalizeUsername(to), raw, note],
        })
      } else {
        tx.write({
          address: CONTRACTS.pay,
          abi: payAbi,
          functionName: "pay",
          args: [CONTRACTS.usdc, resolved.address, raw, note],
        })
      }
      return
    }
    tx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "transfer", args: [resolved.address, raw] })
  }

  useEffect(() => {
    if (tx.done && tx.hash && raw !== null && resolved.address) {
      const r = { label: `You → ${to.trim()}`, amount: `$${amount}`, hash: tx.hash as string, memo: memo.trim() || undefined }
      setReceipts((prev) => [r, ...prev].slice(0, 4))
      pushActivity({ ...r, to: resolved.address })
      setAmount("")
      setMemo("")
      reloadContacts()
      refetchPayAllowance()
      tx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <UsernameCard address={address} />
      <div className="rounded-[20px] border border-neutral-200 bg-white p-6">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Send tUSDC</p>
        {contacts.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {contacts.map((c) => {
              const fav = favs.includes(c.address.toLowerCase())
              return (
                <span
                  key={c.address}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-neutral-200 py-1 pr-1 pl-3.5"
                >
                  <button
                    type="button"
                    onClick={() => setTo(c.label.startsWith("@") ? c.label : c.address)}
                    className="text-sm font-medium text-neutral-700 hover:text-neutral-950"
                  >
                    {c.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => onStar(c.address)}
                    aria-label={fav ? "Unfavorite" : "Favorite"}
                    className={fav ? "text-amber-500" : "text-neutral-300 hover:text-neutral-500"}
                  >
                    <Star className="size-3.5" fill="currentColor" />
                  </button>
                </span>
              )
            })}
          </div>
        )}
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
          <Field label="Note (optional)">
            <Input
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 140))}
              placeholder="Dinner, rent split…"
              maxLength={140}
              className="h-12 rounded-2xl border-neutral-200 text-base text-neutral-900 placeholder:text-neutral-400"
            />
          </Field>
          <Button
            disabled={!resolved.address || raw === null || tx.busy}
            onClick={send}
            className="h-12 w-full rounded-full bg-aero-800 text-[15px] font-medium text-white hover:bg-aero-900 disabled:opacity-60"
          >
            <Send className="size-4" />{" "}
            {tx.busy ? "Sending…" : needsPayApprove ? "Approve once, then send" : "Send"}
          </Button>
          <TxStatus hash={tx.hash} error={tx.error} />
        </div>
        {receipts.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-neutral-100 pt-4">
            <AnimatePresence initial={false}>
              {receipts.map((r) => (
                <motion.div key={r.hash} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-neutral-700">
                    {r.label} · <span className="tabular-nums">{r.amount}</span>
                    {r.memo && <span className="block truncate font-normal text-neutral-400">“{r.memo}”</span>}
                  </span>
                  <a href={snowtraceTx(r.hash)} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-aero-800 hover:underline">
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

export function PayTab({ address }: { address: Address }) {
  const [billId, setBillId] = useState(BILLS[0].id)
  const [to, setTo] = useState("")
  const [paid, setPaid] = useState<string[]>([])
  const resolved = useRecipient(to)
  const tx = useTx()
  const bill = BILLS.find((b) => b.id === billId)!
  const raw = parseUsdc(bill.amount)
  void address

  useEffect(() => {
    if (tx.done && tx.hash) {
      setPaid((p) => (p.includes(bill.id) ? p : [...p, bill.id]))
      pushActivity({ label: `${bill.label} → ${to.trim()}`, amount: `$${bill.amount}`, hash: tx.hash as string, to: resolved.address ?? undefined })
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
    </div>
  )
}

/* ------------------------------ router (auto) ----------------------------- */

function prettyMarket(id: string): string {
  const first = id.split("-")[0].toLowerCase()
  if (first === "benqi") return "Benqi market"
  if (first === "joe") return "Trader Joe market"
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Market"
}

function SlotRow({ index, total }: { index: number; total: bigint }) {
  const { data: slot } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "slots",
    args: [BigInt(index)],
  })
  const adapter = slot?.[0] as Address | undefined
  const targetBps = slot?.[1] as bigint | undefined
  const { data: bal } = useReadContract({
    address: adapter,
    abi: adapterAbi,
    functionName: "balance",
    query: { enabled: !!adapter },
  })
  const { data: mid } = useReadContract({
    address: adapter,
    abi: adapterAbi,
    functionName: "marketId",
    query: { enabled: !!adapter },
  })
  if (targetBps === undefined) return null
  const target = Number(targetBps) / 100
  const actual = total > BigInt(0) && typeof bal === "bigint" ? (Number(bal) / Number(total)) * 100 : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-neutral-800">{prettyMarket(typeof mid === "string" ? mid : "")}</span>
        <span className="font-mono text-neutral-500 tabular-nums">
          {actual.toFixed(1)}% <span className="text-neutral-300">/ target {target.toFixed(0)}%</span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-visible rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-aero-800 transition-all" style={{ width: `${Math.min(100, actual)}%` }} />
        <span className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-neutral-900" style={{ left: `${target}%` }} />
      </div>
    </div>
  )
}

export function RouterPanel({ address }: { address: Address }) {
  const [amount, setAmount] = useState("")
  const approveTx = useTx()
  const depositTx = useTx()
  const withdrawTx = useTx()

  const { data: apy, refetch: refetchApy } = useReadContract({ address: CONTRACTS.router, abi: routerAbi, functionName: "liveApyBps" })
  const { data: total, refetch: refetchTotal } = useReadContract({ address: CONTRACTS.router, abi: routerAbi, functionName: "totalAssets" })
  const { data: price } = useReadContract({ address: CONTRACTS.router, abi: routerAbi, functionName: "sharePrice" })
  const { data: myShares, refetch: refetchShares } = useReadContract({ address: CONTRACTS.router, abi: routerAbi, functionName: "balanceOf", args: [address] })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "allowance", args: [address, CONTRACTS.router] })

  if (!routerConfigured) return null

  const refresh = () => {
    refetchApy()
    refetchTotal()
    refetchShares()
    refetchAllowance()
  }
  const raw = parseUsdc(amount)
  const needsApprove = raw !== null && (allowance ?? BigInt(0)) < raw
  const myAssets = myShares && price ? (myShares * price) / BigInt(1e18) : undefined

  return (
    <div className="rounded-[20px] bg-aero-950 p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-white/50 uppercase">
          Auto-router · live allocation
        </p>
        <p className="font-mono text-4xl font-medium tracking-tight text-emerald-300 tabular-nums">
          {apy === undefined ? "—" : `${(Number(apy) / 100).toFixed(2)}%`}
        </p>
      </div>
      <div className="mt-5 space-y-4">
        <SlotRow index={0} total={typeof total === "bigint" ? total : BigInt(0)} />
        <SlotRow index={1} total={typeof total === "bigint" ? total : BigInt(0)} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 font-mono tabular-nums">
        <div>
          <p className="font-sans text-[13px] text-white/45">Your position</p>
          <p className="mt-1 text-xl">${formatUsdc(myAssets)}</p>
        </div>
        <div>
          <p className="font-sans text-[13px] text-white/45">Routed TVL</p>
          <p className="mt-1 text-xl">${formatUsdc(typeof total === "bigint" ? total : undefined)}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Router amount"
          className="h-12 flex-1 rounded-2xl border-white/20 bg-white/10 text-base text-white tabular-nums placeholder:text-white/40"
        />
        <div className="flex gap-2.5">
          <Button
            disabled={raw === null || approveTx.busy || depositTx.busy}
            onClick={() => {
              if (raw === null) return
              if (needsApprove) {
                approveTx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "approve", args: [CONTRACTS.router, maxUint256] })
              } else {
                depositTx.write({ address: CONTRACTS.router, abi: routerAbi, functionName: "deposit", args: [raw] })
              }
              refresh()
            }}
            className="h-12 flex-1 rounded-full bg-white px-6 font-medium text-aero-900 hover:bg-aero-50 disabled:opacity-60 sm:flex-none"
          >
            {approveTx.busy ? "…" : depositTx.busy ? "…" : needsApprove ? "Approve" : "Deposit"}
          </Button>
          <Button
            disabled={!myShares || withdrawTx.busy}
            onClick={() => {
              if (myShares) withdrawTx.write({ address: CONTRACTS.router, abi: routerAbi, functionName: "withdraw", args: [myShares] })
              refresh()
            }}
            variant="outline"
            className="h-12 shrink-0 rounded-full border-white/25 bg-transparent font-medium text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            {withdrawTx.busy ? "…" : "Withdraw all"}
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <TxStatus hash={approveTx.hash ?? depositTx.hash ?? withdrawTx.hash} error={approveTx.error ?? depositTx.error ?? withdrawTx.error} />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-white/45">
        Splits deposits across live markets by target weight and rebalances past the drift band. Same UX as the vaults below — one balance, one APY.
      </p>
    </div>
  )
}

/* --------------------------------- request -------------------------------- */

export function RequestTab({ address, go }: { address: Address; go: (t: TestnetTab) => void }) {
  const [amount, setAmount] = useState("")
  const [copied, setCopied] = useState(false)
  const { data: myName } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveUsername",
    args: [address],
  })

  const n = Number(amount)
  const valid = Number.isFinite(n) && n > 0 && n <= 1_000_000
  const link = myName ? `https://useaero.org/pay/@${myName}${valid ? `/${n}` : ""}` : ""

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const share = async () => {
    if (!link) return
    const nav = navigator as unknown as { share?: (d: { title: string; text: string; url: string }) => Promise<void> }
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Pay me with Aero", text: `Send ${valid ? `$${n}` : "money"} to @${myName}`, url: link })
        return
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    copy()
  }

  return (
    <div className="mx-auto max-w-2xl rounded-[20px] border border-neutral-200 bg-white p-6 sm:p-8">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Request money</p>
      {!myName ? (
        <div className="mt-4 rounded-2xl bg-[#f7f7f7] p-5 text-center">
          <p className="text-[15px] font-medium text-neutral-900">You need a handle first</p>
          <p className="mt-1 text-sm text-neutral-500">Payment links point at your @username.</p>
          <Button onClick={() => go("send")} className="mt-4 h-11 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900">
            Claim a handle
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <Field label="Amount (tUSDC, optional)">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))}
                inputMode="decimal"
                placeholder="25.00"
                className="h-12 rounded-2xl border-neutral-200 text-base tabular-nums placeholder:text-neutral-400"
              />
            </Field>
          </div>
          <div className="mt-5 rounded-2xl bg-[#f7f7f7] p-5 text-center">
            <div className="flex justify-center rounded-2xl bg-white p-4">
              <QRCodeSVG value={link} size={168} bgColor="#ffffff" fgColor="#171717" level="M" />
            </div>
            <p className="mt-4 truncate font-mono text-sm text-neutral-700">{link}</p>
            <div className="mt-4 flex justify-center gap-2.5">
              <Button onClick={copy} variant="outline" className="h-11 rounded-full border-neutral-300 px-6 font-medium">
                {copied ? (
                  <span className="inline-flex items-center gap-1.5"><Check className="size-4" strokeWidth={3} /> Copied</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5"><Copy className="size-4" /> Copy link</span>
                )}
              </Button>
              <Button onClick={share} className="h-11 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900">
                <Share className="size-4" /> Share
              </Button>
            </div>
          </div>
          <p className="mt-4 text-center text-[13px] text-neutral-400">
            Anyone opening the link can pay @{myName} — no app needed to view it.
          </p>
        </>
      )}
    </div>
  )
}

/* ---------------------------------- earn ---------------------------------- */

export function EarnTab({ address }: { address: Address }) {
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
    <div className="space-y-5">
      <RouterPanel address={address} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[20px] border border-neutral-200 bg-white p-6 sm:p-8">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">Mock vault</p>
          <p className="mt-2 font-mono text-6xl font-medium tracking-tight text-aero-800 tabular-nums">
            {rate === undefined ? "—" : `${(((Number(rate) * 31_557_600) / 1e18) * 100).toFixed(2)}%`}
          </p>
          <p className="mt-1.5 text-sm text-neutral-500">APR · simulated by contract, not live markets</p>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-5 tabular-nums">
            <div>
              <p className="text-[13px] text-neutral-500">Your position</p>
              <p className="mt-1 text-xl font-medium">${formatUsdc(myAssets)}</p>
            </div>
            <div>
              <p className="text-[13px] text-neutral-500">Vault TVL</p>
              <p className="mt-1 text-xl font-medium">${formatUsdc(tvl)}</p>
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
      <AdapterPanel address={address} />
    </div>
  )
}

/* ------------------------- live market (adapter) -------------------------- */

export function AdapterPanel({ address }: { address: Address }) {
  const [depositAmt, setDepositAmt] = useState("")
  const [withdrawAmt, setWithdrawAmt] = useState("")
  const approveTx = useTx()
  const depositTx = useTx()
  const withdrawTx = useTx()

  const { data: bps, refetch: refetchApy } = useReadContract({
    address: CONTRACTS.adapter, abi: adapterAbi, functionName: "liveApyBps",
  })
  const { data: tvl, refetch: refetchTvl } = useReadContract({
    address: CONTRACTS.adapter, abi: adapterAbi, functionName: "balance",
  })
  const { data: myShares, refetch: refetchShares } = useReadContract({
    address: CONTRACTS.adapter, abi: adapterAbi, functionName: "balanceOf", args: [address],
  })
  const { data: price } = useReadContract({
    address: CONTRACTS.adapter, abi: adapterAbi, functionName: "sharePrice",
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc, abi: usdcAbi, functionName: "allowance", args: [address, CONTRACTS.adapter],
  })

  if (!adapterConfigured) return null

  const refresh = () => {
    refetchApy()
    refetchTvl()
    refetchShares()
    refetchAllowance()
  }
  const depositRaw = parseUsdc(depositAmt)
  const needsApprove = depositRaw !== null && (allowance ?? BigInt(0)) < depositRaw
  const myAssets = myShares && price ? (myShares * price) / BigInt(1e18) : undefined
  const apy = bps !== undefined ? (Number(bps) / 100).toFixed(2) : "—"

  const doDeposit = () => {
    if (depositRaw === null) return
    if (needsApprove) {
      approveTx.write({ address: CONTRACTS.usdc, abi: usdcAbi, functionName: "approve", args: [CONTRACTS.adapter, maxUint256] })
    } else {
      depositTx.write({ address: CONTRACTS.adapter, abi: adapterAbi, functionName: "deposit", args: [depositRaw] })
    }
  }

  const withdrawRaw = parseUsdc(withdrawAmt)
  const doWithdraw = (all: boolean) => {
    if (all && myShares) {
      withdrawTx.write({ address: CONTRACTS.adapter, abi: adapterAbi, functionName: "withdraw", args: [myShares] })
    } else if (withdrawRaw !== null && price) {
      withdrawTx.write({ address: CONTRACTS.adapter, abi: adapterAbi, functionName: "withdraw", args: [(withdrawRaw * BigInt(1e18)) / price] })
    }
  }

  return (
    <div className="rounded-[20px] border border-aero-200 bg-aero-50/50 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-aero-800 uppercase">
          Live market · Benqi adapter
        </p>
        <p className="font-mono text-3xl font-medium text-aero-800 tabular-nums">{apy}%</p>
      </div>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-600">
        Real on-chain rate from a Compound-style market via our adapter — the same code
        proven against Benqi&apos;s mainnet qiUSDCn. Your position:{" "}
        <span className="font-semibold text-neutral-900 tabular-nums">${formatUsdc(myAssets)}</span>
        {" · "}market TVL: <span className="tabular-nums">${formatUsdc(tvl)}</span>.
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <div className="flex gap-2.5">
          <Input
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            inputMode="decimal"
            placeholder="Deposit tUSDC"
            aria-label="Deposit amount"
            className="h-11 flex-1 rounded-2xl border-neutral-200 bg-white text-[15px] tabular-nums placeholder:text-neutral-400"
          />
          <Button
            disabled={depositRaw === null || approveTx.busy || depositTx.busy}
            onClick={() => { doDeposit(); refresh() }}
            className="h-11 shrink-0 rounded-full bg-aero-800 px-5 text-sm font-medium text-white hover:bg-aero-900 disabled:opacity-60"
          >
            {approveTx.busy ? "…" : depositTx.busy ? "…" : needsApprove ? "Approve" : "Supply"}
          </Button>
        </div>
        <div className="flex gap-2.5">
          <Input
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            inputMode="decimal"
            placeholder="Withdraw tUSDC"
            aria-label="Withdraw amount"
            className="h-11 flex-1 rounded-2xl border-neutral-200 bg-white text-[15px] tabular-nums placeholder:text-neutral-400"
          />
          <Button
            disabled={(!withdrawRaw && !myShares) || withdrawTx.busy}
            onClick={() => { doWithdraw(!withdrawAmt); refresh() }}
            className="h-11 shrink-0 rounded-full border border-neutral-300 bg-white px-5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-60"
          >
            {withdrawTx.busy ? "…" : withdrawAmt ? "Withdraw" : "All"}
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <TxStatus hash={approveTx.hash ?? depositTx.hash ?? withdrawTx.hash} error={approveTx.error ?? depositTx.error ?? withdrawTx.error} />
      </div>
    </div>
  )
}
