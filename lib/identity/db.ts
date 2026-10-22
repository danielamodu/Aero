import type { PoolClient } from "@neondatabase/serverless"
import { getIdentityPool } from "./pool.mjs"

export type IdentityClient = PoolClient

/**
 * The pool is module-scoped and reused across requests. A request only checks
 * out one client for the duration of its transaction and always releases it.
 * The pool is never ended from a request path; scripts and tests call
 * closeIdentityPool() explicitly.
 */
export async function withIdentityTransaction<T>(
  work: (client: IdentityClient) => Promise<T>
): Promise<T> {
  const pool = getIdentityPool()
  const client = await pool.connect()
  let destroy = false
  try {
    await client.query("BEGIN")
    const result = await work(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // A broken connection must not return to the pool.
      destroy = true
    }
    throw error
  } finally {
    client.release(destroy)
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
