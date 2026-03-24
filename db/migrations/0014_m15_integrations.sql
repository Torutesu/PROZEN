-- M15 — External Integrations
-- Stores connection credentials and sync state for Stripe, PostHog, Sentry, Typeform.

CREATE TABLE integration_connections (
  id                TEXT        PRIMARY KEY,
  workspace_id      TEXT        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id        TEXT        NOT NULL,
  provider          TEXT        NOT NULL, -- 'stripe' | 'posthog' | 'sentry' | 'typeform'
  -- Encrypted JSON blob containing provider-specific credentials
  encrypted_config  TEXT        NOT NULL,
  -- Non-sensitive settings (project IDs, slugs, etc.)
  sync_config       JSONB       NOT NULL DEFAULT '{}',
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  last_synced_at    TIMESTAMPTZ,
  last_sync_error   TEXT,
  created_by        TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, product_id, provider)
);
