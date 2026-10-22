export type FujiEoaOptions = {
  rpcUrl?: string
  timeoutMs?: number
}

export declare function checkFujiAddressIsEoa(
  address: `0x${string}`,
  options?: FujiEoaOptions
): Promise<boolean>
