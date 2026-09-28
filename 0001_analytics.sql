CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visited_at INTEGER NOT NULL,
  visitor_hash TEXT,
  ip_masked TEXT NOT NULL,
  device TEXT NOT NULL CHECK(device IN ('celular','computador','tablet'))
);
CREATE INDEX IF NOT EXISTS visits_time ON visits(visited_at);
CREATE INDEX IF NOT EXISTS visits_visitor ON visits(visitor_hash, visited_at);
CREATE TABLE IF NOT EXISTS auth_attempts (
  ip_hash TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY(ip_hash, bucket)
);
