## Two independent deployments

Aero has two deployable surfaces:

| Surface | Source | Output |
|---|---|---|
| Main app | repository root | Next.js server/build with marketing, waitlist, sandbox and identity APIs. |
| Documentation | `docs/` | Static HTML, CSS, JS and JSON in `docs/dist/`. |

The docs app deliberately does not import the Next.js app, its components or its environment. That keeps the docs independently buildable and deployable at `https://docs.useaero.org`.

> **The domain is not serving this build yet.** `docs.useaero.org` resolves, but it currently points at the main marketing deployment: the root returns the marketing page and docs deep links such as `/product/` return 404. Attaching this static build to the domain requires an authorized hosting/DNS change. This page documents the requirement; it does not perform it.

## Build the docs

```bash
cd docs
npm ci
npm run build
npm run validate
```

Output:

```text
docs/dist/
  index.html
  assets/
    app.js
    favicon.png
    styles.css
  architecture/index.html
  product/index.html
  ... one directory per page
  search-index.json
  sitemap.xml
  robots.txt
  404.html
  build-manifest.json
```

The build is deterministic apart from `generatedAt` in `build-manifest.json`. It fails if a navigation item has no markdown file. `npm run validate` checks page output, internal links, required diagrams, metadata and assets.

## Host requirements

The host must:

- serve `index.html` for `/`;
- serve `<route>/index.html` for clean URLs such as `/architecture/`;
- serve `404.html` for unknown routes;
- serve `/search-index.json` as JSON;
- serve `/assets/vendor/mermaid.min.js` as JavaScript; it is bundled at build time;
- set a correct `Content-Type` for `.svg`, `.css`, `.js` and `.json`.

No server-side runtime, database or environment variable is required to render the docs.

### Suggested caching

| Path | Suggested cache |
|---|---|
| `/assets/*` | Long-lived immutable cache with a content hash or deployment ID. |
| `/*.html` | Short cache or revalidate. |
| `/search-index.json` | Short cache or revalidate. |
| `/sitemap.xml`, `/robots.txt` | Short cache. |

### Suggested security headers

These are recommendations, not a claim that a host currently sets them:

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Mermaid is bundled locally at `docs/dist/assets/vendor/mermaid.min.js`; the docs site makes no CDN request. If the bundle is missing, the build fails. If a CSP blocks the local script, diagrams show their source.

## Custom domain checklist

{{badge:Blocked}} The following requires explicit authorization:

1. Choose the hosting provider for the static output.
2. Create a project/site whose root directory is `docs` and build command is `npm run build`.
3. Set the output directory to `dist`.
4. Add `docs.useaero.org` as a custom domain in the host.
5. Create the DNS record the host requires (often a `CNAME` to the host target).
6. Wait for TLS certificate issuance.
7. Verify `/`, `/status/`, a deep link, `/search-index.json`, `/sitemap.xml` and `/404.html`.
8. Confirm the main-site Documentation links, which already target `https://docs.useaero.org`, resolve; only then announce the docs site.

Do not change DNS, TLS or production hosting settings without the owner's authorization. Do not commit provider-specific credentials.

## Main app release

The main app is gated separately:

```bash
AERO_RELEASE_ENVIRONMENT=testnet
NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT=testnet
AERO_RELEASE_CHAIN_ID=43113
NEXT_PUBLIC_AERO_RELEASE_CHAIN_ID=43113
npm run build
```

`prebuild` runs `release:check`. The production allowlist is empty, so a production release fails closed. Beta is rejected.

The testnet sandbox needs the Reown project ID, Fuji contract addresses and a configured RPC. The identity API additionally needs a migrated Neon/Postgres schema, a canonical origin, a session secret and a least-privilege runtime role. Those are not applied by a build.

## Contract deployment

B2.2 produced an authorization-readiness report, not a deployment:

- nine-transaction fresh mock-market stack;
- simulation only, no `--broadcast`;
- no nonce or balance change;
- predicted addresses not trusted;
- `lib/fuji-router-manifest.ts` still empty.

A broadcast requires explicit approval, a funded Fuji test key, receipt verification, independent address/runtime-hash checks and a reviewed change to the manifest. Do not configure the frontend from a partial deployment.

## Identity deployment

The identity migration and runtime role are separate operations:

```bash
npm run migrate:identity
npm run identity:provision-roles
```

Use an owner/admin credential only for migration/provisioning. The running app must use `AERO_IDENTITY_DATABASE_URL` with the least-privilege role. Startup never migrates. Keep signup closed until an approved enrollment flow exists.

## Smoke checks

### Docs

- [ ] `/` renders the hero and navigation.
- [ ] `/status/` and `/architecture/` render.
- [ ] A deep link such as `/yield/#withdrawal` scrolls to the heading.
- [ ] Search returns results from `search-index.json`.
- [ ] Mermaid diagrams render, or show readable source.
- [ ] Code blocks copy.
- [ ] Mobile sidebar opens and closes.
- [ ] `robots.txt` and `sitemap.xml` point at `docs.useaero.org`.
- [ ] No page claims live yield, production readiness or final payment from a hash.

### Main app

- [ ] Release gate passes for the intended category.
- [ ] Fuji chain ID matches on server and browser.
- [ ] Wallet connects to Fuji and wrong-network behavior is visible.
- [ ] Testnet contract addresses are the intended sandbox set.
- [ ] Identity endpoints fail closed if the database is absent.
- [ ] No production allowlist entry, secret or deployer key is present in the artifact.

## Rollback

The docs are static. Roll back by redeploying the previous `dist/` artifact or the previous commit. The main app and docs are independent, so a docs rollback does not require an app rollback. Contract deployments are not reversible; a bad broadcast requires an incident process and a fresh reviewed deployment, not a frontend workaround.

See [Security](/security/) for controls and [Developer guide](/developers/) for the local setup.
