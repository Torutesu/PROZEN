-- M14: Product reviews table
-- Stores AI-generated periodic reviews: evening decision recap + weekly bet retrospective.
-- Separate from daily_briefings which is a morning-only snapshot.

CREATE TABLE IF NOT EXISTS product_reviews (
  id              text        PRIMARY KEY,
  workspace_id    text        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id      text        NOT NULL,
  review_type     text        NOT NULL,  -- 'evening_review' | 'weekly_retro'
  review_date     date        NOT NULL,
  content         text        NOT NULL,
  metadata        jsonb       NOT NULL DEFAULT '{}',
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_unique_idx
  ON product_reviews (workspace_id, product_id, review_type, review_date);
