CREATE TABLE IF NOT EXISTS categories_canonical (
  id      serial PRIMARY KEY,
  name_ru text NOT NULL,
  name_uz text NOT NULL,
  name_en text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_canonical_name_ru_idx
  ON categories_canonical (name_ru);

CREATE TABLE IF NOT EXISTS category_aliases (
  id            serial PRIMARY KEY,
  canonical_id  integer NOT NULL REFERENCES categories_canonical(id) ON DELETE CASCADE,
  marketplace   text NOT NULL,
  original_name text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS category_aliases_mp_name_idx
  ON category_aliases (marketplace, original_name);

CREATE INDEX IF NOT EXISTS category_aliases_canonical_idx
  ON category_aliases (canonical_id);
