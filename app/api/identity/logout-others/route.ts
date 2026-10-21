import { NextResponse } from "next/server"
import { identityError, requireSession } from "@/lib/identity/http"
import { revokeOtherSessions } from "@/lib/identity/service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    await revokeOtherSessions(session.id, session.userId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return identityError(error)
  }
}
