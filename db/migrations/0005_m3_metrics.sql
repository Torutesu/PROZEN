-- PROZEN M3 signal → decision loop migration
-- Scope: metrics (3-layer model), readings, anomalies

BEGIN;

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  layer TEXT NOT NULL CHECK (layer IN ('bet', 'kpi', 'activity')),
  unit TEXT,
  direction TEXT NOT NULL DEFAULT 'increase'
    CHECK (direction IN ('increase', 'decrease')),
  target_value NUMERIC,
  baseline_value NUMERIC,
  bet_spec_id TEXT REFERENCES bet_specs(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_metric_product
    FOREIGN KEY (workspace_id, product_id)
    REFERENCES products (workspace_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metric_readings (
  id TEXT PRIMARY KEY,
  metric_id TEXT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metric_anomalies (
  id TEXT PRIMARY KEY,
  metric_id TEXT NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reading_id TEXT REFERENCES metric_readings(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  direction TEXT NOT NULL CHECK (direction IN ('above_target', 'below_target')),
  baseline_value NUMERIC,
  actual_value NUMERIC NOT NULL,
  deviation_pct NUMERIC,
  impact_narrative TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_metrics_workspace_product_layer
  ON metrics (workspace_id, product_id, layer);
CREATE INDEX IF NOT EXISTS idx_metric_readings_metric_recorded
  ON metric_readings (metric_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metric_anomalies_workspace_resolved
  ON metric_anomalies (workspace_id, is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metric_anomalies_metric
  ON metric_anomalies (metric_id, created_at DESC);

COMMIT;
