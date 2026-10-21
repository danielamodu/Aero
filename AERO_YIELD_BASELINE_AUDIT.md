# Aero Yield Infrastructure — Baseline Audit

Audit date: 2026-10-21 (Africa/Lagos)
Scope: local working tree, Solidity yield contracts and tests, Fuji deployment configuration/state, frontend yield flows, and related claims. No source, test, dependency, config, or deployment file was changed. This report is the only file created by the audit.

## 1. Executive Summary

Aero has a functioning Fuji demonstration built from test-token and simulated-market contracts. The local tree also contains an ERC-20 share router and a Benqi-shaped adapter, and configured Fuji addresses have deployed bytecode. However, the deployed router points at mock QiToken markets, not Benqi or Trader Joe. The router and adapter accounting are not safe to use as a production yield pool, and there is no implemented keeper, APY optimizer, liquidity reserve policy, pause path, timelock, upgrade system, or Aero ICM/Warp cross-chain flow.

The most serious accounting defect is that the UI exposes the same BenqiAdapter both as a direct-deposit venue and as router slot 0. `BenqiAdapter.balance()` reports the adapter contract’s entire market position, including shares owned by direct adapter users, while AeroRouter treats that number as assets owned by the router. The deployed addresses confirm that the adapter is shared. Router share pricing and withdrawals can therefore overstate the router’s assets and become unserviceable.

The router also ignores its own idle USDC in `totalAssets()`, fails to consume idle funds first on withdrawal, and can let one illiquid adapter revert a withdrawal across all positions. Adapter registration/removal can break allocation totals, and duplicate adapters are accepted. Tests pass but do not cover these cases. The mainnet fork test functions return early unless run on chain ID 43114; the ordinary test run counted both as passing without exercising a mainnet fork.

**Assessment:** suitable only as an explicitly experimental Fuji demonstration after clear user warnings. Not ready for a meaningful live-market testnet, funding claims about live yield routing, or public launch with real funds.

## 2. Project Baseline

- Working directory: `C:\Users\USER\Desktop\Aero`
- Git branch and commit: `main`, `60303f8b22966d257346a9bded5ab21bb7fbf88d`
- Baseline status before this report: `M components/testnet/shell.tsx`; untracked `aero deployer.txt`. Both predate this audit and were preserved. The audit did not change either.
- Solidity project root: `contracts/` (not repository root).
- Foundry config: `contracts/foundry.toml`; source `contracts/src`, tests `contracts/test`, scripts `contracts/script`, libs `contracts/lib`; Solidity `0.8.24`, EVM `cancun`, Fuji RPC endpoint `https://api.avax-test.network/ext/bc/C/rpc`.
- Dependencies present locally: OpenZeppelin Contracts `5.7.0`; `forge-std` `1.17.0`. Foundry used: Forge `1.7.1` (commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`).
- Relevant source tree: `contracts/src/{AeroRouter,BenqiAdapter,AeroVault,MockQiToken,TestUSDC}.sol`; `contracts/src/interfaces/{IYieldAdapter,IQiToken,IAeroRouter}.sol`; tests in `contracts/test/{AeroRouter,BenqiAdapter,AeroVault}.t.sol` and `contracts/test/fork/BenqiMainnetFork.t.sol`; deployments in `contracts/script/{Deploy,DeployBenqi,DeployMore,Seed}.s.sol`.
- `.env.local` (ignored local config) has all seven documented Fuji frontend addresses populated. They were queried read-only against the Fuji C-chain RPC; all seven returned runtime bytecode. At that check, the router had two slots and `totalAssets()` returned zero. The adapter and market IDs and symbols were also read from Fuji; both router slots had empty `marketId()` values and market symbols `mqiUSDC` and `mjjUSDC`.
- Public Fuji address values in that local config:
  - TestUSDC: `0x4f88395a2cf38645ba2016b6abf5ad084c19c369`
  - AeroVault: `0x57e2ad4bf82010291dc2517646c47d14acf7d279`
  - AeroNames: `0x7f1e307947844545e569f03cf3250c9f21a2e02b`
  - BenqiAdapter: `0xe88b2216565804c36f805f89efe0261de6412f92`
  - AeroRouter: `0x2bA93B22fFE2EdEE054A2dBc96732017F79B928D`
  - AeroPay: `0x30AC3ceF546b7bc97A2a779cC15f83EDc0A3b46E`
  - AeroBank: `0x0403EAd11D3e3F8aBef24CAB3AC0D990bbC401f6`
- `aero deployer.txt` is an untracked Avalanche Warp/Teleporter relayer configuration naming Fuji and several testnet blockchain endpoints. A configuration file is not evidence that an Aero cross-chain contract integration or a running relayer service exists. Potentially sensitive lines were not reproduced in this report.

## 3. Architecture Overview

`AeroVault` is a standalone ERC-20 share vault over the test token. Its owner-configured per-second rate increases an index over time; this is simulated yield and does not come from lending markets. `Deploy.s.sol` seeds it with 9,000 tUSDC to fund early simulated gains.

`BenqiAdapter` is an ERC-20 share token that calls a QiToken-compatible market. It accepts direct user deposits as well as router deposits. `AeroRouter` is another ERC-20 share token that transfers USDC into target adapters and calculates router shares from the adapters’ reported `balance()` values. The deployed router uses 60/40 targets; slot 0 is the same adapter exposed separately in the frontend and slot 1 is an adapter around a second mock market.

The frontend has distinct panels and handlers: `RouterPanel` deposits/withdraws through AeroRouter; the mock-vault panel transacts directly with AeroVault; the market panel transacts directly with BenqiAdapter. The Auto-earn helper compares AeroVault’s simulated APR with the standalone adapter’s reported rate and sends the next explicit deposit to whichever it labels best. It does not monitor positions and move existing funds. No keeper or rebalancing agent source/service was found.

## 4. Confirmed Findings

### H-1 — Router values all adapter holders’ positions as router assets

- **Severity: High**
- **Evidence:** `contracts/src/BenqiAdapter.sol:51-53` returns `_marketBalance()` for the entire adapter contract; `contracts/src/AeroRouter.sol:56-59` sums each adapter’s global `balance()`. The frontend also permits direct adapter deposits in `components/testnet/views.tsx:2013-...` and uses the same configured adapter for router slot 0. A Fuji read confirmed router slot 0 equals `NEXT_PUBLIC_BENQI_ADAPTER`.
- **Current behavior:** direct users’ BenqiAdapter shares and router-owned shares share one adapter. The router denominator includes the whole underlying market balance, while the router owns only its own adapter shares. `_pullFromSlot` caps the redemption by the router’s share balance, but `withdraw()` still tries to transfer the larger amount derived from aggregate balances.
- **Why it matters:** a direct adapter deposit can inflate router `totalAssets()` and share price, or make a router withdrawal revert for insufficient USDC after only router-owned adapter shares can be redeemed. This is an active issue in the configured UI/deployment topology, not just a hypothetical alternative adapter.
- **Recommended correction:** make adapters router-exclusive, or define and enforce account-specific adapter valuation (router-owned adapter shares × adapter share price) throughout total assets, drift, APY, and withdrawal calculations. Avoid presenting the same adapter as both an independently user-owned pool and a router-only strategy.

### H-2 — Router accounting excludes idle USDC and donations

- **Severity: High**
- **Evidence:** `contracts/src/AeroRouter.sol:56-65` sums only adapter balances. `deposit()` at `:130-142` floors each target allocation and mints shares for all requested assets. Direct token transfers to the router are likewise not included.
- **Current behavior:** router-held USDC from allocation rounding, a donation, or a partial/rebalance flow does not appear in total assets or share price. `rebalance()` may push idle funds only into detected underweight slots, but idle holdings do not enter the reported denominator. A balanced portfolio can leave dust idle indefinitely.
- **Why it matters:** share pricing ceases to represent all router-controlled assets; first deposits and later deposits cannot price against donated/idle funds; dust is effectively orphaned. `totalAssets()` can understate assets while the contract controls them.
- **Recommended correction:** include `asset.balanceOf(address(this))` in assets and define explicit donation/first-depositor treatment; use full-precision conversions and test allocation dust.

### H-3 — Withdrawals neither spend idle first nor tolerate adapter shortfalls/failures

- **Severity: High**
- **Evidence:** `contracts/src/AeroRouter.sol:144-159` calculates a fixed amount from adapter-only assets, loops through adapter positions, then transfers that amount. `_pullFromSlot()` at `:164-179` ignores the adapter’s returned assets and caps shares without verifying the amount received.
- **Current behavior:** no idle-USDC-first path exists. A failed `withdraw()` from any selected adapter reverts the whole transaction. A short redemption is not accounted for; the final USDC transfer may revert, or may consume idle balance that was excluded from pricing. There is no queue or per-adapter fallback behavior.
- **Why it matters:** an illiquid/loss-affected adapter can block withdrawals from other liquid positions. The router does not guarantee that the emitted `Withdraw` amount equals assets received from markets or paid to the user in shortfall scenarios.
- **Recommended correction:** make withdrawals value and redeem only router-owned shares, use router idle USDC first, measure actual balance deltas, define loss/shortfall behavior, and test partial liquidity and failures. A queue is a product choice; absent one, report/revert shortfalls explicitly without burning users’ shares.

### H-4 — Adapter list changes can violate allocation and uniqueness invariants

- **Severity: High**
- **Evidence:** `contracts/src/AeroRouter.sol:99-111` (`addAdapter`, `removeAdapter`) and `:115-128` (`_setAllocation`). Only constructor/`setTargets` through `_setAllocation` enforce a 10,000 BPS total. `addAdapter` appends an arbitrary target, `removeAdapter` swap-pops without renormalizing, and neither path checks duplicates. `addAdapter`’s `balance() >= 0` condition is tautological for a `uint256`; it is only an external-call/decode probe, not meaningful compatibility validation.
- **Current behavior:** owner operations can create totals above or below 10,000 BPS or list the same adapter multiple times. Duplicates double-count `balance()` and receive repeated deposits. Removing a slot leaves its target weight missing. Zero/incompatible adapter validation is incomplete.
- **Why it matters:** deposits can leave unintended idle funds or over-allocate, reported assets can be double-counted, and rebalance targets can no longer describe a full portfolio.
- **Recommended correction:** validate nonzero code-bearing compatible adapters, prevent duplicates, preserve `sum(targetBps)==10_000` atomically on every mutation, and add explicit removal/weight migration semantics.

### M-1 — BenqiAdapter market ID is never stored

- **Severity: Medium**
- **Evidence:** `contracts/src/BenqiAdapter.sol:27-38`; the constructor statement `marketId_ = marketId_;` assigns the parameter to itself rather than `_marketId`. `marketId()` returns the uninitialized storage string. Fuji read-only calls returned `""` for both deployed adapters.
- **Current behavior:** UI market labels fall back to generic “Market”; integration identity metadata is incorrect.
- **Why it matters:** users/operators cannot reliably identify slots from the adapter metadata, and monitoring/integration checks can mislabel a market.
- **Recommended correction:** store the constructor value in `_marketId`; add constructor/round-trip tests and validate deployment metadata.

### M-2 — Adapter interface does not specify the share conversion AeroRouter relies on

- **Severity: Medium**
- **Evidence:** `contracts/src/interfaces/IYieldAdapter.sol:7-22` has no `sharePrice()` or `balanceOf(address)`. `AeroRouter.sol:164-185` probes these selectors ad hoc; failed/missing `sharePrice()` silently defaults to `1e18`, and missing `balanceOf()` returns zero.
- **Current behavior:** the router assumes adapter ERC-20 shares and a specific 1e18 price scale, despite not requiring those operations in the adapter interface.
- **Why it matters:** an otherwise interface-compatible adapter can be treated as 1:1 even when its share units differ, or be impossible to redeem through the router.
- **Recommended correction:** formalize account-specific asset valuation and conversion in the adapter interface, or standardize on a tested ERC-4626-like interface and reject adapters that do not satisfy it.

### M-3 — Rebalance follows static owner targets; it does not optimize yield

- **Severity: Medium**
- **Evidence:** `contracts/src/AeroRouter.sol:190-222` computes allocation drift from target BPS, then moves funds to those targets. It does not compare APYs in rebalance logic. `liveApyBps()` at `:69-84` only reports a weighted rate.
- **Current behavior:** anyone can call `rebalance()` once drift passes the threshold, but the function restores fixed targets. There is no gas haircut, highest-net-rate selection, cap policy, automated caller, reward, or keeper. `minDriftBps` is a hysteresis threshold only.
- **Why it matters:** “best APY” routing and automatic yield optimization are not implemented. Owners must manually set weights; rates do not influence allocation.
- **Recommended correction:** define and validate a bounded allocation policy before describing this as optimization; separately build and operate a keeper only after on-chain controls and failure handling are safe.

### M-4 — No reserve, pause, emergency withdrawal, timelock, or upgrade controls

- **Severity: Medium**
- **Evidence:** `AeroRouter.sol` has `Ownable` and `ReentrancyGuard` but no pause/emergency functions or withdrawal queue. `contracts/docs/AeroRouter.md:61-64` describes pause and UUPS as intended design, not implemented. No timelock appears in source.
- **Current behavior:** the owner can directly change targets and adapters; there is no break-glass stop or timelock delay. The router itself is non-upgradeable. Withdrawals are immediate external calls, not guaranteed liquidity.
- **Why it matters:** docs/products imply controls and reserve behavior users cannot rely on. A malicious or mistaken owner-selected adapter can receive future deposits, and adapter failure can deny withdrawals.
- **Recommended correction:** document the actual trust model; design governance, adapter caps, pause semantics, and emergency withdrawal/loss handling before funds are exposed. A proxy should only be added with a separately reviewed upgrade/admin model.

### L-1 — Adapter “APY” functions report simple annualization, not compounded APY

- **Severity: Low**
- **Evidence:** `BenqiAdapter.sol:40-42` multiplies the per-second rate by seconds/year and BPS; AeroVault frontend APR is computed similarly in `components/testnet/views.tsx:1436-1438`.
- **Current behavior:** this is a simple annualized rate (APR-style), presented in UI copy in places as APY.
- **Why it matters:** percentage labels can overstate precision and compare rates on unlike assumptions.
- **Recommended correction:** label as APR or compute a documented compounded APY using a consistent convention and source period.

## 5. Unverified Risks

- **Real Benqi behavior:** adapter source implements a QiToken-shaped API and checks returned error codes. No test in this audit used a live Benqi RPC. The fork test’s two functions are guarded by `block.chainid != 43114`; the ordinary run did not use `--fork-url` and returned early from both. The adapter’s snapshot/exchange-rate assumptions, market selection, liquidity behavior, and actual rate units remain unverified against a live market.
- **Mock parity:** `MockQiToken` is a simplified model with owner-controlled per-second rate and an exchange-rate approximation. It is not evidence of Benqi or Trader Joe compatibility. Its test-market behavior should not be treated as a protocol simulation with validated failure/liquidity semantics.
- **Losses and conversion edge cases:** no tests exercise market losses, zero/near-zero adapter share price, share conversion rounding, dust exhaustion, a returned amount below requested, or a malicious adapter implementation. The risks described above follow from source paths but the exact user outcome depends on adapter behavior and balances.
- **AeroVault backing:** the vault’s index grows by configured time/rate, while underlying assets do not generate yield. `Deploy.s.sol` seeds 9,000 tUSDC; the finite subsidy can become insufficient for accrued share claims, at which point token transfer will fail. The deployment script does not establish a sustainable yield source.
- **Owner and deployment authority:** code uses direct `Ownable(msg.sender)` ownership. The owner address, key custody, verification status, and operational controls were not established from source alone.
- **Frontend receipt behavior:** `useTx` waits for transaction receipts and surfaces wallet/write errors, but some refreshes are initiated immediately after `write()` as well as after completion. No browser/E2E test was run; stale UI state and wallet rejection UX were not experimentally verified.

## 6. Test and Build Results

Commands ran from `C:\Users\USER\Desktop\Aero\contracts`; Foundry artifacts/cache were redirected to `%TEMP%\aero-yield-audit-20261021`, so the project tree was not used for build output.

1. PowerShell setup and command: `$auditTemp=Join-Path $env:TEMP 'aero-yield-audit-20261021'; New-Item -ItemType Directory -Force -Path $auditTemp | Out-Null; forge test --out (Join-Path $auditTemp 'out') --cache-path (Join-Path $auditTemp 'cache')`
   - Solc `0.8.24` compilation succeeded.
   - 36 passed, 0 failed, 0 skipped across 8 suites.
   - This includes 2 fork-test functions reported as PASS; both internally return immediately on the ordinary local chain because chain ID is not 43114. No fork URL or live mainnet transaction was used.
   - One Solidity mutability warning: `test/AeroNames.t.sol:63` could be `view`.
2. PowerShell command (using the same `$auditTemp`): `forge build --out (Join-Path $auditTemp 'build-out') --cache-path (Join-Path $auditTemp 'build-cache')`
   - Build succeeded with Solc `0.8.24`.
   - Warnings: unused `namesAddr` in `DeployMore.s.sol:25`; mutability warning at `test/AeroNames.t.sol:63`; Foundry lint warnings for `block.timestamp` in `TestUSDC.sol:23` and unchecked test/deployment `transfer()` calls in `AeroBank.t.sol`, `AeroRouter.t.sol`, `AeroVault.t.sol`, `BenqiAdapter.t.sol`, and deployment scripts.
3. The frontend `npm run build` was not run: this audit’s requested executable build was the Foundry project build, while Next’s build writes a generated build directory in the project. No frontend build output was needed to establish the source transaction paths.

The existing tests cover happy-path allocation, weighted reported rates, rebalance to targets, in-band revert, target sum rejection, one router round trip, adapter happy-path deposit/withdraw, and simulated vault accrual. They do not cover idle balances/donations, first-deposit manipulation, duplicate/invalid adapters, allocation invariants after add/remove, share rounding/dust, direct adapter holders mixed with router shares, short withdrawal, illiquidity, a failing adapter, market loss, or a failure in one adapter while other positions remain liquid.

## 7. Deployment and Integration Status

| Integration | Classification | Evidence and limit |
|---|---|---|
| TestUSDC | Simulated/mock | `Deploy.s.sol` deploys faucet-minted 6-decimal tUSDC. Fuji address has code. It is worthless test currency. |
| AeroVault | Simulated/mock | Fixed owner-set rate and time-indexed shares; initial deployment script seeds 9,000 tUSDC to subsidize withdrawals. No external yield source. |
| BenqiAdapter source | Implemented but not verified against live protocol | QiToken-compatible calls, error checks, APY read, adapter share token. Fork tests do not execute unless explicitly run on chain ID 43114. |
| Fuji “Benqi” market | Simulated/mock | `DeployBenqi.s.sol` deploys `MockQiToken` then `BenqiAdapter`; configured market symbol on Fuji is `mqiUSDC`. |
| Trader Joe | Simulated/mock; real adapter missing | `DeployMore.s.sol` deploys another `MockQiToken` and `BenqiAdapter` with a Joe label (`mjjUSDC` market symbol). No Trader Joe-specific adapter/protocol calls exist. |
| AeroRouter | Source implemented and deployed on Fuji, but connected to mocks and accounting is unsafe | Fuji router has code, two slots, 60/40 targets; both deployed slot markets expose mock symbols. At audit check reported total assets were zero. |
| Keeper/agent | Missing; documentation/marketing only | No keeper service or automated rebalance caller was found. `rebalance()` is permissionless but only restores owner targets and requires a caller. |
| Avalanche ICM/Warp | Documentation/configuration only for Aero | `aero deployer.txt` contains a relayer configuration; no Aero Warp messenger contracts, message verification, cross-chain accounting, or app flow were found. A config does not prove a service is running. |
| Timelock, pause, UUPS | Planned/documented only | Mentioned in `contracts/docs/AeroRouter.md`, absent from router implementation. |

Deployment scripts target Fuji only. `DeployMore.s.sol` requires existing token, Benqi-adapter, and names addresses from environment, deploys the second mock market/adapter plus router/pay/bank, and initializes router targets to 60/40. It reads `NAMES_ADDR` into an unused variable; no validation checks the supplied token or adapter belongs to the intended network. No reproducible deployment manifest, chain verification record, or mainnet deployment script was found. The local configured addresses were confirmed to contain Fuji bytecode, but bytecode presence is not source verification or proof of live protocol integration.

## 8. Frontend Integration Findings

- `RouterPanel` (`components/testnet/views.tsx:998-1173`) approves USDC to `CONTRACTS.router`, deposits to `AeroRouter.deposit`, reads router shares/price/APY/total assets, and calls `AeroRouter.withdraw` for all router shares. The UI presents router APY and market allocation, but the live configured venues are mock markets.
- The mock-vault panel (`:1583-2007`) approves and deposits directly into `CONTRACTS.vault`; withdrawals also call `AeroVault.withdraw`. The displayed vault APR is explicitly described as simulated around `:1894-1896`.
- `AdapterPanel` (`:2013` onward) deposits/withdraws directly against `CONTRACTS.adapter`, not the router. That is the same adapter address used in deployed router slot 0, creating the H-1 accounting collision.
- The venue accordion changes which independent panel is expanded. Each panel’s own handler sends to its own address. There is no single venue selector that silently reroutes a common transaction.
- Auto-earn compares the mock vault’s configured rate with the standalone adapter rate (`:1436-1449`) and the explicit add/deposit handler uses the selected best address. The switch only stores a local preference (`localStorage`); turning it on does not automatically deposit or move existing positions. It does not use AeroRouter as the best-rate selector.
- Displayed balances/APRs are read from on-chain state for the configured contracts, but their meaning is limited by the accounting defects and the mock deployments. Router TVL reads the router’s flawed `totalAssets()`; the adapter position reads the user’s adapter shares and adapter share price.
- `useTx` waits for transaction receipts and `TxStatus` shows write errors and a Snowtrace link (`:62-117`). The router withdraw button offers “Withdraw all”; no adapter-failure/liquidity status or reserve estimate is surfaced. There is no frontend pause/queue state to show.

## 9. Documentation and Product Claim Gaps

- **Automatic/best-rate allocation:** docs and landing page describe automatic routing and an agent (`app/docs/page.tsx:67-73`, `components/aero/landing.tsx:589`, `:897-902`). Actual router uses static owner-set targets; Auto-earn only chooses where a future explicit deposit goes, among mock vault and mock adapter.
- **Benqi / Trader Joe:** no live deployment verified. Fuji router uses mock QiToken markets; no Trader Joe adapter implementation exists.
- **Keeper/agent rebalancing:** no operating service exists in source. `rebalance()` is a caller-triggered static target rebalance.
- **Liquid reserve / withdraw anytime:** no explicit reserve is maintained by router allocations and withdrawal can revert on adapter failure or shortfall. No queue/fallback exists.
- **Audited/battle-tested markets:** no audit report or live protocol validation was present in the inspected source/docs. Mocks do not support this claim.
- **Cross-chain Avalanche L1 / Warp Messaging:** `app/docs/page.tsx:84-86` and landing copy claim a routing layer, while router documentation calls Warp a phase-two design (`contracts/docs/AeroRouter.md:70-76`). No Aero cross-chain implementation was found. The standalone relayer config does not bridge Aero funds.
- **Pause, emergency, timelock, upgradeability:** design document only; absent in deployed router code.
- **Self-custody/no Aero can move money:** the user’s assets are held by adapter/vault contracts and adapter allowances; owner controls adapter/target configuration. Wording should reflect those contract and admin trust assumptions.

## 10. Prioritized Remediation Plan

### P0 — Must fix before meaningful testnet validation

1. **Define ownership boundaries and repair router accounting.** Value only router-owned adapter positions; resolve the direct-user/router adapter collision. Include idle assets and define donation treatment. Impact: prevents incorrect share pricing and cross-pool insolvency. Dependency: agree on whether adapters are exclusive to the router or account-scoped.
2. **Make withdrawals loss- and liquidity-aware.** Use idle first, account for actual received amounts, avoid all-or-nothing dependence on one illiquid adapter, and specify partial/queued/revert-with-shares behavior. Impact: users can understand and receive their fair recoverable amount. Dependency: the ownership/accounting model above.
3. **Enforce adapter and allocation invariants.** Reject duplicates, zero/no-code/incompatible adapters; preserve exactly 10,000 BPS during add/remove; formalize share conversion in the interface; use safe approval lifecycle. Impact: prevents malformed configuration from corrupting allocations or asset values. Dependency: finalized adapter interface.
4. **Add adversarial tests before redeploying.** Cover direct adapter holder plus router, idle/donation, first deposit, add/remove invariants, duplicate registration, rounding, losses, shortfalls, illiquidity and adapter failure. Impact: make the corrections reviewable. Dependency: P0 design decisions.

### P1 — Must fix before funding or public launch

1. **Validate a real Benqi integration on an explicit, documented fork.** Select the intended market/underlying, exercise mint/redeem and liquidity paths, verify rate units and exchange-rate/share rounding. Impact: turns a compatible interface claim into evidence. Dependency: P0 adapter/accounting corrections; use read-only fork tests plus local fork simulation, never production funds.
2. **Add governance and emergency controls with a threat model.** Specify owner, timelock, pause, caps, recovery and key custody. Impact: bounds config/admin risks. Dependency: product decisions on who may pause and what withdrawals do while paused.
3. **Correct product and funding evidence.** Separate mock, live, planned, and deployed claims; produce source verification/build/deployment manifests and a reproducible deployment procedure. Impact: reviewers can reproduce technical claims. Dependency: deployment and integration milestones.

### P2 — Important reliability and product improvements

1. Fix and test adapter metadata; label APR/APY accurately; report adapter liquidity and withdrawal limitations in UI. Impact: users/operators see the actual market and rate convention. Dependency: consistent protocol rate interface.
2. Build a keeper only after the safe allocation policy is defined; add monitoring and alerting for drift, failed calls, liquidity and oracle/rate anomalies. Impact: reliable operations. Dependency: P0/P1 controls and a defined optimizer (if desired).
3. Simulate losses, runs, market pause, and depleted mock-vault backing in tests and user flows. Impact: expose failure modes before they are marketed. Dependency: corrected share accounting.

### P3 — Future enhancements

1. Implement multi-market APY optimization with gas/cap/liquidity constraints only after single-chain accounting is proven. Impact: supports an actual best-rate policy. Dependency: protocol adapters, risk limits, keeper, monitoring, audits.
2. Treat ICM/Warp cross-chain routing as a separate architecture and security project. Impact: enables cross-L1 messaging only after single-chain safety. Dependency: message authentication, replay protection, remote accounting and independent audits.
3. Consider upgradeability only if governance and upgrade review justify its added risk. Dependency: explicit admin/timelock model and independent security review.

## 11. Funding Readiness Assessment

A technically informed reviewer can currently be shown a Fuji app, test USDC faucet, mock-rate vault, two mock QiToken markets, an ERC-20 share router, a Benqi-shaped adapter, and a passing local Foundry happy-path suite. The configured Fuji addresses have code, and the router initializes 60/40 target slots.

The project cannot yet demonstrate real Benqi or Trader Joe assets behind the deployed router, working yield optimization, an automated keeper, guaranteed reserve liquidity, robust withdrawal under market loss/failure, live protocol compatibility, cross-chain Warp routing for Aero, or the documented production controls. The tests pass while leaving the principal accounting and failure scenarios uncovered, and the ordinary “fork” test suite does not contact a mainnet fork. Funding claims should be framed as an experimental mock-based prototype until the P0/P1 evidence exists.

Missing evidence includes corrected ownership-aware accounting, failure/loss/illiquidity tests, a deliberately executed and reproducible live-protocol fork test, source-verified deployment manifests, operational keeper evidence if claimed, governance/key controls, and an independent audit of the eventual design.

## 12. Recommended Next Milestone

Build and test a corrected router accounting prototype with an explicit adapter ownership model and withdrawal shortfall policy. Start with the currently confirmed direct-user/router share collision, idle asset accounting, and adapter-failure cases; do not connect it to real markets until the adversarial tests pass and the resulting behavior is reviewed. This is the single prerequisite milestone for meaningful testnet validation.
