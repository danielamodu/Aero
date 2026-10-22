import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Pool, neonConfig } from "@neondatabase/serverless"
import WebSocket from "ws"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const migrationDir = join(root, "migrations", "identity")
const lockKey = 72843113001n

const connectionString =
  process.env.AERO_IDENTITY_MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "AERO_IDENTITY_MIGRATION_DATABASE_URL or DATABASE_URL is required; identity migrations never use a local-file fallback or the runtime URL."
  )
}

neonConfig.webSocketConstructor = WebSocket
const pool = new Pool({ connectionString, max: 1 })
let client

try {
  client = await pool.connect()
  await client.query("SELECT pg_advisory_lock($1)", [lockKey.toString()])
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.identity_schema_migrations (
      migration_id text PRIMARY KEY,
      checksum_sha256 char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(migrationDir))
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
  if (files.length === 0) throw new Error("No identity migrations found.")

  const applied = await client.query(
    "SELECT migration_id, checksum_sha256 FROM public.identity_schema_migrations ORDER BY migration_id"
  )
  const appliedById = new Map(
    applied.rows.map((row) => [row.migration_id, row.checksum_sha256])
  )
  for (const migrationId of appliedById.keys()) {
    if (!files.includes(migrationId))
      throw new Error(
        `Applied migration is missing from source: ${migrationId}`
      )
  }

  for (const file of files) {
    const source = await readFile(join(migrationDir, file), "utf8")
    const checksum = createHash("sha256").update(source).digest("hex")
    const existing = appliedById.get(file)
    if (existing && existing !== checksum) {
      throw new Error(`Applied migration checksum mismatch: ${file}`)
    }
    if (existing) continue

    await client.query("BEGIN")
    try {
      await client.query(source)
      await client.query(
        "INSERT INTO public.identity_schema_migrations (migration_id, checksum_sha256) VALUES ($1, $2)",
        [file, checksum]
      )
      await client.query("COMMIT")
      process.stdout.write(`applied ${file} ${checksum}\n`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    }
  }
} finally {
  if (client) {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [lockKey.toString()])
    } finally {
      client.release()
    }
  }
  await pool.end()
}
