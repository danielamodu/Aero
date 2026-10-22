# Aero M1B Identity Closure Report

**Date:** 2026-10-22  
**Scope:** Closure of the M1B identity security-audit findings, verification of the implemented controls, and classification of every remaining item. This report does not authorize public signup, a Neon/production migration, a deployment, or a release.

## 1. Closure decision

M1B can close for **controlled Fuji integration** as **CONDITIONAL PASS**. It cannot be recorded as a full PASS and is not approved for public signup, beta, or production.

- No Critical or High severity authorization bypass was found.
- The challenge, session, wallet-link, primary-switch, revocation, and audit paths held under the real-Postgres and server-side HTTP tests.
- The remaining Medium items are operational, policy, or verification items, not a known application-layer bypass.
- The two-wallet **browser** E2E was not executed; a server-side HTTP flow is not a substitute.
- D-12 remains unresolved; no retention interval, purge, hard delete, or account closure was enabled.
- The fresh Fuji deployment preflight passed as a simulation, but no broadcast was performed; the trusted manifest remains empty.

**Verdict: CONDITIONAL PASS.** Carry the operational items in §4 and the blockers in §5 forward. Do not describe M1B as fully closed or activated.

## 2. Requirement-by-requirement disposition

| Requirement | Code/test disposition | Operational disposition |
|---|---|---|
| 2.1 Least-privilege runtime and migration roles | **Closed.** `scripts/provision-identity-roles.mjs` creates/rotates a runtime role with only the required DML and limiter execution; it verifies no DDL, `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`, direct limiter-table access, or audit-function execution. Disposable-Postgres privilege tests pass. | **Operationally pending.** Not applied to Neon or production. A Neon admin/owner credential, approval, and maintenance window are required. Keep the migration/owner credential out of the runtime process. |
| 2.2 Layered challenge/login/session/wallet limits | **Closed.** DB-backed challenge IP/global/user limits, verify IP/global limits, and cookie-bearing session IP/global limits are enforced before service work. Trusted-proxy extraction ignores forwarded headers by default; unattributed requests share one fallback bucket; random wallet addresses cannot escape the IP/global bucket. Failure of the limiter fails closed as 503. Unit tests cover spoofed headers, random addresses, policy bounds, and DB-unavailable codes. | **Operationally pending.** Monitor 429/503 rates, limiter latency, and Neon IO; tune defaults after real traffic. The limiter uses Postgres, not an external service; its dependency cost is documented in §6. |
| 2.3 Reusable identity DB pool | **Closed.** A module-scoped, bounded Neon pool is reused across requests; clients are released, broken connections destroyed, and transactions preserve their boundaries. Pool reuse and instrumentation tests pass. | **Not verified under production load.** No concurrent-load test against a long-lived Neon deployment was run. |
| 2.4 Two-wallet browser E2E | **Not verified in a browser.** The server-side two-wallet HTTP flow passed, including A auth, A reauth, switch to B, link B, same account, primary switch, logout/relogin, second A session, revoke A, invalid signature, expired challenge, replay, and rejected switch. | **Not verified.** No browser wallet extension/provider and no funded Fuji test EOAs were available. This remains a release gate, not a pass. |
| 2.5 Fuji RPC EOA-path verification | **Closed.** Live Fuji RPC tests classify the approved test USDC as a contract and a no-code address as an EOA; wrong-chain, malformed-response, and transport-failure cases are rejected and never treated as EOA evidence. The service uses this verifier and returns 503 on RPC failure. | **N/A.** Live public Fuji RPC was exercised. Hosted-provider-specific behavior and production monitoring remain operational concerns. |
| 2.6 Retention, purge, and closure (D-12) | **Blocked by unresolved policy.** No retention interval was invented. `requestAccountClosure()` remains gated, purge is disabled, and the append-only audit guards are preserved. | **Blocked.** D-12 remains unresolved. Broad identity enablement would accumulate challenges, sessions, rate-limit buckets, and audit rows indefinitely. |

## 3. Stage 3 and Stage 4 disposition

| Gate | Result | Classification |
|---|---|---|
| Identity unit/live tests | **40 passed, 0 failed, 0 skipped** with the disposable database and live Fuji RPC | Closed |
| Migration ledger, rollback, concurrency, constraints, audit immutability, waitlist preservation | Passed in the disposable PostgreSQL 16.14 suite | Closed for disposable DB; production application pending |
| Release-gate tests | **10 passed, 0 failed** | Closed |
| TypeScript | `npx tsc --noEmit --incremental false` passed | Closed |
| Scoped identity ESLint | Passed | Closed |
| Fuji testnet production build | Passed | Closed |
| `git diff --check` | Clean; only CRLF conversion warnings | Closed |
| Server-side two-wallet HTTP flow | Passed | Closed as HTTP evidence; not browser E2E |
| Fuji deployment simulation | **9 transactions simulated successfully** after correcting the contract size blocker | Closed as simulation |
| Fuji broadcast | Not performed | **Blocked**: funded test deployer and explicit approval are required |
| Trusted router manifest | Intentionally empty | **Not verified** until independently checked post-broadcast runtime hashes exist |

## 4. Operationally pending items

### 4.1 Neon/production role provisioning

The code is ready, but no Neon or production role was created. The operator must:

1. Use a Neon owner/admin credential only for migration and provisioning; never expose it to the application runtime.
2. Apply the additive migrations with `AERO_IDENTITY_MIGRATION_DATABASE_URL` (preferred) or the documented `DATABASE_URL` fallback, using `npm run migrate:identity`. Confirm migrations `001`, `002`, and `003` are recorded with stable checksums.
3. Set `AERO_IDENTITY_ADMIN_DATABASE_URL`, `AERO_IDENTITY_RUNTIME_ROLE`, and a random `AERO_IDENTITY_RUNTIME_PASSWORD` of at least 32 bytes, then run `npm run identity:provision-roles`.
4. Set the application runtime to `AERO_IDENTITY_DATABASE_URL` using the runtime role only. Do not use the migration/owner URL in the runtime.
5. Confirm the runtime role has `USAGE` on `identity`, the required `SELECT`/`INSERT`/`UPDATE` grants, `INSERT` only on audit, and `EXECUTE` only on the limiter function. Confirm it cannot `ALTER`, `DROP`, `TRUNCATE`, disable/drop triggers, read/write the limiter table directly, or execute the audit-rejection function.
6. Confirm both audit triggers are enabled and that a privileged DDL change would be detected/alarmed. The runtime role does not own the tables; the migration/owner role retains ownership and must be protected separately.
7. Keep signup closed and do not create a user during migration verification.

Neon must permit the admin role to `CREATE ROLE`, grant/revoke, and manage the identity schema. If the available Neon role cannot do that, role provisioning is blocked and must not be replaced by giving the runtime owner rights.

### 4.2 Rate-limit monitoring and tuning

The current values are operational abuse-control defaults, not a product retention policy:

- Challenge: 30 per IP / 15 minutes, 600 global / 15 minutes, 20 per user / 15 minutes.
- Verify: 60 per IP / 15 minutes, 1,200 global / 15 minutes.
- Cookie-bearing session: 120 per IP / 60 seconds, 3,000 global / 60 seconds.

Monitor 429 rates, 503 rates, limiter query latency, and Neon IO/storage. Adjust only with evidence. `AERO_TRUST_PROXY=none` is the safe default; set `vercel` or `header:<name>` only when the platform provably overwrites that header on every request. A wrong trusted-proxy setting can either collapse traffic into the conservative unattributed bucket or trust spoofable input.

### 4.3 Pool/load validation

The reusable pool is implemented and tested for reuse and cleanup, but no production concurrency/load test was run. Validate pool size (`AERO_IDENTITY_POOL_MAX`, default 5), connection limits, and latency under the hosting model before broad enablement.

## 5. Not verified and blocked

### 5.1 Two-wallet browser E2E — Not verified

Exact blockers:

- No browser wallet extension or injected provider (for example MetaMask) is available in this environment.
- No funded Fuji test EOAs or interactive signing accounts were provided.
- The server-side HTTP flow uses Node-side accounts and an HTTP cookie jar; it cannot verify wallet-provider account switching, injected-provider signing prompts, or the shipped UI's two-step link interaction.

Required browser run: connect A, authenticate, reauthenticate A, switch the provider to B, link B, confirm both wallets resolve to the same account, make B primary, log out and log back in with B, open a second A session, revoke A, confirm A's sessions are invalidated and B remains authenticated. Also exercise invalid signatures, expired challenges, replay, rejected switches, interrupted flows, origin rejection, CSRF rejection, rotation, logout-others, and idle expiry.

### 5.2 Neon/production — Operationally pending

No Neon migration, role creation, production configuration change, or real account was performed. This closure cannot certify the hosted Neon transport, production role ownership, backup/restore behavior, or production monitoring.

### 5.3 D-12 — Blocked by unresolved policy

D-12 remains unresolved. Consequences of indefinite retention while identity is enabled:

- challenges, sessions, rate-limit buckets, and append-only audit rows grow without a cleanup path;
- backups and indexes grow, and restore/verification time increases;
- deletion/erasure requests cannot be honored through an approved audited procedure;
- forensic value is retained, but so is personal/operational data;
- closed signup and rate limits reduce, but do not eliminate, accumulation.

No interval, purge job, hard-delete path, or account-closure enablement was added. Any future purge must use a separate privileged maintenance role and an audited deletion/archival procedure; the runtime role must never receive delete rights.

## 6. Dependency and cost note for the layered limiter

- **No external rate-limit service.** The limiter is a Postgres table plus a `SECURITY DEFINER` function (`identity.consume_rate_limit`). This avoids a Redis/WAF dependency but makes the identity database a latency and availability dependency.
- **Per-request cost.** Each limited challenge/verify/session request performs an additional database function call and row upsert. A cookie-bearing session read can therefore add a DB round trip even when no account is authenticated.
- **Storage.** The table grows with distinct scope/subject/window combinations. Retention cleanup is not implemented while D-12 is unresolved.
- **Failure behavior.** A missing migration, missing function/grant, or database outage maps to a 503 and does not bypass the limit.
- **Operational visibility.** Alert on limiter failures, 429 spikes, and database resource pressure. Tune the policy only after measuring legitimate traffic.

## 7. Residual risks

1. D-12 accumulation and the absence of an approved deletion/closure procedure.
2. Browser E2E remains unverified; the UI could still have a provider-specific interaction defect.
3. Production/Neon privileges and the hosted transport are unverified.
4. No production load test of the pool or limiter.
5. The runtime role is least-privilege in the disposable test, but the migration/owner credential remains powerful and must be operationally isolated.
6. Fuji contract deployment is not broadcast; no runtime code hash or address is trusted yet.
7. The Fuji yield stack is mock/synthetic, not real yield; it is not approved for real-value use.

## 8. Evidence summary

- Identity suite: **40 passed, 0 failed, 0 skipped** on disposable PostgreSQL 16.14, with live public Fuji RPC enabled.
- Focused RPC/rate-limit tests: **12 passed**, including live Fuji contract/EOA classification.
- Release gates: **10 passed**.
- TypeScript: passed.
- Scoped ESLint: passed.
- Fuji testnet production build: passed.
- Server-side two-wallet HTTP flow: passed with the disposable runtime role `aero_http_runtime`.
- Contract tests after enabling the optimizer: **67 passed**.
- Fuji `DeployMore` simulation: **9 transactions, exit 0**, no `--broadcast`.
- `git diff --check`: clean (CRLF notices only).

## 9. No-production-action statement

No Neon or production migration, role creation, public signup, real account creation, production configuration change, deployment, broadcast, funding, trusted-manifest population, DNS/hosting change, commit, push, or production credential/private-key use was performed. The Fuji simulation used an ephemeral, unfunded test key that was discarded; the disposable database and test harness are local-only.

## 10. Path to a full PASS

1. Complete the two-wallet browser E2E and the invalid/expired/replay/interrupted-flow cases.
2. Provision and verify the separate migration/owner and runtime roles on the approved Neon project; confirm the runtime cannot alter audit guards.
3. Resolve D-12 with an approved record-class retention/deletion policy, or explicitly accept gated accumulation with monitoring and an audited manual procedure.
4. Run a production-representative load test for the pool and limiter, with monitoring and alerting.
5. Broadcast the fresh Fuji stack only after funding/approval; independently verify addresses and runtime hashes; then populate and review the trusted manifest.
