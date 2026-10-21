export type RouterManifestAdapter = {
  address: string
  runtimeCodeHash: string
}

export type RouterDeploymentManifest = {
  chainId: number
  routerAddress: string
  routerRuntimeCodeHash: string
  assetAddress: string
  adapters: readonly RouterManifestAdapter[]
  trustSource: "reviewed-source-control"
}

export type RouterIdentityObservation = {
  chainId?: number
  configuredRouterAddress?: string
  configuredAssetAddress?: string
  routerBytecode?: string
  deploymentVersion?: number
  assetAddress?: string
  slotCount?: number
  configurationValid?: boolean
  slotAddresses?: (string | undefined)[]
  adapterBytecodes?: (string | undefined)[]
}

export function isCompleteRouterManifest(manifest: unknown): manifest is RouterDeploymentManifest
export function verifyRouterDeploymentIdentity(
  observation: RouterIdentityObservation,
  manifest: RouterDeploymentManifest | null | undefined,
): { ok: boolean; errors: string[] }
export function readAndVerifyRouterDeployment(
  client: any,
  routerAbi: readonly unknown[],
  config: { configuredRouterAddress: string; configuredAssetAddress: string },
  manifest: RouterDeploymentManifest | null | undefined,
): Promise<{ ok: boolean; errors: string[] }>
