/**
 * Theme switching functionality for Chess Tournament Manager
 */

// Function to set theme
function setTheme(themeName) {
  localStorage.setItem('theme', themeName);
  document.documentElement.setAttribute('data-theme', themeName);
  updateThemeIcon(themeName);
}

// Function to toggle between light and dark themes
function toggleTheme() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  // Apply theme with smooth transition
  document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  setTheme(newTheme);
  
  // Add animation to cards and other elements
  animateThemeChange();
  
  return newTheme;
}

// Function to update the theme toggle icon
function updateThemeIcon(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.innerHTML = theme === 'dark' 
      ? '<i class="bi bi-sun-fill"></i>' 
      : '<i class="bi bi-moon-fill"></i>';
    
    // Add tooltip text
    themeToggle.title = theme === 'dark' 
      ? 'Switch to Light Mode' 
      : 'Switch to Dark Mode';
  }
}

// Function to animate theme change
function animateThemeChange() {
  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    setTimeout(() => {
      card.style.transition = 'all 0.3s ease';
      card.classList.add('theme-transition');
      setTimeout(() => {
        card.classList.remove('theme-transition');
      }, 500);
    }, index * 50); // Stagger the animations
  });
}

// Function to initialize theme
function initTheme() {
  // Check for saved theme preference or use device preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Set initial theme
  if (savedTheme) {
    setTheme(savedTheme);
  } else if (prefersDark) {
    setTheme('dark');
  } else {
    setTheme('light');
  }
  
  // Create theme toggle button if it doesn't exist
  if (!document.getElementById('theme-toggle')) {
    const themeToggle = document.createElement('button');
    themeToggle.id = 'theme-toggle';
    themeToggle.className = 'theme-toggle';
    themeToggle.setAttribute('aria-label', 'Toggle Dark/Light Mode');
    
    // Add click event
    themeToggle.addEventListener('click', toggleTheme);
    
    // Add to body
    document.body.appendChild(themeToggle);
    
    // Update icon
    updateThemeIcon(localStorage.getItem('theme') || 'light');
  }
  
  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Add CSS for theme transition animation
const style = document.createElement('style');
style.textContent = `
  .theme-transition {
    transform: scale(1.02);
  }
  
  @media (prefers-reduced-motion: reduce) {
    body, .card, .btn, .form-control, * {
      transition: none !important;
    }
  }
`;
document.head.appendChild(style);

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', initTheme); 