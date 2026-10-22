-- Append-only audit hardening: row triggers do not fire for TRUNCATE.
-- TRUNCATE requires an explicit statement-level trigger, otherwise a single
-- statement can silently erase the entire audit history.
CREATE TRIGGER identity_audit_no_truncate
  BEFORE TRUNCATE ON identity.identity_audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION identity.reject_audit_mutation();
