import { Pool, neonConfig, type PoolClient } from "@neondatabase/serverless"
import WebSocket from "ws"

type IdentityClient = PoolClient

neonConfig.webSocketConstructor = WebSocket

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("IDENTITY_DATABASE_UNAVAILABLE")
  return new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
  })
}

export async function withIdentityTransaction<T>(
  work: (client: IdentityClient) => Promise<T>
): Promise<T> {
  const pool = createPool()
  try {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const result = await work(client)
      await client.query("COMMIT")
      return result
    } catch (error) {
      try {
        await client.query("ROLLBACK")
      } catch {
        /* connection is already unusable */
      }
      throw error
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

export async function withIdentityRead<T>(
  work: (client: IdentityClient) => Promise<T>
): Promise<T> {
  return withIdentityTransaction(async (client) => {
    await client.query("SET TRANSACTION READ ONLY")
    return work(client)
  })
}

export type { IdentityClient }
