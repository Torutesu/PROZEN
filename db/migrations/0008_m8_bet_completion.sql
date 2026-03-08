-- PROZEN M8 — Bet Completion loop
-- Adds outcome_note and learning_summary to bet_specs for closing the hypothesis loop.

BEGIN;

ALTER TABLE bet_specs
  ADD COLUMN IF NOT EXISTS outcome_note      text,
  ADD COLUMN IF NOT EXISTS learning_summary  text;

COMMIT;
