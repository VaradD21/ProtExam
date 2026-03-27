-- Enhanced features migration
-- Adds enrollments table, exam settings, and additional exam fields

-- Enrollments table for student-exam relationships
CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  enrolled_by INTEGER, -- organizer who enrolled the student
  status TEXT CHECK(status IN ('enrolled', 'removed')) DEFAULT 'enrolled',
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (enrolled_by) REFERENCES users(id),
  UNIQUE(exam_id, student_id)
);

-- Add new columns to exams table for enhanced features
ALTER TABLE exams ADD COLUMN weightage REAL DEFAULT 1.0; -- relative weight of exam
ALTER TABLE exams ADD COLUMN rules TEXT; -- additional rules and regulations
ALTER TABLE exams ADD COLUMN shuffle_questions BOOLEAN DEFAULT 0; -- shuffle question order
ALTER TABLE exams ADD COLUMN shuffle_options BOOLEAN DEFAULT 0; -- shuffle MCQ options
ALTER TABLE exams ADD COLUMN allow_review BOOLEAN DEFAULT 1; -- allow reviewing answers
ALTER TABLE exams ADD COLUMN show_results_immediately BOOLEAN DEFAULT 0; -- show results after completion
ALTER TABLE exams ADD COLUMN max_attempts INTEGER DEFAULT 1; -- maximum attempts allowed
ALTER TABLE exams ADD COLUMN start_date DATETIME; -- exam start date/time
ALTER TABLE exams ADD COLUMN end_date DATETIME; -- exam end date/time
ALTER TABLE exams ADD COLUMN access_code TEXT; -- optional access code for exam

-- Add new columns to exam_sessions for enhanced tracking
ALTER TABLE exam_sessions ADD COLUMN attempt_number INTEGER DEFAULT 1; -- attempt number for retakes
ALTER TABLE exam_sessions ADD COLUMN full_screen_exits INTEGER DEFAULT 0; -- number of times student exited full screen

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_enrollments_exam_id ON enrollments(exam_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_start_date ON exams(start_date);
CREATE INDEX IF NOT EXISTS idx_exams_end_date ON exams(end_date);