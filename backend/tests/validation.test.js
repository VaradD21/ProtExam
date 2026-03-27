const { validateAndSanitize, validateEmail, validatePassword, validateExamData, validateQuestionData } = require('../middleware/validation');

describe('Validation Middleware', () => {
  describe('validateAndSanitize', () => {
    test('should sanitize string inputs', () => {
      const req = {
        body: { name: '<script>alert("xss")</script>' },
        query: { search: 'test<script>' },
        params: { id: '123<script>' }
      };

      validateAndSanitize(req, {}, () => {});

      expect(req.body.name).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(req.query.search).toBe('test&lt;script&gt;');
      expect(req.params.id).toBe('123&lt;script&gt;');
    });

    test('should handle non-string inputs', () => {
      const req = {
        body: { count: 123, active: true }
      };

      validateAndSanitize(req, {}, () => {});

      expect(req.body.count).toBe(123);
      expect(req.body.active).toBe(true);
    });
  });

  describe('validateEmail', () => {
    test('should validate correct emails', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('should validate strong passwords', () => {
      expect(validatePassword('StrongPass123!')).toBe(true);
      expect(validatePassword('MySecure9')).toBe(true);
    });

    test('should reject weak passwords', () => {
      expect(validatePassword('weak')).toBe(false);
      expect(validatePassword('12345678')).toBe(false);
      expect(validatePassword('Password')).toBe(false);
      expect(validatePassword('pass123')).toBe(false);
    });
  });

  describe('validateExamData', () => {
    test('should validate correct exam data', () => {
      const examData = {
        title: 'Test Exam',
        duration: 60,
        questions: [{ id: 1 }, { id: 2 }]
      };

      const errors = validateExamData(examData);
      expect(errors).toHaveLength(0);
    });

    test('should reject invalid exam data', () => {
      const invalidExam = {
        title: 'Hi', // Too short
        duration: 1, // Too short
        questions: [] // No questions
      };

      const errors = validateExamData(invalidExam);
      expect(errors).toContain('Exam title must be at least 3 characters long');
      expect(errors).toContain('Exam duration must be at least 5 minutes');
      expect(errors).toContain('Exam must have at least one question');
    });
  });

  describe('validateQuestionData', () => {
    test('should validate MCQ question', () => {
      const questionData = {
        question_text: 'What is 2+2?',
        type: 'mcq',
        options: ['3', '4', '5'],
        correct_answer: '4',
        points: 5
      };

      const errors = validateQuestionData(questionData);
      expect(errors).toHaveLength(0);
    });

    test('should validate descriptive question', () => {
      const questionData = {
        question_text: 'Explain photosynthesis in detail',
        type: 'descriptive',
        points: 10
      };

      const errors = validateQuestionData(questionData);
      expect(errors).toHaveLength(0);
    });

    test('should reject invalid question data', () => {
      const invalidQuestion = {
        question_text: 'Hi', // Too short
        type: 'invalid', // Invalid type
        points: 0 // Invalid points
      };

      const errors = validateQuestionData(invalidQuestion);
      expect(errors).toContain('Question text must be at least 10 characters long');
      expect(errors).toContain('Question type must be either mcq or descriptive');
      expect(errors).toContain('Question must be worth at least 1 point');
    });
  });
});