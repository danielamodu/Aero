import { NextResponse } from "next/server"
import {
  identityError,
  requireSession,
  setSessionCookies,
} from "@/lib/identity/http"
import { rotateSession } from "@/lib/identity/service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    const rotated = await rotateSession(
      session.id,
      session.userId,
      session.tokenHash
    )
    const response = NextResponse.json({ ok: true })
    setSessionCookies(
      response,
      rotated.token,
      rotated.csrf,
      rotated.absoluteExpiresAt
    )
    return response
  } catch (error) {
    return identityError(error)
  }
}
