CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE identity.users (
  id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deletion_pending', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  deleted_at timestamptz,
  status_reason_code text,
  CHECK ((status = 'suspended') = (suspended_at IS NOT NULL)),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL)),
  CHECK (status_reason_code IS NULL OR status_reason_code ~ '^[a-z0-9_]{1,64}$')
);

CREATE TABLE identity.wallets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  namespace text NOT NULL CHECK (namespace = 'eip155'),
  wallet_kind text NOT NULL CHECK (wallet_kind IN ('eoa', 'contract')),
  address_normalized char(42) NOT NULL,
  chain_id bigint,
  verification_status text NOT NULL CHECK (verification_status IN ('verified', 'revoked')),
  is_primary boolean NOT NULL DEFAULT false,
  linked_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_authenticated_at timestamptz,
  UNIQUE (id, user_id),
  CHECK (address_normalized ~ '^0x[0-9a-f]{40}$'),
  CHECK (
    (wallet_kind = 'eoa' AND chain_id IS NULL)
    OR (wallet_kind = 'contract' AND chain_id IS NOT NULL AND chain_id > 0)
  ),
  CHECK ((verification_status = 'verified') = (revoked_at IS NULL)),
  CHECK (NOT is_primary OR (verification_status = 'verified' AND revoked_at IS NULL))
);

CREATE UNIQUE INDEX wallets_active_eoa_address_uq
  ON identity.wallets (namespace, address_normalized)
  WHERE wallet_kind = 'eoa' AND verification_status = 'verified' AND revoked_at IS NULL;
CREATE UNIQUE INDEX wallets_active_contract_address_uq
  ON identity.wallets (namespace, chain_id, address_normalized)
  WHERE wallet_kind = 'contract' AND verification_status = 'verified' AND revoked_at IS NULL;
CREATE UNIQUE INDEX wallets_one_active_primary_uq
  ON identity.wallets (user_id)
  WHERE is_primary AND verification_status = 'verified' AND revoked_at IS NULL;
CREATE INDEX wallets_user_active_idx
  ON identity.wallets (user_id, verification_status, revoked_at);
CREATE INDEX wallets_chain_address_idx
  ON identity.wallets (namespace, chain_id, address_normalized);

CREATE TABLE identity.sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
  authenticated_wallet_id uuid NOT NULL,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  csrf_token_hash bytea NOT NULL CHECK (octet_length(csrf_token_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  reauthenticated_at timestamptz,
  reauthenticated_wallet_id uuid,
  revoked_at timestamptz,
  revoke_reason_code text,
  device_label varchar(80),
  user_agent_summary varchar(240),
  UNIQUE (id, user_id),
  FOREIGN KEY (authenticated_wallet_id, user_id)
    REFERENCES identity.wallets(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (reauthenticated_wallet_id, user_id)
    REFERENCES identity.wallets(id, user_id) ON DELETE RESTRICT,
  CHECK (idle_expires_at <= absolute_expires_at),
  CHECK (idle_expires_at >= last_seen_at AND absolute_expires_at > created_at),
  CHECK ((reauthenticated_at IS NULL) = (reauthenticated_wallet_id IS NULL)),
  CHECK (revoke_reason_code IS NULL OR revoke_reason_code ~ '^[a-z0-9_]{1,64}$')
);
CREATE INDEX sessions_user_active_idx
  ON identity.sessions (user_id, revoked_at, absolute_expires_at);
CREATE INDEX sessions_expiry_idx
  ON identity.sessions (idle_expires_at, absolute_expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX sessions_authenticated_wallet_idx
  ON identity.sessions (authenticated_wallet_id, revoked_at);

CREATE TABLE identity.wallet_challenges (
  id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN (
    'create_account', 'login', 'link_wallet', 'reauthenticate', 'revoke_wallet'
  )),
  operation text NOT NULL DEFAULT 'none'
    CHECK (operation IN ('none', 'switch_primary')),
  user_id uuid REFERENCES identity.users(id) ON DELETE RESTRICT,
  initiating_session_id uuid,
  initiating_wallet_id uuid,
  subject_wallet_id uuid,
  target_namespace text NOT NULL CHECK (target_namespace = 'eip155'),
  target_wallet_kind text NOT NULL CHECK (target_wallet_kind IN ('eoa', 'contract')),
  target_address_normalized char(42) NOT NULL CHECK (target_address_normalized ~ '^0x[0-9a-f]{40}$'),
  chain_id bigint NOT NULL CHECK (chain_id = 43113),
  domain text NOT NULL,
  uri text NOT NULL,
  statement text NOT NULL,
  message_hash bytea NOT NULL CHECK (octet_length(message_hash) = 32),
  nonce_hash bytea NOT NULL UNIQUE CHECK (octet_length(nonce_hash) = 32),
  rate_limit_key_hash bytea NOT NULL CHECK (octet_length(rate_limit_key_hash) = 32),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (initiating_session_id, user_id)
    REFERENCES identity.sessions(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (initiating_wallet_id, user_id)
    REFERENCES identity.wallets(id, user_id) ON DELETE RESTRICT,
  FOREIGN KEY (subject_wallet_id, user_id)
    REFERENCES identity.wallets(id, user_id) ON DELETE RESTRICT,
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '10 minutes'),
  CHECK (target_wallet_kind = 'eoa'),
  CHECK (NOT (consumed_at IS NOT NULL AND invalidated_at IS NOT NULL)),
  CHECK (
    (purpose IN ('create_account', 'login') AND user_id IS NULL
      AND initiating_session_id IS NULL AND initiating_wallet_id IS NULL
      AND subject_wallet_id IS NULL AND operation = 'none')
    OR
    (purpose = 'link_wallet' AND user_id IS NOT NULL
      AND initiating_session_id IS NOT NULL AND initiating_wallet_id IS NOT NULL
      AND subject_wallet_id IS NULL AND operation = 'none')
    OR
    (purpose = 'reauthenticate' AND user_id IS NOT NULL
      AND initiating_session_id IS NOT NULL AND initiating_wallet_id IS NOT NULL
      AND ((operation = 'none' AND subject_wallet_id IS NULL)
        OR (operation = 'switch_primary' AND subject_wallet_id IS NOT NULL)))
    OR
    (purpose = 'revoke_wallet' AND user_id IS NOT NULL
      AND initiating_session_id IS NOT NULL AND initiating_wallet_id IS NOT NULL
      AND subject_wallet_id IS NOT NULL AND operation = 'none')
  )
);
CREATE INDEX wallet_challenges_user_purpose_expiry_idx
  ON identity.wallet_challenges (user_id, purpose, expires_at);
CREATE INDEX wallet_challenges_target_idx
  ON identity.wallet_challenges (target_namespace, chain_id, target_address_normalized);
CREATE INDEX wallet_challenges_issued_idx
  ON identity.wallet_challenges (issued_at);
CREATE INDEX wallet_challenges_rate_limit_idx
  ON identity.wallet_challenges (rate_limit_key_hash, issued_at DESC);

CREATE TABLE identity.identity_audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_kind text NOT NULL CHECK (actor_kind IN ('user', 'staff', 'system')),
  actor_user_id uuid REFERENCES identity.users(id) ON DELETE RESTRICT,
  subject_user_id uuid REFERENCES identity.users(id) ON DELETE RESTRICT,
  subject_wallet_id uuid,
  action_code text NOT NULL CHECK (action_code ~ '^[a-z0-9_.]{1,96}$'),
  request_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (octet_length(metadata::text) <= 4096),
  CHECK (actor_kind <> 'user' OR actor_user_id IS NOT NULL),
  CHECK (subject_wallet_id IS NULL OR subject_user_id IS NOT NULL),
  FOREIGN KEY (subject_wallet_id, subject_user_id)
    REFERENCES identity.wallets(id, user_id) ON DELETE RESTRICT
);
CREATE INDEX identity_audit_subject_time_idx
  ON identity.identity_audit_events (subject_user_id, occurred_at DESC);
CREATE INDEX identity_audit_action_time_idx
  ON identity.identity_audit_events (action_code, occurred_at DESC);

CREATE FUNCTION identity.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'identity audit events are append-only';
END;
$$;
CREATE TRIGGER identity_audit_append_only
  BEFORE UPDATE OR DELETE ON identity.identity_audit_events
  FOR EACH ROW EXECUTE FUNCTION identity.reject_audit_mutation();
