const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware } = require('../middleware/auth');

// Apply authentication middleware to all monitoring routes
router.use(authMiddleware);

// Get live monitoring data for exam
router.get('/exam/:examId', (req, res) => {
  const { examId } = req.params;

  db.getEnrolledStudents(examId, (err, students) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch students' });
    }

    // For each student, get their session data
    let studentsProcessed = 0;
    const enrichedStudents = [];

    students.forEach((student) => {
      // Get latest session for this student
      // Note: In production, you'd have a query that gets the latest session
      db.getViolationsBySession = (sessionId, callback) => {
        // This would need a proper query in production
        callback(null, []);
      };
      studentsProcessed++;
    });

    if (students.length === 0) {
      return res.json([]);
    }

    res.json(enrichedStudents);
  });
});

module.exports = router;
