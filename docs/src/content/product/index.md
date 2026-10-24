## The product in one page

Aero is organised around three verbs: **Send**, **Pay** and **Earn**. Each one has a real Fuji execution path, a deliberate testnet boundary, and a larger production direction that is not yet available.

{{badge:Fuji}} **Today the entire consumer surface is a sandbox.** tUSDC is a test token. There is no fiat on-ramp or off-ramp, no card processor, no biller, no live lending market and no production account system. Every claim below is scoped to that reality.

## Send

Send is the clearest working path. A user connects a Fuji wallet, enters a handle or a raw address, enters an amount, optionally adds a memo, and signs a transaction. If AeroPay is configured, the app approves the token and calls `AeroPay`; otherwise it falls back to a direct token transfer.

The handle is resolved by the on-chain **AeroNames** registry. A handle belongs to its registered recipient wallet. Linking another wallet to the same Aero account does not make that wallet an equivalent payment destination.

- {{badge:Implemented}} Handle registration and resolution on Fuji.
- {{badge:Implemented}} One-signature payments with a bounded memo through AeroPay.
- {{badge:Implemented}} Direct-transfer fallback when AeroPay is not configured.
- {{badge:Partial}} Recent activity in the browser, plus bounded on-chain reads.
- {{badge:Not supported}} A complete indexed statement, durable transaction journal, dispute path or payment reversal.

Read [Payments](/payments/) for the full flow and the [contract reference](/contracts/) for AeroPay's exact behavior.

## Pay

Pay is the broadest and least complete product area. In the current app it consists of four related surfaces:

| Surface | What the user sees | What is real |
|---|---|---|
| Pay a handle | The normal memo-bearing transfer form with a resolved recipient. | Fuji token transfer. |
| Request | A shareable request link with a prefilled amount and memo. | A link and form prefill. No enforceable receivable or request ledger. |
| Bill presets | Cards such as rent or utilities that fill recipient, amount and memo. | The same ordinary tUSDC transfer. No biller integration. |
| Buy with card | A card-shaped checkout sheet with preset test packs. | A simulated card step and a Fuji transfer from AeroBank's pre-funded inventory. No fiat charge. |

This is intentionally documented as **Partial** and **Mock**, not as a live bill-payment or card product. The roadmap puts a real provider adapter, authenticated provider responses, reversal handling, idempotency and reconciliation after the identity, ledger and security milestones.

## Earn

Earn has two code paths, and neither is a live yield product.

### AeroVault

AeroVault is an explicit mock. Its owner sets a rate per second, and `accrue()` increases a share index mathematically. It does not deposit into a lending market. The supplied deployment seeds finite tUSDC inventory as a subsidy; accrual can therefore exceed funded inventory over time. {{badge:Mock}}

### AeroRouter

AeroRouter is a more serious accounting implementation. It holds shares, values only the adapter shares it owns, supports idle assets and donations, and withdraws through adapters with measured balance checks. But the supplied integrated deployment script creates **MockQiToken** markets labeled as Benqi and Trader Joe mocks. There is no verified live Benqi or Trader Joe integration. {{badge:Mock}} {{badge:Partial}}

Router allocation is a static owner-set target. `rebalance()` restores those targets; it does not search for the highest yield. Withdrawals are synchronous and all-or-nothing. There is no reserve, queue, partial exit or guaranteed liquidity.

Read [Yield infrastructure](/yield/) for the deposit, allocation, adapter and withdrawal diagrams.

## What the product is not

The following statements are not supported and must not be inferred from the interface:

- that tUSDC is USDC or has monetary value;
- that Aero has completed an independent security audit or is production-ready;
- that Earn is connected to live Benqi, Trader Joe or any other market;
- that a biller, card processor or bank is integrated;
- that a transaction hash alone means a payment is final;
- that withdrawals are instant or guaranteed;
- that Aero L1 or ICM is part of the consumer payment flow;
- that a connected wallet is an authenticated Aero account.

## Why ship the sandbox first

The sandbox exposes the hard parts early: wallet UX, handle resolution, token approvals, transaction status, share accounting and the difference between a UI state and a durable financial record. It also makes the boundaries testable. The release gate and decision register were built before convenience features because a convincing payment interface is easy to make and a trustworthy one is not.

The next product work is not another surface. It is account and wallet ownership, a durable payment state machine, reconciliation, and a reviewed yield deployment. The [roadmap](/roadmap/) orders that work explicitly.
