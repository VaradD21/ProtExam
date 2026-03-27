// Advanced analytics and reporting system
class AnalyticsManager {
  constructor(db) {
    this.db = db;
    this.metrics = new Map();
    this.reports = new Map();
  }

  // Record exam metrics
  async recordExamMetrics(examId, metrics) {
    const {
      totalStudents,
      completedStudents,
      averageScore,
      averageTime,
      passRate,
      questionStats = []
    } = metrics;

    const sql = `
      INSERT OR REPLACE INTO exam_analytics
      (exam_id, total_students, completed_students, average_score, average_completion_time, pass_rate, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      examId,
      totalStudents,
      completedStudents,
      averageScore,
      averageTime,
      passRate,
      new Date().toISOString()
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Record question analytics
  async recordQuestionMetrics(questionId, examId, stats) {
    const {
      timesAnswered,
      timesCorrect,
      averageTime,
      difficultyRating,
      discriminationIndex
    } = stats;

    const sql = `
      INSERT OR REPLACE INTO question_analytics
      (question_id, exam_id, times_answered, times_correct, average_time_taken, difficulty_rating, discrimination_index, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      questionId,
      examId,
      timesAnswered,
      timesCorrect,
      averageTime,
      difficultyRating,
      discriminationIndex,
      new Date().toISOString()
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Record performance metrics
  async recordPerformanceMetrics(endpoint, method, responseTime, statusCode, userId) {
    const sql = `
      INSERT INTO performance_logs
      (endpoint, method, response_time, status_code, user_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      endpoint,
      method,
      responseTime,
      statusCode,
      userId,
      new Date().toISOString()
    ];

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Get exam analytics
  async getExamAnalytics(examId) {
    const sql = `
      SELECT * FROM exam_analytics
      WHERE exam_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [examId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Get question analytics
  async getQuestionAnalytics(examId) {
    const sql = `
      SELECT qa.*, q.question_text, q.question_type
      FROM question_analytics qa
      JOIN questions q ON qa.question_id = q.id
      WHERE qa.exam_id = ?
      ORDER BY qa.difficulty_rating DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [examId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Get performance analytics
  async getPerformanceAnalytics(timeRange = '24 hours') {
    const timeFilter = this.getTimeFilter(timeRange);
    const sql = `
      SELECT
        endpoint,
        method,
        AVG(response_time) as avg_response_time,
        MIN(response_time) as min_response_time,
        MAX(response_time) as max_response_time,
        COUNT(*) as request_count,
        SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
      FROM performance_logs
      WHERE timestamp >= ?
      GROUP BY endpoint, method
      ORDER BY avg_response_time DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [timeFilter], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Get time filter for queries
  getTimeFilter(timeRange) {
    const now = new Date();
    let hours = 24;

    switch (timeRange) {
      case '1 hour':
        hours = 1;
        break;
      case '24 hours':
        hours = 24;
        break;
      case '7 days':
        hours = 24 * 7;
        break;
      case '30 days':
        hours = 24 * 30;
        break;
    }

    now.setHours(now.getHours() - hours);
    return now.toISOString();
  }

  // Generate comprehensive report
  async generateExamReport(examId) {
    const [examAnalytics, questionAnalytics, studentResults] = await Promise.all([
      this.getExamAnalytics(examId),
      this.getQuestionAnalytics(examId),
      this.getStudentResults(examId)
    ]);

    const report = {
      examId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalStudents: examAnalytics?.total_students || 0,
        completedStudents: examAnalytics?.completed_students || 0,
        averageScore: examAnalytics?.average_score || 0,
        passRate: examAnalytics?.pass_rate || 0,
        averageCompletionTime: examAnalytics?.average_completion_time || 0
      },
      questionAnalysis: questionAnalytics.map(q => ({
        questionId: q.question_id,
        questionText: q.question_text,
        type: q.question_type,
        timesAnswered: q.times_answered,
        timesCorrect: q.times_correct,
        accuracy: q.times_answered > 0 ? (q.times_correct / q.times_answered) * 100 : 0,
        averageTime: q.average_time_taken,
        difficulty: q.difficulty_rating,
        discrimination: q.discrimination_index
      })),
      studentPerformance: studentResults,
      insights: this.generateInsights(examAnalytics, questionAnalytics, studentResults)
    };

    this.reports.set(`exam_${examId}_${Date.now()}`, report);
    return report;
  }

  // Get student results for an exam
  async getStudentResults(examId) {
    const sql = `
      SELECT
        r.student_id,
        u.full_name as student_name,
        r.total_score,
        r.max_score,
        r.percentage,
        r.passed,
        r.completed_at,
        COUNT(v.id) as violation_count
      FROM results r
      JOIN users u ON r.student_id = u.id
      LEFT JOIN violation_logs v ON v.student_id = r.student_id
        AND v.session_id IN (SELECT id FROM exam_sessions WHERE exam_id = r.exam_id)
      WHERE r.exam_id = ?
      GROUP BY r.student_id, r.id
      ORDER BY r.percentage DESC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [examId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Generate insights from data
  generateInsights(examAnalytics, questionAnalytics, studentResults) {
    const insights = [];

    if (examAnalytics) {
      const passRate = examAnalytics.pass_rate;
      if (passRate < 50) {
        insights.push({
          type: 'warning',
          title: 'Low Pass Rate',
          description: `Only ${passRate}% of students passed. Consider reviewing exam difficulty.`
        });
      } else if (passRate > 90) {
        insights.push({
          type: 'info',
          title: 'High Pass Rate',
          description: `Exam appears to be appropriately difficult with ${passRate}% pass rate.`
        });
      }
    }

    // Question difficulty insights
    const hardQuestions = questionAnalytics.filter(q => q.difficulty_rating > 0.8);
    if (hardQuestions.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Difficult Questions',
        description: `${hardQuestions.length} questions have high difficulty ratings. Consider review.`
      });
    }

    // Time analysis
    const avgTime = examAnalytics?.average_completion_time;
    if (avgTime) {
      const expectedTime = 60; // Assume 60 minutes expected
      if (avgTime < expectedTime * 0.5) {
        insights.push({
          type: 'info',
          title: 'Fast Completion',
          description: 'Students completed exam much faster than expected time.'
        });
      }
    }

    // Performance distribution
    if (studentResults.length > 0) {
      const scores = studentResults.map(s => s.percentage);
      const variance = this.calculateVariance(scores);

      if (variance < 100) {
        insights.push({
          type: 'info',
          title: 'Consistent Performance',
          description: 'Student scores show low variance, indicating consistent difficulty.'
        });
      } else if (variance > 500) {
        insights.push({
          type: 'warning',
          title: 'Wide Score Distribution',
          description: 'Large variance in scores suggests inconsistent question difficulty.'
        });
      }
    }

    return insights;
  }

  // Calculate variance
  calculateVariance(scores) {
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
    return variance;
  }

  // Get dashboard overview
  async getDashboardOverview() {
    const overview = {
      totalExams: 0,
      activeExams: 0,
      totalStudents: 0,
      totalViolations: 0,
      systemHealth: 'good',
      recentActivity: [],
      topPerformingExams: [],
      alerts: []
    };

    // Get exam counts
    const examSql = `SELECT COUNT(*) as count FROM exams WHERE is_active = 1`;
    const activeExamSql = `
      SELECT COUNT(DISTINCT e.id) as count
      FROM exams e
      JOIN exam_sessions es ON e.id = es.exam_id
      WHERE es.status = 'active'
    `;

    const [examResult, activeResult] = await Promise.all([
      this.querySingle(examSql),
      this.querySingle(activeExamSql)
    ]);

    overview.totalExams = examResult.count;
    overview.activeExams = activeResult.count;

    // Get student and violation counts
    const studentSql = `SELECT COUNT(*) as count FROM users WHERE role = 'student'`;
    const violationSql = `SELECT COUNT(*) as count FROM violation_logs WHERE timestamp >= ?`;
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [studentResult, violationResult] = await Promise.all([
      this.querySingle(studentSql),
      this.querySingle(violationSql, [lastWeek])
    ]);

    overview.totalStudents = studentResult.count;
    overview.totalViolations = violationResult.count;

    // Generate alerts based on data
    if (overview.totalViolations > 100) {
      overview.alerts.push({
        type: 'warning',
        message: 'High number of violations detected this week'
      });
    }

    if (overview.activeExams === 0) {
      overview.alerts.push({
        type: 'info',
        message: 'No active exams currently running'
      });
    }

    return overview;
  }

  // Helper method for single queries
  querySingle(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Export data for external analysis
  async exportAnalyticsData(examId, format = 'json') {
    const report = await this.generateExamReport(examId);

    if (format === 'csv') {
      return this.convertToCSV(report);
    }

    return report;
  }

  // Convert report to CSV
  convertToCSV(report) {
    let csv = 'Section,Metric,Value\n';

    // Summary
    csv += `Summary,Total Students,${report.summary.totalStudents}\n`;
    csv += `Summary,Completed Students,${report.summary.completedStudents}\n`;
    csv += `Summary,Average Score,${report.summary.averageScore}\n`;
    csv += `Summary,Pass Rate,${report.summary.passRate}\n`;

    // Questions
    report.questionAnalysis.forEach((q, index) => {
      csv += `Question ${index + 1},Text,"${q.questionText.replace(/"/g, '""')}"\n`;
      csv += `Question ${index + 1},Accuracy,${q.accuracy}\n`;
      csv += `Question ${index + 1},Difficulty,${q.difficulty}\n`;
    });

    return csv;
  }
}

module.exports = AnalyticsManager;