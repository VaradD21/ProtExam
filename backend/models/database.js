const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const MigrationManager = require('../utils/migrationManager');

const dbPath = path.join(__dirname, '../data/protexam.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Connected to SQLite database');
});

db.configure('busyTimeout', 10000);

// Initialize database with migrations
const initializeDatabase = async () => {
  try {
    const migrationManager = new MigrationManager();
    await migrationManager.runMigrations();
    console.log('Database initialized with migrations');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

// User operations
const createUser = (email, password, fullName, role, callback) => {
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (email, password, fullName, role) VALUES (?, ?, ?, ?)',
    [email, hashedPassword, fullName, role],
    function(err) {
      callback(err, { id: this.lastID, email, fullName, role });
    }
  );
};

const getUserByEmail = (email, callback) => {
  db.get('SELECT * FROM users WHERE email = ?', [email], callback);
};

const getUserById = (id, callback) => {
  db.get('SELECT id, email, fullName, role FROM users WHERE id = ?', [id], callback);
};

// Exam operations
const createExam = (organizerId, title, description, duration, totalMarks, passingMarks, instructions, options = {}, callback) => {
  const {
    weightage = 1.0,
    rules = null,
    shuffleQuestions = false,
    shuffleOptions = false,
    allowReview = true,
    showResultsImmediately = false,
    maxAttempts = 1,
    startDate = null,
    endDate = null,
    accessCode = null
  } = options;

  db.run(
    `INSERT INTO exams (organizerId, title, description, duration, totalMarks, passingMarks, instructions, status,
                        weightage, rules, shuffle_questions, shuffle_options, allow_review, show_results_immediately,
                        max_attempts, start_date, end_date, access_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [organizerId, title, description, duration, totalMarks, passingMarks, instructions, 'active',
     weightage, rules, shuffleQuestions, shuffleOptions, allowReview, showResultsImmediately,
     maxAttempts, startDate, endDate, accessCode],
    function(err) {
      callback(err, { id: this.lastID });
    }
  );
};

const getExamsByOrganizer = (organizerId, callback) => {
  db.all(
    'SELECT * FROM exams WHERE organizerId = ? ORDER BY createdAt DESC',
    [organizerId],
    callback
  );
};

const getExamById = (examId, callback) => {
  db.get('SELECT * FROM exams WHERE id = ?', [examId], callback);
};

const updateExam = (examId, updates, callback) => {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(examId);
  
  db.run(
    `UPDATE exams SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
    values,
    callback
  );
};

const deleteExam = (examId, callback) => {
  db.run('DELETE FROM exams WHERE id = ?', [examId], callback);
};

// Question operations
const createQuestion = (examId, type, content, marks, orderNum, callback) => {
  db.run(
    'INSERT INTO questions (examId, type, content, marks, orderNum) VALUES (?, ?, ?, ?, ?)',
    [examId, type, content, marks, orderNum],
    function(err) {
      callback(err, { id: this.lastID });
    }
  );
};

const getQuestionsByExam = (examId, callback) => {
  db.all('SELECT * FROM questions WHERE examId = ? ORDER BY orderNum', [examId], callback);
};

const getQuestionById = (questionId, callback) => {
  db.get('SELECT * FROM questions WHERE id = ?', [questionId], callback);
};

const deleteQuestion = (questionId, callback) => {
  db.run('DELETE FROM questions WHERE id = ?', [questionId], callback);
};

// Question options
const createQuestionOption = (questionId, optionText, isCorrect, callback) => {
  db.run(
    'INSERT INTO question_options (questionId, optionText, isCorrect) VALUES (?, ?, ?)',
    [questionId, optionText, isCorrect],
    function(err) {
      callback(err, { id: this.lastID });
    }
  );
};

const getQuestionOptions = (questionId, callback) => {
  db.all('SELECT * FROM question_options WHERE questionId = ?', [questionId], callback);
};

// Enrollment operations
const enrollStudent = (examId, studentId, callback) => {
  db.run(
    'INSERT OR IGNORE INTO enrollments (examId, studentId) VALUES (?, ?)',
    [examId, studentId],
    callback
  );
};

const getEnrolledStudents = (examId, callback) => {
  db.all(
    `SELECT u.id, u.email, u.fullName FROM users u 
     INNER JOIN enrollments e ON u.id = e.studentId 
     WHERE e.examId = ?`,
    [examId],
    callback
  );
};

const getEnrolledExams = (studentId, callback) => {
  db.all(
    `SELECT e.*, ex.title, ex.description, ex.duration_minutes, ex.total_questions, 
            ex.passing_score, ex.instructions, ex.start_date, ex.end_date
     FROM enrollments en
     INNER JOIN exams ex ON en.exam_id = ex.id
     WHERE en.student_id = ? AND en.status = 'enrolled'
     ORDER BY ex.start_date DESC`,
    [studentId],
    callback
  );
};

// Exam session operations
const createExamSession = (sessionId, examId, studentId, callback) => {
  db.run(
    'INSERT INTO exam_sessions (id, examId, studentId) VALUES (?, ?, ?)',
    [sessionId, examId, studentId],
    callback
  );
};

const getExamSession = (sessionId, callback) => {
  db.get('SELECT * FROM exam_sessions WHERE id = ?', [sessionId], callback);
};

const updateExamSession = (sessionId, updates, callback) => {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }
  values.push(sessionId);
  
  db.run(
    `UPDATE exam_sessions SET ${fields.join(', ')} WHERE id = ?`,
    values,
    callback
  );
};

// Submission operations
const saveSubmission = (sessionId, questionId, answer, firstAnswerTime, lastAnswerTime, changeCount, callback) => {
  db.run(
    `INSERT INTO submissions (sessionId, questionId, answer, firstAnswerTime, lastAnswerTime, changeCount) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, questionId, answer, firstAnswerTime, lastAnswerTime, changeCount],
    function(err) {
      callback(err, { id: this.lastID });
    }
  );
};

const updateSubmission = (submissionId, answer, lastAnswerTime, changeCount, callback) => {
  db.run(
    `UPDATE submissions SET answer = ?, lastAnswerTime = ?, changeCount = ?, updatedAt = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [answer, lastAnswerTime, changeCount, submissionId],
    callback
  );
};

const getSubmissionsBySession = (sessionId, callback) => {
  db.all('SELECT * FROM submissions WHERE sessionId = ? ORDER BY questionId', [sessionId], callback);
};

const getSubmissionBySessionAndQuestion = (sessionId, questionId, callback) => {
  db.get(
    'SELECT * FROM submissions WHERE sessionId = ? AND questionId = ?',
    [sessionId, questionId],
    callback
  );
};

// Activity logging
const logStudentActivity = (sessionId, eventType, timestamp, details, callback) => {
  db.run(
    'INSERT INTO activity_logs (sessionId, eventType, timestamp, details) VALUES (?, ?, ?, ?)',
    [sessionId, eventType, new Date(timestamp).toISOString(), details],
    callback || (() => {})
  );
};

// Violation logging
const logViolation = (sessionId, violationType, timestamp, details, severity, callback) => {
  db.run(
    'INSERT INTO violation_logs (sessionId, violationType, timestamp, details, severity) VALUES (?, ?, ?, ?, ?)',
    [sessionId, violationType, new Date(timestamp).toISOString(), details, severity],
    callback || (() => {})
  );
};

const getViolationsBySession = (sessionId, callback) => {
  db.all('SELECT * FROM violation_logs WHERE sessionId = ? ORDER BY timestamp', [sessionId], callback);
};

const getViolationsByExam = (examId, callback) => {
  db.all(
    `SELECT v.* FROM violation_logs v 
     INNER JOIN exam_sessions es ON v.sessionId = es.id 
     WHERE es.examId = ? ORDER BY v.timestamp DESC`,
    [examId],
    callback
  );
};

const logCameraSnapshot = (sessionId, imageData, timestamp, callback) => {
  db.run(
    'INSERT INTO camera_snapshots (sessionId, imageData, timestamp) VALUES (?, ?, ?)',
    [sessionId, imageData, new Date(timestamp).toISOString()],
    callback || (() => {})
  );
};

const getCameraSnapshotsBySession = (sessionId, callback) => {
  db.all(
    'SELECT * FROM camera_snapshots WHERE sessionId = ? ORDER BY timestamp DESC',
    [sessionId],
    callback
  );
};

// Grading
const gradeSubmission = (submissionId, marks, isAutoGraded, gradedBy, feedback, callback) => {
  db.run(
    `UPDATE submissions SET marks = ?, isAutoGraded = ?, isManuallyGraded = ?, gradedBy = ?, feedback = ?, updatedAt = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [marks, isAutoGraded ? 1 : 0, isAutoGraded ? 0 : 1, gradedBy, feedback, submissionId],
    callback
  );
};

const getSessionResults = (sessionId, callback) => {
  db.get(
    `SELECT 
      es.id, es.examId, es.studentId, es.startTime, es.endTime, es.totalViolations, es.suspicionScore,
      SUM(CASE WHEN s.isAutoGraded OR s.isManuallyGraded THEN s.marks ELSE 0 END) as totalMarks
     FROM exam_sessions es
     LEFT JOIN submissions s ON es.id = s.sessionId
     WHERE es.id = ?
     GROUP BY es.id`,
    [sessionId],
    callback
  );
};

// Get all activity logs for session
const getActivityLogs = (sessionId, callback) => {
  db.all(
    'SELECT * FROM activity_logs WHERE sessionId = ? ORDER BY timestamp',
    [sessionId],
    callback
  );
};

module.exports = {
  initializeDatabase,
  createUser,
  getUserByEmail,
  getUserById,
  createExam,
  getExamsByOrganizer,
  getExamById,
  updateExam,
  deleteExam,
  createQuestion,
  getQuestionsByExam,
  getQuestionById,
  deleteQuestion,
  createQuestionOption,
  getQuestionOptions,
  enrollStudent,
  getEnrolledStudents,
  getEnrolledExams,
  createExamSession,
  getExamSession,
  updateExamSession,
  saveSubmission,
  updateSubmission,
  getSubmissionsBySession,
  getSubmissionBySessionAndQuestion,
  logStudentActivity,
  logViolation,
  getViolationsBySession,
  getViolationsByExam,
  logCameraSnapshot,
  getCameraSnapshotsBySession,
  gradeSubmission,
  getSessionResults,
  getActivityLogs
};
