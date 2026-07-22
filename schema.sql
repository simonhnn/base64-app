CREATE TABLE IF NOT EXISTS conversion_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,
  plaintext TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
