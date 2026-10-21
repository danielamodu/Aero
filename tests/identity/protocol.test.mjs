import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { privateKeyToAccount } from "viem/accounts"
import { verifyMessage } from "viem"
import {
  buildSiweMessage,
  cookieOptions,
  createOpaqueToken,
  equalSecret,
  matchesStoredChallenge,
  parseCanonicalSiweMessage,
  sha256,
} from "../../lib/identity/primitives.mjs"

const signer = privateKeyToAccount(`0x${"11".repeat(32)}`)
const other = privateKeyToAccount(`0x${"22".repeat(32)}`)

function fixture() {
  const now = Date.now()
  const issued = new Date(now).toISOString().replace(".000Z", "Z")
  const expires = new Date(now + 300_000).toISOString().replace(".000Z", "Z")
  const nonce = "ab".repeat(32)
  const challenge = {
    id: "5c2b50d6-8321-4a52-9ee6-d685a9a0ea2a",
    domain: "testnet.useaero.org",
    uri: "https://testnet.useaero.org/api/identity/verify",
    statement:
      "Sign in to Aero. This signature does not authorize token transfers.",
    chain_id: 43113,
    target_address_normalized: signer.address.toLowerCase(),
    issued_at: issued,
    expires_at: expires,
    nonce_hash: sha256(nonce),
  }
  const message = buildSiweMessage({
    domain: challenge.domain,
    address: signer.address,
    uri: challenge.uri,
    chainId: challenge.chain_id,
    nonce,
    issuedAt: issued,
    expiresAt: expires,
    requestId: challenge.id,
    statement: challenge.statement,
  })
  challenge.message_hash = sha256(message)
  return { challenge, message, nonce }
}

test("creates high-entropy opaque tokens and hashes token bytes", () => {
  const a = createOpaqueToken()
  const b = createOpaqueToken()
  assert.match(a, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(a, b)
  assert.equal(sha256(a).length, 32)
  assert.equal(equalSecret(a, a), true)
  assert.equal(equalSecret(a, b), false)
})

test("session cookie uses host-only Secure HttpOnly attributes", () => {
  assert.deepEqual(cookieOptions(3600), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 3600,
  })
})

test("builds and parses a canonical Fuji SIWE message with a 256-bit nonce", () => {
  const { challenge, message, nonce } = fixture()
  const parsed = parseCanonicalSiweMessage(message)
  assert.equal(nonce.length, 64)
  assert.equal(parsed?.domain, challenge.domain)
  assert.equal(parsed?.chainId, 43113)
  assert.equal(matchesStoredChallenge(message, challenge), true)
})

test("rejects altered SIWE fields, extra fields, and a replayed nonce", () => {
  const { challenge, message, nonce } = fixture()
  assert.equal(
    matchesStoredChallenge(
      message.replace("Chain ID: 43113", "Chain ID: 1"),
      challenge
    ),
    false
  )
  assert.equal(
    matchesStoredChallenge(
      message.replace(challenge.uri, "https://evil.example/verify"),
      challenge
    ),
    false
  )
  assert.equal(
    parseCanonicalSiweMessage(`${message}\nResources: https://evil.example`),
    null
  )
  const otherNonceMessage = message.replace(nonce, "cd".repeat(32))
  assert.equal(matchesStoredChallenge(otherNonceMessage, challenge), false)
})

test("expires messages and rejects future-issued messages", () => {
  const { challenge, message } = fixture()
  assert.equal(
    matchesStoredChallenge(message, challenge, Date.now() + 6 * 60_000),
    false
  )
  const future = new Date(Date.now() + 60_000)
    .toISOString()
    .replace(".000Z", "Z")
  const futureMessage = message.replace(
    /Issued At: .*\n/,
    `Issued At: ${future}\n`
  )
  const futureChallenge = {
    ...challenge,
    issued_at: future,
    message_hash: sha256(futureMessage),
  }
  assert.equal(matchesStoredChallenge(futureMessage, futureChallenge), false)
})

test("EIP-191 signature accepts its signer and rejects a different signer", async () => {
  const { message } = fixture()
  const signature = await signer.signMessage({ message })
  assert.equal(
    await verifyMessage({ address: signer.address, message, signature }),
    true
  )
  assert.equal(
    await verifyMessage({ address: other.address, message, signature }),
    false
  )
})

test("does not accept multiline statements or duplicate/unknown message fields", () => {
  assert.throws(() =>
    buildSiweMessage({
      domain: "testnet.useaero.org",
      address: signer.address,
      uri: "https://testnet.useaero.org/api/identity/verify",
      chainId: 43113,
      nonce: "a".repeat(64),
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requestId: "5c2b50d6-8321-4a52-9ee6-d685a9a0ea2a",
      statement: "A\nB",
    })
  )
  const { message } = fixture()
  assert.equal(
    parseCanonicalSiweMessage(
      message.replace("Version: 1", "Version: 1\nVersion: 1")
    ),
    null
  )
})

test("challenge hash is one-way rather than storing its nonce or signed text", () => {
  const { message, nonce } = fixture()
  const nonceHash = createHash("sha256").update(nonce).digest()
  const messageHash = createHash("sha256").update(message).digest()
  assert.equal(nonceHash.toString("hex").includes(nonce), false)
  assert.equal(messageHash.length, 32)
})
