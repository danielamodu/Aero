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
})()

