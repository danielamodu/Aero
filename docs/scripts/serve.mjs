#!/usr/bin/env node
/** Minimal static preview server for the built docs. */
import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "dist")
const port = Number(process.env.PORT || 4173)

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0])
  const safe = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "")
  const target = path.join(root, safe)
  if (!target.startsWith(root)) return null
  try {
    const info = await stat(target)
    if (info.isDirectory()) return path.join(target, "index.html")
    return target
  } catch {
    if (!path.extname(target)) {
      try {
        const candidate = path.join(target, "index.html")
        await stat(candidate)
        return candidate
      } catch {
        return null
      }
    }
    return null
  }
}

createServer(async (request, response) => {
  const file = await resolveFile(request.url || "/")
  if (!file) {
    try {
      const notFound = await readFile(path.join(root, "404.html"))
      response.writeHead(404, { "content-type": "text/html; charset=utf-8" })
      response.end(notFound)
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
      response.end("Not found")
    }
    return
  }
  try {
    const contents = await readFile(file)
    response.writeHead(200, {
      "content-type": types[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    })
    response.end(contents)
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" })
    response.end("Server error")
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Aero docs preview → http://127.0.0.1:${port}`)
})
