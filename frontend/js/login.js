// Configuration
const ROLE_STUDENT = 'student';
const ROLE_ORGANIZER = 'organizer';

let currentRole = ROLE_STUDENT;
let isRegistering = false;

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
  // Initialize form elements after DOM is ready
  elements = {
    authForm: document.getElementById('authForm'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    fullNameInput: document.getElementById('fullName'),
    submitBtn: document.getElementById('submitBtn'),
    toggleRegister: document.getElementById('toggleRegister'),
    registerFields: document.getElementById('registerFields'),
    errorMessage: document.getElementById('errorMessage'),
    successMessage: document.getElementById('successMessage'),
    roleBtns: document.querySelectorAll('.role-btn')
  };

  // Set up event listeners
  elements.roleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      elements.roleBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentRole = e.target.dataset.role;
    });
  });

  elements.toggleRegister.addEventListener('click', (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    updateForm();
  });

  elements.authForm.addEventListener('submit', handleAuth);
});

function updateForm() {
  const btnText = isRegistering ? 'Register' : 'Login';
  elements.submitBtn.textContent = btnText;
  elements.registerFields.style.display = isRegistering ? 'block' : 'none';
  
  if (isRegistering) {
    elements.fullNameInput.required = true;
    elements.toggleRegister.textContent = 'Already have an account? Login';
  } else {
    elements.fullNameInput.required = false;
    elements.toggleRegister.textContent = 'Don\'t have an account? Register';
  }
  
  clearMessages();
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = 'block';
  elements.successMessage.style.display = 'none';
}

function showSuccess(message) {
  elements.successMessage.textContent = message;
  elements.successMessage.style.display = 'block';
  elements.errorMessage.style.display = 'none';
}

function clearMessages() {
  elements.errorMessage.style.display = 'none';
  elements.successMessage.style.display = 'none';
}

async function handleAuth(e) {
  e.preventDefault();
  clearMessages();

  const email = elements.emailInput.value.trim();
  const password = elements.passwordInput.value;

  // Enhanced validation
  if (!email) {
    showError('Please enter your email address');
    elements.emailInput.focus();
    return;
  }

  if (!isValidEmail(email)) {
    showError('Please enter a valid email address');
    elements.emailInput.focus();
    return;
  }

  if (!password) {
    showError('Please enter your password');
    elements.passwordInput.focus();
    return;
  }

  if (password.length < 6) {
    showError('Password must be at least 6 characters long');
    elements.passwordInput.focus();
    return;
  }

  if (isRegistering) {
    const fullName = elements.fullNameInput.value.trim();
    if (!fullName) {
      showError('Please enter your full name');
      elements.fullNameInput.focus();
      return;
    }
    if (fullName.length < 2) {
      showError('Full name must be at least 2 characters long');
      elements.fullNameInput.focus();
      return;
    }
  }

  // Show loading state
  setLoading(true);

  try {
    const endpoint = isRegistering ? '/register' : '/login';
    const payload = {
      email,
      password,
      role: currentRole
    };

    if (isRegistering) {
      payload.fullName = elements.fullNameInput.value.trim();
    }

    const data = await apiCall(`/auth${endpoint}`, 'POST', payload);

    if (!data.token) {
      throw new Error('No token received from server');
    }
    if (!data.user) {
      throw new Error('No user data received from server');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    if (isRegistering) {
      showSuccess('Registration successful! Redirecting to exam list...');
      setTimeout(() => {
        redirectToRole(currentRole);
      }, 1500);
    } else {
      redirectToRole(currentRole);
    }

  } catch (err) {
    console.error(err);
    showError(err.message || 'Authentication failed. Please try again.');
  } finally {
    setLoading(false);
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function setLoading(loading) {
  if (!elements.submitBtn) {
    console.error('submitBtn not found in elements:', elements);
    return;
  }

  elements.submitBtn.disabled = loading;
  const btnText = elements.submitBtn.querySelector('.btn-text');
  const spinner = elements.submitBtn.querySelector('.loading-spinner');

  if (btnText) {
    btnText.textContent = loading ? 'Please wait...' : (isRegistering ? 'Register' : 'Login');
  }
  
  if (spinner) {
    spinner.style.display = loading ? 'block' : 'none';
  }

  // Disable form inputs during loading
  if (elements.emailInput) elements.emailInput.disabled = loading;
  if (elements.passwordInput) elements.passwordInput.disabled = loading;
  if (isRegistering && elements.fullNameInput) {
    elements.fullNameInput.disabled = loading;
  }
  if (elements.roleBtns) {
    elements.roleBtns.forEach(btn => btn.disabled = loading);
  }
}

function redirectToRole(role) {
  if (role === ROLE_STUDENT) {
    window.location.href = '/student/examList.html';
  } else if (role === ROLE_ORGANIZER) {
    window.location.href = '/organizer/';
  }
}
