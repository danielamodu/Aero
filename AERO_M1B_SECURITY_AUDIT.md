# Aero M1B Identity Security Audit

**Audit date:** 2026-10-22  
**Scope:** M1B Fuji-only identity foundation: SIWE challenge/verification, session lifecycle, wallet link/revoke/primary lifecycle, DB migration and runner, identity API routes, the testnet identity control, and the release gates that keep identity testnet-only.  
**Verdict:** **CONDITIONAL PASS** — no Critical or High severity defect was found. The code and schema are transactionally sound under the tested concurrency cases, but the conditions in §12 must be met before controlled Fuji activation.

> **Post-remediation closure addendum (2026-10-22):** §14 records the remediation evidence and final disposition. It supersedes the historical status statements in §2, §9, §11, §12, and §13 where they say an item was still open or untested. The verdict remains **CONDITIONAL PASS**, not a full pass. Browser E2E, Neon/production role provisioning, and production load verification remain outstanding.

---

## 0. Constraints and method

The audit was independent and read the eight authoritative documents before the implementation:

- `AERO_SYSTEM_ARCHITECTURE_AUDIT.md`
- `AERO_RELEASE_GATES.md`
- `AERO_PRODUCT_BOUNDARIES.md`
- `AERO_M1B_IMPLEMENTATION_REPORT.md`
- `AERO_IDENTITY_ARCHITECTURE.md`
- `AERO_WALLET_VERIFICATION_PROTOCOL.md`
- `AERO_THREAT_MODEL.md`
- `AERO_DECISIONS_REGISTER.md`

The following boundaries were honoured:

- No migration was applied to the production Neon database.
- Nothing was deployed or broadcast; no real account was created; public signup was not enabled.
- No production setting was changed.
- No commit or push was made.
- `aero deployer.txt` was treated as pre-existing user work and left untouched.
- D-12 remains unresolved. No retention interval was invented, and purge/hard delete remain gated.
- No protection was weakened to make a test pass.

The review compared the documents against the actual source in `lib/identity/`, `app/api/identity/`, `components/testnet/identity-control.tsx`, `migrations/identity/`, `scripts/migrate-identity.mjs`, and `tests/identity/`, then executed the real migration runner and SQL-level concurrency tests against a disposable PostgreSQL 16.14 instance.

---

## 1. Executive assessment

The server-side identity design is materially stronger than the previous milestones: the challenge is bound to a server-configured origin, chain `43113`, a 256-bit nonce, a purpose, a target address, issued/expiry times, and the challenge row; the message hash and nonce hash are stored rather than the signature; consumption is one row-locked transaction that also creates or updates the session, wallet, and audit rows; wallet addresses are globally unique among active EOAs; sessions are opaque 256-bit tokens with only SHA-256 hashes at rest; and all identity routes are same-origin, with session-bound CSRF on authenticated mutations.

No Critical or High severity authorization bypass, replay path, signature-forgery path, cross-user write, or transaction-authorization path was found. The main residual risks are operational rather than cryptographic:

1. the runtime DB role can still disable or drop the audit triggers because it owns the migrated schema;
2. the unauthenticated challenge endpoint and cookie-bearing `session` endpoint have no IP/global rate limit, while every request creates a fresh database pool and WebSocket;
3. no retention/purge exists (correctly, per unresolved D-12), so challenges, sessions, and append-only audit rows accumulate;
4. the multi-wallet link UI was not usable as shipped and has been repaired but not browser-E2E tested;
5. live Fuji RPC EOA checking and the hosted Neon transport were not exercised in this audit.

Those are conditions, not a reason to call the server-side implementation unsafe.

---

## 2. Findings

### 2.1 Critical / High

None found.

A deliberate search was made for: a way to link an attacker wallet without a fresh proof; a way to replay a challenge; a way to consume another user's challenge; a way to act on another user's session/wallet; a way to obtain a session from a signature that was not made by the active EOA; a way to authorize a token transfer; and a way to write partial wallet/session/audit state. None was found in the reviewed implementation.

### 2.2 Medium

#### M-1 — Audit history was truncatable, and the runtime role can still disable/drop the guards

- **Severity:** Medium.
- **Location:** `migrations/identity/001_identity_schema.sql` (the original `identity_audit_append_only` trigger), `migrations/identity/002_identity_audit_truncate_guard.sql` (new guard), `lib/identity/db.ts` and `scripts/migrate-identity.mjs` (both use the single `DATABASE_URL`).
- **Scenario:** A row-level `BEFORE UPDATE OR DELETE` trigger does not fire for `TRUNCATE`. Anyone able to issue `TRUNCATE identity.identity_audit_events` could erase the entire audit history in one statement. Separately, because the migration runner and the runtime use the same connection string and the migrating role owns the objects, a compromised runtime credential can `ALTER TABLE ... DISABLE TRIGGER`, `DROP TRIGGER`, or `DROP TABLE` before writing.
- **Impact:** Loss of the forensic trail for wallet linking, session creation/revocation, and login decisions; inability to investigate account takeover or insider actions. The second path requires DB credentials, so it is defense-in-depth rather than an application-layer bypass.
- **Evidence:** PostgreSQL documentation and the new test confirm row triggers do not cover `TRUNCATE`; the new integration test now rejects `UPDATE`, `DELETE`, and `TRUNCATE`; `002` adds `BEFORE TRUNCATE ... FOR EACH STATEMENT` reusing `identity.reject_audit_mutation()`. After the test run, `pg_trigger` shows `identity_audit_append_only` (`tgtype` 27) and `identity_audit_no_truncate` (`tgtype` 34), both enabled. There is no separate runtime role in `db.ts` or the runner.
- **Remediation:** The `TRUNCATE` gap is fixed in `002`. Before activation, provision least-privilege roles: a migration/owner role for DDL, and a runtime role with `USAGE` on `identity`, plus `SELECT/INSERT/UPDATE/DELETE` on the required tables and **no** `TRUNCATE`, `TRIGGER`, `ALTER`, or `DROP`; the audit table should be `INSERT`-only for the runtime role. Alert on DDL against `identity.*` and on audit-trigger disablement. If a single role is retained, record the residual risk explicitly.
- **Status:** Partially fixed (TRUNCATE); privilege separation remains open.

#### M-2 — Unauthenticated challenge and cookie-bearing session requests have no IP/global rate limit

- **Severity:** Medium.
- **Location:** `app/api/identity/challenge/route.ts` (login challenges are unauthenticated), `lib/identity/service.ts` (`createWalletChallenge` rate limit), `app/api/identity/session/route.ts`, `lib/identity/security.ts` (`resolveSession`), `lib/identity/db.ts`.
- **Scenario:** The only issuance limit is ten challenges per **target wallet address** per fifteen minutes (`rateLimitKeyHash = HMAC("wallet:" + normalized address)`). An attacker can mint a challenge for a fresh random address each time, so the per-address budget never binds. Each request needs only an `Origin` header equal to the configured origin; a script can set that header, so the origin check is CSRF protection, not authentication. Every login attempt also produces a challenge row and an audit row. Separately, `GET /api/identity/session` accepts any syntactically valid cookie (40–128 characters) and performs a database read, so a script can force connection setup without an account.
- **Impact:** Database and append-only audit growth without a matching user population; Neon connection/WebSocket pressure and cost; slower legitimate login; and a cheap way to keep the identity surface busy. This compounds D-12 (no purge). It is not an authentication bypass.
- **Evidence:** `AERO_WALLET_VERIFICATION_PROTOCOL.md` §3 explicitly says to “Rate-limit by IP and wallet”; the implementation limits by wallet only. `createWalletChallenge` counts `rate_limit_key_hash` rows in a fifteen-minute window and rejects at ten; `prove` in the UI requests a fresh challenge per attempt. `createPool()` is called inside every `withIdentityTransaction`/`withIdentityRead`. The session route calls `resolveSession` only after a length-valid cookie is present.
- **Remediation:** Add an edge/WAF per-IP limit in front of `/api/identity/*` (challenge, verify, session) and a distributed limiter keyed by IP plus wallet, with a low unauthenticated challenge budget. Alternatively, require an approved enrollment/attestation step before issuing challenges. Monitor challenge rows per IP/minute, audit rows/minute, and Neon active connections. Do not add an in-memory per-instance limiter as the only control; the protocol already requires distributed behavior for multi-instance deployment.
- **Status:** Open; pre-activation condition.

#### M-3 — No retention, purge, or expired-record cleanup (D-12 unresolved)

- **Severity:** Medium (operational/privacy).
- **Location:** `lib/identity/retention.ts`, `migrations/identity/001_identity_schema.sql`, `lib/identity/service.ts`, `app/api/identity/*`.
- **Scenario:** `approvedIdentityRetentionDays()` returns `null` unless `AERO_IDENTITY_RETENTION_POLICY_APPROVED=true` **and** a valid day count is supplied; `assertIdentityPurgeEnabled()` is not called anywhere; `requestAccountClosure()` always throws `IDENTITY_RETENTION_POLICY_REQUIRED`; no job deletes expired challenges, expired/revoked sessions, or old audit rows. The append-only audit trigger correctly prevents silent deletion, but there is also no audited, privileged deletion path.
- **Impact:** Unbounded growth of challenges, sessions, and audit events; larger backups and slower indexes over time; no way to honour a future deletion request without a policy-driven, audited procedure. The impact is deliberately gated, not silently ignored.
- **Evidence:** `AERO_DECISIONS_REGISTER.md` D-12: “No duration is approved… keep purge and hard deletion disabled/gated until a field-level policy is approved”; it names “expired challenges and audit rows” as the expected accumulation risk. The implementation matches that decision. `retention.ts` has no callers outside its own module.
- **Remediation:** Keep purge disabled until D-12 is approved. Then implement per-record-class retention, a privileged maintenance role, audited deletions (or an approved immutable archive), and tests that prove audit rows cannot be deleted by the runtime role but can be removed only through the approved procedure. Do not invent an interval in code, docs, or tests.
- **Status:** Open by design; blocking for broad enablement, not for a controlled closed-signup test.

#### M-4 — Per-request database pool and WebSocket churn

- **Severity:** Medium.
- **Location:** `lib/identity/db.ts`: `createPool()` constructs a new `Pool` with `max: 1`, and both `withIdentityTransaction` and `withIdentityRead` call `pool.end()` in `finally`.
- **Scenario:** Every identity read or write opens a new Neon WebSocket connection. A single login can involve: session lookup (if a cookie exists), challenge issuance, a `getChallenge` read, an RPC call, and `consumeChallenge`, plus a `session` refresh after success. Each is a separate pool and connection. Concurrent users multiply this; an attacker can force it with cookie-bearing `session` requests.
- **Impact:** Connection setup latency on the hot path, Neon connection-limit pressure, and avoidable cost. Correctness is not affected because each operation is self-contained, but availability is.
- **Evidence:** The current file has no module-scope pool; the comment in `createPool` is absent, but the `pool.end()` in the `finally` block is explicit. This is also why the disposable-Postgres harness had to bridge a WebSocket per operation.
- **Remediation:** Use a module-scope, bounded pool (for example, a small `max` with idle timeout) in the Node runtime and reuse it across requests; keep `pool.end()` only for scripts and tests. Verify behavior in the target hosting model (long-lived Node process versus edge) and load-test concurrent login attempts. This does not change the transaction boundaries.
- **Status:** Open; pre-activation condition (can be mitigated by an external connection proxy, but the code should still be corrected).

#### M-5 — The multi-wallet link flow was not usable from the shipped UI

- **Severity:** Medium (feature readiness; no server-side bypass).
- **Location:** `components/testnet/identity-control.tsx`, `prove()` and the wallet action block.
- **Scenario:** The server correctly requires two distinct proofs for a link: a recent reauthentication with an existing linked wallet, and a signature from the new wallet being linked. The UI originally presented a single combined action that tried to sign the reauthentication message with the *connected* wallet while the proof wallet was a different selected wallet. A wallet provider can only sign for the connected account, so the flow could not complete. The first repair also placed the success notice after a `return`, making it unreachable, and did not persist which wallet had proved control after the user switched accounts.
- **Impact:** A required M1B capability (linking a second wallet) could not be exercised through the product UI, which pushes operators toward ad-hoc calls and prevents a clean E2E acceptance test. The server still rejected unauthorized attempts, so this is not a confidentiality/integrity defect.
- **Evidence:** The fixed component now: requires the signer to be the connected account; treats the connected linked wallet as the only valid proof wallet when it is linked; separates “Reauthenticate selected wallet” from “Link connected wallet”; disables the link action until the session records a matching `reauthenticatedWalletId`; and remembers the proof wallet id so it survives an account switch. The 5-minute server enforcement remains authoritative; the UI no longer calls `Date.now()` during render (lint rule `react-hooks/purity`).
- **Remediation:** Manual browser E2E with two Fuji EOAs is still required: connect A (linked), reauthenticate, switch to B, link B, switch primary, revoke A, confirm sessions for A are invalidated and B can still sign in. The audit environment had no browser wallet, so this was not executed.
- **Status:** Code fixed; E2E verification pending.

### 2.3 Low

#### L-1 — Failed signature/EOA attempts are counted but not audited

- **Severity:** Low.
- **Location:** `lib/identity/service.ts` `incrementChallengeFailure()`, `app/api/identity/verify/route.ts`.
- **Scenario:** A wrong signature, altered message, expired challenge, or a deployed-code address increments `attempt_count`, invalidates at five, and returns a generic error, but appends no audit event. The per-wallet issuance limit is the only durable record of the attempt pattern.
- **Impact:** Weaker forensic visibility into online guessing or a stuck client. The attempt budget itself is bounded and correct.
- **Evidence:** `incrementChallengeFailure` only updates `wallet_challenges`; `verify` calls it on every failure path but does not call `appendAudit`.
- **Remediation:** Emit a redacted `auth.challenge_failed` audit event with a reason category and no signature/message bytes, in the same transaction as the counter, or expose attempt metrics. Weigh the added audit growth against D-12.
- **Status:** Open (accepted for closed signup).

#### L-2 — Migration files are not self-idempotent; only the runner ledger makes re-runs safe

- **Severity:** Low.
- **Location:** `migrations/identity/001_identity_schema.sql`, `002_identity_audit_truncate_guard.sql`, `scripts/migrate-identity.mjs`.
- **Scenario:** `001` uses `CREATE SCHEMA IF NOT EXISTS` but plain `CREATE TABLE`/`CREATE FUNCTION`; `002` uses a plain `CREATE TRIGGER`. Running a file manually with `psql`, without recording it in `public.identity_schema_migrations`, leaves the ledger unaware; the next runner attempt fails at the first already-existing object.
- **Impact:** An emergency/manual application can block the normal deploy path. Each file is wrapped in a transaction by the runner, so there is no partial schema, but the operator must reconcile manually.
- **Evidence:** The runner requires `DATABASE_URL`, takes `pg_advisory_lock(72843113001)`, applies files in sorted order, and records the SHA-256 checksum; it refuses an applied file whose checksum changed. The migration test proves two concurrent runners and a repeat run are safe **through the runner**.
- **Remediation:** Treat the runner as the only supported path; document it in the deploy checklist. Do not edit an applied file. If manual application is a required runbook step, add an explicit ledger reconciliation procedure rather than scattering `IF NOT EXISTS` through constraints.
- **Status:** Documented; no code change.

#### L-3 — No database constraint requires at least one active primary wallet

- **Severity:** Low.
- **Location:** `migrations/identity/001_identity_schema.sql` (`wallets_one_active_primary_uq`), `lib/identity/service.ts` (`link_wallet`, `revoke_wallet`).
- **Scenario:** The partial unique index enforces **at most one** primary wallet per user. Nothing enforces **at least one**. `link_wallet` inserts `is_primary = false`; the first-wallet/account-bootstrap path is not implemented (closed signup). A manually seeded user plus a link can therefore have zero primary wallets.
- **Impact:** Ambiguous UX and future code that assumes a primary wallet exists. Login and session resolution do not depend on `is_primary`, so this is not an auth bypass.
- **Evidence:** The schema has only the unique partial index; the new integration test proves the application-style revoke/promote sequence leaves exactly one during a normal flow, but no schema object rejects a zero-primary state.
- **Remediation:** Add a deferred constraint trigger (or enforce in the approved account-bootstrap transaction) so a committed user has exactly one active primary wallet. This is hard to express as a plain CHECK; do not fake it with an application-only convention if the invariant matters.
- **Status:** Open; document the invariant for any manual provisioning.

#### L-4 — Logout did not clear cookies for an already-expired session

- **Severity:** Low.
- **Location:** `app/api/identity/logout/route.ts` (fixed).
- **Scenario:** `requireSession()` throws `IDENTITY_SESSION_REQUIRED` when the session is expired, so the original handler returned 401 and left the stale `__Host-aero_session` / `__Host-aero_csrf` cookies in the browser. A subsequent request still carried them until expiry/overwrite.
- **Impact:** Confusing stale state; the cookies were already unusable server-side. No privilege gain.
- **Evidence:** The route now treats `IDENTITY_SESSION_REQUIRED` as an idempotent logout: it clears both cookies and returns `{ ok: true }`, while origin/CSRF failures still return their own errors.
- **Remediation:** Applied.
- **Status:** Fixed.

#### L-5 — Identity responses lacked explicit `Cache-Control: no-store`

- **Severity:** Low.
- **Location:** `lib/identity/http.ts` (`identityJson`, fixed), all seven `app/api/identity/*` routes.
- **Scenario:** `GET /api/identity/session` returns account and wallet data for a cookie-authenticated request. Without an explicit cache directive, a browser or intermediary could in principle retain a response beyond the session.
- **Impact:** Potential stale-account disclosure on a shared device or through a caching intermediary. Same-origin fetch and typical browser behavior reduce the likelihood, but the header should be explicit for a sensitive endpoint.
- **Evidence:** `identityJson()` now sets `cache-control: no-store` on success, error, and session responses; all identity routes were converted from `NextResponse.json` to `identityJson`.
- **Remediation:** Applied.
- **Status:** Fixed.

#### L-6 — Missing schema/connection failures surfaced as generic 400

- **Severity:** Low.
- **Location:** `lib/identity/security.ts` `errorCode()` (fixed), `identityError()`.
- **Scenario:** A missing `identity` schema/table (`42P01`/`3F000`), connection failure (`08*`), too many connections (`53300`), or shutdown (`57P03`) fell through to `IDENTITY_REQUEST_FAILED` and HTTP 400, making an operational outage look like a malformed client request.
- **Impact:** Misleading client behavior and slower incident diagnosis; no security weakness.
- **Evidence:** `errorCode` now maps those SQLSTATEs to `IDENTITY_DATABASE_UNAVAILABLE`; `securityFailureStatus` maps it to 503. Unique/foreign-key/check violations still map to `IDENTITY_CONFLICT` (409).
- **Remediation:** Applied.
- **Status:** Fixed.

#### L-7 — `.env.example` inaccurately described `AERO_SESSION_SECRET`

- **Severity:** Low.
- **Location:** `.env.example` (fixed).
- **Scenario:** The comment said the secret “hashes session tokens and rate-limit keys.” In the implementation the secret keys only the HMAC rate-limit digest (`rateLimitDigest`); session tokens are hashed with unkeyed SHA-256, and CSRF tokens likewise.
- **Impact:** A false sense of a peppered session-token store; no practical weakness with 256-bit random tokens, but the documentation should not overstate the design.
- **Evidence:** `lib/identity/security.ts` `rateLimitDigest` uses `AERO_SESSION_SECRET`; token storage uses `sha256` in `primitives.mjs`/`security.ts`. The example now says the secret keys rate-limit digests and that tokens are stored only as SHA-256 hashes.
- **Remediation:** Applied.
- **Status:** Fixed.

### 2.4 Informational

#### I-1 — Protocol doc contradicts itself on rollback of a consumed challenge

- **Location:** `AERO_WALLET_VERIFICATION_PROTOCOL.md` §4.
- **Observation:** One sentence says “A consumed challenge remains unusable even if session creation fails”; the next says “A failed DB transaction rolls back consumption and all account/link writes together.” The implementation follows the second sentence: `consumeChallenge` runs inside `withIdentityTransaction`, and the integration test proves a forced failure leaves the challenge unconsumed.
- **Impact:** Documentation inconsistency only. The signature is bearer material; an attacker who has it can submit it first, so rollback-on-failure does not add a practical replay path. The atomic behavior is safer for partial-state prevention.
- **Remediation:** Reconcile the protocol text to the atomic-rollback behavior (or explicitly distinguish “successful HTTP response” from “committed transaction”).
- **Status:** Documentation note.

#### I-2 — `AERO_AUTH_ORIGIN` permits localhost over HTTP

- **Location:** `lib/identity/security.ts` `configuredOrigin()`.
- **Observation:** `http://localhost`, `*.localhost`, and `127.0.0.1` are allowed for development. In a production build, a misconfigured localhost origin would produce a SIWE domain of localhost and `__Host-` cookies that the real site cannot use. It fails closed rather than opening access.
- **Impact:** Misconfiguration/availability risk, not an authorization bypass.
- **Remediation:** Add a production-only `https:` requirement (for example, when `NODE_ENV === "production"` and the release label is not local), or a startup check that rejects localhost in deployed environments.
- **Status:** Accepted for testnet; consider before deployment.

#### I-3 — `create_account` is in the DB purpose constraint but unreachable from the API

- **Location:** `migrations/identity/001_identity_schema.sql`, `app/api/identity/challenge/route.ts`.
- **Observation:** The route explicitly rejects `purpose === "create_account"` with `IDENTITY_SIGNUP_CLOSED`; there is no account-bootstrap service path or route. The DB constraint is intentionally future-proof.
- **Impact:** None today; closed signup is enforced. Keep the purpose unreachable until the enrollment decision and account-creation transaction are approved.
- **Remediation:** When signup is approved, implement the atomic user/first-wallet/audit/session bootstrap and tests; do not unlock the route alone.
- **Status:** Correctly gated.

#### I-4 — Login challenges for arbitrary addresses are intentional

- **Location:** `lib/identity/service.ts` `createWalletChallenge`.
- **Observation:** Anyone can request a login challenge for any EVM address; the message uses the configured Aero domain and a purpose statement. This is deliberate anti-enumeration: the response does not reveal whether an account exists.
- **Impact:** It enables the M-2 abuse volume, and the issued message could be shown to a user as a phishing lure. The statement says the signature authorizes no transfer, and the message is only useful at Aero's origin, which limits the risk.
- **Remediation:** Pair with M-2 rate limits; consider a statement that explicitly names the requesting origin/session and the closed-signup status.
- **Status:** Accepted; monitor.

#### I-5 — Fuji RPC failure does not consume an attempt

- **Location:** `app/api/identity/verify/route.ts`.
- **Observation:** `fujiAddressIsEoa()` throws before the attempt counter is incremented. If the RPC is down, a valid challenge remains usable until its five-minute expiry, and no attempt budget is spent.
- **Impact:** Fail-closed (no authentication) and a retry window, not a bypass. It can add load to a failing RPC because each retry repeats the check.
- **Remediation:** Treat RPC unavailability as a distinct 503 (already the case via `IDENTITY_FUJI_RPC_UNCONFIGURED` only for missing configuration; transport errors currently map to a generic failure). Optionally bound RPC concurrency and add a circuit breaker.
- **Status:** Informational.

#### I-6 — No suspension/closure route; staff identity is unapproved

- **Location:** `lib/identity/service.ts` `suspendIdentityUser()` and `requestAccountClosure()`.
- **Observation:** `suspendIdentityUser` has no caller; `requestAccountClosure` always throws. There is no admin identity route. This matches D-13 (staff model proposed, not approved) and D-12 (deletion gated).
- **Impact:** No in-product suspension/closure, which is acceptable for closed signup but must be designed before support operations.
- **Remediation:** Keep staff identity separate from consumer SIWE; implement per-action audit and least privilege when D-13 is approved.
- **Status:** Intentional gap.

#### I-7 — Login existence timing differs even though responses are generic

- **Location:** `lib/identity/service.ts` login branch in `consumeChallenge`.
- **Observation:** An existing active wallet performs an extra `UPDATE wallets`, `issueSession`, and audit insert; an unavailable address writes only `auth.login_denied`. The public response stays generic, but timing can differ.
- **Impact:** Low-bandwidth account-existence oracle, mitigated by per-address challenge limits and the closed population.
- **Remediation:** If enumeration resistance becomes a hard requirement, equalize the work or add jitter; do not reveal a different status code.
- **Status:** Informational.

---

## 3. SIWE verification assessment

**Verified by source and unit tests:**

- The message is built from server-held fields: `domain = configuredOrigin().host`, `uri = origin + /api/identity/verify`, `chainId = 43113`, a 32-byte random nonce (hex), `issuedAt`, `expiresAt` (five minutes), `requestId` = challenge UUID, and a purpose-specific statement (`lib/identity/primitives.mjs`).
- The parser is strict and canonical: exact field order, single-line statement, version `1`, no unknown fields, no duplicate fields, and no extra lines. The test “does not accept multiline statements or duplicate/unknown message fields” passes.
- Verification compares parsed domain, address, URI, chain, nonce, issued/expiry, statement, and the stored message hash. The test “rejects altered SIWE fields, extra fields, and a replayed nonce” passes.
- Expiry and future-issued checks are enforced; the test “expires messages and rejects future-issued messages” passes.
- EIP-191 `verifyMessage` from viem accepts only the expected signer; the test “EIP-191 signature accepts its signer and rejects a different signer” passes.
- Deployed-code addresses are rejected by `fujiAddressIsEoa()` before signature verification, and the DB constraint requires `wallet_kind = 'eoa'` / `chain_id IS NULL` for EOA rows.
- The challenge row stores `nonce_hash` and `message_hash`, not the signature or plaintext nonce (`challenge hash is one-way` test passes).
- Replay is controlled by `consumed_at` under `SELECT ... FOR UPDATE`, not by signature bytes.

**Limits of this audit:**

- The live Fuji RPC EOA check was not exercised against a real provider; only the code path and the DB constraint were reviewed.
- No browser wallet signed a real challenge through the Next runtime. The unit tests sign with viem against a known key and exercise the parser/hash/verifier.
- The strict parser intentionally rejects SIWE variants outside the canonical Aero form (for example `Not Before`, `Resources`). That is a compatibility choice, not a vulnerability.

---

## 4. Transactional integrity assessment

**Design:** Each state-changing identity operation runs in `withIdentityTransaction`:

- challenge issuance: rate-limit advisory lock, count, insert challenge, audit append;
- consumption: row-lock the challenge, mark consumed, then (for login) update the wallet and insert the session/audit, or (for link/revoke/reauthenticate) lock the user, lock the session, lock/verify wallets, write the change, and append audit;
- session rotation/revocation/touch: update under predicates and append audit.

**Verified on real PostgreSQL:**

- A forced failure after user/wallet/session/audit writes leaves none of those rows behind (rollback test).
- Two concurrent submissions of the same challenge commit exactly one session-side effect; the loser sees `IDENTITY_CHALLENGE_INVALID` (concurrency test).
- Two different users racing to link the same address are decided by `wallets_active_eoa_address_uq`; exactly one commits (race test).
- Session creation, rotation, revocation, and expiry match the resolver predicates (session test).
- Primary-wallet invariants survive a revoke/promote sequence (test).
- Cross-user composite foreign keys reject mixed ownership (test).

**Residual reasoning (not executed as TypeScript):**

- The tests execute the SQL predicates that the service uses, not the TypeScript service functions themselves. The service module has Next path aliases and is not directly importable by the Node test runner without a build step; this is stated in the test file.
- Revocation of two wallets concurrently is serialized by `SELECT ... FOR UPDATE` on the user row and on the wallet set; the last-wallet count and primary promotion then see a consistent state. This was reasoned from the SQL, not run as a separate TypeScript concurrency test.
- `switch_primary` and `link_wallet` also lock the user row; the unique indexes are the final backstop.
- Isolation is READ COMMITTED with explicit row locks and unique indexes; no lost-update or write-skew path was found for the reviewed invariants.

---

## 5. Wallet lifecycle assessment

- **Global ownership:** At most one active verified EOA per `(namespace, address_normalized)`; revoked wallets do not block relinking; the partial index is the race decider (verified).
- **Login:** Resolves exactly one active verified EOA and an `active` user; a suspended/deleted user or revoked wallet gets no session (query verified; DB semantics tested via resolver predicates).
- **Link:** Requires a valid session, a recent reauthentication (≤5 minutes) with an active linked wallet recorded in `sessions.reauthenticated_wallet_id`, and a signature from the new wallet. The freshness check is repeated inside the consuming transaction (source review). The new wallet is inserted as verified, non-primary, chain-agnostic EOA; the unique index decides a cross-account race (verified).
- **Revoke:** Requires a signature from a linked wallet (`target = initiating`); the subject must be linked; the last active wallet cannot be revoked; revoking the primary promotes another active wallet; sessions authenticated by the revoked wallet or carrying it as the reauthentication wallet are revoked; the current session cookie is cleared when applicable (source review; primary/revoke constraints tested).
- **Reauthenticate:** Requires a signature from an active linked wallet and updates `reauthenticated_at`/`reauthenticated_wallet_id`; it does not rotate the session token (the separate rotate route does).
- **Primary:** At most one active primary per user by unique index; switch and promotion are single-transaction updates. There is no schema requirement for at least one (L-3).
- **UI:** The two-step link flow is repaired, but the manual two-wallet E2E remains outstanding (M-5).

No path was found for a wallet to become linked without both proofs, or for a revoked wallet to keep an existing session alive.

---

## 6. Session and authorization assessment

- **Token strength:** 32 random bytes, base64url (43 characters); only SHA-256 hashes are stored. The entropy/cookie-attribute tests pass.
- **Cookies:** `__Host-aero_session` and `__Host-aero_csrf`; `Secure`, `Path=/`, no `Domain`, `SameSite=Strict`; session `HttpOnly`, CSRF readable by the same-origin app. The cookie test passes.
- **Expiry:** Idle default 12 hours, absolute default 7 days; the resolver, touch, rotate, and consume paths all require `idle_expires_at > now()` and `absolute_expires_at > now()`. Session policy validation enforces 60 seconds minimum, absolute ≥ idle, and ≤30 days.
- **Rotation:** Updates the token hash under the old hash predicate; a concurrent old-token request gets `IDENTITY_SESSION_REQUIRED`; the new cookie is set only after success.
- **Revocation:** Immediate server-side; `logout-others` revokes the rest and audits the count; revoking a wallet invalidates sessions bound to it.
- **Reauthentication:** Stored on the session row, bound to a wallet id that must still be active/verified at use time; linking rejects a stale or mismatched proof even if the challenge was issued earlier.
- **Origin/CSRF:** Every identity mutation calls `assertTrustedOrigin` (exact origin match, plus same-origin `Sec-Fetch-Site` when present). Authenticated mutations also require a CSRF header equal to the CSRF cookie and a hash matching the session row. Login verification is origin-checked but unauthenticated by design.
- **GET safety:** `GET /api/identity/session` is read-only; no state-changing GET routes exist.
- **No transaction authority:** The identity session is never used to sign or submit a chain transaction; the signed SIWE statement says so, and no such code path exists in `app/api/identity`.
- **Error handling:** Public responses are generic; logs are stable codes without tokens, signatures, or addresses. `identityError` returns a stable category and status.

The main authorization gap is abuse resistance (M-2), not a missing predicate.

---

## 7. Migration and database assessment

- **Additive:** `001` creates schema/tables/indexes/constraints/triggers; no `DROP TABLE`, `DROP SCHEMA`, or `DELETE FROM public.waitlist`. The waitlist was seeded with three rows and remained at three after both the migration test and the integration suite.
- **Runner:** Requires `DATABASE_URL`; takes `pg_advisory_lock(72843113001)`; applies files in sorted order in a transaction per file; records `migration_id` + `checksum_sha256`; refuses changed checksums and blocks for a concurrent runner. Two concurrent runner processes and a repeat run were tested successfully.
- **Ledger evidence:** `001_identity_schema.sql` (`1bfb7b8c…fc31`) and `002_identity_audit_truncate_guard.sql` (`94fc4dda…f4a2`) are recorded; a repeat run is a checksum-verified no-op.
- **Constraints exercised:** challenge purpose/operation/chain/wallet-kind; attempt range 0–5; consumed/invalidated exclusivity; session idle ≤ absolute; composite foreign keys; active EOA uniqueness; one-primary uniqueness; cross-user rejection.
- **Audit:** `identity_audit_append_only` (`BEFORE UPDATE OR DELETE`, row) and `identity_audit_no_truncate` (`BEFORE TRUNCATE`, statement) are enabled. `UPDATE`, `DELETE`, and `TRUNCATE` are rejected in the integration test.
- **Runtime privilege:** Not separated from the migration role; see M-1.
- **Idempotency:** Runner-ledger idempotency is verified; the SQL files themselves are not self-idempotent (L-2).

No migration was applied to Neon. The integration suite used a disposable database only.

---

## 8. Retention and operational safety

- D-12 remains **unresolved**. No retention interval is approved, and none was added.
- Purge and hard deletion are gated: `approvedIdentityRetentionDays()` requires an explicit env opt-in plus a valid day count; `assertIdentityPurgeEnabled()` throws otherwise; `requestAccountClosure()` throws; no purge job is registered.
- Expired challenges cannot be consumed: `consumeChallenge` checks `expires_at` under the row lock, and `matchesStoredChallenge` rejects expired/future-issued messages.
- Audit rows cannot be silently deleted through DML or `TRUNCATE`; the remaining path is a privileged DDL/disable operation (M-1).
- Public signup is closed: the route rejects `create_account`, and no account-bootstrap path exists. The identity tables remain empty unless an approved enrollment flow is added.
- Accumulation is real and expected: every challenge issuance writes a challenge row and an audit event; sessions and audit rows have no cleanup. The operational plan must include monitoring, a cost/connection budget, and an approved purge design before broad enablement. D-12 names this risk explicitly.

Current local configuration (`.env.local`) contains `DATABASE_URL` but not `AERO_AUTH_ORIGIN`, `AERO_FUJI_RPC_URL`, or `AERO_SESSION_SECRET`; the identity endpoints therefore fail closed in that environment. That live database was not read or modified.

---

## 9. Verification evidence

### 9.1 Real PostgreSQL integration

A disposable PostgreSQL 16.14 instance was run in WSL Ubuntu (`127.0.0.1:55432`, database `aero_m1b_test`). Because the application uses `@neondatabase/serverless` over WebSocket to Neon's proxy, a local WebSocket-to-TCP bridge plus a Node `--import` configuration patch let the **actual driver and the actual migration runner** run unmodified. The harness lived in an untracked `.audit-tmp/` directory and was removed after the audit; it is not part of the deliverable.

The first-ever execution of the previously skipped migration test failed with:

```text
ROLLBACK TO SAVEPOINT can only be used in transaction blocks
```

Root cause: `pool.query()` can hand each statement a different pooled connection, so the `BEGIN`/`SAVEPOINT`/`ROLLBACK` sequence was not guaranteed to stay on one backend. The test was fixed to pin a `pool.connect()` client; it now passes. This is evidence that the integration path is genuinely executing, and that the skipped test had a real defect rather than being a formality.

**Final run (disposable DB):**

```text
tests 23
pass 23
fail 0
skipped 0
```

The nine nested integration cases are:

1. repeat migration is a checksum-verified no-op;
2. failed identity work rolls back users, wallets, sessions, and audit rows together;
3. concurrent consumption commits exactly one session-side effect;
4. concurrent same-address linking is decided by the active-wallet unique index;
5. session creation, rotation, revocation, and expiry follow the resolver predicates;
6. primary-wallet invariants survive revocation and promotion;
7. cross-user foreign keys reject mixed ownership;
8. challenge purpose, chain, and wallet-kind constraints;
9. audit rows reject `UPDATE`, `DELETE`, and `TRUNCATE`.

Without a disposable database, the integration tests skip by design; the DB-backed run above is the evidence used in this verdict.

### 9.2 Release gates

```text
tests 10
pass 10
fail 0
```

Production and beta remain blocked; the production allowlist is empty; the Fuji/testnet classification is required.

### 9.3 TypeScript, lint, and diff

- `npx tsc --noEmit --incremental false`: pass.
- `npx eslint app/api/identity lib/identity components/testnet/identity-control.tsx tests/identity`: clean.
- `git diff --check`: no whitespace errors; only Git's LF→CRLF notices.
- No commit and no push.

### 9.4 Fuji production build

```text
Aero testnet release configuration accepted.
✓ Compiled successfully in 43s
Finished TypeScript in 34.7s
✓ Generating static pages (26/26)
```

All seven identity routes were emitted as dynamic routes: `challenge`, `verify`, `session`, `touch`, `rotate`, `logout`, `logout-others`. The build also emitted pre-existing warnings unrelated to identity (`middleware` convention deprecation; `metadataBase` not set). They do not change the verdict.

### 9.5 Database post-run evidence

```text
waitlist_rows = 3
001_identity_schema.sql               | 1bfb7b8c…fc31
002_identity_audit_truncate_guard.sql | 94fc4dda…f4a2
identity_audit_append_only   | tgtype 27 | enabled
identity_audit_no_truncate   | tgtype 34 | enabled
```

The waitlist row count was three before and after the migration and integration runs.

---

## 10. Remediations applied during this audit

1. **`migrations/identity/002_identity_audit_truncate_guard.sql`** — new statement-level `BEFORE TRUNCATE` guard, reusing `identity.reject_audit_mutation()`. Kept as a separate migration so the checksum of the already-applied `001` does not change.
2. **`tests/identity/migration.test.mjs`** — pinned a dedicated client for `BEGIN`/`SAVEPOINT`/`ROLLBACK`; added static coverage for `002`.
3. **`tests/identity/postgres.integration.test.mjs`** — new real-Postgres suite for ledger/repeat, rollback, concurrency, sessions, primary invariants, cross-user foreign keys, challenge constraints, and audit immutability including `TRUNCATE`.
4. **`components/testnet/identity-control.tsx`** — made the link flow a real two-step operation; the connected wallet is the only proof wallet when linked; signer-must-be-connected guard; proof wallet persisted across an account switch; unreachable success notice moved before `return`; removed render-time `Date.now()`; added a 5-minute proof hint.
5. **`app/api/identity/*`** — all responses use `identityJson` (`Cache-Control: no-store`); `session` returns `reauthenticatedWalletId`; `logout` is idempotent and clears stale cookies on `IDENTITY_SESSION_REQUIRED`.
6. **`lib/identity/http.ts`** — added `identityJson`.
7. **`lib/identity/security.ts`** — mapped connection/shutdown/missing-schema SQLSTATEs to `IDENTITY_DATABASE_UNAVAILABLE` (503), retaining conflict mapping for `23505`/`23503`/`23514`.
8. **`.env.example`** — corrected the `AERO_SESSION_SECRET` description.

No server-side authorization check was removed or weakened. No retention interval was added. No production database was touched.

---

## 11. Verified versus assumed

**Verified by execution:**

- Additive migration and repeat-run checksum behavior through the real runner; concurrent runners; waitlist preservation.
- All listed schema constraints and composite foreign keys.
- Transactional rollback of user/wallet/session/audit writes.
- Exactly-one-winner concurrent challenge consumption (SQL-level mirror of the service predicates).
- Exactly-one-winner same-address linking, decided by the unique index.
- Session resolver predicates, rotation, revocation, expiry.
- Audit rejection of `UPDATE`, `DELETE`, and `TRUNCATE`.
- TypeScript, scoped ESLint, release gates, Fuji build, `git diff --check`.

**Verified by source inspection only:**

- The TypeScript service functions themselves (challenge issuance, consumption, link/revoke/primary, session issuance/rotation) and the route wiring.
- SIWE message construction/canonical parsing and viem verifier behavior, supported by unit tests but not by a live browser/RPC.
- Origin/CSRF/cookie behavior in the Next runtime.
- Concurrency reasoning for two simultaneous wallet revocations and `switch_primary` (row locks; no separate TS concurrency test).

**Not verified / skipped:**

- Live Fuji RPC `getBytecode` against the configured provider.
- Full browser E2E with a real wallet provider, including the repaired two-wallet link flow.
- Hosted Neon transport and the actual Neon proxy (the driver was real; the network path was a local bridge).
- Applying the migration to Neon or any non-disposable database.
- Service-layer TypeScript execution against the disposable database.
- Load/rate-limit behavior under real traffic; no IP limit exists to test (M-2).

---

## 12. Conditions for the verdict

The verdict is **CONDITIONAL PASS** on the following conditions. They are pre-activation/operational conditions, not evidence of a broken authentication check.

1. **Retention decision (D-12):** Approve a field-level policy, or explicitly accept gated accumulation with monitoring, alerting, and a documented manual cleanup procedure. Do not enable purge/hard delete before approval; when approved, implement it with a privileged role and audited deletions.
2. **Abuse resistance (M-2):** Put a per-IP/edge rate limit in front of `/api/identity/*`, add a distributed limiter keyed by IP plus wallet, and monitor challenge/audit growth and Neon connections. The protocol doc already requires IP limiting.
3. **Connection architecture (M-4):** Replace per-request `Pool` creation/`pool.end()` with a bounded shared pool in the target Node runtime (or document an approved connection proxy). Load-test the login path.
4. **Database least privilege (M-1):** Run the application as a role that cannot `TRUNCATE`, `ALTER`, `DROP`, or disable triggers on `identity.*`; keep DDL in a separate migration role. If a single role is retained, record the residual risk.
5. **Wallet E2E (M-5):** Manually verify with two Fuji EOAs: reauthenticate with A, switch to B, link B, switch primary, revoke A, confirm A's sessions are invalidated and B can still sign in. Also verify logout, logout-others, rotation, idle expiry, origin rejection, and CSRF rejection in a browser.
6. **Live RPC:** Verify `AERO_FUJI_RPC_URL` against the intended provider and confirm a deployed-code address is rejected while an EOA is accepted.
7. **Migration sequencing:** Back up, use a maintenance window, run `npm run migrate:identity` with the migration role, confirm the ledger and both audit triggers, and keep signup closed. Do not apply `001`/`002` manually outside the runner without recording them.
8. **Configuration:** Set `AERO_AUTH_ORIGIN` (exact HTTPS origin), `AERO_FUJI_RPC_URL`, and a ≥32-byte random `AERO_SESSION_SECRET`; confirm `__Host-` cookies work over HTTPS. The current `.env.local` lacks these, so identity fails closed there.
9. **Before public signup (out of M1B scope):** Implement the approved account-creation flow and its abuse controls; do not unlock `create_account` alone.

---

## 13. Verdict

**CONDITIONAL PASS**

No Critical or High severity defect was found in the reviewed M1B identity implementation. The SIWE binding, challenge consumption, wallet uniqueness, session predicates, and transactional writes held under the real-Postgres concurrency and rollback tests. The remaining Medium items are operational/defense-in-depth (rate limiting, connection pooling, audit privilege separation, retention, and browser E2E), and the Low items found during review were either fixed or documented.

The implementation is **not** approved for public signup, beta, or production. It is suitable for continued controlled Fuji integration only after the conditions in §12 are tracked and the two-wallet browser E2E is completed.

---

## 14. Post-remediation closure update (2026-10-22)

This section is the final disposition. The original findings and evidence above are retained as the audit snapshot; where they say an item is open or untested, this section controls.

### 14.1 Final verdict

**CONDITIONAL PASS.** No Critical or High severity authorization bypass is known. The remaining items are operational, policy, or verification items. M1B may close for controlled Fuji integration, but not as a full PASS and not for public signup, beta, production, or broad identity enablement.

### 14.2 Disposition table

| Item | Disposition | Evidence / remaining action |
|---|---|---|
| M-1 audit-truncate and privilege separation | **Closed in code/test; Operationally pending** | `002` rejects `TRUNCATE`; `scripts/provision-identity-roles.mjs` provisions a runtime role with no DDL/`DELETE`/`TRUNCATE`/`TRIGGER`/ownership, no direct limiter-table access, and `INSERT`-only audit. Disposable-Postgres privilege checks pass. Neon/production role creation is not applied. |
| M-2 challenge/session abuse limits | **Closed in code/test; Operationally pending** | Challenge IP/global/user, verify IP/global, and cookie-session IP/global limits are enforced before service work. Forwarded headers are ignored unless an explicit trusted proxy is configured; unattributed requests share one bucket; random wallet addresses cannot escape IP/global limits. Limiter/database failure maps to 503. Monitor/tune after traffic. |
| M-3 retention/purge (D-12) | **Blocked by unresolved policy** | No interval, purge, hard delete, or enabled account closure. Challenges, sessions, limiter buckets, and audit rows can accumulate. Do not enable broad identity use before D-12 or an explicitly accepted gated-accumulation procedure. |
| M-4 per-request pool churn | **Closed in code/test; Not verified under load** | Module-scoped bounded pool, client release, broken-connection destruction, stats, and explicit close/reset. Transaction/read boundaries preserved. No production-representative load test. |
| M-5 multi-wallet link UI | **Code fixed; Not verified in browser** | Server-side two-wallet HTTP flow passed. No browser wallet/provider or funded Fuji test EOAs were available, so provider switching/signing prompts and the shipped UI remain unverified. |
| L-1 failed-attempt audit | **Open/accepted** | Failures increment bounded attempt counters but add no audit event. Accepted for closed signup; revisit with D-12 because audit growth is a trade-off. |
| L-2 manual migration application | **Operationally pending** | The runner ledger makes repeat runs safe, but manual `psql` application can desynchronize the ledger. Operators must use the runner and reconcile any manual emergency change. |
| L-3 no DB-enforced active primary | **Open/accepted** | The service enforces the invariant; no database constraint requires at least one active primary. Covered by service/integration tests, not a DB-level guarantee. |
| L-4 logout stale cookies | **Closed** | Logout is idempotent and clears stale cookies on an already-expired session. |
| L-5 cache headers | **Closed** | Identity responses use `identityJson` with `Cache-Control: no-store`. |
| L-6 generic 400 on DB/schema failure | **Closed** | Connection/shutdown/missing-schema/privilege SQLSTATEs map to 503 `IDENTITY_DATABASE_UNAVAILABLE`; conflicts remain 4xx. |
| L-7 `.env.example` wording | **Closed** | Corrected and expanded for runtime/migration role separation. |
| I-1 protocol rollback wording | **Open/documented** | The protocol document's rollback language remains a documentation inconsistency; the implementation uses transaction rollback and requires a fresh challenge. No code bypass. |
| I-2 localhost HTTP origin | **Open/accepted for local development** | Production configuration must use an exact HTTPS origin; localhost HTTP must not be treated as a production setting. |
| I-3 unreachable `create_account` purpose | **Closed by design** | The DB purpose remains reserved, but no issuance/verification route exists. Signup stays closed (D-24). |
| I-4 arbitrary-address login challenges | **Closed by design + limits** | Arbitrary addresses still receive generic login challenges, but IP/global budgets now bind and random addresses cannot escape them. |
| I-5 RPC failure does not consume an attempt | **Open/accepted** | A valid signature is required before the RPC check; RPC failure returns 503 and does not prove EOA. Revisit attempt accounting if RPC instability becomes material. |
| I-6 no suspension/closure route | **Blocked by policy** | Account closure remains gated on D-12; staff identity/suspension tooling remains unapproved (D-13). No unsafe route was added. |
| I-7 login timing differs | **Open/accepted** | Responses remain generic and rate-limited; timing is not treated as an authorization control. Revisit with monitoring if enumeration risk becomes material. |

### 14.3 Conditions status

| §12 condition | Status |
|---|---|
| 1. D-12 retention decision | **Blocked by unresolved policy.** No retention interval or purge was enabled. |
| 2. Abuse resistance (M-2) | **Closed in code/test; monitoring/tuning pending.** DB-backed layered limits and trusted-proxy handling are implemented. |
| 3. Connection architecture (M-4) | **Closed in code/test; load verification pending.** |
| 4. Database least privilege (M-1) | **Closed in code/test; Neon/production provisioning pending.** |
| 5. Wallet E2E (M-5) | **Not verified.** Server-side HTTP flow passed; browser E2E was not run. |
| 6. Live RPC | **Closed.** Live Fuji tests cover contract/EOA, wrong chain, malformed response, and unavailable RPC. |
| 7. Migration sequencing | **Operationally pending.** Verified on disposable PostgreSQL; not applied to Neon/production. |
| 8. Configuration | **Operationally pending.** Runtime/migration URLs, exact origin, Fuji RPC, session secret, trusted proxy, and pool size are documented; no production values were set. |
| 9. Public signup | **Out of M1B scope and still closed.** No account bootstrap was added. |

### 14.4 Verification evidence

- Identity suite with disposable PostgreSQL 16.14 and live Fuji RPC: **40 passed, 0 failed, 0 skipped**.
- Focused rate-limit/RPC suite: **12 passed**, including live Fuji contract/EOA and fail-closed RPC cases.
- Release gates: **10 passed**.
- TypeScript: passed.
- Scoped identity ESLint: passed.
- Fuji testnet production build: passed.
- Server-side two-wallet HTTP flow with disposable runtime role: passed.
- `git diff --check`: clean (CRLF notices only).
- Contract tests after the separate Fuji preflight build-profile fix: **67 passed**.

### 14.5 No-production-action statement

No Neon/production migration, role creation, public signup, real account creation, production configuration change, deployment, broadcast, funding, trusted-manifest population, DNS/hosting change, commit, push, or production credential/private-key use was performed by this closure. The two-wallet evidence is HTTP-level, not browser-level. The Fuji deployment preflight is a simulation only; see `AERO_FUJI_YIELD_PREFLIGHT_REPORT.md`.
