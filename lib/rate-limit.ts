/**
 * Tiny in-memory IP throttle. Good enough as a first line of defense
 * against signup spam (5 signups / 10 min per IP).
 *
 * Limitation: state is per server instance, so on serverless it resets
 * on cold starts and isn't shared across regions. If abuse persists,
 * graduate to Upstash Redis + @upstash/ratelimit.
 */

const buckets = new Map<string, number[]>()

export function throttle(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return false
  }
  hits.push(now)
  buckets.set(key, hits)
  // Prevent unbounded growth in long-lived processes.
  if (buckets.size > 5000) buckets.clear()
  return true
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}
