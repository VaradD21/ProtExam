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
  }

  async loadAvailableExams() {
    try {
      // Get enrolled exams for the student
      const exams = await apiCall('/exams/enrolled');
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
