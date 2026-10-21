import { NextResponse } from "next/server"
import { getAddress, verifyMessage, type Address, type Hex } from "viem"
import { matchesStoredChallenge, sha256 } from "@/lib/identity/primitives.mjs"
import {
  clearSessionCookies,
  identityError,
  readIdentityJson,
  setSessionCookies,
} from "@/lib/identity/http"
import { assertTrustedOrigin, resolveSession } from "@/lib/identity/security"
import {
  consumeChallenge,
  fujiAddressIsEoa,
  getChallenge,
  incrementChallengeFailure,
} from "@/lib/identity/service"
import { assertCsrf } from "@/lib/identity/security"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request)
    const body = await readIdentityJson(request)
    const id = typeof body.challengeId === "string" ? body.challengeId : ""
    const message = typeof body.message === "string" ? body.message : ""
    const signature = typeof body.signature === "string" ? body.signature : ""
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        id
      ) ||
      message.length > 4096 ||
      !/^0x[0-9a-fA-F]{130}$/.test(signature)
    ) {
      throw new Error("IDENTITY_CHALLENGE_INVALID")
    }
    const challenge = await getChallenge(id)
    if (!challenge || !matchesStoredChallenge(message, challenge)) {
      if (challenge) await incrementChallengeFailure(id)
      throw new Error("IDENTITY_CHALLENGE_INVALID")
    }
    if (challenge.purpose !== "login") {
      const session = await resolveSession(request)
      if (
        !session ||
        session.id !== challenge.initiating_session_id ||
        session.userId !== challenge.user_id
      ) {
        throw new Error("IDENTITY_SESSION_REQUIRED")
      }
      assertCsrf(request, session)
    }

    const address = getAddress(challenge.target_address_normalized) as Address
    if (!(await fujiAddressIsEoa(address))) {
      await incrementChallengeFailure(id)
      throw new Error("IDENTITY_CHALLENGE_INVALID")
    }
    let valid = false
    try {
      valid = await verifyMessage({
        address,
        message,
        signature: signature as Hex,
      })
    } catch {
      valid = false
    }
    if (!valid) {
      await incrementChallengeFailure(id)
      throw new Error("IDENTITY_CHALLENGE_INVALID")
    }

    const outcome = await consumeChallenge(id, sha256(message))
    const response = NextResponse.json({ ok: true })
    if (
      outcome.authenticated &&
      "token" in outcome &&
      outcome.token &&
      outcome.csrf &&
      outcome.absoluteExpiresAt
    ) {
      setSessionCookies(
        response,
        outcome.token,
        outcome.csrf,
        outcome.absoluteExpiresAt
      )
    } else if (
      "currentSessionRevoked" in outcome &&
      outcome.currentSessionRevoked
    ) {
      clearSessionCookies(response)
    }
    return response
  } catch (error) {
    return identityError(error)
  }
}
