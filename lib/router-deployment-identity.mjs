import { keccak256 } from "viem"

const ADDRESS = /^0x[0-9a-f]{40}$/i
const CODE_HASH = /^0x[0-9a-f]{64}$/i
const BYTECODE = /^0x(?:[0-9a-f]{2})+$/i
const MAX_ADAPTERS = 16
const ROUTER_VERSION = 2111
const TRUST_SOURCE = "reviewed-source-control"
const ZERO_ADDRESS = `0x${"0".repeat(40)}`

const fail = (...errors) => ({ ok: false, errors })
const normalize = (value) => value.toLowerCase()

export function isCompleteRouterManifest(manifest) {
  if (!manifest || typeof manifest !== "object") return false
  if (manifest.trustSource !== TRUST_SOURCE || manifest.chainId !== 43113) return false
  if (typeof manifest.routerAddress !== "string" || !ADDRESS.test(manifest.routerAddress) || normalize(manifest.routerAddress) === ZERO_ADDRESS) return false
  if (typeof manifest.routerRuntimeCodeHash !== "string" || !CODE_HASH.test(manifest.routerRuntimeCodeHash)) return false
  if (typeof manifest.assetAddress !== "string" || !ADDRESS.test(manifest.assetAddress) || normalize(manifest.assetAddress) === ZERO_ADDRESS) return false
  if (!Array.isArray(manifest.adapters) || manifest.adapters.length < 1 || manifest.adapters.length > MAX_ADAPTERS) return false
  const seen = new Set()
  for (const adapter of manifest.adapters) {
    if (!adapter || typeof adapter.address !== "string" || !ADDRESS.test(adapter.address) || normalize(adapter.address) === ZERO_ADDRESS) return false
    if (typeof adapter.runtimeCodeHash !== "string" || !CODE_HASH.test(adapter.runtimeCodeHash)) return false
    const address = normalize(adapter.address)
    if (seen.has(address)) return false
    seen.add(address)
  }
  return true
}

export function verifyRouterDeploymentIdentity(observation, manifest) {
  if (!isCompleteRouterManifest(manifest)) {
    return fail("A complete source-controlled router deployment manifest is required.")
  }

  const errors = []
  if (observation?.chainId !== manifest.chainId) errors.push("Connected chain does not match the reviewed deployment.")
  if (typeof observation?.configuredRouterAddress !== "string" || !ADDRESS.test(observation.configuredRouterAddress) ||
      normalize(observation.configuredRouterAddress) !== normalize(manifest.routerAddress)) {
    errors.push("Configured router address does not match the reviewed deployment.")
  }
  if (typeof observation?.configuredAssetAddress !== "string" || !ADDRESS.test(observation.configuredAssetAddress) ||
      normalize(observation.configuredAssetAddress) !== normalize(manifest.assetAddress) ||
      typeof observation?.assetAddress !== "string" || !ADDRESS.test(observation.assetAddress) ||
      normalize(observation.assetAddress) !== normalize(manifest.assetAddress)) {
    errors.push("Router underlying asset does not match the reviewed deployment.")
  }

  if (typeof observation?.routerBytecode !== "string" || !BYTECODE.test(observation.routerBytecode)) {
    errors.push("Router contract bytecode is missing or malformed.")
  } else if (normalize(keccak256(observation.routerBytecode)) !== normalize(manifest.routerRuntimeCodeHash)) {
    errors.push("Router runtime code hash does not match the reviewed deployment.")
  }

  if (observation?.deploymentVersion !== ROUTER_VERSION) errors.push("Router deployment version is stale or incompatible.")
  if (observation?.configurationValid !== true) errors.push("Router configuration is incomplete or invalid.")
  const count = observation?.slotCount
  if (!Number.isInteger(count) || count < 1 || count > MAX_ADAPTERS || count !== manifest.adapters.length) {
    errors.push("Router slot count does not match the reviewed adapter manifest.")
  }

  const slots = observation?.slotAddresses
  const adapterBytecodes = observation?.adapterBytecodes
  if (!Array.isArray(slots) || slots.length !== manifest.adapters.length ||
      !Array.isArray(adapterBytecodes) || adapterBytecodes.length !== manifest.adapters.length) {
    errors.push("Router adapter identity reads are incomplete.")
  } else {
    for (let i = 0; i < manifest.adapters.length; i += 1) {
      const expected = manifest.adapters[i]
      const actual = slots[i]
      if (typeof actual !== "string" || !ADDRESS.test(actual) || normalize(actual) !== normalize(expected.address)) {
        errors.push(`Adapter ${i} address does not match the reviewed deployment.`)
      }
      const code = adapterBytecodes[i]
      if (typeof code !== "string" || !BYTECODE.test(code)) {
        errors.push(`Adapter ${i} contract bytecode is missing or malformed.`)
      } else if (normalize(keccak256(code)) !== normalize(expected.runtimeCodeHash)) {
        errors.push(`Adapter ${i} runtime code hash does not match the reviewed deployment.`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

/** Read and verify every identity field for non-React consumers such as terminal summaries. */
export async function readAndVerifyRouterDeployment(client, routerAbi, config, manifest) {
  if (!isCompleteRouterManifest(manifest)) {
    return fail("A complete source-controlled router deployment manifest is required.")
  }
  try {
    const chainId = await client.getChainId()
    const routerAddress = config.configuredRouterAddress
    const routerBytecode = await client.getBytecode({ address: routerAddress })
    if (typeof routerBytecode !== "string" || !BYTECODE.test(routerBytecode)) {
      return fail("Router contract bytecode is missing or malformed.")
    }
    const [deploymentVersion, assetAddress, slotCountRaw, configurationValid] = await Promise.all([
      client.readContract({ address: routerAddress, abi: routerAbi, functionName: "deploymentVersion" }),
      client.readContract({ address: routerAddress, abi: routerAbi, functionName: "asset" }),
      client.readContract({ address: routerAddress, abi: routerAbi, functionName: "slotCount" }),
      client.readContract({ address: routerAddress, abi: routerAbi, functionName: "configurationValid" }),
    ])
    const slotCount = typeof slotCountRaw === "bigint" ? Number(slotCountRaw) : Number.NaN
    const slotAddresses = Number.isInteger(slotCount) && slotCount > 0 && slotCount <= MAX_ADAPTERS
      ? await Promise.all(Array.from({ length: slotCount }, async (_, index) => {
          const slot = await client.readContract({
            address: routerAddress,
            abi: routerAbi,
            functionName: "slots",
            args: [BigInt(index)],
          })
          return Array.isArray(slot) && typeof slot[0] === "string" ? slot[0] : undefined
        }))
      : []
    const adapterBytecodes = await Promise.all(slotAddresses.map(async (address) =>
      address && ADDRESS.test(address) ? client.getBytecode({ address }) : undefined,
    ))
    return verifyRouterDeploymentIdentity({
      chainId,
      configuredRouterAddress: routerAddress,
      configuredAssetAddress: config.configuredAssetAddress,
      routerBytecode,
      deploymentVersion: typeof deploymentVersion === "bigint" ? Number(deploymentVersion) : Number(deploymentVersion),
      assetAddress,
      slotCount,
      configurationValid,
      slotAddresses,
      adapterBytecodes,
    }, manifest)
  } catch {
    return fail("Router deployment identity could not be read completely.")
  }
}
