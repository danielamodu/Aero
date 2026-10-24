# Aero README and Documentation Revamp Report

Date: 2026-10-24
Scope: root `README.md`, a standalone documentation site under `docs/`, README artwork under `assets/readme/`, and public Documentation links in the main app.
Status: implementation complete; docs deployment is **not** authorized or attached to the domain.

## 1. What changed

### Root README

`README.md` was rewritten as a product landing page that can be read in about five minutes. It now covers:

- the introduction and the “Money that moves like a message.” positioning;
- a Send / Pay / Earn matrix with exact status labels;
- genuine product captures and the sandbox boundary;
- a high-level architecture diagram and the wallet/contract trust boundary;
- evidence-backed status and blockers;
- stack, repository structure and local development commands;
- the M0–M6 roadmap and the separately scoped Aero L1 workstream;
- security posture, contribution rules and the documentation map;
- links to `https://useaero.org`, `https://docs.useaero.org`, the Fuji sandbox and GitHub.

The README does not claim production readiness, an audit, live Benqi/Joe yield, an integrated Aero L1, instant withdrawals, or finality from a transaction hash.

### Standalone documentation site

Created `docs/` as an independent static application with its own `package.json`, build and validation scripts. It does not import the Next.js app, its components or its environment.

- 13 content pages: Introduction, Product, Current status, Architecture, Contracts, Identity, Payments, Yield, Aero L1, Security, Developers, Operations, Roadmap.
- 11 Mermaid diagrams: high-level architecture, payment flow, wallet authentication, yield deposit/allocation, withdrawal, router/adapter relationship, Aero L1/ICM, plus milestone and dependency diagrams.
- Sidebar navigation with categories, mobile drawer, breadcrumbs, previous/next pager, deep links, search overlay, copyable code blocks, syntax highlighting, diagram zoom and a link back to `https://useaero.org`.
- Locally vendored Mermaid (`mermaid@11.12.0`); the built site makes **no CDN request** for diagrams.
- Search index generated at build time and served as `/search-index.json`.
- `sitemap.xml`, `robots.txt`, `404.html`, canonical URLs and Open Graph metadata for `https://docs.useaero.org`.

Key files:

| File | Purpose |
|---|---|
| `docs/src/nav.mjs` | Explicit navigation, categories, slugs, titles, descriptions |
| `docs/scripts/build.mjs` | Static generator, Markdown rendering, badges, search index, Mermaid copy |
| `docs/scripts/validate.mjs` | Fails on missing pages, broken internal links, missing diagrams or placeholders |
| `docs/src/assets/app.js` | Search, mobile nav, copy code, Mermaid loader, diagram zoom |
| `docs/src/assets/styles.css` | Responsive docs layout and components |
| `docs/src/content/**` | Page content |

### Main-site Documentation links

`components/aero/page-shell.tsx` and `components/aero/landing.tsx` now point public Documentation links at `https://docs.useaero.org` and use `target="_blank" rel="noopener noreferrer"`.

The existing embedded `/docs` page was left in place because removing or redirecting it would change unrelated product behavior. It is no longer linked from the public header or footer.

### Contract documentation

`contracts/docs/AeroRouter.md` was rewritten to separate the implemented sandbox contract from the mainnet design direction. It documents:

- share accounting, virtual shares, deposit splitting, all-or-nothing withdrawals and measured adapter deltas;
- owner powers, adapter binding, `ORPHANED_ASSETS` recovery and the absence of pause, timelock, proxy or governance;
- what is not implemented, including live Benqi/Joe markets, APY optimization, keeper incentives, withdrawal queues, ICM and fees;
- the B2.2 simulation-only deployment status and the intentionally empty `lib/fuji-router-manifest.ts`.

### README artwork

Created under `assets/readme/`:

| Asset | Description |
|---|---|
| `aero-logo-light.svg` | Traced vector light lockup; valid XML |
| `aero-logo-dark.svg` | Traced vector dark lockup; valid XML |
| `hero.svg` | 1280×460 brand banner: “Send. Pay. Earn.”, Fuji status panel, test-token disclaimer |
| `product-landing.png` | Genuine capture of the running marketing site |
| `product-testnet.png` | Genuine capture of the Fuji sandbox entry gate |
| `product-docs.png` | Genuine capture of the built documentation site |
| `product-showcase.png` | 2200×1000 composition of the three genuine captures, preserving aspect ratios |

No demo GIF was produced. The sandbox requires a connected wallet, and a genuine walkthrough could not be recorded without one. Fabricating a demo was explicitly avoided.

## 2. Design decisions

- **Brand continuity.** Reused the existing Aero identity: primary blue `#1800AD`, near-black navy, white and muted lavender accents. No new palette was invented.
- **Hero hierarchy.** The SVG banner carries the product verbs and status; the README headline carries the tagline as selectable text. This avoids duplicating the tagline in both places.
- **Theme-aware logos.** Light and dark lockups are provided as `<picture>`-ready SVGs. The hero uses a white lockup on the dark gradient so it works in both GitHub themes.
- **Status language over marketing language.** Every surface uses one of the required labels: Implemented, Tested, Fuji testnet, Mock/demo, Partially implemented, Planned, Blocked, Not supported.
- **Boundary first.** The README states the sandbox boundary before the feature matrix, and the docs repeat it on the Product and Status pages.
- **Evidence over adjectives.** Test counts, build results and blockers are stated as recorded evidence, not as guarantees.
- **Dependency-light docs.** A small Node generator with `marked`, `highlight.js` and a local Mermaid bundle avoids a framework migration and keeps the docs independently deployable.
- **No fake infrastructure.** No CI badge, no “audited” badge, no production URL and no implied GitHub Actions workflow.

## 3. Screenshot sources

All product captures are real screenshots of the running application or the built docs site, not mockups:

- `product-landing.png`: `http://localhost:3000/` at 1440×1000.
- `product-testnet.png`: `http://localhost:3000/testnet` at 1440×1100.
- `product-docs.png`: the locally built docs site at 1440×1000.
- `product-showcase.png`: composed from those three captures at 2200×1000.

The screenshots show the public surfaces only. The authenticated Send/Pay/Earn dashboard requires a wallet connection and was not captured. The README labels the in-page product illustration as illustrative and does not present it as a live dashboard.

## 4. Claims verified against source and checks

| Claim | Evidence |
|---|---|
| Fuji sandbox only; tUSDC has no cash value | `TestUSDC`, product copy, release gate, docs status matrix |
| Send uses `AeroNames` and `AeroPay` with a direct-transfer fallback | `contracts/src/AeroNames.sol`, `AeroPay.sol`, `components/testnet/*`, `AeroPay` tests |
| Earn uses a synthetic `AeroVault` and an `AeroRouter` over mock Qi markets | `AeroVault.sol`, `AeroRouter.sol`, `BenqiAdapter.sol`, `MockQiToken.sol`, integration script |
| No live Benqi/Joe market | No live adapter deployment; docs and README state this |
| Identity is implemented in source but blocked operationally | `lib/identity/*`, migrations, M1B report; signup closed, Neon migration not applied |
| Release gate fails closed | 10/10 `test:release-gate` tests; production allowlist empty |
| Contracts pass their suites | 67/67 Foundry tests passed |
| Docs build and internal links pass | 13 pages, 14 HTML files, 280 internal links, 11 diagrams, 13 search entries |
| Fuji-configured app build succeeds | Next.js 16.4.0 build generated 26 static pages |
| No GitHub Actions workflow | No `.github/workflows` in the repository |
| No open-source license | No `LICENSE` file |

## 5. Simulated, partial, planned and blocked functionality

The README and docs explicitly identify:

- **Mock/demo:** card checkout, bill presets, `AeroVault` synthetic yield, mock Qi markets, illustrative product screens.
- **Partially implemented:** `AeroRouter` accounting exists, but live-market integration and production acceptance do not; Pay prefills a transfer but has no biller or processor.
- **Blocked:** production asset/chain, deployment manifest, independent audit, Neon production migration, browser two-wallet E2E, live yield.
- **Planned:** durable payment ledger, reconciliation, biller integrations, fiat/card processing, monitoring and CI.
- **Not supported:** consumer Aero L1/ICM cross-chain payments.
- **B2.2:** simulation only; no transaction was broadcast; predicted addresses are not trusted deployment identities.

Withdrawals are documented as synchronous and all-or-nothing, not instant. A transaction hash is explicitly not treated as payment finality or reconciliation.

## 6. Validation results

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run test:release-gate` | Passed, 10/10 |
| Fuji-configured `npm run build` | Passed, 26 static pages |
| `forge test --summary` | Passed, 67/67 |
| Docs `npm run build` | Passed, 13 pages, 11 diagrams |
| Docs `npm run validate` | Passed, 14 HTML files, 280 internal links, 11 diagrams, 13 search entries |
| SVG XML parsing | Passed for all three SVGs |
| PNG dimension and file checks | Passed for all four PNGs |
| README relative asset/link check | Passed |
| CDN references in built docs | None (only explanatory text in the Operations page) |
| `git diff --check` | Passed (line-ending warnings only) |
| Secret scan of changed docs/README | No keys, database URLs or credentials found |

### Known warnings and failures

- `npm run lint` is **not clean repository-wide**. It reports 266 errors, predominantly from vendored OpenZeppelin/generated JavaScript being scanned by the root ESLint configuration. Targeted lint of the two changed app files reports only pre-existing issues: two `<a href="/">` errors in `page-shell.tsx` and two warnings in `landing.tsx`. The changed lines introduced no new lint errors.
- Next.js build emits pre-existing warnings about the deprecated `middleware` convention and a missing `metadataBase`.
- Next.js 16.4.0 is flagged by an npm security advisory. The first build stopped at the reminder; a retry continued and completed. The upgrade recommendation was not applied because it is outside this task and may introduce breaking changes.
- Browser two-wallet end-to-end identity testing was not run.
- The authenticated sandbox dashboard could not be captured without a wallet.

## 7. Domain and deployment status

`docs.useaero.org` resolves through Vercel DNS, but the domain currently points at the **main marketing deployment**:

- `https://docs.useaero.org/` returns the marketing page (HTTP 200);
- `https://docs.useaero.org/product/` and `/status/` redirect and then return HTTP 404;
- the new static build in `docs/dist/` has **not** been deployed.

Attaching the docs build to the domain requires an authorized hosting/DNS change. No DNS record, Vercel project, production setting or deployment was modified. The README and Operations page state this limitation rather than claiming the docs are live.

The main-site Documentation links already target `https://docs.useaero.org` as required, but they will reach the main marketing app until the docs deployment is attached. This is the one user-visible gap in the revamp.

## 8. Limitations

- No independent audit; no production readiness.
- No live Benqi or Trader Joe integration; yield is simulated.
- No durable payment ledger or reconciliation.
- No biller, card processor, fiat ramp or dispute flow.
- No verified Aero L1 deployment or consumer cross-chain path.
- No docs deployment to the domain.
- No genuine product walkthrough GIF.
- Repository-wide lint remains red for pre-existing reasons.

## 9. Files and repository hygiene

Changed or created:

- `README.md`
- `components/aero/landing.tsx`
- `components/aero/page-shell.tsx`
- `contracts/docs/AeroRouter.md`
- `docs/**`
- `assets/readme/**`
- `AERO_README_REVAMP_REPORT.md`

Not modified: contract logic, deployment scripts, identity/auth logic, production configuration, schemas, trusted deployment manifest, DNS or hosting.

No secrets, private keys, credentials or deployer-file contents were included in tracked files. Nothing was committed or pushed. Unrelated uncommitted work was preserved.
