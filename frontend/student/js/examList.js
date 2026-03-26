// Student Exam List
// Display available exams for student to take

class StudentExamList {
  constructor() {
    this.exams = [];
    this.sessions = [];

    this.init();
  }

  async init() {
    if (!checkAuth()) return;

    const user = getUser();
    console.log('Student user:', user);

    this.setupEventListeners();
    await this.loadAvailableExams();
  }

  setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        clearAuth();
        window.location.href = '/login.html';
      }
    });
  }

  async loadAvailableExams() {
    try {
      // Get all exams (in production, would filter by enrollment)
      const exams = await apiCall('/exams');
      this.exams = exams;

      this.renderExams();
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  }

  renderExams() {
    const container = document.getElementById('examsList');
    container.innerHTML = '';

    if (this.exams.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No exams available</h3><p>Check back later for available exams</p></div>';
      return;
    }

    this.exams.forEach(exam => {
      const card = document.createElement('div');
      card.className = 'exam-card';

      const isScheduled = exam.startTime && new Date(exam.startTime) > new Date();
      const isPast = exam.endTime && new Date(exam.endTime) < new Date();

      let buttonText = 'Start Exam';
      let isDisabled = false;

      if (isScheduled) {
        buttonText = 'Exam Not Started';
        isDisabled = true;
      } else if (isPast) {
        buttonText = 'Exam Closed';
        isDisabled = true;
      }

      card.innerHTML = `
        <h3>${exam.title}</h3>
        <p class="exam-description">${exam.description || 'No description'}</p>
        
        <div class="exam-details">
          <div class="detail-item">
            <span class="detail-label">Duration</span>
            ${exam.duration} minutes
          </div>
          <div class="detail-item">
            <span class="detail-label">Total Marks</span>
            ${exam.totalMarks}
          </div>
          <div class="detail-item">
            <span class="detail-label">Passing Marks</span>
            ${exam.passingMarks}
          </div>
          <div class="detail-item">
            <span class="detail-label">Status</span>
            ${exam.status}
          </div>
        </div>

        <button class="btn-start" ${isDisabled ? 'disabled' : ''} onclick="studentExamList.startExam(${exam.id})">
          ${buttonText}
        </button>
      `;

      container.appendChild(card);
    });
  }

  async startExam(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    // Confirm starting exam
    if (!confirm(`Start "${exam.title}"? This exam requires fullscreen mode and has strict anti-cheating measures.`)) {
      return;
    }

    // Redirect to exam interface
    window.location.href = `/student/index.html?examId=${examId}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const studentExamList = new StudentExamList();
  window.studentExamList = studentExamList;
});
