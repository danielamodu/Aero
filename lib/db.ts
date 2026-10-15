import { neon } from "@neondatabase/serverless"

type Db = ReturnType<typeof neon>

let client: Db | null | undefined;

/** Lazy Postgres client. Null when DATABASE_URL is unset (dev without a DB falls back to the file store). */
export function db(): Db | null {
  if (client !== undefined) return client
  client = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
  return client
}

/** Where signups actually live right now — shown in /admin so it's never ambiguous. */
export function storeKind(): "postgres" | "local file" {
  return process.env.DATABASE_URL ? "postgres" : "local file"
}
