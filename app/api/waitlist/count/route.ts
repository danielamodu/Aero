import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { clientIp, throttle } from "@/lib/rate-limit"
import { db } from "@/lib/db"

/** Public waitlist size for the live counter. Throttled; no personal data. */
export async function GET(req: Request) {
  if (!throttle(`wc:${clientIp(req)}`, 60, 60 * 1000)) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  const sql = db()
  if (sql) {
    const [{ count }] = (await sql`SELECT COUNT(*)::int AS count FROM waitlist`) as { count: number }[]
    return NextResponse.json({ ok: true, count })
  }
  try {
    const raw = await readFile(join(process.cwd(), "data", "waitlist.jsonl"), "utf8")
    const emails = new Set<string>()
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line) as { email?: string }
        if (e.email) emails.add(e.email)
      } catch {
        /* skip */
      }
    }
    return NextResponse.json({ ok: true, count: emails.size })
  } catch {
    return NextResponse.json({ ok: true, count: 0 })
  }
}
