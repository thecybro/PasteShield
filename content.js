// Content script

let trustedSites = [];
let pendingPasteData = null;
let pendingPasteEvent = null;

// To load trusted sites
chrome.storage.local.get(['trustedSites'], (result) => {
  trustedSites = result.trustedSites || [];
});

// To listen for updates to trusted sites 
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.trustedSites) {
    trustedSites = changes.trustedSites.newValue || [];
  }
});

// To check if the site is trusted or not
function isCurrentSiteTrusted() {
  const currentDomain = window.location.hostname;
  return trustedSites.includes(currentDomain);
}

// To detect sensitive data with severity levels at the time of pasting
function detectSensitiveData(text) {
  const detections = [];

  // To detected passwords i.e. 8+ chars with uppercase, lowercase, and numbers
  const passwordPattern = /(?=\S*[a-z])(?=\S*[A-Z])(?=\S*\d)\S{8,}/;
  if (passwordPattern.test(text.trim())) {
    detections.push({ type: 'Password', severity: 'highest', icon: '🔐' });
  }

  // To detect API key / token patterns
  const apiKeyPatterns = [
    /sk-[a-zA-Z0-9]{32,}/,  // OpenAI
    /ghp_[a-zA-Z0-9]{36,}/,  // GitHub personal
    /gho_[a-zA-Z0-9]{36,}/,  // GitHub OAuth
    /AIza[0-9A-Za-z\\-_]{35}/,  // Google
    /AKIA[0-9A-Z]{16}/,  // AWS
    /[a-zA-Z0-9_-]{32,}/,  // Generic one
  ];

  for (let pattern of apiKeyPatterns) {
    if (pattern.test(text)) {
      detections.push({ type: 'API Key / Token', severity: 'highest', icon: '🔑' });
      break;
    }
  }

  // Credict Card Detection
  const cards = [
    /^4[0-9]{12}(?:[0-9]{3})?$/, //Visa
    /^(62[0-9]{14,17})$/,
    / ^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})$/,
    /^4\d{3}([\ \-]?)\d{4}\1\d{4}\1\d{4}$/,
    /^(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}$/, // Master Card
    /^3[47][0-9]{13}$/, // American Express
    /^6(?:011|5[0-9]{2})[0-9]{12}$/, // Discover
    /^(?:2131|1800|35\\d{3})\\d{11}$/ //JCB
  ];

  for (let pattern of cards) {
    if (pattern.test(text)) {
      detections.push({ type: 'Credit Card', severity: 'highest', icon: '💳' })
      break;
    }
  }

  // To detect emails
  const emailPattern = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  if (emailPattern.test(text.trim())) {
    detections.push({ type: 'Email Address', severity: 'low', icon: '📧' });

  }

  // // To detect phone numbers i.e. 10-15 digits
  const phonePattern = /^(?:\+\d{1,3}[-. ]?)?\(?\d{3,5}?\)?[-. ]?\d{1,5}[-. ]?\d{1,9}$/;
  const digitsOnly = text.replace(/[\s\-\(\)\+]/g, '');
  if (phonePattern.test(text.trim()) && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    detections.push({ type: 'Phone Number', severity: 'medium', icon: '📱' });
  }

  return detections;
}

//  To get severity color (added to make popup more visually appealing)
function getSeverityColor(severity) {
  const colors = {
    highest: '#f70202',
    medium: '#ffae00',
    low: '#4ae654'
  };
  return colors[severity] || colors.medium;
}

// To mask/hide sensitive content
function maskText(text) {
  if (text.length <= 6) {
    return '•'.repeat(text.length);
  }

  const visibleChars = 3;
  const start = text.substring(0, visibleChars);
  const end = text.substring(text.length - visibleChars);
  const middle = '*'.repeat(Math.min(text.length - (visibleChars * 2), 20));

  return start + middle + end;
}

// Truncate long text for display
function truncateText(text, maxLength = 150) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

// Show warning modal
function showWarningModal(detections, pasteText) {
  // Remove any existing modal
  const existingModal = document.getElementById('pasteshield-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'pasteshield-modal';
  modal.className = 'pasteshield-overlay';
  modal.setAttribute('tabindex', '-1');

  // Get highest severity for border color
  const highestSeverity = detections.some(d => d.severity === 'veryhigh') ? 'veryhigh' :
    detections.some(d => d.severity === 'high') ? 'high' :
      detections.some(d => d.severity === 'medium') ? 'medium' : 'low';

  const detectedList = detections.map(d =>
    `<li style="color: ${getSeverityColor(d.severity)}">
      <span class="pasteshield-detection-icon">${d.icon}</span>
      <span>${d.type}</span>
    </li>`
  ).join('');

  const maskedPreview = maskText(pasteText);
  const truncatedPreview = truncateText(pasteText);
  const charCount = pasteText.length;

  modal.innerHTML = `
    <div class="pasteshield-modal" data-severity="${highestSeverity}">
      <div class="pasteshield-header">
        <div class="pasteshield-warning-badge">
          <svg class="pasteshield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <div class="pasteshield-header-text">
          <h2>Sensitive Content Detected</h2>
          <p class="pasteshield-subtitle">Review before pasting</p>
        </div>
      </div>
      
      <div class="pasteshield-content">
        <div class="pasteshield-detection-section">
          <span class="pasteshield-section-label">Detected:</span>
          <ul class="pasteshield-detected-list">
            ${detectedList}
          </ul>
        </div>
        
        <div class="pasteshield-preview-section">
          <div class="pasteshield-preview-header">
            <span class="pasteshield-section-label">Preview</span>
            <span class="pasteshield-char-count">${charCount} characters</span>
          </div>
          <div class="pasteshield-preview-wrapper">
            <div class="pasteshield-preview-box" id="pasteshield-preview-content">
              ${maskedPreview}
            </div>
            <button id="pasteshield-toggle-preview" class="pasteshield-toggle-btn" title="Toggle visibility">
              <svg class="pasteshield-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="pasteshield-site-info">
          <span class="pasteshield-site-label">Pasting to:</span>
          <span class="pasteshield-site-name">${window.location.hostname}</span>
        </div>
      </div>
      
      <div class="pasteshield-actions">
        <button id="pasteshield-cancel" class="pasteshield-btn pasteshield-btn-secondary">
          <span>Cancel</span>
          <span class="pasteshield-shortcut">Esc</span>
        </button>
        <button id="pasteshield-trust" class="pasteshield-btn pasteshield-btn-secondary">
          <svg class="pasteshield-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          <span>Trust Site</span>
          <span class="pasteshield-shortcut">T</span>
        </button>
        <button id="pasteshield-allow" class="pasteshield-btn pasteshield-btn-primary">
          <svg class="pasteshield-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Allow Once</span>
          <span class="pasteshield-shortcut">Enter</span>
        </button>
      </div>
      
      <div class="pasteshield-footer">
        <span class="pasteshield-footer-text">💡 Keyboard shortcuts available</span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animate modal in
  requestAnimationFrame(() => {
    modal.classList.add('pasteshield-visible');
  });

  // Focus the modal for keyboard events
  setTimeout(() => {
    modal.focus();
    // Auto-focus primary button
    document.getElementById('pasteshield-allow').focus();
  }, 100);

  // Toggle preview visibility
  let isPreviewVisible = false;
  const toggleBtn = document.getElementById('pasteshield-toggle-preview');
  const previewContent = document.getElementById('pasteshield-preview-content');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPreviewVisible = !isPreviewVisible;

    if (isPreviewVisible) {
      previewContent.textContent = truncatedPreview;
      previewContent.classList.add('pasteshield-preview-revealed');
      toggleBtn.classList.add('pasteshield-toggle-active');
    } else {
      previewContent.textContent = maskedPreview;
      previewContent.classList.remove('pasteshield-preview-revealed');
      toggleBtn.classList.remove('pasteshield-toggle-active');
    }
  });

  // Keyboard event listener for shortcuts
  const handleKeyboard = (e) => {
    const key = e.key.toLowerCase();

    if (key === 'escape' || key === 'c') {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    } else if (key === 'enter' || key === 'a') {
      e.preventDefault();
      e.stopPropagation();
      allowOnce();
    } else if (key === 't') {
      e.preventDefault();
      e.stopPropagation();
      trustSite();
    }
  };

  // Close modal function with animation
  const closeModal = () => {
    modal.classList.add('pasteshield-closing');
    setTimeout(() => {
      modal.removeEventListener('keydown', handleKeyboard);
      modal.remove();
      pendingPasteData = null;
      pendingPasteEvent = null;
    }, 200);
  };

  // Allow once function
  const allowOnce = () => {
    modal.classList.add('pasteshield-closing');
    setTimeout(() => {
      modal.removeEventListener('keydown', handleKeyboard);
      modal.remove();
      executePaste();
    }, 200);
  };

  // Trust site function
  const trustSite = () => {
    const currentDomain = window.location.hostname;
    chrome.storage.local.get(['trustedSites'], (result) => {
      const sites = result.trustedSites || [];
      if (!sites.includes(currentDomain)) {
        sites.push(currentDomain);
        chrome.storage.local.set({ trustedSites: sites });
      }
    });
    modal.classList.add('pasteshield-closing');
    setTimeout(() => {
      modal.removeEventListener('keydown', handleKeyboard);
      modal.remove();
      executePaste();
    }, 200);
  };

  // Attach keyboard listener to modal
  modal.addEventListener('keydown', handleKeyboard);

  // Event listeners for buttons
  document.getElementById('pasteshield-cancel').addEventListener('click', closeModal);
  document.getElementById('pasteshield-allow').addEventListener('click', allowOnce);
  document.getElementById('pasteshield-trust').addEventListener('click', trustSite);

  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// Execute the actual paste
function executePaste() {
  if (!pendingPasteData || !pendingPasteEvent) return;

  const target = pendingPasteEvent.target;

  // Handle different input types
  if (target.isContentEditable) {
    document.execCommand('insertText', false, pendingPasteData);
  } else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const currentValue = target.value;

    target.value = currentValue.substring(0, start) + pendingPasteData + currentValue.substring(end);
    target.selectionStart = target.selectionEnd = start + pendingPasteData.length;

    // Trigger input event for frameworks that listen to it
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  pendingPasteData = null;
  pendingPasteEvent = null;
}

// Main paste event listener
document.addEventListener('paste', (e) => {
  // Skip if site is trusted
  if (isCurrentSiteTrusted()) {
    return;
  }

  const pastedText = e.clipboardData.getData('text');

  // Ignore empty pastes or very short text
  if (!pastedText || pastedText.length < 3) {
    return;
  }

  const detections = detectSensitiveData(pastedText);

  if (detections.length > 0) {
    // Prevent the default paste
    e.preventDefault();
    e.stopPropagation();

    // Store the pending paste data
    pendingPasteData = pastedText;
    pendingPasteEvent = e;

    // Show the warning modal
    showWarningModal(detections, pastedText);
  }
}, true);