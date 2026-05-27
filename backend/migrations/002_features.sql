ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'sync'
    CHECK (source IN ('sync', 'manual'));

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS intro_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_cards_intro_order ON cards (intro_order);

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE user_settings
  SET password_hash = '003114e148eb025ba76256a3f08943f2$b4bc87ee0ce74368372054bf8b321c75c7e05a5fb22ac64b7fe7d1ad13b73414480ae5f79200316061bd889fca1da64a2575dfd763e29e6ade2c9df40c563234'
  WHERE id = 1 AND password_hash IS NULL;
