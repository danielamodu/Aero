import { zeroAddress } from "viem"

export const FUJI_CHAIN_ID = 43113
export const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc"
export const FUJI_EXPLORER = "https://testnet.snowtrace.io"
export const FUJI_AVAX_FAUCET = "https://faucet.avax.network"

type Address = `0x${string}`

function envAddress(value: string | undefined): Address {
  // NOTE: callers must pass process.env.NEXT_PUBLIC_* literally —
  // Next.js only inlines statically-written env access into client bundles.
  const v = (value ?? "").trim()
  return (v.startsWith("0x") && v.length === 42 ? v : zeroAddress) as Address
}

export const CONTRACTS = {
  names: envAddress(process.env.NEXT_PUBLIC_AERO_NAMES),
  usdc: envAddress(process.env.NEXT_PUBLIC_TEST_USDC),
  vault: envAddress(process.env.NEXT_PUBLIC_AERO_VAULT),
  router: envAddress(process.env.NEXT_PUBLIC_ROUTER),
  pay: envAddress(process.env.NEXT_PUBLIC_AEROPAY),
  bank: envAddress(process.env.NEXT_PUBLIC_BANK),
}

export const contractsConfigured =
  CONTRACTS.names !== zeroAddress && CONTRACTS.usdc !== zeroAddress && CONTRACTS.vault !== zeroAddress

export const routerConfigured = CONTRACTS.router !== zeroAddress
export const payConfigured = CONTRACTS.pay !== zeroAddress
export const bankConfigured = CONTRACTS.bank !== zeroAddress

/** Names any contract env var that's missing or malformed — shown on the setup screen. */
export function missingContractEnvs(): string[] {
  const missing: string[] = []
  if (CONTRACTS.names === zeroAddress) missing.push("NEXT_PUBLIC_AERO_NAMES")
  if (CONTRACTS.usdc === zeroAddress) missing.push("NEXT_PUBLIC_TEST_USDC")
  if (CONTRACTS.vault === zeroAddress) missing.push("NEXT_PUBLIC_AERO_VAULT")
  return missing
}

export function snowtraceTx(hash: string): string {
  return `${FUJI_EXPLORER}/tx/${hash}`
}

export function snowtraceAddress(address: string): string {
  return `${FUJI_EXPLORER}/address/${address}`
}

/** Raw 6-decimal units → "1,234.56" */
export function formatUsdc(raw: bigint | undefined): string {
  if (raw === undefined) return "—"
  return (Number(raw) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** "12.5" → 12500000n. Null when invalid or <= 0. */
export function parseUsdc(input: string): bigint | null {
  const n = Number(input.trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return BigInt(Math.round(n * 1e6))
}

/** 1e18-scaled per-second rate → "5.31" APR percent string. */
export function aprFromRate(ratePerSecond: bigint | undefined): string {
  if (ratePerSecond === undefined) return "—"
  return ((Number(ratePerSecond) * 31_557_600) / 1e18).toFixed(2)
}

export function isUsername(s: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(s.trim().replace(/^@+/, "").toLowerCase())
}

export function normalizeUsername(s: string): string {
  return s.trim().replace(/^@+/, "").toLowerCase()
}

export function isAddress(s: string): s is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(s.trim())
}
