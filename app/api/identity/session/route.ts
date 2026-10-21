import { NextResponse } from "next/server"
import { getAccount } from "@/lib/identity/service"
import { resolveSession } from "@/lib/identity/security"
import { identityError } from "@/lib/identity/http"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await resolveSession(request)
    if (!session) return NextResponse.json({ authenticated: false })
    const account = await getAccount(session.userId)
    if (!account) return NextResponse.json({ authenticated: false })
    return NextResponse.json({
      authenticated: true,
      account,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
      reauthenticatedAt: session.reauthenticatedAt,
    })
  } catch (error) {
    return identityError(error)
  }
}
