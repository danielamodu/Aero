# Aero Milestone 1B — Identity Infrastructure Implementation

**Date:** 2026-10-22  
**Scope:** Fuji-only, closed-signup identity foundation. No deployment, account bootstrap, Neon migration, contract call, or production release was performed.

## Outcome

M1B source implementation is in place for additive schema, Fuji EOA wallet proof, login for existing accounts, wallet linking/revocation, server-side sessions, authorization guards, and a small identity panel. **Account creation remains closed by explicit product-owner decision.** The live identity schema is not yet applied to Neon, so no account can authenticate in the current deployment until the migration is separately applied and the runtime settings are configured. No users were seeded.

The product owner approved the multi-wallet Fuji EOA SIWE model, no-assisted-recovery boundary, server-side session controls, and Fuji AeroNames authority on 2026-10-22. The same response kept Fuji signup closed. The product owner also directed that purge/deletion remain disabled or gated until a record-class retention policy is approved. D-12 remains unresolved in `AERO_DECISIONS_REGISTER.md`.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| Phase 0: repository/database inspection | Complete | Read the working tree and M0/M1A docs; inspected the live Neon project/schema read-only. The only live table is `public.waitlist`; its existing columns and constraints were recorded during inspection. |
| M1B.1: database foundation | Implemented in source; not applied | Additive identity schema, ordered SQL migration, SHA-256 checksums, explicit ledger, and advisory-lock migration runner. No waitlist DDL or data change. |
| M1B.2: SIWE verification | Implemented in source; not exercised against Fuji RPC | Canonical Fuji SIWE message, 256-bit nonce, stored nonce/message hashes, strict exact-field parser, EIP-191 verification with Viem, and EOA-only Fuji code check. |
| M1B.3: account lifecycle | Partially implemented; signup intentionally blocked | Login only resolves existing accounts. Link, reauthentication, primary switch, wallet revocation, session invalidation and suspension service are implemented. Account bootstrap is deliberately absent; last-wallet revocation is rejected; account closure is gated on retention approval. |
| M1B.4: sessions | Implemented in source | Opaque 256-bit tokens, token/CSRF hashes, Secure host-only cookies, idle/absolute expiry, atomic rotation against the old token hash, logout and logout-other-sessions. |
| M1B.5: authorization/request security | Implemented in source | Central session resolver, default-deny account APIs, exact canonical origin, session-bound CSRF, same-origin-only CORS behavior, DB-backed per-wallet rate limit, bounded signature attempts, redacted logs, append-only audit trigger. |
| M1B.6: frontend integration | Implemented in source | Identity panel distinguishes connected wallet from Aero authentication and shows session expiry, verified wallets, pending proof actions, and explicit non-transaction signing language. |

## Database and migration

New files:

- `migrations/identity/001_identity_schema.sql`
- `scripts/migrate-identity.mjs`
- `lib/identity/db.ts`
- `lib/identity/retention.ts`

The migration creates the `identity` schema with `users`, `wallets`, `wallet_challenges`, `sessions`, and `identity_audit_events`. It enforces active EOA address uniqueness, at most one active primary wallet, EOA/contract chain consistency, Fuji challenge chain ID, EOA-only challenge targets, status/revocation consistency, same-user foreign keys, bounded challenge attempts, and append-only audit rows. Contract wallet rows are reserved but no app flow accepts them.

The runner takes a PostgreSQL advisory lock, applies ordered migrations in transactions, records SHA-256 checksums, and fails on checksum drift or a migration missing from source. It is run explicitly with `npm run migrate:identity`; application startup never migrates. Identity access requires shared Postgres and fails closed; it has no JSONL or local-file fallback. The migration was **not applied** to the live `aero` database.

The Neon serverless pool uses the direct `ws` dependency so it has a WebSocket implementation on Node versions without a built-in global WebSocket.

No retention interval was invented. There is no purge job or hard-delete API. `AERO_IDENTITY_RETENTION_POLICY_APPROVED` defaults to `false`, the retention guard requires an explicit approved policy and interval, and account closure raises a policy-required error. D-12 remains unresolved. Until the policy is approved, challenge and audit records could accumulate if identity endpoints are enabled; do not enable broad identity use before that decision.

## Authentication, sessions and lifecycle rules

- The only supported authentication network is Fuji (`43113`); the API checks Fuji RPC bytecode and rejects deployed-code addresses before EIP-191 EOA verification.
- The server chooses origin, URI, statement, chain, issue/expiry times, request ID and nonce. The request cannot override them. The SIWE statement identifies sign-in/link/revocation/primary-change intent and says it cannot authorize transfers.
- The database stores only a nonce hash and full-message hash. The client returns the signed canonical SIWE text; the server parses the exact supported form and compares each field plus both hashes. Signature bytes and raw bearer tokens are not persisted or logged.
- Challenge consumption and the corresponding session, wallet, audit and reauthentication writes share one database transaction. A failed transaction rolls back; clients must request a fresh challenge before retrying.
- Login is generic for unknown, suspended and active wallets. It does not create an account. Fuji signup is closed and the `create_account` purpose has no issuance/verification route.
- The first wallet in any future approved bootstrap must be primary. A linked wallet starts non-primary. Primary switching requires fresh linked-wallet proof. Revoking a primary promotes the earliest remaining active wallet. Revoking the last active wallet is rejected. Sessions tied to a revoked authenticated or reauthentication wallet are revoked.
- Suspension revokes all account sessions. Staff identity remains separate; no shared admin-cookie conversion exists. No Aero session or identity endpoint authorizes a token transfer.
- Suggested session defaults are configurable server-side: 12 hours idle and 7 days absolute; absolute lifetime is capped at 30 days. Unsafe cookie-authenticated requests require exact `Origin`, a session-bound CSRF cookie/header pair, and a valid DB session. GET endpoints are read-only; idle refresh uses POST activity.

## Username and payment boundary

AeroNames remains the authority for a handle on its Fuji contract instance. This milestone adds no username table or identity-based recipient substitution. A handle resolves to its registered recipient wallet. Other wallets linked to the same Aero account do not become equivalent payment destinations. Existing Send/Pay/Earn transaction authorization is unchanged.

## Configuration and activation

`.env.example` documents the required server settings: `DATABASE_URL`, `AERO_AUTH_ORIGIN`, `AERO_FUJI_RPC_URL`, and a 32-byte-or-longer `AERO_SESSION_SECRET`, plus configurable session lifetimes and the disabled retention gate. `.env.local` was not modified. The migration is not applied, and `AERO_AUTH_ORIGIN`, `AERO_FUJI_RPC_URL`, and `AERO_SESSION_SECRET` were not configured here. Identity endpoints therefore fail closed until the operator applies the additive migration and configures Fuji server settings. No production setting or release allowlist was changed.

## Verification

- `npm run test:identity` — **11 passed, 1 skipped, 0 failed**. The skipped disposable-Postgres integration test requires both `AERO_TEST_DATABASE_URL` and `AERO_TEST_DATABASE_CONFIRM=I_AM_USING_A_DISPOSABLE_DATABASE`; no live DB integration is claimed.
- `npm run test:release-gate` — **10 passed, 0 skipped, 0 failed**.
- `npx tsc --noEmit --incremental false` — **passed** after identity implementation and UI lint fixes; the final production build also passed its TypeScript phase.
- `npm run build` with explicit Fuji testnet release variables — **passed**. Next compiled and generated 26 static pages; identity APIs appeared as dynamic routes. Existing warnings: parent `pnpm-workspace.yaml` ignored, deprecated `middleware` convention, and missing `metadataBase`.
- `npx eslint app/api/identity lib/identity components/testnet/identity-control.tsx` — **passed**.
- `npm run lint` — **failed project-wide** on existing repository findings (39 errors, 322 warnings in that run), including unrelated navigation, hook, test-fixture and contract-library findings. Identity-specific findings from the first lint run were corrected; scoped identity lint passes. The full lint command was not rerun after those corrections.
- No Fuji wallet end-to-end test, database integration test, migration application, or contract test was run.

## Files changed or created

- API: `app/api/identity/challenge/route.ts`, `verify/route.ts`, `session/route.ts`, `touch/route.ts`, `rotate/route.ts`, `logout/route.ts`, `logout-others/route.ts`.
- Services: `lib/identity/db.ts`, `http.ts`, `primitives.mjs`, `primitives.d.mts`, `security.ts`, `service.ts`, `retention.ts`.
- UI: `components/testnet/identity-control.tsx`, `app/testnet/page.tsx`.
- Data/tooling: `migrations/identity/001_identity_schema.sql`, `scripts/migrate-identity.mjs`, `tests/identity/protocol.test.mjs`, `tests/identity/migration.test.mjs`, `package.json`, `.env.example`.
- Documentation: this report, `AERO_DECISIONS_REGISTER.md`, `AERO_IDENTITY_ARCHITECTURE.md`, `AERO_WALLET_VERIFICATION_PROTOCOL.md`, `AERO_ACCOUNT_RECOVERY_DESIGN.md`, `AERO_PRODUCT_BOUNDARIES.md`, `AERO_RELEASE_GATES.md`, and `AERO_ENGINEERING_ROADMAP.md`.

No unrelated waitlist, admin, contract, deployment, release-manifest or production-config changes were made by M1B. Existing working-tree changes were preserved.

## Remaining risks and next milestone

The identity store has not been migrated, no test database was available, the Fuji RPC verifier was not exercised against a live provider, and the app currently has no users because signup is closed. A retention policy is still required before purge/closure behavior can be enabled. Session idle/absolute defaults and no-assisted-recovery remain product decisions recorded as approved for this Fuji M1B scope; security/legal review is still required before beta or production.

**Next:** M1C — approve field-level retention/deletion and controlled enrollment policy; apply the additive migration to a disposable Postgres database and run concurrency/constraint/waitlist-preservation integration tests; provision no user until enrollment is separately approved; then run a Fuji EOA end-to-end challenge/session/link/revoke review. Keep beta and production blocked.
