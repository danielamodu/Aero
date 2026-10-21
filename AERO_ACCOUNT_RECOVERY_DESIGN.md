# Aero Account Recovery and Wallet Change Design

**Status:** proposed policy; not implemented or owner-approved.

**Date:** 2026-10-21
**Scope:** response to lost, replaced, or compromised wallet access under the proposed multi-wallet account model. This document does not create a recovery mechanism or authorize staff to move user funds.

**M1B approval addendum (2026-10-22):** The product owner approved multiple independently verified wallets with no email-only or support-assisted recovery. Fuji account creation remains closed. Account closure and purge remain unavailable until a field-level retention policy is approved.

## Principles

1. An Aero account is an application identity, not a wallet key and not a custody mechanism.
2. A wallet signature proves current control of that wallet address; it does not prove a legal identity or justify support overriding another credential.
3. A valid application session alone cannot add a wallet, change recovery credentials, or authorize a transfer.
4. A wallet link/recovery operation changes account access only. It must never sign, submit, or authorize an on-chain transfer.
5. Recovery paths can become account-takeover paths. If the account has no remaining trusted key and no approved recovery proof, deny recovery rather than silently trusting email, screenshots, transaction history, or support assertions.
6. No current implementation offers consumer recovery. `AeroNames` handle ownership remains at the contract/wallet level and Aero cannot recover a lost private key.

## Options compared

| Approach | How it works | Benefits | Risks and operational cost | Assessment |
|---|---|---|---|---|
| No recovery; wallet replacement requires an existing wallet signature | User proves control of a currently linked wallet and separately proves the new wallet. If all linked keys are lost, the account cannot be recovered. | Strong, simple authorization boundary; no support impersonation; no recovery secret to steal; low data/operations burden. | Permanent account-access loss after all keys are lost; does not help users whose only wallet is inaccessible. | Recommended initial policy, combined with multiple independently verified wallets if approved. |
| Multiple verified wallets | User links backup/device wallets. Any currently linked wallet can reauthenticate and authorize linking/revoking another wallet, subject to recent proof and policy. | Convenient multi-device access; an existing wallet can replace a lost one; no institution must custody keys. | Every additional wallet expands attack surface; a compromised linked key may take over the account; users may not understand which wallet remains active. | Recommended account capability; do not describe it as guaranteed recovery. Require secure wallet-change UX and alerts. |
| Explicit recovery credential | User enrolls a separate recovery key, passkey, hardware key, recovery code, or backup secret. | Can restore access when transaction wallet is lost; separates recovery from wallet providers. | Recovery credential becomes a high-value key; storage, rotation, enrollment and phishing risks; passkey sync/revocation semantics vary. Recovery code support adds secret-handling and support complexity. | Defer until product owner chooses a credential, threat model, and independent security review. Email is not sufficient by itself. |
| Social or institutional recovery | Trusted people, a custodian, or Aero support can approve a recovery after a process. | May recover users who lose all keys; familiar customer-support path. | Collusion, coercion, social engineering, insider abuse, false claims, jurisdiction and staffing burden; creates a privileged recovery authority. | Do not offer in v1. Requires explicit owner, legal/security review, quorum, audit, appeal and delay policy. |
| Future smart-account recovery | Smart account or guardian policy changes owners/keys through on-chain recovery rules. | Transparent programmable policy, potentially no unilateral Aero control, can support threshold guardians. | Smart-contract, guardian-collusion, upgrade, chain availability and recovery-delay risks; incompatible with current EOA-only consumer flow without migration. | Future option only; not present in Aero source and not approved. Requires separate architecture/security review. |

## Recommended v1 policy (proposed)

### Enrollment and backup wallet

- First Aero account is created only after an approved server-verified wallet challenge. If open signup is not approved, account creation is gated separately; do not infer approval from wallet connection.
- Allow users to add one or more independently verified wallets only after a fresh signature from a currently linked wallet and a fresh signature from the new wallet. The current wallet proof must be recent; proposed freshness window is five minutes.
- Show both checksummed full addresses and the action (“add this wallet to Aero account …”); state that no transfer or token approval is authorized.
- A linked wallet is an authenticator for the Aero account, not an Aero-controlled custodian. Wallets must be individually named/recognized by the user; no automatic linking merely because two connectors are open in one browser.
- User explicitly chooses a primary wallet for display. Primary designation has no power over contract ownership, handle ownership, or funds.

### Wallet replacement or revocation

- Any current verified wallet can reauthenticate to add a replacement wallet, then the new wallet signs a separate link challenge. The target address must not be actively linked to a different Aero account.
- Revocation requires recent proof by a currently linked wallet. The server atomically revokes the selected link, marks it non-primary, rotates/revokes relevant sessions, and writes a security audit event. If another active wallet remains, the user chooses its primary status.
- If the wallet is suspected compromised, “revoke all sessions” and wallet unlink are available from an authenticated flow requiring an unaffected linked wallet. The system should send a security notice to available verified contact methods; email is notification only, not approval.
- Add a prominent confirmation and a recovery warning before revoking the last active wallet. Do not allow normal self-service removal of the last verified wallet unless the user is also closing the Aero account under an approved closure flow.
- A request signed by a wallet already linked to another user cannot be automatically moved. Require the old account to revoke it, then the new account to link it; if old account is inaccessible, the case is unrecoverable under the proposed v1 policy.

### Total loss of linked keys

- No recovery. Support may explain the policy and help the user locate wallet-provider backup/recovery instructions, but cannot reset ownership, link a new address, change AeroNames, or transfer assets.
- Account status can be suspended for safety if there is credible evidence of compromise, but support cannot assign a new wallet. Suspension is not asset custody and does not freeze on-chain contracts unless a contract independently implements a relevant control.
- Any waitlist email, email confirmation, public transaction history, username claim, government document, screenshot, or knowledge of account data is not sufficient proof to take over an account.
- Assets in user-controlled wallets remain subject to wallet access. Test tokens or future deposits held in contracts remain subject to contract code and owner/configuration; Aero account recovery cannot restore a private key or guarantee withdrawal.

## Unresolved incident scenarios

| Scenario | Proposed response | Open decision / risk |
|---|---|---|
| One of several linked wallets is lost, one remains | Reauthenticate with the remaining wallet; verify replacement; revoke lost wallet and its sessions. | Whether a cooling-off period is needed after link/revoke; owner/security approval required. |
| Single linked wallet is lost | No recovery in v1. | Potential user loss of access is accepted only if product owner explicitly approves this policy. |
| One wallet is compromised but another remains | Use unaffected wallet to revoke compromised wallet and all sessions; notify user; investigate only app access, never take control of funds. | Define compromise evidence, alert channels, and optional delay for high-risk changes. |
| Session stolen, wallet keys intact | Server revokes sessions; user reauthenticates with a linked wallet; session token rotation. | Requires operational monitoring and a reachable support/report path. |
| User asks staff to move a handle to another wallet | No staff override. AeroNames does not expose an admin transfer function; user must use a valid contract operation. | Contract transfer semantics are absent; releasing and reacquiring can be front-run and is not a safe recovery workflow. |
| User claims linked address is owned by them after previous account deletion | Reject automatic reassignment; preserve tombstone association pending approved retention/transfer policy. | Data retention and wallet-address reassignment require legal/privacy and security decision. |

## Controls required before implementation

- Explicit product/security approval of “no assisted recovery” and its user-facing disclosure.
- Multi-wallet limit or no limit, current-wallet reauthentication policy, session freshness, notifications, cooling-off period and last-wallet removal behavior.
- Secure session store with immediate revocation, account status checks, wallet-link audit log, rate limits and alerting.
- No email-only or waitlist-based recovery; no support impersonation.
- Privacy-approved retention and deletion model for wallet-link history and recovery/audit events.
- Security tests for lost/compromised wallets, concurrent linking, replay, session theft, address already linked elsewhere, and last-wallet removal.

## Approval status

**Proposed; owner approval required.** M1A recommends multiple verified wallets as a continuity feature but no Aero-assisted or social recovery in the initial design. This is not approved until the product owner and security owner explicitly accept permanent loss of Aero-account access when every linked wallet is lost.
