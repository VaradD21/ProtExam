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
    this.errorCount = 0;
    this.maxErrors = 3;

    window.examInterface = this; // Make globally accessible

    // Error boundary
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error, 'Global error');
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleGlobalError(event.reason, 'Unhandled promise rejection');
    });

    this.init();
  }

  handleGlobalError(error, context) {
    console.error(`[${context}]`, error);
    this.errorCount++;

    if (this.errorCount >= this.maxErrors) {
      this.showError('Multiple errors detected. Please refresh the page.');
      return;
    }

    // Show user-friendly error message
    this.showToast(`An error occurred: ${error.message || 'Unknown error'}`, 'error');
  }

  async init() {
    try {
      // Load saved theme
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        const themeIcon = document.querySelector('.theme-icon');
        if (themeIcon) themeIcon.textContent = '\u2600\ufe0f';
      }

      if (!checkAuth()) return;

      const user = getUser();
      if (user.role !== 'student') {
        alert('Access denied. Only students can access this page.');
        clearAuth();
        window.location.href = '/login.html';
        return;
      }
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
      await this.loadExam(examId);
      await this.startExamSession();
      this.hideLoading();

      // Show start overlay/modal
      this.showStartExamOverlay();
    } catch (err) {
      this.hideLoading();
      this.showError('Failed to initialize exam: ' + err.message);
      console.error('Exam initialization error:', err);
    }
  }

  showStartExamOverlay() {
    // Hide main exam UI until permissions granted
    document.getElementById('examContainer').style.display = 'none';
    let overlay = document.createElement('div');
    overlay.id = 'startExamOverlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(30, 41, 59, 0.98)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.innerHTML = `
      <div style="background: #fff; color: #222; padding: 2rem 2.5rem; border-radius: 12px; box-shadow: 0 2px 24px #0003; max-width: 90vw; text-align: center;">
        <h2>Ready to Start Your Exam?</h2>
        <p>To begin, we need access to your camera and fullscreen mode.<br><b>Click the button below to start.</b></p>
        <button id="startExamBtn" style="margin-top: 1.5rem; font-size: 1.2rem; padding: 0.7em 2em; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Start Exam</button>
        <div id="startExamSpinner" style="display: none; margin-top: 1.5rem; text-align: center;">
          <div style="border: 4px solid #f3f3f3; border-top: 4px solid #2563eb; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
          <p id="spinnerText" style="margin-top: 1rem; font-size: 0.95em; color: #666;">Requesting permissions...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <div id="startExamError" style="color: #b91c1c; margin-top: 1em; display: none;"></div>
        <button id="retryExamBtn" style="margin-top: 1rem; font-size: 1rem; padding: 0.6em 1.5em; background: #dc3545; color: #fff; border: none; border-radius: 6px; cursor: pointer; display: none;">Retry</button>
      </div>
    `;
    document.body.appendChild(overlay);
    
    const startBtn = document.getElementById('startExamBtn');
    const retryBtn = document.getElementById('retryExamBtn');
    const spinner = document.getElementById('startExamSpinner');
    const spinnerText = document.getElementById('spinnerText');
    const errorDiv = document.getElementById('startExamError');
    
    const attemptStart = async () => {
      errorDiv.style.display = 'none';
      retryBtn.style.display = 'none';
      startBtn.style.display = 'none';
      spinner.style.display = 'block';
      
      try {
        // First request fullscreen
        spinnerText.textContent = 'Activating fullscreen...';
        await this.requestFullscreen();
        console.log('Fullscreen activated');
        
        // Then start camera
        spinnerText.textContent = 'Starting camera...';
        await this.startCamera();
        console.log('Camera started');
        
        // Small delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now display the exam
        overlay.remove();
        document.getElementById('examContainer').style.display = '';
        
        // Initialize UI with currentQuestionIndex = 0
        this.currentQuestionIndex = 0;
        this.setupEventListeners();
        this.renderQuestionsList();
        this.displayQuestion();
        this.startTimer();
      } catch (err) {
        console.error('Failed to start exam:', err);
        spinner.style.display = 'none';
        startBtn.style.display = 'block';
        retryBtn.style.display = 'block';
        errorDiv.textContent = 'Failed to start: ' + (err.message || err);
        errorDiv.style.display = 'block';
      }
    };
    
    startBtn.addEventListener('click', attemptStart);
    retryBtn.addEventListener('click', attemptStart);
  }

  toggleQuestionPanel() {
    const panel = document.querySelector('.question-panel');
    if (panel) {
      panel.classList.toggle('open');
    }
  }

  toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('.theme-icon');

    body.classList.toggle('dark-theme');

    if (body.classList.contains('dark-theme')) {
      themeIcon.textContent = '☀️';
      localStorage.setItem('theme', 'dark');
    } else {
      themeIcon.textContent = '🌙';
      localStorage.setItem('theme', 'light');
    }
  }

  closeViolationWarning() {
    const warning = document.getElementById('violationWarning');
    if (warning) {
      warning.style.display = 'none';
    }
  }

  async loadExam(examId) {
    try {
      this.exam = await apiCall(`/exams/${examId}/full`);
      this.questions = this.exam.questions;

      // Shuffle questions for randomization if exam setting allows it
      if (this.exam.shuffleQuestions || this.exam.shuffle_questions) {
        this.questions = this.questions.sort(() => Math.random() - 0.5);
      }

      // Always reset to first question
      this.currentQuestionIndex = 0;

      document.getElementById('examTitle').textContent = this.exam.title;
      document.getElementById('totalQuestions').textContent = `of ${this.questions.length}`;

      console.log('Exam loaded:', this.exam);
      console.log('Questions:', this.questions);
      console.log('Starting from question index:', this.currentQuestionIndex);
    } catch (err) {
      console.error('Failed to load exam:', err);
      throw new Error('Unable to load exam. Please check your connection and try again.');
    }
  }

  async startExamSession() {
    // Show confirmation dialog
    const confirmed = await this.showExamConfirmation();
    if (!confirmed) {
      // Redirect back to exam list
      window.location.href = '/student/examList.html';
      return;
    }

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

  async showExamConfirmation() {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      const duration = this.exam.duration || this.exam.duration_minutes || 'N/A';
      const totalQ = this.questions ? this.questions.length : 'N/A';
      const passingMarks = this.exam.passingMarks || this.exam.passing_marks || this.exam.passing_score || 'N/A';
      
      modal.innerHTML = `
        <div class="modal-content confirmation-modal">
          <div class="modal-header">
            <h3>Start Exam</h3>
          </div>
          <div class="modal-body">
            <div class="exam-summary">
              <h4>${this.exam.title}</h4>
              <p><strong>Duration:</strong> ${duration} minutes</p>
              <p><strong>Total Questions:</strong> ${totalQ}</p>
              <p><strong>Passing Marks:</strong> ${passingMarks}</p>
              ${this.exam.instructions ? `<p><strong>Instructions:</strong> ${this.exam.instructions}</p>` : ''}
            </div>
            <div class="warning-message">
              <p><strong>Important:</strong></p>
              <ul>
                <li>The exam will run in full screen mode</li>
                <li>Exiting full screen may result in automatic submission</li>
                <li>Ensure you have a stable internet connection</li>
                <li>Do not refresh or close the browser window</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" id="cancelBtn">Cancel</button>
            <button class="btn-primary" id="startBtn">Start Exam</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      document.getElementById('cancelBtn').addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      document.getElementById('startBtn').addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });
    });
  }

  async requestFullscreen() {
    try {
      await window.antiCheat.requestFullscreen();
      console.log('Exam started in fullscreen mode');
    } catch (err) {
      // Fullscreen is important for proctoring but offer to continue anyway
      const continueAnyway = confirm(
        `⚠️ Fullscreen Mode Failed\n\n${err.message}\n\nDo you want to continue without fullscreen? The exam may have limited anti-cheating protection.`
      );
      
      if (!continueAnyway) {
        // User rejected - restart the browser
        throw err;
      }
      
      console.warn('Exam started without fullscreen mode');
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
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }, 
        audio: false 
      });
      cameraFeed.srcObject = stream;
      cameraStatus.textContent = 'Camera: active';

      // Enhanced camera monitoring
      this.cameraInterval = setInterval(() => this.captureCameraSnapshot(), 5000); // Capture every 5 seconds instead of 15
      this.faceDetectionInterval = setInterval(() => this.detectFacePresence(), 5000); // every 5 seconds
      this.cameraStream = stream;

      // Add camera controls
      this.addCameraControls();
    } catch (err) {
      console.error('Failed to access camera:', err);
      cameraStatus.textContent = 'Camera: permission denied';
      this.logViolation('camera_denied', { error: err.message }, 'high');
    }
  }

  stopCamera() {
    if (this.cameraInterval) {
      clearInterval(this.cameraInterval);
      this.cameraInterval = null;
    }
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    const cameraStatus = document.getElementById('cameraStatus');
    if (cameraStatus) cameraStatus.textContent = 'Camera: stopped';
  }

  addCameraControls() {
    const cameraContainer = document.querySelector('.camera-box');
    if (!cameraContainer) return;

    const controls = document.createElement('div');
    controls.className = 'camera-controls';
    controls.innerHTML = `
      <button id="toggleCamera" class="camera-btn" title="Toggle Camera">📷</button>
      <button id="testCamera" class="camera-btn" title="Test Camera">🔍</button>
    `;
    cameraContainer.appendChild(controls);

    // Toggle camera visibility
    document.getElementById('toggleCamera').addEventListener('click', () => {
      const video = document.getElementById('cameraFeed');
      video.style.display = video.style.display === 'none' ? 'block' : 'none';
    });

    // Test camera snapshot
    document.getElementById('testCamera').addEventListener('click', () => {
      this.captureCameraSnapshot();
      this.showSuccess('Camera test snapshot taken');
    });
  }

  async detectFacePresence() {
    try {
      const video = document.getElementById('cameraFeed');
      if (!video || !video.srcObject) return;

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Simple face detection using brightness analysis
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Calculate average brightness
      let totalBrightness = 0;
      let pixelCount = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        pixelCount++;
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      
      // Check for face-like patterns (basic heuristic)
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      const sampleSize = 50;
      
      let faceDetected = false;
      const centerBrightness = this.getAverageBrightness(ctx, centerX - sampleSize, centerY - sampleSize, sampleSize * 2, sampleSize * 2);
      
      // If center is significantly brighter than edges, might indicate face
      if (centerBrightness > avgBrightness * 1.2) {
        faceDetected = true;
      }

      // Log face detection status
      if (!faceDetected && this.lastFaceDetected !== false) {
        this.logViolation('face_not_detected', { 
          avgBrightness: Math.round(avgBrightness),
          centerBrightness: Math.round(centerBrightness)
        }, 'medium');
        this.showWarning('Face not clearly detected in camera feed');
      }
      
      this.lastFaceDetected = faceDetected;
      
    } catch (err) {
      console.error('Face detection error:', err);
    }
  }

  getAverageBrightness(ctx, x, y, width, height) {
    try {
      const imageData = ctx.getImageData(x, y, width, height);
      const data = imageData.data;
      let total = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        total += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      
      return total / (data.length / 4);
    } catch (err) {
      return 0;
    }
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
    const panelToggle = document.getElementById('panelToggle');
    if (panelToggle) {
      panelToggle.addEventListener('click', () => this.toggleQuestionPanel());
    }

    document.getElementById('prevBtn').addEventListener('click', () => this.previousQuestion());
    document.getElementById('submitQBtn').addEventListener('click', () => this.nextQuestion());
    document.getElementById('submitExamBtn').addEventListener('click', () => this.submitExam());
    document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleDarkMode());
    }
    
    document.getElementById('closeWarningBtn').addEventListener('click', (e) => {
      e.target.parentElement.style.display = 'none';
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.renderQuestionsList(e.target.dataset.filter);
      });
    });

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

    document.addEventListener('change', (e) => {
      if (e.target.name === 'option') {
        const questionId = Number.parseInt(e.target.dataset.questionId, 10);
        this.answers[questionId] = e.target.value;
        updateAnswerMetadata(questionId);
        this.updateQuestionStatus(questionId, true);
      }
    });

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

  async submitExam(skipConfirm = false) {
    if (this.isSubmitted) return;

    // Save last answer
    await this.nextQuestion();

    // Confirm submission (skip for auto-submit due to violations/timeout)
    if (!skipConfirm) {
      const confirmed = confirm('Are you sure you want to submit the exam? You cannot go back after submission.');
      if (!confirmed) return;
    }

    this.isSubmitted = true;

    try {
      // End session and auto-grade
      const result = await apiCall(`/submissions/session/${this.sessionId}/end`, 'POST', {
        totalViolations: window.antiCheat.getViolationCount()
      });

      if (window.antiCheat) {
        window.antiCheat.notifyExamEnd(this.sessionId);
      }

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
    // Disable further violation detection
    if (window.antiCheat) {
      window.antiCheat.violations = Infinity; // Prevent multiple triggers
    }
    this.submitExam(true); // true = skipConfirm
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

  showToast(message, type = 'info') {
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };

    let toastEl = document.getElementById('toastNotification');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'toastNotification';
      toastEl.style.cssText = `
        position: fixed; top: 20px; right: 20px; max-width: 400px;
        padding: 15px; border-radius: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10001; font-family: Arial, sans-serif; font-size: 14px;
        transition: all 0.3s ease; color: white;
      `;
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = message;
    toastEl.style.backgroundColor = colors[type] || colors.info;
    toastEl.style.display = 'block';

    // Auto-hide after 3 seconds for non-error toasts
    const timeout = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      toastEl.style.display = 'none';
    }, timeout);
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  logout() {
    if (confirm('Are you sure you want to logout? Your exam progress will be lost.')) {
      clearAuth();
      window.location.href = '/login.html';
    }
  }

  toggleDarkMode() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    
    // Update toggle button icon
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    
    // Save preference
    localStorage.setItem('darkMode', isDark);
    
    // Log activity
    this.logActivity('theme_toggle', { darkMode: isDark });
  }
}

// Initialize exam interface when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ExamInterface();
});
