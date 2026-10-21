import test from "node:test"
import assert from "node:assert/strict"
import { isTestnetProductEnabled, validateReleaseConfig } from "../lib/release-gates.mjs"

const base = {
  environment: "testnet",
  publicEnvironment: "testnet",
  chainId: 43113,
  publicChainId: 43113,
}

test("explicit Fuji testnet configuration is accepted", () => {
  assert.deepEqual(validateReleaseConfig(base), { ok: true, environment: "testnet", errors: [] })
})

test("missing or unknown release category fails closed", () => {
  assert.equal(validateReleaseConfig({}).ok, false)
  assert.equal(validateReleaseConfig({ ...base, environment: "preview" }).ok, false)
})

test("testnet release rejects a non-Fuji chain", () => {
  const result = validateReleaseConfig({ ...base, chainId: 43114 })
  assert.equal(result.ok, false)
  assert.match(result.errors.join(" "), /Fuji/)
})

test("testnet release rejects mismatched server and browser chain settings", () => {
  const result = validateReleaseConfig({ ...base, publicChainId: 1 })
  assert.equal(result.ok, false)
  assert.match(result.errors.join(" "), /public release chain ID/)
})

test("production classification alone cannot enable a financial release", () => {
  const result = validateReleaseConfig({
    ...base,
    environment: "production",
    publicEnvironment: "production",
    chainId: 43114,
    contracts: { usdc: "0x1111111111111111111111111111111111111111" },
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join(" "), /No reviewed production deployment/)
})

test("production release rejects a public chain ID mismatch", () => {
  const result = validateReleaseConfig({
    ...base,
    environment: "production",
    publicEnvironment: "production",
    chainId: 1,
    publicChainId: 43114,
    contracts: { usdc: "0x1111111111111111111111111111111111111111" },
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join(" "), /public production chain IDs/)
})

test("production configuration rejects Fuji and the known sandbox token", () => {
  const result = validateReleaseConfig({
    ...base,
    environment: "production",
    publicEnvironment: "production",
    contracts: { testUsdc: "0x4f88395a2cf38645ba2016b6abf5ad084c19c369" },
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join(" "), /Fuji/)
  assert.match(result.errors.join(" "), /known test token/)
})

test("production configuration cannot use an unapproved arbitrary contract address", () => {
  const result = validateReleaseConfig({
    ...base,
    environment: "production",
    publicEnvironment: "production",
    chainId: 1,
    contracts: { usdc: "0x1111111111111111111111111111111111111111" },
  })
  assert.equal(result.ok, false)
  assert.match(result.errors.join(" "), /No reviewed production deployment/)
})

test("beta is blocked until its identity and operations prerequisites exist", () => {
  const result = validateReleaseConfig({ ...base, environment: "beta", publicEnvironment: "beta" })
  assert.equal(result.ok, false)
  assert.match(result.errors.join(" "), /Controlled beta is blocked/)
})

test("testnet UI is hidden in production unless explicitly classified as Fuji testnet", () => {
  assert.equal(isTestnetProductEnabled({ nodeEnv: "production" }), false)
  assert.equal(isTestnetProductEnabled({ nodeEnv: "production", environment: "production", chainId: 1 }), false)
  assert.equal(isTestnetProductEnabled({ nodeEnv: "production", environment: "testnet", chainId: 43113 }), true)
  assert.equal(isTestnetProductEnabled({ nodeEnv: "production", environment: "testnet", chainId: 1 }), false)
  assert.equal(isTestnetProductEnabled({ nodeEnv: "development" }), true)
})
