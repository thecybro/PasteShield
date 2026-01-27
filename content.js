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

// To detect sensitive data at the time of pasting
function detectSensitiveData(text) {
  const detections = [];

  // To detected passwords i.e. 8+ chars with uppercase, lowercase, and numbers
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (passwordPattern.test(text.trim())) {
    console.log('Warning: Password detected!');
    detections.push('Warning: Password detected!');
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
      detections.push('Warning: API Key / Token detected!');
      console.log('Warning: API Key / Token detected!');
      break;
    }
  }

  // To detect emails
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailPattern.test(text.trim())) {
    detections.push('Warning: Email Address detected!');
    console.log('Warning: Email Address detected!');
  }

  // // To detect phone numbers i.e. 10-15 digits
  const phonePattern = /^[\d\s\-\(\)\+]{10,15}$/;
  const digitsOnly = text.replace(/[\s\-\(\)\+]/g, '');
  if (phonePattern.test(text.trim()) && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    detections.push('Warning: Phone Number detected!');
    console.log('Warning: Phone Number detected!');
  }

  return detections;
}

// To mask/hode sensitive content
function maskText(text) {
  if (text.length <= 6) {
    return '•'.repeat(text.length);
  }

  const visibleChars = 3;
  const start = text.substring(0, visibleChars);
  const end = text.substring(text.length - visibleChars);
  const middle = '•'.repeat(Math.min(text.length - (visibleChars * 2), 20));

  return start + middle + end;
}

// Shorten/truncate long content for displaying
function truncateText(text, maxLength = 100) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

//To show warning modal
function showWarningModal(detectedTypes, pasteText) {
  // To remove any existing modal
  const existingModal = document.getElementById('pasteshield-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'pasteshield-modal';
  modal.className = 'pasteshield-overlay';
  modal.setAttribute('tabindex', '-1'); // To make modal more focusable

  const detectedList = detectedTypes.map(type => `<li>${type}</li>`).join('');
  const maskedPreview = maskText(pasteText);
  const truncatedPreview = truncateText(pasteText);

  // To create HTML structure for warning (cuz it looks cool)
  modal.innerHTML = `
    <div class="pasteshield-modal">
      <div class="pasteshield-header">
        <svg class="pasteshield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h2>PasteShield Warning</h2>
      </div>
      <div class="pasteshield-content">
        <p>You're about to paste something that looks sensitive:</p>
        <ul class="pasteshield-detected-list">
          ${detectedList}
        </ul>
        
        <div class="pasteshield-preview-section">
          <div class="pasteshield-preview-header">Preview:</div>
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
        
        <p class="pasteshield-question">Are you sure you want to paste this here?</p>
        <p class="pasteshield-hint">Tip: Use keyboard shortcuts for faster actions</p>
      </div>
      <div class="pasteshield-actions">
        <button id="pasteshield-cancel" class="pasteshield-btn pasteshield-btn-secondary">
          Cancel <span class="pasteshield-shortcut">Esc</span>
        </button>
        <button id="pasteshield-trust" class="pasteshield-btn pasteshield-btn-secondary">
          Trust Site <span class="pasteshield-shortcut">T</span>
        </button>
        <button id="pasteshield-allow" class="pasteshield-btn pasteshield-btn-primary">
          Allow Once <span class="pasteshield-shortcut">Enter</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Focusing the modal for keyboard events
  setTimeout(() => modal.focus(), 10);

  // Let user switch between preview visibility (toggle)
  let isPreviewVisible = false;
  const toggleBtn = document.getElementById('pasteshield-toggle-preview');
  const toggleText = document.getElementById('pasteshield-toggle-text');
  const previewContent = document.getElementById('pasteshield-preview-content');

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPreviewVisible = !isPreviewVisible;

    if (isPreviewVisible) {
      previewContent.textContent = truncatedPreview;
      toggleText.textContent = 'Hide';
      previewContent.classList.add('pasteshield-preview-revealed');
    } else {
      previewContent.textContent = maskedPreview;
      toggleText.textContent = 'Show';
      previewContent.classList.remove('pasteshield-preview-revealed');
    }
  });

  // Added keyboard event listner for shortcuts
  const handleKeyboard = (e) => {
    // Prevent default only for our shortcuts
    const key = e.key.toLowerCase();

    // To detect which key the user has pressed.
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

  // for closing the modal function
  const closeModal = () => {
    modal.removeEventListener('keydown', handleKeyboard);
    modal.remove();
    pendingPasteData = null;
    pendingPasteEvent = null;
  };

  // To allow just once
  const allowOnce = () => {
    modal.removeEventListener('keydown', handleKeyboard);
    modal.remove();
    executePaste();
  };

  // For trusted sites
  const trustSite = () => {
    const currentDomain = window.location.hostname;
    chrome.storage.local.get(['trustedSites'], (result) => {
      const sites = result.trustedSites || [];
      if (!sites.includes(currentDomain)) {
        sites.push(currentDomain);
        chrome.storage.local.set({ trustedSites: sites });
      }
    });
    modal.removeEventListener('keydown', handleKeyboard);
    modal.remove();
    executePaste();
  };

  // Added keyboard listner to modal
  modal.addEventListener('keydown', handleKeyboard);

  // To create event listners for 'em buttons
  document.getElementById('pasteshield-cancel').addEventListener('click', closeModal);
  document.getElementById('pasteshield-allow').addEventListener('click', allowOnce);
  document.getElementById('pasteshield-trust').addEventListener('click', trustSite);

  // To close if user clickd the shortcut key
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

// Now executing the paste here
function executePaste() {
  if (!pendingPasteData || !pendingPasteEvent) return;

  const target = pendingPasteEvent.target;

  // Cuz we need to handle diff. input types
  if (target.isContentEditable) {
    document.execCommand('insertText', false, pendingPasteData);
  } else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const currentValue = target.value;

    target.value = currentValue.substring(0, start) + pendingPasteData + currentValue.substring(end);
    target.selectionStart = target.selectionEnd = start + pendingPasteData.length;

    // To trigger input events for the frameworks that will be listening to it
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  pendingPasteData = null;
  pendingPasteEvent = null;
}

// This is the main event listner for paste.
document.addEventListener('paste', (e) => {
  // To skip if the current site has been added to trusted list
  if (isCurrentSiteTrusted()) {
    return;
  }

  const pastedText = e.clipboardData.getData('text');

  //  To ignore empty pastes or very short texts
  if (!pastedText || pastedText.length < 3) {
    return;
  }

  const detectedTypes = detectSensitiveData(pastedText);

  if (detectedTypes.length > 0) {
    // To stop default pasting
    e.preventDefault();
    e.stopPropagation();

    // To store the pasted content which is pending
    pendingPasteData = pastedText;
    pendingPasteEvent = e;

    // Warning modal
    showWarningModal(detectedTypes, pastedText);
  }
  // To capture phase before content is pasted
}, true);
