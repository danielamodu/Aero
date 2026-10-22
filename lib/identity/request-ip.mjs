import { isIP } from "node:net"

const UNATTRIBUTED = "unattributed"

function normalizeAddress(raw) {
  if (typeof raw !== "string") return null
  const first = raw.split(",")[0]?.trim()
  if (!first) return null
  if (isIP(first)) return first

  // Forwarded headers sometimes carry an IPv4:port pair, or a bracketed IPv6
  // address followed by a port. Accept only values that are valid IP literals
  // after stripping that transport suffix.
  if (first.startsWith("[")) {
    const end = first.indexOf("]")
    if (end < 1) return null
    const inner = first.slice(1, end)
    return isIP(inner) ? inner : null
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(first)) {
    const withoutPort = first.slice(0, first.lastIndexOf(":"))
    return isIP(withoutPort) ? withoutPort : null
  }
  return null
}

/**
 * Resolve the rate-limit subject from a request.
 *
 * Forwarded headers are untrusted by default. Set AERO_TRUST_PROXY=vercel when
 * the deployment is behind Vercel, whose edge overwrites x-forwarded-for and
 * prevents external IP spoofing. A generic proxy can opt in explicitly with
 * AERO_TRUST_PROXY=header:<lowercase-header-name>, but only when that proxy
 * overwrites the header on every request.
 *
 * When no trusted address is available, all such requests share a single
 * "unattributed" bucket. That is deliberately conservative: a random wallet
 * address cannot escape the shared limit by omitting or spoofing a header.
 */
export function requestRateLimitSubject(headers, env = process.env) {
  const mode = String(env.AERO_TRUST_PROXY ?? "none").trim().toLowerCase()
  if (mode === "vercel") {
    for (const name of [
      "x-vercel-forwarded-for",
      "x-forwarded-for",
      "x-real-ip",
    ]) {
      const address = normalizeAddress(headers.get(name))
      if (address) return address
    }
    return UNATTRIBUTED
  }
  if (mode.startsWith("header:")) {
    const name = mode.slice("header:".length)
    if (!/^[a-z0-9-]{1,64}$/.test(name)) return UNATTRIBUTED
    return normalizeAddress(headers.get(name)) ?? UNATTRIBUTED
  }
  return UNATTRIBUTED
}

export { UNATTRIBUTED }
