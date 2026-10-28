## Local prerequisites

| Tool | Version / purpose |
|---|---|
| Node.js | 20 or newer. The app uses Next.js 16 and React 19. |
| npm | Comes with Node. The repository uses `package-lock.json`. |
| Foundry | `forge` for contract build and tests. |
| A Fuji wallet | A throwaway EOA and Fuji AVAX for gas. Never use a real-value wallet. |
| Reown project ID | Required for the wallet connector configuration. |

Aero is a Fuji sandbox. Do not point local development at a production key, a production database or real funds.

## Run the main app

{{widget:pkg-install}}

```bash
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for the marketing site and `http://localhost:3000/testnet` for the sandbox. In production-style routing, `testnet.useaero.org` is rewritten to `/testnet` by middleware.

A release build fails closed unless the environment is explicit:

```bash
AERO_RELEASE_ENVIRONMENT=testnet
NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT=testnet
AERO_RELEASE_CHAIN_ID=43113
NEXT_PUBLIC_AERO_RELEASE_CHAIN_ID=43113
npm run build
```

`npm run dev` does not run the `prebuild` gate. A production mode build still requires an explicit Fuji testnet classification before exposing the sandbox.

## Environment variables

Names only — never commit values.

### Release and testnet

```bash
AERO_RELEASE_ENVIRONMENT=
NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT=
AERO_RELEASE_CHAIN_ID=
NEXT_PUBLIC_AERO_RELEASE_CHAIN_ID=
NEXT_PUBLIC_REOWN_PROJECT_ID=
NEXT_PUBLIC_TEST_USDC=
NEXT_PUBLIC_AERO_VAULT=
NEXT_PUBLIC_AERO_NAMES=
NEXT_PUBLIC_ROUTER=
NEXT_PUBLIC_AEROPAY=
NEXT_PUBLIC_BANK=
```

### Waitlist and admin

```bash
RESEND_API_KEY=
WAITLIST_FROM=
WAITLIST_NOTIFY=
WAITLIST_SECRET=
DATABASE_URL=
ADMIN_PASSWORD=
```

The waitlist uses Neon when `DATABASE_URL` exists; otherwise it uses a local JSONL file. The local fallback is not shared durable storage.

### Identity

```bash
AERO_IDENTITY_MIGRATION_DATABASE_URL=
AERO_IDENTITY_DATABASE_URL=
AERO_AUTH_ORIGIN=
AERO_FUJI_RPC_URL=
AERO_TRUST_PROXY=none
AERO_IDENTITY_POOL_MAX=5
AERO_SESSION_SECRET=
AERO_SESSION_IDLE_SECONDS=43200
AERO_SESSION_ABSOLUTE_SECONDS=604800
AERO_IDENTITY_RETENTION_POLICY_APPROVED=false
AERO_IDENTITY_RETENTION_DAYS=
```

Provisioning-only values (`AERO_IDENTITY_ADMIN_DATABASE_URL`, `AERO_IDENTITY_RUNTIME_ROLE`, `AERO_IDENTITY_RUNTIME_PASSWORD`) must never be set in the running application. The runtime URL must use the least-privilege role, not the owner/migration URL.

## Checks

```bash
npm run typecheck
npm run lint
npm run test:release-gate
npm run build
```

```bash
cd tests
# identity tests require a disposable Postgres and live Fuji RPC configuration
node --test identity/*.test.mjs
```

```bash
cd contracts
forge build
forge test
```

The recorded contract result is 67 passing tests after the deployment preflight fix. Fork tests are guarded and were not run against a live fork in the recorded milestone.

## Contracts

```bash
cd contracts
forge build
forge test
```

Deployment scripts are **not** a local quickstart. They require a funded Fuji test key and explicit broadcast authorization. The B2.2 report simulated a nine-transaction mock stack without broadcasting. Do not run a broadcast because a script exists.

```text
contracts/
  src/
    TestUSDC.sol
    AeroNames.sol
    AeroPay.sol
    AeroBank.sol
    AeroVault.sol
    AeroRouter.sol
    BenqiAdapter.sol
    MockQiToken.sol
    interfaces/
  script/
    Deploy.s.sol
    DeployMore.s.sol
    DeployBenqi.s.sol
    Seed.s.sol
  test/
  foundry.toml
```

## Identity migration runbook

The full runbook is in `AERO_M1B_IMPLEMENTATION_REPORT.md`. The shape is:

1. Use an owner/admin credential for migration only.
2. Set `AERO_IDENTITY_MIGRATION_DATABASE_URL` (preferred) or the documented owner URL.
3. Run `npm run migrate:identity`. Confirm `001`, `002` and `003` checksums.
4. Provision the runtime role with `npm run identity:provision-roles`.
5. Set `AERO_IDENTITY_DATABASE_URL` to the runtime-role URL.
6. Verify audit triggers and limiter denials.
7. Keep signup closed.

Application startup never migrates. Do not compensate for a failed role provision by granting the runtime owner or DDL rights.

## Repository map

| Path | Purpose |
|---|---|
| `app/` | Next.js routes, waitlist/admin APIs, identity APIs, testnet and docs pages. |
| `components/aero/` | Marketing, navigation, docs shell and brand components. |
| `components/testnet/` | Send/Pay/Earn UI, identity panel, terminal, buy sheet. |
| `lib/contracts/` | Typed ABIs used by the frontend. |
| `lib/identity/` | SIWE, sessions, rate limits, database access, retention guard. |
| `lib/release-gates.mjs` | Environment and production allowlist validation. |
| `lib/fuji-router-manifest.ts` | Intentionally empty trusted router manifest. |
| `migrations/identity/` | Additive identity migrations. |
| `contracts/` | Foundry project. |
| `tests/identity/` | Identity integration tests. |
| `docs/` | This standalone static documentation app. |
| `public/brand/` | Brand artwork. |

## Build the docs

```bash
cd docs
npm install
npm run build
npm run validate
npm run dev
```

`npm run dev` serves the built `dist/` folder locally. The output is static HTML, CSS, JS, `search-index.json`, `sitemap.xml` and `robots.txt`. Deployment details are in [Deployment and operations](/operations/).

## Docs authoring

1. Add a markdown file under `docs/src/content/`.
2. Add its file and slug to `docs/src/nav.mjs`.
3. Use `{{badge:Implemented}}`, `{{badge:Mock}}` and the other status labels.
4. Use a fenced `mermaid` block for diagrams.
5. Run `npm run build && npm run validate`.

The build fails if a navigation item has no content file. It does not silently ship a blank page.

## What not to do

- Do not commit `.env.local`, `contracts/.env`, deployer files, private keys or database URLs.
- Do not publish B2.2 predicted addresses as deployment identities.
- Do not populate `lib/fuji-router-manifest.ts` without a reviewed, independently verified deployment.
- Do not run a broadcast or migration without explicit authorization.
- Do not describe tUSDC, mock markets or simulated card settlement as real.
