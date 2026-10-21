"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useWriteContract } from "wagmi"
import { maxUint256, zeroAddress, type Address } from "viem"
import {
  namesAbi,
  payAbi,
  usdcAbi,
  vaultAbi,
  routerAbi,
} from "@/lib/contracts"
import {
  CONTRACTS,
  formatUsdc,
  isAddress,
  isUsername,
  normalizeUsername,
  parseUsdc,
  payConfigured,
  routerConfigured,
} from "@/lib/testnet"
import { fujiClient } from "@/lib/onchain-activity"
import { FUJI_ROUTER_MANIFEST } from "@/lib/fuji-router-manifest"
import { readAndVerifyRouterDeployment } from "@/lib/router-deployment-identity.mjs"

type Line = {
  text: string
  kind: "cmd" | "ok" | "err" | "info" | "tx"
  hash?: string
}

const HELP = [
  "balance — show tUSDC, earned, total",
  "faucet — claim 10,000 test dollars",
  "handle — show your @handle",
  "handle register @name — claim one",
  "send @name 45 [note] — pay anyone",
  "pay 0x… 86.20 [note] — pay an address",
  "earn 100 — deposit into the mock vault",
  "earn withdraw all — pull everything out",
  "apy — live rates",
  "whoami — your address",
  "clear — wipe this screen",
]

export function TerminalView({ address }: { address: Address }) {
  const [lines, setLines] = useState<Line[]>([
    {
      text: "aero terminal · Fuji testnet · money is fake, rails are real",
      kind: "info",
    },
    { text: "type `help` to see what I understand", kind: "info" },
  ])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const { writeContractAsync } = useWriteContract()
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight })
  }, [lines.length])

  const print = (batch: Line[]) =>
    setLines((prev) => [...prev, ...batch].slice(-100))

  const read = async <T,>(fn: () => Promise<T>): Promise<T> => fn()

  const runWrite = async (
    label: string,
    call: () => Promise<`0x${string}`>
  ): Promise<`0x${string}` | null> => {
    print([{ text: `${label} → broadcasting…`, kind: "info" }])
    try {
      const hash = await call()
      await fujiClient.waitForTransactionReceipt({ hash })
      print([
        {
          text: `confirmed · ${hash.slice(0, 10)}…${hash.slice(-6)}`,
          kind: "tx",
          hash,
        },
      ])
      return hash
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.split("\n")[0].slice(0, 140) : "failed"
      print([{ text: msg, kind: "err" }])
      return null
    }
  }

  const resolveTo = async (who: string): Promise<Address | null> => {
    if (isAddress(who)) return who as Address
    if (!isUsername(who)) return null
    const found = (await read(() =>
      fujiClient.readContract({
        address: CONTRACTS.names,
        abi: namesAbi,
        functionName: "resolveAddress",
        args: [normalizeUsername(who)],
      })
    )) as Address
    return found === zeroAddress ? null : found
  }

  const ensurePayAllowance = async (raw: bigint): Promise<boolean> => {
    const allowance = (await read(() =>
      fujiClient.readContract({
        address: CONTRACTS.usdc,
        abi: usdcAbi,
        functionName: "allowance",
        args: [address, CONTRACTS.pay],
      })
    )) as bigint
    if (allowance >= raw) return true
    print([{ text: "approving AeroPay once…", kind: "info" }])
    const hash = await runWrite("approve", async () =>
      writeContractAsync({
        address: CONTRACTS.usdc,
        abi: usdcAbi,
        functionName: "approve",
        args: [CONTRACTS.pay, maxUint256],
      })
    )
    return hash !== null
  }

  const exec = async (rawCmd: string) => {
    const parts = rawCmd.trim().split(/\s+/)
    const [cmd = "", ...args] = parts
    switch (cmd.toLowerCase()) {
      case "":
        return
      case "help":
        print(HELP.map((text) => ({ text, kind: "info" as const })))
        return
      case "clear":
        setLines([])
        return
      case "whoami":
        print([{ text: address, kind: "ok" }])
        return
      case "balance": {
        const [usdc, shares, index] = await Promise.all([
          read(() =>
            fujiClient.readContract({
              address: CONTRACTS.usdc,
              abi: usdcAbi,
              functionName: "balanceOf",
              args: [address],
            })
          ) as Promise<bigint>,
          read(() =>
            fujiClient.readContract({
              address: CONTRACTS.vault,
              abi: vaultAbi,
              functionName: "balanceOf",
              args: [address],
            })
          ) as Promise<bigint>,
          read(() =>
            fujiClient.readContract({
              address: CONTRACTS.vault,
              abi: vaultAbi,
              functionName: "index",
            })
          ) as Promise<bigint>,
        ])
        const earning = (shares * index) / BigInt(1e18)
        print([
          { text: `available  $${formatUsdc(usdc)}`, kind: "info" },
          { text: `earning    $${formatUsdc(earning)}`, kind: "info" },
          { text: `total      $${formatUsdc(usdc + earning)}`, kind: "ok" },
        ])
        return
      }
      case "faucet": {
        await runWrite("faucet", async () =>
          writeContractAsync({
            address: CONTRACTS.usdc,
            abi: usdcAbi,
            functionName: "faucet",
          })
        )
        return
      }
      case "handle": {
        if (args[0] === "register" && args[1]) {
          const name = normalizeUsername(args[1])
          if (!isUsername(args[1])) {
            print([
              {
                text: "handles are 3–20 lowercase letters, numbers, _",
                kind: "err",
              },
            ])
            return
          }
          await runWrite(`register @${name}`, async () =>
            writeContractAsync({
              address: CONTRACTS.names,
              abi: namesAbi,
              functionName: "register",
              args: [name],
            })
          )
          return
        }
        const mine = (await read(() =>
          fujiClient.readContract({
            address: CONTRACTS.names,
            abi: namesAbi,
            functionName: "resolveUsername",
            args: [address],
          })
        )) as string
        print([
          {
            text: mine
              ? `@${mine} — yours on Fuji`
              : "no handle yet — `handle register @you`",
            kind: mine ? "ok" : "info",
          },
        ])
        return
      }
      case "send":
      case "pay": {
        const [who, amtStr, ...memoParts] = args
        if (!who || !amtStr) {
          print([{ text: `usage: ${cmd} @name 45 [note]`, kind: "err" }])
          return
        }
        const raw = parseUsdc(amtStr)
        if (raw === null) {
          print([{ text: "amount must be a positive number", kind: "err" }])
          return
        }
        const to = await resolveTo(who)
        if (!to) {
          print([
            {
              text: `@${normalizeUsername(who)} isn't registered — check the spelling`,
              kind: "err",
            },
          ])
          return
        }
        const memo = memoParts.join(" ").slice(0, 140)
        if (payConfigured) {
          if (!(await ensurePayAllowance(raw))) return
          if (isAddress(who.trim())) {
            await runWrite(`pay $${amtStr} → ${who}`, async () =>
              writeContractAsync({
                address: CONTRACTS.pay,
                abi: payAbi,
                functionName: "pay",
                args: [CONTRACTS.usdc, to, raw, memo],
              })
            )
          } else {
            await runWrite(
              `pay $${amtStr} → @${normalizeUsername(who)}`,
              async () =>
                writeContractAsync({
                  address: CONTRACTS.pay,
                  abi: payAbi,
                  functionName: "payUsername",
                  args: [
                    CONTRACTS.names,
                    CONTRACTS.usdc,
                    normalizeUsername(who),
                    raw,
                    memo,
                  ],
                })
            )
          }
        } else {
          await runWrite(`send $${amtStr} → ${who}`, async () =>
            writeContractAsync({
              address: CONTRACTS.usdc,
              abi: usdcAbi,
              functionName: "transfer",
              args: [to, raw],
            })
          )
        }
        return
      }
      case "earn": {
        if (args[0] === "withdraw" && args[1] === "all") {
          const shares = (await read(() =>
            fujiClient.readContract({
              address: CONTRACTS.vault,
              abi: vaultAbi,
              functionName: "balanceOf",
              args: [address],
            })
          )) as bigint
          if (shares === BigInt(0)) {
            print([{ text: "nothing earning right now", kind: "info" }])
            return
          }
          await runWrite("withdraw all", async () =>
            writeContractAsync({
              address: CONTRACTS.vault,
              abi: vaultAbi,
              functionName: "withdraw",
              args: [shares],
            })
          )
          return
        }
        if (args[0] === "apy") {
          const [rate, bps] = await Promise.all([
            read(() =>
              fujiClient.readContract({
                address: CONTRACTS.vault,
                abi: vaultAbi,
                functionName: "ratePerSecond",
              })
            ) as Promise<bigint>,
            read(async () => {
              if (!routerConfigured) return undefined
              try {
                const identity = await readAndVerifyRouterDeployment(
                  fujiClient,
                  routerAbi,
                  {
                    configuredRouterAddress: CONTRACTS.router,
                    configuredAssetAddress: CONTRACTS.usdc,
                  },
                  FUJI_ROUTER_MANIFEST,
                )
                if (!identity.ok) return undefined
                return fujiClient.readContract({ address: CONTRACTS.router, abi: routerAbi, functionName: "liveApyBps" })
              } catch {
                return undefined
              }
            }),
          ])
          const lines: Line[] = [
            {
              text: `mock vault  ${(((Number(rate) * 31_557_600) / 1e18) * 100).toFixed(2)}% APR`,
              kind: "ok",
            },
          ]
          if (typeof bps === "bigint")
            lines.push({
              text: `yield router  ${(Number(bps) / 100).toFixed(2)}% annualized`,
              kind: "ok",
            })
          print(lines)
          return
        }
        const raw = parseUsdc(args[0] ?? "")
        if (raw === null) {
          print([
            {
              text: "usage: earn 100 | earn withdraw all | earn apy",
              kind: "err",
            },
          ])
          return
        }
        const allowance = (await read(() =>
          fujiClient.readContract({
            address: CONTRACTS.usdc,
            abi: usdcAbi,
            functionName: "allowance",
            args: [address, CONTRACTS.vault],
          })
        )) as bigint
        if (allowance < raw) {
          await runWrite("approve vault", async () =>
            writeContractAsync({
              address: CONTRACTS.usdc,
              abi: usdcAbi,
              functionName: "approve",
              args: [CONTRACTS.vault, maxUint256],
            })
          )
        }
        await runWrite(`deposit $${args[0]}`, async () =>
          writeContractAsync({
            address: CONTRACTS.vault,
            abi: vaultAbi,
            functionName: "deposit",
            args: [raw],
          })
        )
        return
      }
      default:
        print([{ text: `unknown command "${cmd}" — try help`, kind: "err" }])
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd || busy) return
    setInput("")
    print([{ text: `$ ${cmd}`, kind: "cmd" }])
    setBusy(true)
    try {
      await exec(cmd)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-aero-950 text-white">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3.5">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="size-2.5 rounded-full bg-[#28C840]" />
        </span>
        <p className="ml-2 font-mono text-xs text-white/40">aero — fuji</p>
        <p className="ml-auto hidden font-mono text-[11px] text-white/30 sm:block">
          real transactions, play money
        </p>
      </div>
      <div
        ref={boxRef}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-5 py-4 font-mono text-[13px] leading-relaxed"
      >
        {lines.map((l, i) => (
          <p
            key={`${i}-${l.text.slice(0, 12)}`}
            className={
              l.kind === "cmd"
                ? "font-bold text-white"
                : l.kind === "ok"
                  ? "text-emerald-300"
                  : l.kind === "err"
                    ? "text-red-300"
                    : l.kind === "tx"
                      ? "text-white/70 underline decoration-dotted underline-offset-4"
                      : "text-white/55"
            }
          >
            {l.kind === "tx" && l.hash ? (
              <a
                href={`https://testnet.snowtrace.io/tx/${l.hash}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                {l.text}
              </a>
            ) : (
              l.text
            )}
          </p>
        ))}
      </div>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-white/10 px-5 py-3.5"
      >
        <span className="shrink-0 font-mono text-sm font-bold text-emerald-300">
          @you:~$
        </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="help"
          aria-label="Terminal input"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          className="h-9 min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-60"
        />
        {busy && (
          <span className="size-2 animate-pulse rounded-full bg-emerald-300" />
        )}
      </form>
    </div>
  )
}
