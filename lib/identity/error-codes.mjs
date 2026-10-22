/**
 * SQLSTATEs that mean the identity store, its migration, or a required
 * privilege is unavailable. They must fail closed as 503, never as a generic
 * client error. 42883/42501 also cover an unapplied rate-limit migration or a
 * runtime role that was provisioned without EXECUTE on the limiter.
 */
export function isIdentityDatabaseUnavailableCode(code) {
  return (
    /^(08|53300|57P03)/.test(code) ||
    code === "42P01" ||
    code === "3F000" ||
    code === "42883" ||
    code === "42501"
  )
}
