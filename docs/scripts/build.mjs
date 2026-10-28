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
        return `<div class="diagram" data-diagram="${id}"><div class="diagram-head"><div class="diagram-head-title"><span class="diagram-dot"></span><span>Architecture Diagram</span></div><span class="diagram-source-label">Mermaid</span></div><pre class="mermaid" id="${id}">${escapeHtml(text)}</pre></div>`
      }
      const supported = language && hljs.getLanguage(language)
      const highlighted = supported
        ? hljs.highlight(text, { language, ignoreIllegals: true }).value
        : escapeHtml(text)
      const label = language ? language.toUpperCase() : "TEXT"
      return `<div class="code-block"><div class="code-head"><div class="code-dots" aria-hidden="true"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div><span class="code-lang-pill">${escapeHtml(label)}</span><button type="button" class="copy-code" data-copy aria-label="Copy code to clipboard"><span class="copy-icon-svg" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></span><span class="copied-icon-svg" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span><span class="copy-label">Copy</span></button></div><pre><code class="hljs language-${escapeHtml(supported ? language : "plaintext")}">${highlighted}</code></pre></div>`
    },
    blockquote({ text }) {
      const trimmed = text.trim()
      let calloutClass = "callout-note"
      let icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
      let title = "Note"

      if (/sandbox boundary/i.test(trimmed) || /warning/i.test(trimmed) || /blocked/i.test(trimmed)) {
        calloutClass = "callout-warning"
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
        title = "Sandbox Boundary"
      } else if (/the short version/i.test(trimmed) || /summary/i.test(trimmed)) {
        calloutClass = "callout-summary"
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
        title = "Quick Summary"
      } else if (/tip/i.test(trimmed)) {
        calloutClass = "callout-tip"
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M12 22v-4"/><path d="m19.07 19.07-2.83-2.83"/><path d="M22 12h-4"/><path d="m19.07 4.93-2.83 2.83"/></svg>`
        title = "Tip"
      } else if (/security/i.test(trimmed)) {
        calloutClass = "callout-security"
        icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>`
        title = "Security Notice"
      }

      const formatted = trimmed
        .replace(/^\*\*([^*]+)\*\*:?/, '<strong class="callout-lead">$1</strong>')
      return `<div class="callout ${calloutClass}"><div class="callout-icon" aria-hidden="true">${icon}</div><div class="callout-body"><div class="callout-title">${title}</div><div class="callout-text">${formatted}</div></div></div>`
    },
    html({ text }) {
      return escapeHtml(text)
    },
  }
  return { renderer, headings }
}

function renderHandleValidatorWidget() {
  return `<div class="interactive-widget widget-handle-validator" data-widget="handle-validator">
    <div class="widget-header">
      <div class="widget-title">
        <span class="widget-pulse" aria-hidden="true"></span>
        <strong>AeroNames Handle Validator & Resolver</strong>
        <span class="widget-badge font-mono">AeroNames.sol</span>
      </div>
      <span class="widget-meta">Rules: 3–20 chars · [a-z0-9_]</span>
    </div>
    <div class="widget-body">
      <div class="widget-input-row">
        <div class="input-wrapper">
          <span class="input-prefix font-mono">@</span>
          <input type="text" class="widget-input font-mono" placeholder="username" value="maya" spellcheck="false" autocomplete="off" maxlength="28" data-handle-input aria-label="Test username registration" />
        </div>
        <span class="validation-status-pill status-valid" data-handle-status>VALID HANDLE</span>
      </div>
      <div class="rules-grid">
        <div class="rule-chip is-valid" data-rule="length"><span class="rule-icon" aria-hidden="true">✓</span> 3 to 20 characters</div>
        <div class="rule-chip is-valid" data-rule="chars"><span class="rule-icon" aria-hidden="true">✓</span> Lowercase alphanumeric + _</div>
        <div class="rule-chip is-valid" data-rule="unique"><span class="rule-icon" aria-hidden="true">✓</span> Releases old handle on re-register</div>
      </div>
      <div class="widget-details">
        <div class="detail-row">
          <span class="detail-label">keccak256(bytes(name)):</span>
          <code class="detail-val font-mono" data-handle-hash>0x3b85f096238379201a141b619426f0ec405a06be32c5f11181290373...</code>
        </div>
        <div class="detail-row">
          <span class="detail-label">Mock Resolved Address:</span>
          <code class="detail-val font-mono text-brand" data-handle-address>0x80a02210ec13d498299ab1a568de188ea2cc6e8d</code>
        </div>
      </div>
    </div>
  </div>`
}

function renderMemoInspectorWidget() {
  return `<div class="interactive-widget widget-memo-inspector" data-widget="memo-inspector">
    <div class="widget-header">
      <div class="widget-title">
        <span class="widget-pulse" aria-hidden="true"></span>
        <strong>AeroPay Memo & Calldata Inspector</strong>
        <span class="widget-badge font-mono">MAX_MEMO_BYTES = 140</span>
      </div>
      <span class="widget-counter font-mono" data-memo-counter>28 / 140 bytes</span>
    </div>
    <div class="widget-body">
      <div class="memo-input-wrap">
        <textarea class="widget-textarea" rows="2" placeholder="Type memo (UTF-8 supported)..." data-memo-input aria-label="Test payment memo">Dinner with friends 🍕</textarea>
        <div class="memo-meter-track">
          <div class="memo-meter-bar" data-memo-meter style="width: 20%;"></div>
        </div>
      </div>
      <div class="memo-payload-preview">
        <div class="payload-header">
          <span class="payload-label font-mono">Solidity Event Preview</span>
          <span class="payload-gas font-mono">Gas Bound: ~24,500</span>
        </div>
        <pre class="payload-code"><code class="hljs language-solidity" data-memo-event>emit Paid(0x80a022...6E8D, 0x932F...180B, tUSDC, 45.00, "Dinner with friends 🍕", 1792088075);</code></pre>
      </div>
    </div>
  </div>`
}

function renderInflationVisualizerWidget() {
  return `<div class="interactive-widget widget-inflation" data-widget="inflation">
    <div class="widget-header">
      <div class="widget-title">
        <span class="widget-pulse" aria-hidden="true"></span>
        <strong>AeroRouter Virtual Shares Inflation Defense</strong>
        <span class="widget-badge font-mono">VIRTUAL_ASSETS = 1</span>
      </div>
      <span class="widget-meta font-mono">virtualShares = 10¹²</span>
    </div>
    <div class="widget-body">
      <div class="slider-control">
        <div class="slider-labels">
          <span>Attacker Front-Run Donation: <strong class="font-mono" data-donation-display>10,000 tUSDC</strong></span>
          <span class="slider-hint">Drag slider to test attack scale</span>
        </div>
        <input type="range" min="0" max="100000" step="5000" value="10000" class="widget-slider" data-donation-slider aria-label="Attacker donation amount slider" />
      </div>
      <div class="comparison-cards">
        <div class="comparison-card card-vulnerable">
          <div class="comp-badge bad">Vulnerable ERC-4626 (No Offset)</div>
          <div class="comp-metric"><span class="metric-val text-red" data-vuln-stolen>100%</span> <span class="metric-desc">Victim Deposit Stolen</span></div>
          <p class="comp-note">Without virtual shares, share price jumps to 10,001. A victim deposit of 1,000 mints 0 shares due to integer truncation, and the attacker burns 1 share to steal all 1,000 tUSDC.</p>
        </div>
        <div class="comparison-card card-safe">
          <div class="comp-badge good">AeroRouter (virtualShares = 10¹²)</div>
          <div class="comp-metric"><span class="metric-val text-emerald" data-safe-stolen>0.00%</span> <span class="metric-desc">Victim Receives Fair Value</span></div>
          <p class="comp-note">Virtual shares normalize 6-decimal USDC to 18-decimal shares. The victim receives millions of sub-shares; attacker donation is neutralized.</p>
        </div>
      </div>
    </div>
  </div>`
}

function renderLifecycleStepperWidget() {
  return `<div class="transaction-stepper" aria-label="Payment lifecycle stepper">
    <div class="stepper-item is-complete">
      <div class="stepper-rail"><span class="stepper-node">1</span><span class="stepper-line"></span></div>
      <div class="stepper-content">
        <div class="stepper-head"><strong class="stepper-title">Resolve Handle</strong><span class="stepper-badge font-mono">AeroNames</span></div>
        <p class="stepper-desc">Client calls <code>resolveAddress(name)</code> against the Fuji registry. The resolved address is verified as non-zero.</p>
      </div>
    </div>
    <div class="stepper-item is-complete">
      <div class="stepper-rail"><span class="stepper-node">2</span><span class="stepper-line"></span></div>
      <div class="stepper-content">
        <div class="stepper-head"><strong class="stepper-title">Check Token Allowance</strong><span class="stepper-badge font-mono">tUSDC</span></div>
        <p class="stepper-desc">Browser checks current <code>allowance(user, AeroPay)</code>. If insufficient, wallet prompts for a one-time approval.</p>
      </div>
    </div>
    <div class="stepper-item is-active">
      <div class="stepper-rail"><span class="stepper-node">3</span><span class="stepper-line"></span></div>
      <div class="stepper-content">
        <div class="stepper-head"><strong class="stepper-title">Sign 1-Transaction Payment</strong><span class="stepper-badge font-mono">AeroPay.pay</span></div>
        <p class="stepper-desc">User wallet authorizes single call carrying destination, amount, and bounded memo (≤ 140 bytes). <code>Paid</code> event emitted.</p>
      </div>
    </div>
    <div class="stepper-item">
      <div class="stepper-rail"><span class="stepper-node">4</span></div>
      <div class="stepper-content">
        <div class="stepper-head"><strong class="stepper-title">Fuji Confirmation & Log Watch</strong><span class="stepper-badge font-mono">Chain 43113</span></div>
        <p class="stepper-desc">Wagmi waits for receipt. Transaction hash is recorded in local activity store. No custodial key ever touches the payment.</p>
      </div>
    </div>
  </div>`
}

function renderSiweInspectorWidget() {
  return `<div class="interactive-widget widget-siwe" data-widget="siwe-inspector">
    <div class="widget-header">
      <div class="widget-title">
        <span class="widget-pulse" aria-hidden="true"></span>
        <strong>EIP-4361 Canonical SIWE Payload Inspector</strong>
        <span class="widget-badge font-mono">Chain 43113</span>
      </div>
      <span class="widget-meta font-mono">Fuji EOA Only</span>
    </div>
    <div class="widget-body">
      <div class="siwe-controls-grid">
        <div class="siwe-field">
          <label class="field-label">Wallet Address (EOA)</label>
          <div class="input-wrapper">
            <input type="text" class="widget-input font-mono" value="0x80a02210ec13d498299ab1a568de188ea2cc6e8d" spellcheck="false" autocomplete="off" data-siwe-address aria-label="SIWE Wallet Address" />
          </div>
        </div>
        <div class="siwe-field">
          <label class="field-label">Target Chain ID</label>
          <div class="select-wrapper">
            <select class="widget-select font-mono" data-siwe-chain aria-label="SIWE Chain Selector">
              <option value="43113" selected>43113 (Avalanche Fuji Testnet)</option>
              <option value="43114">43114 (Avalanche Mainnet — Rejected)</option>
              <option value="1">1 (Ethereum Mainnet — Rejected)</option>
            </select>
          </div>
        </div>
      </div>
      <div class="siwe-status-banner banner-safe" data-siwe-banner>
        <span class="status-icon" aria-hidden="true">✓</span>
        <span class="status-msg" data-siwe-msg>Valid Fuji EOA challenge payload. Target matches Fuji Testnet.</span>
      </div>
      <div class="memo-payload-preview">
        <div class="payload-header">
          <span class="payload-label font-mono">Canonical EIP-191 Personal Sign String</span>
          <button type="button" class="copy-code" data-siwe-copy aria-label="Copy SIWE message">
            <span class="copy-label">Copy Payload</span>
          </button>
        </div>
        <pre class="payload-code"><code class="hljs language-plaintext" data-siwe-output></code></pre>
      </div>
    </div>
  </div>`
}

function renderPkgInstallWidget() {
  return `<div class="interactive-widget widget-pkg" data-widget="pkg-install">
    <div class="pkg-header">
      <div class="pkg-tabs" role="tablist" aria-label="Package manager selection">
        <button type="button" class="pkg-tab is-active" data-pkg="npm" role="tab" aria-selected="true">npm</button>
        <button type="button" class="pkg-tab" data-pkg="pnpm" role="tab" aria-selected="false">pnpm</button>
        <button type="button" class="pkg-tab" data-pkg="yarn" role="tab" aria-selected="false">yarn</button>
        <button type="button" class="pkg-tab" data-pkg="bun" role="tab" aria-selected="false">bun</button>
      </div>
      <span class="pkg-meta font-mono">Next.js 16 · React 19</span>
    </div>
    <div class="pkg-code-wrap code-block" style="margin:0; border:0; border-radius:0;">
      <pre style="padding:14px 16px;"><code class="hljs language-bash" data-pkg-code>npm install &amp;&amp; cp .env.example .env.local &amp;&amp; npm run dev</code></pre>
      <button type="button" class="copy-code pkg-copy" data-copy aria-label="Copy install command">
        <svg class="copy-icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <svg class="copied-icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
        <span class="copy-label">Copy</span>
      </button>
    </div>
  </div>`
}

function badgeHtml(label, detail) {
  const key = label.trim().toLowerCase()
  const cls = BADGES[key] || "is-neutral"
  const detailHtml = detail ? ` <span class="badge-detail">${escapeHtml(detail.trim())}</span>` : ""
  return `<span class="status-badge ${cls}"><span class="status-dot"></span>${escapeHtml(label.trim())}${detailHtml}</span>`
}

function renderMarkdown(raw, page) {
  const { body } = parseFrontmatter(raw)
  
  // Replace widgets with tokens
  const widgets = []
  let processed = body
    .replace(/\{\{widget:handle-validator\}\}/g, () => {
      const token = `AEROWIDGET${widgets.length}TOKEN`
      widgets.push(renderHandleValidatorWidget())
      return token
    })
    .replace(/\{\{widget:memo-inspector\}\}/g, () => {
      const token = `AEROWIDGET${widgets.length}TOKEN`
      widgets.push(renderMemoInspectorWidget())
      return token
    })
    .replace(/\{\{widget:inflation-visualizer\}\}/g, () => {
      const token = `AEROWIDGET${widgets.length}TOKEN`
      widgets.push(renderInflationVisualizerWidget())
      return token
    })
    .replace(/\{\{widget:lifecycle-stepper\}\}/g, () => {
      const token = `AEROWIDGET${widgets.length}TOKEN`
      widgets.push(renderLifecycleStepperWidget())
      return token
    })
    .replace(/\{\{widget:siwe-inspector\}\}/g, () => {
      const token = `AEROWIDGET${widgets.length}TOKEN`
      widgets.push(renderSiweInspectorWidget())
      return token
    })
    .replace(/\{\{widget:pkg-install\}\}/g, () => {
      const token = `AEROWIDGET${widgets.length}TOKEN`
      widgets.push(renderPkgInstallWidget())
      return token
    })

  // Badges are rendered as HTML after Markdown parsing.
  const badges = []
  const withBadges = processed.replace(/\{\{badge:([^}|]+)(?:\|([^}]+))?\}\}/g, (_, label, detail) => {
    const token = `AEROBADGE${badges.length}TOKEN`
    badges.push(badgeHtml(label, detail))
    return token
  })
  const { renderer, headings } = makeRenderer(page)
  const marked = new Marked({ gfm: true, breaks: false })
  marked.use({ renderer })
  const parsed = marked.parse(withBadges)
  const htmlWithBadges = parsed.replace(/AEROBADGE(\d+)TOKEN/g, (_, index) => badges[Number(index)] ?? "")
  const html = htmlWithBadges.replace(/AEROWIDGET(\d+)TOKEN/g, (_, index) => widgets[Number(index)] ?? "")
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
              (item) => {
                const isActive = item.file === activeFile
                return `<li>
                  <a class="nav-link${isActive ? " is-active" : ""}" href="${routeFor(item.file)}"${isActive ? ' aria-current="page"' : ""}>
                    ${isActive ? '<span class="nav-indicator" aria-hidden="true"></span>' : ""}
                    <span class="nav-text">${escapeHtml(item.title)}</span>
                  </a>
                </li>`
              }
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
    <div class="toc-header">
      <svg class="toc-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
      <span class="toc-label">On this page</span>
    </div>
    <nav class="toc-nav">
      ${headings
        .map(
          (heading) => `<a class="toc-link toc-depth-${heading.depth}" href="#${heading.id}"><span>${escapeHtml(heading.text)}</span></a>`
        )
        .join("")}
    </nav>
    <div class="toc-foot">
      <a class="toc-back-top" href="#main-content" aria-label="Scroll back to top">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
        <span>Back to top</span>
      </a>
    </div>
  </aside>`
}

function breadcrumbHtml(page, item) {
  if (page.file === "index") {
    return `<nav class="breadcrumbs" aria-label="Breadcrumb"><span>Docs</span></nav>`
  }
  return `<nav class="breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Docs</a><span class="crumb-sep">/</span>
    <span class="crumb-category">${escapeHtml(item.category)}</span><span class="crumb-sep">/</span>
    <span class="crumb-current" aria-current="page">${escapeHtml(item.title)}</span>
  </nav>`
}

function prevNextHtml(page, index) {
  const previous = flatNavigation[index - 1]
  const next = flatNavigation[index + 1]
  if (!previous && !next) return ""
  return `<nav class="page-pager" aria-label="Previous and next pages">
    ${previous
      ? `<a class="pager-card pager-prev" href="${routeFor(previous.file)}"><span class="pager-kicker">← Previous</span><span class="pager-title">${escapeHtml(previous.title)}</span></a>`
      : `<span></span>`}
    ${next
      ? `<a class="pager-card pager-next" href="${routeFor(next.file)}"><span class="pager-kicker">Next →</span><span class="pager-title">${escapeHtml(next.title)}</span></a>`
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
        <div class="hero-copy">
          <div class="hero-eyebrow">
            <span class="live-dot" aria-hidden="true"></span>
            <span>Avalanche Fuji · Documentation</span>
          </div>
          <h1>Money that moves<br>like a message.</h1>
          <p class="hero-lede">Aero is building username payments, everyday payment experiences, and yield on eligible stablecoins. Try the current Fuji sandbox with worthless test tokens and simulated services.</p>
          <div class="hero-actions">
            <a class="button button-primary" href="${site.testnet}" target="_blank" rel="noopener noreferrer">
              <span>Try the testnet</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
            <a class="button button-ghost" href="/status/">
              <span>Read current status</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
            </a>
          </div>
          <div class="hero-meta">
            <span class="hero-meta-tag"><span class="meta-dot"></span>Avalanche Fuji sandbox</span>
            <span class="hero-meta-tag">tUSDC · no cash value</span>
            <span class="hero-meta-tag font-mono">Chain ID 43113</span>
          </div>
        </div>
      </section>`
    : `<header class="page-header">
        ${breadcrumbHtml(page, item)}
        <div class="page-kicker">${escapeHtml(item.category)}</div>
        <h1>${escapeHtml(item.title)}</h1>
        <p class="page-description">${escapeHtml(item.description)}</p>
        <div class="page-meta">
          <span class="meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${readingTime(content)} min read</span>
          <span class="meta-item"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Reviewed ${escapeHtml(site.lastReviewed)}</span>
          <span class="meta-item meta-item-badge">Fuji 43113</span>
        </div>
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Geist:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
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
        <span class="brand-text"><strong>AERO</strong><span class="brand-sub">Docs</span></span>
      </a>
      <span class="topbar-divider" aria-hidden="true"></span>
      <div class="topbar-context-pill">
        <span class="live-dot" aria-hidden="true"></span>
        <span>Fuji Sandbox <strong class="pill-chain">43113</strong></span>
      </div>
      <div class="topbar-actions">
        <button class="search-trigger" type="button" aria-label="Search documentation" data-search-open>
          <span class="search-icon-svg" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <span class="search-label">Search docs…</span>
          <kbd class="kbd-shortcut">⌘K</kbd>
        </button>
        <a class="topbar-link topbar-status-link" href="/status/">
          <span class="status-indicator-dot" aria-hidden="true"></span>
          <span>Status</span>
        </a>
        <a class="topbar-link topbar-external-link" href="${site.website}" target="_blank" rel="noopener noreferrer">
          <span>useaero.org</span>
          <svg class="external-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
        </a>
        <a class="topbar-cta" href="${site.testnet}" target="_blank" rel="noopener noreferrer">
          <span>Sandbox</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>
    </div>
  </header>
  <div class="mobile-scrim" aria-hidden="true"></div>
  <div class="shell">
    <aside class="sidebar" id="sidebar" aria-label="Documentation navigation">
      <div class="sidebar-inner">
        <div class="sidebar-status-card">
          <div class="status-card-header">
            <span class="pulse-dot" aria-hidden="true"></span>
            <span class="status-card-badge">SURFACE GATE</span>
            <span class="status-card-chain font-mono">43113</span>
          </div>
          <div class="network-toggle-group" role="radiogroup" aria-label="Environment surface switch">
            <button type="button" class="network-toggle-btn is-active" data-env-switch="fuji" aria-checked="true">
              <span class="toggle-dot"></span>
              <span>Fuji Testnet</span>
            </button>
            <button type="button" class="network-toggle-btn" data-env-switch="prod" aria-checked="false">
              <span class="lock-icon" aria-hidden="true">🔒</span>
              <span>Production</span>
            </button>
          </div>
          <p class="status-card-note" data-env-note>Sandbox mode: tUSDC has no cash value. Live contracts require Fuji AVAX gas.</p>
        </div>
        ${navHtml(page.file)}
        <div class="sidebar-bottom">
          <div class="sidebar-links-group">
            <a class="sidebar-link" href="${site.testnet}" target="_blank" rel="noopener noreferrer">
              <span>Open testnet sandbox</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
            </a>
            <a class="sidebar-link" href="${site.repository}" target="_blank" rel="noopener noreferrer">
              <span>GitHub repository</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
            </a>
          </div>
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
      <p class="footer-tagline">${escapeHtml(site.tagline)}</p>
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
    <div class="search-backdrop" data-search-close></div>
    <div class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
      <div class="search-head">
        <span class="search-input-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <input id="search-title" type="search" placeholder="Search documentation, contracts, architecture..." autocomplete="off" spellcheck="false" data-search-input>
        <button type="button" class="search-esc-btn" aria-label="Close search" data-search-close>ESC</button>
      </div>
      <div class="search-results" data-search-results>
        <div class="search-empty">
          <p class="empty-title">Type to search Aero documentation</p>
          <p class="empty-sub">Explore handles, payments, yield, identity, and Fuji contracts.</p>
          <div class="search-quick-tags">
            <button type="button" class="quick-tag" data-tag="AeroPay">AeroPay</button>
            <button type="button" class="quick-tag" data-tag="AeroNames">AeroNames</button>
            <button type="button" class="quick-tag" data-tag="AeroRouter">AeroRouter</button>
            <button type="button" class="quick-tag" data-tag="SIWE">SIWE Identity</button>
            <button type="button" class="quick-tag" data-tag="status">Status Matrix</button>
          </div>
        </div>
      </div>
      <div class="search-foot">
        <div class="search-shortcuts">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </div>
        <span class="search-foot-brand">Aero Docs</span>
      </div>
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
    <a class="home-card" href="/product/">
      <div class="card-top">
        <span class="card-badge">01</span>
        <span class="card-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </span>
      </div>
      <h3>Product</h3>
      <p>Send, Pay and Earn — with explicit labels for what is live, mock or planned.</p>
      <span class="card-link"><span>Read product boundaries</span><span class="card-arrow" aria-hidden="true">→</span></span>
    </a>
    <a class="home-card" href="/architecture/">
      <div class="card-top">
        <span class="card-badge">02</span>
        <span class="card-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        </span>
      </div>
      <h3>Architecture</h3>
      <p>Follow a payment from the browser through the wallet, contracts and Fuji.</p>
      <span class="card-link"><span>Open the system map</span><span class="card-arrow" aria-hidden="true">→</span></span>
    </a>
    <a class="home-card" href="/status/">
      <div class="card-top">
        <span class="card-badge">03</span>
        <span class="card-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>
        </span>
      </div>
      <h3>Status</h3>
      <p>The honest matrix: implemented, tested, simulated, partial, planned or blocked.</p>
      <span class="card-link"><span>Check current status</span><span class="card-arrow" aria-hidden="true">→</span></span>
    </a>
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
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404: Flight Path Off-Course — Aero Docs</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Geist:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/styles.css"></head><body class="not-found"><main class="not-found-card"><div class="radar-box"><div class="radar-ring r1"></div><div class="radar-ring r2"></div><div class="radar-sweep"></div><div class="radar-cross-h"></div><div class="radar-cross-v"></div><div class="radar-blip"></div></div><a class="brand" href="/">${brandMark()}<span class="brand-text"><strong>AERO</strong><span class="brand-sub">Docs</span></span></a><p class="not-found-eyebrow">404 // FLIGHT PATH OFF-COURSE</p><h1>Lost in the testnet airspace.</h1><p class="not-found-lead">The requested documentation coordinate does not exist. Navigate back to the flight deck:</p><div class="not-found-links"><a class="button button-primary" href="/"><span>Return to Overview</span> <span aria-hidden="true">→</span></a><a class="button button-ghost" href="/status/"><span>Current Status Matrix</span></a><a class="button button-ghost" href="/contracts/"><span>Contract Reference</span></a><a class="button button-ghost" href="${site.domain.startsWith("http") ? site.domain : "https://" + site.domain}" target="_blank" rel="noopener noreferrer"><span>Launch App</span></a></div><p class="not-found-coords font-mono">Target: Avalanche Fuji Airspace · Chain ID 43113</p></main></body></html>`,
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
