import type { Pool } from "@neondatabase/serverless"

export type IdentityPoolOptions = {
  connectionString?: string
  max?: number
}

export type IdentityPoolStats = {
  creations: number
  totalCount: number
  idleCount: number
  waitingCount: number
}

export declare function getIdentityPool(
  options?: IdentityPoolOptions
): Pool
export declare function identityPoolStats(): IdentityPoolStats
export declare function closeIdentityPool(): Promise<void>
export declare function resetIdentityPoolForTests(): void
