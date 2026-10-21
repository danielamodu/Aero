/**
 * Destructive retention work stays unavailable until an explicit policy is recorded
 * and configured. No purge job is registered by M1B.
 */
export function approvedIdentityRetentionDays(): number | null {
  if (process.env.AERO_IDENTITY_RETENTION_POLICY_APPROVED !== "true")
    return null
  const days = Number(process.env.AERO_IDENTITY_RETENTION_DAYS)
  return Number.isSafeInteger(days) && days >= 1 && days <= 3650 ? days : null
}

export function assertIdentityPurgeEnabled(): number {
  const days = approvedIdentityRetentionDays()
  if (days === null) throw new Error("IDENTITY_RETENTION_POLICY_REQUIRED")
  return days
}
