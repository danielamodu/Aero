import { NextResponse, type NextRequest } from "next/server"

/**
 * Hostname routing: testnet.useaero.org (and testnet.localhost:3000 in dev)
 * serves the testnet app under /testnet, while useaero.org keeps the
 * marketing site. One codebase, one deployment.
 *
 * Returning users (cookie set by any testnet visit) skip the marketing
 * page and land straight in the app. Only the bare root redirects —
 * shared links (/pay/…, /docs…) always resolve. Same-site navigation
 * (login logo back-link, footer) never redirects, so there's no trap loop.
 */
const MAIN_APEX = "useaero.org"

function isLocalHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  )
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0]
  const isTestnet = host === "testnet.useaero.org" || host === "testnet.localhost"
  if (!isTestnet) {
    const url = req.nextUrl
    if (
      url.pathname === "/" &&
      req.cookies.get("aero_returning")?.value === "1"
    ) {
      let refHost = ""
      try {
        refHost = new URL(
          req.headers.get("referer") ?? ""
        ).hostname.toLowerCase()
      } catch {
        /* no usable referer — treat as fresh entry */
      }
      const browsingSite =
        refHost !== "" &&
        (refHost === host ||
          refHost === MAIN_APEX ||
          refHost === `www.${MAIN_APEX}` ||
          refHost.endsWith(`.${MAIN_APEX}`))
      if (!browsingSite) {
        if (isLocalHost(host)) {
          return NextResponse.redirect(new URL("/testnet", req.url))
        }
        if (
          host === MAIN_APEX ||
          host === `www.${MAIN_APEX}` ||
          host.endsWith(`.${MAIN_APEX}`)
        ) {
          return NextResponse.redirect(new URL("https://testnet.useaero.org/"))
        }
      }
    }
    return NextResponse.next()
  }

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
