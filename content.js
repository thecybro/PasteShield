// Content script

let trustedSites = [];
let pendingPasteData = null;
let pendingPasteEvent = null;

// To load trusted sites
chrome.storage.local.get(['trustedSites'], (result) => {
  trustedSites = result.trustedSites || [];
});

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

function detectSensitiveData(text) {
  const detections = [];

  // To detected passwords i.e. 8+ chars with uppercase, lowercase, and numbers
  const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (passwordPattern.test(text.trim())) {
    detections.push('Password');
  }

  // To detect API key / token patterns
  const apiKeyPatterns = [
    /sk-[a-zA-Z0-9]{32,}/, 
    /ghp_[a-zA-Z0-9]{36,}/, 
    /gho_[a-zA-Z0-9]{36,}/, 
    /AIza[0-9A-Za-z\\-_]{35}/, 
    /AKIA[0-9A-Z]{16}/, 
    /[a-zA-Z0-9_-]{32,}/, 
  ];

  for (let pattern of apiKeyPatterns) {
    if (pattern.test(text)) {
      detections.push('API Key / Token');
      break;
    }
  }

  // To detect emails
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailPattern.test(text.trim())) {
    detections.push('Email Address');
  }

  // // To detect phone numbers i.e. 10-15 digits
  const phonePattern = /^[\d\s\-\(\)\+]{10,15}$/;
  const digitsOnly = text.replace(/[\s\-\(\)\+]/g, '');
  if (phonePattern.test(text.trim()) && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    detections.push('Phone Number');
  }

  return detections;
}

function showWarningModal(detectedTypes, pasteText) {
  const existingModal = document.getElementById('pasteshield-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'pasteshield-modal';
  modal.className = 'pasteshield-overlay';

  const detectedList = detectedTypes.map(type => `<li>${type}</li>`).join('');

  // To create HTML structure for warning (it looks cool tho)
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
        <p class="pasteshield-question">Are you sure you want to paste this here?</p>
      </div>
      <div class="pasteshield-actions">
        <button id="pasteshield-cancel" class="pasteshield-btn pasteshield-btn-secondary">Cancel</button>
        <button id="pasteshield-trust" class="pasteshield-btn pasteshield-btn-secondary">Trust Site</button>
        <button id="pasteshield-allow" class="pasteshield-btn pasteshield-btn-primary">Allow Once</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // To create event listners for 'em buttons
  document.getElementById('pasteshield-cancel').addEventListener('click', () => {
    modal.remove();
    pendingPasteData = null;
    pendingPasteEvent = null;
  });

  document.getElementById('pasteshield-allow').addEventListener('click', () => {
    modal.remove();
    executePaste();
  });

  document.getElementById('pasteshield-trust').addEventListener('click', () => {
    const currentDomain = window.location.hostname;
    chrome.storage.local.get(['trustedSites'], (result) => {
      const sites = result.trustedSites || [];
      if (!sites.includes(currentDomain)) {
        sites.push(currentDomain);
        chrome.storage.local.set({ trustedSites: sites });
      }
    });
    modal.remove();
    executePaste();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      pendingPasteData = null;
      pendingPasteEvent = null;
    }
  });
}

function executePaste() {
  if (!pendingPasteData || !pendingPasteEvent) return;

  const target = pendingPasteEvent.target;

  if (target.isContentEditable) {
    document.execCommand('insertText', false, pendingPasteData);
  } else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const currentValue = target.value;

    target.value = currentValue.substring(0, start) + pendingPasteData + currentValue.substring(end);
    target.selectionStart = target.selectionEnd = start + pendingPasteData.length;

    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  pendingPasteData = null;
  pendingPasteEvent = null;
}

document.addEventListener('paste', (e) => {
  // To skip if site is trusted
  if (isCurrentSiteTrusted()) {
    return;
  }

  const pastedText = e.clipboardData.getData('text');

  // To ignore empty pastes or very short text
  if (!pastedText || pastedText.length < 3) {
    return;
  }

  const detectedTypes = detectSensitiveData(pastedText);

  if (detectedTypes.length > 0) {
    e.preventDefault();
    e.stopPropagation();

    pendingPasteData = pastedText;
    pendingPasteEvent = e;

    showWarningModal(detectedTypes, pastedText);
  }
}, true);