import type { Metadata } from "next"
import AeroLanding from "@/components/aero/landing"

export const metadata: Metadata = {
  title: "Aero — Digital dollar payments, built for everyday use",
  description:
    "Aero is building username payments, everyday payment experiences, and yield on eligible stablecoins. Try the Fuji testnet sandbox with worthless test tokens.",
  openGraph: {
    title: "Aero — Digital dollar payments, built for everyday use",
    description:
      "Aero is building username payments, everyday payment experiences, and yield on eligible stablecoins. Try the Fuji testnet sandbox with worthless test tokens.",
    url: "https://useaero.org",
    siteName: "Aero",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aero — Digital dollar payments, built for everyday use",
    description:
      "Aero is building username payments, everyday payment experiences, and yield on eligible stablecoins. Try the Fuji testnet sandbox with worthless test tokens.",
  },
}

export default function Page() {
  return <AeroLanding />
}
