# Aero Identity Architecture — Milestone 1A

**Status:** proposed architecture; no product decision is approved by this document.

**Date:** 2026-10-21
**Scope:** identity, wallet ownership, schema, sessions, username authority, recovery, and staff boundary. This is a design only. It adds no authentication, API, schema, migration, configuration, contract, or money movement.

**M1B addendum (2026-10-22):** The product owner approved the Fuji-only EOA SIWE, multi-wallet model, no-assisted-recovery boundary, server-side session controls, and AeroNames authority for M1B. Fuji signup remains closed. Retention duration remains unresolved; purge and hard deletion are gated. Implementation details and limits are recorded in `AERO_M1B_IMPLEMENTATION_REPORT.md`.

## Executive recommendation

Adopt **one internal Aero account linked to one or more independently verified wallets** (alternative C), subject to explicit product-owner and security approval. Use a stable opaque internal user ID for Aero account relationships. Wallet addresses remain externally controlled credentials and transaction principals; connecting a wallet to the browser is not enough to authenticate an Aero account or prove ownership for account linking.

Use a standard SIWE message (ERC-4361) signed with EIP-191 `personal_sign` for the initial EVM challenge flow. Bind each challenge to an exact server-configured origin, a supported EVM chain ID, a random one-time nonce, purpose, target address, issued/expiry times, and user/session context. Verify and consume it server-side in one database transaction before issuing a session. Keep account authentication separate from transaction signing: a session must never authorize a transfer or substitute for the wallet's transaction signature.

Treat each deployed AeroNames instance as the canonical authority for handles **on its own chain and contract address**. Any backend copy is a derived, reorg-aware index. Do not create app-level handle reservations in the identity schema. AeroNames is currently only the Fuji sandbox registry; product-owner approval is still required before selecting any production naming policy.

**Owner approval remains required** for the account model, multiple wallets, username policy, recovery behavior, supported signing wallet types/chains, session durations, data retention, and staff access. The decision register marks proposals as proposed, never approved.

## Repository inspection: what exists

| Area | Observed implementation | What it means for identity |
|---|---|---|
| Application routes | Next.js App Router pages under `app/`; `/testnet` hosts the wallet sandbox; API routes are waitlist and admin operations. | No consumer auth endpoints, account pages, or financial API authorization layer exists. |
| Wallet providers | `components/testnet/providers.tsx` configures Reown AppKit + Wagmi for Avalanche Fuji only. `useAccount` exposes the connected address; chain switching is testnet-specific. | A wallet connector session is client state. It does not create an Aero user, prove a link to an existing Aero user, or establish server authorization. |
| Address persistence | `app/testnet/page.tsx` stores the last connected address in browser `localStorage`; `components/testnet/shell.tsx` reads it for a welcome display and resolves its handle. Other UI state/activity is also browser-local. | This is a convenience hint, not an authenticated session or authoritative identity record. Browser storage is user-editable and same-origin script-readable. |
| On-chain identity | `contracts/src/AeroNames.sol` has `_owners[nameHash]`, `_names[address]`, and `_spellings[nameHash]`; `register`, `release`, `resolveAddress`, and `resolveUsername` are public. | Fuji handle ownership is by address in the contract, not by an internal Aero account. There is no transfer, expiry, admin recovery, or grace period. |
| API / persistence | `app/api/waitlist/*` and `app/api/admin/*` are the only application API routes found. `lib/db.ts` lazily connects to Neon if `DATABASE_URL` exists; otherwise waitlist flows use JSONL fallback. No DDL/migration/schema file was found. | The `waitlist` table is assumed by SQL, but its schema and constraints are absent from the repository. There are no `users`, `wallets`, challenges, sessions, financial records, or identity migrations. |
| Waitlist identity | Waitlist rows contain email and a requested username, referral code, and confirmation fields. Confirmation token uses `WAITLIST_SECRET` or a development fallback. | Waitlist signup/email confirmation is not consumer account authentication, wallet verification, or username reservation. |
| Existing admin auth | `lib/admin-auth.ts` derives the `aero_admin` cookie deterministically from the shared `ADMIN_PASSWORD`; cookie is HTTP-only and SameSite=Lax, Secure in production, and has a browser max-age in the login route. API routes check the cookie; login throttle is in-memory. There is no server-side session, per-person identity, role model, immediate revocation, or audit log. | Keep this separate from a future consumer identity system; do not reuse it as its session design or extend it to consumer data. |
| Release configuration | `lib/release-gates.mjs` blocks beta and production with an empty production allowlist; Fuji is chain `43113`. | Current release policy cannot establish a production auth origin, supported auth chain, database, or consumer auth provider. Those remain pre-implementation decisions. |

No wallet challenge/signature authentication currently exists. No schema migrations are created in this milestone.

## Identity alternatives

| Criterion | A. Wallet-only identity | B. One account, one wallet | C. One account, multiple verified wallets |
|---|---|---|---|
| Security | Fewest server credentials; each wallet key is the sole identity and account recovery mechanism. Key loss or compromise directly loses identity. | Adds server sessions and wallet-link proof; one linked key is a single point of failure. | Same proof/session controls as B, with more credential management and more ways to link or revoke a key. |
| User experience | Simple for a single device/wallet; no separate account; poor for cross-device recovery and account-level support. | Stable profile/history across devices, but changing wallets or losing the one wallet is disruptive. | Supports device separation, migration, and user-selected backup wallets; adds settings and security prompts. |
| Recovery | No Aero recovery unless keys are recovered by the wallet provider. | No wallet replacement without access to the sole key or a separately approved recovery process. | A remaining verified wallet can authorize replacement/linking; all-wallet loss still has no recovery in the recommended first version. |
| Portability | Address is portable between wallet apps but identity/history is bound to that address. | Aero ID is stable across app devices but only one wallet can authorize it. | Stable Aero ID can remain associated with multiple wallet addresses and supported EVM networks. |
| Database complexity | Low; may avoid an account table, but becomes hard to add durable history, support, and policy later. | Moderate: users, wallet, challenge, session, status, audit. | Higher: one-to-many links, primary designation, uniqueness/concurrency, per-wallet revocation, recovery and audit paths. |
| Future payment history | Address-keyed only; poor fit for linked identities and cross-device view. | Easy account-level aggregation, but old wallet history needs a wallet replacement/migration model. | Can aggregate history for wallets explicitly linked to the same account; must show which wallet made each transaction and honor unlink semantics. |
| Support operations | Support can only advise the wallet holder; no Aero account recovery. | Clear account ID, but one key loss can become a support escalation. | Better device/wallet change continuity but invites social engineering against support; staff must never reassign wallets by email claim. |
| Multi-device access | Connector can be used on each device; app data remains wallet-specific/browser-local. | Same wallet needed on each device. | Each device can use a separately linked wallet, subject to a fresh proof. |

### Recommendation: C, with an explicit conservative policy

Propose a stable `users.id` and one-to-many `wallets` relationship. Each wallet must prove key control independently. A wallet has one active Aero-account association at a time. Linking requires both a recent account-authenticated session and fresh proof from the new wallet; changing/revoking wallet credentials requires fresh proof from a currently linked wallet. A wallet signature authenticates control of that address only; it does not transfer funds.

This recommendation fits the roadmap's stable user ID, linked wallet, and future payment-history needs while preserving external wallet custody. It costs more than wallet-only identity, but keeps account data and address-level chain authorization distinct. Multi-wallet must not be sold as recovery: if all linked keys are lost, the initial recommended policy offers no recovery. **Status: proposed; product owner and security approval required.**

## Proposed relational model: `identity_v1`

This is a schema design, not a migration or DDL to apply. Use PostgreSQL, `timestamptz`, UUID primary keys generated by the application using cryptographically secure randomness, and a versioned migration ledger in a future implementation. Do not assume the existing waitlist database has a known schema; inspect it and plan a forward-only compatible migration before use.

### `users`

| Field | Proposed type / rule |
|---|---|
| `id` | `uuid` primary key; opaque, stable, not an address or email. |
| `status` | `text` check: `active`, `suspended`, `deletion_pending`, `deleted`. |
| `created_at`, `updated_at` | `timestamptz NOT NULL`; `updated_at` maintained in service/trigger. |
| `suspended_at`, `deleted_at` | nullable `timestamptz`; consistency checks against status. |
| `status_reason_code` | nullable constrained code; never store unrestricted sensitive case notes here. |

Do not make email a required identity key. If email is later collected, model verified contact methods separately with their own challenge and retention rules; email confirmation is not wallet proof.

### `wallets`

| Field | Proposed type / rule |
|---|---|
| `id` | `uuid` primary key. |
| `user_id` | `uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT`. Normal account deletion is soft deletion. |
| `namespace` | `text NOT NULL`, initially allowlisted to `eip155`; future namespaces require separate policy. |
| `wallet_kind` | `text NOT NULL CHECK IN ('eoa','contract')`. |
| `address_normalized` | `char(42) NOT NULL`; regex/check enforces lowercase `0x` plus 40 hex characters. |
| `chain_id` | nullable positive `bigint`; null for EOA identity (key/address is chain-agnostic), required for contract-wallet identity because contract accounts can differ by chain. |
| `verification_status` | `text NOT NULL CHECK IN ('verified','revoked')`; only verified challenges create active links. |
| `is_primary` | `boolean NOT NULL DEFAULT false`; at most one active primary per user. |
| `linked_at`, `verified_at` | `timestamptz NOT NULL`; successful proof time is server-generated. |
| `revoked_at` | nullable `timestamptz`; set atomically when user revokes/replaces wallet. |
| `last_authenticated_at` | nullable `timestamptz`; operational metadata, not an authorization shortcut. |

Constraints and indexes:

- FK `user_id → users.id`; do not hard-delete users as the normal deletion path.
- Active EOA wallet addresses must be globally unique on `(namespace, address_normalized)` where `revoked_at IS NULL` and status is verified. EOA address identity is not duplicated per EVM chain.
- Active contract wallets must be unique on `(namespace, chain_id, address_normalized)`; `chain_id` is required for this kind.
- At most one verified, unrevoked row with `is_primary=true` for each user (partial unique index). A transaction ensures a user has an active primary after bootstrap or revocation.
- Index `(user_id, verification_status, revoked_at)` for active wallet lookup and `(namespace, chain_id, address_normalized)` for chain-context lookups.
- Retain revoked rows as tombstones. Address reassignment to a different Aero account is not a routine relink: require proof by the existing account or a separately approved recovery process. This preserves history and prevents support from silently moving an address.

### `wallet_challenges`

| Field | Proposed type / rule |
|---|---|
| `id` | `uuid` primary key and SIWE request ID. |
| `purpose` | `text` check: `create_account`, `login`, `link_wallet`, `reauthenticate`, `revoke_wallet`. |
| `user_id` | nullable FK to `users`; required for link/reauth/revoke; null for create/login pre-auth. |
| `initiating_session_id` | nullable FK to `sessions`; required for link/reauth/revoke and bound to the issuing user. |
| `initiating_wallet_id` | nullable FK to `wallets`; identifies currently linked wallet that recently reauthenticated sensitive changes. |
| `target_namespace`, `target_wallet_kind`, `target_address_normalized` | non-null target identity. |
| `chain_id` | positive `bigint`; selected from server allowlist, required for SIWE and contract-wallet verification. |
| `domain`, `uri`, `statement` | exact server-generated SIWE values, stored to compare signature payload to expected challenge. |
| `nonce_hash` | fixed-length hash of cryptographically random nonce; unique. Store no reusable nonce secret beyond the challenge record. |
| `issued_at`, `expires_at` | `timestamptz NOT NULL`; proposed short lifetime: 5 minutes. |
| `consumed_at`, `invalidated_at` | nullable timestamps, set once under row lock. |
| `attempt_count` | bounded integer for abuse control; rate limits also apply outside the row. |

Checks: `expires_at > issued_at`; purpose/user/session relationships are consistent; consumed and invalidated cannot both be set. Index active challenges by `(user_id, purpose, expires_at)` and by target address. A unique `nonce_hash` plus row lock and one transaction enforces consume-once under concurrent requests. Never log/store signature bytes.

### `sessions`

| Field | Proposed type / rule |
|---|---|
| `id` | `uuid` primary key, not itself a bearer secret. |
| `user_id` | FK `users(id) ON DELETE CASCADE`; only active users can issue/use. |
| `token_hash` | fixed-length `bytea NOT NULL UNIQUE`; hash of at least 256 bits of random bearer-token entropy. Raw token is only set in the secure cookie and never persisted. |
| `authenticated_wallet_id` | FK `wallets(id) ON DELETE RESTRICT`; wallet used at issuance, for audit and targeted revocation. |
| `created_at`, `last_seen_at` | `timestamptz NOT NULL`. |
| `idle_expires_at`, `absolute_expires_at` | `timestamptz NOT NULL`; both checked on each authorized request. Proposed initial values are 12-hour idle and 7-day absolute maxima, subject to product/security approval. |
| `revoked_at`, `revoke_reason_code` | nullable; server-side revocation is authoritative immediately. |
| `device_label` | nullable bounded, user-editable label; do not collect a high-entropy device fingerprint. |
| `user_agent_summary` | nullable, truncated/coarsened string; no raw IP by default. Any IP retention needs an approved abuse/privacy policy. |

Indexes: unique `token_hash`; `(user_id, revoked_at, absolute_expires_at)` for session management; expiry index for cleanup. On wallet revocation, revoke sessions authenticated by that wallet; on account suspension, recovery event, or suspected account compromise, revoke all sessions. No browser-only logout state.

### `identity_audit_events` (recommended supporting table)

Append-only `id uuid`, `occurred_at timestamptz`, `actor_kind` (`user`, `staff`, `system`), nullable actor and subject user/wallet IDs, stable action code, request/correlation ID, and bounded redacted JSONB metadata. No signature, session token, nonce, seed phrase, unrestricted note, or raw IP. Application DB role used by normal routes must not update/delete audit rows. Access and retention need privacy/security approval.

### Versioning, deletion, and retention

- Version schema as a sequence of ordered, checksummed migrations (for example `identity_v1`); one deployment coordinator acquires a migration lock and records the version in a schema migration ledger. M1A creates no migration or table.
- Use soft status transitions for user suspension/deletion. A deletion request revokes all sessions, invalidates unused challenges, revokes wallet links, and erases or pseudonymizes app-held personal data according to an approved retention schedule. It cannot erase public blockchain history.
- Use `RESTRICT` for wallet-to-user ownership so a mistaken hard delete cannot orphan identity history; use `CASCADE` for ephemeral sessions and challenges if a user is physically purged after retention review. Audit rows use nullable actor references / retained pseudonymous subject IDs; retention is a product/privacy decision still open.
- Define retention windows before launch. Do not keep challenge records or expired sessions indefinitely. Retain wallet ownership history only for the approved period and legal purpose; a revoked-address tombstone should not become an undeclared permanent identity database.

### Transaction boundaries and concurrency

1. Verify message syntax/signature outside the DB transaction using immutable server-generated challenge values.
2. Begin a serializable transaction or `READ COMMITTED` transaction with explicit row locks; `SELECT ... FOR UPDATE` the challenge and associated user/session. Re-check exact purpose, owner, expiry, unused status, user status, and active session.
3. Mark the challenge consumed and create/update the wallet/session in the same transaction. Account bootstrap creates `users`, first wallet, audit event, and session record atomically.
4. Enforce global address ownership and primary-wallet invariants with unique partial indexes; never rely only on a pre-insert `SELECT`. If two users race to claim the same wallet, one transaction wins and the other rolls back with a generic conflict response.
5. Commit before returning a session cookie. On failure, no partial account/wallet/session remains. Challenge failure attempts are rate-limited and bounded; stale/replayed submissions cannot produce a second session.

## Authentication and authorization boundaries

- **Wallet connection:** frontend connectivity state only; useful for composing a user-signed transaction. Does not authenticate an Aero user.
- **Wallet ownership proof:** a server-verified, purpose/domain/chain/nonce-bound signature proves control of the address at that time. It may establish a session or link that wallet. It does not prove a legal name, email, beneficial ownership, or transfer intent.
- **Application authentication:** a valid, active server-side session maps a request to `users.id`. Middleware/API handlers must check user status, session expiry/revocation, route scope, and object ownership.
- **Transaction authorization:** only the connected wallet's explicit transaction signature authorizes its on-chain call. Session cookies must never be accepted by contracts or a backend signing service as transfer authorization.
- **Business authorization:** future account-scoped APIs must authorize the `user_id` and resource association server-side. Client-provided wallet/user IDs and local storage are untrusted input.

## Session and API design

Proposed session cookie: `__Host-aero_session`, `Secure`, `HttpOnly`, `Path=/`, `SameSite=Lax` (or stricter if flows allow), no `Domain`, and a random opaque token of at least 256 bits. Persist only a cryptographic hash keyed/peppered by a server secret where operationally practical. Never put the token in local storage, query strings, logs, analytics, or wallet messages.

Every request resolves the token hash server-side and checks session idle/absolute expiry, revocation and user status. Session renewal rotates the bearer token and stored hash atomically; the previous token becomes unusable. Logout revokes the row then clears the cookie. “Log out other devices” revokes all other sessions; account suspension, wallet-compromise response, and recovery revoke all. Proposed 12-hour idle / 7-day absolute limits need approval; sensitive account changes require recent wallet reauthentication regardless of session age.

For cookie-authenticated unsafe methods: require exact `Origin` allowlist validation against a configured canonical origin, plus a session-bound CSRF token (synchronizer token or equivalent) and SameSite cookie. Reject missing/untrusted origin on browser mutations; restrict CORS to exact approved origins; use no GET mutations. Host/forwarded-host headers must not choose auth domain or generate security links. Current release gates do not yet carry an auth-origin setting; implementation must add an approved server-side canonical origin through a reviewed config change, not infer it from the request.

Server/API authorization should use a central session resolver and per-route permission functions; default deny. Consumer and admin namespaces/cookies must be separate. Rate limits must be distributed for multi-instance deployment. No identity APIs exist today.

## Staff identity boundary

Current `/admin` is a waitlist-only page behind one shared password and deterministic HMAC cookie. It provides no individual staff identity, server-side session revocation, roles, action audit, or support access boundary. Treat it as a known prototype risk, not a pattern to copy.

Propose staff identity through a separate managed identity provider (OIDC), phishing-resistant MFA, distinct staff session cookie/domain and shorter absolute lifetime, server-enforced roles, least privilege, and append-only audit. Consumer SIWE identity must not grant staff capability; staff email must not permit a user wallet link or recovery. Define roles such as waitlist operator (waitlist PII only), support reader (redacted case data), support approver (time-limited, reason-bound elevated access), and security admin (identity configuration with dual control). No staff role can sign or initiate a user's on-chain transaction. High-impact user-data export, account suspension, wallet-link override, and policy changes require explicit permission and audit; wallet-link override should remain prohibited absent an approved recovery process. **Staff model remains proposed pending owner/security approval.**

## Delivery order and entry criteria

1. Obtain owner approval for the proposed account model, wallet count, username source, wallet types/chains, recovery, session policy, retention, and staff boundary.
2. Inspect the actual Neon schema/data and define retention/legal requirements; do not infer `waitlist` DDL from queries.
3. Implement a versioned schema and constraints in a later milestone, then SIWE challenge/verification with concurrency/replay tests.
4. Implement server session lifecycle, CSRF/origin checks, authorization middleware, audit events, and staff separation before account-scoped financial APIs.
5. Keep production release disabled until the M0 gates and identity controls are independently reviewed.

## References

- [ERC-4361 Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)
- [ERC-191 Signed Data Standard](https://eips.ethereum.org/EIPS/eip-191)
- [EIP-712 Typed Structured Data](https://eips.ethereum.org/EIPS/eip-712)
- [Aero M0 product boundaries](AERO_PRODUCT_BOUNDARIES.md), [M0 threat model](AERO_THREAT_MODEL.md), and [decision register](AERO_DECISIONS_REGISTER.md)
