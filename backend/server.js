const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exams');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');
const logRoutes = require('./routes/logs');
const monitoringRoutes = require('./routes/monitoring');
const { authMiddleware } = require('./middleware/auth');
const db = require('./models/database');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize database
db.initializeDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/monitoring', monitoringRoutes);

// WebSocket for real-time monitoring
const activeStudents = {}; // { sessionId: { studentId, examId, status, violations } }

io.on('connection', (socket) => {
  console.log(`Student connected: ${socket.id}`);

  // Student joins exam session
  socket.on('exam_start', (data) => {
    const { studentId, examId, sessionId } = data;
    activeStudents[sessionId] = {
      studentId,
      examId,
      status: 'active',
      violations: 0,
      startTime: Date.now(),
      lastActivity: Date.now(),
      socketId: socket.id
    };
    socket.join(`exam_${examId}`);
    socket.join(`monitoring_${examId}`);
    io.to(`monitoring_${examId}`).emit('student_status_update', activeStudents[sessionId]);
  });

  // Log suspicious activity
  socket.on('log_violation', (data) => {
    const { sessionId, violationType, timestamp, details } = data;
    if (activeStudents[sessionId]) {
      activeStudents[sessionId].violations++;
      activeStudents[sessionId].lastViolation = violationType;
      activeStudents[sessionId].lastViolationTime = timestamp;
      
      // Update status based on violation count
      if (activeStudents[sessionId].violations >= 3) {
        activeStudents[sessionId].status = 'suspicious';
      } else if (activeStudents[sessionId].violations >= 1) {
        activeStudents[sessionId].status = 'warning';
      }

      // Log to database
      db.logStudentActivity(sessionId, violationType, timestamp, JSON.stringify(details), (err) => {
        if (err) console.error('Failed to log violation:', err);
      });

      // Notify organizer
      io.to(`monitoring_${activeStudents[sessionId].examId}`).emit('violation_logged', {
        sessionId,
        violationType,
        timestamp,
        studentStatus: activeStudents[sessionId]
      });
    }
  });

  // Update last activity
  socket.on('activity', (data) => {
    const { sessionId } = data;
    if (activeStudents[sessionId]) {
      activeStudents[sessionId].lastActivity = Date.now();
    }
  });

  // Student leaves exam
  socket.on('exam_end', (data) => {
    const { sessionId } = data;
    const examId = activeStudents[sessionId]?.examId;
    if (sessionId && activeStudents[sessionId]) {
      activeStudents[sessionId].status = 'completed';
      io.to(`monitoring_${examId}`).emit('student_status_update', activeStudents[sessionId]);
    }
  });

  socket.on('disconnect', () => {
    // Mark student as disconnected
    for (const [sessionId, student] of Object.entries(activeStudents)) {
      if (student.socketId === socket.id) {
        student.status = 'disconnected';
        student.disconnectTime = Date.now();
        io.to(`monitoring_${student.examId}`).emit('student_status_update', student);
        break;
      }
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`ProExam server running on port ${PORT}`);
  console.log(`Organizer: http://localhost:${PORT}/organizer/`);
  console.log(`Student: http://localhost:${PORT}/student/`);
  console.log(`Login: http://localhost:${PORT}/login.html`);
});
