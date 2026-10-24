/**
 * Documentation navigation is deliberately explicit. Every page, its
 * category, order and search description lives here so the static build can
 * fail closed when a content file is missing or orphaned.
 *
 * `slug` is the URL path without a trailing slash. `home` is the root page.
 */
export const navigation = [
  {
    category: "Start here",
    items: [
      {
        slug: "home",
        file: "index",
        title: "Introduction",
        description: "What Aero is, what works today, and how to read this documentation.",
      },
      {
        slug: "product",
        file: "product/index",
        title: "Product",
        description: "Send, Pay and Earn today, plus the boundary between implemented, simulated and planned functionality.",
      },
      {
        slug: "status",
        file: "status/index",
        title: "Current status",
        description: "A candid status matrix for every product surface, with release-gate and test evidence.",
      },
    ],
  },
  {
    category: "System",
    items: [
      {
        slug: "architecture",
        file: "architecture/index",
        title: "System architecture",
        description: "How the browser, wallet, Next.js app, identity service, database and Fuji contracts fit together.",
      },
      {
        slug: "identity",
        file: "identity/index",
        title: "Identity and accounts",
        description: "Fuji EOA SIWE, linked wallets, server-side sessions, closed signup and the limits of an Aero session.",
      },
      {
        slug: "payments",
        file: "payments/index",
        title: "Payments",
        description: "Username resolution, AeroPay, payment requests, bill presets and the simulated card checkout.",
      },
      {
        slug: "yield",
        file: "yield/index",
        title: "Yield infrastructure",
        description: "AeroVault, AeroRouter, adapters, mock markets, allocation, withdrawals and the limits of both yield paths.",
      },
      {
        slug: "aero-l1",
        file: "aero-l1/index",
        title: "Aero Avalanche L1",
        description: "The separate L1/ICM workstream, what is not verified, and why it is not part of the consumer app today.",
      },
    ],
  },
  {
    category: "Engineering",
    items: [
      {
        slug: "security",
        file: "security/index",
        title: "Security and engineering",
        description: "Threat boundaries, release gates, identity safeguards, contract controls and known gaps.",
      },
      {
        slug: "developers",
        file: "developers/index",
        title: "Developer guide",
        description: "Run the app and contracts locally, understand the environment variables, and find the right source file.",
      },
      {
        slug: "contracts",
        file: "contracts/index",
        title: "Contract reference",
        description: "AeroNames, AeroPay, AeroBank, AeroVault, AeroRouter and BenqiAdapter behavior and limitations.",
      },
      {
        slug: "operations",
        file: "operations/index",
        title: "Deployment and operations",
        description: "Build the docs site, deploy it independently at docs.useaero.org, and understand the release gates.",
      },
      {
        slug: "roadmap",
        file: "roadmap/index",
        title: "Roadmap",
        description: "Milestones M0–M6, dependency ordering and the work that must happen before real value.",
      },
    ],
  },
]

export const flatNavigation = navigation.flatMap((group) =>
  group.items.map((item) => ({ ...item, category: group.category }))
)

export const site = {
  name: "Aero",
  product: "Docs",
  domain: "https://docs.useaero.org",
  website: "https://useaero.org",
  testnet: "https://testnet.useaero.org",
  repository: "https://github.com/danielamodu/Aero",
  tagline: "Money that moves like a message.",
  lastReviewed: "2026-10-23",
}
