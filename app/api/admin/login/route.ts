import { NextResponse } from "next/server"
import { ADMIN_COOKIE, adminCookieValue, checkPassword } from "@/lib/admin-auth"
import { clientIp, throttle } from "@/lib/rate-limit"

export async function POST(req: Request) {
  if (!throttle(`al:${clientIp(req)}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 })
  }
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Admin password is not configured." }, { status: 503 })
  }
  let password = ""
  try {
    password = ((await req.json()) as { password?: unknown }).password as string
  } catch {
    /* fall through to 401 */
  }
  if (typeof password !== "string" || !checkPassword(password)) {
    return NextResponse.json({ ok: false, error: "Wrong password." }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, adminCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  })
  return res
}
