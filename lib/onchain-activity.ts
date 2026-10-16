import { createPublicClient, http, parseAbiItem, type Address } from "viem"
import { avalancheFuji } from "viem/chains"

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http("https://api.avax-test.network/ext/bc/C/rpc"),
})

export { client as fujiClient }

export async function getLatestBlockNumber(): Promise<bigint> {
  return client.getBlockNumber()
}

export type RecentTransfer = {
  hash: string
  from: string
  to: string
  value: bigint
  block: bigint
}

// ~35 days of Fuji blocks. Testnet phases are shorter than this;
// keep the window bounded so public RPCs answer quickly.
const WINDOW_BLOCKS = BigInt(1500000)

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)")
const DEPOSIT = parseAbiItem("event Deposit(address indexed user, uint256 assets, uint256 shares)")
const WITHDRAW = parseAbiItem("event Withdraw(address indexed user, uint256 assets, uint256 shares)")
const PAID = parseAbiItem("event Paid(address indexed from, address indexed to, address indexed token, uint256 amount, string memo, uint256 timestamp)")

export type ChainActivity = {
  hash: string
  label: string
  amount: string
  ts: number
  kind: "in" | "out" | "deposit" | "withdraw" | "faucet"
  counterparty: string | null
}

const ZERO = "0x0000000000000000000000000000000000000000"

function fmt(raw: bigint): string {
  return `$${(Number(raw) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

/** Real on-chain history for a user: tUSDC transfers + vault deposit/withdraws. */
export async function fetchOnchainActivity(
  user: Address,
  contracts: { usdc: Address; vault: Address }
): Promise<ChainActivity[]> {
  const latest = await client.getBlockNumber()
  const fromBlock = latest > WINDOW_BLOCKS ? latest - WINDOW_BLOCKS : BigInt(0)

  const [sent, received, deposits, withdrawals] = await Promise.all([
    client.getLogs({ address: contracts.usdc, event: TRANSFER, args: { from: user }, fromBlock, toBlock: latest }),
    client.getLogs({ address: contracts.usdc, event: TRANSFER, args: { to: user }, fromBlock, toBlock: latest }),
    client.getLogs({ address: contracts.vault, event: DEPOSIT, args: { user }, fromBlock, toBlock: latest }),
    client.getLogs({ address: contracts.vault, event: WITHDRAW, args: { user }, fromBlock, toBlock: latest }),
  ])

  const items: (ChainActivity & { block: bigint })[] = []
  for (const l of sent) {
    if (!l.args.to || l.args.value === undefined) continue
    items.push({ hash: l.transactionHash!, label: `Sent → ${short(l.args.to)}`, amount: fmt(l.args.value), ts: 0, kind: "out", counterparty: l.args.to, block: l.blockNumber })
  }
  for (const l of received) {
    if (!l.args.from || l.args.value === undefined) continue
    const faucet = l.args.from.toLowerCase() === ZERO
    items.push({
      hash: l.transactionHash!,
      label: faucet ? "Faucet claim" : `Received ← ${short(l.args.from)}`,
      amount: `+${fmt(l.args.value)}`,
      ts: 0,
      kind: faucet ? "faucet" : "in",
      counterparty: faucet ? null : l.args.from,
      block: l.blockNumber,
    })
  }
  for (const l of deposits) {
    if (l.args.assets === undefined) continue
    items.push({ hash: l.transactionHash!, label: "Vault deposit", amount: fmt(l.args.assets), ts: 0, kind: "deposit", counterparty: null, block: l.blockNumber })
  }
  for (const l of withdrawals) {
    if (l.args.assets === undefined) continue
    items.push({ hash: l.transactionHash!, label: "Vault withdraw", amount: `+${fmt(l.args.assets)}`, ts: 0, kind: "withdraw", counterparty: null, block: l.blockNumber })
  }

  // Attach timestamps (unique blocks only).
  const blocks = [...new Set(items.map((i) => i.block))]
  const times = new Map<bigint, number>()
  await Promise.all(
    blocks.map(async (b) => {
      const blk = await client.getBlock({ blockNumber: b })
      times.set(b, Number(blk.timestamp) * 1000)
    })
  )
  const stamped: ChainActivity[] = items.map(({ block: _block, ...rest }) => ({
    ...rest,
    ts: times.get(_block) ?? 0,
  }))

  // Newest first, one row per tx (a tx can emit several events).
  const seen = new Set<string>()
  return stamped
    .sort((a, b) => b.ts - a.ts)
    .filter((i) => (seen.has(i.hash.toLowerCase()) ? false : (seen.add(i.hash.toLowerCase()), true)))
}

/** Payment memos by tx hash — follows you across devices (unlike local notes). */
export async function fetchMemos(user: Address, pay: Address): Promise<Map<string, string>> {
  const memos = new Map<string, string>()
  if (pay === "0x0000000000000000000000000000000000000000") return memos
  try {
    const latest = await client.getBlockNumber()
    const fromBlock = latest > WINDOW_BLOCKS ? latest - WINDOW_BLOCKS : BigInt(0)
    const logs = await client.getLogs({ address: pay, event: PAID, args: { from: user }, fromBlock, toBlock: latest })
    for (const l of logs) {
      if (l.args.memo) memos.set(l.transactionHash!.toLowerCase(), l.args.memo)
    }
  } catch {
    /* memos are a nicety */
  }
  return memos
}
/** Newest tUSDC transfers network-wide (bounded window — best effort). */
export async function fetchRecentTransfers(limit = 6): Promise<RecentTransfer[]> {
  const latest = await client.getBlockNumber()
  const fromBlock = latest > WINDOW_BLOCKS ? latest - WINDOW_BLOCKS : BigInt(0)
  const logs = await client.getLogs({
    address: "0x4f88395a2cf38645ba2016b6abf5ad084c19c369",
    event: TRANSFER,
    fromBlock,
    toBlock: latest,
  })
  return logs
    .slice(-limit)
    .reverse()
    .map((l) => ({
      hash: l.transactionHash!,
      from: l.args.from!,
      to: l.args.to!,
      value: l.args.value ?? BigInt(0),
      block: l.blockNumber,
    }))
}

export async function hasOnchainSends(user: Address, usdc: Address, vault: Address): Promise<boolean> {
  const latest = await client.getBlockNumber()
  const fromBlock = latest > WINDOW_BLOCKS ? latest - WINDOW_BLOCKS : BigInt(0)
  const [sent, deposits, withdrawals] = await Promise.all([
    client.getLogs({ address: usdc, event: TRANSFER, args: { from: user }, fromBlock, toBlock: latest }),
    client.getLogs({ address: vault, event: DEPOSIT, args: { user }, fromBlock, toBlock: latest }),
    client.getLogs({ address: vault, event: WITHDRAW, args: { user }, fromBlock, toBlock: latest }),
  ])
  return sent.length + deposits.length + withdrawals.length > 0
}
