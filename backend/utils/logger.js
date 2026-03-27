const fs = require('fs').promises;
const path = require('path');

// Create logs directory if it doesn't exist
const LOGS_DIR = path.join(__dirname, '../logs');
fs.mkdir(LOGS_DIR, { recursive: true }).catch(console.error);

class Logger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };

    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
  }

  shouldLog(level) {
    return this.logLevels[level] <= this.logLevels[this.currentLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    return JSON.stringify(logEntry);
  }

  async writeToFile(filename, content) {
    try {
      const filePath = path.join(LOGS_DIR, filename);
      await fs.appendFile(filePath, content + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  async log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}.log`;

    // Write to file
    await this.writeToFile(filename, formattedMessage);

    // Also log to console with appropriate level
    const consoleMethod = level === 'ERROR' ? 'error' :
                         level === 'WARN' ? 'warn' :
                         level === 'DEBUG' ? 'debug' : 'log';

    console[consoleMethod](`[${level}] ${message}`, meta);
  }

  async error(message, meta = {}) {
    await this.log('ERROR', message, meta);
  }

  async warn(message, meta = {}) {
    await this.log('WARN', message, meta);
  }

  async info(message, meta = {}) {
    await this.log('INFO', message, meta);
  }

  async debug(message, meta = {}) {
    await this.log('DEBUG', message, meta);
  }

  // Specialized logging methods
  async logAuth(action, userId, ip, success = true, details = {}) {
    await this.info(`Authentication ${action}`, {
      userId,
      ip,
      success,
      ...details,
      category: 'auth'
    });
  }

  async logExam(examId, studentId, action, details = {}) {
    await this.info(`Exam ${action}`, {
      examId,
      studentId,
      ...details,
      category: 'exam'
    });
  }

  async logViolation(violationType, examId, studentId, details = {}) {
    await this.warn(`Security violation: ${violationType}`, {
      violationType,
      examId,
      studentId,
      ...details,
      category: 'violation'
    });
  }

  async logPerformance(endpoint, method, duration, statusCode, userId = null) {
    await this.debug(`API Performance`, {
      endpoint,
      method,
      duration: `${duration}ms`,
      statusCode,
      userId,
      category: 'performance'
    });
  }
}

// Request logging middleware
const requestLogger = (logger) => {
  return (req, res, next) => {
    const start = Date.now();
    const { method, url, ip } = req;
    const userId = req.user ? req.user.id : null;

    // Log when request completes
    res.on('finish', async () => {
      const duration = Date.now() - start;
      await logger.logPerformance(url, method, duration, res.statusCode, userId);

      if (res.statusCode >= 400) {
        await logger.warn(`HTTP ${res.statusCode} for ${method} ${url}`, {
          ip,
          userId,
          statusCode: res.statusCode,
          category: 'http'
        });
      }
    });

    next();
  };
};

module.exports = {
  Logger,
  requestLogger
};