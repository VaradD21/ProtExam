-- Notifications and backup system migration
-- Adds tables for notifications, alerts, scheduled notifications, and backup management

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK(type IN ('info', 'warning', 'error', 'success')) DEFAULT 'info',
  priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  read BOOLEAN DEFAULT 0,
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- System alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK(type IN ('info', 'warning', 'error', 'critical')) DEFAULT 'warning',
  severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  resolved_at DATETIME,
  affected_users TEXT, -- JSON array of user IDs
  metadata TEXT, -- JSON metadata
  created_by INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Scheduled notifications table
CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  template_key TEXT NOT NULL,
  data TEXT, -- JSON data for template
  scheduled_time DATETIME NOT NULL,
  options TEXT, -- JSON options
  status TEXT CHECK(status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending',
  sent_at DATETIME,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- File storage table (for file manager)
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  path TEXT NOT NULL,
  checksum TEXT,
  uploaded_by INTEGER NOT NULL,
  exam_id INTEGER,
  question_id INTEGER,
  file_type TEXT DEFAULT 'general', -- 'question', 'answer', 'certificate', 'general'
  metadata TEXT, -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Chat messages table (for chat manager)
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  sender_id INTEGER NOT NULL,
  sender_role TEXT CHECK(sender_role IN ('student', 'organizer')) NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT CHECK(message_type IN ('text', 'system', 'help_request')) DEFAULT 'text',
  priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  read_by TEXT, -- JSON array of user IDs who read the message
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  exam_id INTEGER,
  student_id INTEGER NOT NULL,
  organizer_id INTEGER,
  status TEXT CHECK(status IN ('active', 'closed', 'pending')) DEFAULT 'active',
  priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (organizer_id) REFERENCES users(id)
);

-- Exam schedules table (for exam scheduler)
CREATE TABLE IF NOT EXISTS exam_schedules (
  id TEXT PRIMARY KEY,
  exam_id INTEGER NOT NULL,
  scheduled_start DATETIME NOT NULL,
  scheduled_end DATETIME,
  duration_minutes INTEGER,
  auto_start BOOLEAN DEFAULT 0,
  auto_end BOOLEAN DEFAULT 0,
  reminders_enabled BOOLEAN DEFAULT 1,
  reminder_times TEXT, -- JSON array of minutes before start
  timezone TEXT DEFAULT 'UTC',
  recurrence TEXT, -- JSON recurrence rules
  status TEXT CHECK(status IN ('scheduled', 'active', 'completed', 'cancelled')) DEFAULT 'scheduled',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- Certificates table (for certificate manager)
CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  exam_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  certificate_number TEXT UNIQUE NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL,
  percentage REAL NOT NULL,
  grade TEXT,
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  verification_code TEXT UNIQUE NOT NULL,
  status TEXT CHECK(status IN ('active', 'revoked', 'expired')) DEFAULT 'active',
  revoked_at DATETIME,
  revoked_reason TEXT,
  template_data TEXT, -- JSON template data
  metadata TEXT, -- JSON metadata
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_system_alerts_active ON system_alerts(active);
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at ON system_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_id ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled_time ON scheduled_notifications(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_status ON scheduled_notifications(status);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_exam_id ON files(exam_id);
CREATE INDEX IF NOT EXISTS idx_files_question_id ON files(question_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_exam_id ON chat_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_student_id ON chat_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_exam_id ON exam_schedules(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_scheduled_start ON exam_schedules(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_status ON exam_schedules(status);
CREATE INDEX IF NOT EXISTS idx_certificates_exam_id ON certificates(exam_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_verification_code ON certificates(verification_code);