# Aero Milestone 1A Completion Report

**Date:** 2026-10-21
**Scope:** inspect identity-related source and prepare the account, wallet-proof, username, recovery, session, schema, and staff architecture for a later implementation milestone. This milestone is documentation and recommendation only.

## Result

**Milestone 1A: passed as an architecture and decision-resolution deliverable. No authentication has been implemented and no decision has been approved.** The documents make a concrete recommendation and identify the exact approvals still required. This is not permission to start migrations or account endpoints automatically.

## Source inspection findings

- Consumer routes are Next.js App Router pages. `/testnet` uses Reown AppKit/Wagmi configured for Avalanche Fuji; `useAccount` is client wallet state. The last address and other sandbox state are stored in browser local storage.
- There is no consumer account table, wallet-link proof, consumer session, authentication API, or server-side financial authorization. The wallet's transaction signature remains the on-chain transfer authorization.
- `AeroNames` is a simple on-chain registry: lowercase `a-z`, digits and underscore, length 3–20; one current handle per address; a new registration releases the prior handle; explicit release exists; names do not expire; no admin recovery or transfer function exists. Reads are direct contract calls. The source does not establish a backend registry or deployed production instance.
- API routes cover the waitlist and admin operations. Neon is optional; the file fallback is used without `DATABASE_URL`. Waitlist SQL assumes an existing table, but no schema DDL or migrations were found. Waitlist email/username is not consumer authentication or an AeroNames reservation.
- Admin access uses a shared `ADMIN_PASSWORD` and deterministic HMAC cookie. The cookie flags are HTTP-only, SameSite=Lax, Secure in production, with browser max-age; there is no server-side revocation, per-person staff identity, role model, or audit trail. This pattern is not reused in the proposed consumer design.
- The M0 release gate still blocks beta/production and has no approved production chain or auth origin.

## Recommendations recorded

- Proposed model: one stable internal Aero account with multiple independently verified wallets, each retaining its own chain activity and transaction authority.
- Proposed wallet proof: ERC-4361 SIWE signed with EIP-191 for EOA authentication; purpose/domain/chain/nonce/expiry checks and atomic nonce consumption are mandatory. Initial implementation should reject contract wallets until EIP-1271 verification and session invalidation are designed and approved.
- Proposed username policy: deployed AeroNames is canonical only for its own chain/contract instance; any backend table is a derived index/cache, not an independent reservation or authority. Production policy still needs approval.
- Proposed recovery: multiple wallets can provide continuity; no Aero-assisted or email-only recovery when all linked keys are lost. This consequence requires explicit product/security approval.
- Proposed sessions: opaque random bearer token, server-side hashed record, secure host-only cookie, CSRF/origin enforcement, expiry and immediate revocation. Proposed 12-hour idle / 7-day absolute lifetime awaits approval.
- Proposed staff boundary: managed staff identity, MFA, separate staff sessions, least-privilege roles and append-only audit; no consumer SIWE-to-staff escalation and no staff wallet-link override.
- Proposed `identity_v1` schema covers users, wallets, one-time challenges, sessions and supporting audit events, with uniqueness, foreign keys, retention, concurrency and transaction boundaries. It is a design only; no schema or migration was created.

## Deliverables

- `AERO_IDENTITY_ARCHITECTURE.md`
- `AERO_WALLET_VERIFICATION_PROTOCOL.md`
- `AERO_ACCOUNT_RECOVERY_DESIGN.md`
- Updated `AERO_DECISIONS_REGISTER.md` with 23 items, explicit options/recommendations/rationale/security/dependencies/owners/approval requirement/status.
- `AERO_M1A_COMPLETION_REPORT.md`

Every decision remains `proposed` or `unresolved`; none is marked `approved`. The register says which owner approvals are required before implementation.

## Verification and constraints

- Reviewed the M0 boundaries, threat model, release gates, completion report, system architecture audit, gap register and engineering roadmap against current source for wallet providers, address state, AeroNames, APIs, persistence, sessions and admin auth.
- `git diff --check` — **passed**. Git printed only existing working-copy LF-to-CRLF normalization warnings on M0-modified files. A separate scan of all five M1A documents found no trailing whitespace and confirmed final newlines.
- No application tests/build were run because no application code, config, schema or migrations were changed.
- No production configuration changed; no contract deployment or transaction broadcast; no dependencies installed; no commit or push.
- Existing working-tree changes were preserved.

## Open approvals before M1 implementation

Product owner and security owner must explicitly approve D-01–D-05 and D-21–D-23. Product/privacy/legal and engineering owners must resolve the related data retention, staff access, canonical naming, supported chain/wallet types and service boundaries listed in `AERO_DECISIONS_REGISTER.md`. Inspect the actual Neon schema/data before a migration plan. The production release gate remains closed.

## Next step

Review and explicitly accept, reject, or revise the proposed decisions in the register. Only then begin a separately scoped implementation milestone for the approved identity schema, wallet challenge verification, sessions, CSRF/origin protection and tests. M1A does not start that implementation.
