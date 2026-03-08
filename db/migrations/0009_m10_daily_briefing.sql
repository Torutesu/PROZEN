-- PROZEN M10 — Daily Briefing
-- One AI-generated digest per product per day (UTC), cached.

BEGIN;

CREATE TABLE IF NOT EXISTS daily_briefings (
  id              text        PRIMARY KEY,
  workspace_id    text        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id      text        NOT NULL,
  briefing_date   date        NOT NULL,          -- UTC date (YYYY-MM-DD)
  content         text        NOT NULL,           -- AI-generated briefing text
  active_bets     integer     NOT NULL DEFAULT 0,
  open_anomalies  integer     NOT NULL DEFAULT 0,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, product_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS daily_briefings_product_date
  ON daily_briefings (workspace_id, product_id, briefing_date DESC);

COMMIT;
