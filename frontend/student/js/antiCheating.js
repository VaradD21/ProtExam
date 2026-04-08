// Anti-cheating Detection System
// This module implements comprehensive monitoring of student behavior to detect cheating

class AntiCheatSystem {
  constructor() {
    this.sessionId = null;
    this.violations = 0;
    this.violationThreshold = 3; // Auto-submit after 3 violations
    this.events = [];
    this.isFullscreen = false;
    this.inactivityTimer = null;
    this.inactivityTimeout = 60000; // 1 minute
    this.fullscreenExitCount = 0;
    this.fullscreenExitWarnings = 0;
    this.examSocket = null;

    this.initializeSocket();
    this.initializeDetection();
  }

  initializeSocket() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO client is not loaded; real-time monitoring will be unavailable.');
      return;
    }

    try {
      this.examSocket = window.examSocket = io({
        auth: { token: getToken() }
      });

      this.examSocket.on('connect', () => {
        console.log('Connected to monitoring socket:', this.examSocket.id);
      });

      this.examSocket.on('connect_error', (err) => {
        console.error('Socket connection failed:', err);
      });

      this.examSocket.on('violation_logged', (data) => {
        console.log('Violation logged event received:', data);
      });

      this.examSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    } catch (err) {
      console.error('Failed to initialize monitor socket:', err);
    }
  }

  initializeDetection() {
    console.log('Anti-cheat system initialized');

    // Fullscreen detection
    this.detectFullscreenExit();

    // Tab/visibility detection
    this.detectTabSwitching();

    // Devtools detection
    this.detectDevtools();

    // Disable context menu
    this.disableRightClick();

    // Disable copy/paste
    this.disableCopyPaste();

    // Keyboard shortcuts detection
    this.detectKeyboardShortcuts();

    // Mouse leaving window
    this.detectMouseLeave();

    // Activity monitoring
    this.setupActivityMonitoring();
  }

  // Detect when user exits fullscreen mode
  detectFullscreenExit() {
    const fullscreenElements = [
      'fullscreenchange',
      'webkitfullscreenchange',
      'mozfullscreenchange',
      'msfullscreenchange'
    ];

    fullscreenElements.forEach(event => {
      document.addEventListener(event, () => {
        const isCurrentlyFullscreen = !!(document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement);

        if (!isCurrentlyFullscreen && this.isFullscreen) {
          // Exited fullscreen
          this.fullscreenExitCount++;
          this.logViolation('fullscreen_exit', {
            timestamp: Date.now(),
            exitCount: this.fullscreenExitCount
          }, 'high');

          this.handleFullscreenExit();
          this.isFullscreen = false;
        } else if (isCurrentlyFullscreen && !this.isFullscreen) {
          // Entered fullscreen
          this.isFullscreen = true;
          this.fullscreenExitWarnings = 0; // Reset warnings when entering fullscreen
        }
      });
    });
  }

  handleFullscreenExit() {
    this.fullscreenExitWarnings++;

    if (this.fullscreenExitWarnings === 1) {
      this.showWarning('Warning: You exited full screen mode. Please return to full screen to continue the exam.');
      // Try to re-enter fullscreen
      setTimeout(() => {
        this.requestFullscreen();
      }, 2000);
    } else if (this.fullscreenExitWarnings === 2) {
      this.showWarning('Second warning: You exited full screen mode again. One more exit will result in automatic exam submission.');
      setTimeout(() => {
        this.requestFullscreen();
      }, 2000);
    } else if (this.fullscreenExitWarnings >= 3) {
      this.showError('Third fullscreen exit detected. Exam will be submitted automatically.');
      // Auto-submit the exam
      setTimeout(() => {
        if (window.examInterface) {
          window.examInterface.submitExam(true);
        }
      }, 3000);
    }
  }

  // Detect tab switching using visibilitychange API
  detectTabSwitching() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // User switched away from tab
        this.logViolation('tab_switch_away', {
          timestamp: Date.now(),
          hidden: true
        }, 'high');
        this.showWarning('You switched to another tab! (Violation recorded)');
      } else {
        // User switched back to tab
        this.logViolation('tab_switch_back', {
          timestamp: Date.now(),
          hidden: false
        }, 'medium');
        this.showWarning('Welcome back to exam');
      }
    });

    // Keyboard focus loss detection
    window.addEventListener('blur', () => {
      this.logViolation('window_blur', { timestamp: Date.now() }, 'low');
    });

    window.addEventListener('focus', () => {
      console.log('Window focused');
    });
  }

  // Detect devtools opening
  detectDevtools() {
    const devtoolsThreshold = 160; // Height/width threshold for detecting devtools

    // Check console opening
    let lastCheck = Date.now();
    setInterval(() => {
      const now = Date.now();
      if (now - lastCheck > 500) {
        // Time jump detected - might indicate devtools was opened
        this.logViolation('devtools_potential', {
          timestamp: Date.now(),
          timeLapse: now - lastCheck
        }, 'medium');
      }
      lastCheck = now;
    }, 100);

    // F12, Ctrl+Shift+I, Ctrl+Shift+C detection
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J')) ||
          (e.ctrlKey && e.key === 'Shift' && e.key === 'K')) {
        e.preventDefault();
        this.logViolation('devtools_hotkey', {
          timestamp: Date.now(),
          key: e.key
        }, 'high');
        this.showWarning('Developer tools are not allowed!');
      }
    });
  }

  // Disable right-click context menu
  disableRightClick() {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.logViolation('right_click', { timestamp: Date.now() }, 'low');
      return false;
    });
  }

  // Disable copy, cut, paste
  disableCopyPaste() {
    // Copy detection
    document.addEventListener('copy', (e) => {
      e.preventDefault();
      this.logViolation('copy_attempt', { timestamp: Date.now() }, 'medium');
      this.showWarning('Copying is disabled during exam');
      return false;
    });

    // Paste detection
    document.addEventListener('paste', (e) => {
      e.preventDefault();
      this.logViolation('paste_attempt', { timestamp: Date.now() }, 'high');
      this.showWarning('Pasting is disabled during exam');
      return false;
    });

    // Cut detection
    document.addEventListener('cut', (e) => {
      e.preventDefault();
      this.logViolation('cut_attempt', { timestamp: Date.now() }, 'medium');
      return false;
    });
  }

  // Detect keyboard shortcuts (Ctrl+A, Ctrl+S, etc.)
  detectKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const forbiddenCombos = [
        { ctrl: true, key: 'a' },  // Select all
        { ctrl: true, key: 's' },  // Save
        { ctrl: true, key: 'p' },  // Print
        { alt: true, key: 'Tab' }, // Alt+Tab
        { key: 'PrintScreen' }     // Print Screen
      ];

      forbiddenCombos.forEach(combo => {
        const matches = (combo.ctrl === undefined || combo.ctrl === e.ctrlKey) &&
                       (combo.alt === undefined || combo.alt === e.altKey) &&
                       (combo.shift === undefined || combo.shift === e.shiftKey) &&
                       e.key.toLowerCase() === combo.key.toLowerCase();

        if (matches) {
          e.preventDefault();
          this.logViolation('forbidden_shortcut', {
            timestamp: Date.now(),
            combo: `${combo.ctrl ? 'Ctrl+' : ''}${combo.alt ? 'Alt+' : ''}${combo.key}`
          }, 'low');
          return false;
        }
      });
    });

    // Print Screen detection
    document.addEventListener('keyup', (e) => {
      if (e.key === 'PrintScreen') {
        this.logViolation('screenshot_attempt', { timestamp: Date.now() }, 'medium');
      }
    });
  }

  // Detect mouse leaving exam window
  detectMouseLeave() {
    document.addEventListener('mouseleave', () => {
      this.logViolation('mouse_leave', { timestamp: Date.now() }, 'low');
      this.showWarning('Your mouse left the exam window');
    });

    document.addEventListener('mouseenter', () => {
      // User back to window
    });
  }

  // Track user inactivity
  setupActivityMonitoring() {
    const resetInactivityTimer = () => {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = setTimeout(() => {
        this.logViolation('inactivity', {
          timestamp: Date.now(),
          duration: this.inactivityTimeout
        }, 'low');
      }, this.inactivityTimeout);
    };

    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keypress', resetInactivityTimer);
    document.addEventListener('click', resetInactivityTimer);

    resetInactivityTimer();
  }

  // Log violation to server and local storage
  logViolation(type, details, severity = 'low') {
    // Don't log violations if exam is already being submitted
    if (window.examInterface && window.examInterface.isSubmitted) {
      return;
    }

    this.violations++;
    
    const violation = {
      type,
      details,
      severity,
      timestamp: Date.now()
    };

    this.events.push(violation);

    // Send to server if session exists
    if (this.sessionId) {
      fetch('/api/logs/violation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          violationType: type,
          timestamp: Date.now(),
          details,
          severity
        })
      }).catch(err => console.error('Failed to log violation:', err));

      // Notify via WebSocket if available
      if (this.examSocket && this.examSocket.connected) {
        this.examSocket.emit('log_violation', {
          sessionId: this.sessionId,
          violationType: type,
          timestamp: Date.now(),
          details
        });
      }
    }

    // Check if violations exceed threshold
    if (this.violations >= this.violationThreshold) {
      this.handleExcessiveViolations();
    }

    console.warn(`Violation detected: ${type}`, details);
  }

  // Handle situation when violations exceed threshold
  handleExcessiveViolations() {
    console.error('Excessive violations detected. Triggering auto-submit...');
    // Will be called by exam interface to trigger auto-submit
    if (window.examInterface && window.examInterface.autoSubmit) {
      window.examInterface.autoSubmit('Due to excessive violations, your exam is being submitted.');
    }
  }

  // Show warning to user
  showWarning(message) {
    const warningEl = document.getElementById('violationWarning');
    const textEl = document.getElementById('violationText');

    if (warningEl && textEl) {
      textEl.textContent = message;
      warningEl.style.display = 'flex';

      setTimeout(() => {
        warningEl.style.display = 'none';
      }, 4000);
    }
  }

  // Set session ID
  setSessionId(sessionId) {
    this.sessionId = sessionId;

    if (this.examSocket && this.examSocket.connected) {
      this.examSocket.emit('exam_start', {
        studentId: getUser()?.id,
        examId: window.examInterface?.exam?.id,
        sessionId
      });
    }
  }

  // Notify server about exam end
  notifyExamEnd(sessionId) {
    if (this.examSocket && this.examSocket.connected) {
      this.examSocket.emit('exam_end', { sessionId });
    }
  }

  // Get violation count
  getViolationCount() {
    return this.violations;
  }

  // Get all events
  getEvents() {
    return this.events;
  }

  // Enter fullscreen
  async requestFullscreen(element = document.documentElement) {
    try {
      let fsPromise = null;

      // Try standard Fullscreen API first
      if (element.requestFullscreen) {
        fsPromise = element.requestFullscreen();
      }
      // Webkit (Chrome, Safari)
      else if (element.webkitRequestFullscreen) {
        fsPromise = element.webkitRequestFullscreen();
      }
      // Mozilla (Firefox)
      else if (element.mozRequestFullScreen) {
        fsPromise = element.mozRequestFullScreen();
      }
      // Microsoft (Edge, IE)
      else if (element.msRequestFullscreen) {
        fsPromise = element.msRequestFullscreen();
      }
      // No fullscreen API available
      else {
        throw new Error('Fullscreen API not supported in this browser');
      }

      // Wait for the promise if it returns one
      if (fsPromise && typeof fsPromise.then === 'function') {
        await fsPromise;
      }

      // Set a timeout to check if fullscreen was actually entered
      await new Promise((resolve) => {
        setTimeout(() => {
          const isFullscreen = !!(document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement);
          
          if (isFullscreen) {
            this.isFullscreen = true;
            console.log('✓ Fullscreen mode activated');
            resolve();
          } else {
            console.warn('⚠ Fullscreen may not have been fully activated');
            this.isFullscreen = true; // Continue anyway
            resolve();
          }
        }, 500);
      });
    } catch (err) {
      console.error('❌ Fullscreen request failed:', err);
      throw new Error(`Fullscreen unavailable: ${err.message}. Please use a modern browser.`);
    }
  }
}

// Create global instance
window.antiCheat = new AntiCheatSystem();
