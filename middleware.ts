import { NextResponse, type NextRequest } from "next/server"

/**
 * Hostname routing: testnet.useaero.org (and testnet.localhost:3000 in dev)
 * serves the testnet app under /testnet, while useaero.org keeps the
 * marketing site. One codebase, one deployment.
 */
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0]
  const isTestnet = host === "testnet.useaero.org" || host === "testnet.localhost"
  if (!isTestnet) return NextResponse.next()

  const url = req.nextUrl.clone()
  if (url.pathname === "/") {
    url.pathname = "/testnet"
    return NextResponse.rewrite(url)
  }
  if (!url.pathname.startsWith("/testnet")) {
    url.pathname = `/testnet${url.pathname}`
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next|brand|bimi|icon\\.png|apple-icon\\.png|opengraph-image|favicon\\.ico).*)"],
}
