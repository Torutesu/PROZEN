-- PROZEN M2 spec agent migration
-- Scope: bet specs, versioning, spec conversations

BEGIN;

CREATE TABLE IF NOT EXISTS bet_specs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  current_version_id TEXT,
  conversation_id TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_bet_spec_product
    FOREIGN KEY (workspace_id, product_id)
    REFERENCES products (workspace_id, id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bet_spec_versions (
  id TEXT PRIMARY KEY,
  bet_spec_id TEXT NOT NULL REFERENCES bet_specs(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  structured_payload JSONB NOT NULL,
  source TEXT NOT NULL,
  source_version_from INTEGER,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (bet_spec_id, version_number)
);

ALTER TABLE bet_specs
  ADD CONSTRAINT fk_bet_spec_current_version
  FOREIGN KEY (current_version_id)
  REFERENCES bet_spec_versions(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS spec_conversations (
  id TEXT PRIMARY KEY,
  bet_spec_id TEXT NOT NULL REFERENCES bet_specs(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  agent_state TEXT NOT NULL DEFAULT 'collecting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE bet_specs
  ADD CONSTRAINT fk_bet_spec_conversation
  FOREIGN KEY (conversation_id)
  REFERENCES spec_conversations(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bet_specs_workspace_product
  ON bet_specs (workspace_id, product_id);
CREATE INDEX IF NOT EXISTS idx_bet_specs_workspace_product_created
  ON bet_specs (workspace_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bet_spec_versions_bet_created
  ON bet_spec_versions (bet_spec_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spec_conversations_bet_spec
  ON spec_conversations (bet_spec_id);

COMMIT;
