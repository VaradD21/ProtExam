require('dotenv').config();

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
const { authMiddleware, JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
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

function sendError(res, error, status = 500) {
  return res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
}

function sendNotFound(res, message = 'Not found') {
  return res.status(404).json({ error: message });
}

function sendForbidden(res) {
  return res.status(403).json({ error: 'Access denied' });
}

function ensureOrganizer(req, res) {
  if (req.user?.role !== 'organizer') {
    sendForbidden(res);
    return false;
  }
  return true;
}

function authorizeOwnerOrOrganizer(req, ownerId) {
  if (req.user?.role === 'organizer') {
    return true;
  }

  return String(req.user?.id) === String(ownerId);
}

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

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3001')
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0 && origin !== '*');

const allowedSocketOrigins = (process.env.WS_CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3001')
  .split(',')
  .map(origin => origin.trim())
  .filter(origin => origin.length > 0 && origin !== '*');

const io = socketIO(server, {
  cors: {
    origin: allowedSocketOrigins.length > 0 ? allowedSocketOrigins : false,
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
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: false
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

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1] || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    return next();
  } catch (err) {
    return next(new Error('Invalid authentication token'));
  }
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
  if (!ensureOrganizer(req, res)) {
    return;
  }

  const stats = chatManager.getChatStats();
  res.json(stats);
});

// Exam scheduling endpoints
app.post('/api/exams/:examId/schedule', authMiddleware, (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
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
  const hours = Number.parseInt(req.query.hours, 10) || 24;
  const upcoming = examScheduler.getUpcomingExams(hours);
  res.json(upcoming);
});

app.get('/api/schedule/calendar/:year/:month', authMiddleware, (req, res) => {
  const { year, month } = req.params;
  const calendarData = examScheduler.getCalendarData(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1); // JS months are 0-based
  res.json(calendarData);
});

app.put('/api/exams/:examId/schedule', authMiddleware, (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
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
  if (!ensureOrganizer(req, res)) {
    return;
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
  if (!ensureOrganizer(req, res)) {
    return;
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

  if (!authorizeOwnerOrOrganizer(req, studentId)) {
    return sendForbidden(res);
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
  if (!ensureOrganizer(req, res)) {
    return;
  }

  const stats = certificateManager.getCertificateStats();
  res.json(stats);
});

app.delete('/api/certificates/:certificateId', authMiddleware, (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
  }

  const { certificateId } = req.params;
  const { reason } = req.body;

  const success = certificateManager.revokeCertificate(certificateId, reason);
  if (!success) {
    return sendNotFound(res, 'Certificate not found');
  }

  res.json({ success: true });
});

// File download endpoint (authenticated)
app.get('/api/files/:fileId/download', authMiddleware, async (req, res) => {
  const { fileId } = req.params;
  const fileInfo = await fileManager.getFileInfo(fileId);

  if (!fileInfo) {
    return sendNotFound(res, 'File not found');
  }

  if (!authorizeOwnerOrOrganizer(req, fileInfo.uploadedBy)) {
    return sendForbidden(res);
  }

  return res.download(fileInfo.path, fileInfo.originalName || path.basename(fileInfo.path));
});

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

    const uploadedFiles = await Promise.all(
      req.files.map((file) => fileManager.saveFile(file, context))
    );

    res.json({ success: true, files: uploadedFiles });
  } catch (error) {
    sendError(res, error, 400);
  }
});

app.get('/api/files/stats', authMiddleware, async (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
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

  try {
    const fileInfo = await fileManager.getFileInfo(fileId);
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!authorizeOwnerOrOrganizer(req, fileInfo.uploadedBy)) {
      return sendForbidden(res);
    }

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
  if (!ensureOrganizer(req, res)) {
    return;
  }

  try {
    const overview = await analyticsManager.getDashboardOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/exam/:examId', authMiddleware, async (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
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
  if (!ensureOrganizer(req, res)) {
    return;
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
  if (!ensureOrganizer(req, res)) {
    return;
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
      limit: Number.parseInt(limit, 10),
      offset: Number.parseInt(offset, 10),
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
  if (!ensureOrganizer(req, res)) {
    return;
  }

  const { userIds, templateKey, data, options = {} } = req.body;

  try {
    const notifications = await notificationManager.sendBulkNotifications(userIds, templateKey, data, options);
    res.json({ success: true, sent: notifications.length });
  } catch (error) {
    sendError(res, error, 400);
  }
});

app.post('/api/alerts', authMiddleware, async (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
  }

  const alertData = req.body;

  try {
    const alert = await notificationManager.createAlert(alertData);
    res.json({ success: true, alert });
  } catch (error) {
    sendError(res, error, 400);
  }
});

app.get('/api/alerts', authMiddleware, async (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
  }

  try {
    const alerts = await notificationManager.getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/alerts/:alertId', authMiddleware, async (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
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
  if (!ensureOrganizer(req, res)) {
    return;
  }

  try {
    const backup = await backupManager.createBackup(req.body);
    res.json({ success: true, backup });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backup/list', authMiddleware, async (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
  }

  try {
    const backups = await backupManager.listBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/restore', authMiddleware, async (req, res) => {
  if (!ensureOrganizer(req, res)) {
    return;
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
  if (!ensureOrganizer(req, res)) {
    return;
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
  if (!ensureOrganizer(req, res)) {
    return;
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
  dbPath: path.join(__dirname, 'data', 'protexam.db'),
  backupDir: path.join(__dirname, 'backups'),
  retentionDays: 30,
  maxBackups: 10,
  schedule: '0 2 * * *' // Daily at 2 AM
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  const authenticatedUser = socket.user;
  if (!authenticatedUser) {
    socket.disconnect(true);
    return;
  }

  // Student joins exam session
  socket.on('exam_start', (data) => {
    const { studentId, examId, sessionId } = data;
    if (authenticatedUser.role !== 'student' || authenticatedUser.id !== studentId) {
      return socket.emit('error', 'Unauthorized exam start request');
    }

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

  socket.on('monitoring_join', (data) => {
    const { examId } = data;
    if (authenticatedUser.role !== 'organizer') {
      return socket.emit('error', 'Unauthorized monitoring join request');
    }

    socket.join(`monitoring_${examId}`);
    socket.emit('monitoring_joined', { examId });
    console.log(`Organizer joined monitoring room for exam ${examId}`);
  });

  // Log suspicious activity
  socket.on('log_violation', (data) => {
    const { sessionId, violationType, timestamp, details } = data;

    const session = activeStudents[sessionId];
    if (!session || authenticatedUser.role !== 'student' || authenticatedUser.id !== session.studentId) {
      return socket.emit('error', 'Unauthorized violation report');
    }

    session.violations++;
    session.lastViolation = violationType;
    session.lastViolationTime = timestamp;

    if (session.violations >= 3) {
      session.status = 'suspicious';
    } else if (session.violations >= 1) {
      session.status = 'warning';
    }

    db.logStudentActivity(sessionId, violationType, timestamp, JSON.stringify(details), (err) => {
      if (err) console.error('Failed to log violation:', err);
    });

    io.to(`monitoring_${session.examId}`).emit('violation_logged', {
      sessionId,
      violationType,
      timestamp,
      studentStatus: session
    });
  });

  // Update last activity
  socket.on('activity', (data) => {
    const { sessionId } = data;
    const session = activeStudents[sessionId];
    if (session && authenticatedUser.role === 'student' && authenticatedUser.id === session.studentId) {
      session.lastActivity = Date.now();
    }
  });

  // Student leaves exam
  socket.on('exam_end', (data) => {
    const { sessionId } = data;
    const session = activeStudents[sessionId];
    if (!session || authenticatedUser.role !== 'student' || authenticatedUser.id !== session.studentId) {
      return socket.emit('error', 'Unauthorized exam end request');
    }

    session.status = 'completed';
    io.to(`monitoring_${session.examId}`).emit('student_status_update', session);
  });

  socket.on('disconnect', () => {
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
    console.log('Initializing ProExam server...');

    // Initialize database
    console.log('Initializing database...');
    await db.initializeDatabase();
    console.log('Database initialized successfully');

    // Initialize notification templates
    console.log('Initializing notification templates...');
    notificationManager.initializeTemplates();
    console.log('Notification templates initialized');

    // Initialize backup system
    console.log('Initializing backup system...');
    await backupManager.initialize();
    console.log('Backup system initialized');

    backupManager.startScheduledBackups();
    console.log('Scheduled backups started');

    const PORT = process.env.PORT || 8000;
    console.log(`Starting server on port ${PORT}...`);

    server.listen(PORT, async () => {
      await logger.info('ProExam server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: '1.1.0'
      });

      console.log(`✅ ProExam server running on port ${PORT}`);
      console.log(`📊 Organizer: http://localhost:${PORT}/organizer/`);
      console.log(`🎓 Student: http://localhost:${PORT}/student/`);
      console.log(`🔐 Login: http://localhost:${PORT}/login.html`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
};

startServer();
