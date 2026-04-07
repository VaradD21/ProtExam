const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const dbGet = (fn, ...args) => new Promise((resolve, reject) => fn(...args, (err, result) => {
  if (err) return reject(err);
  resolve(result);
}));

const getSubmissionsBySession = (sessionId) => dbGet(db.getSubmissionsBySession, sessionId);
const getQuestionById = (questionId) => dbGet(db.getQuestionById, questionId);
const getQuestionOptions = (questionId) => dbGet(db.getQuestionOptions, questionId);
const gradeSubmission = (submissionId, marks, isAutoGraded, gradedBy, feedback) => new Promise((resolve, reject) => {
  db.gradeSubmission(submissionId, marks, isAutoGraded, gradedBy, feedback, (err) => (err ? reject(err) : resolve()));
});
const getSessionResults = (sessionId) => dbGet(db.getSessionResults, sessionId);

// Start exam session
router.post('/session/start', authMiddleware, roleMiddleware(['student']), (req, res) => {
  const { examId } = req.body;
  const studentId = req.user.id;

  db.getEnrollment(examId, studentId, (err, enrollment) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to verify enrollment' });
    }
    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled for this exam' });
    }

    db.getExamById(examId, (err, exam) => {
      if (err || !exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      const now = new Date();
      const start = exam.startDate ? new Date(exam.startDate) : (exam.start_date ? new Date(exam.start_date) : null);
      const end = exam.endDate ? new Date(exam.endDate) : (exam.end_date ? new Date(exam.end_date) : null);

      if (start && now < start) {
        return res.status(403).json({ error: 'Exam has not started yet' });
      }

      if (end && now > end) {
        return res.status(403).json({ error: 'Exam has already ended' });
      }

      const sessionId = `${studentId}_${examId}_${Date.now()}`;
      db.createExamSession(sessionId, examId, studentId, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to start exam' });
        }
        res.json({ sessionId, message: 'Exam session started' });
      });
    });
  });
});

// Submit answer
router.post('/answer', authMiddleware, roleMiddleware(['student']), (req, res) => {
  const { sessionId, questionId, answer, firstAnswerTime, lastAnswerTime, changeCount } = req.body;

  // Check if submission exists
  db.getSubmissionBySessionAndQuestion(sessionId, questionId, (err, submission) => {
    if (submission) {
      // Update existing submission
      db.updateSubmission(submission.id, answer, lastAnswerTime, changeCount, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update answer' });
        }
        res.json({ message: 'Answer updated', submissionId: submission.id });
      });
    } else {
      // Create new submission
      db.saveSubmission(sessionId, questionId, answer, firstAnswerTime, lastAnswerTime, changeCount, (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to save answer' });
        }
        res.json({ message: 'Answer saved', submissionId: result.id });
      });
    }
  });
});

// Get submissions for session
router.get('/session/:sessionId/submissions', authMiddleware, (req, res) => {
  const { sessionId } = req.params;

  db.getSubmissionsBySession(sessionId, (err, submissions) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }
    res.json(submissions || []);
  });
});

// End exam session and calculate results
router.post('/session/:sessionId/end', authMiddleware, roleMiddleware(['student']), async (req, res) => {
  const { sessionId } = req.params;
  const { totalViolations } = req.body;

  try {
    await dbGet(db.updateExamSession, sessionId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      totalViolations: totalViolations || 0
    });

    const submissions = await getSubmissionsBySession(sessionId);
    if (submissions && submissions.length > 0) {
      await Promise.all(submissions.map(async (submission) => {
        const question = await getQuestionById(submission.questionId);
        if (question && question.type === 'mcq') {
          const options = await getQuestionOptions(question.id);
          const correctOption = Array.isArray(options) ? options.find(o => o.isCorrect) : null;
          const isCorrect = correctOption ? submission.answer === correctOption.optionText : false;
          const marks = isCorrect ? question.marks : 0;
          await gradeSubmission(submission.id, marks, true, null, 'Auto-graded MCQ');
        }
      }));
    }

    const result = await getSessionResults(sessionId);
    res.json({
      message: 'Exam completed',
      results: result
    });
  } catch (err) {
    console.error('Failed to end session:', err);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Get exam results for session
router.get('/session/:sessionId/results', authMiddleware, (req, res) => {
  const { sessionId } = req.params;

  db.getSessionResults(sessionId, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch results' });
    }

    // Get submissions with details
    db.getSubmissionsBySession(sessionId, (err, submissions) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch submissions' });
      }

      res.json({
        session: result,
        submissions: submissions || []
      });
    });
  });
});

module.exports = router;
