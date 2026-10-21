import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url")
}

export function sha256(value) {
  return createHash("sha256").update(value).digest()
}

export function equalSecret(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function buildSiweMessage({
  domain,
  address,
  uri,
  chainId,
  nonce,
  issuedAt,
  expiresAt,
  requestId,
  statement,
}) {
  if (statement.includes("\n") || statement.includes("\r")) {
    throw new Error("SIWE statement must be a single line.")
  }
  return `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt}\nExpiration Time: ${expiresAt}\nRequest ID: ${requestId}`
}

export function parseCanonicalSiweMessage(message) {
  if (typeof message !== "string" || message.length > 4096) return null
  const match = message.match(
    /^([^\r\n]+) wants you to sign in with your Ethereum account:\n(0x[0-9a-fA-F]{40})\n\n([^\r\n]+)\n\nURI: ([^\r\n]+)\nVersion: (1)\nChain ID: ([0-9]+)\nNonce: ([a-z0-9]{8,})\nIssued At: ([0-9]{4}-[0-9]{2}-[0-9]{2}T[^\r\n]+)\nExpiration Time: ([0-9]{4}-[0-9]{2}-[0-9]{2}T[^\r\n]+)\nRequest ID: ([0-9a-f-]{36})$/i
  )
  if (!match) return null
  const [
    ,
    domain,
    address,
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expiresAt,
    requestId,
  ] = match
  if (!Number.isSafeInteger(Number(chainId))) return null
  return {
    domain,
    address,
    statement,
    uri,
    version,
    chainId: Number(chainId),
    nonce,
    issuedAt,
    expiresAt,
    requestId,
  }
}

export function matchesStoredChallenge(message, challenge, now = Date.now()) {
  const parsed = parseCanonicalSiweMessage(message)
  if (!parsed || !challenge) return false
  const issuedAt = new Date(challenge.issued_at)
    .toISOString()
    .replace(".000Z", "Z")
  const expiresAt = new Date(challenge.expires_at)
    .toISOString()
    .replace(".000Z", "Z")
  const nonceHash = Buffer.from(challenge.nonce_hash)
  const messageHash = Buffer.from(challenge.message_hash)
  return (
    parsed.domain === challenge.domain &&
    parsed.uri === challenge.uri &&
    parsed.statement === challenge.statement &&
    parsed.version === "1" &&
    parsed.chainId === Number(challenge.chain_id) &&
    parsed.address.toLowerCase() === challenge.target_address_normalized &&
    parsed.requestId === challenge.id &&
    parsed.issuedAt === issuedAt &&
    parsed.expiresAt === expiresAt &&
    Date.parse(parsed.issuedAt) <= now + 30_000 &&
    Date.parse(parsed.expiresAt) > now &&
    sha256(parsed.nonce).equals(nonceHash) &&
    sha256(message).equals(messageHash)
  )
}

export function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge,
  }
}
