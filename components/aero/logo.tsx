import { cn } from "@/lib/utils"

/**
 * Aero brand mark — geometric north-east arrow.
 * Fallback recreation of the supplied logo art (white arrow on Aero
 * blue / blue arrow on white). Uses currentColor so the parent text
 * color controls the mark tone. The real PNGs in `public/brand/`
 * (see brand-logo.tsx) take precedence wherever used.
 */
export function AeroMark({
  className,
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="currentColor"
      aria-label="Aero"
      role="img"
      className={cn("size-8", className)}
    >
      <rect x="8" y="8" width="80" height="22" />
      <rect x="66" y="8" width="22" height="80" />
      <polygon points="51,27 15,63 29,77 67,43" />
    </svg>
  )
}

export function AeroWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[0.08em] leading-none font-extrabold tracking-tight",
        className
      )}
      aria-label="AERO"
    >
      <span>AER</span>
      <span className="inline-flex flex-col items-stretch leading-none">
        <span>O</span>
        <span className="mt-[0.08em] h-[0.16em] w-full rounded-[0.08em] bg-current" />
      </span>
    </span>
  )
}

export function AeroLogo({
  className,
  markClassName,
  wordClassName,
}: {
  className?: string
  markClassName?: string
  wordClassName?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AeroMark className={cn("size-9", markClassName)} />
      <AeroWordmark className={cn("text-[1.65rem]", wordClassName)} />
    </span>
  )
}
