## Security posture

Aero has a documented threat model, a fail-closed release gate, a source-reviewed contract suite and a Fuji-only identity foundation. It does **not** have an independent security audit, a production deployment attestation, a complete financial ledger, or production monitoring.

The right way to read this page is: *what controls exist in source, what was tested, and what remains unsafe for real value.*

## Release gate

Every release build must set matching server and public environment categories:

```bash
AERO_RELEASE_ENVIRONMENT=testnet
NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT=testnet
AERO_RELEASE_CHAIN_ID=43113
NEXT_PUBLIC_AERO_RELEASE_CHAIN_ID=43113
```

`prebuild` runs `npm run release:check`. The validator:

- rejects missing or unknown categories;
- requires both chain IDs to be Fuji for testnet;
- rejects beta;
- rejects production unless a reviewed, non-mock allowlist entry matches every configured address and code hash;
- requires production controls and runtime settings;
- hides the testnet product in beta/production.

The production allowlist is intentionally **empty**. A production label, an arbitrary address or a Fuji chain ID cannot enable the product.

> **Limitation:** the current validator checks the shape and exact declarations of a source allowlist. It does not fetch live runtime bytecode. The empty allowlist is what blocks production today; a future non-empty allowlist still requires independent RPC/bytecode verification and review.

## Trust boundaries

| Boundary | Main risk | Current control | Remaining gap |
|---|---|---|---|
| Browser ↔ wallet | Malicious signing prompt / wrong chain | Reown/Wagmi, explicit Fuji chain checks | No browser E2E across all connectors; wallet UX trust remains. |
| Browser ↔ Aero API | CSRF, session theft, origin spoofing | Exact origin, CSRF token, host-only Secure cookie, rate limits | No production load test; no browser two-wallet E2E. |
| Aero API ↔ identity DB | Over-privileged runtime, audit tampering | Separate runtime role, no DDL/DELETE, append-only audit, truncate guard | Neon role provisioning not applied. |
| Browser ↔ Fuji RPC | Wrong chain, stale reads, reorg | Chain ID checks, receipt wait | No finality policy or reorg reconciliation. |
| Wallet ↔ contracts | Malicious/incorrect contract behavior | Source checks, tests, bounded parameters | No independent audit; owner powers are significant. |
| Router ↔ adapters | Fake shares, short returns, illiquidity | Exclusive binding, measured deltas, share checks, atomic revert | Adapter semantics are trusted after review; no audit. |
| Server ↔ Resend | Email abuse / personal data | Bounded inputs, HTML escaping, rate limits | No delivery event model or retention policy. |
| Docs ↔ main app | Stale or overstated claims | Separate static build, status matrix, review date | Manual review required. |

## Identity controls

The M1B implementation adds controls that did not exist in the earlier wallet-only app:

- Fuji EOA-only SIWE with exact field parsing and one-time challenge consumption;
- fail-closed `eth_chainId` + `eth_getCode` classification;
- server-side opaque sessions with idle/absolute expiry, rotation and logout-others;
- CSRF-bound unsafe requests and exact canonical origin;
- layered database-backed IP/global/user rate limits;
- append-only identity audit with a truncate guard;
- a least-privilege runtime role with no DDL, `DELETE` or direct limiter table access;
- generic login failure for unknown, suspended and active wallets;
- no account creation from wallet connection or login.

Account creation is closed (D-24). Retention is unresolved (D-12); destructive deletion is gated. These are deliberate constraints, not finished features.

## Contract controls

| Contract | Controls | Known limitations |
|---|---|---|
| `AeroRouter` | Virtual shares/assets, `minShares`, measured token deltas, adapter share checks, bounded value increase, allocation invariants, reentrancy guard, all-or-nothing withdrawals | Owner-set targets and direct `Ownable`; no pause/timelock; no queue; adapter semantics trusted; no audit. |
| `BenqiAdapter` | One-time router binding, `onlyRouter` deposits/withdrawals, explicit share conversions | No live-market acceptance; mock market in integrated script. |
| `AeroVault` | Reentrancy guard, share accounting | Synthetic rate; finite seeded inventory; not yield. |
| `AeroNames` | One active handle per address; release behavior | Handles can be squatted, released or changed. Not account proof. |
| `AeroPay` | Nonzero recipient, 140-byte memo cap, SafeERC20, `Paid` event | Arbitrary caller-supplied token; no zero-amount check; unlimited UI approval. |
| `AeroBank` | Owner-controlled sandbox inventory | Not a bank; owner can sweep test inventory. |
| `TestUSDC` | Faucet cooldown, test token | No cash value; not USDC. |

## What was tested

Recorded results include:

- **67** contract tests passed after the deployment preflight build-profile fix;
- **57** focused yield/router tests passed in an earlier run, including adversarial adapters;
- **40** identity tests passed against disposable PostgreSQL and live Fuji RPC;
- **12** focused RPC/rate-limit tests passed;
- **10** release-gate tests passed;
- TypeScript check and a Fuji-configured Next.js build passed;
- a nine-transaction deployment **simulation** completed with no broadcast.

These are source and test-environment results. They do not prove a deployed contract matches the source, that a live Benqi market works, or that the browser wallet flow is correct on every provider.

## Known gaps

{{badge:Blocked}} No independent smart-contract or application audit.  
{{badge:Blocked}} No durable payment ledger, idempotency or reconciliation.  
{{badge:Blocked}} No production deployment manifest or verified runtime bytecode.  
{{badge:Planned}} No pause, timelock or multisig ownership for the router.  
{{badge:Planned}} No allowance/revoke UX; the sandbox uses an unlimited approval.  
{{badge:Blocked}} No CI pipeline or automated browser tests.  
{{badge:Blocked}} No production monitoring, incident runbook or key-custody evidence.  
{{badge:Blocked}} No retention policy; identity storage can accumulate if enabled.

An earlier dependency snapshot reported seven high-severity npm advisories. A forced fix would have introduced a breaking shadcn upgrade, so it was not applied blindly. Treat that as an advisory snapshot, not a current exploitability proof; re-run the audit in the deployment environment.

## Safe disclosure

Do not open a public issue containing secrets, private keys, deployer files, database URLs or user data. Report the issue through the project’s private channel and include the affected commit, environment, reproduction steps and impact. This documentation intentionally does not reproduce any credential or local deployer metadata.

## Security is a gate, not a badge

Aero should not accept real value until the open decisions on chain, asset, yield, liquidity, deployment ownership, retention and support are resolved. See [Current status](/status/) and [Roadmap](/roadmap/).
