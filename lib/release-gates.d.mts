export type ReleaseEnvironment = "local" | "testnet" | "beta" | "production"

export type ApprovedDeployment = {
  chainId: number
  mock: boolean
  verified: boolean
  contracts: Record<string, string>
  codeHashes?: Record<string, string>
  controls?: Record<string, boolean>
}

export type ReleaseConfig = {
  environment?: string
  publicEnvironment?: string
  nodeEnv?: string
  chainId?: string | number
  publicChainId?: string | number
  contracts?: Record<string, string | undefined>
  databaseUrl?: string
  authProvider?: string
  sessionSecret?: string
  monitoringDsn?: string
  incidentRunbookUrl?: string
  deploymentManifestId?: string
}

export const APPROVED_PRODUCTION_DEPLOYMENTS: readonly ApprovedDeployment[]
export const FUJI_CHAIN_ID: 43113
export function validateReleaseConfig(
  config: ReleaseConfig,
  approvedDeployments?: readonly ApprovedDeployment[],
): { ok: boolean; environment: string; errors: string[] }
export function isTestnetProductEnabled(input: {
  nodeEnv?: string
  environment?: string
  chainId?: string | number
}): boolean
