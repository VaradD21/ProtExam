const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exams');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');
const logRoutes = require('./routes/logs');
const monitoringRoutes = require('./routes/monitoring');
const { authMiddleware } = require('./middleware/auth');
const { authLimiter, apiLimiter, examLimiter } = require('./middleware/rateLimit');
const { validateAndSanitize } = require('./middleware/validation');
const { Logger, requestLogger } = require('./utils/logger');
const ChatManager = require('./utils/chatManager');
const ExamScheduler = require('./utils/examScheduler');
const CertificateManager = require('./utils/certificateManager');
const FileManager = require('./utils/fileManager');
const AnalyticsManager = require('./utils/analyticsManager');
const NotificationManager = require('./utils/notificationManager');
const BackupManager = require('./utils/backupManager');
const multer = require('multer');
const db = require('./models/database');

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, 'uploads/temp'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    // Allow all file types for now - validation happens in FileManager
    cb(null, true);
  }
});

// Initialize logger
const logger = new Logger();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));

// Performance middleware
app.use(compression());

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(validateAndSanitize); // Input validation and sanitization
app.use(requestLogger(logger)); // Request logging
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
// await db.initializeDatabase(); // Moved to startServer function

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/exams', apiLimiter, examRoutes);
app.use('/api/questions', apiLimiter, questionRoutes);
app.use('/api/submissions', examLimiter, submissionRoutes);
app.use('/api/logs', apiLimiter, logRoutes);
app.use('/api/monitoring', apiLimiter, monitoringRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.1.0'
  });
});

// Chat statistics endpoint
app.get('/api/chat/stats', authMiddleware, (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const stats = chatManager.getChatStats();
  res.json(stats);
});

// Exam scheduling endpoints
app.post('/api/exams/:examId/schedule', authMiddleware, (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { examId } = req.params;
  const scheduleData = req.body;

  try {
    const schedule = examScheduler.scheduleExam(examId, scheduleData);
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/exams/:examId/schedule', authMiddleware, (req, res) => {
  const { examId } = req.params;
  const schedule = examScheduler.getExamSchedule(examId);

  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  res.json(schedule);
});

app.get('/api/schedule/upcoming', authMiddleware, (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const upcoming = examScheduler.getUpcomingExams(hours);
  res.json(upcoming);
});

app.get('/api/schedule/calendar/:year/:month', authMiddleware, (req, res) => {
  const { year, month } = req.params;
  const calendarData = examScheduler.getCalendarData(parseInt(year), parseInt(month) - 1); // JS months are 0-based
  res.json(calendarData);
});

app.put('/api/exams/:examId/schedule', authMiddleware, (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { examId } = req.params;
  const updates = req.body;

  const schedule = examScheduler.updateExamSchedule(examId, updates);
  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  res.json(schedule);
});

app.delete('/api/exams/:examId/schedule', authMiddleware, (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { examId } = req.params;
  const schedule = examScheduler.cancelExamSchedule(examId);

  if (!schedule) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  res.json({ success: true, schedule });
});

// Certificate management endpoints
app.post('/api/certificates/generate', authMiddleware, (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const certificateData = req.body;
  try {
    const certificate = certificateManager.generateCertificate(certificateData.sessionId, certificateData);
    res.json({ success: true, certificate });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/certificates/:certificateId', (req, res) => {
  const { certificateId } = req.params;
  const certificate = certificateManager.getCertificate(certificateId);

  if (!certificate) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  res.json(certificate);
});

app.get('/api/certificates/verify/:certificateId/:verificationCode', (req, res) => {
  const { certificateId, verificationCode } = req.params;
  const result = certificateManager.verifyCertificate(certificateId, verificationCode);
  res.json(result);
});

app.get('/api/students/:studentId/certificates', authMiddleware, (req, res) => {
  const { studentId } = req.params;

  // Allow students to view their own certificates, organizers to view any
  if (req.user.role !== 'organizer' && req.user.id != studentId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const certificates = certificateManager.getStudentCertificates(studentId);
  res.json(certificates);
});

app.get('/api/certificates/:certificateId/html', (req, res) => {
  const { certificateId } = req.params;
  const certificate = certificateManager.getCertificate(certificateId);

  if (!certificate) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  const html = certificateManager.generateHTMLCertificate(certificate);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/api/certificates/stats', authMiddleware, (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const stats = certificateManager.getCertificateStats();
  res.json(stats);
});

app.delete('/api/certificates/:certificateId', authMiddleware, (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { certificateId } = req.params;
  const { reason } = req.body;

  const success = certificateManager.revokeCertificate(certificateId, reason);
  if (!success) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  res.json({ success: true });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoints
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const context = {
      userId: req.user.id,
      examId: req.body.examId,
      questionId: req.body.questionId,
      type: req.body.type || 'general'
    };

    const fileInfo = await fileManager.saveFile(req.file, context);
    res.json({ success: true, file: fileInfo });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/upload/multiple', authMiddleware, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const context = {
      userId: req.user.id,
      examId: req.body.examId,
      questionId: req.body.questionId,
      type: req.body.type || 'general'
    };

    const uploadedFiles = [];
    for (const file of req.files) {
      const fileInfo = await fileManager.saveFile(file, context);
      uploadedFiles.push(fileInfo);
    }

    res.json({ success: true, files: uploadedFiles });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/files/stats', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const stats = await fileManager.getStorageStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/files/:fileId', authMiddleware, async (req, res) => {
  const { fileId } = req.params;

  // Check if user owns the file or is organizer
  // In a real implementation, this would check file ownership

  try {
    const success = await fileManager.deleteFile(fileId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics endpoints
app.get('/api/analytics/dashboard', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const overview = await analyticsManager.getDashboardOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/exam/:examId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { examId } = req.params;

  try {
    const analytics = await analyticsManager.getExamAnalytics(examId);
    if (!analytics) {
      return res.status(404).json({ error: 'Analytics not found' });
    }
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/exam/:examId/report', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { examId } = req.params;
  const { format = 'json' } = req.query;

  try {
    const report = await analyticsManager.generateExamReport(examId);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="exam_${examId}_report.csv"`);
      res.send(analyticsManager.convertToCSV(report));
    } else {
      res.json(report);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/performance', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { timeRange = '24 hours' } = req.query;

  try {
    const performance = await analyticsManager.getPerformanceAnalytics(timeRange);
    res.json(performance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Notification endpoints
app.get('/api/notifications', authMiddleware, async (req, res) => {
  const { limit = 50, offset = 0, unreadOnly = false, type } = req.query;

  try {
    const notifications = await notificationManager.getUserNotifications(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true',
      type
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/:notificationId/read', authMiddleware, async (req, res) => {
  const { notificationId } = req.params;

  try {
    const success = await notificationManager.markAsRead(notificationId, req.user.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    const count = await notificationManager.markAllAsRead(req.user.id);
    res.json({ success: true, markedAsRead: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notifications/:notificationId', authMiddleware, async (req, res) => {
  const { notificationId } = req.params;

  try {
    const success = await notificationManager.deleteNotification(notificationId, req.user.id);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/send', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { userIds, templateKey, data, options = {} } = req.body;

  try {
    const notifications = await notificationManager.sendBulkNotifications(userIds, templateKey, data, options);
    res.json({ success: true, sent: notifications.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/alerts', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const alertData = req.body;

  try {
    const alert = await notificationManager.createAlert(alertData);
    res.json({ success: true, alert });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/alerts', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const alerts = await notificationManager.getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/alerts/:alertId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { alertId } = req.params;

  try {
    await notificationManager.resolveAlert(alertId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Backup management endpoints
app.post('/api/backup/create', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const backup = await backupManager.createBackup(req.body);
    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backup/list', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const backups = await backupManager.listBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/restore', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { backupPath, verifyOnly = false } = req.body;

  try {
    const result = await backupManager.restoreBackup(backupPath, { verifyOnly });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/export', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { outputPath } = req.body;

  try {
    await backupManager.exportToJSON(outputPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/import', authMiddleware, async (req, res) => {
  if (req.user.role !== 'organizer') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { inputPath } = req.body;

  try {
    await backupManager.importFromJSON(inputPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket for real-time monitoring
const activeStudents = {}; // { sessionId: { studentId, examId, status, violations } }

// Initialize chat manager
const chatManager = new ChatManager(io);

// Initialize exam scheduler
const examScheduler = new ExamScheduler();

// Initialize certificate manager
const certificateManager = new CertificateManager();

// Initialize file manager
const fileManager = new FileManager();

// Initialize analytics manager
const analyticsManager = new AnalyticsManager(db);

// Initialize notification manager
const notificationManager = new NotificationManager(db, io);

// Initialize backup manager
const backupManager = new BackupManager(db, {
  backupDir: path.join(__dirname, 'backups'),
  retentionDays: 30,
  maxBackups: 10,
  schedule: '0 2 * * *' // Daily at 2 AM
});

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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// Make logger available globally for routes
global.logger = logger;

// Start server
const startServer = async () => {
  try {
    // Initialize database
    await db.initializeDatabase();

    // Initialize notification templates
    notificationManager.initializeTemplates();

    // Initialize backup system
    await backupManager.initialize();
    backupManager.startScheduledBackups();

    const PORT = process.env.PORT || 8000;
    server.listen(PORT, async () => {
      await logger.info('ProExam server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: '1.1.0'
      });

      console.log(`ProExam server running on port ${PORT}`);
      console.log(`Organizer: http://localhost:${PORT}/organizer/`);
      console.log(`Student: http://localhost:${PORT}/student/`);
      console.log(`Login: http://localhost:${PORT}/login.html`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
