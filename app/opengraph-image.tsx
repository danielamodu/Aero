import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "nodejs"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default async function OGImage() {
  const buf = await readFile(join(process.cwd(), "public/brand/aero-lockup-white-clear.png"))
  const logo = `data:image/png;base64,${buf.toString("base64")}`

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#1800ad",
          color: "#ffffff",
          fontFamily: "Helvetica, Arial, sans-serif",
          padding: "0 80px",
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={300} height={146} style={{ marginBottom: 36 }} />
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Money that moves like a message.
        </div>
        <div style={{ marginTop: 28, fontSize: 26, letterSpacing: "0.28em", opacity: 0.7 }}>USEAERO.ORG</div>
      </div>
    ),
    { ...size }
  )
}
