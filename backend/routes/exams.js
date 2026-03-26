const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Create exam (organizer only)
router.post('/', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { title, description, duration, totalMarks, passingMarks, instructions } = req.body;
  const organizerId = req.user.id;

  if (!title || !duration || totalMarks === undefined || passingMarks === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.createExam(
    organizerId,
    title,
    description,
    duration,
    totalMarks,
    passingMarks,
    instructions,
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to create exam' });
      }
      res.status(201).json({ examId: result.id, message: 'Exam created successfully' });
    }
  );
});

// Get all exams for organizer
router.get('/', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const organizerId = req.user.id;

  db.getExamsByOrganizer(organizerId, (err, exams) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch exams' });
    }
    res.json(exams || []);
  });
});

// Get exam details
router.get('/:examId', authMiddleware, (req, res) => {
  const { examId } = req.params;

  db.getExamById(examId, (err, exam) => {
    if (err || !exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    res.json(exam);
  });
});

// Update exam (organizer only)
router.put('/:examId', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { examId } = req.params;
  const updates = req.body;

  db.updateExam(examId, updates, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to update exam' });
    }
    res.json({ message: 'Exam updated successfully' });
  });
});

// Delete exam (organizer only)
router.delete('/:examId', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { examId } = req.params;

  db.deleteExam(examId, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete exam' });
    }
    res.json({ message: 'Exam deleted successfully' });
  });
});

// Get exam with questions and options (for student)
router.get('/:examId/full', authMiddleware, (req, res) => {
  const { examId } = req.params;

  db.getExamById(examId, (err, exam) => {
    if (err || !exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    db.getQuestionsByExam(examId, (err, questions) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch questions' });
      }

      // Fetch options for each question
      let questionsProcessed = 0;
      questions.forEach((question) => {
        db.getQuestionOptions(question.id, (err, options) => {
          question.options = options || [];
          questionsProcessed++;

          if (questionsProcessed === questions.length) {
            // Randomize question order
            const randomized = questions.sort(() => Math.random() - 0.5);
            res.json({ ...exam, questions: randomized });
          }
        });
      });

      if (questions.length === 0) {
        res.json({ ...exam, questions: [] });
      }
    });
  });
});

// Enroll student in exam
router.post('/:examId/enroll', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { examId } = req.params;
  const { studentId } = req.body;

  db.enrollStudent(examId, studentId, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to enroll student' });
    }
    res.json({ message: 'Student enrolled successfully' });
  });
});

// Get enrolled students
router.get('/:examId/students', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { examId } = req.params;

  db.getEnrolledStudents(examId, (err, students) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch students' });
    }
    res.json(students || []);
  });
});

module.exports = router;
