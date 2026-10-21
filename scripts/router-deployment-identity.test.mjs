import test from "node:test"
import assert from "node:assert/strict"
import { keccak256 } from "viem"
import {
  isCompleteRouterManifest,
  verifyRouterDeploymentIdentity,
} from "../lib/router-deployment-identity.mjs"

const routerAddress = "0x1111111111111111111111111111111111111111"
const assetAddress = "0x2222222222222222222222222222222222222222"
const adapterAddress = "0x3333333333333333333333333333333333333333"
const routerBytecode = "0x6001600055"
const adapterBytecode = "0x6002600055"

const manifest = {
  chainId: 43113,
  routerAddress,
  routerRuntimeCodeHash: keccak256(routerBytecode),
  assetAddress,
  adapters: [{ address: adapterAddress, runtimeCodeHash: keccak256(adapterBytecode) }],
  trustSource: "reviewed-source-control",
}

const observation = {
  chainId: 43113,
  configuredRouterAddress: routerAddress,
  configuredAssetAddress: assetAddress,
  routerBytecode,
  deploymentVersion: 2111,
  assetAddress,
  slotCount: 1,
  configurationValid: true,
  slotAddresses: [adapterAddress],
  adapterBytecodes: [adapterBytecode],
}

test("accepts a complete matching Fuji deployment identity", () => {
  assert.equal(isCompleteRouterManifest(manifest), true)
  assert.deepEqual(verifyRouterDeploymentIdentity(observation, manifest), { ok: true, errors: [] })
})

test("rejects a wrong connected chain", () => {
  assert.match(verifyRouterDeploymentIdentity({ ...observation, chainId: 1 }, manifest).errors.join(" "), /chain/)
})

test("rejects a router without contract bytecode", () => {
  assert.match(verifyRouterDeploymentIdentity({ ...observation, routerBytecode: "0x" }, manifest).errors.join(" "), /bytecode/)
})

test("rejects a configured router address different from the reviewed address", () => {
  const result = verifyRouterDeploymentIdentity({
    ...observation,
    configuredRouterAddress: "0x4444444444444444444444444444444444444444",
  }, manifest)
  assert.match(result.errors.join(" "), /router address/)
})

test("rejects a wrong router runtime code hash", () => {
  assert.match(verifyRouterDeploymentIdentity({ ...observation, routerBytecode: "0x6003600055" }, manifest).errors.join(" "), /Router runtime code hash/)
})

test("rejects a wrong adapter address", () => {
  const result = verifyRouterDeploymentIdentity({
    ...observation,
    slotAddresses: ["0x5555555555555555555555555555555555555555"],
  }, manifest)
  assert.match(result.errors.join(" "), /Adapter 0 address/)
})

test("rejects a wrong adapter runtime code hash", () => {
  const result = verifyRouterDeploymentIdentity({ ...observation, adapterBytecodes: ["0x6004600055"] }, manifest)
  assert.match(result.errors.join(" "), /Adapter 0 runtime code hash/)
})

test("rejects missing and malformed manifests", () => {
  assert.equal(isCompleteRouterManifest(null), false)
  assert.equal(verifyRouterDeploymentIdentity(observation, undefined).ok, false)
  assert.equal(isCompleteRouterManifest({ ...manifest, routerAddress: "0x1234" }), false)
  assert.equal(isCompleteRouterManifest({ ...manifest, adapters: [] }), false)
})

test("rejects a stale router version", () => {
  assert.match(verifyRouterDeploymentIdentity({ ...observation, deploymentVersion: 2110 }, manifest).errors.join(" "), /version/)
})

test("rejects incomplete router configuration and slot manifest mismatch", () => {
  assert.match(verifyRouterDeploymentIdentity({ ...observation, configurationValid: false }, manifest).errors.join(" "), /configuration/)
  assert.match(verifyRouterDeploymentIdentity({ ...observation, slotCount: 2 }, manifest).errors.join(" "), /slot count/)
})
