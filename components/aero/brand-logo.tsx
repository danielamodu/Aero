"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { AeroLogo, AeroMark } from "./logo"

/**
 * Real Aero brand assets. Save the attached logo files as:
 *   public/brand/aero-icon.png            (white arrow on blue)
 *   public/brand/aero-lockup-blue.png     (blue arrow + AERO on white)
 *   public/brand/aero-lockup-white.png    (white arrow + AERO on blue)
 *   public/brand/aero-wordmark-blue.png   (blue AERO on white)
 *   public/brand/aero-wordmark-white.png  (white AERO on blue)
 * Crop them tight to the artwork (no extra canvas padding).
 * Until the files exist, the SVG recreation renders as fallback.
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
  const src =
    tone === "dark"
      ? "/brand/aero-lockup-blue.png"
      : "/brand/aero-lockup-white.png"
  const dims =
    tone === "dark" ? { w: 688, h: 307 } : { w: 860, h: 420 }
  return (
    <Image
      src={src}
      alt="Aero"
      width={dims.w}
      height={dims.h}
      onError={onError}
      priority
      className={cn("w-auto object-contain", className)}
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
  const src =
    tone === "dark"
      ? "/brand/aero-wordmark-blue.png"
      : "/brand/aero-wordmark-white.png"
  const dims =
    tone === "dark" ? { w: 437, h: 162 } : { w: 714, h: 279 }
  return (
    <Image
      src={src}
      alt="Aero"
      width={dims.w}
      height={dims.h}
      onError={onError}
      className={cn("w-auto object-contain", className)}
      style={{ height }}
    />
  )
}

export function BrandIcon({ className }: { className?: string }) {
  const { failed, onError } = useImgFallback()
  if (failed) return <AeroMark className={className} />
  return (
    <Image
      src="/brand/aero-icon.png"
      alt="Aero"
      width={96}
      height={96}
      onError={onError}
      className={cn("object-contain", className)}
    />
  )
}
