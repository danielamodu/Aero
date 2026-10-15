"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { AeroLogo, AeroMark } from "./logo"

/**
 * Real Aero brand assets from `public/brand/` (cropped tight, transparent
 * backgrounds). Plain <img> — not next/image — so nav centering is exact
 * with no wrapper spans or baseline gaps. Falls back to the SVG recreation
 * if a file is ever missing.
 *
 *   public/brand/aero-icon.png            (white arrow on blue)
 *   public/brand/aero-lockup-blue-clear.png  (blue lockup, transparent)
 *   public/brand/aero-lockup-white-clear.png (white lockup, transparent)
 *   public/brand/aero-wordmark-blue.png   (blue AERO on white)
 *   public/brand/aero-wordmark-white.png  (white AERO on blue)
 */

function useImgFallback() {
  const [failed, setFailed] = useState(false)
  return { failed, onError: () => setFailed(true) }
}

export function BrandLockup({
  tone = "dark",
  className,
  height = 32,
}: {
  /** "dark" = blue art for light backgrounds, "light" = white art for dark backgrounds */
  tone?: "dark" | "light"
  className?: string
  height?: number
}) {
  const { failed, onError } = useImgFallback()
  if (failed) {
    return (
      <span className={cn(tone === "dark" ? "text-aero-800" : "text-white")}>
        <AeroLogo className={className} />
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === "dark" ? "/brand/aero-lockup-blue-clear.png" : "/brand/aero-lockup-white-clear.png"}
      alt="Aero"
      onError={onError}
      draggable={false}
      className={cn("block w-auto object-contain", className)}
      style={{ height }}
    />
  )
}

export function BrandWordmark({
  tone = "dark",
  className,
  height = 40,
}: {
  tone?: "dark" | "light"
  className?: string
  height?: number
}) {
  const { failed, onError } = useImgFallback()
  if (failed) {
    return (
      <span className={cn(tone === "dark" ? "text-aero-800" : "text-white")}>
        <AeroLogo className={className} />
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tone === "dark" ? "/brand/aero-wordmark-blue.png" : "/brand/aero-wordmark-white.png"}
      alt="Aero"
      onError={onError}
      draggable={false}
      className={cn("block w-auto object-contain", className)}
      style={{ height }}
    />
  )
}

export function BrandIcon({ className }: { className?: string }) {
  const { failed, onError } = useImgFallback()
  if (failed) return <AeroMark className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/aero-icon.png"
      alt="Aero"
      onError={onError}
      draggable={false}
      className={cn("block object-contain", className)}
    />
  )
}
