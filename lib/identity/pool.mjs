import { Pool, neonConfig } from "@neondatabase/serverless"
import WebSocket from "ws"

neonConfig.webSocketConstructor = WebSocket

// Test-only local bridge (for example a disposable PostgreSQL instance). The
// production default remains Neon's managed WebSocket proxy. Never set these
// variables in a deployed environment.
const localProxy = process.env.AERO_IDENTITY_WS_PROXY
if (localProxy) {
  neonConfig.wsProxy = (host, port) => `${localProxy}?address=${host}:${port}`
  neonConfig.useSecureWebSocket =
    process.env.AERO_IDENTITY_WS_INSECURE !== "1"
  neonConfig.pipelineConnect = false
}

let pool = null
let poolConnectionString = null
let poolCreations = 0

function configuredMax(env) {
  const parsed = Number(env.AERO_IDENTITY_POOL_MAX ?? 5)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 20) return 5
  return parsed
}

/**
 * Return the process-wide identity pool. The pool is created once per Node
 * process (or serverless instance) and reused for every request. It is never
 * ended from a request path.
 */
export function getIdentityPool(options = {}) {
  const connectionString =
    options.connectionString ?? process.env.AERO_IDENTITY_DATABASE_URL
  if (!connectionString) throw new Error("IDENTITY_DATABASE_UNAVAILABLE")

  if (pool) {
    if (poolConnectionString !== connectionString)
      throw new Error("IDENTITY_POOL_CONFIGURATION_CONFLICT")
    return pool
  }

  pool = new Pool({
    connectionString,
    max: options.max ?? configuredMax(process.env),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  })
  poolConnectionString = connectionString
  poolCreations += 1
  pool.on("error", (error) => {
    // Never log the connection string or query text.
    console.warn(
      "identity pool error",
      typeof error?.code === "string" ? error.code : "unknown"
    )
  })
  return pool
}

export function identityPoolStats() {
  return {
    creations: poolCreations,
    totalCount: pool?.totalCount ?? 0,
    idleCount: pool?.idleCount ?? 0,
    waitingCount: pool?.waitingCount ?? 0,
  }
}

export async function closeIdentityPool() {
  if (!pool) return
  const oldPool = pool
  pool = null
  poolConnectionString = null
  await oldPool.end()
}

export function resetIdentityPoolForTests() {
  if (pool) throw new Error("IDENTITY_POOL_STILL_OPEN")
  poolCreations = 0
}
