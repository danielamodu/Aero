export type RateLimitHeaders = {
  get(name: string): string | null
}

export declare function requestRateLimitSubject(
  headers: RateLimitHeaders,
  env?: Record<string, string | undefined>
): string

export declare const UNATTRIBUTED: "unattributed"
