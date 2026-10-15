# AeroRouter — mainnet yield-routing design

Status: design (testnet runs the mock `AeroVault`; this doc is the mainnet target).
Audience: whoever implements or audits the mainnet router.

## 1. Goal

One USDC pool whose idle balance is continuously allocated across Avalanche
lending markets (starting: Benqi, Trader Joe) to maximize net APY after gas,
with the user seeing a single balance, one APY number, and instant withdrawals.

Non-goals for v1: leverage, cross-chain movement (see §6), custom strategies
per user. One global allocation, same for everyone.

## 2. Architecture

```
User ──deposit/withdraw──▶ AeroRouter ──adapter──▶ Benqi market
                                      └─adapter──▶ Trader Joe market
```

- `AeroRouter` holds accounting (shares, per-user balances) and the target
  allocation. It never holds idle USDC longer than one rebalance window —
  funds live in the adapters' markets.
- `IYieldAdapter` wraps one protocol market: `deposit`, `withdraw`,
  `balance` (assets, in USDC units), `liveApyBps` (on-chain view, no oracles
  beyond what the protocol itself exposes: supply rate per block/second).
- Rebalancing is **keeper-triggered**, not automatic per block: anyone (initially
  an Aero bot, later permissionless with a small caller incentive) calls
  `rebalance()` when drift from target exceeds a threshold. This keeps gas
  predictable and prevents MEV games around user deposits.

## 3. Allocation policy (v1, deliberately dumb)

- Every rebalance reads each adapter's `liveApyBps`, subtracts a gas-cost
  haircut proportional to the amount being moved, and shifts funds toward the
  highest net rate until marginal rates equalize or a per-market cap is hit.
- Caps: max 70% in any single market; min 10% stays in the most liquid market
  so withdrawals rarely queue.
- Hysteresis band of 25 bps: no rebalance unless the gain clears it. Churn is
  the enemy — moving money costs gas and resets nothing.
- All parameters are owner-settable with a 24h timelock in production
  (testnet: direct, for iteration speed).

## 4. Shares and accounting

- ERC-4626-style vault shares (`AeroVault` on testnet already follows this
  shape: `deposit`/`withdraw`/`preview*`, 1e18 index). Mainnet keeps the same
  external interface so the frontend doesn't change.
- Yield accrues to the index only when `accrue()` observes higher total
  assets across adapters — never on time passing alone. No phantom yield.
- Withdrawals pull from the most-liquid adapter first; if a market is
  illiquid, the withdrawal waits in a FIFO queue rather than reverting
  (bounded: queue older than N hours is serviceable by keeper with penalty).

## 5. Trust and safety

- Adapters are append-only whitelisted by governance; a malicious adapter
  can't be hot-swapped in.
- Per-market caps bound the blast radius of any single protocol exploit.
- `pause()` freezes deposits/rebalances (withdrawals stay open) — break-glass
  only, emits an event the frontend surfaces.
- Upgradeability: UUPS proxy for the router, immutable adapters. Audit the
  proxy admin flow, not just the logic.
- Explicitly out of scope for audit evasion: no admin key can redirect user
  funds anywhere except whitelisted adapters.

## 6. Phase 2: cross-L1 (the actual differentiator)

Aero runs on 80+ Avalanche L1s. The v2 router adds:

- `WarpMessenger` (Avalanche ICM) messages carrying deposit/withdraw intents
  between the home router and spoke adapters on other L1s.
- Each spoke reports `balance` + `liveApyBps` inbound; the home router's
  allocation policy extends across chains with an added bridge-cost term.
- Same UX: one balance, one APY. The user never picks a chain — v1 already
  trains them to expect that.

## 7. Testnet → mainnet path

1. `AeroVault` (mock rate) proves the UX: deposit/withdraw/index/emit events.
2. Swap mock for `AeroRouter` + one real adapter (Benqi first — simplest
   supply/borrow interface) behind the same ABI the frontend already speaks.
3. Add the second adapter, then the keeper bot, then timelock + audit.
4. Warp spokes only after single-chain mainnet is boring.

## 8. Open questions

- Caller incentive size for permissionless `rebalance()` (needs mainnet gas data).
- Withdrawal-queue bounds under a real bank-run simulation (fork test).
- Whether caps should be governance-set or algorithmic (start governance-set).
- Fee model: none on testnet; mainnet takes a performance fee. Percentage TBD —
  decided by unit economics, not this doc.
