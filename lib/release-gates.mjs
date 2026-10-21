/**
 * Product release configuration checks.
 *
 * Production allowlisting is intentionally empty until Aero has approved,
 * independently verified deployments. A runtime environment label cannot
 * create an approved deployment.
 */
export const APPROVED_PRODUCTION_DEPLOYMENTS = Object.freeze([])

export const FUJI_CHAIN_ID = 43113

const RELEASE_ENVIRONMENTS = new Set(["local", "testnet", "beta", "production"])
const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const CODE_HASH = /^0x[0-9a-fA-F]{64}$/
const KNOWN_MOCK_ADDRESSES = new Set([
  // Fuji TestUSDC address used by the sandbox's recent-transfer reader.
  "0x4f88395a2cf38645ba2016b6abf5ad084c19c369",
])

function normalizeAddressMap(contracts = {}) {
  return Object.fromEntries(
    Object.entries(contracts)
      .filter(([, address]) => address !== undefined && address !== "")
      .map(([name, address]) => [name, String(address).toLowerCase()]),
  )
}

function productionErrors(config, approvedDeployments) {
  const errors = []
  const chainId = Number(config.chainId)
  if (!Number.isSafeInteger(chainId) || chainId <= 0) errors.push("A valid release chain ID is required.")
  if (!Number.isSafeInteger(Number(config.publicChainId)) || Number(config.publicChainId) !== chainId) {
    errors.push("Server and public production chain IDs must be valid and match.")
  }
  if (chainId === FUJI_CHAIN_ID) errors.push("Avalanche Fuji is testnet and cannot be a production financial network.")

  const configuredContracts = normalizeAddressMap(config.contracts)
  for (const [name, address] of Object.entries(configuredContracts)) {
    if (!ADDRESS.test(address)) errors.push(`Configured ${name} address is malformed.`)
    if (KNOWN_MOCK_ADDRESSES.has(address)) errors.push(`Configured ${name} address is a known test token.`)
  }
  if (Object.keys(configuredContracts).length === 0) errors.push("No contract addresses are configured.")

  const deployment = approvedDeployments.find((candidate) => candidate.chainId === chainId)
  if (!deployment) {
    errors.push("No reviewed production deployment is allowlisted for this chain.")
    return errors
  }
  if (deployment.mock !== false || deployment.verified !== true) {
    errors.push("The allowlisted deployment is not explicitly verified as non-mock.")
  }

  const approvedContracts = normalizeAddressMap(deployment.contracts)
  for (const [name, address] of Object.entries(configuredContracts)) {
    if (approvedContracts[name] !== address) errors.push(`Configured ${name} does not match the approved deployment manifest.`)
  }
  for (const [name, address] of Object.entries(approvedContracts)) {
    if (!ADDRESS.test(address)) errors.push(`Approved ${name} address is malformed.`)
    if (KNOWN_MOCK_ADDRESSES.has(address)) errors.push(`Approved ${name} address is a known test token.`)
    if (configuredContracts[name] !== address) errors.push(`Approved ${name} is missing or differs from runtime configuration.`)
  }
  const approvedHashes = deployment.codeHashes ?? {}
  for (const name of Object.keys(approvedContracts)) {
    if (!CODE_HASH.test(approvedHashes[name] ?? "")) errors.push(`Verified runtime code hash for ${name} is missing.`)
  }

  const controls = deployment.controls ?? {}
  for (const control of ["authentication", "authorization", "database", "monitoring", "incidentResponse"]) {
    if (controls[control] !== true) errors.push(`Production control ${control} is not approved in the deployment manifest.`)
  }
  const requiredRuntime = [
    ["DATABASE_URL", config.databaseUrl],
    ["AERO_AUTH_PROVIDER", config.authProvider],
    ["AERO_SESSION_SECRET", config.sessionSecret],
    ["SENTRY_DSN", config.monitoringDsn],
    ["AERO_INCIDENT_RUNBOOK_URL", config.incidentRunbookUrl],
    ["AERO_DEPLOYMENT_MANIFEST_ID", config.deploymentManifestId],
  ]
  for (const [name, value] of requiredRuntime) {
    if (typeof value !== "string" || value.trim() === "") errors.push(`Required production setting ${name} is missing.`)
  }
  return errors
}

export function validateReleaseConfig(config, approvedDeployments = APPROVED_PRODUCTION_DEPLOYMENTS) {
  const errors = []
  const environment = config.environment
  if (!RELEASE_ENVIRONMENTS.has(environment)) {
    return { ok: false, environment: environment ?? "unset", errors: ["Set AERO_RELEASE_ENVIRONMENT to local, testnet, beta, or production."] }
  }
  if (config.publicEnvironment !== environment) {
    errors.push("AERO_RELEASE_ENVIRONMENT and NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT must match.")
  }
  if (config.nodeEnv === "production" && environment === "local") {
    errors.push("A local release classification cannot be used for a production build.")
  }

  if (environment === "testnet") {
    if (Number(config.chainId) !== FUJI_CHAIN_ID) errors.push("The testnet release must target Avalanche Fuji (chain ID 43113).")
    if (Number(config.publicChainId) !== FUJI_CHAIN_ID) errors.push("NEXT_PUBLIC_AERO_RELEASE_CHAIN_ID must identify Avalanche Fuji (chain ID 43113).")
    if (Number(config.publicChainId) !== Number(config.chainId)) errors.push("Server and public release chain IDs must match.")
  } else if (environment === "beta") {
    errors.push("Controlled beta is blocked until account security, financial records, monitoring, and support are approved.")
  } else if (environment === "production") {
    errors.push(...productionErrors(config, approvedDeployments))
  }

  return { ok: errors.length === 0, environment, errors }
}

/** Keep the existing sandbox reachable in development and explicit Fuji releases only. */
export function isTestnetProductEnabled({ nodeEnv, environment, chainId }) {
  if (environment === "production" || environment === "beta") return false
  if (nodeEnv === "production" && environment !== "testnet") return false
  if (environment === "testnet" && Number(chainId) !== FUJI_CHAIN_ID) return false
  return true
}
