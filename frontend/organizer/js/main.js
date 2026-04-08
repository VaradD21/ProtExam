// Organizer Dashboard Main Logic

// Logging utility
const DashboardLogger = {
  LOG_LEVELS: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    SUCCESS: 'SUCCESS'
  },

  logs: [],
  maxLogs: 500, // Keep last 500 logs in memory

  log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with colors
    const colors = {
      DEBUG: 'color: #888; font-weight: bold;',
      INFO: 'color: #0066cc; font-weight: bold;',
      WARN: 'color: #ff9900; font-weight: bold;',
      ERROR: 'color: #cc0000; font-weight: bold;',
      SUCCESS: 'color: #00cc00; font-weight: bold;'
    };

    console.log(`%c[${level}] ${timestamp}: ${message}`, colors[level], data || '');
  },

  info(message, data) { this.log(this.LOG_LEVELS.INFO, message, data); },
  debug(message, data) { this.log(this.LOG_LEVELS.DEBUG, message, data); },
  warn(message, data) { this.log(this.LOG_LEVELS.WARN, message, data); },
  error(message, data) { this.log(this.LOG_LEVELS.ERROR, message, data); },
  success(message, data) { this.log(this.LOG_LEVELS.SUCCESS, message, data); },

  getRecentLogs(count = 50) {
    return this.logs.slice(-count).map(log => 
      `[${log.timestamp}] ${log.level}: ${log.message} ${log.data ? JSON.stringify(log.data) : ''}`
    ).join('\n');
  },

  downloadLogs() {
    const logText = this.getRecentLogs(this.logs.length);
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organizer-logs-${new Date().toISOString()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};

class OrganizerDashboard {
  constructor() {
    this.exams = [];
    this.currentExam = null;
    this.currentEditingExamId = null;
    this.activeStudents = {};
    this.monitorSocket = null;
    this.currentMonitoringExamId = null;
    this.stats = {
      examsCreated: 0,
      studentsEnrolled: 0,
      questionsAdded: 0
    };

    DashboardLogger.info('Dashboard instance created');
    this.init();
  }

  async init() {
    DashboardLogger.info('Initializing organizer dashboard');

    if (!checkAuth()) {
      DashboardLogger.error('User not authenticated');
      return;
    }

    const user = getUser();
    DashboardLogger.info('User authenticated', { email: user.email, role: user.role });
    
    if (user.role !== 'organizer') {
      DashboardLogger.error('Access denied - user is not organizer', { role: user.role });
      alert('Access denied. Only organizers can access this page. Your role: ' + user.role);
      clearAuth();
      window.location.href = '/login.html';
      return;
    }

    document.getElementById('userName').textContent = user.fullName;

    this.showLoading('Initializing dashboard...');
    try {
      DashboardLogger.info('Setting up event listeners');
      this.setupEventListeners();
      this.initializeSocket();
      
      DashboardLogger.info('Loading exams');
      await this.loadExams();
      
      DashboardLogger.info('Setting up view switching');
      this.setupViewSwitching();
      
      DashboardLogger.info('Loading dashboard stats');
      this.loadDashboardStats();
      
      DashboardLogger.success('Dashboard initialized successfully');
      this.hideLoading();
    } catch (err) {
      DashboardLogger.error('Dashboard initialization failed', { message: err.message, stack: err.stack });
      this.hideLoading();
      this.showError('Failed to initialize dashboard: ' + err.message);
    }
  }

  setupEventListeners() {
    DashboardLogger.debug('Setting up event listeners');

    // View switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const viewName = e.target.dataset.view;
        DashboardLogger.info('Navigation button clicked', { view: viewName });
        this.switchView(viewName);
      });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      DashboardLogger.info('Logout button clicked');
      if (confirm('Are you sure you want to logout?')) {
        DashboardLogger.info('User confirmed logout');
        clearAuth();
        window.location.href = '/login.html';
      } else {
        DashboardLogger.info('User cancelled logout');
      }
    });

    // Create exam
    document.getElementById('createExamBtn').addEventListener('click', () => {
      DashboardLogger.info('Create exam button clicked');
      this.openExamModal();
    });

    // Exam form
    document.getElementById('examForm').addEventListener('submit', (e) => {
      DashboardLogger.info('Exam form submitted');
      this.saveExam(e);
    });

    // Modal close buttons
    document.querySelectorAll('.btn-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        DashboardLogger.debug('Modal close button clicked', { modalId: modal?.id });
        modal.style.display = 'none';
      });
    });

    // Cancel buttons
    document.querySelectorAll('.btn-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        DashboardLogger.debug('Cancel button clicked', { modalId: modal?.id });
        modal.style.display = 'none';
      });
    });

    // Exam select for monitoring
    document.getElementById('examSelectMonitoring').addEventListener('change', (e) => {
      const examId = Number.parseInt(e.target.value, 10);
      DashboardLogger.info('Exam selected for monitoring', { examId });
      if (e.target.value) {
        this.loadMonitoringData(examId);
      }
    });

    // Exam select for results
    document.getElementById('examSelectResults').addEventListener('change', (e) => {
      const examId = Number.parseInt(e.target.value, 10);
      DashboardLogger.info('Exam selected for results view', { examId });
      if (e.target.value) {
        this.loadResults(examId);
      }
    });

    // Add question button
    document.getElementById('addQuestionBtn')?.addEventListener('click', () => {
      DashboardLogger.info('Add question button clicked');
      this.openQuestionForm();
    });

    document.getElementById('addOptionBtn')?.addEventListener('click', () => {
      DashboardLogger.debug('Add option button clicked');
      this.addOptionInput();
    });

    document.getElementById('saveQuestionBtn')?.addEventListener('click', () => {
      DashboardLogger.info('Save question button clicked');
      this.saveQuestion();
    });

    document.getElementById('cancelQuestionBtn')?.addEventListener('click', () => {
      DashboardLogger.debug('Cancel question form');
      document.getElementById('questionForm').style.display = 'none';
    });
  }

  setupViewSwitching() {
    DashboardLogger.debug('Setting up view switching');
    const navBtns = document.querySelectorAll('.nav-btn');
    // Load exams view by default for organizers
    const examsBtn = document.querySelector('.nav-btn[data-view="exams"]');
    if (examsBtn) {
      DashboardLogger.debug('Loading exams view by default');
      examsBtn.click();
    } else {
      DashboardLogger.warn('Exams button not found, falling back to dashboard');
      navBtns[0].click();
    }
  }

  switchView(viewName) {
    DashboardLogger.info('Switching view', { view: viewName });
    try {
      // Update nav buttons
      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
          btn.classList.add('active');
        }
      });

      // Update views
      document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
      });

      const viewElement = document.getElementById(viewName + 'View');
      if (!viewElement) {
        DashboardLogger.error('View element not found', { view: viewName });
        return;
      }
      viewElement.classList.add('active');

      // Load view-specific data
      if (viewName === 'exams') {
        this.loadExamsView();
      } else if (viewName === 'monitoring') {
        this.loadMonitoringView();
      } else if (viewName === 'results') {
        this.loadResultsView();
      } else {
        DashboardLogger.warn('Unknown view requested', { view: viewName });
      }
    } catch (err) {
      DashboardLogger.error('Error switching view', { view: viewName, message: err.message });
      this.showError('Error loading view: ' + err.message);
    }
  }

  async loadExams() {
    DashboardLogger.info('Loading exams from server');
    try {
      this.exams = await apiCall('/exams');
      DashboardLogger.success('Exams loaded successfully', { count: this.exams.length });
      this.stats.examsCreated = this.exams.length;

      // Populate dropdowns
      this.populateExamSelects();
    } catch (err) {
      DashboardLogger.error('Failed to load exams', { message: err.message, stack: err.stack });
      this.showError('Unable to load exams. Please check your connection and try again.');
    }
  }

  async loadDashboardStats() {
    DashboardLogger.info('Loading dashboard statistics');
    try {
      const exams = await apiCall('/exams');
      document.getElementById('totalExams').textContent = exams.length;

      // Count stats
      let draft = exams.filter(e => e.status === 'draft').length;
      let published = exams.filter(e => e.status === 'published').length;

      DashboardLogger.info('Dashboard stats loaded', { total: exams.length, draft, published });
      this.stats.examsCreated = exams.length;

      // For now, showing recent exams
      this.renderRecentExams(exams);
    } catch (err) {
      DashboardLogger.error('Failed to load dashboard stats', { message: err.message });
    }
  }

  renderRecentExams(exams) {
    DashboardLogger.debug('Rendering recent exams', { count: exams.length });
    const container = document.getElementById('recentExamsList');
    if (!container) {
      DashboardLogger.warn('Recent exams container not found');
      return;
    }
    container.innerHTML = '';

    exams.slice(0, 5).forEach(exam => {
      const item = document.createElement('div');
      item.className = 'exam-item';
      item.innerHTML = `
        <div>
          <div class="exam-item-title">${exam.title}</div>
          <div class="exam-item-info">Duration: ${exam.duration} mins | Marks: ${exam.totalMarks}</div>
        </div>
        <div class="badge ${exam.status === 'draft' ? 'badge-draft' : 'badge-published'}">${exam.status}</div>
      `;
      container.appendChild(item);
    });
  }

  async loadExamsView() {
    DashboardLogger.info('Loading exams view', { examsCount: this.exams.length });
    const container = document.getElementById('examsList');
    if (!container) {
      DashboardLogger.error('Exams list container not found');
      return;
    }
    container.innerHTML = '';

    this.exams.forEach(exam => {
      const row = document.createElement('div');
      row.className = 'exam-row';
      row.innerHTML = `
        <div>
          <div class="row-title">${exam.title}</div>
          <div class="row-info">${exam.duration} mins | ${exam.totalMarks} marks | Pass: ${exam.passingMarks}</div>
        </div>
        <div class="badge ${exam.status === 'draft' ? 'badge-draft' : 'badge-published'}">${exam.status}</div>
        <div class="row-info">${exam.createdAt ? new Date(exam.createdAt).toLocaleDateString() : 'N/A'}</div>
        <div>
          <button class="btn-action btn-edit" data-exam-id="${exam.id}">Edit</button>
          <button class="btn-action btn-questions" data-exam-id="${exam.id}">Questions</button>
          <button class="btn-action btn-enroll" data-exam-id="${exam.id}">Enroll</button>
        </div>
        <div>
          <button class="btn-action btn-delete" data-exam-id="${exam.id}">Delete</button>
        </div>
      `;
      container.appendChild(row);
    });

    DashboardLogger.success('Exams view rendered', { examsCount: this.exams.length });
    // Add event listeners for the buttons
    this.setupExamActionListeners();
  }

  setupExamActionListeners() {
    DashboardLogger.debug('Setting up exam action listeners');
    const container = document.getElementById('examsList');
    if (!container) {
      DashboardLogger.warn('Exams list container not found for setting up listeners');
      return;
    }

    // Edit buttons
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const examId = Number.parseInt(e.target.dataset.examId, 10);
        DashboardLogger.info('Edit exam button clicked', { examId });
        this.editExam(examId);
      });
    });

    // Questions buttons
    container.querySelectorAll('.btn-questions').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const examId = Number.parseInt(e.target.dataset.examId, 10);
        DashboardLogger.info('Manage questions button clicked', { examId });
        this.manageQuestions(examId);
      });
    });

    // Enroll buttons
    container.querySelectorAll('.btn-enroll').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const examId = Number.parseInt(e.target.dataset.examId, 10);
        DashboardLogger.info('Manage enrollments button clicked', { examId });
        this.manageEnrollments(examId);
      });
    });

    // Delete buttons
    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const examId = Number.parseInt(e.target.dataset.examId, 10);
        DashboardLogger.warn('Delete exam button clicked', { examId });
        this.deleteExam(examId);
      });
    });
  }

  async loadMonitoringView() {
    const select = document.getElementById('examSelectMonitoring');
    select.innerHTML = '<option value="">Select Exam to Monitor</option>';

    this.exams.forEach(exam => {
      const option = document.createElement('option');
      option.value = exam.id;
      option.textContent = exam.title;
      select.appendChild(option);
    });
  }

  async loadMonitoringData(examId) {
    try {
      if (this.monitorSocket && this.monitorSocket.connected) {
        this.joinMonitoringRoom(examId);
      }
      this.currentMonitoringExamId = examId;

      // Get enrolled students
      const students = await apiCall(`/exams/${examId}/students`);
      const container = document.getElementById('studentMonitoringList');
      container.innerHTML = '';

      students.forEach(student => {
        const row = document.createElement('div');
        row.className = 'student-row';
        row.dataset.studentId = student.id;

        // Get student status from active students (from WebSocket)
        const status = this.activeStudents[student.id] || { status: 'not_started', violations: 0 };
        const statusClass = `badge-${status.status}`;

        row.innerHTML = `
          <div class="row-title">${student.fullName}</div>
          <div class="row-info">${student.email}</div>
          <div class="badge ${statusClass}">${status.status}</div>
          <div class="row-info">⚠️ ${status.violations || 0} violations</div>
          <button class="btn-action" onclick="dashboard.viewStudentDetails('${student.fullName}', ${examId}, ${student.id})">Details</button>
        `;
        container.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load monitoring data:', err);
    }
  }

  async loadResultsView() {
    const select = document.getElementById('examSelectResults');
    select.innerHTML = '<option value="">Select Exam to View Results</option>';

    this.exams.forEach(exam => {
      const option = document.createElement('option');
      option.value = exam.id;
      option.textContent = exam.title;
      select.appendChild(option);
    });
  }

  initializeSocket() {
    if (typeof io === 'undefined') {
      DashboardLogger.warn('Socket.IO client is not available. Real-time monitoring will not work.');
      return;
    }

    try {
      this.monitorSocket = io({
        auth: { token: getToken() }
      });

      this.monitorSocket.on('connect', () => {
        DashboardLogger.info('Connected to monitoring socket', { socketId: this.monitorSocket.id });
      });

      this.monitorSocket.on('connect_error', (err) => {
        DashboardLogger.error('Monitoring socket connection failed', { message: err.message || err });
      });

      this.monitorSocket.on('student_status_update', (session) => {
        DashboardLogger.info('Student status update received', session);
        this.activeStudents[session.studentId] = session;
        if (session.examId === this.currentMonitoringExamId) {
          this.refreshMonitoringRow(session.studentId);
        }
      });

      this.monitorSocket.on('violation_logged', (data) => {
        DashboardLogger.warn('Violation logged event received', data);
        if (data.studentStatus) {
          this.activeStudents[data.studentStatus.studentId] = data.studentStatus;
          if (data.studentStatus.examId === this.currentMonitoringExamId) {
            this.refreshMonitoringRow(data.studentStatus.studentId);
            this.showWarning(`Violation recorded for student ${data.studentStatus.studentId}: ${data.violationType}`);
          }
        }
      });
    } catch (err) {
      DashboardLogger.error('Failed to initialize monitoring socket', { message: err.message });
    }
  }

  joinMonitoringRoom(examId) {
    if (!this.monitorSocket || !this.monitorSocket.connected) {
      return;
    }

    DashboardLogger.info('Joining monitoring room', { examId });
    this.monitorSocket.emit('monitoring_join', { examId });
  }

  refreshMonitoringRow(studentId) {
    const row = document.querySelector(`.student-row[data-student-id="${studentId}"]`);
    const session = this.activeStudents[studentId];

    if (!row || !session) {
      return;
    }

    const badge = row.querySelector('.badge');
    const violations = row.querySelector('.row-info:nth-of-type(2)');

    if (badge) {
      badge.textContent = session.status;
      badge.className = `badge badge-${session.status}`;
    }

    if (violations) {
      violations.textContent = `⚠️ ${session.violations || 0} violations`;
    }
  }

  async loadResults(examId) {
    try {
      // In production, you'd fetch actual results from API
      const container = document.getElementById('resultsList');
      container.innerHTML = '<p>Results would be displayed here. API endpoint needed.</p>';
    } catch (err) {
      console.error('Failed to load results:', err);
    }
  }

  openExamModal() {
    DashboardLogger.info('Opening create exam modal');
    try {
      this.currentEditingExamId = null;
      document.getElementById('modalTitle').textContent = 'Create New Exam';
      document.getElementById('examForm').reset();
      document.getElementById('examModal').style.display = 'flex';
      DashboardLogger.debug('Create exam modal opened');
    } catch (err) {
      DashboardLogger.error('Failed to open exam modal', { message: err.message });
    }
  }

  editExam(examId) {
    DashboardLogger.info('Editing exam', { examId });
    try {
      const exam = this.exams.find(e => e.id === examId);
      if (!exam) {
        DashboardLogger.error('Exam not found', { examId });
        this.showError('Exam not found');
        return;
      }

      const formatDateForInput = (value) => {
        if (!value) return '';
        return String(value).replace(' ', 'T').slice(0, 16);
      };

      this.currentEditingExamId = examId;
      document.getElementById('modalTitle').textContent = 'Edit Exam';
      document.getElementById('examTitle').value = exam.title;
      document.getElementById('examDescription').value = exam.description || '';
      document.getElementById('examDuration').value = exam.duration;
      document.getElementById('examTotalMarks').value = exam.totalMarks;
      document.getElementById('examPassingMarks').value = exam.passingMarks;
      document.getElementById('examInstructions').value = exam.instructions || '';
      document.getElementById('examWeightage').value = exam.weightage ?? 1.0;
      document.getElementById('examRules').value = exam.rules || '';
      document.getElementById('shuffleQuestions').checked = Boolean(exam.shuffle_questions ?? exam.shuffleQuestions);
      document.getElementById('shuffleOptions').checked = Boolean(exam.shuffle_options ?? exam.shuffleOptions);
      document.getElementById('allowReview').checked = exam.allow_review !== 0 && exam.allowReview !== false;
      document.getElementById('showResultsImmediately').checked = Boolean(exam.show_results_immediately ?? exam.showResultsImmediately);
      document.getElementById('examMaxAttempts').value = exam.max_attempts ?? exam.maxAttempts ?? 1;
      document.getElementById('examStartDate').value = formatDateForInput(exam.start_date || exam.startDate || exam.startTime);
      document.getElementById('examEndDate').value = formatDateForInput(exam.end_date || exam.endDate || exam.endTime);
      document.getElementById('examAccessCode').value = exam.access_code || exam.accessCode || '';

      document.getElementById('examModal').style.display = 'flex';
      DashboardLogger.debug('Edit exam modal opened', { title: exam.title });
    } catch (err) {
      DashboardLogger.error('Failed to open edit exam modal', { examId, message: err.message });
      this.showError('Failed to load exam: ' + err.message);
    }
  }

  async saveExam(e) {
    e.preventDefault();
    DashboardLogger.info('Save exam form submitted');

    const user = getUser();
    const token = getToken();
    DashboardLogger.debug('Save exam validation', { userExists: !!user, tokenExists: !!token });

    if (!user || user.role !== 'organizer') {
      DashboardLogger.error('User not authorized to create exams', { role: user?.role });
      this.showError('You must be logged in as an organizer to create exams.');
      return;
    }

    const data = {
      title: document.getElementById('examTitle').value,
      description: document.getElementById('examDescription').value,
      duration: Number.parseInt(document.getElementById('examDuration').value, 10),
      totalMarks: Number.parseInt(document.getElementById('examTotalMarks').value, 10),
      passingMarks: Number.parseInt(document.getElementById('examPassingMarks').value, 10),
      instructions: document.getElementById('examInstructions').value,
      weightage: parseFloat(document.getElementById('examWeightage').value) || 1.0,
      rules: document.getElementById('examRules').value,
      shuffleQuestions: document.getElementById('shuffleQuestions').checked,
      shuffleOptions: document.getElementById('shuffleOptions').checked,
      allowReview: document.getElementById('allowReview').checked,
      showResultsImmediately: document.getElementById('showResultsImmediately').checked,
      maxAttempts: Number.parseInt(document.getElementById('examMaxAttempts').value, 10) || 1,
      startDate: document.getElementById('examStartDate').value || null,
      endDate: document.getElementById('examEndDate').value || null,
      accessCode: document.getElementById('examAccessCode').value || null
    };

    DashboardLogger.debug('Exam data prepared', { title: data.title, duration: data.duration, marks: data.totalMarks });

    try {
      if (this.currentEditingExamId) {
        DashboardLogger.info('Updating existing exam', { examId: this.currentEditingExamId });
        await apiCall(`/exams/${this.currentEditingExamId}`, 'PUT', data);
        DashboardLogger.success('Exam updated successfully', { examId: this.currentEditingExamId });
        document.getElementById('examModal').style.display = 'none';
        this.currentEditingExamId = null;
        this.showSuccess('Exam updated successfully');
      } else {
        DashboardLogger.info('Creating new exam', { title: data.title });
        const result = await apiCall('/exams', 'POST', data);
        DashboardLogger.success('Exam created successfully', { examId: result.examId });
        
        // After creating exam, open question management
        this.currentExam = { id: result.examId, ...data };
        document.getElementById('examModal').style.display = 'none';
        document.getElementById('questionModal').style.display = 'flex';
        this.loadQuestions(result.examId);
        this.showSuccess('Exam created successfully! Now add questions.');
      }

      DashboardLogger.info('Refreshing exams list after save');
      await this.loadExams();
      this.loadDashboardStats();
      if (document.getElementById('examsView')?.classList.contains('active')) {
        this.loadExamsView();
      }
    } catch (err) {
      DashboardLogger.error('Failed to save exam', { message: err.message, stack: err.stack });
      this.showError('Error saving exam: ' + err.message);
    }
  }

  async deleteExam(examId) {
    DashboardLogger.warn('Delete exam requested', { examId });
    if (!confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      DashboardLogger.info('Delete exam cancelled by user', { examId });
      return;
    }

    DashboardLogger.warn('Deleting exam', { examId });
    try {
      await apiCall(`/exams/${examId}`, 'DELETE');
      DashboardLogger.success('Exam deleted successfully', { examId });
      this.showSuccess('Exam deleted successfully');
      
      DashboardLogger.info('Refreshing exams list after delete');
      await this.loadExams();
      this.loadDashboardStats();
      this.loadExamsView();
    } catch (err) {
      DashboardLogger.error('Failed to delete exam', { examId, message: err.message });
      this.showError('Error deleting exam: ' + err.message);
    }
  }

  manageQuestions(examId) {
    DashboardLogger.info('Opening question management for exam', { examId });
    try {
      this.currentExam = this.exams.find(e => e.id === examId);
      if (!this.currentExam) {
        DashboardLogger.error('Exam not found for question management', { examId });
        this.showError('Exam not found');
        return;
      }
      document.getElementById('questionModal').style.display = 'flex';
      this.loadQuestions(examId);
      DashboardLogger.debug('Question modal opened', { title: this.currentExam.title });
    } catch (err) {
      DashboardLogger.error('Failed to open question management', { examId, message: err.message });
      this.showError('Failed to open question management: ' + err.message);
    }
  }

  manageEnrollments(examId) {
    DashboardLogger.info('Opening enrollment management for exam', { examId });
    try {
      this.currentExam = this.exams.find(e => e.id === examId);
      if (!this.currentExam) {
        DashboardLogger.error('Exam not found for enrollment management', { examId });
        this.showError('Exam not found');
        return;
      }
      document.getElementById('enrollmentExamTitle').textContent = this.currentExam.title;
      document.getElementById('enrollmentModal').style.display = 'flex';
      this.loadEnrolledStudents(examId);
      DashboardLogger.debug('Enrollment modal opened', { title: this.currentExam.title });
    } catch (err) {
      DashboardLogger.error('Failed to open enrollment management', { examId, message: err.message });
      this.showError('Failed to open enrollment management: ' + err.message);
    }
  }

  async loadEnrolledStudents(examId) {
    DashboardLogger.info('Loading enrolled students for exam', { examId });
    try {
      const students = await apiCall(`/exams/${examId}/students`);
      DashboardLogger.success('Enrolled students loaded', { examId, count: students.length });
      
      const container = document.getElementById('enrolledStudentsList');
      if (!container) {
        DashboardLogger.error('Enrolled students container not found');
        return;
      }
      container.innerHTML = '';

      students.forEach(student => {
        const item = document.createElement('div');
        item.className = 'student-item';
        item.innerHTML = `
          <div>
            <div class="student-name">${student.fullName}</div>
            <div class="student-email">${student.email}</div>
          </div>
          <button class="btn-action btn-delete" onclick="dashboard.removeEnrollment(${examId}, ${student.id})">Remove</button>
        `;
        container.appendChild(item);
      });

      // Update enrolled count
      const countEl = document.getElementById('enrolledCount');
      if (countEl) {
        countEl.textContent = students.length;
        this.stats.studentsEnrolled = students.length;
      }
    } catch (err) {
      DashboardLogger.error('Failed to load enrolled students', { examId, message: err.message });
      this.showError('Failed to load enrolled students: ' + err.message);
    }
  }

  async enrollStudent(examId) {
    const studentEmail = document.getElementById('studentEmail').value.trim();
    DashboardLogger.info('Enroll student button clicked', { examId, email: studentEmail });
    
    if (!studentEmail) {
      DashboardLogger.warn('Empty student email in enrollment');
      this.showWarning('Please enter a student email');
      return;
    }

    try {
      DashboardLogger.debug('Searching for student by email', { email: studentEmail });
      // First, find student by email (we need to add this API endpoint)
      const student = await apiCall(`/users/search?email=${encodeURIComponent(studentEmail)}`);
      if (!student) {
        DashboardLogger.warn('Student not found', { email: studentEmail });
        this.showError('Student not found');
        return;
      }

      DashboardLogger.info('Enrolling student in exam', { examId, studentId: student.id, email: studentEmail });
      await apiCall(`/exams/${examId}/enroll`, 'POST', { studentId: student.id });
      DashboardLogger.success('Student enrolled successfully', { examId, email: studentEmail });
      this.showSuccess('Student enrolled successfully');
      document.getElementById('studentEmail').value = '';
      this.loadEnrolledStudents(examId);
    } catch (err) {
      DashboardLogger.error('Failed to enroll student', { examId, email: studentEmail, message: err.message });
      this.showError('Error enrolling student: ' + err.message);
    }
  }

  async removeEnrollment(examId, studentId) {
    DashboardLogger.warn('Remove enrollment requested', { examId, studentId });
    if (!confirm('Are you sure you want to remove this student from the exam?')) {
      DashboardLogger.info('Remove enrollment cancelled by user', { examId, studentId });
      return;
    }

    DashboardLogger.warn('Removing student enrollment', { examId, studentId });
    try {
      await apiCall(`/exams/${examId}/enroll/${studentId}`, 'DELETE');
      DashboardLogger.success('Student removed from exam', { examId, studentId });
      this.showSuccess('Student removed successfully');
      this.loadEnrolledStudents(examId);
    } catch (err) {
      DashboardLogger.error('Failed to remove student enrollment', { examId, studentId, message: err.message });
      this.showError('Error removing student: ' + err.message);
    }
  }

  async loadQuestions(examId) {
    DashboardLogger.info('Loading questions for exam', { examId });
    try {
      const questions = await apiCall(`/questions/exam/${examId}`);
      DashboardLogger.success('Questions loaded', { examId, count: questions.length });
      
      const container = document.getElementById('questionsList');
      if (!container) {
        DashboardLogger.error('Questions list container not found');
        return;
      }
      container.innerHTML = '';

      questions.forEach(q => {
        const item = document.createElement('div');
        item.className = 'question-item';
        item.innerHTML = `
          <div>
            <div class="question-text">[${q.type.toUpperCase()}] ${q.content.substring(0, 50)}...</div>
            <div class="row-info">Marks: ${q.marks}</div>
          </div>
          <button class="btn-action btn-delete" onclick="dashboard.deleteQuestion(${q.id})">Delete</button>
        `;
        container.appendChild(item);
      });
      this.stats.questionsAdded = questions.length;
    } catch (err) {
      DashboardLogger.error('Failed to load questions', { examId, message: err.message });
      this.showError('Failed to load questions: ' + err.message);
    }
  }

  openQuestionForm() {
    DashboardLogger.info('Opening question form');
    try {
      document.getElementById('questionForm').style.display = 'block';
      const contentEl = document.getElementById('questionContent');
      if (contentEl) contentEl.focus();
      
      // Reset form to default state
      document.getElementById('questionType').value = 'mcq';
      document.getElementById('mcqContainer').style.display = 'block'; // Show MCQ by default
      
      // Clear options list and add one default option
      document.getElementById('optionsList').innerHTML = '';
      this.addOptionInput();
      
      // Attach question type change listener
      const questionTypeSelect = document.getElementById('questionType');
      if (questionTypeSelect && !questionTypeSelect.hasAttribute('data-listener-attached')) {
        questionTypeSelect.addEventListener('change', (e) => {
          const isMcq = e.target.value === 'mcq';
          const mcqContainer = document.getElementById('mcqContainer');
          if (mcqContainer) {
            mcqContainer.style.display = isMcq ? 'block' : 'none';
            
            if (isMcq) {
              // Automatically add first option for MCQ
              const optionsList = document.getElementById('optionsList');
              if (optionsList && optionsList.children.length === 0) {
                this.addOptionInput();
              }
            }
          }
        });
        questionTypeSelect.setAttribute('data-listener-attached', 'true');
      }
      DashboardLogger.debug('Question form opened and initialized');
    } catch (err) {
      DashboardLogger.error('Failed to open question form', { message: err.message });
      this.showError('Failed to open question form: ' + err.message);
    }
  }

  addOptionInput() {
    try {
      const optionsList = document.getElementById('optionsList');
      if (!optionsList) {
        DashboardLogger.error('Options list container not found');
        return;
      }
      const optionId = optionsList.children.length;

      const optionInput = document.createElement('div');
      optionInput.className = 'option-input';
      optionInput.innerHTML = `
        <input type="text" placeholder="Option ${optionId + 1}" class="option-text">
        <input type="checkbox" class="option-correct" title="Mark as correct answer">
        <button type="button" class="btn-delete" onclick="this.parentElement.remove()">Remove</button>
      `;

      optionsList.appendChild(optionInput);
      DashboardLogger.debug('Option input added', { optionNumber: optionId + 1 });
    } catch (err) {
      DashboardLogger.error('Failed to add option input', { message: err.message });
    }
  }

  async saveQuestion() {
    const type = document.getElementById('questionType').value;
    const content = document.getElementById('questionContent').value.trim();
    const marks = Number.parseInt(document.getElementById('questionMarks').value, 10);

    if (!content || !marks || !this.currentExam) {
      alert('Please fill in all required fields');
      return;
    }

    const data = {
      examId: this.currentExam.id,
      type,
      content,
      marks
    };

    // Add options if MCQ
    if (type === 'mcq') {
      const answerType = document.getElementById('mcqAnswerType').value;
      const scoringMethod = document.getElementById('mcqScoringMethod').value;
      const optionInputs = document.querySelectorAll('.option-input');

      if (optionInputs.length === 0) {
        alert('Please add at least one option for MCQ');
        return;
      }

      data.answerType = answerType;
      data.scoringMethod = scoringMethod;
      data.options = [];

      let correctCount = 0;
      optionInputs.forEach(input => {
        const text = input.querySelector('.option-text').value.trim();
        const isCorrect = input.querySelector('.option-correct').checked;

        if (text) {
          data.options.push({ text, isCorrect });
          if (isCorrect) correctCount++;
        }
      });

      // Validation based on answer type
      if (answerType === 'single') {
        if (correctCount !== 1) {
          alert('Single answer questions must have exactly one correct answer');
          return;
        }
      } else if (answerType === 'multiple') {
        if (correctCount < 2) {
          alert('Multiple answer questions must have at least two correct answers');
          return;
        }
      }
    }

    try {
      await apiCall('/questions', 'POST', data);
      alert('Question added successfully');

      // Reset form manually since it's not a real form element
      document.getElementById('questionType').value = 'mcq';
      document.getElementById('questionContent').value = '';
      document.getElementById('questionMarks').value = '';
      document.getElementById('mcqAnswerType').value = 'single';
      document.getElementById('mcqScoringMethod').value = 'all-or-nothing';
      document.getElementById('optionsList').innerHTML = '';
      document.getElementById('mcqContainer').style.display = 'none';
      document.getElementById('questionForm').style.display = 'none';

      // Reload questions
      this.loadQuestions(this.currentExam.id);
    } catch (err) {
      alert('Error saving question: ' + err.message);
    }
  }

  async deleteQuestion(questionId) {
    if (!confirm('Delete this question?')) return;

    try {
      await apiCall(`/questions/${questionId}`, 'DELETE');
      this.loadQuestions(this.currentExam.id);
    } catch (err) {
      alert('Error deleting question: ' + err.message);
    }
  }

  async viewStudentDetails(studentName, examId, studentId) {
    document.getElementById('studentName').textContent = studentName;

    try {
      // Get violations for this student in this exam
      const violations = await apiCall(`/logs/exam/${examId}/violations`);
      const studentViolations = violations.filter(v => v.studentId === studentId || v.sessionId.includes(studentId.toString()));

      const container = document.getElementById('studentViolations');
      container.innerHTML = '';

      if (studentViolations.length === 0) {
        container.innerHTML = '<p>No violations recorded</p>';
      } else {
        studentViolations.forEach(v => {
          const item = document.createElement('div');
          item.className = 'violation-item';
          item.innerHTML = `
            <div class="violation-type">${v.violationType}</div>
            <div class="violation-time">${new Date(v.timestamp).toLocaleString()}</div>
          `;
          container.appendChild(item);
        });
      }

      document.getElementById('studentDetailsModal').style.display = 'flex';
    } catch (err) {
      console.error('Failed to load student details:', err);
      alert('Could not load student details');
    }
  }

  populateExamSelects() {
    const selects = [
      document.getElementById('examSelectMonitoring'),
      document.getElementById('examSelectResults')
    ];

    selects.forEach(select => {
      if (select) {
        select.innerHTML = '<option value="">Select Exam</option>';
        this.exams.forEach(exam => {
          const option = document.createElement('option');
          option.value = exam.id;
          option.textContent = exam.title;
          select.appendChild(option);
        });
      }
    });
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
    DashboardLogger.error('Showing error toast', { message });
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

  showSuccess(message) {
    DashboardLogger.success('Showing success toast', { message });
    let successEl = document.getElementById('successToast');
    if (!successEl) {
      successEl = document.createElement('div');
      successEl.id = 'successToast';
      successEl.style.cssText = `
        position: fixed; top: 20px; right: 20px; max-width: 400px;
        background: #28a745; color: white; padding: 15px; border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10001;
        font-family: Arial, sans-serif; font-size: 14px;
      `;
      document.body.appendChild(successEl);
    }
    successEl.textContent = message;
    successEl.style.display = 'block';
    setTimeout(() => {
      successEl.style.display = 'none';
    }, 4001);
  }

  showWarning(message) {
    DashboardLogger.warn('Showing warning toast', { message });
    let warningEl = document.getElementById('warningToast');
    if (!warningEl) {
      warningEl = document.createElement('div');
      warningEl.id = 'warningToast';
      warningEl.style.cssText = `
        position: fixed; top: 20px; right: 20px; max-width: 400px;
        background: #ffc107; color: #333; padding: 15px; border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10001;
        font-family: Arial, sans-serif; font-size: 14px;
      `;
      document.body.appendChild(warningEl);
    }
    warningEl.textContent = message;
    warningEl.style.display = 'block';
    setTimeout(() => {
      warningEl.style.display = 'none';
    }, 4501);
  }
}

// Global instance
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
  dashboard = new OrganizerDashboard();
});
