import { createPublicClient, http, type Address } from "viem"
import { avalancheFuji } from "viem/chains"
import { namesAbi } from "@/lib/contracts"
import { CONTRACTS } from "@/lib/testnet"
import { readActivity } from "@/lib/testnet-activity"
import type { ChainActivity } from "@/lib/onchain-activity"

export type Contact = {
  address: string
  label: string
  favorite: boolean
}

const FAV_KEY = "aero_contacts_fav"
const MAX_CONTACTS = 8

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function getFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAV_KEY)
    const list = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(list) ? list.map((s) => s.toLowerCase()) : []
  } catch {
    return []
  }
}

export function toggleFavorite(address: string): string[] {
  const key = address.toLowerCase()
  const favs = getFavorites()
  const next = favs.includes(key) ? favs.filter((f) => f !== key) : [...favs, key]
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

const rpcClient = createPublicClient({
  chain: avalancheFuji,
  transport: http("https://api.avax-test.network/ext/bc/C/rpc"),
})

/** Build a contact list from local + on-chain counterparties. Favorites first. */
export async function buildContacts(chain: ChainActivity[]): Promise<Contact[]> {
  const favs = getFavorites()
  const byAddr = new Map<string, { label: string }>()

  for (const a of readActivity()) {
    if (a.to && !byAddr.has(a.to.toLowerCase())) {
      const m = a.label.match(/@([a-z0-9_]{3,20})/i)
      byAddr.set(a.to.toLowerCase(), { label: m ? `@${m[1].toLowerCase()}` : short(a.to) })
    }
  }
  for (const c of chain) {
    if (c.counterparty && !byAddr.has(c.counterparty.toLowerCase())) {
      byAddr.set(c.counterparty.toLowerCase(), { label: short(c.counterparty) })
    }
  }

  // Resolve handles for unknown addresses (batched, capped).
  const unknown = [...byAddr.entries()].filter(([, v]) => v.label.startsWith("0x")).slice(0, 8)
  if (unknown.length > 0 && CONTRACTS.names !== "0x0000000000000000000000000000000000000000") {
    try {
      const results = await rpcClient.multicall({
        contracts: unknown.map(([addr]) => ({
          address: CONTRACTS.names,
          abi: namesAbi,
          functionName: "resolveUsername",
          args: [addr as Address],
        })),
      })
      results.forEach((r, i) => {
        const res = r as { status: string; result?: unknown }
        if (res.status === "success" && typeof res.result === "string" && res.result) {
          byAddr.get(unknown[i][0])!.label = `@${res.result}`
        }
      })
    } catch {
      /* resolution is a nicety, not a requirement */
    }
  }

  return [...byAddr.entries()]
    .map(([address, v]) => ({ address, label: v.label, favorite: favs.includes(address) }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite))
    .slice(0, MAX_CONTACTS)
}
