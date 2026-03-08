-- PROZEN M1 context layer migration
-- Scope: context packs, versioning, decision logs, compression jobs

BEGIN;

CREATE TABLE IF NOT EXISTS context_packs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  current_version_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_context_pack_product
    FOREIGN KEY (workspace_id, product_id)
    REFERENCES products (workspace_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS context_pack_versions (
  id TEXT PRIMARY KEY,
  context_pack_id TEXT NOT NULL REFERENCES context_packs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  summary TEXT NOT NULL,
  structured_payload JSONB NOT NULL,
  source TEXT NOT NULL,
  source_version_from INTEGER,
  source_version_to INTEGER,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (context_pack_id, version_number)
);

ALTER TABLE context_packs
  ADD CONSTRAINT fk_context_pack_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES context_pack_versions(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS decision_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_decision_log_product
    FOREIGN KEY (workspace_id, product_id)
    REFERENCES products (workspace_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS compression_jobs (
  id TEXT PRIMARY KEY,
  context_pack_id TEXT NOT NULL REFERENCES context_packs(id) ON DELETE CASCADE,
  source_version_from INTEGER NOT NULL,
  source_version_to INTEGER NOT NULL,
  status TEXT NOT NULL,
  output_payload JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_context_packs_workspace_product
  ON context_packs (workspace_id, product_id);
CREATE INDEX IF NOT EXISTS idx_context_pack_versions_pack_created
  ON context_pack_versions (context_pack_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_logs_workspace_product_created
  ON decision_logs (workspace_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compression_jobs_pack_status
  ON compression_jobs (context_pack_id, status);

COMMIT;

