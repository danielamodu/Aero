import { validateReleaseConfig } from "../lib/release-gates.mjs"

const env = process.env
const contracts = {
  usdc: env.NEXT_PUBLIC_USDC,
  testUsdc: env.NEXT_PUBLIC_TEST_USDC,
  names: env.NEXT_PUBLIC_AERO_NAMES,
  pay: env.NEXT_PUBLIC_AEROPAY,
  router: env.NEXT_PUBLIC_ROUTER,
  vault: env.NEXT_PUBLIC_AERO_VAULT,
  bank: env.NEXT_PUBLIC_BANK,
}

const result = validateReleaseConfig({
  environment: env.AERO_RELEASE_ENVIRONMENT,
  publicEnvironment: env.NEXT_PUBLIC_AERO_RELEASE_ENVIRONMENT,
  nodeEnv: env.NODE_ENV,
  chainId: env.AERO_RELEASE_CHAIN_ID,
  publicChainId: env.NEXT_PUBLIC_AERO_RELEASE_CHAIN_ID,
  contracts,
  databaseUrl: env.DATABASE_URL,
  authProvider: env.AERO_AUTH_PROVIDER,
  sessionSecret: env.AERO_SESSION_SECRET,
  monitoringDsn: env.SENTRY_DSN,
  incidentRunbookUrl: env.AERO_INCIDENT_RUNBOOK_URL,
  deploymentManifestId: env.AERO_DEPLOYMENT_MANIFEST_ID,
})

if (!result.ok) {
  process.stderr.write(`Aero ${result.environment} release blocked:\n`)
  for (const error of result.errors) process.stderr.write(`- ${error}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Aero ${result.environment} release configuration accepted.\n`)
}
