# AERO B2.2 — Fuji Deployment Authorization Readiness

**Date:** 2026-10-22  
**Target:** Avalanche Fuji, chain ID `43113`  
**Deployment script:** `contracts/script/DeployMore.s.sol:DeployMore`  
**Deployment class:** Fresh mock-market router stack for controlled Fuji testing  
**Broadcast status:** **NO TRANSACTION WAS BROADCAST**  
**Final verdict:** **READY FOR EXPLICIT BROADCAST APPROVAL**, subject to the conditions and post-broadcast checks in this report.

This report is an authorization-readiness record, not a broadcast authorization. The simulation was performed without `--broadcast`. No contract was deployed, no transaction was sent, no deployer funding was changed, and no frontend trust manifest or production configuration was modified.

## 1. Executive result

- The configured signer is a Fuji-funded test account: `0x80a02210ec13D498299AB1a568DE188eA2cc6E8D`.
- Fuji RPC returned chain ID `43113`; the deployer balance was `0.999999996091455902 AVAX`.
- Confirmed and pending nonce were both `32` before and after simulation.
- Avalanche mainnet (`43114`) shows nonce `0` and balance `0` for the same address. No production-account use was observed.
- The approved test USDC at `0x4F88395a2CF38645BA2016B6aBf5aD084C19C369` has bytecode, `symbol() = "tUSDC"`, `name() = "Test USDC"`, and `decimals() = 6`.
- The exact `DeployMore` simulation completed with exit code `0` and produced exactly **9 transactions**, nonces `32` through `40`.
- Simulated total gas was **13,954,244**. Forge estimated `170 wei`, or **0.00000000237222148 AVAX**; the observed Fuji gas price of `160 wei` would cost **0.00000000223267904 AVAX**. At a conservative `25 nAVAX`, the same gas would cost **0.3488561 AVAX**.
- The deployer balance covers the current estimate and the `25 nAVAX` / `50 nAVAX` scenarios. No funding request is required at this time.
- `AeroRouter` runtime bytecode is **16,269 bytes**, which is **8,307 bytes below** the EIP-170 limit of 24,576 bytes under the approved optimizer profile.
- The sequence remains the reviewed nine-transaction order: two mock markets, two adapters, router, two one-time adapter bindings, AeroPay, and AeroBank. No concrete defect requiring a sequence change was found.
- Historical October 15 contracts and the old Benqi adapter are not referenced by the deployment script. The fresh simulation predicts new addresses at nonces `32`–`40`; those predicted addresses are **not trusted evidence** and must not be used for frontend configuration.

## 2. Deployment identity and account separation

### 2.1 Configured signer

The only deployment signer source used for this review was `contracts/.env` (`DEPLOYER_KEY`). The value was loaded into the process environment only for the simulation, was never printed, and was cleared afterward. The key material is not reproduced in this report.

| Check | Result |
|---|---|
| Key shape | Valid `0x`-prefixed 32-byte hex value; value not displayed |
| Derived address | `0x80a02210ec13D498299AB1a568DE188eA2cc6E8D` |
| Address source | `contracts/.env` signer, derived locally with `cast wallet address` |
| `.env.local` deployer key | Absent; `.env.local` contains frontend/runtime settings, not the deployer key |
| Untracked `aero deployer.txt` | Local Avalanche CLI testnet wallet metadata; not used for this deployment and not reproduced |
| Mainnet references in that local file | None observed |

### 2.2 Network and account separation

| Check | Evidence | Result |
|---|---|---|
| Fuji chain ID | RPC `eth_chainId` / `cast chain-id` = `43113` | PASS |
| Fuji RPC | `https://api.avax-test.network/ext/bc/C/rpc` | PASS |
| Fuji balance | `0.999999996091455902 AVAX` | PASS |
| Fuji confirmed nonce | `32` | PASS |
| Fuji pending nonce | `32` | PASS |
| Post-simulation nonce | Still `32` | PASS — no broadcast |
| Post-simulation balance | Still `0.999999996091455902 AVAX` | PASS — no funding or transaction |
| Avalanche mainnet chain ID | `43114` | Observational |
| Mainnet nonce for same address | `0` | Supports testnet-only use |
| Mainnet balance for same address | `0 AVAX` | Supports testnet-only use |

The configured address is the same Fuji test EOA that produced earlier testnet records, but this review does **not** reuse any earlier contract deployment. The signer is being reused only as the Fuji transaction sender. The deployment contracts are fresh.

### 2.3 Historical deployment exclusion

The existing broadcast records were inspected. They are historical evidence, not deployment inputs.

| Historical record | Transactions | First nonce | Notable historical contracts |
|---|---:|---:|---|
| `Deploy.s.sol` | 5 | `0` | TestUSDC, AeroVault, AeroNames |
| `DeployBenqi.s.sol` | 2 | `8` | MockQiToken, **old Benqi adapter `0xe88b2216565804c36F805F89eFE0261de6412F92`** |
| Historical `DeployMore.s.sol` | 5 | `10` | MockQiToken, old adapter `0x3DDA7719527a777CC48B89E8e55E646dD114aD33`, router `0x2bA93B22fFE2EdEE054A2dBc96732017F79B928D`, AeroPay, AeroBank |
| `Seed.s.sol` | 2 | `15` | Existing test USDC calls |

The current `DeployMore` script does not reference the old Benqi adapter, the old router, or the old companion addresses. It constructs new `MockQiToken`, new `BenqiAdapter` instances, a new `AeroRouter`, a new `AeroPay`, and a new `AeroBank`. The current simulation predicted new addresses at nonces `32`–`40`, not the historical addresses.

The local `.env.local` still contains historical frontend values for `NEXT_PUBLIC_BENQI_ADAPTER` and `NEXT_PUBLIC_ROUTER`. Those values were **not modified** and are **not** part of this broadcast plan. They must not be used to activate the new deployment.

## 3. Gas and funding readiness

### 3.1 Observed conditions

| Item | Value |
|---|---|
| Gas used by simulation | `13,954,244` |
| RPC `eth_gasPrice` | `0xa0` = `160 wei` |
| Latest base fee | `0xa` = `10 wei` |
| Forge estimated gas price | `0.00000017 gwei` = `170 wei` |
| Forge estimated amount | `0.00000000237222148` (Forge labels ETH; native asset on Fuji is AVAX) |
| Deployer balance | `0.999999996091455902 AVAX` |

The latest Fuji block at review time also contained transactions with `gasPrice = 0xa0` (160 wei), confirming that the low RPC gas price was not a display artifact.

### 3.2 Conservative funding analysis

| Gas-price scenario | Estimated deployment cost | Balance coverage |
|---|---:|---|
| Current observed `160 wei` | `0.00000000223267904 AVAX` | Covers by a very large margin |
| Forge estimate `170 wei` | `0.00000000237222148 AVAX` | Covers by a very large margin |
| Conservative `25 nAVAX` | `0.3488561 AVAX` | Covers; remaining balance `0.651143896 AVAX` |
| Conservative `50 nAVAX` | `0.6977122 AVAX` | Covers; remaining balance `0.302287796 AVAX` |
| `75 nAVAX` | `1.0465683 AVAX` | Does **not** cover the current balance |

At the observed Fuji fee level, the balance is more than sufficient. Even under the conventional `25 nAVAX` assumption, the estimated deployment cost is approximately `0.349 AVAX`, leaving approximately `0.651 AVAX` for buffer and post-deployment verification transactions. No funding is required before the authorized broadcast.

**Operational rule:** if the fee market rises materially before broadcast, re-run the estimate. If the required cost plus a reasonable buffer would exceed the remaining balance, stop and request funding rather than sending a partial sequence.

## 4. Deployment and configuration verification

### 4.1 Constructors and script arguments

The source script is authoritative. Its constructor arguments are:

| Step | Contract or call | Constructor / call arguments |
|---:|---|---|
| 1 | `MockQiToken` (Benqi mock) | `USDC`, `1_584_400_000`, `"Mock Benqi USDC"`, `"mqiUSDC"` |
| 2 | `MockQiToken` (Trader Joe mock) | `USDC`, `950_640_000`, `"Mock Trader Joe USDC"`, `"mjjUSDC"` |
| 3 | `BenqiAdapter` (Benqi) | `benqiMarket`, `"benqi-usdc-fuji-mock"` |
| 4 | `BenqiAdapter` (Joe) | `joeMarket`, `"joe-usdc-fuji-mock"` |
| 5 | `AeroRouter` | `USDC`, `[benqiAdapter, joeAdapter]`, `[6000, 4000]` |
| 6 | `BenqiAdapter.setRouter` | New router address |
| 7 | `BenqiAdapter.setRouter` (Joe) | New router address |
| 8 | `AeroPay` | No constructor arguments |
| 9 | `AeroBank` | `USDC` |

`USDC` above is the approved test token:

`0x4F88395a2CF38645BA2016B6aBf5aD084C19C369`

### 4.2 Contract-level checks

| Check | Evidence from source | Result |
|---|---|---|
| Six-decimal asset enforced by router | `AeroRouter` constructor requires `decimals() == 6` | PASS |
| Six-decimal test USDC | `code.length > 0`, `symbol() = "tUSDC"`, `name() = "Test USDC"`, `decimals() = 6` | PASS |
| Fresh Benqi mock market | `new MockQiToken(...)` in `DeployMore`; no historical market address | PASS |
| Fresh Trader Joe mock market | `new MockQiToken(...)` in `DeployMore`; no historical market address | PASS |
| Fresh Benqi adapter | `new BenqiAdapter(benqiMarket, ...)`; no old adapter address | PASS |
| Fresh Joe adapter | `new BenqiAdapter(joeMarket, ...)`; no old adapter address | PASS |
| Fresh router | `new AeroRouter(...)` with the two fresh adapters | PASS |
| Router ownership | `Ownable(msg.sender)` and script `require(router.owner() == deployer)` | PASS in simulation |
| Adapter ownership | `Ownable(msg.sender)` and script owner checks | PASS in simulation |
| Market ownership | `Ownable(msg.sender)` in `MockQiToken`; deployer is transaction sender | Expected; verify on receipt |
| AeroBank ownership | `Ownable(msg.sender)` and script `require(bank.owner() == deployer)` | PASS in simulation |
| One-time adapter binding | `setRouter` requires `router == address(0)` and a contract address | PASS by construction |
| Deployment version | `deploymentVersion = 2_111`; script requires `2_111` | PASS in simulation |
| Two slots | Two adapters supplied to the router | PASS |
| Allocation weights | `[6000, 4000]`; router requires sum `10000` | PASS |
| Configuration validity | `configurationValid()` required after both bindings | PASS in simulation |
| EIP-170 runtime limit | `AeroRouter` runtime `16,269` bytes; margin `8,307` bytes | PASS |

### 4.3 EIP-170 and build profile

`contracts/foundry.toml` uses:

```toml
optimizer = true
optimizer_runs = 200
```

`forge build --sizes` reported:

| Contract | Runtime size | Runtime margin to 24,576 |
|---|---:|---:|
| `AeroRouter` | 16,269 | 8,307 |
| `BenqiAdapter` | 7,248 | 17,328 |
| `MockQiToken` | 4,038 | 20,538 |
| `AeroPay` | 1,476 | 23,100 |
| `AeroBank` | 2,327 | 22,249 |

No contract exceeds the EIP-170 runtime limit. The `forge build --sizes` command exits non-zero because of an existing `block.timestamp` lint warning in `src/TestUSDC.sol`; that warning is unrelated to the deployment stack and does not indicate a size failure. All reported runtime sizes are below the limit.

### 4.4 Trusted manifest boundary

`lib/fuji-router-manifest.ts` remains intentionally empty for router, asset, and adapter identities. The simulation’s predicted addresses and runtime template hashes were **not** written to it. No frontend activation is authorized by this report.

## 5. Exact simulation result

### 5.1 Command shape

The simulation was run from `contracts/` without `--broadcast`:

```powershell
$env:DEPLOYER_KEY = <loaded from contracts/.env>
$env:TEST_USDC_ADDR = 0x4F88395a2CF38645BA2016B6aBf5aD084C19C369
forge script script/DeployMore.s.sol:DeployMore `
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc `
  -vv
```

The actual key value was not displayed and was cleared from the process environment after the run. The command completed with exit code `0` and printed:

```text
Script ran successfully.
Chain 43113
Estimated total gas used for script: 13954244
Estimated amount required: 0.00000000237222148 ETH
SIMULATION COMPLETE.
```

`receipts` in the dry-run record is empty because this was a simulation, not a broadcast. A successful simulation is not a substitute for on-chain receipts.

### 5.2 Transaction sequence

The dry-run record contained exactly 9 transactions. Nonces are decimal here; the JSON stores them as hex.

| # | Nonce | Type | Contract / call | Predicted address | Constructor or call input | Gas |
|---:|---:|---|---|---|---|---:|
| 1 | 32 | CREATE | `MockQiToken` (Benqi) | `0xbE3B026fE7BdF4dc1cC1a9004371E038b44AaA21` | USDC, `1584400000`, `"Mock Benqi USDC"`, `"mqiUSDC"` | 1,400,682 |
| 2 | 33 | CREATE | `MockQiToken` (Joe) | `0x63fA3526D1e947CF6C69D0E26034b37Bfd8F31f5` | USDC, `950640000`, `"Mock Trader Joe USDC"`, `"mjjUSDC"` | 1,400,760 |
| 3 | 34 | CREATE | `BenqiAdapter` (Benqi) | `0x168e226c1b6b5Fb2617C761dbfb908B91c09B33A` | Benqi market, `"benqi-usdc-fuji-mock"` | 2,325,817 |
| 4 | 35 | CREATE | `BenqiAdapter` (Joe) | `0x5A639A7eb20c468aDaEE93639eB641790c54E984` | Joe market, `"joe-usdc-fuji-mock"` | 2,325,801 |
| 5 | 36 | CREATE | `AeroRouter` | `0x2BE47747A21cb9173dCb0F9c9d949E9C72fA5b76` | USDC, `[BenqiAdapter, JoeAdapter]`, `[6000, 4000]` | 5,082,942 |
| 6 | 37 | CALL | Benqi adapter `setRouter` | `0x168e226c1b6b5Fb2617C761dbfb908B91c09B33A` | New router | 73,362 |
| 7 | 38 | CALL | Joe adapter `setRouter` | `0x5A639A7eb20c468aDaEE93639eB641790c54E984` | New router | 73,362 |
| 8 | 39 | CREATE | `AeroPay` | `0x67f44CA030179297289df5eaEbfB580Ab27CC25f` | None | 484,196 |
| 9 | 40 | CREATE | `AeroBank` | `0x7fBE60802960836a489761dF8De9DF48f3bdEDa3` | USDC | 787,322 |

**Total gas:** `13,954,244`.

All predicted addresses above are simulation-only. They are useful for checking the intended ordering and relative nonce progression, but they are **not trusted deployment identities**. The actual addresses and runtime hashes must be read from mined receipts and Fuji state after broadcast.

### 5.3 Simulation invariants

The script’s post-deployment checks passed during the simulation:

- `router.owner() == deployer`
- `benqiAdapter.owner() == deployer`
- `joeAdapter.owner() == deployer`
- `router.configurationValid() == true` after both bindings
- `router.deploymentVersion() == 2111`
- `bank.owner() == deployer`

No revert, failed call, or deployment warning was reported by the simulation. The dry-run’s lack of receipts means these checks have not yet been independently verified against mined transactions.

## 6. Transaction-by-transaction authorization and recovery checklist

The nine transactions are sequential, not atomic. A failure or unknown result at any step requires a stop; do not continue the script, do not blindly rerun it, and do not configure the frontend from partial output.

### Transaction 1 — Deploy Benqi mock market

- **Purpose:** Create the fresh mock QiToken market that backs the Benqi adapter.
- **Expected input:** Deployer `0x80a02210ec13D498299AB1a568DE188eA2cc6E8D`; nonce `32`; `CREATE`; no `to`; value `0`; constructor `(USDC, 1584400000, "Mock Benqi USDC", "mqiUSDC")`.
- **Expected receipt:** Status `1`; non-zero `contractAddress`; contract code present; nonce `32` consumed; transaction hash captured.
- **Post-transaction verification:** Read `underlying() == USDC`, `name() == "Mock Benqi USDC"`, `symbol() == "mqiUSDC"`, `owner() == deployer`, and `supplyRatePerTimestamp() == 1584400000`. Confirm the deployed address is not the historical `0xacaB3c841F43e01f17B657D1f43eDf517B7F4dee` or `0x8D0D58da74c83Ef6E1340A395AA1058fF5ECB8e8`.
- **Recovery:** If the receipt is failed or unavailable, stop. If the transaction is pending, wait or replace it only through a separately reviewed nonce action; do not submit later nonces. If a failed transaction consumed the nonce but created no contract, record the failure and prepare a fresh deployment. If a contract exists but its constructor values are wrong, treat it as orphaned; do not reuse it.

### Transaction 2 — Deploy Trader Joe mock market

- **Purpose:** Create the second fresh mock market.
- **Expected input:** Deployer; nonce `33`; `CREATE`; no `to`; value `0`; constructor `(USDC, 950640000, "Mock Trader Joe USDC", "mjjUSDC")`.
- **Expected receipt:** Status `1`; non-zero `contractAddress`; code present; nonce `33` consumed; receipt and address recorded.
- **Post-transaction verification:** Read the same fields as transaction 1, expecting `name() == "Mock Trader Joe USDC"`, `symbol() == "mjjUSDC"`, and `supplyRatePerTimestamp() == 950640000`. Confirm it is not a historical market address.
- **Recovery:** Stop on failure or uncertainty. Do not deploy the adapter until this market’s code and constructor values are confirmed. If successful but wrong, mark it orphaned and restart from a fresh, reviewed plan.

### Transaction 3 — Deploy Benqi adapter

- **Purpose:** Create the router-exclusive adapter for the Benqi mock market.
- **Expected input:** Deployer; nonce `34`; `CREATE`; no `to`; value `0`; constructor `(benqiMarketFromTx1, "benqi-usdc-fuji-mock")`.
- **Expected receipt:** Status `1`; non-zero `contractAddress`; code present; nonce `34` consumed. The adapter is expected to have `router() == address(0)` until transaction 6.
- **Post-transaction verification:** Read `market() == benqiMarket`, `asset() == USDC`, `owner() == deployer`, `router() == address(0)`, and `marketId() == "benqi-usdc-fuji-mock"`. Confirm the address is not the old Benqi adapter `0xe88b2216565804c36F805F89eFE0261de6412F92`.
- **Recovery:** If deployment succeeds but `router()` is already nonzero, do not proceed; the adapter is not in the expected one-time-bindable state. If the deployment fails, stop and treat the prior market as orphaned. Do not bind an old or unrelated adapter.

### Transaction 4 — Deploy Trader Joe adapter

- **Purpose:** Create the router-exclusive adapter for the Joe mock market.
- **Expected input:** Deployer; nonce `35`; `CREATE`; no `to`; value `0`; constructor `(joeMarketFromTx2, "joe-usdc-fuji-mock")`.
- **Expected receipt:** Status `1`; non-zero `contractAddress`; code present; nonce `35` consumed; `router() == address(0)` initially.
- **Post-transaction verification:** Read `market() == joeMarket`, `asset() == USDC`, `owner() == deployer`, `router() == address(0)`, and `marketId() == "joe-usdc-fuji-mock"`.
- **Recovery:** Stop on failure or unexpected `router()` state. Do not proceed to router deployment with an adapter whose market, asset, owner, or binding state is wrong. Treat the prior market as orphaned if recovery requires a fresh adapter.

### Transaction 5 — Deploy AeroRouter

- **Purpose:** Create the router with the two fresh adapters and the 60/40 target weights.
- **Expected input:** Deployer; nonce `36`; `CREATE`; no `to`; value `0`; constructor `(USDC, [benqiAdapter, joeAdapter], [6000, 4000])`.
- **Expected receipt:** Status `1`; non-zero `contractAddress`; code present; nonce `36` consumed. `configurationValid()` is expected to be **false immediately after this transaction**, because neither adapter is bound yet; this is not a failure by itself.
- **Post-transaction verification:** Read `asset() == USDC`, `owner() == deployer`, `deploymentVersion() == 2111`, `slotCount() == 2`, `slots(0)` equals `(benqiAdapter, 6000)`, and `slots(1)` equals `(joeAdapter, 4000)`. Confirm the router address is not the historical router `0x2bA93B22fFE2EdEE054A2dBc96732017F79B928D`. Do not run deposits yet.
- **Recovery:** If the router deploys with the wrong asset, owner, adapters, targets, version, or code, stop and mark the stack unusable. If the router deploys but a later binding fails, the router may remain deployed but unusable; only the adapter owner may make the one-time binding, and no client may enable deposits while `configurationValid()` is false. Do not deploy a second router and bind the existing adapters to it unless a separately reviewed recovery determines the old bindings are still unset and safe.

### Transaction 6 — Bind Benqi adapter to router

- **Purpose:** Consume the Benqi adapter’s one-time router binding.
- **Expected input:** Deployer; nonce `37`; `CALL` to the Benqi adapter from transaction 3; value `0`; call `setRouter(routerFromTx5)`.
- **Expected receipt:** Status `1`; no new contract address; nonce `37` consumed; `RouterSet(router)` event emitted.
- **Post-transaction verification:** Read Benqi adapter `router() == routerFromTx5`; confirm the adapter is still owned by the deployer; use a read-only `cast call` from the owner to confirm a second `setRouter` call would revert with `ROUTER_ALREADY_SET` (do not send it). Confirm the Joe adapter is still unbound at this point.
- **Recovery:** If the call fails, the router is not fully configured; stop. If the call succeeds but `router()` is wrong, mark the stack unusable; the one-time binding cannot be undone by the normal owner path. If the transaction is pending or unknown, wait for a receipt or recover the nonce; do not submit transaction 7 until transaction 6 is confirmed.

### Transaction 7 — Bind Trader Joe adapter to router

- **Purpose:** Consume the Joe adapter’s one-time router binding and complete router configuration.
- **Expected input:** Deployer; nonce `38`; `CALL` to the Joe adapter from transaction 4; value `0`; call `setRouter(routerFromTx5)`.
- **Expected receipt:** Status `1`; no new contract address; nonce `38` consumed; `RouterSet(router)` event emitted.
- **Post-transaction verification:** Read Joe adapter `router() == routerFromTx5`; read router `configurationValid() == true`; confirm both slots point to the intended adapters and targets. This is the first point at which the router is expected to be usable.
- **Recovery:** If this call fails, the stack is incomplete and the router must remain disabled. Do not deploy AeroPay/AeroBank as though the router were valid. If the binding succeeds but `configurationValid()` is false, inspect both adapters, asset, target sum, and code; mark the stack unusable if any invariant is wrong. Do not attempt to bind an adapter to another router after this point.

### Transaction 8 — Deploy AeroPay

- **Purpose:** Deploy the companion one-signature payment contract.
- **Expected input:** Deployer; nonce `39`; `CREATE`; no `to`; value `0`; no constructor arguments.
- **Expected receipt:** Status `1`; non-zero `contractAddress`; code present; nonce `39` consumed.
- **Post-transaction verification:** Confirm runtime code exists and record the actual address. Confirm it is not the historical AeroPay address `0x30AC3ceF546b7bc97A2a779cC15f83EDc0A3b46E`. No owner or router binding is expected for AeroPay.
- **Recovery:** If deployment fails or is unknown, stop; the router may already be valid, but the deployment is incomplete. Do not reuse ambiguous predicted output. A separately reviewed companion-only recovery may be considered only after recording the partial state.

### Transaction 9 — Deploy AeroBank

- **Purpose:** Deploy the companion bank contract with the approved USDC asset.
- **Expected input:** Deployer; nonce `40`; `CREATE`; no `to`; value `0`; constructor `(USDC)`.
- **Expected receipt:** Status `1`; non-zero `contractAddress`; code present; nonce `40` consumed.
- **Post-transaction verification:** Read `usdc() == USDC`, `owner() == deployer`; record the actual address. Confirm it is not the historical AeroBank address `0x0403EAd11D3e3F8aBef24CAB3AC0D990bbC401f6`.
- **Recovery:** If this final transaction fails or is uncertain, the router and AeroPay may already be deployed. Stop and record the incomplete stack. Do not publish frontend configuration or describe the deployment as complete. Decide separately whether a companion-only recovery is appropriate; do not rerun the entire script without a fresh review.

### 6.1 Global stop and recovery rules

- Stop immediately if any receipt is missing, failed, or has an unexpected `contractAddress`, sender, nonce, status, or constructor state.
- Never submit later nonces while an earlier nonce is pending or unknown.
- Never reuse a partial contract in a different stack merely because it deployed successfully.
- Never populate `lib/fuji-router-manifest.ts` or frontend settings from predicted addresses.
- If a router binding is consumed incorrectly, mark that stack unusable; do not attempt unsupported mutations.
- Preserve all transaction hashes, receipts, actual addresses, and observed state in an incident record.

## 7. Pre-broadcast authorization conditions

Before any human authorizes `--broadcast`, confirm all of the following remain true:

1. Chain is still Fuji `43113`; the RPC is the approved Fuji endpoint.
2. Deployer is still `0x80a02210ec13D498299AB1a568DE188eA2cc6E8D`; its key remains the configured Fuji test signer only.
3. Confirmed and pending nonce are both `32`; no unrelated transaction has been sent from this address.
4. Balance still covers the re-estimated gas plus buffer; if fees have risen, re-run the estimate.
5. `TEST_USDC_ADDR` is still `0x4F88395a2CF38645BA2016B6aBf5aD084C19C369` with code and six decimals.
6. `DeployMore.s.sol`, `foundry.toml`, and the reviewed constructors are unchanged from this report.
7. `lib/fuji-router-manifest.ts` remains empty; no frontend activation has occurred.
8. A separate operator has reviewed the exact command and the nine-transaction sequence.
9. The broadcast is performed as an explicit, separately authorized action; this report alone does not authorize it.

## 8. Outstanding blockers and limitations

1. **No broadcast authorization has been given.** The deployment is ready for explicit approval, not authorized to send.
2. **Predicted addresses and dry-run hashes are untrusted.** They must be replaced by actual receipt addresses and independently computed runtime hashes after broadcast.
3. **The trusted frontend manifest remains empty.** Router writes remain disabled until a successful, verified deployment is followed by a reviewed manifest update.
4. **Local frontend environment values still reference historical contracts.** Do not use those values to activate the new stack. They were not modified in this task.
5. **Gas price is unusually low on Fuji at review time.** The current estimate is tiny, but the authorization should be based on a fresh estimate at broadcast time. The current balance does not cover a sustained `75 nAVAX` scenario.
6. **Simulation is not on-chain verification.** The script’s ownership, binding, version, and configuration checks passed in simulation; they must be rechecked against mined receipts and Fuji read calls.
7. **No live yield is involved.** The Benqi and Trader Joe markets are mocks with simulated per-second rates. This deployment must not be presented as live protocol yield.

## 9. Final verdict

**READY FOR EXPLICIT BROADCAST APPROVAL.**

The configured Fuji test deployer is funded and separated from observed mainnet activity, the approved six-decimal USDC is correct, the nine-transaction `DeployMore` simulation completed successfully with nonces `32`–`40`, the router is below EIP-170, and the constructor/ownership/binding/version/configuration plan is internally consistent.

This verdict is conditional on explicit human approval, a fresh pre-broadcast nonce and gas check, and the transaction-by-transaction receipt verification and recovery rules above. It does **not** authorize frontend activation or manifest population.

## 10. No-broadcast attestation

No transaction was broadcast. No `--broadcast` flag was used. No transaction was sent, no contract was deployed, and no deployer funding was changed. The Fuji confirmed and pending nonce remained `32`, and the balance remained `0.999999996091455902 AVAX` after the simulation. No commit or push was made for this B2.2 review.
