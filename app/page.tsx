import type { Metadata } from "next"
import AeroLanding from "@/components/aero/landing"

export const metadata: Metadata = {
  title: "Aero — Digital dollars that move and work",
  description:
    "Send USDC to @usernames instantly, pay bills from your balance, and earn yield automatically. Built on Avalanche.",
}

export default function Page() {
  return <AeroLanding />
}
