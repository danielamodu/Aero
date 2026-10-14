import { NextResponse } from "next/server"
import { ADMIN_COOKIE } from "@/lib/admin-auth"

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(ADMIN_COOKIE)
  return res
}
