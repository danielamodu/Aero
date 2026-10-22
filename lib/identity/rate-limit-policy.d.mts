export type RateLimit = {
  scope: string
  subject: string
  limit: number
  windowSeconds: number
}

export declare const CHALLENGE_IP_LIMIT: number
export declare const CHALLENGE_GLOBAL_LIMIT: number
export declare const CHALLENGE_USER_LIMIT: number
export declare const CHALLENGE_WINDOW_SECONDS: number
export declare const VERIFY_IP_LIMIT: number
export declare const VERIFY_GLOBAL_LIMIT: number
export declare const VERIFY_WINDOW_SECONDS: number
export declare const SESSION_IP_LIMIT: number
export declare const SESSION_GLOBAL_LIMIT: number
export declare const SESSION_WINDOW_SECONDS: number

export declare function challengeIpLimits(subject: string): RateLimit[]
export declare function challengeUserLimits(userId: string): RateLimit[]
export declare function verifyLimits(subject: string): RateLimit[]
export declare function sessionLimits(subject: string): RateLimit[]
