// Organizer Dashboard Main Logic

class OrganizerDashboard {
  constructor() {
    this.exams = [];
    this.currentExam = null;
    this.currentEditingExamId = null;
    this.activeStudents = {};

    this.init();
  }

  async init() {
    if (!checkAuth()) return;

    const user = getUser();
    console.log('Organizer dashboard - User:', user);
    
    if (user.role !== 'organizer') {
      alert('Access denied. Only organizers can access this page. Your role: ' + user.role);
      clearAuth();
      window.location.href = '/login.html';
      return;
    }

    document.getElementById('userName').textContent = user.fullName;

    this.showLoading('Initializing dashboard...');
    try {
      this.setupEventListeners();
      await this.loadExams();
      this.setupViewSwitching();
      this.loadDashboardStats();
      this.hideLoading();
    } catch (err) {
      this.hideLoading();
      this.showError('Failed to initialize dashboard: ' + err.message);
      console.error('Dashboard initialization error:', err);
    }
  }

  setupEventListeners() {
    // View switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        clearAuth();
        window.location.href = '/login.html';
      }
    });

    // Create exam
    document.getElementById('createExamBtn').addEventListener('click', () => this.openExamModal());

    // Exam form
    document.getElementById('examForm').addEventListener('submit', (e) => this.saveExam(e));

    // Modal close buttons
    document.querySelectorAll('.btn-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
      });
    });

    // Cancel buttons
    document.querySelectorAll('.btn-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
      });
    });

    // Exam select for monitoring
    document.getElementById('examSelectMonitoring').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadMonitoringData(parseInt(e.target.value));
      }
    });

    // Exam select for results
    document.getElementById('examSelectResults').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadResults(parseInt(e.target.value));
      }
    });

    // Add question button
    document.getElementById('addQuestionBtn')?.addEventListener('click', () => {
      this.openQuestionForm();
    });

    document.getElementById('addOptionBtn')?.addEventListener('click', () => {
      this.addOptionInput();
    });

    document.getElementById('saveQuestionBtn')?.addEventListener('click', () => {
      this.saveQuestion();
    });

    document.getElementById('cancelQuestionBtn')?.addEventListener('click', () => {
      document.getElementById('questionForm').style.display = 'none';
    });
  }

  setupViewSwitching() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns[0].click(); // Load dashboard by default
  }

  switchView(viewName) {
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

    document.getElementById(viewName + 'View').classList.add('active');

    // Load view-specific data
    if (viewName === 'exams') {
      this.loadExamsView();
    } else if (viewName === 'monitoring') {
      this.loadMonitoringView();
    } else if (viewName === 'results') {
      this.loadResultsView();
    }
  }

  async loadExams() {
    try {
      this.exams = await apiCall('/exams');
      console.log('Exams loaded:', this.exams);

      // Populate dropdowns
      this.populateExamSelects();
    } catch (err) {
      console.error('Failed to load exams:', err);
      this.showError('Unable to load exams. Please check your connection and try again.');
    }
  }

  async loadDashboardStats() {
    try {
      const exams = await apiCall('/exams');
      document.getElementById('totalExams').textContent = exams.length;

      // Count stats
      let draft = exams.filter(e => e.status === 'draft').length;
      let published = exams.filter(e => e.status === 'published').length;

      // For now, showing recent exams
      this.renderRecentExams(exams);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  renderRecentExams(exams) {
    const container = document.getElementById('recentExamsList');
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
    const container = document.getElementById('examsList');
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
          <button class="btn-action" onclick="dashboard.editExam(${exam.id})">Edit</button>
          <button class="btn-action" onclick="dashboard.manageQuestions(${exam.id})">Questions</button>
          <button class="btn-action" onclick="dashboard.manageEnrollments(${exam.id})">Enroll</button>
        </div>
        <div>
          <button class="btn-action btn-delete" onclick="dashboard.deleteExam(${exam.id})">Delete</button>
        </div>
      `;
      container.appendChild(row);
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
      // Get enrolled students
      const students = await apiCall(`/exams/${examId}/students`);
      const container = document.getElementById('studentMonitoringList');
      container.innerHTML = '';

      students.forEach(student => {
        const row = document.createElement('div');
        row.className = 'student-row';

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
    this.currentEditingExamId = null;
    document.getElementById('modalTitle').textContent = 'Create New Exam';
    document.getElementById('examForm').reset();
    document.getElementById('examModal').style.display = 'flex';
  }

  editExam(examId) {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) return;

    this.currentEditingExamId = examId;
    document.getElementById('modalTitle').textContent = 'Edit Exam';
    document.getElementById('examTitle').value = exam.title;
    document.getElementById('examDescription').value = exam.description || '';
    document.getElementById('examDuration').value = exam.duration;
    document.getElementById('examTotalMarks').value = exam.totalMarks;
    document.getElementById('examPassingMarks').value = exam.passingMarks;
    document.getElementById('examInstructions').value = exam.instructions || '';

    document.getElementById('examModal').style.display = 'flex';
  }

  async saveExam(e) {
    e.preventDefault();

    const user = getUser();
    const token = getToken();
    console.log('Save exam - User:', user);
    console.log('Save exam - Token exists:', !!token);

    if (!user || user.role !== 'organizer') {
      alert('You must be logged in as an organizer to create exams.');
      return;
    }

    const data = {
      title: document.getElementById('examTitle').value,
      description: document.getElementById('examDescription').value,
      duration: parseInt(document.getElementById('examDuration').value),
      totalMarks: parseInt(document.getElementById('examTotalMarks').value),
      passingMarks: parseInt(document.getElementById('examPassingMarks').value),
      instructions: document.getElementById('examInstructions').value,
      weightage: parseFloat(document.getElementById('examWeightage').value) || 1.0,
      rules: document.getElementById('examRules').value,
      shuffleQuestions: document.getElementById('shuffleQuestions').checked,
      shuffleOptions: document.getElementById('shuffleOptions').checked,
      allowReview: document.getElementById('allowReview').checked,
      showResultsImmediately: document.getElementById('showResultsImmediately').checked,
      maxAttempts: parseInt(document.getElementById('examMaxAttempts').value) || 1,
      startDate: document.getElementById('examStartDate').value || null,
      endDate: document.getElementById('examEndDate').value || null,
      accessCode: document.getElementById('examAccessCode').value || null
    };

    try {
      if (this.currentEditingExamId) {
        await apiCall(`/exams/${this.currentEditingExamId}`, 'PUT', data);
        alert('Exam updated successfully');
      } else {
        const result = await apiCall('/exams', 'POST', data);
        // After creating exam, open question management
        this.currentExam = { id: result.examId, ...data };
        document.getElementById('examModal').style.display = 'none';
        document.getElementById('questionModal').style.display = 'flex';
        this.loadQuestions(result.examId);
        alert('Exam created successfully! Now add questions.');
      }

      await this.loadExams();
      this.loadDashboardStats();
      if (document.getElementById('examsView').classList.contains('active')) {
        this.loadExamsView();
      }
    } catch (err) {
      alert('Error saving exam: ' + err.message);
    }
  }

  async deleteExam(examId) {
    if (!confirm('Are you sure you want to delete this exam?')) return;

    try {
      await apiCall(`/exams/${examId}`, 'DELETE');
      alert('Exam deleted successfully');
      await this.loadExams();
      this.loadDashboardStats();
      this.loadExamsView();
    } catch (err) {
      alert('Error deleting exam: ' + err.message);
    }
  }

  manageQuestions(examId) {
    this.currentExam = this.exams.find(e => e.id === examId);
    document.getElementById('questionModal').style.display = 'flex';
    this.loadQuestions(examId);
  }

  manageEnrollments(examId) {
    this.currentExam = this.exams.find(e => e.id === examId);
    document.getElementById('enrollmentExamTitle').textContent = this.currentExam.title;
    document.getElementById('enrollmentModal').style.display = 'flex';
    this.loadEnrolledStudents(examId);
  }

  async loadEnrolledStudents(examId) {
    try {
      const students = await apiCall(`/exams/${examId}/students`);
      const container = document.getElementById('enrolledStudentsList');
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
      document.getElementById('enrolledCount').textContent = students.length;
    } catch (err) {
      console.error('Failed to load enrolled students:', err);
    }
  }

  async enrollStudent(examId) {
    const studentEmail = document.getElementById('studentEmail').value.trim();
    if (!studentEmail) {
      alert('Please enter a student email');
      return;
    }

    try {
      // First, find student by email (we need to add this API endpoint)
      const student = await apiCall(`/users/search?email=${encodeURIComponent(studentEmail)}`);
      if (!student) {
        alert('Student not found');
        return;
      }

      await apiCall(`/exams/${examId}/enroll`, 'POST', { studentId: student.id });
      alert('Student enrolled successfully');
      document.getElementById('studentEmail').value = '';
      this.loadEnrolledStudents(examId);
    } catch (err) {
      alert('Error enrolling student: ' + err.message);
    }
  }

  async removeEnrollment(examId, studentId) {
    if (!confirm('Are you sure you want to remove this student from the exam?')) return;

    try {
      await apiCall(`/exams/${examId}/enroll/${studentId}`, 'DELETE');
      alert('Student removed successfully');
      this.loadEnrolledStudents(examId);
    } catch (err) {
      alert('Error removing student: ' + err.message);
    }
  }

  async loadQuestions(examId) {
    try {
      const questions = await apiCall(`/questions/exam/${examId}`);
      const container = document.getElementById('questionsList');
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
    } catch (err) {
      console.error('Failed to load questions:', err);
    }
  }

  openQuestionForm() {
    document.getElementById('questionForm').style.display = 'block';
    document.getElementById('questionContent').focus();
    
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
  }

  addOptionInput() {
    const optionsList = document.getElementById('optionsList');
    const optionId = optionsList.children.length;

    const optionInput = document.createElement('div');
    optionInput.className = 'option-input';
    optionInput.innerHTML = `
      <input type="text" placeholder="Option ${optionId + 1}" class="option-text">
      <input type="checkbox" class="option-correct" title="Mark as correct answer">
      <button type="button" class="btn-delete" onclick="this.parentElement.remove()">Remove</button>
    `;

    optionsList.appendChild(optionInput);
  }

  async saveQuestion() {
    const type = document.getElementById('questionType').value;
    const content = document.getElementById('questionContent').value.trim();
    const marks = parseInt(document.getElementById('questionMarks').value);

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
}

// Global instance
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
  dashboard = new OrganizerDashboard();
});
