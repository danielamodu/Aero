## What Aero is

Aero is a wallet-native product for **sending, paying and earning** on Avalanche. The long-term direction is simple: money should move with the ease of a message. Today, the consumer product is an **Avalanche Fuji testnet sandbox** for testing that direction with test tokens that have no cash value.

The current app is real software, not a slide deck. A connected wallet can claim test dollars, register a Fuji handle, send tokens, open a payment request, use bill-shaped presets, try a card-shaped checkout, and inspect a mock yield portfolio. Some of those paths settle a real Fuji transaction. Others are deliberately simulated. This documentation keeps those categories separate.

> **The short version:** Aero works on Fuji, does not custody real money, does not connect to a biller or card processor, and does not earn yield from Benqi or Trader Joe. Those integrations are planned work, not current features.

## What works today

| Surface | Status | What actually happens |
|---|---|---|
| Wallet connection | {{badge:Implemented}} {{badge:Fuji}} | Reown AppKit / Wagmi connects an external wallet on Fuji. Connection is not Aero authentication. |
| Test dollars | {{badge:Implemented}} {{badge:Mock}} | A faucet issues tUSDC, a test token with no cash value. A second path moves pre-funded test inventory from AeroBank. |
| Handles | {{badge:Implemented}} {{badge:Fuji}} | AeroNames stores one active handle per address on Fuji. Handles resolve to their registered recipient wallet. |
| Send | {{badge:Implemented}} {{badge:Fuji}} | A wallet-signed test-token transfer, through AeroPay when configured or directly through the token contract. |
| Payments | {{badge:Partial}} | Memo-bearing payments work on Fuji. Durable payment records, provider settlement and reconciliation do not. |
| Bills | {{badge:Partial}} {{badge:Mock}} | Presets fill the normal send form. There is no biller API or fulfillment path. |
| Card checkout | {{badge:Mock}} | The card step is simulated; a Fuji transfer of pre-funded test tokens follows. No fiat is charged. |
| Earn | {{badge:Mock}} | AeroVault uses a synthetic rate. AeroRouter runs against mock QiToken markets. |
| Identity | {{badge:Implemented}} {{badge:Blocked}} | Fuji EOA SIWE, linked wallets and server sessions exist in source. Signup is closed and no live Neon migration or enrollment flow is active. |
| Aero L1 / ICM | {{badge:Design}} {{badge:Not supported\|consumer app}} | A separate workstream. No verified chain ID, validator set, native token or consumer cross-chain flow. |

## How to read the status labels

These labels are used consistently across the docs:

| Label | Meaning |
|---|---|
| {{badge:Implemented}} | An execution path exists in the repository. It may still depend on configuration or manual setup. |
| {{badge:Tested}} | Automated tests exist and passed in the recorded environment. This does not prove a deployed system is correct. |
| {{badge:Fuji}} | Exercised or intended for Avalanche Fuji, chain ID `43113`, with test assets only. |
| {{badge:Mock}} | Deliberately synthetic behavior. Do not treat it as a live provider, market or financial service. |
| {{badge:Partial}} | Some user-visible behavior exists, but an important production component is absent. |
| {{badge:Planned}} | Designed or sequenced, but not implemented. |
| {{badge:Blocked}} | Prevented by a release gate, missing approval or unresolved dependency. |
| {{badge:Not supported}} | Not available at all today. |

## The boundaries that matter

Aero is not a bank, a money transmitter, a card processor or a live yield aggregator. It does not hold user wallet keys. It cannot recover a lost wallet. A connected wallet is not an authenticated Aero account, and an Aero session never authorizes a token transfer.

The Fuji sandbox uses **tUSDC**, which is not USDC and has no cash value. Contract deposits are governed by the contract and its owner/configuration; they are not unconditionally withdrawable. Router withdrawals are all-or-nothing and can revert on illiquidity.

The release gate intentionally blocks beta and production. There is no approved production chain, token, deployment manifest or non-mock integration. The production allowlist is empty by design.

## Continue reading

- [Product](/product/) explains Send, Pay and Earn surface by surface.
- [Current status](/status/) is the candid implementation matrix.
- [System architecture](/architecture/) traces a payment end to end.
- [Developer guide](/developers/) gets the app and contracts running locally.
- [Roadmap](/roadmap/) explains the milestones and what must happen before real value.
