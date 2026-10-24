## Status at a glance

This page is a repository-evidence status, not a marketing summary and not a deployment attestation. A feature is only called **tested** when an automated check ran in the recorded environment. A passing build does not prove that a deployed contract, wallet flow or provider integration is correct.

**Snapshot:** 23 October 2026. Consumer network: Avalanche Fuji, chain ID `43113`. Production and beta release gates: **blocked**.

## Product surface matrix

| Surface | Status | Evidence and boundary |
|---|---|---|
| Marketing site and waitlist | {{badge:Implemented}} | Next.js pages plus email-confirmed waitlist. Optional Neon or local JSONL. Not a consumer account. |
| Fuji wallet connection | {{badge:Implemented}} {{badge:Fuji}} | Reown AppKit / Wagmi, external wallet only. Connector availability depends on configuration. |
| tUSDC faucet | {{badge:Implemented}} {{badge:Mock}} | TestUSDC on Fuji with a 24-hour claim. No cash value. |
| Handle registration | {{badge:Implemented}} {{badge:Fuji}} | AeroNames, one active handle per address, release and re-registration behavior. |
| Send to handle or address | {{badge:Implemented}} {{badge:Fuji}} | AeroPay path or direct token transfer. User-signed Fuji transaction. |
| Payment request | {{badge:Partial}} | Link and form prefill only. No receivable, escrow or request ledger. |
| Bill presets | {{badge:Partial}} {{badge:Mock}} | UI constants that fill the ordinary transfer form. No provider. |
| Card checkout | {{badge:Mock}} | Simulated card step; test-token transfer from pre-funded AeroBank inventory. |
| AeroVault Earn | {{badge:Mock}} | Synthetic rate/index accrual, finite seeded inventory. |
| AeroRouter Earn | {{badge:Mock}} {{badge:Partial}} | Real accounting source, mock markets in the integrated script. No live Benqi/Joe market. |
| Aero L1 / ICM | {{badge:Design}} {{badge:Not supported}} | Separate workstream. No verified consumer cross-chain path. |
| Identity | {{badge:Implemented}} {{badge:Blocked}} | Fuji EOA SIWE in source, signup closed, Neon migration not applied. |
| Durable payment ledger | {{badge:Planned}} | No internal journal, idempotency or reconciliation service. |
| Biller integration | {{badge:Planned}} | No provider, quote, fulfillment, reversal or dispute path. |
| Fiat / card processing | {{badge:Planned}} | No processor, KYC/AML or settlement integration. |
| Production token / chain | {{badge:Blocked}} | No approved production asset, chain or deployment manifest. |

## What has been verified

The following results come from the milestone reports in the repository. They are evidence about source and test environments, not proof of a live deployment.

| Check | Result | Scope |
|---|---:|---|
| Contract test suite | {{badge:Tested}} 67 passed | Foundry suites after the deployment preflight build-profile fix. Includes router accounting, adapter, vault, names, pay and bank tests. Fork tests were not run against a live fork. |
| Yield remediation suite | {{badge:Tested}} 57 passed | Earlier focused run across 8 suites, including adversarial router cases. No live Fuji transaction or external market fork. |
| Identity suite | {{badge:Tested}} 40 passed | Disposable PostgreSQL 16.14 plus live Fuji RPC. Migration, constraints, audit guards, role denials, limiter behavior, pool reuse and EOA classification. |
| Focused RPC / rate-limit suite | {{badge:Tested}} 12 passed | Live Fuji contract and no-code address classification. |
| Release-gate suite | {{badge:Tested}} 10 passed | Explicit Fuji positive case and negative production/beta cases. |
| Frontend typecheck | {{badge:Tested}} Passed | `npx tsc --noEmit --incremental false` in M1B. |
| Next.js production build | {{badge:Tested}} Passed | Explicit Fuji testnet variables, 26 static pages in M1B. Existing warnings noted. |
| Two-wallet server flow | {{badge:Tested}} Passed | HTTP flow against disposable runtime role. Browser E2E was not performed. |
| Deployment simulation | {{badge:Tested}} 9 transactions | B2.2 dry run with no broadcast. Predicted addresses are untrusted. |

> **Tested does not mean deployed.** The current trusted router manifest is intentionally empty. The B2.2 deployment report never broadcast a transaction, and no frontend activation was authorized by it.

## What is blocked

| Gate | Status | Why |
|---|---|---|
| Controlled beta | {{badge:Blocked}} | Identity/security, durable financial records, monitoring, support and deployment acceptance are incomplete. |
| Production | {{badge:Blocked}} | No approved chain, asset, contract manifest, non-mock provider or independent verification. The allowlist is empty. |
| Open Fuji signup | {{badge:Blocked}} | Product decision D-24 keeps account creation closed. There is no enrollment route. |
| Destructive retention | {{badge:Blocked}} | D-12 is unresolved. Purge, hard delete and account closure remain gated. |
| Live yield | {{badge:Blocked}} | No independent audit, live-market acceptance, liquidity model approval or approved production asset. |
| Real biller / card | {{badge:Blocked}} | No provider contract, legal/operational approval or settlement model. |

## Known engineering gaps

- **No durable financial ledger.** Payments are visible as chain evidence and browser-local activity, but there is no immutable payment intent/state journal, idempotency key or reconciliation job.
- **No complete indexed history.** On-chain reads are bounded, and router events are not fully indexed in the UI.
- **No browser two-wallet E2E.** The identity server flow passed; the shipped wallet prompts still require manual verification with real providers.
- **Neon not provisioned.** Migrations and the least-privilege runtime role were tested on a disposable database, not applied to Neon.
- **No CI workflows.** The repository has no GitHub Actions pipeline. Checks are run manually.
- **No independent audit.** Threat model and source audits exist; they are not a penetration test or a smart-contract audit.
- **Dependency advisories.** An earlier snapshot reported seven high-severity npm advisories. No blind forced upgrade was applied.
- **No production hosting evidence.** Hosting, DNS, monitoring, incident response and key custody are outside repository evidence.

## How status changes

A status label changes only when the relevant evidence exists:

1. **Implemented** requires a repository execution path and clear configuration.
2. **Tested** requires an automated check with a recorded result and environment.
3. **Fuji** requires the path to be explicitly scoped to chain `43113` and test assets.
4. **Mock** stays until a real provider or market is integrated and accepted.
5. **Implemented** does not become **production** without an approved manifest, independent deployment verification, monitoring, support and release approval.

See [Security and engineering](/security/) for controls and [Roadmap](/roadmap/) for the dependency order.
