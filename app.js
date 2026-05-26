/**
 * SWIFTHIRE - Core Application JavaScript
 * Modern ES6+ with modular architecture
 */

// ============================================
// FIREBASE IMPORTS
// ============================================
import { auth, db } from './config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  APP_NAME: 'Swifthire',
  APP_VERSION: '1.0.0',
  API_BASE_URL: '/api/v1',
  ITEMS_PER_PAGE: 10,
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 5000,
  ANIMATION_DURATION: 300
};

// ============================================
// STATE MANAGEMENT
// ============================================
class StateManager {
  constructor() {
    this.state = {
      user: null,
      isAuthenticated: false,
      isSidebarCollapsed: false,
      notifications: [],
      theme: 'light',
      language: 'en'
    };
    this.listeners = new Map();
    this.loadFromStorage();
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.notify(key, value, oldValue);
    this.saveToStorage();
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.unsubscribe(key, callback);
  }

  unsubscribe(key, callback) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).delete(callback);
    }
  }

  notify(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        callback(newValue, oldValue);
      });
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem('swifthire_state', JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('swifthire_state');
      if (saved) {
        this.state = { ...this.state, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
  }

  clear() {
    this.state = {
      user: null,
      isAuthenticated: false,
      isSidebarCollapsed: false,
      notifications: [],
      theme: 'light',
      language: 'en'
    };
    this.saveToStorage();
  }
}

const appState = new StateManager();

// ============================================
// UTILITY FUNCTIONS
// ============================================
const Utils = {
  debounce(fn, delay = CONFIG.DEBOUNCE_DELAY) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  formatDate(date, options = {}) {
    const d = new Date(date);
    const defaultOptions = { year: 'numeric', month: 'short', day: 'numeric', ...options };
    return d.toLocaleDateString('en-US', defaultOptions);
  },

  formatRelativeTime(date) {
    const now = new Date();
    const then = new Date(date);
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return then.toLocaleDateString();
  },

  formatCurrency(amount, currency = 'KSh') {
    return `${currency} ${amount.toLocaleString()}`;
  },

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  isValidPhone(phone) {
    return /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(phone);
  },

  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  },

  downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getQueryParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  },

  setQueryParams(params) {
    const url = new URL(window.location);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    window.history.pushState({}, '', url);
  }
};

// ============================================
// TOAST NOTIFICATIONS
// ============================================
class ToastManager {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
    document.body.appendChild(this.container);
  }

  show(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const id = Utils.generateId('toast');
    const toast = document.createElement('div');
    
    const colors = {
      success: 'linear-gradient(135deg,#10B981,#059669)',
      error: 'linear-gradient(135deg,#EF4444,#DC2626)',
      warning: 'linear-gradient(135deg,#F59E0B,#D97706)',
      info: 'linear-gradient(135deg,#3b5bfb,#0000CC)'
    };

    toast.style.cssText = `
      display: flex; align-items: center; gap: 10px; padding: 14px 18px; 
      border-radius: 14px; color: white; font-family: sans-serif; font-size: 0.9rem; 
      font-weight: 600; min-width: 280px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      background: ${colors[type] || colors.info}; pointer-events: all;
      animation: toastIn 0.4s cubic-bezier(0.4,0,0.2,1) forwards;
    `;
    toast.id = id;

    const icons = {
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
    };

    toast.innerHTML = `
      ${icons[type]}
      <span style="flex: 1;">${Utils.sanitizeHTML(message)}</span>
      <button style="background: none; border: none; color: white; cursor: pointer; padding: 0;" onclick="toastManager.dismiss('${id}')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  success(message, duration) { return this.show(message, 'success', duration); }
  error(message, duration) { return this.show(message, 'error', duration); }
  warning(message, duration) { return this.show(message, 'warning', duration); }
  info(message, duration) { return this.show(message, 'info', duration); }

  dismiss(id) {
    const toast = this.toasts.get(id);
    if (toast) {
      toast.style.transition = 'all 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => {
        toast.remove();
        this.toasts.delete(id);
      }, 300);
    }
  }
}

const toastManager = new ToastManager();

// ============================================
// MODAL MANAGER
// ============================================
class ModalManager {
  constructor() {
    this.activeModal = null;
    this.init();
  }

  init() {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.close();
      }
    });
  }

  open(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      this.activeModal = modal;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  close() {
    if (this.activeModal) {
      this.activeModal.classList.remove('active');
      document.body.style.overflow = '';
      this.activeModal = null;
    }
  }
}

const modalManager = new ModalManager();

// ============================================
// FORM VALIDATION
// ============================================
class FormValidator {
  static rules = {
    required: (value) => ({
      valid: value && value.trim().length > 0,
      message: 'This field is required'
    }),
    email: (value) => ({
      valid: !value || Utils.isValidEmail(value),
      message: 'Please enter a valid email address'
    }),
    phone: (value) => ({
      valid: !value || Utils.isValidPhone(value),
      message: 'Please enter a valid phone number'
    }),
    minLength: (value, length) => ({
      valid: !value || value.length >= length,
      message: `Must be at least ${length} characters`
    }),
    maxLength: (value, length) => ({
      valid: !value || value.length <= length,
      message: `Must be no more than ${length} characters`
    }),
    pattern: (value, regex, message) => ({
      valid: !value || regex.test(value),
      message: message || 'Invalid format'
    }),
    match: (value, matchValue, fieldName) => ({
      valid: value === matchValue,
      message: `Must match ${fieldName}`
    })
  };

  static validateField(field, rules) {
    const value = field.value;
    const errors = [];

    for (const rule of rules) {
      const [ruleName, ...params] = rule.split(':');
      const validator = this.rules[ruleName];
      
      if (validator) {
        const result = validator(value, ...params);
        if (!result.valid) {
          errors.push(result.message);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static validateForm(form) {
    const fields = form.querySelectorAll('[data-validate]');
    const results = {};
    let isValid = true;

    fields.forEach(field => {
      const rules = field.dataset.validate.split('|');
      const result = this.validateField(field, rules);
      results[field.name] = result;

      if (!result.valid) {
        isValid = false;
        this.showFieldError(field, result.errors[0]);
      } else {
        this.clearFieldError(field);
      }
    });

    return { valid: isValid, results };
  }

  static showFieldError(field, message) {
    this.clearFieldError(field);
    field.classList.add('error');
    const errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.textContent = message;
    field.parentNode.appendChild(errorEl);
  }

  static clearFieldError(field) {
    field.classList.remove('error');
    const errorEl = field.parentNode.querySelector('.form-error');
    if (errorEl) {
      errorEl.remove();
    }
  }
}

// ============================================
// REAL FIREBASE AUTHENTICATION MANAGER
// ============================================
class AuthManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    // Listen to REAL Firebase Auth State
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          let userData = { role: 'jobseeker' }; 
          if (userDocSnap.exists()) {
            userData = userDocSnap.data();
          }

          const sessionUser = {
            id: user.uid,
            email: user.email,
            name: user.displayName || userData.fullName || 'User',
            role: userData.role || 'jobseeker',
            emailVerified: user.emailVerified,
            ...userData
          };

          this.setUser(sessionUser);
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        this.currentUser = null;
        localStorage.removeItem('swifthire_user');
        appState.set('user', null);
        appState.set('isAuthenticated', false);
      }
    });
  }

  setUser(user) {
    this.currentUser = user;
    localStorage.setItem('swifthire_user', JSON.stringify(user));
    appState.set('user', user);
    appState.set('isAuthenticated', true);
  }

  async logout() {
    try {
      await signOut(auth);
      window.location.href = '/auth-signin.html';
    } catch (error) {
      console.error("Logout error:", error);
      toastManager.error("Failed to sign out.");
    }
  }

  isAuthenticated() {
    return !!this.currentUser || !!localStorage.getItem('swifthire_user');
  }

  getUser() {
    return this.currentUser || JSON.parse(localStorage.getItem('swifthire_user'));
  }

  requireAuth() {
    if (!this.isAuthenticated()) {
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      window.location.href = '/auth-signin.html';
      return false;
    }
    return true;
  }

  requireRole(role) {
    if (!this.requireAuth()) return false;
    const user = this.getUser();
    if (user && user.role !== role && user.role !== 'superadmin') {
      window.location.href = '/seeker-dashboard.html';
      return false;
    }
    return true;
  }
}

const authManager = new AuthManager();

// ============================================
// UI COMPONENTS INITIALIZATION
// ============================================
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const toggleBtn = document.querySelector('.sidebar-toggle');
  const mobileToggle = document.querySelector('.mobile-menu-toggle');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-collapsed');
      appState.set('isSidebarCollapsed', sidebar.classList.contains('sidebar-collapsed'));
    });
  }

  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  if (appState.get('isSidebarCollapsed')) {
    sidebar?.classList.add('sidebar-collapsed');
  }
}

function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabContainer => {
    const tabs = tabContainer.querySelectorAll('.tab');
    const panels = document.querySelectorAll(`[data-tab-panel]`);

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        panels.forEach(panel => {
          if (panel.dataset.tabPanel === target) {
            panel.classList.remove('hidden');
          } else {
            panel.classList.add('hidden');
          }
        });
      });
    });
  });
}

function initDropdowns() {
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    const trigger = dropdown.querySelector('.dropdown-trigger');
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
    }
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.open').forEach(d => {
      d.classList.remove('open');
    });
  });
}

function initLazyLoading() {
  const lazyImages = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });

  lazyImages.forEach(img => imageObserver.observe(img));
}

function initAnimations() {
  const animatedElements = document.querySelectorAll('[data-animate]');
  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const animation = el.dataset.animate;
        el.classList.add(`animate-${animation}`);
        animationObserver.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  animatedElements.forEach(el => animationObserver.observe(el));
}

function initSearch() {
  const searchInputs = document.querySelectorAll('[data-search]');
  searchInputs.forEach(input => {
    const target = input.dataset.search;
    const items = document.querySelectorAll(`[data-search-target="${target}"]`);
    
    const performSearch = Utils.debounce((query) => {
      const lowerQuery = query.toLowerCase();
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        const match = text.includes(lowerQuery);
        item.style.display = match ? '' : 'none';
      });
    });

    input.addEventListener('input', (e) => {
      performSearch(e.target.value);
    });
  });
}

function initFileUploads() {
  document.querySelectorAll('.file-upload').forEach(upload => {
    const input = upload.querySelector('input[type="file"]');
    const preview = upload.querySelector('.file-preview');
    const dropZone = upload.querySelector('.drop-zone');

    if (dropZone && input) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        input.files = e.dataTransfer.files;
        handleFileSelect(input.files[0]);
      });

      dropZone.addEventListener('click', () => input.click());
      input.addEventListener('change', () => handleFileSelect(input.files[0]));
    }

    function handleFileSelect(file) {
      if (!file) return;
      const maxSize = parseInt(input.dataset.maxSize) || 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toastManager.error(`File too large. Max size: ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
        return;
      }

      if (preview) {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:100%; max-height:200px;">`;
          };
          reader.readAsDataURL(file);
        } else {
          preview.innerHTML = `
            <div class="file-info">
              <span>${file.name}</span>
              <span class="text-sm text-gray-500">${(file.size / 1024).toFixed(1)} KB</span>
            </div>
          `;
        }
      }
      upload.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
    }
  });
}

// ============================================
// PWA & OFFLINE
// ============================================
let deferredPrompt = null;

function initPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    toastManager.success('App installed successfully!');
  });
}

async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    toastManager.success('Installation started!');
  }
  deferredPrompt = null;
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered:', registration);
    } catch (error) {
      console.log('SW registration failed:', error);
    }
  }
}

function initOfflineDetection() {
  function updateOnlineStatus() {
    if (navigator.onLine) {
      document.body.classList.remove('offline');
      toastManager.success('Back online!');
    } else {
      document.body.classList.add('offline');
      toastManager.warning('You are offline. Some features may be limited.');
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

// ============================================
// DATA MOCKING (Temporary for UI display)
// ============================================
const MockData = {
  jobs: [
    {
      id: 'job-001',
      title: 'Senior Frontend Developer',
      company: 'TechCorp Kenya',
      location: 'Nairobi, Kenya',
      type: 'Full-time',
      salary: { min: 150000, max: 250000, currency: 'KSh' },
      category: 'Technology',
      experience: '5+ years',
      remote: 'Hybrid',
      postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      description: 'We are looking for an experienced Frontend Developer...',
      requirements: ['React', 'TypeScript', 'Tailwind CSS', '5+ years experience'],
      skills: ['React', 'TypeScript', 'Node.js'],
      logo: 'TC'
    }
  ],
  applications: [],
  savedJobs: []
};

class JobManager {
  constructor() {
    this.jobs = [...MockData.jobs];
    this.savedJobs = new Set(MockData.savedJobs);
    this.applications = [...MockData.applications];
  }
  getAllJobs() { return this.jobs; }
  getJobById(id) { return this.jobs.find(job => job.id === id); }
  saveJob(jobId) { this.savedJobs.add(jobId); toastManager.success('Job saved'); }
  unsaveJob(jobId) { this.savedJobs.delete(jobId); toastManager.success('Job removed'); }
  isJobSaved(jobId) { return this.savedJobs.has(jobId); }
}

const jobManager = new JobManager();

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTabs();
  initDropdowns();
  initLazyLoading();
  initAnimations();
  initSearch();
  initFileUploads();
  initPWA();
  initOfflineDetection();
  registerServiceWorker();

  document.querySelectorAll('form[data-validate]').forEach(form => {
    form.addEventListener('submit', (e) => {
      const result = FormValidator.validateForm(form);
      if (!result.valid) {
        e.preventDefault();
        toastManager.error('Please fix the errors in the form');
      }
    });
  });

  console.log('🚀 Swifthire App Initialized');
});

// Expose globals for inline event handlers
window.Utils = Utils;
window.toastManager = toastManager;
window.modalManager = modalManager;
window.authManager = authManager;
window.jobManager = jobManager;
window.appState = appState;
window.installPWA = installPWA;
