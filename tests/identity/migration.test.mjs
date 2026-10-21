import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Pool, neonConfig } from "@neondatabase/serverless"
import WebSocket from "ws"

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const sql = await readFile(
  join(root, "migrations", "identity", "001_identity_schema.sql"),
  "utf8"
)

test("identity migration is additive and leaves waitlist schema/data alone", () => {
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS identity/i)
  assert.doesNotMatch(sql, /\bDROP\s+(TABLE|SCHEMA|DATABASE)\b/i)
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+(public\.)?waitlist\b/i)
  assert.match(sql, /CREATE TABLE identity\.users/i)
  assert.match(sql, /CREATE TABLE identity\.wallets/i)
  assert.match(sql, /CREATE TABLE identity\.wallet_challenges/i)
  assert.match(sql, /CREATE TABLE identity\.sessions/i)
  assert.match(sql, /CREATE TABLE identity\.identity_audit_events/i)
})

test("database constraints enforce active-wallet uniqueness and primary behavior", () => {
  assert.match(
    sql,
    /wallets_active_eoa_address_uq[\s\S]*?WHERE wallet_kind = 'eoa'[\s\S]*?revoked_at IS NULL/i
  )
  assert.match(
    sql,
    /wallets_one_active_primary_uq[\s\S]*?WHERE is_primary[\s\S]*?revoked_at IS NULL/i
  )
  assert.match(
    sql,
    /verification_status = 'verified'[\s\S]*?revoked_at IS NULL/i
  )
  assert.match(sql, /chain_id = 43113/i)
  assert.match(sql, /attempt_count BETWEEN 0 AND 5/i)
})

test("audit history is append-only and migration does not enable a purge", () => {
  assert.match(
    sql,
    /BEFORE UPDATE OR DELETE ON identity\.identity_audit_events/i
  )
  assert.match(sql, /identity audit events are append-only/i)
  assert.doesNotMatch(
    sql,
    /CREATE\s+(EVENT\s+TRIGGER|TRIGGER)[^;]*(purge|retention)/i
  )
})

const integrationUrl = process.env.AERO_TEST_DATABASE_URL
const integrationOptIn =
  process.env.AERO_TEST_DATABASE_CONFIRM === "I_AM_USING_A_DISPOSABLE_DATABASE"
test(
  "Postgres additive migration, concurrency, constraints, audit immutability, and waitlist preservation",
  {
    skip:
      integrationUrl && integrationOptIn
        ? false
        : "set AERO_TEST_DATABASE_URL and AERO_TEST_DATABASE_CONFIRM=I_AM_USING_A_DISPOSABLE_DATABASE for a disposable DB; no live DB integration is claimed",
  },
  async () => {
    if (!integrationUrl) return
    neonConfig.webSocketConstructor = WebSocket
    const run = promisify(execFile)
    const env = { ...process.env, DATABASE_URL: integrationUrl }
    const pool = new Pool({ connectionString: integrationUrl, max: 1 })
    try {
      const beforeTables = await pool.query(
        "SELECT to_regclass('public.waitlist') AS waitlist"
      )
      const beforeRows = beforeTables.rows[0].waitlist
        ? Number(
            (
              await pool.query(
                "SELECT count(*)::text AS count FROM public.waitlist"
              )
            ).rows[0].count
          )
        : null

      const results = await Promise.all([
        run(process.execPath, [join(root, "scripts", "migrate-identity.mjs")], {
          env,
        }),
        run(process.execPath, [join(root, "scripts", "migrate-identity.mjs")], {
          env,
        }),
      ])
      assert.equal(results.length, 2)
      const objects = await pool.query(`
      SELECT to_regclass('identity.users') AS users,
             to_regclass('identity.wallets') AS wallets,
             to_regclass('identity.wallet_challenges') AS challenges,
             to_regclass('identity.sessions') AS sessions,
             to_regclass('identity.identity_audit_events') AS audit
    `)
      assert.ok(Object.values(objects.rows[0]).every(Boolean))

      const userA = randomUUID()
      const userB = randomUUID()
      const walletA = randomUUID()
      const walletB = randomUUID()
      const auditId = randomUUID()
      const address = `0x${"a".repeat(40)}`
      await pool.query("BEGIN")
      try {
        await pool.query("INSERT INTO identity.users (id) VALUES ($1), ($2)", [
          userA,
          userB,
        ])
        await pool.query(
          `INSERT INTO identity.wallets
        (id,user_id,namespace,wallet_kind,address_normalized,verification_status,is_primary)
        VALUES ($1,$2,'eip155','eoa',$3,'verified',true)`,
          [walletA, userA, address]
        )
        await pool.query("SAVEPOINT duplicate_wallet")
        await assert.rejects(
          pool.query(
            `INSERT INTO identity.wallets
        (id,user_id,namespace,wallet_kind,address_normalized,verification_status,is_primary)
        VALUES ($1,$2,'eip155','eoa',$3,'verified',false)`,
            [walletB, userB, address]
          )
        )
        await pool.query("ROLLBACK TO SAVEPOINT duplicate_wallet")
        await pool.query("SAVEPOINT duplicate_primary")
        await assert.rejects(
          pool.query(
            `INSERT INTO identity.wallets
        (id,user_id,namespace,wallet_kind,address_normalized,verification_status,is_primary)
        VALUES ($1,$2,'eip155','eoa',$3,'verified',true)`,
            [walletB, userA, `0x${"b".repeat(40)}`]
          )
        )
        await pool.query("ROLLBACK TO SAVEPOINT duplicate_primary")
        await pool.query(
          `INSERT INTO identity.identity_audit_events
        (id,actor_kind,action_code) VALUES ($1,'system','test.integration')`,
          [auditId]
        )
        await pool.query("SAVEPOINT audit_mutation")
        await assert.rejects(
          pool.query(
            "UPDATE identity.identity_audit_events SET action_code='changed' WHERE id=$1",
            [auditId]
          )
        )
        await pool.query("ROLLBACK TO SAVEPOINT audit_mutation")
      } finally {
        await pool.query("ROLLBACK")
      }

      if (beforeRows !== null) {
        const afterRows = Number(
          (
            await pool.query(
              "SELECT count(*)::text AS count FROM public.waitlist"
            )
          ).rows[0].count
        )
        assert.equal(afterRows, beforeRows)
      }
    } finally {
      await pool.end()
    }
  }
)
