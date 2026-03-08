-- PROZEN M1 hardening: enforce one context_pack per workspace+product
-- Scope: prevent duplicate context_packs under concurrent ingest

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM context_packs
    GROUP BY workspace_id, product_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique context_packs(workspace_id, product_id): duplicate rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_context_packs_workspace_product
  ON context_packs (workspace_id, product_id);

COMMIT;
