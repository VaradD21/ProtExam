const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Log activity
router.post('/activity', authMiddleware, (req, res) => {
  const { sessionId, eventType, timestamp, details } = req.body;

  db.logStudentActivity(sessionId, eventType, timestamp, JSON.stringify(details), (err) => {
    if (err) {
      console.error('Failed to log activity:', err);
      return res.status(500).json({ error: 'Failed to log activity' });
    }
    res.json({ message: 'Activity logged' });
  });
});

// Log violation
router.post('/violation', authMiddleware, (req, res) => {
  const { sessionId, violationType, timestamp, details, severity } = req.body;

  db.logViolation(sessionId, violationType, timestamp, JSON.stringify(details), severity || 'low', (err) => {
    if (err) {
      console.error('Failed to log violation:', err);
      return res.status(500).json({ error: 'Failed to log violation' });
    }
    res.json({ message: 'Violation logged' });
  });
});

// Get violations for exam
router.get('/exam/:examId/violations', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { examId } = req.params;

  db.getViolationsByExam(examId, (err, violations) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch violations' });
    }
    res.json(violations || []);
  });
});

// Get activity logs for session
router.get('/session/:sessionId/activity', authMiddleware, (req, res) => {
  const { sessionId } = req.params;

  db.getActivityLogs(sessionId, (err, logs) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch logs' });
    }
    res.json(logs || []);
  });
});

// Get violations for session
router.get('/session/:sessionId/violations', authMiddleware, (req, res) => {
  const { sessionId } = req.params;

  db.getViolationsBySession(sessionId, (err, violations) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch violations' });
    }
    res.json(violations || []);
  });
});

// Log camera snapshot for remote proctoring
router.post('/camera', authMiddleware, (req, res) => {
  const { sessionId, imageData, timestamp } = req.body;

  if (!sessionId || !imageData) {
    return res.status(400).json({ error: 'Missing sessionId or imageData' });
  }

  db.logCameraSnapshot(sessionId, imageData, timestamp || Date.now(), (err) => {
    if (err) {
      console.error('Failed to log camera snapshot:', err);
      return res.status(500).json({ error: 'Failed to log camera snapshot' });
    }
    res.json({ message: 'Camera snapshot logged' });
  });
});

// Get camera snapshots for a session (organizer only)
router.get('/session/:sessionId/camera', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { sessionId } = req.params;

  db.getCameraSnapshotsBySession(sessionId, (err, snapshots) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch camera snapshots' });
    }
    res.json(snapshots || []);
  });
});

module.exports = router;
