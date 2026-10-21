export function createOpaqueToken(): string
export function sha256(value: string | Uint8Array): Buffer
export function equalSecret(left: unknown, right: unknown): boolean
export function buildSiweMessage(input: {
  domain: string
  address: string
  uri: string
  chainId: number
  nonce: string
  issuedAt: string
  expiresAt: string
  requestId: string
  statement: string
}): string
export function parseCanonicalSiweMessage(message: string): null | {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: number
  nonce: string
  issuedAt: string
  expiresAt: string
  requestId: string
}
export function matchesStoredChallenge(
  message: string,
  challenge: Record<string, unknown>,
  now?: number
): boolean
export function cookieOptions(maxAge: number): {
  httpOnly: boolean
  secure: boolean
  sameSite: "strict"
  path: string
  maxAge: number
}
