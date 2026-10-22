import { createPublicClient, http } from "viem"
import { avalancheFuji } from "viem/chains"

const FUJI_CHAIN_ID = 43113

function invalidResponse() {
  return new Error("IDENTITY_FUJI_RPC_RESPONSE_INVALID")
}

/**
 * Classify an address as an EOA only after proving the RPC is on Fuji and its
 * bytecode response is well-formed. A transport error, malformed response, or
 * wrong chain throws; none of those outcomes is evidence of an EOA.
 */
export async function checkFujiAddressIsEoa(address, options = {}) {
  const rpcUrl = options.rpcUrl ?? process.env.AERO_FUJI_RPC_URL
  if (!rpcUrl) throw new Error("IDENTITY_FUJI_RPC_UNCONFIGURED")

  const client = createPublicClient({
    chain: avalancheFuji,
    transport: http(rpcUrl, {
      timeout: options.timeoutMs ?? 5000,
      retryCount: 0,
    }),
  })

  let chainId
  try {
    chainId = await client.getChainId()
  } catch {
    throw new Error("IDENTITY_FUJI_RPC_UNAVAILABLE")
  }
  if (chainId !== FUJI_CHAIN_ID)
    throw new Error("IDENTITY_FUJI_RPC_CHAIN_MISMATCH")

  let rawCode
  try {
    rawCode = await client.request({
      method: "eth_getCode",
      params: [address, "latest"],
    })
  } catch {
    throw new Error("IDENTITY_FUJI_RPC_UNAVAILABLE")
  }
  if (
    typeof rawCode !== "string" ||
    !/^0x[0-9a-fA-F]*$/.test(rawCode)
  )
    throw invalidResponse()

  return rawCode === "0x"
}
