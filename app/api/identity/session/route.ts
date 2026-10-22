import { getAccount } from "@/lib/identity/service"
import { enforceSessionRequestLimit } from "@/lib/identity/rate-limit"
import { resolveSession } from "@/lib/identity/security"
import { identityError, identityJson } from "@/lib/identity/http"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await enforceSessionRequestLimit(request)
    const session = await resolveSession(request)
    if (!session) return identityJson({ authenticated: false })
    const account = await getAccount(session.userId)
    if (!account) return identityJson({ authenticated: false })
    return identityJson({
      authenticated: true,
      account,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      reauthenticatedAt: session.reauthenticatedAt,
      reauthenticatedWalletId: session.reauthenticatedWalletId,
    })
  } catch (error) {
    return identityError(error)
  }
}
