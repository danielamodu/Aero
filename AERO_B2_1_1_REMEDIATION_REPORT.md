# AERO B2.1.1 Yield Router Security Remediation Report

**Date:** 2026-10-21
**Scope:** Router accounting, adapter deposit validation, Fuji frontend gating, deployment script safety, share decimals, and configured-slot display.
**Status:** Implemented and locally verified. No contracts were deployed and no transactions were submitted.

## Changes made

### H-1 — Router share inflation and rounding

`contracts/src/AeroRouter.sol` now mints normalized 18-decimal router shares using a virtual asset of one underlying base unit and virtual shares scaled from the underlying token decimals. Conversion uses full-precision `Math.mulDiv` and rounds down. Deposits accept `minShares`; `previewDeposit` gives the caller a quote to bound execution slippage. Deposits remain blocked when the router has unowned assets before its first share, and when supply exists after a total loss.

The frontend requests a preview and submits a 50-basis-point minimum-share bound. Router share price and frontend position valuation use the normalized share unit. Donation tests cover a one-base-unit seed, a direct donation, victim deposits, repeated donation installments, and fuzzed seed/donation/deposit sizes. A victim can lose at most one raw USDC base unit to the tested floor rounding; the attacker does not recover more than seed plus donations.

### M-1 — Adapter deposit result and value validation

Before each adapter deposit, the router snapshots its USDC balance, router-owned adapter shares, and their converted asset value. It uses an exact temporary approval and clears it after the call. It then checks that the adapter consumed the full allocation, minted a positive share delta, reported exactly that delta, and increased the position value by the allocation less at most one smallest adapter share (at least one underlying base unit of tolerance).

Test-only adversarial behaviors exercise no mint, incorrect reported shares, and an underlying-value shortfall. Each case reverts atomically, restoring token balances and router supply.

### H-2 — Fail-closed frontend router gate

Router reads and actions require a connected Fuji wallet, bytecode at the configured router address on Fuji, deployment version `2111`, the configured USDC asset, 1–16 slots, and `configurationValid()`. An invalid or stale configured address disables router actions; it does not silently route deposits to the old router or to the simulated vault. The vault remains the explicitly labeled fallback only when no router address is configured.

Router deposits use the preview/minimum-share interface. Read-only router position and rate displays in the terminal and shell use the deployment checks as well.

### M-2 — Deployment script preflight

`contracts/script/DeployMore.s.sol` now creates a fresh pair of mock markets and adapters, deploys the router against the provided six-decimal USDC, binds both adapters, and checks deployer ownership, version, and complete router configuration before printing success. It no longer accepts a potentially stale adapter address from a separate deployment run. `DeployBenqi.s.sol` is labeled as a standalone unbound diagnostic stack and no longer directs operators to pass its adapter into `DeployMore`.

Foundry broadcast transactions are separate chain transactions, not one atomic on-chain transaction. The script’s full simulation and preflight must succeed before the operator chooses to broadcast. This review did not run the script in broadcast mode.

### L-1 / L-2 — Decimals and slot display

Router shares explicitly use 18 decimals. Benqi adapter shares and the test adapter report the underlying token’s decimals, preserving their raw-unit conversion semantics. The UI reads the router’s configured slot count, renders every slot up to the contract’s 16-adapter limit, and reports unavailable slot data instead of implying zero allocation. Routed TVL is hidden when the total or any configured slot read is unavailable.

The router panel and quick-deposit copy identify the displayed Fuji rates as simulated mock-market rates, not live Benqi or Trader Joe market yields.

## Verification

- `forge test` — **66 passed, 0 failed, 0 skipped**. This includes 32 router tests and 256 fuzz runs for the repeated-donation bound.
- `npm run typecheck` — passed.
- `npm run build` — passed; optimized Next.js production build and static page generation completed.
- Clean Foundry build using separate temporary output/cache paths — passed.
- `git diff --check` — passed.

The two `BenqiMainnetForkTest` cases reported as passing by plain `forge test` return early unless the chain ID is `43114`. They therefore did **not** exercise a live mainnet fork in this run.

Build output also reported existing repository warnings: Next.js `middleware` naming is deprecated, `metadataBase` is unset, and Next.js detected a parent `pnpm-workspace.yaml` outside the repository. Foundry emitted existing lint warnings in unrelated faucet, seed, vault, and bank files.

## Deployment and remaining operational steps

No contract deployment, transaction, dependency change, commit, or push was performed. The current local router environment address was left untouched; the frontend gate will reject it unless it passes the B2.1.1 checks. After review, controlled Fuji deployment preparation must use the fresh `DeployMore.s.sol` output and configure the frontend with that newly validated router address. The markets deployed by this script are mocks, so their rates are simulated and are not production live-market yield.

## Conclusion

**CONDITIONAL PASS —** local remediation and verification are complete. Proceed only to controlled Fuji deployment preparation after independent review; live-market integration was not tested by this run.
