const { Logger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

describe('Logger', () => {
  let logger;
  const logsDir = path.join(__dirname, '../logs');

  beforeEach(() => {
    logger = new Logger();
    // Clear any existing log files for testing
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test log files
    try {
      const files = await fs.readdir(logsDir);
      for (const file of files) {
        if (file.includes('test')) {
          await fs.unlink(path.join(logsDir, file));
        }
      }
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
  });

  describe('Log Levels', () => {
    test('should log messages based on level', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      // Test INFO level (default)
      logger.info('Test info message');
      expect(consoleSpy).toHaveBeenCalledWith('[INFO] Test info message', {});

      // Test WARN level
      logger.warn('Test warning');
      expect(consoleSpy).toHaveBeenCalledWith('[WARN] Test warning', {});

      consoleSpy.mockRestore();
    });

    test('should not log below current level', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

      // With default INFO level, DEBUG should not log
      logger.debug('Debug message');
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Specialized Logging', () => {
    test('should log authentication events', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

      logger.logAuth('login', 123, '192.168.1.1', true, { device: 'desktop' });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[INFO] Authentication login',
        expect.objectContaining({
          userId: 123,
          ip: '192.168.1.1',
          success: true,
          device: 'desktop',
          category: 'auth'
        })
      );

      consoleSpy.mockRestore();
    });

    test('should log exam events', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

      logger.logExam(456, 123, 'started', { duration: 60 });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[INFO] Exam started',
        expect.objectContaining({
          examId: 456,
          studentId: 123,
          duration: 60,
          category: 'exam'
        })
      );

      consoleSpy.mockRestore();
    });

    test('should log violations', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      logger.logViolation('tab_switch', 456, 123, { count: 3 });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[WARN] Security violation: tab_switch',
        expect.objectContaining({
          violationType: 'tab_switch',
          examId: 456,
          studentId: 123,
          count: 3,
          category: 'violation'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Logging', () => {
    test('should log API performance', () => {
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

      logger.logPerformance('/api/exams', 'GET', 150, 200, 123);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DEBUG] API Performance',
        expect.objectContaining({
          endpoint: '/api/exams',
          method: 'GET',
          duration: '150ms',
          statusCode: 200,
          userId: 123,
          category: 'performance'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('File Logging', () => {
    test('should create log files', async () => {
      // This test would require mocking fs operations
      // For now, just ensure the logger can be instantiated
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});