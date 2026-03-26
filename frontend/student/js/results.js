// Student Results Page
// Display exam results, violations, and activity logs

class ResultsPage {
  constructor() {
    this.sessionId = null;
    this.exam = null;
    this.results = null;
    this.submissions = [];
    this.activities = [];
    this.violations = [];

    this.init();
  }

  async init() {
    if (!checkAuth()) return;

    // Get session ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.sessionId = urlParams.get('sessionId');

    if (!this.sessionId) {
      alert('No results found');
      window.location.href = '/student/examList.html';
      return;
    }

    this.setupEventListeners();
    await this.loadResults();
    await this.loadActivityLogs();
    await this.loadViolations();
  }

  setupEventListeners() {
    document.getElementById('homeBtn').addEventListener('click', () => {
      window.location.href = '/student/examList.html';
    });
  }

  async loadResults() {
    try {
      const response = await apiCall(`/submissions/session/${this.sessionId}/results`);
      this.results = response.session;
      this.submissions = response.submissions || [];

      console.log('Results:', this.results);
      console.log('Submissions:', this.submissions);

      this.renderResults();
    } catch (err) {
      console.error('Failed to load results:', err);
      alert('Failed to load results: ' + err.message);
    }
  }

  renderResults() {
    if (!this.results) return;

    // Update header
    document.getElementById('examTitle').textContent = 'Exam Results';

    // Calculate total score
    const totalMarks = this.submissions.reduce((sum, s) => sum + (s.marks || 0), 0);
    const maxMarks = this.submissions.length * 1; // Placeholder

    document.getElementById('totalScore').textContent = totalMarks;
    document.getElementById('maxMarks').textContent = this.results.totalMarks || 100;

    const percentage = this.results.totalMarks ? Math.round((totalMarks / this.results.totalMarks) * 100) : 0;
    document.getElementById('percentage').textContent = percentage + '%';

    // Determine pass/fail
    const isPass = totalMarks >= (this.results.totalMarks ? this.results.totalMarks * 0.4 : 40);
    document.getElementById('passStatus').textContent = isPass ? '✓ PASSED' : '✗ FAILED';
    document.getElementById('passStatus').className = isPass ? 'value passed' : 'value failed';

    // Violations
    document.getElementById('violationCount').textContent = this.results.totalViolations || 0;

    // Render question results
    this.renderQuestionResults();
  }

  renderQuestionResults() {
    const container = document.getElementById('questionResults');
    container.innerHTML = '';

    this.submissions.forEach((submission, index) => {
      const result = document.createElement('div');
      result.className = 'question-result';

      let statusClass = 'unanswered';
      let statusIcon = '❓';

      if (!submission.answer) {
        statusClass = 'unanswered';
        statusIcon = '❓';
      } else if (submission.isAutoGraded || submission.isManuallyGraded) {
        if (submission.marks > 0) {
          statusClass = 'correct';
          statusIcon = '✓';
        } else {
          statusClass = 'incorrect';
          statusIcon = '✗';
        }
      } else {
        statusClass = 'unanswered';
        statusIcon = '⏳';
      }

      result.classList.add(statusClass);

      const timeSpent = submission.lastAnswerTime - submission.firstAnswerTime;
      const timeSpentStr = this.formatTime(timeSpent);

      result.innerHTML = `
        <div class="result-title">
          <span>Question ${index + 1}</span>
          <span class="result-icon">${statusIcon} ${submission.marks || 0} marks</span>
        </div>
        <div class="result-content">
          <p><strong>Status:</strong> ${this.getStatusText(statusClass)}</p>
          <p><strong>Time Spent:</strong> ${timeSpentStr}</p>
          <p><strong>Changes Made:</strong> ${submission.changeCount || 0}</p>
          
          ${submission.answer ? `
            <div class="result-answer">
              <div class="result-label">Your Answer:</div>
              <p>${submission.answer.substring(0, 100)}${submission.answer.length > 100 ? '...' : ''}</p>
            </div>
          ` : '<div class="result-answer"><p style="color: #999;">No answer provided</p></div>'}
          
          ${submission.feedback ? `
            <div class="result-answer">
              <div class="result-label">Feedback:</div>
              <p>${submission.feedback}</p>
            </div>
          ` : ''}
        </div>
      `;

      container.appendChild(result);
    });
  }

  getStatusText(statusClass) {
    const statusMap = {
      'correct': 'Correct',
      'incorrect': 'Incorrect',
      'unanswered': 'Not Answered'
    };
    return statusMap[statusClass] || 'Unknown';
  }

  formatTime(ms) {
    if (!ms) return '0 seconds';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  async loadActivityLogs() {
    try {
      const logs = await apiCall(`/logs/session/${this.sessionId}/activity`);
      this.activities = logs || [];
      this.renderActivityLogs();
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    }
  }

  renderActivityLogs() {
    const container = document.getElementById('activityList');
    container.innerHTML = '';

    if (this.activities.length === 0) {
      container.innerHTML = '<p class="empty-message">No activity recorded</p>';
      return;
    }

    this.activities.forEach(log => {
      const item = document.createElement('div');
      item.className = 'activity-item';

      const time = new Date(log.timestamp).toLocaleTimeString();
      const eventLabel = log.eventType.replace(/_/g, ' ').toUpperCase();

      item.innerHTML = `
        <div><strong>${eventLabel}</strong></div>
        <div class="activity-time">${time}</div>
      `;

      container.appendChild(item);
    });
  }

  async loadViolations() {
    try {
      const violations = await apiCall(`/logs/session/${this.sessionId}/violations`);
      this.violations = violations || [];
      this.renderViolations();
    } catch (err) {
      console.error('Failed to load violations:', err);
    }
  }

  renderViolations() {
    const container = document.getElementById('violationsList');
    container.innerHTML = '';

    if (this.violations.length === 0) {
      container.innerHTML = '<p class="empty-message">No violations recorded. Great job maintaining academic integrity!</p>';
      return;
    }

    this.violations.forEach(violation => {
      const item = document.createElement('div');
      item.className = 'violation-item';

      const time = new Date(violation.timestamp).toLocaleTimeString();
      const violationType = violation.violationType.replace(/_/g, ' ').toUpperCase();
      const severity = violation.severity || 'low';
      const severityIcon = {
        'high': '🔴',
        'medium': '🟠',
        'low': '🟡'
      }[severity] || '⚪';

      item.innerHTML = `
        <div><strong>${severityIcon} ${violationType}</strong></div>
        <div>Severity: ${severity}</div>
        <div class="violation-time">${time}</div>
      `;

      container.appendChild(item);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ResultsPage();
});
