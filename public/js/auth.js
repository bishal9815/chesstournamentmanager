/**
 * Authentication utilities for Chess Tournament Manager
 */

// Check if user is logged in
function isLoggedIn() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return !!(token && user && Object.keys(user).length > 0);
}

// Get current user
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('user') || '{}');
}

// Update navigation based on authentication status
function updateNavigation() {
  const loginItem = document.getElementById('login-item');
  const profileDropdown = document.getElementById('profile-dropdown');
  const usernameElement = document.getElementById('username');
  const authButtons = document.getElementById('auth-buttons');
  
  if (isLoggedIn()) {
    // User is logged in
    if (loginItem) loginItem.classList.add('d-none');
    if (profileDropdown) {
      profileDropdown.classList.remove('d-none');
      const user = getCurrentUser();
      if (usernameElement && user.username) {
        usernameElement.textContent = user.username;
      }
    }
    
    // Update auth buttons if they exist
    if (authButtons) {
      authButtons.innerHTML = `
        <a href="/quick-tournament-setup.html" class="btn btn-primary">Create Tournament</a>
      `;
    }
  } else {
    // User is not logged in
    if (loginItem) loginItem.classList.remove('d-none');
    if (profileDropdown) profileDropdown.classList.add('d-none');
    
    // Update auth buttons if they exist
    if (authButtons) {
      authButtons.innerHTML = `
        <a href="/login.html" class="btn btn-primary">Login to Create Tournament</a>
      `;
    }
  }
}

// Handle logout
function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to home page
      window.location.href = '/';
    });
  }
}

// Check if current page is a protected page that requires login
function checkProtectedPage() {
  // List of pages that require login
  const protectedPages = [
    '/dashboard.html',
    '/quick-tournament-setup.html',
    '/player-registration-chesscom.html',
    '/my-tournaments.html',
    '/profile.html',
    '/tournament-edit.html'
  ];
  
  const currentPath = window.location.pathname;
  
  // Check if current page is protected
  if (protectedPages.some(page => currentPath.includes(page))) {
    if (!isLoggedIn()) {
      // Redirect to login with return URL
      window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
      return true;
    }
  }
  
  // Special case for dashboard - if not logged in, redirect to index instead of login
  if (currentPath.includes('/dashboard.html') && !isLoggedIn()) {
    window.location.href = '/';
    return true;
  }
  
  return false;
}

// Initialize authentication
function initAuth() {
  // First check if this is a protected page
  if (checkProtectedPage()) {
    return; // Stop execution if redirecting
  }
  
  // Update navigation
  updateNavigation();
  
  // Setup logout
  setupLogout();
  
  // Special case for index.html - redirect to dashboard if logged in
  if (window.location.pathname === '/' || window.location.pathname.includes('/index.html')) {
    if (isLoggedIn()) {
      window.location.href = '/dashboard.html';
      return;
    }
  }
}

// Add event listener to run when DOM is loaded
document.addEventListener('DOMContentLoaded', initAuth); 