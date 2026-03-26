// Student Exam Interface
// Manages exam flow, question navigation, answer submission, and timer

class ExamInterface {
  constructor() {
    this.exam = null;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.sessionId = null;
    this.answers = {}; // { questionId: answer }
    this.answerMetadata = {}; // { questionId: { firstTime, lastTime, changeCount } }
    this.startTime = null;
    this.timeRemaining = 0;
    this.timerInterval = null;
    this.isSubmitted = false;

    window.examInterface = this; // Make globally accessible
    this.init();
  }

  async init() {
    if (!checkAuth()) return;

    const user = getUser();
    console.log('Current user:', user);

    // Get exam ID from URL or query params
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');

    if (!examId) {
      this.showError('No exam selected. Redirecting to exam list...');
      setTimeout(() => window.location.href = '/student/', 2000);
      return;
    }

    this.showLoading('Loading exam...');
    try {
      await this.loadExam(examId);
      await this.startExamSession();
      await this.requestFullscreen();
      await this.startCamera();
      this.setupEventListeners();
      this.renderQuestionsList();
      this.displayQuestion();
      this.startTimer();
      this.hideLoading();
    } catch (err) {
      this.hideLoading();
      this.showError('Failed to initialize exam: ' + err.message);
      console.error('Exam initialization error:', err);
    }
  }

  async loadExam(examId) {
    try {
      this.exam = await apiCall(`/exams/${examId}/full`);
      this.questions = this.exam.questions;

      // Shuffle questions for randomization
      this.questions = this.questions.sort(() => Math.random() - 0.5);

      document.getElementById('examTitle').textContent = this.exam.title;
      document.getElementById('totalQuestions').textContent = `of ${this.questions.length}`;

      console.log('Exam loaded:', this.exam);
      console.log('Questions:', this.questions);
    } catch (err) {
      console.error('Failed to load exam:', err);
      throw new Error('Unable to load exam. Please check your connection and try again.');
    }
  }

  async startExamSession() {
    try {
      const response = await apiCall('/submissions/session/start', 'POST', {
        examId: this.exam.id
      });
      this.sessionId = response.sessionId;
      window.antiCheat.setSessionId(this.sessionId);

      // Initialize answer metadata
      this.questions.forEach(q => {
        this.answerMetadata[q.id] = {
          firstTime: null,
          lastTime: null,
          changeCount: 0
        };
      });

      console.log('Exam session started:', this.sessionId);
    } catch (err) {
      console.error('Failed to start exam session:', err);
      throw new Error('Unable to start exam session. Please try refreshing the page.');
    }
  }

  async requestFullscreen() {
    try {
      await window.antiCheat.requestFullscreen();
    } catch (err) {
      this.showError('Fullscreen permission required for exam mode.');
      console.warn('Fullscreen request failed:', err);
    }
  }

  async startCamera() {
    const cameraStatus = document.getElementById('cameraStatus');
    const cameraFeed = document.getElementById('cameraFeed');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraStatus.textContent = 'Camera: unavailable in this browser';
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraFeed.srcObject = stream;
      cameraStatus.textContent = 'Camera: active';

      this.cameraInterval = setInterval(() => this.captureCameraSnapshot(), 15001); // every 15 seconds
      this.cameraStream = stream;
    } catch (err) {
      console.error('Failed to access camera:', err);
      cameraStatus.textContent = 'Camera: permission denied';
    }
  }

  stopCamera() {
    if (this.cameraInterval) {
      clearInterval(this.cameraInterval);
      this.cameraInterval = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    const cameraStatus = document.getElementById('cameraStatus');
    if (cameraStatus) cameraStatus.textContent = 'Camera: stopped';
  }

  async captureCameraSnapshot() {
    try {
      const cameraFeed = document.getElementById('cameraFeed');
      if (!cameraFeed || !cameraFeed.srcObject) return;

      const video = cameraFeed;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.7);

      await apiCall('/logs/camera', 'POST', {
        sessionId: this.sessionId,
        imageData,
        timestamp: Date.now()
      });

      this.logActivity('camera_snapshot', { snapshotTaken: true });
    } catch (err) {
      console.error('Failed to capture camera snapshot:', err);
    }
  }

  setupEventListeners() {
    document.getElementById('prevBtn').addEventListener('click', () => this.previousQuestion());
    document.getElementById('submitQBtn').addEventListener('click', () => this.nextQuestion());
    document.getElementById('submitExamBtn').addEventListener('click', () => this.submitExam());
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    document.getElementById('closeWarningBtn').addEventListener('click', (e) => {
      e.target.parentElement.style.display = 'none';
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.renderQuestionsList(e.target.dataset.filter);
      });
    });

    // Track answer changes
    const updateAnswerMetadata = (questionId) => {
      if (!this.answerMetadata[questionId]) {
        this.answerMetadata[questionId] = {
          firstTime: Date.now(),
          lastTime: Date.now(),
          changeCount: 0
        };
      } else {
        if (!this.answerMetadata[questionId].firstTime) {
          this.answerMetadata[questionId].firstTime = Date.now();
        }
        this.answerMetadata[questionId].lastTime = Date.now();
        this.answerMetadata[questionId].changeCount++;
      }
    };

    // MCQ change listener
    document.addEventListener('change', (e) => {
      if (e.target.name === 'option') {
        const questionId = parseInt(e.target.dataset.questionId);
        this.answers[questionId] = e.target.value;
        updateAnswerMetadata(questionId);
        this.updateQuestionStatus(questionId, true);
      }
    });

    // Descriptive answer listener
    document.getElementById('answerTextarea')?.addEventListener('input', (e) => {
      const questionId = this.questions[this.currentQuestionIndex].id;
      this.answers[questionId] = e.target.value;
      updateAnswerMetadata(questionId);
      this.updateQuestionStatus(questionId, true);
    });
  }

  displayQuestion() {
    if (this.currentQuestionIndex < 0 || this.currentQuestionIndex >= this.questions.length) {
      return;
    }

    const question = this.questions[this.currentQuestionIndex];
    document.getElementById('questionNumber').textContent = `Question ${this.currentQuestionIndex + 1}`;
    document.getElementById('questionText').textContent = question.content;
    document.getElementById('currentQuestion').textContent = `Question: ${this.currentQuestionIndex + 1}`;

    // Clear previous answer UI
    document.getElementById('mcqOptions').style.display = 'none';
    document.getElementById('descriptiveAnswer').style.display = 'none';

    if (question.type === 'mcq') {
      this.displayMCQ(question);
    } else if (question.type === 'descriptive') {
      this.displayDescriptive(question);
    }

    // Update button states
    document.getElementById('prevBtn').disabled = this.currentQuestionIndex === 0;
    document.getElementById('submitQBtn').textContent =
      this.currentQuestionIndex === this.questions.length - 1 ? 'Submit' : 'Save & Next';

    // Log activity
    this.logActivity('question_view', {
      questionId: question.id,
      questionNumber: this.currentQuestionIndex + 1,
      questionType: question.type
    });
  }

  displayMCQ(question) {
    const container = document.getElementById('mcqOptions');
    container.innerHTML = '';

    if (question.options && question.options.length > 0) {
      question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';

        const optionId = `option_${question.id}_${index}`;
        const isSelected = this.answers[question.id] === option.optionText;

        optionDiv.innerHTML = `
          <input type="radio" id="${optionId}" name="option" value="${option.optionText}" 
                 data-question-id="${question.id}" ${isSelected ? 'checked' : ''}>
          <label for="${optionId}">${option.optionText}</label>
        `;

        container.appendChild(optionDiv);
      });
    }

    container.style.display = 'block';
  }

  displayDescriptive(question) {
    const container = document.getElementById('descriptiveAnswer');
    const textarea = document.getElementById('answerTextarea');
    textarea.value = this.answers[question.id] || '';
    container.style.display = 'block';
  }

  renderQuestionsList(filter = 'all') {
    const container = document.getElementById('questionsList');
    container.innerHTML = '';

    this.questions.forEach((question, index) => {
      const isAnswered = this.answers[question.id] ? true : false;
      const isCurrent = index === this.currentQuestionIndex;

      // Apply filter
      if (filter === 'answered' && !isAnswered) return;
      if (filter === 'unanswered' && isAnswered) return;

      const btn = document.createElement('button');
      btn.className = 'question-btn';
      if (isCurrent) btn.classList.add('active');
      if (isAnswered) btn.classList.add('answered');

      btn.textContent = `Q${index + 1} (${question.marks} marks)`;
      btn.addEventListener('click', () => this.goToQuestion(index));

      container.appendChild(btn);
    });
  }

  updateQuestionStatus(questionId, answered) {
    this.renderQuestionsList();
  }

  goToQuestion(index) {
    if (index >= 0 && index < this.questions.length) {
      this.currentQuestionIndex = index;
      this.displayQuestion();
    }
  }

  previousQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.displayQuestion();
    }
  }

  async nextQuestion() {
    const currentQuestion = this.questions[this.currentQuestionIndex];
    const answer = this.answers[currentQuestion.id];

    // Save answer
    if (answer) {
      const metadata = this.answerMetadata[currentQuestion.id];
      try {
        await apiCall('/submissions/answer', 'POST', {
          sessionId: this.sessionId,
          questionId: currentQuestion.id,
          answer: answer,
          firstAnswerTime: metadata.firstTime,
          lastAnswerTime: metadata.lastTime,
          changeCount: metadata.changeCount
        });
        console.log(`Answer saved for question ${currentQuestion.id}`);
      } catch (err) {
        console.error('Failed to save answer:', err);
      }
    }

    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      this.displayQuestion();
    }
  }

  async submitExam() {
    if (this.isSubmitted) return;

    // Save last answer
    await this.nextQuestion();

    // Confirm submission
    const confirmed = confirm('Are you sure you want to submit the exam? You cannot go back after submission.');
    if (!confirmed) return;

    this.isSubmitted = true;

    try {
      // End session and auto-grade
      const result = await apiCall(`/submissions/session/${this.sessionId}/end`, 'POST', {
        totalViolations: window.antiCheat.getViolationCount()
      });

      this.stopCamera();

      // Show results
      alert('Exam submitted successfully!');
      window.location.href = `/student/results.html?sessionId=${this.sessionId}`;
    } catch (err) {
      alert('Failed to submit exam: ' + err.message);
      this.isSubmitted = false;
    }
  }

  // Auto-submit if violations exceed threshold
  autoSubmit(reason) {
    if (this.isSubmitted) return;

    alert(reason);
    this.stopCamera();
    this.submitExam();
  }

  startTimer() {
    this.startTime = Date.now();
    const durationMs = this.exam.duration * 60 * 1000;
    this.timeRemaining = durationMs;

    const timerEl = document.getElementById('timer');
    const statusEl = document.getElementById('timerStatus');

    this.timerInterval = setInterval(() => {
      this.timeRemaining -= 1000;

      if (this.timeRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.autoSubmit('Time is up! Submitting your exam...');
        return;
      }

      // Update display
      const totalSeconds = Math.floor(this.timeRemaining / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

      // Add warning classes
      if (this.timeRemaining <= 60000) { // 1 minute
        timerEl.className = 'timer critical';
        statusEl.textContent = 'Time Critical!';
      } else if (this.timeRemaining <= 300000) { // 5 minutes
        timerEl.className = 'timer warning';
        statusEl.textContent = 'Time Running Out';
      }

      // Log activity periodically
      if (totalSeconds % 60 === 0) {
        this.logActivity('timer_update', {
          timeRemaining: this.timeRemaining,
          totalSeconds
        });
      }
    }, 1000);
  }

  logActivity(eventType, details) {
    apiCall('/logs/activity', 'POST', {
      sessionId: this.sessionId,
      eventType,
      timestamp: Date.now(),
      details
    }).catch(err => console.error('Failed to log activity:', err));
  }

  showLoading(message = 'Loading...') {
    let loadingEl = document.getElementById('loadingOverlay');
    if (!loadingEl) {
      loadingEl = document.createElement('div');
      loadingEl.id = 'loadingOverlay';
      loadingEl.innerHTML = `
        <div class="loading-modal">
          <div class="loading-spinner"></div>
          <p>${message}</p>
        </div>
      `;
      loadingEl.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
        align-items: center; justify-content: center;
      `;
      document.body.appendChild(loadingEl);
    } else {
      loadingEl.querySelector('p').textContent = message;
      loadingEl.style.display = 'flex';
    }
  }

  hideLoading() {
    const loadingEl = document.getElementById('loadingOverlay');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }

  showError(message) {
    let errorEl = document.getElementById('errorToast');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'errorToast';
      errorEl.style.cssText = `
        position: fixed; top: 20px; right: 20px; max-width: 400px;
        background: #dc3545; color: white; padding: 15px; border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10001;
        font-family: Arial, sans-serif; font-size: 14px;
      `;
      document.body.appendChild(errorEl);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5001);
  }

  logout() {
    if (confirm('Are you sure you want to logout? Your exam progress will be lost.')) {
      clearAuth();
      window.location.href = '/login.html';
    }
  }
}

// Initialize exam interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ExamInterface();
});
