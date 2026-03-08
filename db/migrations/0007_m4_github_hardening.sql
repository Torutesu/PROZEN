-- PROZEN M4 hardening
-- - Deduplicate webhook retries per (connection_id, github_delivery_id)
-- - Improve connection lookup performance for webhook routing

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_github_sync_events_connection_delivery'
  ) THEN
    ALTER TABLE github_sync_events
      ADD CONSTRAINT uq_github_sync_events_connection_delivery
      UNIQUE (connection_id, github_delivery_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_github_connections_repo_active
  ON github_connections (repository, is_active);

CREATE INDEX IF NOT EXISTS idx_github_connections_repo_hook_active
  ON github_connections (repository, webhook_id, is_active);

COMMIT;
