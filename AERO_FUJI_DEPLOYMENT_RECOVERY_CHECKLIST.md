# Aero Fuji Router Deployment and Recovery Checklist

This checklist covers the B2.1.1 mock-market router stack. It does not authorize a deployment, broadcast, or transaction. Broadcast transactions are separate chain transactions and cannot be rolled back as one group.

## Before broadcast

- [ ] Confirm the target is Avalanche Fuji (chain ID `43113`) and use the approved six-decimal Fuji test USDC address.
- [ ] Confirm `TEST_USDC_ADDR` points to a contract and `decimals()` returns exactly `6`.
- [ ] Confirm the Fuji deployer key is funded with test AVAX, belongs to the intended operator, and is not a production key. Never put key material in the manifest or report.
- [ ] Run `forge script script/DeployMore.s.sol --rpc-url fuji` without `--broadcast` and inspect the full simulation output. Do not proceed if simulation, ownership, adapter binding, router version, or configuration checks fail.
- [ ] Confirm the plan uses `DeployMore.s.sol` to deploy fresh mock markets and adapters. Do not pass standalone adapters from `DeployBenqi.s.sol` into the integrated router deployment.
- [ ] Record the simulation output privately for operator review. Do not configure frontend addresses from simulation-only predicted addresses.

## Broadcast order and individual verification

`DeployMore.s.sol` broadcasts creations and binding calls as distinct transactions. The expected order is:

1. Mock Benqi market creation.
2. Mock Trader Joe market creation.
3. Benqi adapter creation.
4. Trader Joe adapter creation.
5. Router creation with the two adapters and 60/40 target weights.
6. Benqi adapter `setRouter(router)` binding.
7. Trader Joe adapter `setRouter(router)` binding.
8. AeroPay creation.
9. AeroBank creation.

- [ ] After broadcast, record the transaction hash and receipt for every item; confirm each receipt succeeded and each deployed address has bytecode.
- [ ] Confirm router and adapters have the expected deployer owner. Confirm each adapter’s `router()` equals the new router address and cannot be rebound.
- [ ] Confirm router `deploymentVersion() == 2111`, `asset()` equals the approved Fuji test USDC, and `slotCount() == 2`.
- [ ] Confirm slot 0/1 adapter addresses and target weights are the expected fresh adapters and 6000/4000 BPS.
- [ ] Confirm `configurationValid() == true`; independently read each adapter asset, router, code, market ID, and share conversion calls.
- [ ] Confirm the two adapter markets and displayed rates are mock markets; do not describe them as live yield.
- [ ] Confirm AeroBank owner and the companion AeroPay/AeroBank addresses from successful receipts.

## Partial deployment recovery

- [ ] If any transaction fails or its status is unknown, stop. Do not submit frontend configuration and do not blindly rerun the whole script; rerunning creates another set of contracts.
- [ ] Inspect every prior receipt and address. Distinguish mined deployments from pending, failed, or unsent transactions.
- [ ] If the router was deployed but one or more adapter bindings failed, the router is unusable for deposits: `configurationValid()` must be true before any client may enable it. Only the adapter owner may make its one-time binding; verify that owner before attempting a separately reviewed recovery transaction.
- [ ] If a market or adapter deployed but the router did not, treat those contracts as orphaned diagnostic deployments. Do not bind them to an unrelated router or include them in frontend settings without a fresh compatibility and ownership review.
- [ ] If the router is bound but a companion AeroPay/AeroBank transaction failed, record the incomplete deployment and decide separately whether a companion-only recovery is appropriate. Do not reuse ambiguous script output as a complete deployment record.
- [ ] If ownership is wrong, a binding is already consumed, code is missing, asset/decimals/targets differ, or the final configuration check fails, mark that deployment unusable and prepare a fresh, separately reviewed deployment plan. Do not attempt contract mutation beyond the documented owner functions.
- [ ] Keep all partial deployment addresses and transaction results in the incident record. The old deployment is not automatically removed and cannot be rolled back by the script.

## Trusted frontend manifest and release gate

- [ ] Only after all preceding checks succeed, obtain the deployed runtime bytecode for the router and every adapter from Fuji and calculate each runtime code hash locally.
- [ ] Independently compare the verified addresses, runtime hashes, chain ID, asset address, adapter order, router version and configuration against successful receipts and direct read-only chain calls.
- [ ] Update `lib/fuji-router-manifest.ts` with those exact identities in a reviewed source-control change. The trusted source is the protected, reviewed repository revision; `NEXT_PUBLIC_*` environment values only select the requested deployment and cannot authenticate it.
- [ ] Require review by a second operator before committing the populated manifest. Do not populate it with predicted addresses, arbitrary environment values, or hashes from a different network/build.
- [ ] Set frontend runtime router/USDC values to exactly match the committed manifest, build from that reviewed revision, and confirm the client gate passes all chain, router code hash, asset, adapter address/hash, version, slot-count and configuration checks.
- [ ] Confirm approvals, deposit and withdrawal controls remain disabled for missing/mismatched manifest values, wrong chain, failed identity reads, stale version, or invalid router configuration.

## Conditions that prohibit frontend configuration

Do not update frontend router settings while any transaction is missing/failed/unknown; any owner or binding check is unresolved; router asset, decimals, version, slot order, target sum, adapter identities or `configurationValid()` differ from the reviewed plan; runtime code hashes are not independently checked; the manifest is absent/incomplete; or the router and adapters are not the fresh mock-market stack approved for Fuji. The simulated AeroVault remains a separate test venue and is never an identity-failure fallback for router calls.
