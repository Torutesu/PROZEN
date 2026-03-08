-- M13: Add proposal_status to github_sync_events
-- Tracks whether a Living Spec proposal has been accepted, dismissed, or is still pending.

ALTER TABLE github_sync_events ADD COLUMN IF NOT EXISTS proposal_status text NOT NULL DEFAULT 'pending';
