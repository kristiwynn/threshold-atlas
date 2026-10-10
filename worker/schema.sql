CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  age_band TEXT NOT NULL,
  sex TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  cause TEXT NOT NULL,
  decade TEXT,
  tone TEXT,
  religion TEXT,
  items TEXT NOT NULL,                      -- JSON: 16 Greyson item scores, 0/1/2
  score INTEGER NOT NULL,
  after TEXT,                               -- JSON: after-effects checklist
  story TEXT,                               -- raw text, never served publicly
  story_public TEXT,                        -- redacted copy, served only when approved and consent_publish=1
  consent_publish INTEGER NOT NULL DEFAULT 0,
  consent_research INTEGER NOT NULL DEFAULT 0,
  delete_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_country ON submissions(country, region);
