import { identityError, identityJson, requireSession } from "@/lib/identity/http"
import { touchSession } from "@/lib/identity/service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    const idleExpiresAt = await touchSession(session.id, session.userId)
    return identityJson({ ok: true, idleExpiresAt })
  } catch (error) {
    return identityError(error)
  }
}
