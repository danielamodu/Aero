# Aero Yield Router Accounting Remediation — B2.1

## Architectural decisions

- Adapters registered with `AeroRouter` are router-exclusive: they accept deposits and withdrawals only from their one-time bound router. An adapter can be deployed unbound, included in the router constructor, and then bound to the router. This resolves the deployment-address circularity without a factory or upgrade mechanism.
- `IYieldAdapter` explicitly exposes `convertToAssets(shares)`, `convertToShares(assets)`, and `sharesOf(account)`. The router values only the shares it owns; there is no implicit 1:1 fallback.
- `totalAssets()` is the sum of USDC held by the router and the underlying value of each router-owned adapter position. Adapter balances held by other accounts are excluded.
- USDC sent directly to the router is included in its assets. Donations while shares exist accrue to shareholders. If assets are donated before the first share is minted, deposits are blocked until the owner recovers those orphaned assets.
- Withdrawals are all-or-nothing. They use idle USDC first, then redeem the required amount across invested slots in proportion to their router-owned asset values. Each redemption is verified by the router's measured USDC balance change. Any revert, illiquidity, or short payment reverts the whole transaction, including earlier redemptions, so user shares are not burned on a failed withdrawal. No queue, partial withdrawal, or guaranteed liquidity is introduced.
- Targets must sum to exactly 10,000 BPS. An adapter is added at zero target and can be removed only at zero target with no router-owned shares; target updates remain atomic.
- Router share conversions use OpenZeppelin full-precision `Math.mulDiv`, rounding down for asset/share quotes except adapter `convertToShares`, which rounds up to avoid under-pulling. Losses lower `totalAssets()` and the router share price.

## Modified files

- `contracts/src/AeroRouter.sol` — router accounting, conversions, donations, withdrawal behavior, and adapter management invariants.
- `contracts/src/BenqiAdapter.sol` and `contracts/src/interfaces/IYieldAdapter.sol` — router-exclusive adapter ownership, explicit share conversions, and persisted market ID.
- `contracts/test/mocks/MockYieldAdapter.sol` — test adapter with loss, revert, illiquidity, and short-payout controls.
- `contracts/test/AeroRouter.t.sol` and `contracts/test/BenqiAdapter.t.sol` — adversarial router and adapter coverage.
- `contracts/script/DeployBenqi.s.sol` and `contracts/script/DeployMore.s.sol` — deployment flow messages and post-router adapter binding. These scripts were compiled but not run.
- `components/testnet/views.tsx`, `components/testnet/terminal.tsx`, and `components/testnet/shell.tsx` — remove standalone adapter deposit/accounting paths, show router-owned slot assets, and describe configured target allocation. The AeroVault demo remains and is labelled simulated.
- `lib/contracts/abi/AeroRouter.ts`, `lib/contracts/abi/BenqiAdapter.ts`, `lib/contracts/index.ts`, `lib/testnet.ts`, and `.env.example` — frontend ABI/config alignment and removal of the standalone adapter address setting.

## Accounting and withdrawal invariants

1. `totalAssets = router USDC balance + Σ adapter.convertToAssets(adapter.sharesOf(router))`.
2. Router deposits measure the received token amount, mint shares against pre-deposit total assets, use temporary exact adapter approvals, and require the adapter to consume the expected amount and mint shares.
3. Adapter withdrawals use only router-owned adapter shares. Router receipt is measured; the adapter's return value is not trusted for accounting.
4. Router shares are burned only after sufficient assets have been redeemed and the recipient's measured USDC balance has increased by the amount owed. An unsuccessful path reverts atomically.
5. Zero-supply deposits are 1:1 only when no assets or adapter positions are present. A total-loss state with outstanding supply rejects new deposits.
6. Allocation invariants are checked at construction and after add, remove, and target changes. An adapter with an outstanding router position cannot be removed.

## Test coverage

The router tests cover router-only adapter shares and valuation, idle USDC, direct donations and orphan recovery, first and later deposits, rounding, duplicate/zero/non-contract/incompatible adapters, allocation invariants, adapter donations and losses, idle-first withdrawal, complete withdrawal, illiquidity, reverting and short-return adapters, and rollback when one redemption fails after another has succeeded. Adapter tests cover direct-user rejection, router deposit/withdraw, share conversion, rate updates, one-time router binding, and market ID persistence.

The complete Foundry run reported **57 passed, 0 failed, 0 skipped** across 8 suites. This includes the two files under `test/fork/`, but no live fork was configured or executed; this report makes no fork-verification claim. The pre-existing non-yield suites also passed.

## Build and test results

Commands run from `C:\Users\USER\Desktop\Aero\contracts` (Foundry output and cache were directed to temporary folders):

```powershell
$auditTemp = Join-Path $env:TEMP 'aero-yield-b2-20261021'
forge test --out (Join-Path $auditTemp 'out') --cache-path (Join-Path $auditTemp 'cache')
forge build --out (Join-Path $auditTemp 'build-out') --cache-path (Join-Path $auditTemp 'build-cache')
$cleanTemp = Join-Path $env:TEMP 'aero-yield-b2-20261021-clean'
forge build --out (Join-Path $cleanTemp 'out') --cache-path (Join-Path $cleanTemp 'cache')
```

Both commands succeeded. A clean `forge build` compiled 61 files with Solc 0.8.24. It reported:

- Solidity compiler warning 2072: unused `namesAddr` local in `contracts/script/DeployMore.s.sol:25`.
- Solidity compiler warning 2018: `test_unknownResolvesEmpty` in `contracts/test/AeroNames.t.sol:63` could be marked `view`.
- Foundry `block-timestamp`: `contracts/src/TestUSDC.sol:23` compares against `block.timestamp` for the faucet cooldown.
- Foundry `erc20-unchecked-transfer`: `contracts/test/AeroBank.t.sol:21`, `contracts/test/AeroVault.t.sol:50`, `contracts/script/Deploy.s.sol:27`, `contracts/script/DeployBenqi.s.sol:26`, and `contracts/script/Seed.s.sol:23-24`.

The yield-router tests added checked transfer results and emit no such warnings.

Frontend checks:

```powershell
npm run typecheck
git diff --check
```

`npm run typecheck` completed with exit code 0. `git diff --check` completed with exit code 0. Git emitted line-ending normalization notices for modified files; those are not whitespace errors. No Next.js production build was run.

## Remaining limitations and risks

- Withdrawal liquidity depends on every adapter needed for the requested pro-rata redemption. If any required market cannot redeem enough, the withdrawal reverts as a whole; this avoids silent loss or partial semantics but does not ensure timely liquidity.
- The adversarial failure/loss behavior was tested with local mocks. No live Fuji transaction, external protocol fork, or production-market integration was executed.
- The router assumes standard USDC transfer behavior; exact balance-delta checks intentionally reject fee-on-transfer or short-transfer behavior.
- Adapter binding is one-time and owner-gated. Deployment must use the adapter owner for binding after the router is deployed; configuration must be verified before users deposit.
- No independent security audit has been performed.

## Deployment implications

No contracts were deployed, no transactions were submitted, and mainnet was not accessed. Existing Fuji contracts were left untouched and cannot acquire these source changes in place. A future testnet rollout requires deploying new compatible adapter/router contracts, binding each adapter to its router, configuring the frontend with the new addresses, and validating the new deployment before use. The older deployed standalone adapter is not compatible with the new explicit router-exclusive interface. The existing AeroVault mock demonstration remains separate and simulated.

No commit or push was made. Implementation and verification are complete for review.
