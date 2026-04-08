const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Create question
router.post('/', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { examId, type, content, marks, orderNum } = req.body;

  if (!examId || !type || !content || marks === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (typeof marks !== 'number' || marks < 1) {
    return res.status(400).json({ error: 'Question marks must be a positive number' });
  }

  if (!['mcq', 'descriptive'].includes(type)) {
    return res.status(400).json({ error: 'Invalid question type' });
  }

  if (type === 'mcq') {
    if (!Array.isArray(req.body.options) || req.body.options.length < 2) {
      return res.status(400).json({ error: 'MCQ questions must include at least two options' });
    }
  }

  db.createQuestion(examId, type, content, marks, orderNum || 0, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to create question' });
    }

    const options = Array.isArray(req.body.options) ? req.body.options : [];

    if (type === 'mcq' && options.length > 0) {
      const optionPromises = options.map((option) => {
        return new Promise((resolve, reject) => {
          db.createQuestionOption(result.id, option.text, option.isCorrect || false, (optionErr) => {
            if (optionErr) {
              return reject(optionErr);
            }
            resolve();
          });
        });
      });

      Promise.all(optionPromises)
        .then(() => {
          res.status(201).json({ questionId: result.id, message: 'Question created successfully' });
        })
        .catch((optionError) => {
          res.status(500).json({ error: 'Failed to create question options' });
        });
    } else {
      res.status(201).json({ questionId: result.id, message: 'Question created successfully' });
    }
  });
});

// Get questions for exam
router.get('/exam/:examId', authMiddleware, (req, res) => {
  const { examId } = req.params;

  db.getQuestionsByExam(examId, (err, questions) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch questions' });
    }

    // Fetch options for each question
    let questionsProcessed = 0;
    const allQuestions = questions || [];

    if (allQuestions.length === 0) {
      return res.json([]);
    }

    allQuestions.forEach((question) => {
      if (question.type === 'mcq') {
        db.getQuestionOptions(question.id, (err, options) => {
          question.options = options || [];
          questionsProcessed++;

          if (questionsProcessed === allQuestions.length) {
            res.json(allQuestions);
          }
        });
      } else {
        questionsProcessed++;
        if (questionsProcessed === allQuestions.length) {
          res.json(allQuestions);
        }
      }
    });
  });
});

// Get question details
router.get('/:questionId', authMiddleware, (req, res) => {
  const { questionId } = req.params;

  db.getQuestionById(questionId, (err, question) => {
    if (err || !question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (question.type === 'mcq') {
      db.getQuestionOptions(questionId, (err, options) => {
        question.options = options || [];
        res.json(question);
      });
    } else {
      res.json(question);
    }
  });
});

// Delete question
router.delete('/:questionId', authMiddleware, roleMiddleware(['organizer']), (req, res) => {
  const { questionId } = req.params;

  db.deleteQuestion(questionId, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete question' });
    }
    res.json({ message: 'Question deleted successfully' });
  });
});

module.exports = router;
