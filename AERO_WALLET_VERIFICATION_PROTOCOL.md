# Aero Wallet Verification Protocol — Proposed

**Status:** proposed only; no auth endpoint or wallet-link flow exists.

**Date:** 2026-10-21
**Purpose:** specify how a future server can prove control of an EVM address for account sign-in/linking. A successful proof grants no permission to move tokens.

**M1B implementation addendum (2026-10-22):** The Fuji-only EOA protocol below is implemented as a closed-signup foundation. The server persists nonce and full-message hashes rather than raw nonce/message contents, and compares a strict canonical SIWE parse against stored fields. See `AERO_M1B_IMPLEMENTATION_REPORT.md` for activation requirements and verification limits.

## Selected signing format

Use **Sign-In with Ethereum (ERC-4361 / SIWE)**, encoded as a human-readable message and signed with **EIP-191 `personal_sign`** for EVM externally owned accounts (EOAs). SIWE already defines the message fields and relying-party checks for domain, address, URI, chain ID, nonce, issue/expiry and request context. EOA verification uses EIP-191. This is a better fit for wallet authentication than a custom message or EIP-712 login schema because it is a standard wallet-facing sign-in format and is designed to establish off-chain sessions. [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361) [ERC-191](https://eips.ethereum.org/EIPS/eip-191)

EIP-712 provides typed structured data and a domain separator that can contain name, version, chain ID and verifying contract, but the EIP explicitly leaves replay protection to the application. It is valuable for structured typed consent or protocol actions, but SIWE's interoperable sign-in format is preferable here. EIP-712 would still need a server nonce, expiry, exact purpose checks and one-time consumption. [EIP-712](https://eips.ethereum.org/EIPS/eip-712)

Initial implementation should allow **EOAs only** until contract-wallet verification is explicitly included in a reviewed release. SIWE recommends EIP-1271 for contract accounts and requires verification against the chain ID in the message; contract signatures may change validity with contract state. Supporting them therefore requires chain-specific RPC verification, state-change/session invalidation policy, and tests. The proposed schema reserves `wallet_kind='contract'`, but that does not enable it. Owner/security approval is required before enabling either a chain or wallet kind.

## Challenge contents

The server, not the browser, creates a canonical SIWE message. Include and persist the exact expected values:

- exact configured HTTPS origin and authority/domain; exact URI for the auth operation;
- requested wallet address in checksum form for display; compare canonical lowercase address after verification;
- supported namespace and chain ID selected from server-side allowlist, never blindly accepted from request input;
- `Version: 1`;
- a cryptographically random nonce (for example, 32 random bytes encoded as 64 lowercase hex characters, satisfying SIWE's nonce grammar); database stores only a hash;
- server-generated `Issued At`, short `Expiration Time` (proposed five minutes), and unique request ID tied to a challenge row;
- statement that spells out purpose, e.g. “Sign in to Aero. This signature does not authorize token transfers.” For wallet linking, say it links this exact wallet to the already authenticated Aero account;
- optional resource identifying the requested capability only if its exact meaning is documented.

Illustrative Fuji-only message (not a live Aero endpoint and not a production approval):

```text
testnet.useaero.org wants you to sign in with your Ethereum account:
0x1111111111111111111111111111111111111111

Sign in to Aero. This signature does not authorize token transfers.

URI: https://testnet.useaero.org/api/auth/verify
Version: 1
Chain ID: 43113
Nonce: 6f1d3a7b9c2e4a6d8f0b1c3d5e7a9b2c4d6f8a0b1c3d5e7a9b2c4d6f8a0b1c3d
Issued At: 2026-10-21T12:00:00Z
Expiration Time: 2026-10-21T12:05:00Z
Request ID: 71a7d64e-bcaa-4a69-8747-2f90a1e1d977
```

The address and origin above are examples only. Production chain, auth origin, wallet support and route names are unapproved. The current release gate's only supported consumer network is Fuji and it blocks production.

## Protocol sequence

### 1. Request challenge

The browser asks the server for one intent: `create_account`, `login`, or `link_wallet`. It submits the candidate address and, if applicable, the current session. The server validates address syntax, allowlisted namespace/chain, user/account status, and purpose. For link operations, the existing session must be valid and recently reauthenticated with a currently linked wallet. The server chooses origin, URI, chain ID, times, nonce and request ID; no client-supplied field can override them.

For unauthenticated login, return a generic challenge/response that does not reveal whether an address is registered. A verified first wallet may create an account only if open account creation has been approved. `login` must not silently create an account unless the product explicitly chooses and discloses a unified sign-in/create flow.

Store a challenge row containing purpose, user/session binding, target wallet, exact SIWE field values/message hash, `nonce_hash`, issue/expiry, attempt count, and null consumed/invalidation timestamps. Rate-limit by IP and wallet; do not rely on in-memory per-instance limits for production.

### 2. Display and sign

The client displays the exact server-issued SIWE message and asks the selected wallet to sign it using EIP-191. Wallet connection alone is not enough. The UI must clearly label this as an account sign-in or wallet-link signature, and explicitly state that it does not submit a blockchain transaction, spend tokens, grant token allowance, or authorize transfers.

### 3. Verify signature and exact message

The client returns the challenge ID, full signed message and signature over HTTPS. Server must:

1. Load the stored challenge and parse the signed text with a SIWE-conformant parser; reject malformed or duplicate/unknown fields.
2. Compare the parsed message to the stored expected values, field-for-field: domain/scheme, URI, checksum-equivalent address, SIWE version, chain ID, nonce, issued-at, expiration-time, request ID, statement, and resources. Do not merely trust a correctly recovered signer.
3. Compare domain and scheme to the **canonical server-configured origin**, not `Host`, `X-Forwarded-Host`, request URL, browser state, or an untrusted proxy header. Require exact origin/port policy. The browser/wallet's actual request origin should match the SIWE domain; proxy deployment must be configured to preserve a trusted origin.
4. Check server time against `issued_at`, expiry, optional not-before and the challenge row; reject expired, future-issued beyond allowed clock skew, or invalidated challenges.
5. Check the purpose and account/session binding. A `link_wallet` proof cannot be replayed as login or link to another account.
6. For EOA, recover the address using a well-maintained EIP-191 verifier (Viem is already present in the repo) and compare normalized address. Do not trust the connected address returned by the frontend.
7. Reject malformed signature encodings and non-canonical/high-`s` ECDSA forms if supported by the verification library. Do not use signature-byte uniqueness as replay protection: malleable variants may represent the same signer/message. The nonce row and exact one-time transaction are the replay control.
8. For a future contract wallet, use EIP-1271 `isValidSignature` via a trusted provider on the SIWE chain, check the expected magic value, and define session invalidation when the contract wallet's signer/threshold state changes. Until that design is approved and tested, reject contract wallets rather than treating them as EOAs.

### 4. Atomically consume, create or link

After cryptographic verification, begin a database transaction and `SELECT ... FOR UPDATE` the challenge and its bound user/session. Re-check unused state, expiry, purpose, session ownership/freshness, user status and target address. In the same transaction:

- `create_account`: create an active `users` row and the verified first `wallets` row, set it primary, consume nonce, and append a redacted audit event;
- `login`: resolve exactly one active wallet ownership record, reject suspended/deleted user, consume nonce, and create a server session;
- `link_wallet`: require the target address is not actively linked elsewhere, insert/activate the wallet for the bound user, set primary according to the chosen UX policy, consume nonce, and audit the link;
- `reauthenticate`/`revoke_wallet`: apply only the named operation and freshness policy; revoke affected sessions when required.

Commit before returning a session cookie. Unique database constraints on active wallet identity decide races; do not depend on preflight reads. If two accounts attempt the same address concurrently, only one insert can commit. The loser rolls back and receives a generic “wallet could not be linked” response. If two requests submit the same challenge concurrently, row lock plus `consumed_at` makes exactly one succeed. Do not catch a uniqueness failure and continue with partial state.

Wrong signatures increment a bounded attempt counter and are rate-limited; at a threshold, invalidate the challenge. A correct signature is consumed exactly once. A consumed challenge remains unusable even if session creation fails; the user obtains a fresh challenge. A failed DB transaction rolls back consumption and all account/link writes together.

### 5. Issue session separately from transaction signing

After committed authentication, return a fresh random session token in the Secure, HttpOnly, host-only cookie described by [AERO_IDENTITY_ARCHITECTURE.md](AERO_IDENTITY_ARCHITECTURE.md). Store only a hash. The signature is never reused to authorize a payment, transaction, token approval, or later API mutation. Any on-chain transaction continues to require the user's explicit wallet transaction signature.

## Attack handling

| Attack | Protocol control | Residual consideration |
|---|---|---|
| Signature replay | 256-bit nonce, purpose/request binding, five-minute expiry, unique nonce hash, DB row lock, consume-once. | SIWE/EIP-712 format does not replace application replay state. Keep nonce and signature out of logs. |
| Cross-domain/phishing | Canonical server origin; exact SIWE scheme/domain/URI comparison; wallet origin check; no Host-derived domain; clear user-facing statement. | Compromised frontend/origin can still trick signing; deploy only from controlled origin with CSP and release provenance. |
| Wrong chain | Server allowlist and exact SIWE `Chain ID` comparison; chain-specific contract-wallet verification. | EOA message signatures are off-chain; chain ID is signed as message text, not a runtime chain check. Server must verify exact expected message/chain. |
| Expired/future challenge | Server issue/expiry timestamps, bounded clock skew, challenge-row expiry recheck during consumption. | Keep server clocks synchronized; do not accept stale challenges because frontend says they are valid. |
| Address substitution | Server stores target address; require recovered address equality after normalization; user sees exact target/purpose. | Address display should include checksummed full value and recognizable truncation only as secondary context. |
| Wrong account/purpose | Challenge bound to account/session and purpose; server compares all SIWE fields; login/link routes separate. | Do not accept arbitrary user IDs or return different errors that reveal account existence. |
| Concurrent duplicate ownership | Partial unique active-wallet index plus transaction rollback. | Database constraint must be in place before app logic is enabled. |
| ECDSA malleability | Vetted verifier, canonical signature checks where available; replay keyed on challenge state, not signature hash. | A malleable signature does not imply a different recovered address, but test both high/low-s encodings. |
| Contract-wallet state change | Initial EOA-only proposal; later EIP-1271 chain-specific verification and session invalidation on owner-state changes. | Requires monitoring/indexing or revalidation policy; contract signature validity can be state-dependent. |
| Session hijack after successful proof | Secure cookie, server-side hash/revocation/expiry, CSRF checks, rotation, anomaly controls. | XSS can still act in the browser; avoid storing bearer token in JS-readable storage. |

## Verification requirements for a future implementation

No tests were added in M1A because there is no implementation. A later implementation must test: valid EOA login/link; wrong signer/address; altered message field; wrong domain/subdomain/scheme/port; wrong chain; expired/not-before/future message; malformed and high-`s` signature; nonce replay; concurrent same-nonce submissions; simultaneous same-wallet link attempts; cross-account link attempts; suspended user; session cookie attributes; CSRF/origin rejection; logout/revocation; no transfer/approval side effect; and (only if enabled) EIP-1271 success/failure and contract-state invalidation.

## Approval status

Proposed for owner/security review. No endpoint, schema or authentication behavior is implemented or approved. The supported production origin/chain and whether v1 permits only EOAs remain open decisions in `AERO_DECISIONS_REGISTER.md`.
