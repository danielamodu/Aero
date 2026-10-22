-- Distributed identity abuse controls.
--
-- One row is kept per hashed bucket. The row is reset in place when its fixed
-- window expires, so random wallet addresses cannot create unbounded buckets
-- and the table does not grow with every request. The runtime role receives
-- EXECUTE on the SECURITY DEFINER function but no direct table privileges.

CREATE TABLE identity.rate_limits (
  key_hash bytea PRIMARY KEY CHECK (octet_length(key_hash) = 32),
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds BETWEEN 1 AND 86400),
  request_count integer NOT NULL CHECK (request_count >= 1),
  updated_at timestamptz NOT NULL
);

CREATE INDEX rate_limits_updated_idx
  ON identity.rate_limits (updated_at);

CREATE FUNCTION identity.consume_rate_limit(
  p_key_hash bytea,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz
) RETURNS TABLE (allowed boolean, remaining integer, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, identity
AS $$
DECLARE
  current_count integer;
  current_window_start timestamptz;
  current_window_seconds integer;
BEGIN
  IF octet_length(p_key_hash) <> 32 THEN
    RAISE EXCEPTION 'rate limit key must be 32 bytes'
      USING ERRCODE = '22023';
  END IF;
  IF p_limit < 1 OR p_limit > 1000000 THEN
    RAISE EXCEPTION 'rate limit must be between 1 and 1000000'
      USING ERRCODE = '22023';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'rate limit window must be between 1 and 86400 seconds'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO identity.rate_limits AS rl
    (key_hash, window_start, window_seconds, request_count, updated_at)
  VALUES (p_key_hash, p_now, p_window_seconds, 1, p_now)
  ON CONFLICT (key_hash) DO UPDATE
    SET window_start = CASE
          WHEN rl.window_start <= p_now - make_interval(secs => rl.window_seconds)
          THEN p_now
          ELSE rl.window_start
        END,
        window_seconds = p_window_seconds,
        request_count = CASE
          WHEN rl.window_start <= p_now - make_interval(secs => rl.window_seconds)
          THEN 1
          ELSE LEAST(rl.request_count + 1, 1000000)
        END,
        updated_at = p_now
  RETURNING rl.request_count, rl.window_start, rl.window_seconds
  INTO current_count, current_window_start, current_window_seconds;

  allowed := current_count <= p_limit;
  remaining := GREATEST(p_limit - current_count, 0);
  reset_at := current_window_start + make_interval(secs => current_window_seconds);
  RETURN NEXT;
END;
$$;

-- Runtime privileges are granted by scripts/provision-identity-roles.mjs.
REVOKE ALL ON FUNCTION identity.consume_rate_limit(
  bytea, integer, integer, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.reject_audit_mutation() FROM PUBLIC;
