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

-- Archive accounts (NDERF, IANDS, ...) read by a person and coded on the same 16 Greyson
-- items as submissions. Codes only: no text, no quotes, no paraphrase is ever stored.
-- source_ref is the archive's own ID or URL path, kept so an account is never coded twice.
CREATE TABLE IF NOT EXISTS archive_codes (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,                     -- NDERF | IANDS | Other
  source_ref TEXT NOT NULL,
  coded INTEGER NOT NULL,
  codebook TEXT NOT NULL,                   -- codebook version, e.g. v1
  method TEXT NOT NULL,                     -- manual | ai-assisted (a person checked every item either way)
  language TEXT,
  near_death TEXT NOT NULL,                 -- Clinical | Perceived | No | Not stated
  experience_type TEXT,                     -- the map's kinds: tunnel | guided | summoned | journey | calm | distressing (added by migrations/0001)
  age_band TEXT NOT NULL,                   -- includes 'Not stated'
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
  UNIQUE (source, source_ref)
);
CREATE INDEX IF NOT EXISTS idx_archive_source ON archive_codes(source);
