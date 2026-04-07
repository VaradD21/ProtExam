const validator = require('validator');

// Input validation and sanitization middleware
const validateAndSanitize = (req, res, next) => {
  // Sanitize string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    let value = str.trim();
    value = validator.stripLow(value, true);
    value = validator.blacklist(value, '\0');
    return value;
  };

  // Recursively sanitize object properties
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    }
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize route parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Specific validation functions
const validateEmail = (email) => {
  return validator.isEmail(email);
};

const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validateExamData = (examData) => {
  const errors = [];

  if (!examData.title || examData.title.length < 3) {
    errors.push('Exam title must be at least 3 characters long');
  }

  if (!examData.duration || examData.duration < 5) {
    errors.push('Exam duration must be at least 5 minutes');
  }

  if (!examData.questions || !Array.isArray(examData.questions) || examData.questions.length === 0) {
    errors.push('Exam must have at least one question');
  }

  return errors;
};

const validateQuestionData = (questionData) => {
  const errors = [];

  if (!questionData.question || questionData.question.length < 10) {
    errors.push('Question text must be at least 10 characters long');
  }

  if (!['mcq', 'descriptive'].includes(questionData.type)) {
    errors.push('Question type must be either mcq or descriptive');
  }

  if (questionData.type === 'mcq') {
    if (!questionData.options || !Array.isArray(questionData.options) || questionData.options.length < 2) {
      errors.push('MCQ questions must have at least 2 options');
    }

    if (!questionData.correctAnswer || !questionData.options.includes(questionData.correctAnswer)) {
      errors.push('Correct answer must be one of the provided options');
    }
  }

  if (!questionData.points || questionData.points < 1) {
    errors.push('Question must be worth at least 1 point');
  }

  return errors;
};

module.exports = {
  validateAndSanitize,
  validateEmail,
  validatePassword,
  validateExamData,
  validateQuestionData
};