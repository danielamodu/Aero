# AeroRouter — sandbox implementation and mainnet design notes

Status: **implemented sandbox contract, Fuji/testnet only**. No verified mainnet
deployment, no independent audit, no live Benqi or Trader Joe integration.
Audience: engineers working on the router, adapters and the frontend portfolio
view.

This document separates what `contracts/src/AeroRouter.sol` actually does from
the mainnet design direction. The design notes are not a description of current
behavior.

## 1. What the contract does today

`AeroRouter` is an ERC-20 share contract over an exclusive adapter set. It is
deployed with:

- one six-decimal ERC-20 asset (tUSDC on Fuji),
- one or more adapters that implement `IYieldAdapter`,
- a target allocation in basis points that must sum to `10_000`.

The router accounts for assets as:

```text
totalAssets = idle asset balance
            + Σ adapter.convertToAssets(adapter.sharesOf(router))
```

It uses a virtual asset/share offset (`VIRTUAL_ASSETS = 1`,
`virtualShares = 10^(18 - assetDecimals)`) for first-deposit and inflation
protection. Router shares are 18-decimal ERC-20 tokens and are transferable.

### Deposits

`deposit(assets, minShares)`:

1. Converts assets to shares and enforces `minShares`.
2. Pulls the asset and verifies the exact balance delta.
3. Splits the deposit across every slot by `targetBps`.
4. Deposits each allocation into its adapter and checks the adapter's reported
   shares and measured asset delta.
5. Mints router shares and asserts that targets still sum to `10_000`.

If any adapter deposit is short, the entire transaction reverts.

### Withdrawals

`withdraw(shares)` is **all-or-nothing**, not instant-by-design:

1. Idle router asset is consumed first.
2. The remainder is redeemed pro-rata from invested slots.
3. Each adapter withdrawal must return at least the requested amount, measured
   by the router's token balance delta.
4. If any adapter redemption fails or is short, the whole transaction reverts
   and the caller keeps their shares.

There is no withdrawal queue, no partial-fill mode and no guarantee that an
adapter has liquidity at withdrawal time. A fully invested router can revert
with `ADAPTER_WITHDRAW_FAILED`, `ADAPTER_SHORTFALL` or
`INSUFFICIENT_LIQUIDITY`.

### Rebalancing

`rebalance()` is permissionless and moves router-owned funds toward the static
targets. It does **not** compare APYs, optimize yield or call a keeper
incentive. It only runs when total absolute drift is at or above
`minDriftBps` (default 25 bps, owner-settable up to 1,000).

### Ownership and recovery

The contract uses OpenZeppelin `Ownable` directly. There is no proxy, no
timelock, no multisig requirement in code and no pause function.

The owner can:

- set target allocations (`setTargets`),
- set the drift threshold (`setMinDriftBps`),
- add an adapter at zero weight (`addAdapter`),
- remove an adapter only when its target is zero and the router holds none of
  its shares (`removeAdapter`),
- recover direct donations only when the router has no shares and no adapter
  positions (`recoverOrphanedAssets`).

`recoverOrphanedAssets` exists because a donation before the first deposit would
otherwise block deposits with `ORPHANED_ASSETS`.

### Adapter binding

Adapters are validated at registration and by `configurationValid()`:

- adapter and asset addresses are contracts,
- the adapter asset matches the router asset,
- the adapter's `router()` is this router (or zero at construction time),
- `convertToAssets`, `convertToShares`, `sharesOf`, `liveApyBps` and
  `marketId` are callable,
- the stored targets still sum to `10_000`.

`BenqiAdapter` is bound once with `setRouter` and rejects deposits and
withdrawals from anyone else. The adapter's market is an `IQiToken`; in the
sandbox this is exercised against `MockQiToken`, not a live Benqi market.

## 2. What is not implemented

The following items appear in the mainnet design, not in the current contracts:

- live Benqi or Trader Joe markets on Avalanche mainnet,
- APY-aware allocation or any yield optimizer,
- keeper bots, caller incentives or automatic rebalancing per block,
- per-market caps beyond the owner-set target weights,
- a withdrawal queue or a liquidity backstop,
- `pause()`, UUPS upgradeability, a timelock or an on-chain governance module,
- cross-chain messaging, Avalanche ICM/Warp spokes or an Aero L1 integration,
- performance fees or a production fee model,
- an independent audit or a verified production deployment.

`AeroVault` is a separate mock: a fixed per-second rate set by the owner,
accrued into an index. It does not route funds to any lending market and its
rate is not market-derived yield.

## 3. Deployment and trust status

The B2.2 deployment exercise is simulation-only. It did not broadcast a
transaction, and `lib/fuji-router-manifest.ts` is intentionally empty. Any
address in a report, screenshot or local environment file is not a trusted
deployment identity until chain, bytecode, constructor configuration and
ownership are verified.

The frontend reads addresses from `NEXT_PUBLIC_*` environment variables. A
configured address is not proof that the contract is the intended deployment.

## 4. Mainnet direction (not implemented, non-binding)

The long-term goal is one USDC portfolio that allocates across Avalanche lending
markets while showing a single balance and a single rate. A credible mainnet
design would still need:

- one adapter per market, with explicit accounting and failure handling,
- an allocation policy that accounts for gas and protocol risk, not just APY,
- bounded withdrawal behavior and an operational plan for illiquid markets,
- caps, monitoring, incident response and an independent audit,
- a governance and upgrade model that does not rely on an unconstrained owner
  key.

Cross-chain allocation and Aero L1 messaging remain a separate workstream. The
consumer sandbox does not depend on it.

## 5. Testing

Router, adapter and vault tests live under `contracts/test/` and run with
Foundry. A passing test suite is not an audit and does not establish that a
deployment is correct or that adapter liquidity exists on a live market.
