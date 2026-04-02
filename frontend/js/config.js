// Configuration - Dynamic API base URL
const API_BASE = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port + '/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(API_BASE + endpoint, options);

    // Handle different response types
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (response.status === 401) {
      clearAuth();
      window.location.href = '/login.html';
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const errorMessage = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to server. Please check your connection.');
    }
    throw error;
  }
}

function checkAuth() {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    window.location.href = '/login.html';
    return false;
  }

  return true;
}
