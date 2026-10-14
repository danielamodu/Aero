import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { db } from "./db"

export type Signup = {
  email: string
  username: string
  created_at: string
  confirmed: boolean
  referrals: number
}

/** Replays the append-only signup log into latest-state-per-email. */
export async function readSignups(): Promise<Signup[]> {
  const sql = db()
  if (sql) {
    const rows = (await sql`
      SELECT w.email, w.username, w.created_at::text AS created_at, w.confirmed,
             (SELECT COUNT(*)::int FROM waitlist r WHERE r.referred_by = w.referral_code) AS referrals
      FROM waitlist w ORDER BY w.created_at DESC
    `) as Signup[]
    return rows
  }
  try {
    const dir = process.env.WAITLIST_DIR ?? join(process.cwd(), "data")
    const raw = await readFile(join(dir, "waitlist.jsonl"), "utf8")
    const byEmail = new Map<string, Signup>()
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue
      try {
        const e = JSON.parse(line) as Partial<Signup> & { event?: string }
        if (!e.email) continue
        const prev = byEmail.get(e.email)
        byEmail.set(e.email, {
          email: e.email,
          username: e.username ?? prev?.username ?? "",
          created_at: prev?.created_at ?? e.created_at ?? "",
          confirmed: prev?.confirmed || e.event === "confirmed",
          referrals: 0,
        })
      } catch {
        /* skip malformed lines */
      }
    }
    return [...byEmail.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  } catch {
    return []
  }
}
