# Aero Fuji Yield Deployment Preflight Report

**Date:** 2026-10-22  
**Target:** Avalanche Fuji, chain ID `43113`  
**Scope:** Fresh B2.1.1 mock-market router stack using `contracts/script/DeployMore.s.sol`, six-decimal test USDC, fresh Benqi/Joe mock markets and adapters, router-exclusive bindings, 60/40 targets, and deployment version `2111`.  
**Result:** **SIMULATION PASS. BROADCAST NOT PERFORMED. TRUSTED MANIFEST UNCHANGED.**

This report is a preflight record, not an authorization to deploy. No transaction was broadcast, no contract was funded, and no address or runtime hash below is trusted for frontend configuration.

## 1. Executive result

- Fuji RPC returned chain ID `43113`.
- The approved test USDC address `0x4F88395a2CF38645BA2016B6aBf5aD084C19C369` has bytecode, `symbol() = "tUSDC"`, `name() = "Test USDC"`, and `decimals() = 6`.
- The first simulation exposed a real EIP-170 blocker: `AeroRouter` was 26,572 bytes under the repository's unoptimized compiler profile, over the 24,576-byte limit.
- Adding `optimizer = true` and `optimizer_runs = 200` to `contracts/foundry.toml` reduced `AeroRouter` to 16,269 bytes (8,307-byte margin). Contract tests passed after the change.
- The fresh `DeployMore` sequence then simulated **9 transactions successfully** without `--broadcast`.
- The simulation used an ephemeral, unfunded Fuji address. It is not a funded deployer and its key was discarded. Broadcast remains blocked on a funded, approved test deployer.
- `lib/fuji-router-manifest.ts` remains intentionally empty. The predicted dry-run addresses and runtime template hashes are not trusted identities.

## 2. Inputs and build profile

| Item | Value |
|---|---|
| Foundry | `forge 1.7.1` (commit `4072e48`) |
| Solidity | `0.8.24` |
| EVM version | `cancun` |
| Optimizer | enabled, 200 runs (new committed-profile requirement) |
| Fuji RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Test USDC | `0x4F88395a2CF38645BA2016B6aBf5aD084C19C369` |
| USDC code | present |
| USDC decimals | `6` |
| USDC symbol / name | `tUSDC` / `Test USDC` |
| Router version | `2111` |
| Target weights | `6000` / `4000` BPS (sum `10000`) |
| Deployment script | `contracts/script/DeployMore.s.sol:DeployMore` |

The build-profile change is required for deployment. It must be reviewed and included in the exact revision from which the broadcast is made; do not broadcast from an ambiguous or differently configured build.

### 2.1 Required broadcast environment

| Variable / flag | Requirement |
|---|---|
| `DEPLOYER_KEY` | Dedicated **Fuji testnet** private key. Never a production/mainnet key; never place it in `.env`, a report, or source control. |
| `TEST_USDC_ADDR` | `0x4F88395a2CF38645BA2016B6aBf5aD084C19C369` (the approved six-decimal test USDC). |
| `--rpc-url` | `https://api.avax-test.network/ext/bc/C/rpc` or an equivalent Fuji endpoint returning chain ID `43113`. |
| `--broadcast` | **Omitted from this preflight.** Only add it after explicit approval and funding. |

The deployer needs test AVAX for gas only; no test USDC balance is required by the deployment script. Confirm the live balance and base fee immediately before broadcast.

### 2.2 Size gate

| Contract | Runtime size | Runtime margin | Initcode size |
|---|---:|---:|---:|
| `MockQiToken` | 4,038 | 20,538 | 5,033 |
| `BenqiAdapter` | 7,248 | 17,328 | 9,029 |
| `AeroRouter` | 16,269 | 8,307 | 20,841 |
| `AeroPay` | 1,476 | 23,100 | 1,505 |
| `AeroBank` | 2,327 | 22,249 | 2,648 |

Before the optimizer change, `AeroRouter` was 26,572 bytes and `forge script` failed with `Unknown4 is above the contract size limit (26572 > 24576)`. After the change, `forge build --sizes` reported no EIP-170 violation and exited `0`. Pre-existing lint warnings (for example unchecked ERC-20 transfers in test/script fixtures and `block.timestamp` comparisons) remain warnings, not deployment failures.

Contract test result after the optimizer change: **67 passed, 0 failed, 0 skipped**.

## 3. Simulated transaction sequence

The dry run used an ephemeral address `0x9655aa57048c05305f25dfe65b179b59218983ca`, which had a Fuji balance of `0` wei. The key was removed from the process environment after the simulation and was not written to the repository.

The addresses below are **dry-run predictions for that ephemeral sender and nonce sequence only**. They are not deployed, not verified, and must not be copied into `lib/fuji-router-manifest.ts`, `NEXT_PUBLIC_*`, or any frontend setting.

| # | Nonce | Type | Contract / call | Dry-run address | Constructor arguments / call data |
|---:|---:|---|---|---|---|
| 0 | 0 | CREATE | `MockQiToken` (Benqi mock) | `0xC60AC93949621Af1786971927deB431a460fbcE0` | USDC, `1584400000`, `"Mock Benqi USDC"`, `"mqiUSDC"` |
| 1 | 1 | CREATE | `MockQiToken` (Joe mock) | `0xc4FA7AFB2B8e24dbB2edc620058445e0290697dA` | USDC, `950640000`, `"Mock Trader Joe USDC"`, `"mjjUSDC"` |
| 2 | 2 | CREATE | `BenqiAdapter` (Benqi) | `0xaE581b65F37D1570B386d79C8588bA13b1998d46` | Benqi market, `"benqi-usdc-fuji-mock"` |
| 3 | 3 | CREATE | `BenqiAdapter` (Joe) | `0xd783d6fa33D3c289ad7412fe7ea6C23E100788ba` | Joe market, `"joe-usdc-fuji-mock"` |
| 4 | 4 | CREATE | `AeroRouter` | `0x1b52A9802eE1e23133eb9Cfd13eBe64559ca968D` | USDC, `[BenqiAdapter, JoeAdapter]`, `[6000, 4000]` |
| 5 | 5 | CALL | `BenqiAdapter.setRouter` | `0xaE581b65F37D1570B386d79C8588bA13b1998d46` | router `0x1b52A9802eE1e23133eb9Cfd13eBe64559ca968D` |
| 6 | 6 | CALL | `JoeAdapter.setRouter` | `0xd783d6fa33D3c289ad7412fe7ea6C23E100788ba` | router `0x1b52A9802eE1e23133eb9Cfd13eBe64559ca968D` |
| 7 | 7 | CREATE | `AeroPay` | `0x349aF19fc92553e8e55C4D70ED835F8B61461B9D` | none |
| 8 | 8 | CREATE | `AeroBank` | `0x322A97c1a7124749366C3D5aA61F2BCE4839874a` | USDC |

### 3.1 Gas and funding estimate

The simulation's gas limits total **13,954,259**. At a 25 nAVAX C-chain gas price, that is approximately **0.3489 AVAX**; use at least **1 AVAX** of test AVAX as a buffer and confirm the live base fee before broadcast. This is an estimate, not a balance guarantee. No USDC is required to deploy; the mock markets and `AeroBank` start empty.

## 4. Constructor, ownership, and binding verification

The script's assertions all passed during simulation:

- `MockQiToken` constructor receives the approved six-decimal USDC, the expected per-second rate, and the expected name/symbol.
- Each `BenqiAdapter` receives a fresh mock market and a non-empty market ID. Its constructor reads the market's underlying, verifies it is a contract, and grants the market an allowance.
- `AeroRouter` receives the approved USDC, exactly two distinct adapter contracts, and targets `[6000, 4000]`; the constructor validates the six-decimal asset, rejects zero/duplicate/non-contract adapters, validates the target sum, and sets the owner to the broadcast sender.
- `AeroRouter.configurationValid()` returned true; `deploymentVersion() == 2111`.
- `router.owner()`, both adapter owners, and `AeroBank.owner()` equal the deployer address.
- Both adapters were bound exactly once to the new router with `setRouter`; their `router()` values equal the router address.
- `AeroPay` has no owner or constructor arguments; `AeroBank` is constructed with the approved USDC and owned by the deployer.
- The router is constructed with exactly two slots: slot 0 is the Benqi adapter with `6000` BPS; slot 1 is the Joe adapter with `4000` BPS. The final `configurationValid()` assertion passed.

The dry-run simulation completed all nine calls without a revert. It produced no on-chain receipts; this becomes an on-chain receipt record only after a broadcast is approved and executed.

## 5. Historical deployment context

A pre-existing Oct 15 `contracts/broadcast/DeployMore.s.sol/43113/run-latest.json` record exists for an earlier five-transaction stack. That record reused a Benqi adapter from a separate `DeployBenqi` run and did not deploy the fresh paired Benqi/Joe markets now required by the current nine-transaction `DeployMore` script. It is **not** the fresh deployment plan, was **not** independently verified for the trusted manifest, and must not be reused, resumed, or copied into frontend configuration by this preflight. Treat any old addresses as historical diagnostics only.

## 6. Transaction-by-transaction post-broadcast checklist

Do not skip a step because the simulation passed. Broadcast transactions are separate and cannot be atomically rolled back.

### Before broadcast

- [ ] Obtain explicit human approval and a dedicated, funded **Fuji testnet** deployer key. Never use a production or mainnet key.
- [ ] Confirm the deployer is the intended operator, is not shared with production, and has test AVAX for at least the estimated gas plus buffer.
- [ ] Confirm chain ID `43113`, the exact USDC address, bytecode, and `decimals() == 6` from the same RPC used for broadcast.
- [ ] Confirm the build uses the reviewed revision with `optimizer = true`, `optimizer_runs = 200`, and the expected `AeroRouter` runtime size.
- [ ] Re-run `forge script script/DeployMore.s.sol:DeployMore --rpc-url fuji` without `--broadcast` and confirm the sequence, constructor arguments, ownership, bindings, version, and configuration checks.
- [ ] Record the deployer address, starting nonce, chain ID, USDC address, build revision, and simulation output in the deployment record. Do not put key material in any record or report.
- [ ] Confirm `lib/fuji-router-manifest.ts` is still empty and frontend router actions are disabled.

### Transaction checks

| Step | Expected action | Required verification |
|---:|---|---|
| 0 | Create Benqi mock market | Receipt status `1`; address has code; `underlying()` is test USDC; owner is deployer; advertised rate is `1584400000`; this is a mock, not live Benqi. |
| 1 | Create Joe mock market | Receipt status `1`; address has code; `underlying()` is test USDC; owner is deployer; rate is `950640000`; this is a mock, not live Joe. |
| 2 | Create Benqi adapter | Receipt status `1`; code exists; `market()` is the step-0 market; `asset()` is test USDC; `marketId()` is `benqi-usdc-fuji-mock`; owner is deployer; `router()` is still zero before binding. |
| 3 | Create Joe adapter | Receipt status `1`; code exists; `market()` is the step-1 market; `asset()` is test USDC; `marketId()` is `joe-usdc-fuji-mock`; owner is deployer; `router()` is still zero before binding. |
| 4 | Create router | Receipt status `1`; code exists; `asset()` is test USDC; `owner()` is deployer; `deploymentVersion()` is `2111`; `slotCount()` is `2`; slot addresses/targets are the fresh adapters and `6000`/`4000`; `configurationValid()` is false until both bindings succeed (expected at this point). |
| 5 | Bind Benqi adapter | Receipt status `1`; `BenqiAdapter.router()` is the step-4 router; a second `setRouter` attempt would revert `ROUTER_ALREADY_SET`; no unrelated router is bound. |
| 6 | Bind Joe adapter | Receipt status `1`; `JoeAdapter.router()` is the step-4 router; a second `setRouter` attempt would revert; no unrelated router is bound. |
| 7 | Create AeroPay | Receipt status `1`; code exists; no owner/configuration that could authorize transfers beyond user `pay`/`payUsername` calls. |
| 8 | Create AeroBank | Receipt status `1`; code exists; `usdc()` is test USDC; `owner()` is deployer. |

### Final on-chain checks

Run these read-only checks against the actual deployed addresses from successful receipts:

```bash
cast call $ROUTER "deploymentVersion()(uint256)" --rpc-url fuji
cast call $ROUTER "asset()(address)" --rpc-url fuji
cast call $ROUTER "slotCount()(uint256)" --rpc-url fuji
cast call $ROUTER "slots(uint256)(address,uint256)" 0 --rpc-url fuji
cast call $ROUTER "slots(uint256)(address,uint256)" 1 --rpc-url fuji
cast call $ROUTER "configurationValid()(bool)" --rpc-url fuji
cast call $BENQI_ADAPTER "router()(address)" --rpc-url fuji
cast call $JOE_ADAPTER "router()(address)" --rpc-url fuji
cast call $BENQI_ADAPTER "asset()(address)" --rpc-url fuji
cast call $JOE_ADAPTER "asset()(address)" --rpc-url fuji
cast call $BENQI_ADAPTER "marketId()(string)" --rpc-url fuji
cast call $JOE_ADAPTER "marketId()(string)" --rpc-url fuji
cast call $BANK "owner()(address)" --rpc-url fuji
cast call $BANK "usdc()(address)" --rpc-url fuji
```

Required results:

- Router version `2111`; asset equals the approved USDC; slot count `2`.
- Slot 0 is the fresh Benqi adapter, target `6000`; slot 1 is the fresh Joe adapter, target `4000`.
- `configurationValid() == true`.
- Both adapter `router()` values equal the router; both adapter assets equal USDC.
- Both market IDs match the intended labels.
- `AeroBank.owner()` is the deployer; `AeroBank.usdc()` is the approved USDC.
- Every address has bytecode; no address is an EOA or a stale historical deployment.

### Bytecode and source verification

The preflight cannot verify deployed runtime bytecode because nothing was broadcast. After broadcast:

- [ ] Run `forge verify-contract` for each contract on Fuji/Snowtrace with the exact constructor arguments from the successful receipts.
- [ ] Independently fetch each deployed runtime code with `cast code <address> --rpc-url fuji` and compute `cast keccak <runtime-hex>`.
- [ ] Compare the verified source/constructor arguments and runtime hashes against a second operator's independent record.
- [ ] Record the actual router, adapter, market, AeroPay, and AeroBank addresses and runtime hashes in the deployment record.
- [ ] Only then update `lib/fuji-router-manifest.ts` in a reviewed source-control change. Do not derive it from `NEXT_PUBLIC_*`, simulation addresses, or a dry-run artifact.

Build-artifact runtime template hashes from this optimized build (not instance hashes; immutables change the deployed code):

| Contract | Runtime template hash |
|---|---|
| `MockQiToken` | `0xd793c410ad390d3f5006b37534a2aa56c6ce13240ea2b7ac7a4c41ca0d9e620f` |
| `BenqiAdapter` | `0x872bfd217a960da38c862f9f13cc995aa6f93cd271f1bc49a182737e5b00dd41` |
| `AeroRouter` | `0x325d1a0dbb3918d73ebce7fee1f3df1d574afcd7662113901c8995230c5b85e1` |
| `AeroPay` | `0x7a17acd0ff1f6c0abdbb184897713c8fa0657c625fab75b2b4d62d60759999a6` |
| `AeroBank` | `0x065cee94af01e0ac19a56143d26eb236173dd0683cfc5fc21683df43efd0f1e3` |

## 7. Broadcast blockers and approvals

1. **No funded Fuji test deployer was provided.** The simulation sender had zero AVAX. A human must supply a dedicated test key with test AVAX and explicitly approve broadcast.
2. **No broadcast was authorized or performed.** There are no on-chain receipts, deployed addresses, or verified runtime hashes from this preflight.
3. **The trusted manifest is intentionally empty.** Populating it now would violate the requirement that addresses and runtime hashes be independently verified.
4. **The build-profile change is uncommitted in this working tree.** Review and include it in the exact broadcast revision; do not deploy from an ambiguous build.
5. **Historical Oct 15 deployment records exist but are not the fresh plan.** Do not reuse them for the fresh Benqi/Joe stack or treat them as manifest evidence.
6. **The mock markets are synthetic.** Their rates are owner-set simulation values, not live Benqi/Joe yields and not a promise of return.

## 8. Partial-deployment recovery

Follow the detailed recovery checklist in `AERO_FUJI_DEPLOYMENT_RECOVERY_CHECKLIST.md`. The key rules for this nine-transaction script:

- If any transaction fails, is pending, or has unknown status, **stop**. Do not configure the frontend and do not blindly rerun the whole script.
- Record every transaction hash, nonce, receipt, and address. Distinguish mined/failed/pending/unsent transactions.
- If a market or adapter deployed but the router did not, treat those contracts as orphaned diagnostics. Do not bind them to an unrelated router without a fresh compatibility, ownership, and configuration review.
- If the router deployed but one or both adapter bindings failed, the router is unusable for deposits. `configurationValid()` must be true before any client enables it. Binding is one-time and only the adapter owner can perform it.
- If both adapters are bound but a companion `AeroPay`/`AeroBank` transaction failed, the router stack may be valid but the deployment is incomplete. Record it and decide on a separately reviewed companion-only recovery; do not present it as a complete deployment.
- If ownership is wrong, a binding is already consumed, code is missing, asset/decimals/version/targets differ, or `configurationValid()` is false, mark the deployment unusable and prepare a fresh, separately reviewed deployment. Do not mutate beyond the documented owner functions.
- A rerun creates another set of contracts and consumes more nonces. Old deployments remain on-chain and cannot be rolled back by the script.

## 9. Residual risks

- No actual Fuji broadcast, receipt verification, source verification, or runtime-hash verification occurred.
- The mock markets and owner-set rates are not real yield; do not describe them as such.
- The router has owner powers and adapter-removal rules that require operational review; the contract tests cover the reviewed behavior but are not an external audit.
- Frontend router actions remain disabled until the trusted manifest is reviewed and populated from verified chain data.
- The deployment plan does not authorize real-value use, production activation, or public signup.

## 10. Commands used (read-only/simulation)

```bash
cast chain-id --rpc-url https://api.avax-test.network/ext/bc/C/rpc
cast code 0x4F88395a2CF38645BA2016B6aBf5aD084C19C369 --rpc-url https://api.avax-test.network/ext/bc/C/rpc
cast call 0x4F88395a2CF38645BA2016B6aBf5aD084C19C369 "decimals()(uint8)" --rpc-url https://api.avax-test.network/ext/bc/C/rpc
forge build --sizes
forge test
forge script script/DeployMore.s.sol:DeployMore --rpc-url https://api.avax-test.network/ext/bc/C/rpc -vvvv
```

No command included `--broadcast`. The simulation key was ephemeral and discarded; no private key is recorded in this report.

## 11. Verdict

**SIMULATION PASS. NOT DEPLOYED. BROADCAST BLOCKED.**

The fresh sequence is internally consistent and deployable under the optimized build profile, but it is not an on-chain deployment and must not be treated as one. Obtain funding/approval, broadcast deliberately, verify every receipt and runtime hash independently, and only then populate the trusted manifest.
