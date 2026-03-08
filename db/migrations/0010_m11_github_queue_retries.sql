-- PROZEN M11 GitHub queue/retry hardening
-- - Add durable payload for deferred processing
-- - Add retry metadata and scheduling
-- - Extend status lifecycle with 'processing'

BEGIN;

ALTER TABLE github_sync_events
  ADD COLUMN IF NOT EXISTS payload JSONB,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'github_sync_events_status_check'
  ) THEN
    ALTER TABLE github_sync_events DROP CONSTRAINT github_sync_events_status_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'github_sync_events_status_check1'
  ) THEN
    ALTER TABLE github_sync_events DROP CONSTRAINT github_sync_events_status_check1;
  END IF;
END $$;

ALTER TABLE github_sync_events
  ADD CONSTRAINT github_sync_events_status_check
  CHECK (status IN ('pending', 'processing', 'analyzed', 'failed', 'skipped'));

UPDATE github_sync_events
SET payload = COALESCE(payload, '{}'::jsonb),
    next_attempt_at = COALESCE(next_attempt_at, created_at)
WHERE payload IS NULL OR next_attempt_at IS NULL;

ALTER TABLE github_sync_events
  ALTER COLUMN payload SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_github_sync_events_status_next_attempt
  ON github_sync_events (status, next_attempt_at, created_at);

COMMIT;
