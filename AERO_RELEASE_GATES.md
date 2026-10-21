# Aero Release Gates

**Status date:** 2026-10-21  
**Implementation:** `lib/release-gates.mjs`, `scripts/validate-aero-release.mjs`, `scripts/validate-aero-release.test.mjs`, `.env.example`, and the `prebuild` / `release:check` package scripts.

## Environment policy

Every release build must set matching `AERO_RELEASE_ENVIRONMENT` and `NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT` to one of `local`, `testnet`, `beta`, or `production`. The production build script fails if the category is absent or invalid. The public category controls the testnet product route: production and beta hide it; a production build may show it only when explicitly classified as Fuji testnet with chain ID `43113`.

| Environment | Gate status | Supported functionality and constraints |
|---|---|---|
| Local development | Allowed for local development; release build must explicitly say `local` | Local/mock work only. No production assets or claims. A production-mode build cannot be classified `local`. |
| Testnet sandbox | Allowed only when both server and browser chain IDs equal Fuji `43113` | Existing Fuji sandbox, tUSDC (no cash value), Fuji AVAX gas, connected wallet. Configured testnet contracts only. No real-money, biller, fiat/card processor, live yield, or cross-chain claims. |
| Controlled beta | **Blocked** | Gate rejects beta pending identity/security, financial records, monitoring and support prerequisites. No beta chain/asset is approved. |
| Production | **Blocked** | The approved deployment allowlist is intentionally empty. A production label, chain ID or arbitrary address cannot enable the product. No production chain, token, contract or non-mock provider is approved. |

## Implemented checks

`npm run release:check` reads process environment and validates:

- server/public environment classifications match and are recognized;
- testnet server and public chain IDs are both Fuji `43113` and match;
- beta is rejected;
- production requires a valid chain ID and matching public chain ID, rejects Fuji, requires configured contract addresses, rejects malformed or known sandbox token addresses, and requires an exact matching reviewed deployment allowlist entry;
- every allowlisted contract must be configured identically, with a formatted runtime code hash and approved non-mock status;
- production manifest must approve authentication, authorization, database, monitoring, and incident response, and required runtime settings must be present (`DATABASE_URL`, `AERO_AUTH_PROVIDER`, `AERO_SESSION_SECRET`, `SENTRY_DSN`, `AERO_INCIDENT_RUNBOOK_URL`, `AERO_DEPLOYMENT_MANIFEST_ID`);
- browser testnet UI remains disabled for beta/production and for wrong-chain testnet config.

`prebuild` runs `release:check`, so a release build without an explicit classification fails closed. Local `npm run dev` does not run `prebuild`; production-mode UI still requires an explicit public testnet classification before exposing the sandbox. The check reads process variables; standalone Node execution does not implicitly load `.env.local`. Supply variables through the build/deployment environment.

## Production deployment manifest policy

No production manifest is present. Do not add a placeholder or inferred address. When a deployment is proposed, the reviewed source-controlled entry must identify chain ID, each required contract/token address, non-mock status, verification status, code hashes, approved controls, and manifest ID. The external release process must independently compare deployed runtime bytecode to the reviewed build and verify token/contract behavior on the target chain before adding the entry.

**Important limitation:** the current script validates the shape and exact address/hash declarations of a source allowlist; it does not fetch a live RPC bytecode hash. Since the allowlist is empty, all production configuration currently fails. A future non-empty allowlist must not be treated as deployment verification until the independent RPC/bytecode comparison and review are completed.

The validator explicitly recognizes the sandbox TestUSDC address `0x4f88395a2cf38645ba2016b6abf5ad084c19c369`; broader protection comes from exact manifest matching and the empty allowlist, not from a claim that every mock address can be inferred automatically.

## Release checklist

### Local development

- [ ] Set both release category variables to `local`.
- [ ] Keep development keys and addresses confined to local/test fixtures.
- [ ] Do not market local screens as available financial services.

### Fuji testnet sandbox

- [ ] Set both release categories to `testnet` and both chain IDs to `43113`.
- [ ] Confirm the deployed addresses are the intended Fuji test contracts and verified against source before publishing.
- [ ] Label TestUSDC/tUSDC as test tokens with no cash value and show Fuji gas/network.
- [ ] Label handle, payment history, bill presets, simulated card checkout, and mock yield according to `AERO_PRODUCT_BOUNDARIES.md`.
- [ ] Test with throwaway wallets and no real assets; verify wrong-network and missing-config states.

### Controlled beta (currently blocked)

- [ ] Product owner approves supported users, assets, network, and beta scope.
- [ ] Approve account/wallet/recovery model, authorization model, and support staffing/permissions.
- [ ] Add durable payment records, idempotency, reconciliation, database schema/migrations and backup/restore.
- [ ] Complete independent smart-contract review and deployment acceptance; no mock token, vault, bank, router, or market.
- [ ] Add monitoring, incident response, abuse controls, privacy/retention policy, and provider due diligence.
- [ ] Add browser/API/contract security tests and beta-specific release approval.

### Production (currently blocked)

- [ ] Approve chain and canonical token addresses; identify owner and key custody.
- [ ] Independently verify every deployed address and runtime bytecode against reviewed source/build; record reproducible code hashes and explorer/source verification.
- [ ] Populate and review the source-controlled manifest; ensure all addresses match runtime values and no mock/testnet contract, token, vault, bank, or router is present.
- [ ] Approve all non-mock third-party integrations and their security/failure behavior.
- [ ] Provide and test auth, authorization, durable database, managed secrets, monitoring, alerting, incident runbook, deployment/rollback record, and manifest ID.
- [ ] Complete independent contract and application security review, privacy/legal review, backup/restore drill, key recovery/rotation plan, and incident drill.
- [ ] Run release tests, negative mock/testnet configuration tests, build, and change review; obtain explicit product/security release sign-off.

## Verification status

The release test suite includes positive explicit-Fuji testnet configuration and negative tests for missing/unknown category, wrong/mismatched testnet chain, production label without an approved manifest, Fuji/known test token, arbitrary unapproved address, beta, production chain mismatch, and hidden testnet UI in production. Exact outcomes are recorded in `AERO_M0_COMPLETION_REPORT.md`.

## M1B identity addendum (2026-10-22)

The Fuji identity foundation does not change release classifications or populate the production allowlist. Account creation is closed; identity routes fail closed until their shared database migration and server configuration are present. Beta and production remain blocked by the existing gates.
