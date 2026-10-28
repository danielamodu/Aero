/* Aero docs client. No framework, no build step beyond the static compiler. */
(() => {
  const body = document.body
  const menuToggle = document.querySelector(".menu-toggle")
  const scrim = document.querySelector(".mobile-scrim")
  const sidebar = document.querySelector("#sidebar")

  function closeNav() {
    body.classList.remove("nav-open")
    menuToggle?.setAttribute("aria-expanded", "false")
  }

  menuToggle?.addEventListener("click", () => {
    const open = !body.classList.contains("nav-open")
    body.classList.toggle("nav-open", open)
    menuToggle.setAttribute("aria-expanded", String(open))
  })
  scrim?.addEventListener("click", closeNav)
  sidebar?.addEventListener("click", (event) => {
    if (event.target.closest("a") && window.matchMedia("(max-width: 920px)").matches) closeNav()
  })

  /* ------------------------------- copy code ------------------------------- */
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const block = button.closest(".code-block")
      const code = block?.querySelector("code")?.textContent ?? ""
      const label = button.querySelector(".copy-label")
      try {
        await navigator.clipboard.writeText(code)
        if (label) label.textContent = "Copied!"
        button.classList.add("is-copied")
        window.setTimeout(() => {
          if (label) label.textContent = "Copy"
          button.classList.remove("is-copied")
        }, 1600)
      } catch {
        const selection = window.getSelection()
        const range = document.createRange()
        if (block && selection) {
          range.selectNodeContents(block.querySelector("code") ?? block)
          selection.removeAllRanges()
          selection.addRange(range)
        }
        if (label) label.textContent = "Selected"
      }
    })
  })

  /* ------------------------------ table of contents ---------------------------- */
  const tocLinks = [...document.querySelectorAll(".toc-link")]
  const tocTargets = tocLinks
    .map((link) => {
      const id = decodeURIComponent(link.getAttribute("href")?.slice(1) ?? "")
      return { link, target: id ? document.getElementById(id) : null }
    })
    .filter((entry) => entry.target)

  if (tocTargets.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          const match = tocTargets.find((entry) => entry.target === visible[0].target)
          if (match) {
            tocLinks.forEach((link) => link.classList.remove("is-active"))
            match.link.classList.add("is-active")
          }
        }
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: [0, 1] }
    )
    tocTargets.forEach((entry) => observer.observe(entry.target))
  }

  /* --------------------------------- mermaid --------------------------------- */
  function setupDiagramZoom(nodes) {
    const overlay = document.createElement("div")
    overlay.className = "diagram-zoom"
    overlay.hidden = true
    overlay.setAttribute("role", "dialog")
    overlay.setAttribute("aria-modal", "true")
    overlay.setAttribute("aria-label", "Enlarged diagram")

    const panel = document.createElement("div")
    panel.className = "diagram-zoom-panel"
    const closeButton = document.createElement("button")
    closeButton.type = "button"
    closeButton.className = "diagram-zoom-close"
    closeButton.textContent = "Close"
    const stage = document.createElement("div")
    stage.className = "diagram-zoom-stage"
    panel.append(closeButton, stage)
    overlay.append(panel)
    document.body.append(overlay)

    const closeZoom = () => {
      overlay.hidden = true
      body.classList.remove("zoom-open")
      stage.replaceChildren()
    }

    closeButton.addEventListener("click", closeZoom)
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeZoom()
    })
    window.closeDiagramZoom = closeZoom

    nodes.forEach((node) => {
      const svg = node.querySelector("svg")
      if (!svg) return
      node.classList.add("is-zoomable")
      svg.setAttribute("title", "Click to enlarge")
      svg.addEventListener("click", () => {
        const clone = svg.cloneNode(true)
        const box = svg.viewBox?.baseVal
        clone.style.maxWidth = "none"
        clone.style.width = box && box.width ? `${Math.round(box.width)}px` : "auto"
        clone.style.height = "auto"
        clone.removeAttribute("title")
        stage.replaceChildren(clone)
        overlay.hidden = false
        body.classList.add("zoom-open")
        closeButton.focus()
      })
    })
  }

  const diagrams = [...document.querySelectorAll("pre.mermaid")]
  if (diagrams.length > 0) {
    const script = document.createElement("script")
    script.src = "/assets/vendor/mermaid.min.js"
    script.onload = () => {
      const mermaid = window.mermaid
      if (!mermaid) {
        diagrams.forEach((diagram) => diagram.closest(".diagram")?.classList.add("diagram-failed"))
        return
      }
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "strict",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        themeVariables: {
          primaryColor: "#eef1ff",
          primaryTextColor: "#0b0f1c",
          primaryBorderColor: "#1800ad",
          lineColor: "#7d88b8",
          secondaryColor: "#f7f9fd",
          tertiaryColor: "#ffffff",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: "14px",
          clusterBkg: "#f7f9ff",
          clusterBorder: "#d8def7",
          edgeLabelBackground: "#fbfcff",
          nodeBorder: "#1800ad",
          actorBkg: "#eef1ff",
          actorBorder: "#1800ad",
          actorTextColor: "#0b0f1c",
          signalColor: "#1800ad",
          signalTextColor: "#0b0f1c",
          labelBoxBkgColor: "#fff",
          labelBoxBorderColor: "#d8def7",
          labelTextColor: "#0b0f1c",
        },
        flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: true },
        sequence: { useMaxWidth: true, wrap: true },
      })
      mermaid.run({ nodes: diagrams }).then(() => {
        setupDiagramZoom(diagrams)
      }).catch(() => {
        diagrams.forEach((diagram) => diagram.closest(".diagram")?.classList.add("diagram-failed"))
      })
    }
    script.onerror = () => {
      diagrams.forEach((diagram) => diagram.closest(".diagram")?.classList.add("diagram-failed"))
    }
    document.head.appendChild(script)
  }

  /* --------------------------------- search ---------------------------------- */
  const overlay = document.querySelector("[data-search-overlay]")
  const input = document.querySelector("[data-search-input]")
  const results = document.querySelector("[data-search-results]")
  const openButtons = [...document.querySelectorAll("[data-search-open]")]
  const closeButton = document.querySelector("[data-search-close]")
  let indexPromise
  let activeResult = -1

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch("/search-index.json", { credentials: "same-origin" })
        .then((response) => {
          if (!response.ok) throw new Error(`Search index ${response.status}`)
          return response.json()
        })
        .catch(() => [])
    }
    return indexPromise
  }

  function scorePage(page, query, terms) {
    const title = page.title.toLowerCase()
    const description = page.description.toLowerCase()
    const headings = page.headings.map((heading) => heading.text.toLowerCase()).join(" ")
    const text = page.text.toLowerCase()
    let score = 0
    if (title.includes(query)) score += 80
    if (description.includes(query)) score += 30
    if (headings.includes(query)) score += 40
    for (const term of terms) {
      if (term.length < 2) continue
      if (title.includes(term)) score += 24
      if (description.includes(term)) score += 10
      if (headings.includes(term)) score += 12
      score += Math.min(24, (text.split(term).length - 1) * 3)
    }
    return score
  }

  function excerpt(page, terms) {
    const source = page.text
    const lower = source.toLowerCase()
    let position = -1
    for (const term of terms) {
      if (term.length < 2) continue
      position = lower.indexOf(term)
      if (position !== -1) break
    }
    if (position === -1) return source.slice(0, 150)
    const start = Math.max(0, position - 55)
    const end = Math.min(source.length, position + 145)
    return `${start > 0 ? "..." : ""}${source.slice(start, end).trim()}${end < source.length ? "..." : ""}`
  }

  function setActiveResult(next) {
    const cards = [...results.querySelectorAll(".search-result")]
    if (cards.length === 0) return
    activeResult = (next + cards.length) % cards.length
    cards.forEach((card, index) => card.classList.toggle("is-active", index === activeResult))
    cards[activeResult]?.scrollIntoView({ block: "nearest" })
  }

  const defaultEmptyHtml = `
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
    </div>`

  function renderSearch(query) {
    const clean = query.trim().toLowerCase()
    if (!clean) {
      activeResult = -1
      results.innerHTML = defaultEmptyHtml
      return
    }
    const terms = clean.split(/\s+/).filter(Boolean)
    loadIndex().then((pages) => {
      const matches = pages
        .map((page) => ({ page, score: scorePage(page, clean, terms) }))
        .filter((match) => match.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
      activeResult = matches.length > 0 ? 0 : -1
      if (matches.length === 0) {
        results.innerHTML = `<div class="search-empty"><p class="empty-title">No results for "${escapeHtml(query)}"</p><p class="empty-sub">Try searching for "status", "AeroRouter", "SIWE", or "Fuji".</p></div>`
        return
      }
      results.innerHTML = matches
        .map(
          ({ page }, index) => `<a class="search-result${index === 0 ? " is-active" : ""}" href="${page.url}">
            <div class="search-result-header">
              <span class="search-result-cat">${escapeHtml(page.category)}</span>
              <span class="search-result-name">${escapeHtml(page.title)}</span>
              <span class="search-result-arrow" aria-hidden="true">→</span>
            </div>
            <p class="search-result-snippet">${escapeHtml(excerpt(page, terms))}</p>
          </a>`
        )
        .join("")
      results.querySelector(".search-result")?.addEventListener("mouseenter", () => setActiveResult(0))
    })
  }

  function openSearch() {
    if (!overlay) return
    overlay.hidden = false
    body.classList.add("search-open")
    window.setTimeout(() => input?.focus(), 20)
    renderSearch(input?.value ?? "")
  }

  function closeSearch() {
    if (!overlay) return
    overlay.hidden = true
    body.classList.remove("search-open")
    activeResult = -1
  }

  openButtons.forEach((button) => button.addEventListener("click", openSearch))
  document.querySelectorAll("[data-search-close]").forEach((btn) => btn.addEventListener("click", closeSearch))
  results?.addEventListener("click", (event) => {
    const tagBtn = event.target.closest(".quick-tag")
    if (tagBtn && input) {
      const tag = tagBtn.getAttribute("data-tag") || ""
      input.value = tag
      input.focus()
      renderSearch(tag)
    }
  })
  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) closeSearch()
  })
  input?.addEventListener("input", (event) => renderSearch(event.target.value))
  input?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveResult(activeResult + 1)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveResult(activeResult - 1)
    } else if (event.key === "Enter") {
      const card = results.querySelectorAll(".search-result")[activeResult]
      if (card) {
        event.preventDefault()
        window.location.href = card.getAttribute("href")
      }
    }
  })
  results?.addEventListener("mousemove", (event) => {
    const card = event.target.closest(".search-result")
    if (!card) return
    const index = [...results.querySelectorAll(".search-result")].indexOf(card)
    if (index !== -1 && index !== activeResult) setActiveResult(index)
  })

  document.addEventListener("keydown", (event) => {
    const target = event.target
    const typing =
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault()
      openSearch()
    } else if (event.key === "/" && !typing) {
      event.preventDefault()
      openSearch()
    } else if (event.key === "Escape") {
      if (typeof window.closeDiagramZoom === "function" && body.classList.contains("zoom-open")) {
        window.closeDiagramZoom()
      } else if (overlay && !overlay.hidden) closeSearch()
      else closeNav()
    }
  })

  /* ------------------------------- micro toast ------------------------------- */
  let toastTimeout
  function showToast(message, icon = "⚡") {
    let toast = document.querySelector(".aero-toast")
    if (!toast) {
      toast = document.createElement("div")
      toast.className = "aero-toast"
      document.body.appendChild(toast)
    }
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><span class="toast-text">${message}</span>`
    toast.classList.add("is-visible")
    window.clearTimeout(toastTimeout)
    toastTimeout = window.setTimeout(() => {
      toast.classList.remove("is-visible")
    }, 3200)
  }

  /* ----------------------- environment surface switch ------------------------ */
  const envSwitchButtons = [...document.querySelectorAll("[data-env-switch]")]
  const envNote = document.querySelector("[data-env-note]")
  envSwitchButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetEnv = btn.getAttribute("data-env-switch")
      envSwitchButtons.forEach((b) => {
        const active = b === btn
        b.classList.toggle("is-active", active)
        b.setAttribute("aria-checked", String(active))
      })
      if (targetEnv === "prod") {
        if (envNote) {
          envNote.textContent = "Production contracts are not deployed. Aero operates exclusively in the Avalanche Fuji sandbox."
        }
        showToast("Production surface is gated: Fuji testnet is currently active.", "🔒")
      } else {
        if (envNote) {
          envNote.textContent = "Sandbox mode: tUSDC has no cash value. Live contracts require Fuji AVAX gas."
        }
        showToast("Switched to Avalanche Fuji Sandbox (Chain 43113).", "❄️")
      }
    })
  })

  /* ---------------------- widget: handle validator --------------------------- */
  const handleWidget = document.querySelector('[data-widget="handle-validator"]')
  if (handleWidget) {
    const input = handleWidget.querySelector("[data-handle-input]")
    const statusPill = handleWidget.querySelector("[data-handle-status]")
    const ruleLength = handleWidget.querySelector('[data-rule="length"]')
    const ruleChars = handleWidget.querySelector('[data-rule="chars"]')
    const hashEl = handleWidget.querySelector("[data-handle-hash]")
    const addrEl = handleWidget.querySelector("[data-handle-address]")

    function pseudoHash(str) {
      let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i)
        h1 = Math.imul(h1 ^ ch, 2654435761)
        h2 = Math.imul(h2 ^ ch, 1597334677)
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
      const part1 = (h1 >>> 0).toString(16).padStart(8, "0")
      const part2 = (h2 >>> 0).toString(16).padStart(8, "0")
      const part3 = ((h1 ^ 0xa5a5a5a5) >>> 0).toString(16).padStart(8, "0")
      const part4 = ((h2 ^ 0x5a5a5a5a) >>> 0).toString(16).padStart(8, "0")
      return `0x${part1}${part2}${part3}${part4}...`
    }

    function pseudoAddress(str) {
      let h = 0x811c9dc5
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
      }
      const hex = (h >>> 0).toString(16).padStart(8, "0")
      return `0x80a0${hex}e8d2${hex.slice(0, 4)}...43113`
    }

    function updateHandleValidation() {
      let val = input.value.trim().toLowerCase()
      if (val.startsWith("@")) val = val.slice(1)
      const isLenValid = val.length >= 3 && val.length <= 20
      const isCharValid = /^[a-z0-9_]+$/.test(val)
      const isValid = isLenValid && isCharValid

      if (ruleLength) {
        ruleLength.classList.toggle("is-valid", isLenValid)
        ruleLength.classList.toggle("is-invalid", !isLenValid)
        ruleLength.querySelector(".rule-icon").textContent = isLenValid ? "✓" : "✕"
      }
      if (ruleChars) {
        ruleChars.classList.toggle("is-valid", isCharValid)
        ruleChars.classList.toggle("is-invalid", !isCharValid)
        ruleChars.querySelector(".rule-icon").textContent = isCharValid ? "✓" : "✕"
      }
      if (statusPill) {
        statusPill.className = `validation-status-pill ${isValid ? "status-valid" : "status-invalid"}`
        statusPill.textContent = isValid ? "VALID HANDLE" : "INVALID SPEC"
      }
      if (hashEl) {
        hashEl.textContent = val ? pseudoHash(val) : "0x00000000000000000000..."
      }
      if (addrEl) {
        addrEl.textContent = isValid ? pseudoAddress(val) : "0x0000000000000000000000000000000000000000 (Unregistered)"
      }
    }

    input.addEventListener("input", updateHandleValidation)
  }

  /* ---------------------- widget: memo inspector ----------------------------- */
  const memoWidget = document.querySelector('[data-widget="memo-inspector"]')
  if (memoWidget) {
    const textarea = memoWidget.querySelector("[data-memo-input]")
    const counter = memoWidget.querySelector("[data-memo-counter]")
    const meter = memoWidget.querySelector("[data-memo-meter]")
    const eventPreview = memoWidget.querySelector("[data-memo-event]")

    function updateMemoInspector() {
      const text = textarea.value
      const encoder = new TextEncoder()
      const bytes = encoder.encode(text).length
      const max = 140
      const pct = Math.min(100, Math.round((bytes / max) * 100))

      if (counter) {
        counter.textContent = `${bytes} / ${max} bytes`
        counter.style.color = bytes > max ? "#ef4444" : bytes > 100 ? "#f59e0b" : "var(--ink-muted)"
      }
      if (meter) {
        meter.style.width = `${pct}%`
        meter.classList.toggle("is-warning", bytes > 100 && bytes <= max)
        meter.classList.toggle("is-overflow", bytes > max)
      }
      if (eventPreview) {
        const safeText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        eventPreview.textContent = `emit Paid(0x80a022...6E8D, 0x932F...180B, tUSDC, 45.00, "${safeText}", ${Math.floor(Date.now() / 1000)});`
      }
    }

    textarea.addEventListener("input", updateMemoInspector)
  }

  /* ------------------- widget: inflation defense slider ---------------------- */
  const inflationWidget = document.querySelector('[data-widget="inflation"]')
  if (inflationWidget) {
    const slider = inflationWidget.querySelector("[data-donation-slider]")
    const display = inflationWidget.querySelector("[data-donation-display]")
    const vulnMetric = inflationWidget.querySelector("[data-vuln-stolen]")
    const safeMetric = inflationWidget.querySelector("[data-safe-stolen]")

    function updateInflation() {
      const donation = Number(slider.value)
      if (display) display.textContent = `${donation.toLocaleString()} tUSDC`
      if (vulnMetric) {
        if (donation >= 1000) {
          vulnMetric.textContent = "100.0%"
        } else if (donation === 0) {
          vulnMetric.textContent = "0.0%"
        } else {
          const ratio = (donation / (1000 + donation)) * 100
          vulnMetric.textContent = `${ratio.toFixed(1)}%`
        }
      }
      if (safeMetric) {
        safeMetric.textContent = "0.00%"
      }
    }

    slider.addEventListener("input", updateInflation)
  }

  /* ----------------------- widget: siwe inspector ---------------------------- */
  const siweWidget = document.querySelector('[data-widget="siwe-inspector"]')
  if (siweWidget) {
    const addrInput = siweWidget.querySelector("[data-siwe-address]")
    const chainSelect = siweWidget.querySelector("[data-siwe-chain]")
    const banner = siweWidget.querySelector("[data-siwe-banner]")
    const msg = siweWidget.querySelector("[data-siwe-msg]")
    const output = siweWidget.querySelector("[data-siwe-output]")
    const copyBtn = siweWidget.querySelector("[data-siwe-copy]")

    const fixedNonce = "8f39b2a1c0d4e5f67890123456789abc"
    const nowIso = new Date().toISOString()
    const expIso = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    function updateSiwe() {
      const addr = (addrInput?.value || "").trim()
      const chainId = chainSelect?.value || "43113"
      const isFuji = chainId === "43113"
      const isHexAddr = /^0x[a-fA-F0-9]{40}$/.test(addr)

      if (banner && msg) {
        if (!isFuji) {
          banner.className = "siwe-status-banner banner-danger"
          banner.querySelector(".status-icon").textContent = "✕"
          msg.textContent = `Rejected: Chain ID ${chainId} is forbidden. Aero Identity exclusively accepts Avalanche Fuji (43113).`
        } else if (!isHexAddr) {
          banner.className = "siwe-status-banner banner-warning"
          banner.querySelector(".status-icon").textContent = "!"
          msg.textContent = "Invalid address format: must be a 42-character 0x-prefixed hex string."
        } else {
          banner.className = "siwe-status-banner banner-safe"
          banner.querySelector(".status-icon").textContent = "✓"
          msg.textContent = "Valid Fuji EOA challenge payload. Target matches Avalanche Fuji Testnet (43113)."
        }
      }

      const siweText = `docs.useaero.org wants you to sign in with your Ethereum account:\n${addr || "0x0000000000000000000000000000000000000000"}\n\nSign in to Aero documentation and sandbox services. This request does not authorize transfers.\n\nURI: https://docs.useaero.org/login\nVersion: 1\nChain ID: ${chainId}\nNonce: ${fixedNonce}\nIssued At: ${nowIso}\nExpiration Time: ${expIso}`

      if (output) {
        output.textContent = siweText
      }
    }

    addrInput?.addEventListener("input", updateSiwe)
    chainSelect?.addEventListener("change", updateSiwe)
    updateSiwe()

    copyBtn?.addEventListener("click", async () => {
      if (output) {
        await navigator.clipboard.writeText(output.textContent || "")
        const label = copyBtn.querySelector(".copy-label")
        if (label) label.textContent = "Copied!"
        window.setTimeout(() => {
          if (label) label.textContent = "Copy Payload"
        }, 1600)
      }
    })
  }

  /* ------------------- widget: package manager tabs ------------------------- */
  const pkgWidget = document.querySelector('[data-widget="pkg-install"]')
  if (pkgWidget) {
    const tabs = [...pkgWidget.querySelectorAll(".pkg-tab")]
    const codeEl = pkgWidget.querySelector("[data-pkg-code]")
    const commands = {
      npm: "npm install && cp .env.example .env.local && npm run dev",
      pnpm: "pnpm install && cp .env.example .env.local && pnpm run dev",
      yarn: "yarn install && cp .env.example .env.local && yarn dev",
      bun: "bun install && cp .env.example .env.local && bun run dev",
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => {
          const active = t === tab
          t.classList.toggle("is-active", active)
          t.setAttribute("aria-selected", String(active))
        })
        const pkg = tab.getAttribute("data-pkg") || "npm"
        if (codeEl) codeEl.textContent = commands[pkg] || commands.npm
      })
    })
  }
})()

