-- PROZEN M4 GitHub Living Spec migration
-- Scope: GitHub repo connections, sync events (diff → spec update suggestions)

BEGIN;

CREATE TABLE IF NOT EXISTS github_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  repository TEXT NOT NULL,             -- "owner/repo"
  -- NOTE: access_token is stored unencrypted for M4 beta.
  -- Must be encrypted before M5/production.
  access_token TEXT NOT NULL,
  webhook_id TEXT,                      -- GitHub webhook ID after registration
  webhook_secret TEXT NOT NULL,         -- HMAC-SHA256 secret for verification
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_github_conn_product
    FOREIGN KEY (workspace_id, product_id)
    REFERENCES products (workspace_id, id)
    ON DELETE CASCADE,
  UNIQUE (workspace_id, product_id)     -- one repo per product
);

CREATE TABLE IF NOT EXISTS github_sync_events (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,             -- 'push' | 'pull_request'
  github_delivery_id TEXT,
  repository TEXT NOT NULL,
  ref TEXT,                             -- branch ref (push)
  commit_sha TEXT,
  pr_number INTEGER,
  pr_title TEXT,
  diff_summary TEXT,                    -- truncated diff or patch
  analysis JSONB,                       -- Claude's structured analysis
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'analyzed', 'failed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (connection_id, github_delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_github_connections_workspace_product
  ON github_connections (workspace_id, product_id);
CREATE INDEX IF NOT EXISTS idx_github_sync_events_connection
  ON github_sync_events (connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_sync_events_workspace
  ON github_sync_events (workspace_id, created_at DESC);

COMMIT;
