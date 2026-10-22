import { Pool, neonConfig } from "@neondatabase/serverless"
import WebSocket from "ws"

const adminUrl = process.env.AERO_IDENTITY_ADMIN_DATABASE_URL
if (!adminUrl) {
  throw new Error(
    "AERO_IDENTITY_ADMIN_DATABASE_URL is required; use a project owner/admin credential, never the application runtime URL."
  )
}

const password = process.env.AERO_IDENTITY_RUNTIME_PASSWORD
if (!password || Buffer.byteLength(password, "utf8") < 32) {
  throw new Error(
    "AERO_IDENTITY_RUNTIME_PASSWORD must be at least 32 bytes; provide it through the deployment secret store."
  )
}

const role = process.env.AERO_IDENTITY_RUNTIME_ROLE ?? "aero_identity_runtime"
if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role)) {
  throw new Error("AERO_IDENTITY_RUNTIME_ROLE is not a safe PostgreSQL role name.")
}

function ident(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

neonConfig.webSocketConstructor = WebSocket
const pool = new Pool({ connectionString: adminUrl, max: 1 })
let client

async function assertPrivilege(label, query, expected) {
  const result = await client.query(query, [role])
  const actual = result.rows[0]?.value
  if (actual !== expected) {
    throw new Error(
      `Privilege verification failed for ${label}: expected ${expected}, got ${actual}.`
    )
  }
  process.stdout.write(`${label}=${actual}\n`)
}

try {
  client = await pool.connect()
  await client.query("BEGIN")

  const exists = await client.query(
    "SELECT 1 FROM pg_roles WHERE rolname = $1",
    [role]
  )
  const roleSql = ident(role)
  if (exists.rows.length === 0) {
    await client.query(
      `CREATE ROLE ${roleSql} WITH LOGIN PASSWORD ${literal(password)} ` +
        "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS"
    )
  } else {
    await client.query(
      `ALTER ROLE ${roleSql} WITH LOGIN PASSWORD ${literal(password)} ` +
        "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS"
    )
  }
  // Qualified application queries do not need identity or public on the path.
  await client.query(`ALTER ROLE ${roleSql} SET search_path = pg_catalog`)

  const database = (await client.query("SELECT current_database() AS name")).rows[0]
    .name
  await client.query(
    `GRANT CONNECT ON DATABASE ${ident(database)} TO ${roleSql}`
  )

  await client.query(`REVOKE ALL ON SCHEMA identity FROM ${roleSql}`)
  await client.query(`GRANT USAGE ON SCHEMA identity TO ${roleSql}`)
  await client.query(`REVOKE CREATE ON SCHEMA identity FROM ${roleSql}`)

  await client.query(
    `REVOKE ALL ON ALL TABLES IN SCHEMA identity FROM ${roleSql}`
  )
  await client.query(
    `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA identity FROM ${roleSql}`
  )

  // The runtime needs DML for the identity workflows, but never DELETE,
  // TRUNCATE, TRIGGER, REFERENCES, DDL or ownership. Account creation is
  // closed, so INSERT on users is intentionally not granted.
  await client.query(
    `GRANT SELECT, UPDATE ON identity.users TO ${roleSql}`
  )
  await client.query(
    `GRANT SELECT, INSERT, UPDATE ON identity.wallets TO ${roleSql}`
  )
  await client.query(
    `GRANT SELECT, INSERT, UPDATE ON identity.sessions TO ${roleSql}`
  )
  await client.query(
    `GRANT SELECT, INSERT, UPDATE ON identity.wallet_challenges TO ${roleSql}`
  )
  await client.query(
    `GRANT INSERT ON identity.identity_audit_events TO ${roleSql}`
  )

  // The limiter table is reachable only through this SECURITY DEFINER
  // function. The runtime has no direct table privileges.
  await client.query(
    `REVOKE ALL ON FUNCTION identity.consume_rate_limit(bytea, integer, integer, timestamptz) FROM PUBLIC`
  )
  await client.query(
    `GRANT EXECUTE ON FUNCTION identity.consume_rate_limit(bytea, integer, integer, timestamptz) TO ${roleSql}`
  )
  await client.query(
    `REVOKE ALL ON FUNCTION identity.reject_audit_mutation() FROM PUBLIC`
  )
  await client.query(
    `REVOKE ALL ON FUNCTION identity.reject_audit_mutation() FROM ${roleSql}`
  )

  // Keep the migration ledger out of the runtime role's reach when it exists.
  const ledger = await client.query(
    "SELECT to_regclass('public.identity_schema_migrations') IS NOT NULL AS present"
  )
  if (ledger.rows[0].present)
    await client.query(
      `REVOKE ALL ON public.identity_schema_migrations FROM ${roleSql}`
    )

  await assertPrivilege(
    "database_connect",
    "SELECT has_database_privilege($1, current_database(), 'CONNECT') AS value",
    true
  )
  await assertPrivilege(
    "schema_usage",
    "SELECT has_schema_privilege($1, 'identity', 'USAGE') AS value",
    true
  )
  await assertPrivilege(
    "schema_create",
    "SELECT has_schema_privilege($1, 'identity', 'CREATE') AS value",
    false
  )
  await assertPrivilege(
    "users_select",
    "SELECT has_table_privilege($1, 'identity.users', 'SELECT') AS value",
    true
  )
  await assertPrivilege(
    "users_update",
    "SELECT has_table_privilege($1, 'identity.users', 'UPDATE') AS value",
    true
  )
  await assertPrivilege(
    "users_insert_closed",
    "SELECT has_table_privilege($1, 'identity.users', 'INSERT') AS value",
    false
  )
  await assertPrivilege(
    "audit_insert",
    "SELECT has_table_privilege($1, 'identity.identity_audit_events', 'INSERT') AS value",
    true
  )
  for (const privilege of ["UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "REFERENCES"]) {
    await assertPrivilege(
      `audit_${privilege.toLowerCase()}`,
      `SELECT has_table_privilege($1, 'identity.identity_audit_events', '${privilege}') AS value`,
      false
    )
  }
  await assertPrivilege(
    "rate_limits_select",
    "SELECT has_table_privilege($1, 'identity.rate_limits', 'SELECT') AS value",
    false
  )
  await assertPrivilege(
    "rate_limit_execute",
    "SELECT has_function_privilege($1, 'identity.consume_rate_limit(bytea, integer, integer, timestamptz)', 'EXECUTE') AS value",
    true
  )
  await assertPrivilege(
    "audit_function_execute",
    "SELECT has_function_privilege($1, 'identity.reject_audit_mutation()', 'EXECUTE') AS value",
    false
  )

  const ownership = await client.query(
    `SELECT c.relowner = r.oid AS value
       FROM pg_class c JOIN pg_roles r ON r.rolname = $1
      WHERE c.oid = 'identity.identity_audit_events'::regclass`,
    [role]
  )
  if (ownership.rows[0]?.value !== false)
    throw new Error("Runtime role must not own the audit table.")

  const triggers = await client.query(
    `SELECT tgname, tgenabled
       FROM pg_trigger
      WHERE tgrelid = 'identity.identity_audit_events'::regclass
        AND NOT tgisinternal
      ORDER BY tgname`
  )
  const expectedTriggers = new Map([
    ["identity_audit_append_only", "O"],
    ["identity_audit_no_truncate", "O"],
  ])
  for (const row of triggers.rows) {
    if (expectedTriggers.get(row.tgname) !== row.tgenabled)
      throw new Error(`Audit trigger ${row.tgname} is missing or not enabled.`)
    expectedTriggers.delete(row.tgname)
  }
  if (expectedTriggers.size > 0)
    throw new Error("One or more identity audit triggers are missing.")
  process.stdout.write("audit_triggers=enabled\n")

  await client.query("COMMIT")
  process.stdout.write(`runtime_role=${role}\n`)
  process.stdout.write(
    `next_step=set AERO_IDENTITY_DATABASE_URL to the ${role} connection string; keep the admin/migration URL out of the runtime environment\n`
  )
} catch (error) {
  if (client) {
    try {
      await client.query("ROLLBACK")
    } catch {
      /* initialization or connection failure */
    }
  }
  throw error
} finally {
  if (client) client.release()
  await pool.end()
}
