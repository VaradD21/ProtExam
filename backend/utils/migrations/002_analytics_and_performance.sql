-- Analytics and performance tracking migration
-- Adds tables for exam analytics, performance metrics, and system monitoring

-- Exam analytics table
CREATE TABLE IF NOT EXISTS exam_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  total_students INTEGER DEFAULT 0,
  completed_students INTEGER DEFAULT 0,
  average_score REAL DEFAULT 0,
  highest_score INTEGER DEFAULT 0,
  lowest_score INTEGER DEFAULT 0,
  average_completion_time INTEGER DEFAULT 0, -- in minutes
  pass_rate REAL DEFAULT 0,
  total_violations INTEGER DEFAULT 0,
  most_common_violation TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- Question analytics table
CREATE TABLE IF NOT EXISTS question_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  exam_id INTEGER NOT NULL,
  times_answered INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  average_time_taken INTEGER DEFAULT 0, -- in seconds
  difficulty_rating REAL DEFAULT 0, -- 0-1 scale based on correctness rate
  discrimination_index REAL DEFAULT 0, -- how well question differentiates ability levels
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- System performance logs
CREATE TABLE IF NOT EXISTS performance_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time INTEGER NOT NULL, -- in milliseconds
  status_code INTEGER NOT NULL,
  user_id INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Backup metadata table
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  backup_type TEXT CHECK(backup_type IN ('full', 'incremental')) DEFAULT 'full',
  size_bytes INTEGER,
  checksum TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  notifications_enabled BOOLEAN DEFAULT 1,
  auto_save BOOLEAN DEFAULT 1,
  preferences_json TEXT, -- JSON for additional preferences
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API rate limiting table (for persistent rate limiting)
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start DATETIME NOT NULL,
  blocked BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_exam_analytics_exam_id ON exam_analytics(exam_id);
CREATE INDEX IF NOT EXISTS idx_question_analytics_question_id ON question_analytics(question_id);
CREATE INDEX IF NOT EXISTS idx_question_analytics_exam_id ON question_analytics(exam_id);
CREATE INDEX IF NOT EXISTS idx_performance_logs_endpoint ON performance_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_logs_timestamp ON performance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_ip_endpoint ON rate_limit_logs(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_window ON rate_limit_logs(window_start);