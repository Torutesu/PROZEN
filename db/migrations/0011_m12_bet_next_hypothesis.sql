-- M12: Add next_bet_hypothesis to bet_specs
-- Stores the AI-proposed hypothesis for the follow-on bet after a bet is completed.

ALTER TABLE bet_specs ADD COLUMN IF NOT EXISTS next_bet_hypothesis text;
