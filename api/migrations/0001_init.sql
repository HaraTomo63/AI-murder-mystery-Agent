CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  turn_limit INTEGER NOT NULL,
  turns_used INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  seed TEXT NOT NULL,
  worldview_text TEXT NOT NULL,
  attribute_text TEXT NOT NULL,
  prompt_version_init TEXT NOT NULL,
  prompt_version_chat TEXT NOT NULL,
  prompt_version_score TEXT NOT NULL,
  intro_image_url TEXT,
  truth_table_json TEXT NOT NULL,
  public_state_json TEXT NOT NULL,
  abuse_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  input_hash TEXT,
  abuse_flags_json TEXT,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  session_id TEXT PRIMARY KEY,
  culprit TEXT NOT NULL,
  logic_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS results (
  session_id TEXT PRIMARY KEY,
  score_total INTEGER NOT NULL,
  breakdown_json TEXT NOT NULL,
  grade TEXT NOT NULL,
  result_text TEXT NOT NULL,
  share_image_url TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS idempotency (
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  key TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, endpoint, key)
);
