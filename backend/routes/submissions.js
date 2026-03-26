const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Start exam session
router.post('/session/start', authMiddleware, roleMiddleware(['student']), (req, res) => {
  const { examId } = req.body;
  const studentId = req.user.id;
  const sessionId = `${studentId}_${examId}_${Date.now()}`;

  db.createExamSession(sessionId, examId, studentId, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to start exam' });
    }
    res.json({ sessionId, message: 'Exam session started' });
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
router.post('/session/:sessionId/end', authMiddleware, roleMiddleware(['student']), (req, res) => {
  const { sessionId } = req.params;
  const { totalViolations } = req.body;

  // Update session status
  db.updateExamSession(sessionId, {
    status: 'completed',
    endTime: new Date().toISOString(),
    totalViolations: totalViolations || 0
  }, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to end session' });
    }

    // Get all submissions and auto-grade MCQs
    db.getSubmissionsBySession(sessionId, (err, submissions) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch submissions' });
      }

      let submissionsGraded = 0;
      submissions.forEach((submission) => {
        // Get question details
        db.getQuestionById(submission.questionId, (err, question) => {
          if (question && question.type === 'mcq') {
            // Auto-grade MCQ
            db.getQuestionOptions(question.id, (err, options) => {
              const correctOption = options.find(o => o.isCorrect);
              const isCorrect = submission.answer === correctOption.optionText;
              const marks = isCorrect ? question.marks : 0;

              db.gradeSubmission(submission.id, marks, true, null, '', () => {
                submissionsGraded++;
              });
            });
          } else {
            submissionsGraded++;
          }
        });
      });

      // Get final results
      setTimeout(() => {
        db.getSessionResults(sessionId, (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to calculate results' });
          }
          res.json({
            message: 'Exam completed',
            results: result
          });
        });
      }, 1000);
    });
  });
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
