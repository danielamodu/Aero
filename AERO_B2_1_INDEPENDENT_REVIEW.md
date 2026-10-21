# AERO B2.1R — Independent Yield Router Code Review

**Review basis:** current working-tree source and Git diff, `AERO_YIELD_BASELINE_AUDIT.md`, and `AERO_YIELD_REMEDIATION_REPORT.md`. This is a static review; no tests, deployments, transactions, or external network calls were performed. No implementation files were changed.

## Findings

### H-1 — First depositor can profit from a donation-driven share inflation attack

- **Severity:** High
- **File/function:** `contracts/src/AeroRouter.sol`, `deposit()` (lines 183–209), `totalAssets()` (76–81), and `withdraw()` (213–238).
- **Behavior:** A first deposit mints `shares = assets` with no virtual shares/assets, locked minimum liquidity, or minimum-share slippage parameter. Once any shares exist, direct donations are counted in `totalAssets()` and therefore raise the price used for later deposits. The orphan recovery guard only applies while supply is zero; it does not protect a pool after a minimal first deposit.
- **Reproduction:** With 6-decimal USDC, an attacker deposits 1 base unit (0.000001 USDC), receiving 1 raw router share. The attacker transfers 1,000,000 base units ($1) directly to the router. A victim then deposits 2,000,000 base units ($2): `floor(2,000,000 * 1 / 1,000,001) = 1` raw share. At that point the router has 3,000,001 base units of assets and 2 shares. Assuming the adapters redeem at par, the attacker's 1 share withdraws 1,500,000 base units ($1.50), while the victim's 1 share is worth the same $1.50. The attacker paid 1,000,001 base units and receives 1,500,000; the victim loses about $0.50 of the $2 deposit. The 60/40 test allocation is compatible with these amounts, so the position can be redeemed from the two slots.
- **Impact:** A depositor can be diluted and lose value to an attacker who seeds the pool, donates assets, and waits for a deposit. Dust rounding makes the attack practical even though first deposits are blocked when the router is already empty but contains a donation.
- **Recommended correction:** Add a proven ERC-4626-style inflation-attack defense (virtual assets/shares or an equivalent high-precision share offset) and a user-provided `minShares`/slippage bound. Add an adversarial test using the raw-unit sequence above. A minimum deposit alone is not a robust defense unless the pricing math also prevents the donation/rounding capture.

### H-2 — The configured frontend still sends deposits to the pre-remediation Fuji router

- **Severity:** High operational risk
- **File/function:** `lib/testnet.ts` (`routerConfigured`, line 29) and `components/testnet/views.tsx` (`QuickDeposit`, lines 1374–1444; `RouterPanel`, lines 996–1167).
- **Behavior:** `routerConfigured` only checks that `NEXT_PUBLIC_ROUTER` is nonzero. `QuickDeposit` selects `CONTRACTS.router` whenever that is true, and `RouterPanel` approves and calls that same address. The current ignored `.env.local` still has `NEXT_PUBLIC_ROUTER` set to the pre-B2.1 Fuji router recorded in the baseline audit. I compared the value without printing it; it is the same address. No bytecode/version/interface check prevents the UI from using it.
- **Reproduction:** Run the current frontend with the existing `.env.local` and use Quick deposit or RouterPanel. The USDC approval and `deposit` call target the old router. Its deployed bytecode does not contain B2.1's router-owned adapter accounting or `slotAssets`; the UI also queries `slotAssets`, which that router does not implement. The deposit/withdraw signatures still match, so the transaction path can reach the old accounting code even while the slot-value read fails.
- **Impact:** Users can interact with the vulnerable pre-remediation contract through a UI that describes the new router behavior. Removed direct-adapter controls do not upgrade or replace the deployed router. Existing Fuji code remains unchanged by design.
- **Recommended correction:** Treat the router address as a deployment gate: update it only to the newly deployed B2.1 router, verify chain ID and deployed runtime/interface before enabling the route, and fail closed or clearly disable router deposits when that verification fails. Do not treat a nonzero address as proof of a B2.1 deployment.

### M-1 — Router accepts adapter deposits without verifying that router shares were minted

- **Severity:** Medium
- **File/function:** `contracts/src/AeroRouter.sol`, `_depositIntoSlot()` (278–287), called from `deposit()` (183–209); adapter checks in `_validateAdapter()` (325–344).
- **Behavior:** `_depositIntoSlot()` checks that the adapter returns a nonzero share count and consumes the expected USDC. It does not compare `sharesOf(address(this))` before and after the call, nor verify that the balance increase matches the reported shares. `_validateAdapter()` calls conversion methods with zero, which checks that selectors respond but does not validate useful conversion or mint behavior.
- **Reproduction:** An owner registers an adapter with the expected asset/router getters and conversion selectors. Its `deposit()` transfers the approved USDC out of the router and returns `1`, but mints no shares to the router. The compatibility probes pass and `_depositIntoSlot()` accepts the transfer. The router then mints user shares based on pre-deposit assets although the adapter position is zero; `totalAssets()` falls by the amount sent to the adapter.
- **Impact:** A buggy or malicious owner-selected adapter can make a successful router deposit lose value immediately. The owner already chooses adapters, so this is not a permissionless path to install an adapter; it is an unenforced integration invariant that makes mistakes or compromised adapter behavior destructive.
- **Recommended correction:** Measure router-owned adapter shares before and after deposit; require the increase to match the adapter's reported shares and require the post-deposit conversion to support the expected received value within defined rounding bounds. Consider equivalent share-balance checks on adapter withdrawals. Add a deliberately non-minting adapter test.

### M-2 — Deployment script can be given the incompatible legacy adapter, and binding depends on reusing the same owner key

- **Severity:** Medium operational risk
- **File/function:** `contracts/script/DeployMore.s.sol`, deployment comments (lines 12–16) and `run()` (21–39); `contracts/script/DeployBenqi.s.sol`, `run()` (17–32); `contracts/src/BenqiAdapter.sol`, `setRouter()` (50–55).
- **Behavior:** `DeployMore`'s header says it “Reuses the existing … Benqi adapter,” while the new router requires `router()`, `convertToAssets`, `convertToShares`, and `sharesOf` and the old deployed adapter predates those methods. `DeployBenqi` now deploys a compatible adapter and tells the operator to pass it to `DeployMore`, but the `BENQI_ADAPTER_ADDR` name does not distinguish that new adapter from the legacy configured one. In addition, `setRouter()` is one-time and `onlyOwner`; the owner is the key that deployed the adapter.
- **Reproduction:** Pass the baseline Fuji `BENQI_ADAPTER_ADDR` to `DeployMore`: router construction reaches `_validateAdapter()` and the legacy adapter cannot satisfy the new interface, so construction reverts. Or deploy a fresh adapter with one `DEPLOYER_KEY` and run `DeployMore` with another: the router can be created with the unbound adapter, but the subsequent `setRouter()` call reverts `OwnableUnauthorizedAccount`, leaving already-broadcast deployment transactions and an unbound adapter/router.
- **Impact:** The documented deployment path is ambiguous and can fail or leave a newly created router unusable. This does not alter the existing Fuji deployment, but it can waste testnet gas and complicate recovery.
- **Recommended correction:** Make the script deploy the compatible adapters and router in one script/run, or explicitly require a freshly deployed compatible adapter and the same deployer key. Add preflight checks for adapter code, expected interface, owner, unbound router, and underlying token; correct the “reuse existing adapter” comment.

### L-1 — Router-share ERC-20 decimals do not match the raw-unit share math

- **Severity:** Low
- **File/function:** `contracts/src/AeroRouter.sol`, constructor and `deposit()` (43–44, 183–209); inherited ERC-20 `decimals()` is not overridden. The adapter has the same pattern in `contracts/src/BenqiAdapter.sol` (36–37, 113–126).
- **Behavior:** OpenZeppelin ERC-20 reports 18 decimals by default, while the first deposit mints raw shares equal to the 6-decimal USDC base-unit amount. Subsequent conversion math preserves value in raw units, and the current frontend calculates positions from raw balances and `sharePrice`, but the token metadata says each raw share amount is 18-decimal formatted.
- **Reproduction:** Deposit 1 USDC (`1,000,000` raw USDC units) into an empty router. The router mints `1,000,000` raw shares; a wallet using the reported 18 decimals displays `0.000000000001` router shares rather than 1 share. Integrations using ERC-20 display units or deriving a human-unit token price from `sharePrice()` can misstate the position.
- **Impact:** Wallet displays and third-party integrations can show misleading share balances/prices even while the app's custom raw-unit calculation shows the correct USDC value.
- **Recommended correction:** Align share decimals and mint scaling with the intended accounting convention (for example, use asset decimals for raw-unit 1:1 shares or mint normalized 18-decimal shares), and expose/test standard conversion previews for integrators.

### L-2 — Frontend allocation panel only displays two slots despite unrestricted adapter additions

- **Severity:** Low
- **File/function:** `components/testnet/views.tsx`, `RouterPanel()` (1078–1085); `contracts/src/AeroRouter.sol`, `addAdapter()` (142–151).
- **Behavior:** The router can append adapters, but `RouterPanel()` renders only indices 0 and 1. Its total TVL includes all slots, so after a third adapter is added, the visible slot percentages no longer explain the whole displayed router TVL.
- **Reproduction:** Owner adds a compatible adapter at zero target, sets nonzero targets summing to 10,000 BPS across three slots, then rebalances/deposits. The router accounts for all three positions, but the interface continues to show only the first two.
- **Impact:** Users may not see where all router assets are allocated or understand the displayed allocation. The current deployment scripts create two slots, so this requires a later administration change.
- **Recommended correction:** Read `slotCount()` and render each configured slot dynamically, with an explicit loading/error state if the router ABI or call is incompatible.

## Areas with no confirmed defect found

- The revised router's current-source accounting formula includes router idle USDC and values adapter positions using router-owned shares. No double counting was found in that formula, subject to adapters correctly implementing their valuation interface.
- Direct USDC donations while shares exist are intentionally credited to current shareholders. Pre-share orphaned USDC blocks deposits and can be recovered by the owner. The pre-share donation policy does not address the H-1 post-seed inflation attack.
- Current-source withdrawals use idle first, calculate the remaining amount pro rata over invested slot values, measure actual USDC deltas, and revert atomically on adapter failure or short payment. The tests exercise these stated semantics. This review did not validate an external protocol's liquidity or live market behavior.
- The revised Benqi adapter binds once, gates deposit/withdraw to the bound router, stores `marketId`, and uses explicit share conversion methods. The constructor binding order in `DeployMore` is valid when the adapter is fresh and the same owner key binds it.
- Target totals remain 10,000 BPS through zero-target additions/removals and validated `setTargets`; duplicate and non-contract adapters are rejected in the current router source.
- The current UI's vault deposit path still targets AeroVault and labels its rate simulated. Router deposit/withdraw actions target `CONTRACTS.router`; Quick deposit explicitly sends to that router when configured and says that allocation follows fixed targets. Current copy does not claim that rebalance selects the highest rate. The configured-address issue in H-2 remains a separate integration blocker.
- The review found no direct standalone Benqi adapter deposit path in the changed frontend. The UI still contains stale “Auto-earn deposited” notifications for user-triggered deposits (e.g. `RouterPanel()` and the mock-vault flow); this is imprecise copy, not a contract or routing vulnerability.

## Review limits

This review did not execute Foundry tests, run a fork, query Fuji, submit transactions, deploy contracts, or alter implementation/configuration files. The adapter share-mint finding is a compatibility-contract scenario; the active `BenqiAdapter` implementation mints router shares as intended, but the router does not enforce that invariant for other registered adapters. External market correctness and liquidity remain unverified.

## Conclusion

The confirmed share-inflation attack must be mitigated and the frontend must be gated away from the legacy router before controlled Fuji deployment preparation proceeds. The adapter share-delta check and deployment-script preconditions should also be resolved before adapter onboarding; the remaining low-severity integration issues should be addressed before broader use.

**CONDITIONAL PASS — specific issues must be resolved first.**
