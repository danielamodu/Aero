import { FUJI_CHAIN_ID } from "@/lib/testnet"

/**
 * Source-controlled identity for the reviewed Fuji router deployment.
 *
 * No B2.1.1 router/adapter deployment has been independently verified yet, so
 * the identity fields intentionally remain empty. This keeps router actions
 * disabled. Populate only from a completed, independently checked broadcast
 * record, then review and commit this file through the protected source repo.
 * Do not derive these values from NEXT_PUBLIC_* variables or another runtime
 * setting: those values identify the requested deployment, not its trust.
 */
export const FUJI_ROUTER_MANIFEST = Object.freeze({
  chainId: FUJI_CHAIN_ID,
  routerAddress: "",
  routerRuntimeCodeHash: "",
  assetAddress: "",
  adapters: Object.freeze([] as { address: string; runtimeCodeHash: string }[]),
  trustSource: "reviewed-source-control" as const,
})
