CREATE TABLE newsletter_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  digest_date DATE NOT NULL UNIQUE,
  content TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  curriculum_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_newsletter_digests_date ON newsletter_digests(digest_date DESC);

-- Migrate existing digest from notifications into the new table
INSERT INTO newsletter_digests (digest_date, content, item_count, curriculum_count)
SELECT
  n.created_at::date,
  n.message,
  COALESCE((SELECT count(*) FROM newsletter_items ni WHERE ni.digest_date::date = n.created_at::date), 0),
  COALESCE((SELECT count(*) FROM newsletter_items ni WHERE ni.digest_date::date = n.created_at::date AND ni.is_curriculum_relevant = true), 0)
FROM notifications n
WHERE n.type = 'digest' AND n.title LIKE 'Newsletter%'
ON CONFLICT (digest_date) DO NOTHING;
