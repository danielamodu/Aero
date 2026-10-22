import {
  clearSessionCookies,
  identityError,
  identityJson,
  requireSession,
} from "@/lib/identity/http"
import { errorCode } from "@/lib/identity/security"
import { revokeCurrentSession } from "@/lib/identity/service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    await revokeCurrentSession(session.id, session.userId)
    const response = identityJson({ ok: true })
    clearSessionCookies(response)
    return response
  } catch (error) {
    // Logout is idempotent: an already-expired session should still clear the
    // stale __Host cookies instead of leaving them in the browser.
    if (errorCode(error) === "IDENTITY_SESSION_REQUIRED") {
      const response = identityJson({ ok: true })
      clearSessionCookies(response)
      return response
    }
    return identityError(error)
  }
}
