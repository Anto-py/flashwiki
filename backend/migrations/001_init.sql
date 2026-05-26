CREATE TABLE IF NOT EXISTS wiki_files (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  content_hash TEXT NOT NULL,
  last_processed TIMESTAMPTZ,
  status TEXT DEFAULT 'ok'
);

CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recto_verso', 'cloze')),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  explanation TEXT,
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0.3,
  due_date TIMESTAMPTZ DEFAULT NOW(),
  last_review TIMESTAMPTZ,
  state TEXT DEFAULT 'new' CHECK (state IN ('new', 'learning', 'review', 'relearning')),
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  new_cards_per_day INTEGER DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO user_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS review_log (
  id SERIAL PRIMARY KEY,
  card_id INTEGER REFERENCES cards(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  stability_after FLOAT,
  difficulty_after FLOAT,
  due_after TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cards_due ON cards (due_date);
CREATE INDEX IF NOT EXISTS idx_cards_source ON cards (source_file);
CREATE INDEX IF NOT EXISTS idx_cards_state ON cards (state);
