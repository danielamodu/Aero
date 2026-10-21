import { NextResponse } from "next/server"
import {
  clearSessionCookies,
  identityError,
  requireSession,
} from "@/lib/identity/http"
import { revokeCurrentSession } from "@/lib/identity/service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    await revokeCurrentSession(session.id, session.userId)
    const response = NextResponse.json({ ok: true })
    clearSessionCookies(response)
    return response
  } catch (error) {
    return identityError(error)
  }
}
