#!/usr/bin/env node
/**
 * Aero documentation static build.
 *
 * The docs site is deliberately a separate application with no runtime server,
 * no framework lock-in and no dependency on the main Next.js app. Markdown is
 * compiled to static HTML, code is highlighted at build time, and Mermaid
 * diagrams are rendered in the browser from embedded diagram source.
 */
import { mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Marked } from "marked"
import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import plaintext from "highlight.js/lib/languages/plaintext"
import solidityPlugin from "highlightjs-solidity"
import sql from "highlight.js/lib/languages/sql"
import ini from "highlight.js/lib/languages/ini"
import typescript from "highlight.js/lib/languages/typescript"
import { flatNavigation, navigation, site } from "../src/nav.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const contentDir = path.join(root, "src", "content")
const assetDir = path.join(root, "src", "assets")
const outDir = path.join(root, "dist")
const baseUrl = site.domain.replace(/\/$/, "")

hljs.registerLanguage("bash", bash)
hljs.registerLanguage("shell", bash)
hljs.registerLanguage("javascript", javascript)
hljs.registerLanguage("js", javascript)
hljs.registerLanguage("json", json)
hljs.registerLanguage("plaintext", plaintext)
hljs.registerLanguage("text", plaintext)
solidityPlugin(hljs)
hljs.registerLanguage("sql", sql)
hljs.registerLanguage("ini", ini)
hljs.registerLanguage("toml", ini)
hljs.registerLanguage("typescript", typescript)
hljs.registerLanguage("ts", typescript)

const BADGES = {
  implemented: "is-implemented",
  tested: "is-tested",
  fuji: "is-fuji",
  mock: "is-mock",
  partial: "is-partial",
  planned: "is-planned",
  blocked: "is-blocked",
  "not-supported": "is-unsupported",
  design: "is-planned",
  verification: "is-verification",
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

function routeFor(file) {
  if (file === "index") return "/"
  return `/${file.replace(/\/index$/, "")}/`
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) return { data: {}, body: raw }
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")
    if (key) data[key] = value
  }
  return { data, body: raw.slice(match[0].length) }
}

function makeRenderer(page) {
  const headings = []
  const seen = new Map()
  const renderer = {
    heading({ text, depth }) {
      const plain = text
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .trim()
      let id = slugify(plain) || `section-${headings.length + 1}`
      if (seen.has(id)) {
        const next = (seen.get(id) || 1) + 1
        seen.set(id, next)
        id = `${id}-${next}`
      } else {
        seen.set(id, 1)
      }
      const anchor = depth > 1
        ? `<a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(plain)}">#</a>`
        : ""
      if (depth === 2 || depth === 3) headings.push({ id, text: plain, depth })
      return `<h${depth} id="${id}" class="doc-heading">${anchor}${escapeHtml(plain)}</h${depth}>`
    },
    code({ text, lang }) {
      const language = (lang || "").trim().toLowerCase()
      if (language === "mermaid") {
        page.mermaid += 1
        const id = `mermaid-${page.mermaid}`
        return `<div class="diagram" data-diagram="${id}"><div class="diagram-head"><span>Diagram</span><span class="diagram-source-label">Mermaid</span></div><pre class="mermaid" id="${id}">${escapeHtml(text)}</pre></div>`
      }
      const supported = language && hljs.getLanguage(language)
      const highlighted = supported
        ? hljs.highlight(text, { language, ignoreIllegals: true }).value
        : escapeHtml(text)
      const label = language || "text"
      return `<div class="code-block"><div class="code-head"><span>${escapeHtml(label)}</span><button type="button" class="copy-code" data-copy>Copy</button></div><pre><code class="hljs language-${escapeHtml(supported ? language : "plaintext")}">${highlighted}</code></pre></div>`
    },
    html({ text }) {
      return escapeHtml(text)
    },
  }
  return { renderer, headings }
}

function badgeHtml(label, detail) {
  const key = label.trim().toLowerCase()
  const cls = BADGES[key] || "is-neutral"
  const detailHtml = detail ? ` <span class="badge-detail">${escapeHtml(detail.trim())}</span>` : ""
  return `<span class="status-badge ${cls}"><span class="status-dot"></span>${escapeHtml(label.trim())}${detailHtml}</span>`
}

function renderMarkdown(raw, page) {
  const { body } = parseFrontmatter(raw)
  // Badges are rendered as HTML after Markdown parsing. Inline HTML is escaped
  // by the renderer for safety, so a placeholder token survives tables and
  // inline text without exposing arbitrary HTML authoring in content files.
  const badges = []
  const withBadges = body.replace(/\{\{badge:([^}|]+)(?:\|([^}]+))?\}\}/g, (_, label, detail) => {
    const token = `AEROBADGE${badges.length}TOKEN`
    badges.push(badgeHtml(label, detail))
    return token
  })
  const { renderer, headings } = makeRenderer(page)
  const marked = new Marked({ gfm: true, breaks: false })
  marked.use({ renderer })
  const parsed = marked.parse(withBadges)
  const html = parsed.replace(/AEROBADGE(\d+)TOKEN/g, (_, index) => badges[Number(index)] ?? "")
  return { html, headings }
}

function readingTime(html) {
  const words = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

function navHtml(activeFile) {
  return navigation
    .map(
      (group) => `<div class="nav-group">
        <p class="nav-label">${escapeHtml(group.category)}</p>
        <ul class="nav-list">
          ${group.items
            .map(
              (item) => `<li>
                <a class="nav-link${item.file === activeFile ? " is-active" : ""}" href="${routeFor(item.file)}"${item.file === activeFile ? ' aria-current="page"' : ""}>
                  <span>${escapeHtml(item.title)}</span>
                </a>
              </li>`
            )
            .join("")}
        </ul>
      </div>`
    )
    .join("")
}

function tocHtml(headings) {
  if (headings.length < 2) return ""
  return `<aside class="page-toc" aria-label="On this page">
    <p class="toc-label">On this page</p>
    <nav>
      ${headings
        .map(
          (heading) => `<a class="toc-link toc-depth-${heading.depth}" href="#${heading.id}">${escapeHtml(heading.text)}</a>`
        )
        .join("")}
    </nav>
  </aside>`
}

function breadcrumbHtml(page, item) {
  if (page.file === "index") {
    return `<nav class="breadcrumbs" aria-label="Breadcrumb"><span>Docs</span></nav>`
  }
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Docs</a><span class="crumb-sep">/</span>
    <span>${escapeHtml(item.category)}</span><span class="crumb-sep">/</span>
    <span aria-current="page">${escapeHtml(item.title)}</span>
  </nav>`
}

function prevNextHtml(page, index) {
  const previous = flatNavigation[index - 1]
  const next = flatNavigation[index + 1]
  if (!previous && !next) return ""
  return `<nav class="page-pager" aria-label="Previous and next pages">
    ${previous
      ? `<a class="pager-card pager-prev" href="${routeFor(previous.file)}"><span class="pager-kicker">Previous</span><span class="pager-title">${escapeHtml(previous.title)}</span></a>`
      : `<span></span>`}
    ${next
      ? `<a class="pager-card pager-next" href="${routeFor(next.file)}"><span class="pager-kicker">Next</span><span class="pager-title">${escapeHtml(next.title)}</span></a>`
      : `<span></span>`}
  </nav>`
}

function layout({ page, item, content, headings, index }) {
  const isHome = page.file === "index"
  const title = isHome ? "Aero documentation" : `${item.title} — Aero Docs`
  const description = item.description
  const canonical = `${baseUrl}${routeFor(page.file)}`
  const hero = isHome
    ? `<section class="home-hero">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-orb hero-orb-one" aria-hidden="true"></div>
        <div class="hero-orb hero-orb-two" aria-hidden="true"></div>
        <div class="hero-copy">
          <div class="hero-eyebrow"><span class="live-dot"></span> Fuji sandbox · Documentation</div>
          <h1>Money that moves<br><span>like a message.</span></h1>
          <p class="hero-lede">Aero is building username payments, everyday payment experiences, and yield on eligible stablecoins. Try the current Fuji sandbox with worthless test tokens and simulated services.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="${site.testnet}" target="_blank" rel="noopener noreferrer">Try the testnet <span aria-hidden="true">→</span></a>
            <a class="button button-ghost" href="/status/">Read current status</a>
          </div>
          <div class="hero-meta">
            <span>Avalanche Fuji sandbox</span>
            <span>tUSDC · no cash value</span>
          </div>
        </div>
      </section>`
    : `<header class="page-header">
        ${breadcrumbHtml(page, item)}
        <div class="page-kicker">${escapeHtml(item.category)}</div>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="page-description">${escapeHtml(item.description)}</p>
        <div class="page-meta"><span>Last reviewed ${escapeHtml(site.lastReviewed)}</span><span>Fuji testnet documentation</span><span>${readingTime(content)} min read</span></div>
      </header>`

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta name="theme-color" content="#1800AD">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Aero Docs">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <link rel="icon" href="/assets/favicon.png" type="image/png">
  <link rel="apple-touch-icon" href="/assets/favicon.png">
  <link rel="stylesheet" href="/assets/styles.css">
  <script defer src="/assets/app.js"></script>
</head>
<body data-page="${escapeHtml(page.file)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="topbar">
    <div class="topbar-inner">
      <button class="menu-toggle" type="button" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <a class="brand" href="/" aria-label="Aero documentation home">
        ${brandMark()}
        <span class="brand-text"><strong>AERO</strong><span>Docs</span></span>
      </a>
      <span class="topbar-divider" aria-hidden="true"></span>
      <span class="topbar-context">Fuji sandbox documentation</span>
      <div class="topbar-actions">
        <button class="search-trigger" type="button" aria-label="Search documentation" data-search-open>
          <span class="search-icon" aria-hidden="true"></span>
          <span class="search-label">Search docs</span>
          <kbd>⌘K</kbd>
        </button>
        <a class="topbar-link" href="/status/">Status</a>
        <a class="topbar-link" href="${site.website}" target="_blank" rel="noopener noreferrer">useaero.org <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </header>
  <div class="mobile-scrim" aria-hidden="true"></div>
  <div class="shell">
    <aside class="sidebar" id="sidebar" aria-label="Documentation navigation">
      <div class="sidebar-inner">
        <div class="sidebar-note">
          <span class="sidebar-note-label">Release status</span>
          <strong>Fuji testnet only</strong>
          <span>Test tokens have no cash value.</span>
        </div>
        ${navHtml(page.file)}
        <div class="sidebar-bottom">
          <a href="${site.testnet}" target="_blank" rel="noopener noreferrer">Open testnet <span aria-hidden="true">↗</span></a>
          <a href="${site.website}" target="_blank" rel="noopener noreferrer">Main website <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </aside>
    <main class="main" id="main-content">
      <article class="doc${isHome ? " doc-home" : ""}">
        ${hero}
        <div class="doc-content">${content}</div>
        ${prevNextHtml(page, index)}
      </article>
      ${tocHtml(headings)}
    </main>
  </div>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">${brandMark()}<span>Aero Docs</span></div>
      <p>${escapeHtml(site.tagline)}</p>
      <div class="footer-links">
        <a href="${site.website}" target="_blank" rel="noopener noreferrer">Website</a>
        <a href="${site.testnet}" target="_blank" rel="noopener noreferrer">Fuji sandbox</a>
        <a href="${site.repository}" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="/status/">Status</a>
      </div>
      <p class="footer-fine">Documentation reviewed ${escapeHtml(site.lastReviewed)}. Aero is a Fuji testnet sandbox, not a production financial service.</p>
    </div>
  </footer>
  <div class="search-overlay" hidden data-search-overlay>
    <div class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
      <div class="search-head">
        <span class="search-icon" aria-hidden="true"></span>
        <input id="search-title" type="search" placeholder="Search documentation…" autocomplete="off" spellcheck="false" data-search-input>
        <button type="button" class="search-close" aria-label="Close search" data-search-close>Esc</button>
      </div>
      <div class="search-results" data-search-results>
        <p class="search-empty">Type to search status, payments, yield, identity and architecture.</p>
      </div>
      <div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></div>
    </div>
  </div>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Aero Docs",
    url: baseUrl,
    description: "Documentation for Aero, a Fuji testnet sandbox for wallet-native payments and yield.",
  })}</script>
</body>
</html>`
}

function brandMark() {
  return `<svg class="brand-mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><rect x="8" y="8" width="80" height="22" rx="1"/><rect x="66" y="8" width="22" height="80" rx="1"/><path d="M51 27 15 63l14 14 38-34z"/></svg>`
}

function homeCards() {
  return `<div class="home-grid cards">
    <a class="home-card" href="/product/"><span class="card-index">01</span><h3>Product</h3><p>Send, Pay and Earn — with explicit labels for what is live, mock or planned.</p><span class="card-link">Read the product boundary →</span></a>
    <a class="home-card" href="/architecture/"><span class="card-index">02</span><h3>Architecture</h3><p>Follow a payment from the browser through the wallet, contracts and Fuji.</p><span class="card-link">Open the system map →</span></a>
    <a class="home-card" href="/status/"><span class="card-index">03</span><h3>Status</h3><p>The honest matrix: implemented, tested, simulated, partial, planned or blocked.</p><span class="card-link">Check current status →</span></a>
  </div>`
}

async function collectContent() {
  const pages = []
  for (const [index, item] of flatNavigation.entries()) {
    const filePath = path.join(contentDir, `${item.file}.md`)
    if (!existsSync(filePath)) {
      throw new Error(`Missing content file for nav item "${item.title}": ${filePath}`)
    }
    const raw = await readFile(filePath, "utf8")
    const page = { file: item.file, slug: item.slug, mermaid: 0, item, index }
    const { html, headings } = renderMarkdown(raw, page)
    pages.push({ ...page, raw, html, headings })
  }
  return pages
}

function searchIndex(pages) {
  return pages.map((page) => {
    const text = page.raw
      .replace(/^---[\s\S]*?---/, " ")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\{\{badge:([^}|]+)(?:\|([^}]+))?\}\}/g, "$1 $2")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, " ")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/[`*_>|]/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
    return {
      title: page.item.title,
      category: page.item.category,
      description: page.item.description,
      url: routeFor(page.file),
      headings: page.headings,
      text: text.slice(0, 12000),
    }
  })
}

function sitemap(pages) {
  const urls = pages
    .map(
      (page) => `  <url><loc>${baseUrl}${routeFor(page.file)}</loc><changefreq>weekly</changefreq><priority>${page.file === "index" ? "1.0" : "0.7"}</priority></url>`
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

async function main() {
  const pages = await collectContent()
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  for (const page of pages) {
    const content = page.file === "index" ? `${homeCards()}\n${page.html}` : page.html
    const html = layout({
      page,
      item: page.item,
      content,
      headings: page.headings,
      index: page.index,
    })
    const route = routeFor(page.file)
    const directory = route === "/" ? outDir : path.join(outDir, route.replace(/^\/|\/$/g, ""))
    await mkdir(directory, { recursive: true })
    await writeFile(path.join(directory, "index.html"), html, "utf8")
  }

  await writeFile(path.join(outDir, "search-index.json"), JSON.stringify(searchIndex(pages)), "utf8")
  await writeFile(path.join(outDir, "sitemap.xml"), sitemap(pages), "utf8")
  await writeFile(
    path.join(outDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`,
    "utf8"
  )
  await writeFile(
    path.join(outDir, "404.html"),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Aero Docs</title><link rel="stylesheet" href="/assets/styles.css"></head><body class="not-found"><main><a class="brand" href="/">${brandMark()}<span class="brand-text"><strong>AERO</strong><span>Docs</span></span></a><p class="eyebrow">404</p><h1>That page moved off-course.</h1><p>Return to the <a href="/">documentation home</a>, check <a href="/status/">current status</a>, or visit <a href="https://useaero.org" target="_blank" rel="noopener noreferrer">useaero.org</a>.</p></main></body></html>`,
    "utf8"
  )

  const assets = await readdir(assetDir)
  const outAssets = path.join(outDir, "assets")
  await mkdir(outAssets, { recursive: true })
  for (const asset of assets) {
    await copyFile(path.join(assetDir, asset), path.join(outAssets, asset))
  }

  // Vendor Mermaid so diagrams render offline and without a third-party CDN.
  const mermaidBundle = path.join(root, "node_modules", "mermaid", "dist", "mermaid.min.js")
  if (!existsSync(mermaidBundle)) {
    throw new Error("mermaid is not installed. Run npm install in docs/ before building.")
  }
  const vendorDir = path.join(outAssets, "vendor")
  await mkdir(vendorDir, { recursive: true })
  await copyFile(mermaidBundle, path.join(vendorDir, "mermaid.min.js"))

  const mermaidTotal = pages.reduce((sum, page) => sum + page.mermaid, 0)
  await writeFile(
    path.join(outDir, "build-manifest.json"),
    JSON.stringify(
      {
        site: site.domain,
        pages: pages.map((page) => ({
          file: page.file,
          url: routeFor(page.file),
          title: page.item.title,
          diagrams: page.mermaid,
        })),
        diagrams: mermaidTotal,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  )

  console.log(`Built ${pages.length} pages, ${mermaidTotal} Mermaid diagrams → ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
