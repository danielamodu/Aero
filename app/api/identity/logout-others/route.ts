import { identityError, identityJson, requireSession } from "@/lib/identity/http"
import { revokeOtherSessions } from "@/lib/identity/service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    await revokeOtherSessions(session.id, session.userId)
    return identityJson({ ok: true })
  } catch (error) {
    return identityError(error)
  }
}
