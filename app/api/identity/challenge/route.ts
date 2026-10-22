import { assertTrustedOrigin } from "@/lib/identity/security"
import { enforceChallengeLimits } from "@/lib/identity/rate-limit"
import {
  createWalletChallenge,
  type ChallengePurpose,
} from "@/lib/identity/service"
import {
  identityError,
  identityJson,
  readIdentityJson,
  requireSession,
} from "@/lib/identity/http"

export const runtime = "nodejs"

const purposes = new Set([
  "login",
  "link_wallet",
  "reauthenticate",
  "revoke_wallet",
])

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request)
    const body = await readIdentityJson(request)
    if (body.purpose === "create_account") {
      // Closed signup still consumes the public challenge budget so probing
      // this endpoint cannot bypass the unauthenticated abuse controls.
      await enforceChallengeLimits(request)
      throw new Error("IDENTITY_SIGNUP_CLOSED")
    }
    if (typeof body.purpose !== "string" || !purposes.has(body.purpose))
      throw new Error("IDENTITY_REQUEST_INVALID")
    const purpose = body.purpose as ChallengePurpose
    if (
      body.operation !== undefined &&
      body.operation !== "none" &&
      body.operation !== "switch_primary"
    ) {
      throw new Error("IDENTITY_REQUEST_INVALID")
    }
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    for (const key of ["proofWalletId", "subjectWalletId"]) {
      if (
        body[key] !== undefined &&
        (typeof body[key] !== "string" || !uuidPattern.test(body[key]))
      ) {
        throw new Error("IDENTITY_REQUEST_INVALID")
      }
    }

    let session = null
    if (purpose !== "login") {
      session = await requireSession(request)
    }
    await enforceChallengeLimits(request, session?.userId)

    const result = await createWalletChallenge({
      purpose,
      address: typeof body.address === "string" ? body.address : undefined,
      sessionId: session?.id,
      userId: session?.userId,
      proofWalletId:
        typeof body.proofWalletId === "string" ? body.proofWalletId : undefined,
      subjectWalletId:
        typeof body.subjectWalletId === "string"
          ? body.subjectWalletId
          : undefined,
      operation:
        body.operation === "switch_primary" ? "switch_primary" : "none",
    })
    return identityJson({
      ok: true,
      challengeId: result.id,
      message: result.message,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    return identityError(error)
  }
}
