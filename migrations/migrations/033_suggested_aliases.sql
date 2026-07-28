-- Suggested category aliases from the matching algorithm, pending admin review
CREATE TABLE IF NOT EXISTS suggested_aliases (
  id            serial PRIMARY KEY,
  canonical_id  integer NOT NULL REFERENCES categories_canonical(id) ON DELETE CASCADE,
  marketplace   text NOT NULL,
  original_name text NOT NULL,
  score         numeric(4,3) NOT NULL,
  tier          text NOT NULL CHECK (tier IN ('exact', 'substring', 'token_set')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS suggested_aliases_mp_name_idx ON suggested_aliases (marketplace, original_name);
CREATE INDEX IF NOT EXISTS suggested_aliases_status_idx ON suggested_aliases (status);
CREATE INDEX IF NOT EXISTS suggested_aliases_canonical_idx ON suggested_aliases (canonical_id);
