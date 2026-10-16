"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import { maxUint256, zeroAddress, type Address } from "viem"
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Droplets,
  ExternalLink,
  HandCoins,
  Landmark,
  QrCode,
  Send,
  Share,
  Star,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  adapterAbi,
  namesAbi,
  payAbi,
  routerAbi,
  usdcAbi,
  vaultAbi,
} from "@/lib/contracts"
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
import { pushNotice } from "@/lib/notifications"
import {
  buildContacts,
  getFavorites,
  toggleFavorite,
  type Contact,
} from "@/lib/contacts"
import { BuySheet } from "./buy-sheet"
import { QRCodeSVG } from "qrcode.react"
import type { TestnetTab } from "@/app/testnet/page"

/* ---------------------------------- atoms --------------------------------- */

export function useTx() {
  const {
    data: hash,
    writeContract,
    isPending,
    error,
    reset,
  } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })
  return {
    hash,
    write: writeContract,
    busy: isPending || confirming,
    done: isSuccess,
    error,
    reset,
  }
}

/** Run fn at most once per tx hash (effects refire; notices must not). */
function useOncePerHash() {
  const seen = useRef<Set<string>>(new Set())
  return (hash: string | undefined, fn: () => void) => {
    if (hash && !seen.current.has(hash)) {
      seen.current.add(hash)
      fn()
    }
  }
}

export function TxStatus({
  hash,
  error,
}: {
  hash: `0x${string}` | undefined
  error: Error | null
}) {
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

export function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

/** Resolves "@name or 0x…" input to an address via the on-chain registry. */
export function useRecipient(input: string): {
  address: Address | null
  hint: string
} {
  const t = input.trim()
  const { data } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveAddress",
    args: [normalizeUsername(t)],
    query: { enabled: t.length > 0 && !isAddress(t) },
  })
  if (!t) return { address: null, hint: "" }
  if (isAddress(t))
    return { address: t as Address, hint: "Raw address — double-check it" }
  if (!isUsername(t))
    return {
      address: null,
      hint: "Usernames are 3–20 lowercase letters, numbers, _",
    }
  if (data === undefined) return { address: null, hint: "Looking up…" }
  if (data === zeroAddress) return { address: null, hint: "Not registered yet" }
  return { address: data, hint: "Registered on-chain" }
}

/* --------------------------------- faucet --------------------------------- */

export function FaucetMini({ address }: { address: Address }) {
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
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(
      () => setNowSec(Math.floor(Date.now() / 1000)),
      60_000
    )
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (tx.done) {
      refetch()
      if (tx.hash)
        pushActivity({
          label: "Faucet claim",
          amount: "+10,000 tUSDC",
          hash: tx.hash,
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  const nextIn =
    lastClaim !== undefined ? Number(lastClaim) + 86400 - nowSec : 0
  const ready = nextIn <= 0

  return (
    <div className="rounded-2xl bg-[#f7f7f7] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Droplets className="size-3.5" /> Test dollars
        </p>
        <p className="font-mono text-sm font-semibold text-neutral-900 tabular-nums">
          ${formatUsdc(balance)}
        </p>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        <Button
          disabled={!ready || tx.busy}
          onClick={() =>
            tx.write({
              address: CONTRACTS.usdc,
              abi: usdcAbi,
              functionName: "faucet",
            })
          }
          className="h-8 flex-1 rounded-full bg-aero-800 px-3 text-xs font-medium text-white hover:bg-aero-900 disabled:bg-neutral-200 disabled:text-neutral-400"
        >
          {tx.busy
            ? "Claiming…"
            : ready
              ? "Claim 10,000"
              : `Next in ${Math.ceil(nextIn / 3600)}h`}
        </Button>
        <Button
          onClick={() => setBuyOpen(true)}
          variant="outline"
          className="h-8 rounded-full border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Buy
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        Free every 24h · worthless ·{" "}
        <a
          href={FUJI_AVAX_FAUCET}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-aero-800 hover:underline"
        >
          AVAX for gas <ArrowUpRight className="inline size-2.5" />
        </a>
      </p>
      {(tx.hash || tx.error) && (
        <div className="mt-1.5">
          <TxStatus hash={tx.hash} error={tx.error} />
        </div>
      )}
      <BuySheet open={buyOpen} onOpenChange={setBuyOpen} />
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
    // Tx-completion handlers sync wallet-tx state into form state — event-like, not derived.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (tx.done) {
      refetch()
      setName("")
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  const available =
    isUsername(name) && takenBy !== undefined && takenBy === zeroAddress
  return (
    <div className="rounded-[20px] border border-neutral-200 bg-white p-6">
      <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
        Your handle
      </p>
      {mine ? (
        <p className="mt-2 text-2xl font-medium tracking-tight">
          @{mine}{" "}
          <span className="text-sm font-normal text-neutral-400">
            · yours on Fuji
          </span>
        </p>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-neutral-600">
            No handle yet — claim one. It&apos;s yours across the testnet app.
          </p>
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
              onClick={() =>
                tx.write({
                  address: CONTRACTS.names,
                  abi: namesAbi,
                  functionName: "register",
                  args: [clean],
                })
              }
              className="h-12 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:opacity-60"
            >
              {tx.busy ? "Claiming…" : "Claim handle"}
            </Button>
          </div>
          {isUsername(name) && (
            <p
              className={`mt-2 text-[13px] font-medium ${available ? "text-emerald-600" : "text-neutral-400"}`}
            >
              {takenBy === undefined
                ? "Checking availability…"
                : available
                  ? `@${clean} is available`
                  : `@${clean} is taken — try another`}
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
  const [amount, setAmount] = useState(() => {
    if (initialAmount) return initialAmount
    try {
      const raw = window.localStorage.getItem("aero_send_prefill")
      if (!raw) return ""
      window.localStorage.removeItem("aero_send_prefill")
      const amt = (JSON.parse(raw) as { amount?: unknown }).amount
      return typeof amt === "string" ? amt : ""
    } catch {
      return ""
    }
  })
  const [memo, setMemo] = useState("")
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [favs, setFavs] = useState<string[]>(() => getFavorites())
  const resolved = useRecipient(to)
  const tx = useTx()
  const raw = parseUsdc(amount)
  const { data: myName } = useReadContract({
    address: CONTRACTS.names,
    abi: namesAbi,
    functionName: "resolveUsername",
    args: [address],
  })
  const { data: walletBal } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const maxStr = (() => {
    if (walletBal === undefined) return null
    const whole = walletBal / BigInt(1_000_000)
    const frac = (walletBal % BigInt(1_000_000))
      .toString()
      .padStart(6, "0")
      .replace(/0+$/, "")
    return frac ? `${whole}.${frac}` : `${whole}`
  })()
  const rail = [...contacts].sort(
    (a, b) =>
      Number(favs.includes(b.address.toLowerCase())) -
      Number(favs.includes(a.address.toLowerCase()))
  )

  const { data: payAllowance, refetch: refetchPayAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "allowance",
    args: [address, CONTRACTS.pay],
    query: { enabled: payConfigured },
  })
  const needsPayApprove =
    payConfigured && raw !== null && (payAllowance ?? BigInt(0)) < raw

  const reloadContacts = () => {
    buildContacts([])
      .then(setContacts)
      .catch(() => {})
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
        tx.write({
          address: CONTRACTS.usdc,
          abi: usdcAbi,
          functionName: "approve",
          args: [CONTRACTS.pay, maxUint256],
        })
        return
      }
      if (!isAddress(to.trim())) {
        tx.write({
          address: CONTRACTS.pay,
          abi: payAbi,
          functionName: "payUsername",
          args: [
            CONTRACTS.names,
            CONTRACTS.usdc,
            normalizeUsername(to),
            raw,
            note,
          ],
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
    tx.write({
      address: CONTRACTS.usdc,
      abi: usdcAbi,
      functionName: "transfer",
      args: [resolved.address, raw],
    })
  }

  useEffect(() => {
    // Tx-completion handler: recording the receipt is event-like, not derived state.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (tx.done && tx.hash && raw !== null && resolved.address) {
      const r = {
        label: `You → ${to.trim()}`,
        amount: `$${amount}`,
        hash: tx.hash as string,
        memo: memo.trim() || undefined,
      }
      setReceipts((prev) => [r, ...prev].slice(0, 4))
      pushActivity({ ...r, to: resolved.address })
      setAmount("")
      setMemo("")
      reloadContacts()
      refetchPayAllowance()
      tx.reset()
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  return (
    <div className="space-y-5">
      {myName === undefined ? (
        <div className="h-24 animate-pulse rounded-[20px] border border-neutral-200 bg-white" />
      ) : myName ? null : (
        <UsernameCard address={address} />
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
        <div className="px-1 py-2 sm:px-8">
          <div className="flex items-start justify-center">
            <span className="mt-4 text-3xl font-medium text-neutral-300 select-none">
              $
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              aria-label="Amount in tUSDC"
              style={{
                width: `${Math.max(1.2, (amount || "0").length + 0.3)}ch`,
              }}
              className="max-w-full min-w-0 bg-transparent text-center text-7xl font-medium tracking-tight text-neutral-900 tabular-nums outline-none placeholder:text-neutral-200"
            />
          </div>
          <p className="mt-1 text-center text-[13px] text-neutral-400 tabular-nums">
            {walletBal !== undefined
              ? `$${formatUsdc(walletBal)} available`
              : "Checking balance…"}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["10", "25", "50", "100"].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className={cn(
                  "h-9 rounded-full border px-4 text-sm font-medium tabular-nums transition",
                  amount === q
                    ? "border-aero-800 bg-aero-800 text-white"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                )}
              >
                ${q}
              </button>
            ))}
            {maxStr && (
              <button
                type="button"
                onClick={() => setAmount(maxStr)}
                className="h-9 rounded-full border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-600 transition hover:border-neutral-400"
              >
                Max
              </button>
            )}
          </div>

          <div className="mt-8 border-t border-neutral-200 pt-6">
            {resolved.address ? (
              <div className="flex items-center gap-3 py-1">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-neutral-900">
                    {isAddress(to.trim())
                      ? `${to.trim().slice(0, 6)}…${to.trim().slice(-4)}`
                      : `@${normalizeUsername(to)}`}
                  </p>
                  <a
                    href={`https://testnet.snowtrace.io/address/${resolved.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-emerald-700 hover:underline"
                  >
                    {resolved.hint} · {resolved.address.slice(0, 6)}…
                    {resolved.address.slice(-4)}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setTo("")}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Who's getting it? @username or 0x…"
                  aria-label="Recipient"
                  className="h-14 w-full border-b border-neutral-200 bg-transparent text-center text-lg text-neutral-900 outline-none placeholder:text-neutral-300 focus:border-aero-800"
                />
                {resolved.hint && (
                  <p className="mt-2 text-center text-[13px] text-neutral-400">
                    {resolved.hint}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="mt-6 border-t border-neutral-200 pt-6">
            <div className="flex flex-wrap justify-center gap-2">
              {["Dinner", "Rent", "Drinks", "Gift", "Payback"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMemo(m)}
                  className={cn(
                    "h-8 rounded-full px-3.5 text-[13px] font-medium transition",
                    memo === m
                      ? "bg-neutral-900 text-white"
                      : "bg-[#f4f4f4] text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 140))}
              placeholder="Add a note…"
              maxLength={140}
              aria-label="Note"
              className="mt-3 h-12 w-full border-b border-neutral-200 bg-transparent text-center text-[15px] text-neutral-900 outline-none placeholder:text-neutral-300 focus:border-aero-800"
            />
          </div>

          <Button
            disabled={!resolved.address || raw === null || tx.busy}
            onClick={send}
            className="mt-6 h-13 w-full rounded-full bg-aero-800 p-3.5 text-[16px] font-medium text-white hover:bg-aero-900 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            <Send className="size-4" />{" "}
            {tx.busy
              ? "Sending…"
              : needsPayApprove
                ? "Approve once, then send"
                : resolved.address && raw !== null
                  ? `Send $${amount} → ${to.trim()}`
                  : "Send"}
          </Button>
          <div className="mt-3 text-center">
            <TxStatus hash={tx.hash} error={tx.error} />
          </div>
        </div>

        <div className="space-y-5">
          {rail.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                People
              </p>
              <div className="mt-1 divide-y divide-neutral-200 border-y border-neutral-200">
                {rail.slice(0, 8).map((c) => {
                  const fav = favs.includes(c.address.toLowerCase())
                  const initials = c.label.startsWith("@")
                    ? c.label.slice(1, 3).toUpperCase()
                    : c.label.slice(0, 2).toUpperCase()
                  const hue =
                    [...c.address].reduce((n, ch) => n + ch.charCodeAt(0), 0) %
                    360
                  const active =
                    to === (c.label.startsWith("@") ? c.label : c.address)
                  return (
                    <div
                      key={c.address}
                      className="flex items-center gap-1 rounded-2xl px-2 py-1 transition hover:bg-[#f4f4f4]"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setTo(c.label.startsWith("@") ? c.label : c.address)
                        }
                        aria-label={`Send to ${c.label}`}
                        className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left"
                      >
                        <span
                          style={{
                            backgroundColor: `hsl(${hue} 45% 92%)`,
                            color: `hsl(${hue} 55% 32%)`,
                          }}
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            active && "ring-2 ring-aero-800 ring-offset-2"
                          )}
                        >
                          {initials}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-neutral-900">
                            {c.label}
                          </span>
                          <span className="block truncate font-mono text-xs text-neutral-400">
                            {c.address.slice(0, 6)}…{c.address.slice(-4)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onStar(c.address)}
                        aria-label={fav ? "Unfavorite" : "Favorite"}
                        className={
                          fav
                            ? "shrink-0 p-1.5 text-amber-500"
                            : "shrink-0 p-1.5 text-neutral-300 hover:text-neutral-500"
                        }
                      >
                        <Star className="size-4" fill="currentColor" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {receipts.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                Sent
              </p>
              <AnimatePresence initial={false}>
                {receipts.map((r) => (
                  <motion.div
                    key={r.hash}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between gap-3 border-t border-neutral-200 py-3 text-sm last:border-b"
                  >
                    <span className="min-w-0 truncate font-medium text-neutral-700">
                      {r.label} ·{" "}
                      <span className="tabular-nums">{r.amount}</span>
                      {r.memo && (
                        <span className="block truncate font-normal text-neutral-400">
                          “{r.memo}”
                        </span>
                      )}
                    </span>
                    <a
                      href={snowtraceTx(r.hash)}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-medium text-aero-800 hover:underline"
                    >
                      Receipt
                    </a>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------- pay ---------------------------------- */

const BILLS = [
  {
    id: "rent",
    label: "Maple Apartments",
    tag: "Rent",
    amount: "1400",
    due: "Due Nov 1",
    color: "hsl(258 70% 88%)",
    ink: "hsl(258 60% 32%)",
  },
  {
    id: "power",
    label: "City Power & Light",
    tag: "Utilities",
    amount: "86.20",
    due: "Due Nov 8",
    color: "hsl(48 80% 88%)",
    ink: "hsl(38 70% 30%)",
  },
  {
    id: "freelancer",
    label: "@lena · invoice #042",
    tag: "Invoice",
    amount: "320",
    due: "Due on receipt",
    color: "hsl(160 50% 86%)",
    ink: "hsl(165 55% 26%)",
  },
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
    // Tx-completion handler: marking the bill paid is event-like, not derived state.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (tx.done && tx.hash) {
      setPaid((p) => (p.includes(bill.id) ? p : [...p, bill.id]))
      pushActivity({
        label: `${bill.label} → ${to.trim()}`,
        amount: `$${bill.amount}`,
        hash: tx.hash as string,
        to: resolved.address ?? undefined,
      })
      tx.reset()
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.done])

  const open = BILLS.filter((b) => !paid.includes(b.id))
  const dueTotal = open.reduce((n, b) => n + Number(b.amount), 0)

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] bg-aero-950 p-6 text-white sm:p-8">
        <div className="flex items-center gap-2 text-white/50">
          <Landmark className="size-4" />
          <p className="text-[13px] font-semibold tracking-[0.14em] uppercase">
            Bills
          </p>
        </div>
        <p className="mt-3 text-6xl font-medium tracking-tight tabular-nums">
          $
          {dueTotal.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p className="mt-2 text-[15px] text-white/55">
          {open.length === 0
            ? "All clear — nothing due."
            : `${open.length} bill${open.length === 1 ? "" : "s"} open · pay straight from test balance`}
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-2.5">
          {BILLS.map((b) => {
            const done = paid.includes(b.id)
            const selected = billId === b.id
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setBillId(b.id)}
                className={cn(
                  "flex w-full items-center gap-4 rounded-[20px] border bg-white p-4 text-left transition",
                  selected
                    ? "border-aero-800 shadow-[0_0_0_1px_var(--color-aero-800)]"
                    : "border-neutral-200 hover:border-neutral-300",
                  done && "opacity-70"
                )}
              >
                <span
                  style={{ backgroundColor: b.color, color: b.ink }}
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
                >
                  {b.label.replace("@", "").charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-neutral-900">
                    {b.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-neutral-400">
                    {b.tag} · {b.due}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-medium tabular-nums">
                    ${b.amount}
                  </span>
                  {done ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600">
                      <Check className="size-3.5" strokeWidth={3} /> Paid
                    </span>
                  ) : selected ? (
                    <span className="mt-0.5 block text-[13px] font-medium text-aero-800">
                      Selected
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>

        <div className="rounded-[20px] border border-neutral-200 bg-white p-6 xl:sticky xl:top-6">
          <Field label={`Paying ${bill.label} to`}>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="@landlord or 0x…"
              className="h-12 rounded-2xl border-neutral-200 text-base text-neutral-900 placeholder:text-neutral-400"
            />
          </Field>
          {resolved.hint && (
            <p
              className={cn(
                "mt-1.5 text-[13px]",
                resolved.address
                  ? "font-medium text-emerald-600"
                  : "text-neutral-400"
              )}
            >
              {resolved.hint}
            </p>
          )}
          <Button
            disabled={!resolved.address || raw === null || tx.busy}
            onClick={() =>
              resolved.address &&
              raw !== null &&
              tx.write({
                address: CONTRACTS.usdc,
                abi: usdcAbi,
                functionName: "transfer",
                args: [resolved.address, raw],
              })
            }
            className="mt-4 h-12 w-full rounded-full bg-aero-800 text-[15px] font-medium text-white hover:bg-aero-900 disabled:opacity-60"
          >
            {tx.busy
              ? "Paying…"
              : resolved.address
                ? `Pay $${bill.amount} → ${to.trim()}`
                : `Pay $${bill.amount}`}
          </Button>
          <div className="mt-3">
            <TxStatus hash={tx.hash} error={tx.error} />
          </div>
        </div>
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
  const actual =
    total > BigInt(0) && typeof bal === "bigint"
      ? (Number(bal) / Number(total)) * 100
      : 0
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-neutral-800">
          {prettyMarket(typeof mid === "string" ? mid : "")}
        </span>
        <span className="font-mono text-neutral-500 tabular-nums">
          {actual.toFixed(1)}%{" "}
          <span className="text-neutral-300">
            / target {target.toFixed(0)}%
          </span>
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-visible rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full bg-aero-800 transition-all"
          style={{ width: `${Math.min(100, actual)}%` }}
        />
        <span
          className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded bg-neutral-900"
          style={{ left: `${target}%` }}
        />
      </div>
    </div>
  )
}

export function RouterPanel({ address }: { address: Address }) {
  const [amount, setAmount] = useState("")
  const approveTx = useTx()
  const depositTx = useTx()
  const withdrawTx = useTx()
  const notifyOnce = useOncePerHash()

  const { data: apy, refetch: refetchApy } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "liveApyBps",
  })
  const { data: total, refetch: refetchTotal } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "totalAssets",
  })
  const { data: price } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "sharePrice",
  })
  const { data: myShares, refetch: refetchShares } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "allowance",
    args: [address, CONTRACTS.router],
  })

  const refresh = () => {
    refetchApy()
    refetchTotal()
    refetchShares()
    refetchAllowance()
  }
  const raw = parseUsdc(amount)
  const needsApprove = raw !== null && (allowance ?? BigInt(0)) < raw
  const myAssets =
    myShares && price ? (myShares * price) / BigInt(1e18) : undefined

  useEffect(() => {
    if (depositTx.done) {
      refetchApy()
      refetchTotal()
      refetchShares()
      refetchAllowance()
      notifyOnce(depositTx.hash, () =>
        pushNotice(
          `Auto-earn deposited $${amount || "0"} into the router`,
          "Split across live markets automatically."
        )
      )
      depositTx.reset()
    }
    if (withdrawTx.done) {
      refetchApy()
      refetchTotal()
      refetchShares()
      withdrawTx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTx.done, withdrawTx.done])

  if (!routerConfigured) return null

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
        <SlotRow
          index={0}
          total={typeof total === "bigint" ? total : BigInt(0)}
        />
        <SlotRow
          index={1}
          total={typeof total === "bigint" ? total : BigInt(0)}
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 font-mono tabular-nums">
        <div>
          <p className="font-sans text-[13px] text-white/45">Your position</p>
          <p className="mt-1 text-xl">${formatUsdc(myAssets)}</p>
        </div>
        <div>
          <p className="font-sans text-[13px] text-white/45">Routed TVL</p>
          <p className="mt-1 text-xl">
            ${formatUsdc(typeof total === "bigint" ? total : undefined)}
          </p>
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
                approveTx.write({
                  address: CONTRACTS.usdc,
                  abi: usdcAbi,
                  functionName: "approve",
                  args: [CONTRACTS.router, maxUint256],
                })
              } else {
                depositTx.write({
                  address: CONTRACTS.router,
                  abi: routerAbi,
                  functionName: "deposit",
                  args: [raw],
                })
              }
              refresh()
            }}
            className="pressable h-12 flex-1 rounded-full bg-white px-6 font-medium text-aero-900 hover:bg-aero-50 disabled:opacity-60 sm:flex-none"
          >
            {approveTx.busy
              ? "…"
              : depositTx.busy
                ? "…"
                : needsApprove
                  ? "Approve"
                  : "Deposit"}
          </Button>
          <Button
            disabled={!myShares || withdrawTx.busy}
            onClick={() => {
              if (myShares)
                withdrawTx.write({
                  address: CONTRACTS.router,
                  abi: routerAbi,
                  functionName: "withdraw",
                  args: [myShares],
                })
              refresh()
            }}
            variant="outline"
            className="pressable h-12 shrink-0 rounded-full border-white/25 bg-transparent font-medium text-white hover:bg-white/10 hover:text-white disabled:opacity-60"
          >
            {withdrawTx.busy ? "…" : "Withdraw all"}
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <TxStatus
          hash={approveTx.hash ?? depositTx.hash ?? withdrawTx.hash}
          error={approveTx.error ?? depositTx.error ?? withdrawTx.error}
        />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-white/45">
        Splits deposits across live markets by target weight and rebalances past
        the drift band. Same UX as the vaults below — one balance, one APY.
      </p>
    </div>
  )
}

/* --------------------------------- request -------------------------------- */

export function RequestTab({
  address,
  go,
}: {
  address: Address
  go: (t: TestnetTab) => void
}) {
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
  const link = myName
    ? `https://useaero.org/pay/@${myName}${valid ? `/${n}` : ""}`
    : ""

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
    const nav = navigator as unknown as {
      share?: (d: { title: string; text: string; url: string }) => Promise<void>
    }
    if (typeof nav.share === "function") {
      try {
        await nav.share({
          title: "Pay me with Aero",
          text: `Send ${valid ? `$${n}` : "money"} to @${myName}`,
          url: link,
        })
        return
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    copy()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-medium tracking-tight">Request money</h2>
        <p className="mt-1 text-[15px] text-neutral-500">
          A link anyone can open — no app needed to view it.
        </p>
      </div>
      {!myName ? (
        <div className="rounded-[20px] border border-neutral-200 bg-white p-6 text-center sm:p-8">
          <p className="text-[15px] font-medium text-neutral-900">
            You need a handle first
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Payment links point at your @username.
          </p>
          <Button
            onClick={() => go("send")}
            className="pressable mt-4 h-11 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900"
          >
            Claim a handle
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[320px_1fr_320px]">
          <div className="h-fit py-1">
            <Field label="Amount (tUSDC, optional)">
              <input
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
                }
                inputMode="decimal"
                placeholder="25.00"
                aria-label="Amount in tUSDC"
                className="h-14 w-full border-b border-neutral-200 bg-transparent text-3xl font-medium tabular-nums outline-none placeholder:text-neutral-300 focus:border-aero-800"
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              {["5", "10", "25", "50"].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q)}
                  className={cn(
                    "h-9 rounded-full border px-4 text-sm font-medium tabular-nums transition",
                    amount === q
                      ? "border-aero-800 bg-aero-800 text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                  )}
                >
                  ${q}
                </button>
              ))}
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount("")}
                  className="h-9 rounded-full border border-dashed border-neutral-300 px-4 text-sm font-medium text-neutral-500 transition hover:border-neutral-400"
                >
                  Any amount
                </button>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
                <HandCoins className="size-3.5" /> What they&apos;ll see
              </p>
              <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[20px] border border-neutral-200 bg-aero-950 text-white">
                <div className="flex items-center gap-3 p-5">
                  <span className="flex size-11 items-center justify-center rounded-full bg-white text-sm font-bold text-aero-900">
                    {myName.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">
                      @{myName}
                    </p>
                    <p className="text-[13px] text-white/50">is requesting</p>
                  </div>
                  <p className="ml-auto text-3xl font-medium tracking-tight tabular-nums">
                    {valid ? `$${n}` : "$—"}
                  </p>
                </div>
                <div className="border-t border-white/10 p-4">
                  <div className="h-11 rounded-full bg-white text-center text-[15px] leading-11 font-medium text-aero-900">
                    Pay @{myName}
                  </div>
                  <p className="mt-3 truncate text-center font-mono text-xs text-white/40">
                    {link}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="h-fit py-1 lg:sticky lg:top-6">
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
              <QrCode className="size-3.5" /> Scan or share
            </p>
            <div className="flex justify-center py-2">
              <QRCodeSVG
                value={link}
                size={168}
                bgColor="#ffffff"
                fgColor="#171717"
                level="M"
              />
            </div>
            <div className="mt-4 grid gap-2.5">
              <Button
                onClick={share}
                className="pressable h-11 w-full rounded-full bg-aero-800 font-medium text-white hover:bg-aero-900"
              >
                <Share className="size-4" /> Share link
              </Button>
              <Button
                onClick={copy}
                variant="outline"
                className="h-11 w-full rounded-full border-neutral-300 font-medium"
              >
                {copied ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-4" strokeWidth={3} /> Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Copy className="size-4" /> Copy link
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------- earn ---------------------------------- */

/* -------------------------------- auto-earn -------------------------------- */

function AutoEarn({ address }: { address: Address }) {
  const [autoOn, setAutoOn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("aero_auto_earn") !== "0"
    } catch {
      return true
    }
  })
  const approveTx = useTx()
  const depositTx = useTx()

  const { data: usdc, refetch: refetchUsdc } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: rate } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "ratePerSecond",
  })
  const { data: bps } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "liveApyBps",
    query: { enabled: adapterConfigured },
  })
  const { data: vaultShares, refetch: refetchVault } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: adapterShares, refetch: refetchAdapter } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: adapterConfigured },
  })

  useEffect(() => {
    if (depositTx.done) {
      refetchUsdc()
      refetchVault()
      refetchAdapter()
      depositTx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTx.done])

  const toggle = (v: boolean) => {
    setAutoOn(v)
    try {
      window.localStorage.setItem("aero_auto_earn", v ? "1" : "0")
    } catch {
      /* ignore */
    }
  }

  const vaultApr =
    rate !== undefined ? ((Number(rate) * 31_557_600) / 1e18) * 100 : null
  const adapterApr = bps !== undefined ? Number(bps) / 100 : null
  const best: "vault" | "adapter" | null =
    vaultApr === null
      ? null
      : adapterApr === null || !adapterConfigured
        ? "vault"
        : adapterApr >= vaultApr
          ? "adapter"
          : "vault"
  const bestApy = best === "adapter" ? adapterApr : vaultApr
  const venue = best === "adapter" ? CONTRACTS.adapter : CONTRACTS.vault
  const venueAbi = best === "adapter" ? adapterAbi : vaultAbi

  const { data: venueAllowance, refetch: refetchVenueAllowance } =
    useReadContract({
      address: CONTRACTS.usdc,
      abi: usdcAbi,
      functionName: "allowance",
      args: [address, venue],
    })
  useEffect(() => {
    if (approveTx.done) {
      refetchVenueAllowance()
      approveTx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveTx.done])

  const available = usdc ?? BigInt(0)
  const idle = available > BigInt(10_000_000)
  const working =
    (vaultShares ?? BigInt(0)) > BigInt(0) ||
    (adapterShares ?? BigInt(0)) > BigInt(0)

  const addAll = () => {
    if (available <= BigInt(0) || approveTx.busy || depositTx.busy) return
    if ((venueAllowance ?? BigInt(0)) < available) {
      approveTx.write({
        address: CONTRACTS.usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [venue, maxUint256],
      })
    } else {
      depositTx.write({
        address: venue,
        abi: venueAbi,
        functionName: "deposit",
        args: [available],
      } as never)
    }
  }

  return (
    <div className="border-y border-neutral-200 py-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold text-neutral-900">
            Auto-earn
          </p>
          <p className="mt-0.5 text-[13px] text-neutral-500">
            {best !== null ? (
              <>
                Best rate right now ·{" "}
                <span className="font-medium text-emerald-600">
                  {best === "adapter" ? "Benqi adapter" : "Mock vault"}{" "}
                  {bestApy!.toFixed(2)}%
                </span>
              </>
            ) : (
              "Comparing live rates…"
            )}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoOn}
          aria-label="Auto-earn"
          onClick={() => toggle(!autoOn)}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition",
            autoOn ? "bg-emerald-500" : "bg-neutral-200"
          )}
        >
          <motion.span
            layout
            animate={{ x: autoOn ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="absolute top-1 left-1 size-5 rounded-full bg-white shadow"
          />
        </button>
      </div>

      {autoOn && (
        <div className="mt-4">
          {idle ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[15px] leading-relaxed text-neutral-700">
                Your{" "}
                <span className="font-semibold tabular-nums">
                  ${formatUsdc(available)}
                </span>{" "}
                is sitting idle. Auto-earn{" "}
                {best === "adapter" ? "is routing it" : "would route it"} to the
                best rate.
              </p>
              <Button
                disabled={approveTx.busy || depositTx.busy}
                onClick={addAll}
                className="h-11 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:bg-neutral-100 disabled:text-neutral-400"
              >
                {approveTx.busy
                  ? "Approving…"
                  : depositTx.busy
                    ? "Depositing…"
                    : `Add $${formatUsdc(available)}`}
              </Button>
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed text-neutral-700">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                {working ? "Your balance is working." : "Auto-earn is on."}
              </span>{" "}
              {working
                ? "Every idle dollar is routed to the best live rate."
                : "Fund your balance and it will be routed automatically."}
            </p>
          )}
          <div className="mt-2">
            <TxStatus
              hash={approveTx.hash ?? depositTx.hash}
              error={approveTx.error ?? depositTx.error}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function EarnTab({ address }: { address: Address }) {
  const [depositAmt, setDepositAmt] = useState("")
  const [withdrawAmt, setWithdrawAmt] = useState("")
  const [venue, setVenue] = useState<"router" | "vault" | "market">(
    routerConfigured ? "router" : "vault"
  )
  const approveTx = useTx()
  const depositTx = useTx()
  const withdrawTx = useTx()
  const notifyOnce = useOncePerHash()

  const { data: rate, refetch: refetchRate } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "ratePerSecond",
  })
  const { data: shares, refetch: refetchShares } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: index } = useReadContract({
    address: CONTRACTS.vault,
    abi: vaultAbi,
    functionName: "index",
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "allowance",
    args: [address, CONTRACTS.vault],
  })
  const { data: tvl } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [CONTRACTS.vault],
  })
  const { data: adapterBps } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "liveApyBps",
    query: { enabled: adapterConfigured },
  })
  const { data: adapterShares } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: adapterConfigured },
  })
  const { data: adapterPrice } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "sharePrice",
    query: { enabled: adapterConfigured },
  })
  const { data: routerApy } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "liveApyBps",
    query: { enabled: routerConfigured },
  })
  const { data: routerShares } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: routerConfigured },
  })
  const { data: routerPrice } = useReadContract({
    address: CONTRACTS.router,
    abi: routerAbi,
    functionName: "sharePrice",
    query: { enabled: routerConfigured },
  })

  const refresh = () => {
    refetchRate()
    refetchShares()
    refetchAllowance()
  }
  useEffect(() => {
    if (depositTx.done || withdrawTx.done) refresh()
    if (depositTx.done && depositTx.hash) {
      notifyOnce(depositTx.hash, () =>
        pushNotice(
          `Auto-earn deposited $${depositAmt || "0"} — now earning`,
          rate !== undefined
            ? `Around ${(((Number(rate) * 31_557_600) / 1e18) * 100).toFixed(2)}% APR in the mock vault.`
            : "Your balance is working."
        )
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTx.done, withdrawTx.done])

  const depositRaw = parseUsdc(depositAmt)
  const needsApprove =
    depositRaw !== null && (allowance ?? BigInt(0)) < depositRaw
  const myAssets = shares && index ? (shares * index) / BigInt(1e18) : undefined

  const vaultAssets = myAssets ?? BigInt(0)
  const adapterAssets =
    adapterShares && adapterPrice
      ? (adapterShares * adapterPrice) / BigInt(1e18)
      : BigInt(0)
  const routerAssets =
    routerShares && routerPrice
      ? (routerShares * routerPrice) / BigInt(1e18)
      : BigInt(0)
  const earning = vaultAssets + adapterAssets + routerAssets

  const vaultApr =
    rate !== undefined ? ((Number(rate) * 31_557_600) / 1e18) * 100 : null
  const adapterApr = adapterBps !== undefined ? Number(adapterBps) / 100 : null
  const routerApr = routerApy !== undefined ? Number(routerApy) / 100 : null
  const venueRows = [
    {
      id: "router" as const,
      label: "Auto-router",
      apr: routerApr,
      assets: routerAssets,
      show: routerConfigured,
    },
    {
      id: "vault" as const,
      label: "Mock vault",
      apr: vaultApr,
      assets: vaultAssets,
      show: true,
    },
    {
      id: "market" as const,
      label: "Benqi market",
      apr: adapterApr,
      assets: adapterAssets,
      show: adapterConfigured,
    },
  ].filter((v) => v.show)
  const bestRow = venueRows.reduce<(typeof venueRows)[number] | null>(
    (best, v) =>
      v.apr !== null && (best === null || best.apr === null || v.apr > best.apr)
        ? v
        : best,
    null
  )

  const doDeposit = () => {
    if (depositRaw === null) return
    if (needsApprove) {
      approveTx.write({
        address: CONTRACTS.usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [CONTRACTS.vault, maxUint256],
      })
    } else {
      depositTx.write({
        address: CONTRACTS.vault,
        abi: vaultAbi,
        functionName: "deposit",
        args: [depositRaw],
      })
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
  const withdrawShares =
    withdrawRaw !== null && index ? (withdrawRaw * BigInt(1e18)) / index : null
  const doWithdraw = (all: boolean) => {
    if (all && shares) {
      withdrawTx.write({
        address: CONTRACTS.vault,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [shares],
      })
    } else if (withdrawShares) {
      withdrawTx.write({
        address: CONTRACTS.vault,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [withdrawShares],
      })
    }
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
        <Zap className="size-3.5" /> Earning across venues
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <p className="text-6xl font-medium tracking-tight text-neutral-900 tabular-nums">
          ${formatUsdc(earning)}
        </p>
        {bestRow?.apr != null && (
          <p className="pb-2 text-[15px] text-neutral-500">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-emerald-500 align-middle" />
            Best ·{" "}
            <span className="font-semibold text-neutral-900">
              {bestRow.label}
            </span>{" "}
            <span className="font-mono tabular-nums">
              {bestRow.apr.toFixed(2)}%
            </span>
          </p>
        )}
      </div>

      <div className="mt-6 flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
        {venueRows.map((v) => {
          const pct =
            earning > BigInt(0) ? (Number(v.assets) / Number(earning)) * 100 : 0
          if (pct <= 0) return null
          return (
            <div
              key={v.id}
              style={{ width: `${pct}%` }}
              className={cn(
                "h-full",
                v.id === "router"
                  ? "bg-aero-800"
                  : v.id === "vault"
                    ? "bg-emerald-500"
                    : "bg-neutral-300"
              )}
            />
          )
        })}
      </div>

      <div className="mt-4 border-b border-neutral-200">
        {venueRows.map((v) => {
          const expanded = venue === v.id
          return (
            <div key={v.id} className="border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setVenue(v.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 py-4 text-left"
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    v.id === "router"
                      ? "bg-aero-800"
                      : v.id === "vault"
                        ? "bg-emerald-500"
                        : "bg-neutral-300"
                  )}
                />
                <span
                  className={cn(
                    "text-[15px]",
                    expanded
                      ? "font-semibold text-neutral-900"
                      : "font-medium text-neutral-500"
                  )}
                >
                  {v.label}
                </span>
                {bestRow?.id === v.id && bestRow?.apr != null && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Best
                  </span>
                )}
                <span className="ml-auto shrink-0 tabular-nums">
                  <span className="text-[15px] font-medium text-neutral-900">
                    ${formatUsdc(v.assets)}
                  </span>{" "}
                  <span className="font-mono text-[13px] text-neutral-400">
                    · {v.apr === null ? "—" : `${v.apr.toFixed(2)}%`}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-neutral-400 transition-transform",
                    expanded && "rotate-180"
                  )}
                />
              </button>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {v.id === "router" && routerConfigured && (
                    <div className="pb-8">
                      <RouterPanel address={address} />
                    </div>
                  )}
                  {v.id === "vault" && (
                    <div className="grid gap-6 pb-8 lg:grid-cols-2">
                      <div>
                        <p className="font-mono text-6xl font-medium tracking-tight text-aero-800 tabular-nums">
                          {rate === undefined
                            ? "—"
                            : `${(((Number(rate) * 31_557_600) / 1e18) * 100).toFixed(2)}%`}
                        </p>
                        <p className="mt-1.5 text-sm text-neutral-500">
                          APR · simulated by contract, not live markets
                        </p>
                        <div className="mt-4 flex gap-8 tabular-nums">
                          <div>
                            <p className="text-[13px] text-neutral-500">
                              Your position
                            </p>
                            <p className="mt-1 text-xl font-medium">
                              ${formatUsdc(myAssets)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[13px] text-neutral-500">
                              Vault TVL
                            </p>
                            <p className="mt-1 text-xl font-medium">
                              ${formatUsdc(tvl)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-5">
                        <div>
                          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                            Deposit
                          </p>
                          <div className="mt-2 flex items-end gap-3">
                            <input
                              value={depositAmt}
                              onChange={(e) => setDepositAmt(e.target.value)}
                              inputMode="decimal"
                              placeholder="0.00"
                              aria-label="Deposit amount"
                              className="h-12 min-w-0 flex-1 border-b border-neutral-200 bg-transparent text-base tabular-nums outline-none placeholder:text-neutral-300 focus:border-aero-800"
                            />
                            <Button
                              disabled={
                                depositRaw === null ||
                                approveTx.busy ||
                                depositTx.busy
                              }
                              onClick={doDeposit}
                              className="h-11 shrink-0 rounded-full bg-aero-800 px-6 font-medium text-white hover:bg-aero-900 disabled:bg-neutral-100 disabled:text-neutral-400"
                            >
                              {approveTx.busy
                                ? "Approving…"
                                : depositTx.busy
                                  ? "Depositing…"
                                  : needsApprove
                                    ? "Approve + deposit"
                                    : "Deposit"}
                            </Button>
                          </div>
                          <div className="mt-2">
                            <TxStatus
                              hash={approveTx.hash ?? depositTx.hash}
                              error={approveTx.error ?? depositTx.error}
                            />
                          </div>
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold tracking-[0.14em] text-neutral-400 uppercase">
                            Withdraw
                          </p>
                          <div className="mt-2 flex items-end gap-3">
                            <input
                              value={withdrawAmt}
                              onChange={(e) => setWithdrawAmt(e.target.value)}
                              inputMode="decimal"
                              placeholder="0.00"
                              aria-label="Withdraw amount"
                              className="h-12 min-w-0 flex-1 border-b border-neutral-200 bg-transparent text-base tabular-nums outline-none placeholder:text-neutral-300 focus:border-aero-800"
                            />
                            <Button
                              disabled={
                                (!withdrawShares && !shares) || withdrawTx.busy
                              }
                              onClick={() => doWithdraw(!withdrawAmt)}
                              className="h-11 shrink-0 rounded-full border border-neutral-300 px-6 font-medium text-neutral-900 hover:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-300"
                            >
                              {withdrawTx.busy
                                ? "…"
                                : withdrawAmt
                                  ? "Withdraw"
                                  : "Withdraw all"}
                            </Button>
                          </div>
                          <div className="mt-2">
                            <TxStatus
                              hash={withdrawTx.hash}
                              error={withdrawTx.error}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {v.id === "market" && adapterConfigured && (
                    <div className="pb-8">
                      <AdapterPanel address={address} />
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8">
        <AutoEarn address={address} />
      </div>
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
  const notifyOnce = useOncePerHash()

  const { data: bps, refetch: refetchApy } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "liveApyBps",
  })
  const { data: tvl, refetch: refetchTvl } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "balance",
  })
  const { data: myShares, refetch: refetchShares } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "balanceOf",
    args: [address],
  })
  const { data: price } = useReadContract({
    address: CONTRACTS.adapter,
    abi: adapterAbi,
    functionName: "sharePrice",
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: usdcAbi,
    functionName: "allowance",
    args: [address, CONTRACTS.adapter],
  })

  const refresh = () => {
    refetchApy()
    refetchTvl()
    refetchShares()
    refetchAllowance()
  }
  const depositRaw = parseUsdc(depositAmt)
  const needsApprove =
    depositRaw !== null && (allowance ?? BigInt(0)) < depositRaw
  const myAssets =
    myShares && price ? (myShares * price) / BigInt(1e18) : undefined
  const apy = bps !== undefined ? (Number(bps) / 100).toFixed(2) : "—"

  useEffect(() => {
    if (depositTx.done) {
      refresh()
      notifyOnce(depositTx.hash, () =>
        pushNotice(
          `Auto-earn deposited $${depositAmt || "0"} into the Benqi market`,
          `Now earning around ${apy}% APR.`
        )
      )
      depositTx.reset()
    }
    if (withdrawTx.done) {
      refresh()
      withdrawTx.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositTx.done, withdrawTx.done])

  const doDeposit = () => {
    if (depositRaw === null) return
    if (needsApprove) {
      approveTx.write({
        address: CONTRACTS.usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [CONTRACTS.adapter, maxUint256],
      })
    } else {
      depositTx.write({
        address: CONTRACTS.adapter,
        abi: adapterAbi,
        functionName: "deposit",
        args: [depositRaw],
      })
    }
  }

  const withdrawRaw = parseUsdc(withdrawAmt)
  const doWithdraw = (all: boolean) => {
    if (all && myShares) {
      withdrawTx.write({
        address: CONTRACTS.adapter,
        abi: adapterAbi,
        functionName: "withdraw",
        args: [myShares],
      })
    } else if (withdrawRaw !== null && price) {
      withdrawTx.write({
        address: CONTRACTS.adapter,
        abi: adapterAbi,
        functionName: "withdraw",
        args: [(withdrawRaw * BigInt(1e18)) / price],
      })
    }
  }

  if (!adapterConfigured) return null

  return (
    <div className="pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-aero-800 uppercase">
          Live market · Benqi adapter
        </p>
        <p className="font-mono text-3xl font-medium text-aero-800 tabular-nums">
          {apy}%
        </p>
      </div>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-neutral-600">
        Real on-chain rate from a Compound-style market via our adapter — the
        same code proven against Benqi&apos;s mainnet qiUSDCn. Your position:{" "}
        <span className="font-semibold text-neutral-900 tabular-nums">
          ${formatUsdc(myAssets)}
        </span>
        {" · "}market TVL:{" "}
        <span className="tabular-nums">${formatUsdc(tvl)}</span>.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex items-end gap-2.5">
          <input
            value={depositAmt}
            onChange={(e) => setDepositAmt(e.target.value)}
            inputMode="decimal"
            placeholder="Deposit tUSDC"
            aria-label="Deposit amount"
            className="h-11 min-w-0 flex-1 border-b border-neutral-200 bg-transparent text-[15px] tabular-nums outline-none placeholder:text-neutral-300 focus:border-aero-800"
          />
          <Button
            disabled={depositRaw === null || approveTx.busy || depositTx.busy}
            onClick={() => {
              doDeposit()
              refresh()
            }}
            className="h-11 shrink-0 rounded-full bg-aero-800 px-5 text-sm font-medium text-white hover:bg-aero-900 disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            {approveTx.busy
              ? "…"
              : depositTx.busy
                ? "…"
                : needsApprove
                  ? "Approve"
                  : "Supply"}
          </Button>
        </div>
        <div className="flex items-end gap-2.5">
          <input
            value={withdrawAmt}
            onChange={(e) => setWithdrawAmt(e.target.value)}
            inputMode="decimal"
            placeholder="Withdraw tUSDC"
            aria-label="Withdraw amount"
            className="h-11 min-w-0 flex-1 border-b border-neutral-200 bg-transparent text-[15px] tabular-nums outline-none placeholder:text-neutral-300 focus:border-aero-800"
          />
          <Button
            disabled={(!withdrawRaw && !myShares) || withdrawTx.busy}
            onClick={() => {
              doWithdraw(!withdrawAmt)
              refresh()
            }}
            className="h-11 shrink-0 rounded-full border border-neutral-300 px-5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:border-neutral-200 disabled:text-neutral-300"
          >
            {withdrawTx.busy ? "…" : withdrawAmt ? "Withdraw" : "All"}
          </Button>
        </div>
      </div>
      <div className="mt-2">
        <TxStatus
          hash={approveTx.hash ?? depositTx.hash ?? withdrawTx.hash}
          error={approveTx.error ?? depositTx.error ?? withdrawTx.error}
        />
      </div>
    </div>
  )
}
