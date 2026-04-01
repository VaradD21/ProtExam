const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const getExamTimeState = (exam) => {
  const now = new Date();
  const start = exam.startTime ? new Date(exam.startTime) : (exam.start_date ? new Date(exam.start_date) : null);
  const end = exam.endTime ? new Date(exam.endTime) : (exam.end_date ? new Date(exam.end_date) : null);

  if (exam.is_active === false || exam.is_active === 0 || exam.status === 'inactive') {
    return 'inactive';
  }

  if (start && now < start) {
    return 'upcoming';
  }

  if (end && now > end) {
    return 'closed';
  }

  return 'ongoing';
};

const mapExamForStudent = (exam) => {
  const status = getExamTimeState(exam);

  return {
    ...exam,
    studentExamStatus: status,
    isOngoing: status === 'ongoing',
    isUpcoming: status === 'upcoming',
    isClosed: status === 'closed',
    isInactive: status === 'inactive'
  };
};

// Create exam (organizer only)
router.post('/', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const {
    title,
    description,
    duration,
    totalMarks,
    passingMarks,
    instructions,
    weightage,
    rules,
    shuffleQuestions,
    shuffleOptions,
    allowReview,
    showResultsImmediately,
    maxAttempts,
    startDate,
    endDate,
    accessCode
  } = req.body;
  const organizerId = req.user.id;

  if (!title || !duration || totalMarks === undefined || passingMarks === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const options = {
    weightage: weightage || 1.0,
    rules,
    shuffleQuestions: shuffleQuestions || false,
    shuffleOptions: shuffleOptions || false,
    allowReview: allowReview !== false,
    showResultsImmediately: showResultsImmediately || false,
    maxAttempts: maxAttempts || 1,
    startDate,
    endDate,
    accessCode
  };

  db.createExam(
    organizerId,
    title,
    description,
    duration,
    totalMarks,
    passingMarks,
    instructions,
    options,
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

// Get enrolled exams for student
router.get('/enrolled', authMiddleware, roleMiddleware(['student']), (req, res) => {
  const studentId = req.user.id;

  db.getEnrolledExams(studentId, (err, exams) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch enrolled exams' });
    }

    const mapped = (exams || [])
      .map(mapExamForStudent)
      .filter(exam => !exam.isInactive);

    res.json(mapped);
  });
});

// Get ongoing enrolled exams (student)
router.get('/enrolled/ongoing', authMiddleware, roleMiddleware(['student']), (req, res) => {
  const studentId = req.user.id;

  db.getEnrolledExams(studentId, (err, exams) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch ongoing exams' });
    }

    const ongoing = (exams || [])
      .map(mapExamForStudent)
      .filter(exam => exam.isOngoing);

    res.json(ongoing);
  });
});

// Get upcoming enrolled exams (student)
router.get('/enrolled/upcoming', authMiddleware, roleMiddleware(['student']), (req, res) => {
  const studentId = req.user.id;

  db.getEnrolledExams(studentId, (err, exams) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch upcoming exams' });
    }

    const upcoming = (exams || [])
      .map(mapExamForStudent)
      .filter(exam => exam.isUpcoming);

    res.json(upcoming);
  });
});

// Get exam details
router.get('/:examId', authMiddleware, (req, res) => {
  const { examId } = req.params;

  const sendExam = (exam) => {
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }
    res.json(exam);
  };

  if (req.user.role === 'student') {
    db.getEnrollment(examId, req.user.id, (enrollErr, enrollment) => {
      if (enrollErr) {
        return res.status(500).json({ error: 'Failed to verify enrollment' });
      }
      if (!enrollment) {
        return res.status(403).json({ error: 'You are not enrolled in this exam' });
      }
      db.getExamById(examId, (err, exam) => {
        if (err || !exam) {
          return res.status(404).json({ error: 'Exam not found' });
        }
        sendExam(exam);
      });
    });
  } else {
    db.getExamById(examId, (err, exam) => {
      if (err || !exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }
      sendExam(exam);
    });
  }
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

  const sendExamWithQuestions = (exam) => {
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
            const randomized = questions.sort(() => Math.random() - 0.5);
            res.json({ ...exam, questions: randomized });
          }
        });
      });

      if (questions.length === 0) {
        res.json({ ...exam, questions: [] });
      }
    });
  };

  if (req.user.role === 'student') {
    db.getEnrollment(examId, req.user.id, (enrollErr, enrollment) => {
      if (enrollErr) {
        return res.status(500).json({ error: 'Failed to verify enrollment' });
      }
      if (!enrollment) {
        return res.status(403).json({ error: 'You are not enrolled in this exam' });
      }
      db.getExamById(examId, (err, exam) => {
        if (err || !exam) {
          return res.status(404).json({ error: 'Exam not found' });
        }
        sendExamWithQuestions(exam);
      });
    });
  } else {
    db.getExamById(examId, (err, exam) => {
      if (err || !exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }
      sendExamWithQuestions(exam);
    });
  }
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
