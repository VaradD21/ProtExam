// Student Exam List
// Display available exams for student to take

class StudentExamList {
  constructor() {
    this.exams = [];
    this.sessions = [];
    this.selectedExam = null;
    this.cameraStream = null;

    this.init();
  }

  async init() {
    // Show loading state
    this.showLoadingState();

    if (!checkAuth()) return;

    const user = getUser();
    if (user.role !== 'student') {
      alert('Access denied. Only students can access this page.');
      clearAuth();
      window.location.href = '/login.html';
      return;
    }

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

    // Add click handlers for quick actions
    document.querySelectorAll('.action-card').forEach((card, index) => {
      card.addEventListener('click', () => this.handleQuickAction(index));
    });
  }

  showLoadingState() {
    const container = document.getElementById('examsList');
    container.innerHTML = `
      <div class="loading-card">
        <div class="loading-skeleton">
          <div class="skeleton-header"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
          <div class="skeleton-details"></div>
          <div class="skeleton-button"></div>
        </div>
      </div>
      <div class="loading-card">
        <div class="loading-skeleton">
          <div class="skeleton-header"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
          <div class="skeleton-details"></div>
          <div class="skeleton-button"></div>
        </div>
      </div>
      <div class="loading-card">
        <div class="loading-skeleton">
          <div class="skeleton-header"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
          <div class="skeleton-details"></div>
          <div class="skeleton-button"></div>
        </div>
      </div>
    `;
  }

  handleQuickAction(index) {
    switch(index) {
      case 0: // View Results
        this.showCompletedExams();
        break;
      case 1: // Schedule
        this.scrollToExams();
        break;
      case 2: // Support
        alert('Support feature coming soon! Contact your administrator for help.');
        break;
    }
  }

  showCompletedExams() {
    const completedSection = document.getElementById('completedSection');
    if (completedSection) {
      completedSection.style.display = 'block';
      completedSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  scrollToExams() {
    const examsSection = document.querySelector('.exams-section');
    if (examsSection) {
      examsSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async loadAvailableExams() {
    try {
      // Get enrolled exams for the student
      const exams = await apiCall('/exams/enrolled');
      this.exams = Array.isArray(exams) ? exams : [];

      this.renderDashboardInfo();
      this.renderExams();
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  }

  getExamStatus(exam) {
    const now = new Date();
    const startTime = exam.startTime ? new Date(exam.startTime) : (exam.start_date ? new Date(exam.start_date) : null);
    const endTime = exam.endTime ? new Date(exam.endTime) : (exam.end_date ? new Date(exam.end_date) : null);

    if (exam.is_active === false || exam.is_active === 0 || exam.status === 'inactive') {
      return { label: 'Inactive', isDisabled: true, state: 'inactive' };
    }

    if (startTime && startTime > now) {
      return {
        label: `Starts at ${this.formatDateTime(startTime)}`,
        isDisabled: true,
        state: 'upcoming',
        startTime
      };
    }

    if (endTime && endTime < now) {
      return { label: 'Closed', isDisabled: true, state: 'closed', endTime };
    }

    return { label: 'Active', isDisabled: false, state: 'ongoing', startTime, endTime };
  }

  formatDateTime(date) {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getCountdownText(targetDate) {
    if (!targetDate) return '';
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) return '';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `Starts in ${days}d ${hours}h`;
    } else if (hours > 0) {
      return `Starts in ${hours}h ${minutes}m`;
    } else {
      return `Starts in ${minutes}m`;
    }
  }

  renderDashboardInfo() {
    const welcomeEl = document.getElementById('welcomeMessage');
    const statsEl = document.getElementById('dashboardStats');
    const user = getUser();

    if (welcomeEl && user) {
      welcomeEl.textContent = `Welcome, ${user.fullName || user.email || 'Student'}!`;
    }

    const now = new Date();
    let activeCount = 0;
    let scheduledCount = 0;
    let closedCount = 0;
    let inactiveCount = 0;

    this.exams.forEach(exam => {
      const status = this.getExamStatus(exam).state;
      if (status === 'upcoming') scheduledCount += 1;
      else if (status === 'closed') closedCount += 1;
      else if (status === 'ongoing') activeCount += 1;
      else inactiveCount += 1;
    });

    if (statsEl) {
      statsEl.innerHTML = `
        <span>Active: ${activeCount}</span>
        <span>Upcoming: ${scheduledCount}</span>
        <span>Completed/Closed: ${closedCount}</span>
        <span>Inactive: ${inactiveCount}</span>
      `;
    }

    const examsSection = document.querySelector('.exams-section h2');
    if (examsSection) {
      examsSection.textContent = `Available Exams (${this.exams.length})`;
    }
  }

  renderExams() {
    const container = document.getElementById('examsList');
    container.innerHTML = '';

    if (this.exams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
          <h3>No exams available</h3>
          <p>Check back later for available exams or contact your instructor</p>
        </div>
      `;
      return;
    }

    this.exams.forEach((exam, index) => {
      const card = document.createElement('div');
      card.className = 'exam-card';
      card.style.setProperty('--card-index', index);

      const duration = exam.duration || exam.duration_minutes || 0;
      const totalMarks = exam.totalMarks || exam.total_questions || exam.total_marks || 'N/A';
      const passingMarks = exam.passingMarks || exam.passing_score || exam.passing_score || 'N/A';

      const statusInfo = this.getExamStatus(exam);
      const buttonText = statusInfo.isDisabled ? (statusInfo.label || 'Unavailable') : 'Start Exam 🚀';
      const statusLabel = statusInfo.label || (exam.status || 'Unknown');

      const startDateRaw = exam.startTime || exam.start_date;
      const endDateRaw = exam.endTime || exam.end_date;
      const startDate = startDateRaw ? this.formatDateTime(new Date(startDateRaw)) : 'Not set';
      const endDate = endDateRaw ? this.formatDateTime(new Date(endDateRaw)) : 'Not set';

      const statusBadgeClass = `exam-status-badge ${statusInfo.state || 'inactive'}`;
      const cardClass = `exam-card ${statusInfo.state || 'inactive'}`;

      card.className = cardClass;

      const countdownText = statusInfo.state === 'upcoming' && startDateRaw ?
        this.getCountdownText(new Date(startDateRaw)) : '';

      const examIcon = this.getExamIcon(exam);
      const difficultyColor = this.getDifficultyColor(exam);

      card.innerHTML = `
        <div class="exam-header">
          <div class="exam-icon" style="background: ${difficultyColor}">${examIcon}</div>
          <div class="exam-meta">
            <h3>
              ${exam.title || 'Unnamed Exam'}
              <span class="${statusBadgeClass}">${statusInfo.state || 'unknown'}</span>
            </h3>
            <div class="exam-meta-info">
              <span class="meta-item">📚 ${exam.subject || 'General'}</span>
              <span class="meta-item">⏱️ ${duration} min</span>
              <span class="meta-item">🎯 ${totalMarks} marks</span>
            </div>
          </div>
        </div>

        <p class="exam-description">${exam.description || 'No description provided.'}</p>

        ${countdownText ? `<p class="countdown-text">${countdownText}</p>` : ''}

        <div class="exam-details">
          <div class="detail-item">
            <span class="detail-label">Duration</span>
            ${duration} minutes
          </div>
          <div class="detail-item">
            <span class="detail-label">Total Marks</span>
            ${totalMarks}
          </div>
          <div class="detail-item">
            <span class="detail-label">Passing Marks</span>
            ${passingMarks}
          </div>
          <div class="detail-item">
            <span class="detail-label">Status</span>
            ${statusLabel}
          </div>
          <div class="detail-item">
            <span class="detail-label">Starts</span>
            ${startDate}
          </div>
          <div class="detail-item">
            <span class="detail-label">Ends</span>
            ${endDate}
          </div>
        </div>

        <button class="btn-start ${statusInfo.isDisabled ? 'disabled' : ''}" ${statusInfo.isDisabled ? 'disabled' : ''}>
          ${buttonText}
        </button>
      `;

      // Add event listener to the start button
      const startButton = card.querySelector('.btn-start');
      if (startButton && !statusInfo.isDisabled) {
        startButton.addEventListener('click', () => this.startExam(exam.id));
      }

      // Add click animation
      card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn-start')) {
          card.style.transform = 'scale(0.98)';
          setTimeout(() => {
            card.style.transform = '';
          }, 150);
        }
      });

      container.appendChild(card);
    });
  }

  getExamIcon(exam) {
    const title = (exam.title || '').toLowerCase();
    if (title.includes('math')) return '🔢';
    if (title.includes('computer') || title.includes('programming')) return '💻';
    if (title.includes('database')) return '🗄️';
    if (title.includes('web')) return '🌐';
    if (title.includes('data') || title.includes('algorithm')) return '📊';
    return '📝';
  }

  getDifficultyColor(exam) {
    const duration = exam.duration || 0;
    if (duration > 120) return 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
    if (duration > 90) return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
    if (duration > 60) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
  }

  async startExam(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    this.selectedExam = exam;
    
    // Show rules modal first
    document.getElementById('rulesModal').style.display = 'flex';
  }

  cancelExamStart() {
    // Hide all modals and reset state
    document.getElementById('rulesModal').style.display = 'none';
    document.getElementById('cameraModal').style.display = 'none';
    document.getElementById('fullscreenModal').style.display = 'none';
    
    // Stop camera if it's running
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    
    this.selectedExam = null;
  }

  async proceedToCamera() {
    // Hide rules modal and show camera modal
    document.getElementById('rulesModal').style.display = 'none';
    document.getElementById('cameraModal').style.display = 'flex';
    
    // Request camera permission
    await this.requestCameraPermission();
  }

  async requestCameraPermission() {
    const videoElement = document.getElementById('cameraPreview');
    const statusElement = document.getElementById('cameraPreviewStatus');
    const continueBtn = document.getElementById('cameraContinueBtn');
    
    try {
      statusElement.textContent = 'Requesting camera permission...';
      continueBtn.disabled = true;
      
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      
      videoElement.srcObject = this.cameraStream;
      statusElement.textContent = 'Camera ready! ✓';
      statusElement.style.color = '#4caf50';
      continueBtn.disabled = false;
      
    } catch (err) {
      console.error('Camera permission denied:', err);
      statusElement.textContent = 'Camera access denied. Please allow camera access and try again.';
      statusElement.style.color = '#f44336';
      
      // Show instructions for enabling camera
      setTimeout(() => {
        alert('Camera access is required for the exam. Please:\n1. Click the camera icon in the address bar\n2. Allow camera access\n3. Try again');
        this.requestCameraPermission();
      }, 2000);
    }
  }

  proceedToFullscreen() {
    // Hide camera modal and show fullscreen modal
    document.getElementById('cameraModal').style.display = 'none';
    document.getElementById('fullscreenModal').style.display = 'flex';
  }

  async startActualExam() {
    // Hide fullscreen modal
    document.getElementById('fullscreenModal').style.display = 'none';
    
    // Stop the preview camera stream (exam interface will start its own)
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    
    // Redirect to exam interface
    window.location.href = `/student/index.html?examId=${this.selectedExam.id}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const studentExamList = new StudentExamList();
  window.studentExamList = studentExamList;
});
