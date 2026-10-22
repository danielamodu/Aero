# Aero Milestone 1B — Identity Infrastructure Implementation

**Date:** 2026-10-22  
**Scope:** Fuji-only, closed-signup identity foundation, post-audit security remediation, and verification. No deployment, broadcast, Neon/production migration, account bootstrap, or production release was performed.

## Outcome

M1B is implemented in source and has been exercised against a disposable PostgreSQL 16.14 database and the live public Fuji RPC. The implemented surface includes:

- additive identity schema and ordered migrations, including audit truncate protection and DB-backed rate limits;
- Fuji EOA-only SIWE challenge/verification with a fail-closed RPC classifier;
- login for existing accounts, wallet linking, reauthentication, primary switching, revocation, and last-wallet protection;
- server-side sessions with host-only Secure cookies, CSRF, idle/absolute expiry, rotation, logout, and logout-others;
- layered challenge, verification, and cookie-bearing session limits;
- a least-privilege runtime role provisioner and a reusable bounded database pool;
- the testnet identity panel and the repaired two-step link interaction.

**Account creation remains closed by explicit product-owner decision (D-24).** No user was created in Neon or any production database. No identity migration or role was applied outside the disposable test database. The live schema is not yet applied, so no account can authenticate in the current deployment until the operator completes the separately approved migration and configuration.

The product owner approved the multi-wallet Fuji EOA SIWE model, no-assisted-recovery boundary, server-side session controls, and Fuji AeroNames authority on 2026-10-22. D-12 remains unresolved: no retention interval is approved, and purge/hard delete/account closure remain disabled or gated.

The closure verdict is **CONDITIONAL PASS**, not a full pass. The two-wallet **browser** E2E, Neon/production role provisioning, and production-representative load testing remain unverified or operationally pending. See `AERO_M1B_CLOSURE_REPORT.md` and `AERO_M1B_SECURITY_AUDIT.md` §14.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| Phase 0: repository/database inspection | Complete | Repository and M0/M1A material inspected. This closure did not access or modify Neon. |
| M1B.1: database foundation | Implemented; verified on disposable PostgreSQL | Additive `001`–`003` migrations, checksum ledger, advisory-lock runner, audit guards, and limiter function. Not applied to Neon. |
| M1B.2: SIWE verification | Implemented; live Fuji RPC tested | Canonical Fuji SIWE message, 256-bit nonce, stored nonce/message hashes, strict exact-field parser, EIP-191 verification, and a fail-closed Fuji EOA/contract classifier. |
| M1B.3: account lifecycle | Implemented; server-side HTTP flow passed | Login resolves existing accounts only. Link, reauthentication, primary switch, revocation, session invalidation, and last-wallet protection are implemented. Account bootstrap is absent. |
| M1B.4: sessions | Implemented and integration-tested | Opaque 256-bit tokens, token/CSRF hashes, host-only Secure cookies, idle/absolute expiry, atomic rotation, logout, logout-others. |
| M1B.5: authorization/request security | Implemented and tested | Central resolver, default-deny account APIs, exact origin, session-bound CSRF, layered DB-backed limits, trusted-proxy parsing, append-only audit, least-privilege runtime role, reusable pool. |
| M1B.6: frontend integration | Implemented; browser E2E pending | Identity panel distinguishes wallet connection from Aero authentication, supports the two-step link flow, and shows pending proofs and expiry. No browser wallet/provider was available for E2E. |

## Post-audit security remediation

### 2.1 Least-privilege runtime and migration roles

- `scripts/provision-identity-roles.mjs` creates or rotates a runtime login role with `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, and `NOBYPASSRLS`.
- The runtime role receives `USAGE` on `identity`, but not `CREATE`; only the DML it needs:
  - `SELECT, UPDATE` on `identity.users` (no `INSERT`, because signup is closed);
  - `SELECT, INSERT, UPDATE` on `identity.wallets`, `identity.sessions`, and `identity.wallet_challenges`;
  - `INSERT` only on `identity.identity_audit_events`;
  - `EXECUTE` on `identity.consume_rate_limit(bytea, integer, integer, timestamptz)`.
- It has no direct access to `identity.rate_limits`, no `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`, DDL, ownership, or `EXECUTE` on the audit-rejection function.
- The provisioner verifies these properties after applying them and fails if a check does not match.
- The runtime role is separate from the migration/owner role. The migration role retains schema/trigger ownership and must never be exposed to the runtime process.
- The migrator prefers `AERO_IDENTITY_MIGRATION_DATABASE_URL` and falls back to `DATABASE_URL`; the runtime uses `AERO_IDENTITY_DATABASE_URL`.
- Disposable-Postgres tests confirm the runtime cannot alter/drop the audit guards or write the limiter table directly.

**Not applied to Neon/production.** See the operator runbook below.

### 2.2 Layered rate limits

Implemented in `lib/identity/rate-limit-policy.mjs`, `lib/identity/rate-limit.ts`, and `migrations/identity/003_identity_rate_limits.sql`:

| Surface | Per-IP | Global | Per-user / other |
|---|---:|---:|---:|
| Challenge issuance | 30 / 15 min | 600 / 15 min | 20 per user / 15 min |
| Verification | 60 / 15 min | 1,200 / 15 min | — |
| Cookie-bearing session read | 120 / 60 sec | 3,000 / 60 sec | — |

- Every challenge enforces IP/global limits before service work; non-login challenges also enforce the user limit. Closed-signup attempts still consume the challenge budget.
- Verification enforces its limits before body lookup.
- Session enforcement applies only when a `__Host-aero_session` cookie is present.
- The limiter is a DB table plus an atomic `SECURITY DEFINER` function. The runtime cannot read or write the table directly.
- `requestRateLimitSubject()` ignores forwarded headers by default. `AERO_TRUST_PROXY=vercel` uses Vercel-overwritten headers; `header:<name>` is an explicit opt-in for a proxy that overwrites that exact header. Unattributed requests share one conservative bucket, so random wallet addresses and omitted/spoofed headers cannot escape the IP/global limits.
- Database/limiter failures map to 503 (`IDENTITY_DATABASE_UNAVAILABLE` / `IDENTITY_RATE_LIMIT_UNAVAILABLE`), not bypass.
- The values are operational abuse-control defaults, not a product retention policy. Monitor and tune with evidence.

### 2.3 Reusable identity database pool

`lib/identity/pool.mjs` now provides one module-scoped pool per Node process/serverless instance:

- bounded by `AERO_IDENTITY_POOL_MAX` (default 5, allowed 1–20);
- 5-second connection timeout, 30-second idle timeout;
- explicit stats (`creations`, `totalCount`, `idleCount`, `waitingCount`) and explicit close/reset for scripts/tests;
- `lib/identity/db.ts` releases clients, destroys broken connections, and preserves the read-only/transaction boundaries;
- request paths no longer create or end a pool per request;
- a test-only local WebSocket proxy can be enabled with `AERO_IDENTITY_WS_PROXY` (and `AERO_IDENTITY_WS_INSECURE=1` for a local bridge). These variables are never for a deployed environment; the default remains Neon's managed transport.

### 2.4 Two-wallet flow

The server-side flow passed end to end against the disposable runtime role:

- A login and reauthentication;
- switch to B, link B, both wallets on the same account;
- make B primary;
- logout/relogin as B;
- open a second A session;
- revoke A; A's sessions become invalid while B remains authenticated;
- invalid signature, expired challenge, replay, and a rejected switch are rejected.

This is **not** a browser E2E. No browser wallet extension/provider and no funded Fuji test EOAs were available. The shipped UI's provider switching/signing prompts still require manual browser verification.

### 2.5 Fuji RPC EOA classification

`lib/identity/fuji-eoa.mjs` performs a raw JSON-RPC check:

- requires `eth_chainId == 43113`;
- fetches `eth_getCode` and accepts only an empty code result as EOA evidence;
- rejects deployed bytecode, wrong-chain responses, malformed responses, and transport failures;
- throws `IDENTITY_FUJI_RPC_UNAVAILABLE`, `IDENTITY_FUJI_RPC_CHAIN_MISMATCH`, or `IDENTITY_FUJI_RPC_RESPONSE_INVALID` rather than treating failure as EOA.

Tests cover a live Fuji contract, a no-code address, wrong chain, malformed bytecode, and unavailable RPC. A valid signature is still required before this check; RPC failure does not prove EOA.

### 2.6 Retention (D-12)

No retention interval was invented. There is no purge job, hard-delete API, or enabled account closure. `AERO_IDENTITY_RETENTION_POLICY_APPROVED` remains `false`; the retention guard and closure path remain gated. Challenges, sessions, limiter buckets, and append-only audit rows can accumulate if identity endpoints are enabled. Do not enable broad identity use before D-12 is resolved or gated accumulation is explicitly accepted with monitoring and an audited manual procedure.

## Database and migration

New/changed files:

- `migrations/identity/001_identity_schema.sql`
- `migrations/identity/002_identity_audit_truncate_guard.sql`
- `migrations/identity/003_identity_rate_limits.sql`
- `scripts/migrate-identity.mjs`
- `scripts/provision-identity-roles.mjs`
- `lib/identity/db.ts`, `pool.mjs`, `rate-limit.ts`, `error-codes.mjs`
- `tests/identity/migration.test.mjs`, `postgres.integration.test.mjs`, `rate-limit.test.mjs`, `fuji-rpc.test.mjs`

The identity schema contains `users`, `wallets`, `wallet_challenges`, `sessions`, `rate_limits`, and `identity_audit_events`. It enforces active EOA address uniqueness, at most one active primary wallet, EOA/contract chain consistency, Fuji challenge chain ID, EOA-only challenge targets, status/revocation consistency, same-user foreign keys, bounded attempts, and append-only audit rows. `002` adds statement-level `BEFORE TRUNCATE` protection; `003` adds the limiter table, atomic consume function, and public-execute revocation.

The runner takes a PostgreSQL advisory lock, applies ordered migrations in transactions, records SHA-256 checksums, and fails on checksum drift or a missing source file. Application startup never migrates.

### Neon role provisioning runbook (not executed)

1. Use a Neon owner/admin credential only for migration/provisioning, stored separately from the runtime secret.
2. Set `AERO_IDENTITY_MIGRATION_DATABASE_URL` (preferred) or the documented `DATABASE_URL`; run `npm run migrate:identity`. Confirm `001`, `002`, and `003` are recorded with stable checksums.
3. Set `AERO_IDENTITY_ADMIN_DATABASE_URL`, `AERO_IDENTITY_RUNTIME_ROLE` (default `aero_identity_runtime`), and a random `AERO_IDENTITY_RUNTIME_PASSWORD` of at least 32 bytes.
4. Run `npm run identity:provision-roles`; confirm every privilege assertion passes.
5. Set the application's `AERO_IDENTITY_DATABASE_URL` to the runtime-role connection string. Never use the admin/migration URL in the runtime.
6. Verify the two audit triggers are enabled, the runtime cannot disable/drop them, and the runtime cannot read/write `identity.rate_limits` directly.
7. Keep signup closed; do not create a user during verification.

Neon must permit the admin role to `CREATE ROLE` and grant/revoke on the identity schema. If it cannot, provisioning is blocked; do not compensate by giving the runtime owner/DDL rights.

## Authentication, sessions, and lifecycle rules

- The only supported authentication network is Fuji (`43113`); the API checks Fuji RPC bytecode and rejects deployed-code addresses before EIP-191 EOA verification.
- The server chooses origin, URI, statement, chain, issue/expiry times, request ID, and nonce. The request cannot override them. The SIWE statement identifies sign-in/link/revocation/primary-change intent and says it cannot authorize transfers.
- The database stores only a nonce hash and full-message hash. The client returns the signed canonical SIWE text; the server parses the exact supported form and compares every field plus both hashes. Signature bytes and raw bearer tokens are never persisted or logged.
- Challenge consumption and the corresponding session, wallet, audit, and reauthentication writes share one transaction. A failed transaction rolls back; clients must request a fresh challenge.
- Login is generic for unknown, suspended, and active wallets. It does not create an account. Fuji signup is closed; `create_account` has no issuance/verification route.
- The first wallet in any future approved bootstrap must be primary. A linked wallet starts non-primary. Primary switching requires fresh linked-wallet proof. Revoking a primary promotes the earliest remaining active wallet. Revoking the last active wallet is rejected. Sessions tied to a revoked authenticated/reauthentication wallet are revoked.
- Suspension revokes all account sessions. Staff identity remains separate. No Aero session or identity endpoint authorizes a token transfer.
- Session defaults are 12 hours idle and 7 days absolute; absolute lifetime is capped at 30 days. Cookie-authenticated unsafe requests require exact `Origin`, a session-bound CSRF cookie/header pair, and a valid DB session. GET endpoints are read-only; idle refresh uses POST activity.

## Username and payment boundary

AeroNames remains the authority for a handle on its Fuji contract instance. This milestone adds no username table or identity-based recipient substitution. A handle resolves to its registered recipient wallet; other wallets linked to the same Aero account do not become equivalent payment destinations. Existing Send/Pay/Earn transaction authorization is unchanged.

## Configuration

`.env.example` documents the required server settings. The runtime identity database is **`AERO_IDENTITY_DATABASE_URL`**, not `DATABASE_URL`.

Required/operational:

- `AERO_IDENTITY_DATABASE_URL` — runtime role connection string;
- `AERO_IDENTITY_MIGRATION_DATABASE_URL` — preferred migration/owner URL;
- `AERO_AUTH_ORIGIN` — exact canonical origin;
- `AERO_FUJI_RPC_URL` — Fuji RPC;
- `AERO_SESSION_SECRET` — at least 32 random bytes;
- `AERO_TRUST_PROXY=none|vercel|header:<lowercase-header>`;
- `AERO_IDENTITY_POOL_MAX` — default 5, range 1–20;
- `AERO_SESSION_IDLE_SECONDS` / `AERO_SESSION_ABSOLUTE_SECONDS`;
- `AERO_IDENTITY_RETENTION_POLICY_APPROVED=false` and no approved interval.

Provisioning-only (never in the running application): `AERO_IDENTITY_ADMIN_DATABASE_URL`, `AERO_IDENTITY_RUNTIME_ROLE`, `AERO_IDENTITY_RUNTIME_PASSWORD`.

Test-only local bridge (never deployed): `AERO_IDENTITY_WS_PROXY`, `AERO_IDENTITY_WS_INSECURE`.

No secret was added to `.env.local` or committed. The disposable test password is not a production credential.

## Verification

- `node --test tests/identity/*.test.mjs` with the disposable database and live Fuji RPC — **40 passed, 0 failed, 0 skipped**. Coverage includes additive migration, repeat/checksum behavior, rollback, concurrency, constraints, audit immutability including `TRUNCATE`, role denials, limiter behavior, pool reuse, and Fuji EOA classification.
- Focused RPC/rate-limit suite — **12 passed**, including live Fuji `tUSDC` contract and no-code EOA classification.
- `npm run test:release-gate` — **10 passed, 0 failed**.
- `npx tsc --noEmit --incremental false` — passed.
- `npx eslint app/api/identity lib/identity scripts/migrate-identity.mjs scripts/provision-identity-roles.mjs components/testnet/identity-control.tsx` — passed.
- `npm run build` with explicit Fuji testnet release variables — passed (26 static pages; identity APIs dynamic). Existing warnings: parent `pnpm-workspace.yaml`, deprecated `middleware` convention, missing `metadataBase`.
- `git diff --check` — clean; only CRLF conversion notices.
- Server-side two-wallet HTTP flow against disposable runtime role `aero_http_runtime` — passed.
- Contract tests after the deployment preflight build-profile fix — **67 passed** (separate from M1B identity tests).

Not verified: browser two-wallet E2E; hosted Neon transport; Neon/production role provisioning; production-representative pool/limiter load; actual Fuji broadcast/runtime-hash verification.

## Files changed or created

- API: `app/api/identity/challenge/route.ts`, `verify/route.ts`, `session/route.ts`, `touch/route.ts`, `rotate/route.ts`, `logout/route.ts`, `logout-others/route.ts`.
- Services: `lib/identity/db.ts`, `pool.mjs`, `pool.d.mts`, `http.ts`, `security.ts`, `service.ts`, `rate-limit.ts`, `rate-limit-policy.mjs`, `rate-limit-policy.d.mts`, `request-ip.mjs`, `request-ip.d.mts`, `fuji-eoa.mjs`, `fuji-eoa.d.mts`, `error-codes.mjs`, `error-codes.d.mts`, `primitives.mjs`, `primitives.d.mts`, `retention.ts`.
- UI: `components/testnet/identity-control.tsx`, `app/testnet/page.tsx`.
- Data/tooling: `migrations/identity/001_identity_schema.sql`, `002_identity_audit_truncate_guard.sql`, `003_identity_rate_limits.sql`, `scripts/migrate-identity.mjs`, `scripts/provision-identity-roles.mjs`, `tests/identity/*.test.mjs`, `package.json`, `.env.example`.
- Deployment preflight: `contracts/foundry.toml` optimizer profile; reports `AERO_FUJI_YIELD_PREFLIGHT_REPORT.md` and `AERO_M1B_CLOSURE_REPORT.md`.
- Documentation: this report, `AERO_M1B_SECURITY_AUDIT.md` closure addendum, `AERO_DECISIONS_REGISTER.md` status note.

No unrelated waitlist, admin, contract, deployment, release-manifest, or production-config changes were made by M1B. Existing working-tree changes were preserved. No commit or push was made.

## Remaining risks and next steps

1. Complete the two-wallet browser E2E with two funded Fuji EOAs and a real injected provider; include invalid signatures, expired challenges, replay, rejected switches, interrupted flows, origin/CSRF rejection, rotation, logout-others, and idle expiry.
2. Provision and verify separate migration/owner and runtime roles on Neon under an approved maintenance window; keep signup closed.
3. Resolve D-12 or explicitly accept gated accumulation with monitoring and an audited manual procedure.
4. Run production-representative load tests for the pool and limiter; monitor 429/503 rates, latency, Neon connections, and storage.
5. Broadcast the fresh Fuji stack only after funding/approval; verify receipts, source, addresses, and runtime hashes independently; then populate the trusted manifest in a reviewed change.

**Next milestone:** M1C — approve field-level retention/deletion and controlled enrollment policy; complete browser E2E; provision production roles; then decide whether controlled Fuji activation is justified. Keep beta and production blocked.
