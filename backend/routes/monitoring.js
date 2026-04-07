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

    const monitoredStudents = (students || []).map((student) => ({
      id: student.id,
      email: student.email,
      fullName: student.fullName,
      status: 'enrolled'
    }));

    res.json(monitoredStudents);
  });
});

module.exports = router;
