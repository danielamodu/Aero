import { cookies } from "next/headers"
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/admin-auth"
import { readSignups } from "@/lib/waitlist-store"

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

export async function GET() {
  const authed = verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)
  if (!authed) {
    return new Response("Unauthorized", { status: 401 })
  }
  const rows = await readSignups()
  const csv = ["email,username,signed_up,confirmed,referrals"]
    .concat(rows.map((r) => [csvCell(r.email), csvCell(r.username), csvCell(r.created_at), r.confirmed ? "yes" : "no", String(r.referrals)].join(",")))
    .join("\n")
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aero-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
