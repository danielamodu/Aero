# Aero Product Boundaries

**Status date:** 2026-10-21  
**Evidence basis:** repository source, deployment scripts, configuration, and the architecture audit, gap register, and roadmap. A source implementation is not evidence that a particular deployment is live or independently verified.

## Product definition

Aero's intended product direction combines **Send** (username-based digital-asset payments), **Pay** (everyday payment and bill-management experiences), and **Earn** (yield on eligible idle stablecoin balances). The current consumer-facing implementation is a **wallet-connected Avalanche Fuji sandbox** with a separate marketing site and email-confirmed waitlist. It is not a production financial service, authenticated Aero account, bank, biller, card processor, or live yield aggregator.

“Implemented but not independently verified” means the repository contains an execution path, but this milestone did not operate it against a live deployment or verify the deployed bytecode. “Simulated/mock” means the interface or contract behavior is deliberately synthetic. See [AERO_SYSTEM_ARCHITECTURE_AUDIT.md](AERO_SYSTEM_ARCHITECTURE_AUDIT.md) for source locations and the broader audit record.

## Current capabilities

| Capability | Classification | Boundary |
|---|---|---|
| Wallet connection | Implemented but not independently verified | Reown AppKit/Wagmi connector configuration. A connected address is not an authenticated Aero account. Requires wallet provider configuration. |
| Test-token faucet | Implemented but not independently verified | Fuji TestUSDC/tUSDC contract and faucet path. The token has no cash value and is not USDC. |
| Username registration and resolution | Implemented but not independently verified | AeroNames registry on Fuji; one handle per address with release/change behavior. Does not establish an internal user identity and is not guaranteed permanent. |
| Send by handle or address | Implemented but not independently verified | Wallet-authorized Fuji token transfer through AeroPay when configured, with a direct token-transfer fallback. This is actual testnet execution, not a production payment service. |
| Payment history | Partially implemented | Bounded on-chain reads plus browser-local activity; not a complete, durable, reconciled financial record or account statement. |
| Bill interface | Partially implemented | Presets fill a normal test-token transfer form. No biller, merchant, fulfillment, reversal, or dispute integration is present. |
| Card-shaped checkout | Simulated/mock | A test-card UI is followed by a wallet-signed Fuji transaction transferring pre-funded test tokens from AeroBank. No card processor, fiat charge, or banking service is connected. |
| AeroVault yield view | Simulated/mock | Synthetic rate/index accrual against finite test-token inventory; not external protocol yield. |
| AeroRouter / market labels | Simulated/mock | Router and adapter source exists; supplied deployment script creates mock QiToken markets. No verified live Benqi or Trader Joe market integration, automatic optimizer, keeper, reserve, or withdrawal queue is established. |
| Cross-chain / ICM | Not implemented | No consumer cross-chain or ICM/Warp payment flow is established by the repository. Fuji is the configured consumer network. |
| Waitlist | Implemented but not independently verified | Email confirmation and optional database or local-file persistence. The requested username is a waitlist preference only; it does not reserve an on-chain handle or guarantee access. |
| Consumer account, recovery, support tickets, financial ledger | Not implemented | No consumer account/session, wallet-link flow, recovery process, durable payment ledger, or support-ticket system was found. |

No application feature in this table is classified “implemented and locally verified”: this M0 review validates release-gate behavior and compiles the app, but does not claim an end-to-end wallet or contract interaction was exercised.

## Networks, assets, and providers

- **Network currently supported by the consumer sandbox:** Avalanche Fuji, chain ID `43113`. It requires Fuji AVAX for transaction gas.
- **Sandbox asset:** TestUSDC/tUSDC on Fuji. It is not USDC, is not redeemable, and has no cash value. The contracts also use ordinary addresses and test inventory; no production token address is approved.
- **Production network/assets:** none approved or configured. The release allowlist is intentionally empty. Do not infer support for Avalanche mainnet, Ethereum, or any other chain/token.
- **Wallet providers:** the code uses Reown AppKit, Wagmi, and Viem. These connect an external wallet and submit user-authorized transactions. Aero does not control wallet keys through this connection. Exact connector availability depends on deployment configuration and user wallet.
- **Other external services:** optional Neon Postgres and Resend support the waitlist/admin email path; a public Fuji RPC is used for chain reads. No consumer financial backend, biller, fiat on/off-ramp, card processor, live yield protocol, or cross-chain provider is established.

## Custody and user responsibility

Wallet private keys are controlled by the user's external wallet. The user authorizes wallet transactions. Aero's frontend does not sign or submit a user's transaction using an Aero-held key. Once a transaction deposits tokens into an Aero contract, those tokens are held and governed by that contract and its owner/configuration; do not describe them as remaining in the user's wallet or as unconditionally withdrawable. The sandbox bank contract holds pre-funded test tokens.

The source does not establish a consumer wallet recovery mechanism. Losing wallet access may mean losing access to that wallet's on-chain assets and handle; Aero cannot restore its private key. No consumer account or linked-wallet recovery process exists. Contract ownership and deployed owner key custody are not independently established by this milestone.

## Environment boundaries

| Environment | Permitted use | Network/assets | Required conditions | Must remain disabled |
|---|---|---|---|---|
| Local development | UI work and local/mock development | Local chain or explicitly identified test fixtures; no real funds | `AERO_RELEASE_ENVIRONMENT=local` and matching public value for a release build. Keep secrets out of client bundles. | Real-money flows, production claims, any production key/address. |
| Testnet sandbox | Demonstration and testing of wallet-signed test transactions | Fuji `43113`; tUSDC and Fuji AVAX gas only | Server and public release labels both `testnet`; both chain IDs `43113`; testnet contracts and wallet/RPC config. | Real USDC/value claims, live billers, card/fiat settlement, production yield, unsupported networks. |
| Controlled beta | Limited real-user evaluation only after prerequisites and owner approval | No network or asset approved yet | Account/security model, durable financial records, reviewed deployments, monitoring, incident process, support access, legal/product approvals. Gate currently rejects beta. | Currently all beta financial-product access. |
| Production | Production financial product | No network, token, contract, or integration approved | Reviewed deployment manifest and addresses, bytecode verification, non-mock integration approval, backend/auth/database/security/operations controls, and product-owner approval. Gate currently blocks all production. | All real-money features until every release gate passes. |

## Explicit exclusions for M0

M0 does not implement consumer identity/authentication, wallet linking or recovery, a ledger, biller integration, support ticketing, card/fiat processing, new money movement, production deployment, production infrastructure, or contract deployment. It does not approve any contract, token, provider, chain, return, liquidity guarantee, partnership, or product availability claim.

## M1B addendum — Fuji identity foundation (2026-10-22)

The repository now contains a Fuji-only EOA identity foundation with closed signup. No consumer account is created from wallet connection or login; the identity table remains empty unless a separately approved enrollment flow is later added. Authentication requires a configured shared Postgres database, canonical origin, session secret, Fuji RPC and an explicitly applied additive migration. No production or beta release is enabled. AeroNames remains authoritative for its registered recipient wallet; another wallet linked to the same Aero account does not become an equivalent handle destination.
