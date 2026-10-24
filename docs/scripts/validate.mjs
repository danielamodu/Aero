#!/usr/bin/env node
/**
 * Static docs validation. Fails the build on missing pages, broken internal
 * links, missing search index, insufficient diagrams or placeholder content.
 */
import { readFile, readdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { flatNavigation, site } from "../src/nav.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const dist = path.join(root, "dist")
const errors = []
const warnings = []

function fail(message) {
  errors.push(message)
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

async function main() {
  if (!existsSync(dist)) {
    fail("dist/ does not exist. Run npm run build first.")
    return finish()
  }

  const manifest = await readJson(path.join(dist, "build-manifest.json"))
  if (manifest.pages.length !== flatNavigation.length) {
    fail(`Manifest has ${manifest.pages.length} pages; navigation has ${flatNavigation.length}.`)
  }
  if (manifest.site !== site.domain) fail(`Manifest site is ${manifest.site}; expected ${site.domain}.`)
  if (manifest.diagrams < 8) fail(`Only ${manifest.diagrams} Mermaid diagrams; at least 8 are required.`)

  const expected = new Set()
  for (const item of flatNavigation) {
    const route = item.file === "index" ? "/" : `/${item.file.replace(/\/index$/, "")}/`
    const file = route === "/" ? path.join(dist, "index.html") : path.join(dist, route.slice(1), "index.html")
    expected.add(path.normalize(file))
    if (!existsSync(file)) {
      fail(`Missing page: ${route}`)
      continue
    }
    const html = await readFile(file, "utf8")
    if (!html.includes("<title>")) fail(`${route} has no <title>.`)
    if (!html.includes('name="description"')) fail(`${route} has no meta description.`)
    if (!html.includes('rel="canonical"')) fail(`${route} has no canonical URL.`)
    if (!html.includes('id="main-content"')) fail(`${route} has no main landmark.`)
    if (!html.includes('href="/assets/styles.css"')) fail(`${route} does not load styles.css.`)
    if (!html.includes('src="/assets/app.js"')) fail(`${route} does not load app.js.`)
    if (/\blorem ipsum\b|\bTODO\b|\[placeholder\]/i.test(html)) fail(`${route} contains placeholder copy.`)
    if (item.file === "index" && !html.includes("Money that moves")) fail("Homepage hero is missing.")
  }

  const search = await readJson(path.join(dist, "search-index.json"))
  if (!Array.isArray(search) || search.length !== flatNavigation.length) {
    fail("Search index does not contain every page.")
  } else {
    for (const page of search) {
      if (!page.title || !page.url || !page.text || page.text.length < 200) {
        fail(`Search entry is incomplete: ${page.title || "(untitled)"}`)
      }
    }
  }

  const requiredFiles = [
    "404.html",
    "search-index.json",
    "sitemap.xml",
    "robots.txt",
    "assets/styles.css",
    "assets/app.js",
    "assets/favicon.png",
    "build-manifest.json",
  ]
  for (const file of requiredFiles) {
    if (!existsSync(path.join(dist, file))) fail(`Missing required output: ${file}`)
  }

  const sitemap = await readFile(path.join(dist, "sitemap.xml"), "utf8")
  if (!sitemap.includes(`${site.domain}/`)) fail("Sitemap does not reference the docs domain.")
  const robots = await readFile(path.join(dist, "robots.txt"), "utf8")
  if (!robots.includes(`${site.domain}/sitemap.xml`)) fail("robots.txt does not reference the sitemap.")

  const htmlFiles = []
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith(".html")) htmlFiles.push(full)
    }
  }
  await walk(dist)

  let internalLinks = 0
  let diagrams = 0
  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8")
    diagrams += (html.match(/class="mermaid"/g) || []).length
    const links = [...html.matchAll(/href="(\/[^"#?]*)(?:[#?][^"]*)?"/g)].map((match) => match[1])
    for (const link of links) {
      if (link.startsWith("/assets/") || link === "/search-index.json" || link === "/sitemap.xml" || link === "/robots.txt") continue
      const target = path.join(dist, link.replace(/^\//, ""))
      const candidates = [target, path.join(target, "index.html")]
      if (!candidates.some((candidate) => existsSync(candidate))) {
        fail(`${path.relative(dist, file)} links to missing internal path ${link}`)
      }
      internalLinks += 1
    }
    if (!html.includes('rel="noopener noreferrer"')) {
      warnings.push(`${path.relative(dist, file)} has no external link with rel="noopener noreferrer".`)
    }
  }

  if (diagrams < 8) fail(`Rendered pages contain ${diagrams} diagrams; at least 8 are expected.`)

  const allText = (
    await Promise.all(search.map((page) => Promise.resolve(page.text)))
  ).join("\n").toLowerCase()
  const forbidden = [
    "instant withdrawals are guaranteed",
    "guaranteed instant withdrawals",
    "live benqi yield",
    "production ready financial service",
  ]
  for (const phrase of forbidden) {
    if (allText.includes(phrase)) fail(`Unsupported claim found: “${phrase}”`)
  }

  const favicon = await readFile(path.join(dist, "assets/favicon.png"))
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!favicon.subarray(0, 8).equals(pngSignature)) fail("favicon.png is not a PNG image.")
  const faviconWidth = favicon.readUInt32BE(16)
  const faviconHeight = favicon.readUInt32BE(20)
  if (faviconWidth !== faviconHeight) fail("favicon.png must be square.")
  if (faviconWidth < 180) fail("favicon.png must be at least 180px.")

  console.log(
    `Validated ${htmlFiles.length} HTML files, ${internalLinks} internal links, ${diagrams} diagrams, ${search.length} search entries.`
  )
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`)
    warnings.slice(0, 12).forEach((warning) => console.log(`- ${warning}`))
  }
  finish()
}

function finish() {
  if (errors.length) {
    console.error(`\n${errors.length} validation error(s):`)
    errors.forEach((error) => console.error(`- ${error}`))
    process.exitCode = 1
  } else {
    console.log("Docs validation passed.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
