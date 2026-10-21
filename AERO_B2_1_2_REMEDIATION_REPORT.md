# AERO B2.1.2 — Finding Closure Remediation Report

**Date:** 2026-10-21

**Scope:** Close B2.1.2 findings R-1, R-2, R-3 and frontend read-failure observations.

**Deployment status:** No contract deployment, Fuji transaction, broadcast, or mainnet action was performed.

## Executive result

- **R-1 — Closed.** `AeroRouter` now accepts exactly six-decimal assets. The supported boundary is enforced by the contract itself and deployment scripts retain their existing six-decimal preflight.
- **R-2 — Fail-closed implementation complete; trusted deployment identity pending.** The frontend verifies chain, configured router address, router bytecode hash, asset, router version/configuration, every configured adapter address and runtime hash. The trust anchor is source-controlled configuration, not runtime environment. There is no verified B2.1.1 deployment record in the checkout to populate that manifest, so its identity values intentionally remain empty; router actions stay disabled until a deployment is independently verified and the manifest is reviewed and committed.
- **Frontend read-failure handling — Closed in the affected calculations.** Unknown values remain unavailable, successful zero values remain zero, and an incomplete router position is excluded from aggregate totals. The collapsed EarnTab row identifies mock rates.
- **R-3 — Closed as an operational procedure.** A recovery checklist documents sequential broadcast behavior and stop conditions for partial deployments.

**Fuji readiness:** Ready for controlled Fuji **deployment preparation only**, with six-decimal test USDC and mock markets. The frontend is not ready to enable router transactions until a fresh deployment is verified and the source-controlled manifest is populated. No live-yield functionality was added.

## Finding closure details

### R-1 — Supported asset boundary and inflation recovery

`contracts/src/AeroRouter.sol` now reverts unless `IERC20Metadata(asset).decimals() == 6`. The existing `virtualShares = 10 ** (18 - assetDecimals)` normalization and `minShares` execution check are unchanged. Both `DeployMore.s.sol` and `DeployBenqi.s.sol` now check that the configured asset has code and exactly six decimals before deployment work proceeds.

`contracts/test/AeroRouter.t.sol` adds constructor coverage for six-decimal support and rejection of 0-, 8- and 18-decimal assets. The classic one-base-unit seed / 1,000,000-unit donation / 2,000,000-unit victim deposit test now completes the victim’s full exit and then invokes owner orphan recovery with the attacker as receiver. It asserts the victim loses at most one raw unit and the attacker’s withdrawal plus recoverable orphan residue is at most seed plus donation plus one raw unit. The repeated-donation fuzz case also performs full exit and checks total recovery whenever nonzero orphaned assets remain.

This confines the documented one-raw-USDC-unit bound to the exact six-decimal asset family supported by the contract. The router no longer accepts the 18-decimal configuration that produced the reviewed larger loss.

### R-2 — Deployment identity gate

Added `lib/router-deployment-identity.mjs` with a strict manifest verifier and read-only verification helper. It rejects a missing/incomplete/malformed manifest, wrong chain, wrong configured router, absent bytecode, wrong router code hash, wrong asset, stale router version, invalid/incomplete configuration, slot-count mismatch, adapter address mismatch, absent adapter bytecode, or adapter hash mismatch. Runtime hashes use `keccak256` of the actual runtime bytecode.

Added `lib/fuji-router-manifest.ts` as the source-controlled trust anchor. It contains the expected manifest shape and Fuji chain but intentionally has no router, asset or adapter identity values. A verified new deployment is required before these fields can be populated. `NEXT_PUBLIC_*` values identify which deployment the client requests; they do not supply the trusted hashes/addresses.

`useRouterDeploymentGate` in `components/testnet/views.tsx` now compares the configured deployment against this manifest and checks bytecode for the router and each slot adapter. Router approvals, deposits and withdrawals depend on the resulting `ready` state. `components/testnet/shell.tsx` reuses the same gate, and `components/testnet/terminal.tsx` uses the same verifier before displaying router APY. An unconfigured router still leaves the clearly labeled simulated AeroVault available; a configured-but-unverified router does not route through an alternate router or permit router actions.

**Manifest population is deliberately pending.** Local `contracts/broadcast/DeployMore.s.sol/43113/run-latest.json` records a five-transaction stack (one mock market, one adapter, router and two companion contracts), which does not match the current source script’s two markets, two adapters and post-deployment bindings. It is not adopted as the trust manifest. No attempt was made to replay it or send transactions.

### Frontend read failures

Added `lib/router-portfolio.mjs` to preserve the distinction between a valid zero and missing/failed position inputs. `EarnTab` shows an unavailable marker for incomplete router reads and withholds the aggregate portfolio value instead of substituting zero. A configured but unverified router produces an explicit status message; the Mock vault is identified as a separate simulated venue. The collapsed router summary now reads “Auto-router · mock rates.”

The yield digest in `components/testnet/shell.tsx` skips portfolio updates unless the shared deployment gate passes and all vault/router share and price reads succeed. Failed router reads no longer enter calculations as zero.

### R-3 — Deployment recovery procedure

Created [AERO_FUJI_DEPLOYMENT_RECOVERY_CHECKLIST.md](C:/Users/USER/Desktop/Aero/AERO_FUJI_DEPLOYMENT_RECOVERY_CHECKLIST.md). It covers pre-broadcast simulation, expected broadcast order, receipt verification, ownership and one-time adapter binding, router configuration, source-controlled manifest creation, partial-deployment recovery, and explicit conditions that prohibit frontend configuration.

## Files changed for this remediation

- `contracts/src/AeroRouter.sol`
- `contracts/script/DeployBenqi.s.sol`
- `contracts/test/AeroRouter.t.sol`
- `components/testnet/views.tsx`
- `components/testnet/shell.tsx`
- `components/testnet/terminal.tsx`
- `lib/fuji-router-manifest.ts`
- `lib/router-deployment-identity.mjs`
- `lib/router-deployment-identity.d.mts`
- `lib/router-portfolio.mjs`
- `lib/router-portfolio.d.mts`
- `scripts/router-deployment-identity.test.mjs`
- `scripts/router-portfolio.test.mjs`
- `AERO_FUJI_DEPLOYMENT_RECOVERY_CHECKLIST.md`
- `AERO_B2_1_2_REMEDIATION_REPORT.md`

The checkout contained pre-existing uncommitted edits in several files touched here. Their unrelated hunks were preserved. No package/dependency file was changed by this remediation.

## Verification

Commands and results:

```powershell
# From contracts/
$auditTemp = Join-Path $env:TEMP 'aero-b2-1-2-remediation-final-20261021'
forge test --out (Join-Path $auditTemp 'out') --cache-path (Join-Path $auditTemp 'cache')
# 67 passed, 0 failed, 0 skipped; 8 suites, Solc 0.8.24.

forge test --match-test 'test_virtualOffsetPreventsClassicDonationInflationAttack|testFuzz_virtualOffsetBoundsRepeatedDonationAttack|test_constructorAcceptsOnlySixDecimalAsset' --out (Join-Path $auditTemp 'out') --cache-path (Join-Path $auditTemp 'cache')
# 3 passed, 0 failed, 0 skipped; fuzz test ran 256 cases.

$buildTemp = Join-Path $env:TEMP 'aero-b2-1-2-remediation-final-build-20261021'
forge build --out (Join-Path $buildTemp 'out') --cache-path (Join-Path $buildTemp 'cache')
# Passed; compiled 61 files with Solc 0.8.24.

# From repository root
node --test scripts/router-deployment-identity.test.mjs scripts/router-portfolio.test.mjs
# 13 passed, 0 failed, 0 skipped (10 identity cases, 3 read-state cases).

npm run typecheck
# Passed (tsc --noEmit).

$env:AERO_RELEASE_ENVIRONMENT = 'testnet'
$env:NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT = 'testnet'
$env:AERO_RELEASE_CHAIN_ID = '43113'
$env:NEXT_PUBLIC_AERO_RELEASE_CHAIN_ID = '43113'
npm run build
# Passed: release precheck accepted explicit Fuji testnet classification;
# Next.js production build and static page generation completed.

git diff --check
# Passed; Git printed line-ending normalization notices for pre-existing files.
```

The full Forge output includes two `BenqiMainnetForkTest` cases counted as passing; both return early unless `block.chainid == 43114`. No fork URL was configured and this was not live-network verification. The identity and portfolio tests are Node unit tests of the gate/calculation utilities; no browser-rendering or RPC integration test was run. Deployment scripts were not executed.

Foundry build warnings were limited to the existing `AeroNames.t.sol` mutability warning, `TestUSDC.sol` timestamp lint, and unchecked ERC-20 transfer lints in unrelated vault/bank/seed scripts. Next.js also reported the existing middleware-to-proxy deprecation, missing `metadataBase`, and parent `pnpm-workspace.yaml` notice.

## Remaining risks and restrictions

- The source-controlled Fuji manifest is intentionally incomplete until a fresh stack is deployed and independently verified. Therefore all router writes remain disabled in this checkout even if environment addresses are populated.
- A complete code hash verifies exact deployed runtime bytecode but does not protect against a compromised application bundle or unreviewed source-control change. Manifest changes must use the protected review process described in the checklist.
- Foundry broadcasts remain a sequence of independent transactions. Simulation does not make mined transactions atomic, and a partial result requires operator recovery.
- Mock market rates are simulated; no live protocol integration, market liquidity test, Fuji transaction, or external audit was performed.
- Existing unrelated working-tree changes were preserved. No dependencies were changed, no deployment/broadcast was performed, and no commit or push was made.

## Conclusion

**CONDITIONAL PASS —** suitable for controlled Fuji deployment preparation with six-decimal test USDC and fresh mock adapters/markets. Do not configure the frontend with a router address or enable router interactions until the post-deployment identities are independently verified and committed in `lib/fuji-router-manifest.ts`.
