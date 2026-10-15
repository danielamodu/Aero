import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import Script from "next/script"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-display" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable, instrument.variable)}
    >
      <body>
        <Script
          src="https://plausible.io/js/script.tagged-events.js"
          data-domain="useaero.org"
          strategy="afterInteractive"
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
