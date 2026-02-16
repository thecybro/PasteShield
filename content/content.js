let trustedSites = [];
let pendingPasteData = null;
let pendingPasteEvent = null;

chrome.storage.local.get(['trustedSites'], (result) => {
  trustedSites = result.trustedSites || [];
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.trustedSites) {
    trustedSites = changes.trustedSites.newValue || [];
  }
});

function isCurrentSiteTrusted() {
  const currentDomain = window.location.hostname;
  return trustedSites.includes(currentDomain);
}

function detectSensitiveData(text) {
  const detections = [];
  if (!text || !text.trim()) return detections;

  const DEFAULT_SETTINGS = Object.freeze({
    passwords: true,
    apiKeys: true,
    emails: true,
    phoneNumbers: true,
    creditCards: true,
    customKeywords: []
  })

  window.pasteShieldSettings ??= DEFAULT_SETTINGS;

  const settings = window.pasteShieldSettings;
  const input = text.trim();

  function detectApiKeys(input) {
    const apiKeyPatterns = [
      /sk-proj-[a-zA-Z0-9]{20,}/,// OpenAI project key
      /sk-[a-zA-Z0-9_-]{20,}/,// OpenAI standard key
      /sk-[a-zA-Z0-9]{40,}/,// OpenAI full length
      /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/,// OpenAI specific format
      /sk-proj-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/,// OpenAI project specific
      /sk-admin-[a-zA-Z0-9_-]{124}/,// OpenAI admin key

      /ghp_[a-zA-Z0-9]{36,}/,// GitHub Personal Access Token
      /gho_[a-zA-Z0-9]{36,}/,// GitHub OAuth Token
      /ghu_[a-zA-Z0-9]{36,}/,// GitHub User Token
      /ghs_[a-zA-Z0-9]{36,}/,// GitHub Server Token
      /ghr_[a-zA-Z0-9]{36,}/,// GitHub Refresh Token
      /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,// GitHub Fine-grained PAT

      /AIza[0-9A-Za-z\-_]{35}/,// Google API Key
      /ya29\.[0-9A-Za-z\-_]+/,// Google OAuth Access Token
      /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/, // Google OAuth Client ID

      /AKIA[0-9A-Z]{16}/,// AWS Access Key ID
      /ASIA[0-9A-Z]{16}/,// AWS Session Token
      /(?:^|[^A-Za-z0-9])([A-Za-z0-9+/]{40})(?:$|[^A-Za-z0-9])/, // AWS Secret Access Key

      /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/, // PayPal Access Token

      /xox[baprs]-[0-9a-zA-Z]{10,48}/,// Slack Bot/App/User tokens
      /xoxe\.xox[bp]-\d-[A-Z0-9]{163}/,// Slack Configuration token

      /EAACEdEose0cBA[0-9A-Za-z]+/,// Facebook Access Token

      /[a-zA-Z0-9_-]{32,64}/,// Generic long alphanumeric (32-64 chars)
    ];
    return apiKeyPatterns.some(p => p.test(input));
  }


  function detectPasswords(input) {
    const passwordPatterns = [
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, // With special char
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/ // Without special char (min 8)
    ];
    return passwordPatterns.some(p => p.test(input));
  }


  function luhnCheck(cardNumber) {
    const digits = cardNumber.split('').reverse();
    let sum = 0;

    for (let i = 0; i < digits.length; i++) {
      let digit = parseInt(digits[i]);

      if (i % 2 === 1) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
    }

    return sum % 10 === 0;
  }

  function detectCreditCards(input) {
    const candidates = input.match(/\b(?:\d[ -]*?){13,19}\b/g) || [];

    const cardPatterns = [
      /^4[0-9]{12}(?:[0-9]{3})?$/, //Visa
      /^(62[0-9]{14,17})$/,
      / ^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14})$/,
      /^4\d{3}([\ \-]?)\d{4}\1\d{4}\1\d{4}$/,
      /^(?:5[1-5][0-9]{2}|222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}$/, // Master Card
      /^3[47][0-9]{13}$/, // American Express
      /^6(?:011|5[0-9]{2})[0-9]{12}$/, // Discover
      /^(?:2131|1800|35\\d{3})\\d{11}$/ //JCB
    ];

    for (const raw of candidates) {
      const digits = raw.replace(/[^\d]/g, '');
      if (digits.length < 13 || digits.length > 19) continue;

      if (
        cardPatterns.some(p => p.test(digits)) &&
        luhnCheck(digits)
      ) {
        return true;
      }
    }
    return false;
  }


  function detectEmails(input) {
    const emailPattern =
      /(?<!\S)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    return emailPattern.test(input);
  }


  function detectPhoneNumbers(input) {
    const phonePattern = /^(?:\+\d{1,3}[-. ]?)?\(?\d{3,5}?\)?[-. ]?\d{1,5}[-. ]?\d{1,9}$/;
    const digitsOnly = text.replace(/[\s\-\(\)\+]/g, '');

    return (
      phonePattern.test(input.trim()) &&
      digitsOnly.length >= 10 &&
      digitsOnly.length <= 15
    );
  }

  if (settings.apiKeys && detectApiKeys(input)) {
    detections.push({ type: 'API Key / Token', severity: 'critical', icon: '🔑' });
  }

  if (settings.passwords && detectPasswords(input)) {
    detections.push({ type: 'Password', severity: 'high', icon: '🔐' });
  }

  if (settings.creditCards && detectCreditCards(input)) {
    detections.push({ type: 'Credit Card', severity: 'critical', icon: '💳' });
  }

  if (settings.emails && detectEmails(input)) {
    detections.push({ type: 'Email Address', severity: 'low', icon: '📧' });
  }

  if (settings.phoneNumbers && detectPhoneNumbers(text)) {
    detections.push({ type: 'Phone Number', severity: 'high', icon: '📱' });
  }

  return detections;
}

function getSeverityColor(severity) {
  const colors = {
    critical: '#f70202',
    high: '#ff5722',
    medium: '#ffae00',
    low: '#4ae654'
  };
  return colors[severity] || colors.medium;
}

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

function truncateText(text, maxLength = 150) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

function getSmartSuggestion(detections) {
  const types = detections.map(d => d.type);

  if (types.includes('Password')) {
    return {
      icon: '🔐',
      text: 'Consider using a password manager for better security.'
    };
  }

  if (types.includes('API Key / Token')) {
    return {
      icon: '🔑',
      text: 'Never share API keys publicly. Use environment variables or secret managers instead.'
    };
  }

  if (types.includes('Credit Card')) {
    return {
      icon: '💳',
      text: 'Avoid pasting credit card numbers. Type manually for better security.'
    };
  }

  if (types.includes('Email Address')) {
    return {
      icon: '📧',
      text: 'Be cautious about sharing your email on public forums to avoid spam.'
    };
  }

  if (types.includes('Phone Number')) {
    return {
      icon: '📱',
      text: 'Consider using a secondary phone number for online services.'
    };
  }

  return {
    icon: '🛡️',
    text: 'Always verify you\'re pasting sensitive data into trusted websites.'
  };
}

function showWarningModal(detections, pasteText) {
  const existingModal = document.getElementById('pasteshield-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'pasteshield-modal';
  modal.className = 'pasteshield-overlay';
  modal.setAttribute('tabindex', '-1');

  const highestSeverity = detections.some(d => d.severity === 'critical') ? 'critical' :
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
          <button id="pasteshield-toggle-preview" class="pasteshield-show-hide-btn" title="Toggle visibility">
            <svg class="pasteshield-eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span id="pasteshield-toggle-text">Show</span>
          </button>
        </div>

        <div class="pasteshield-preview-wrapper">
          <div class="pasteshield-preview-box" id="pasteshield-preview-content">
            ${maskedPreview}
          </div>
        </div>
        
        <div class="pasteshield-preview-footer">
          <span class="pasteshield-char-count">${charCount} characters</span>
          <button id="pasteshield-copy-masked" class="pasteshield-copy-btn" title="Copy masked version">
            <svg class="pasteshield-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Masked</span>
          </button>
        </div>
      </div>
        
        <div class="pasteshield-site-info">
          <span class="pasteshield-site-label">Pasting to:</span>
          <span class="pasteshield-site-name">${window.location.hostname}</span>
        </div>

        <div class="pasteshield-suggestion">
          <span class="pasteshield-suggestion-icon">${getSmartSuggestion(detections).icon}</span>
          <span class="pasteshield-suggestion-text">${getSmartSuggestion(detections).text}</span>
        </div>
      
      <div class="pasteshield-actions">
        <button id="pasteshield-cancel" class="pasteshield-btn pasteshield-btn-secondary">
          <span>Cancel</span>
          <span class="pasteshield-shortcut">Esc or<br>C</span>
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
          <span class="pasteshield-shortcut">Enter or<br>A</span>
        </button>
      </div>
      
      <div id="watermark-container">
        <span id="watermark-message">Made by:</span>
        <span id="watermark">Cybro</span>
      </div>

      <div class="pasteshield-footer">
      <span class="pasteshield-footer-text">💡 Keyboard shortcuts available</span>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('pasteshield-visible');
  });

  setTimeout(() => {
    modal.focus();
    document.getElementById('pasteshield-allow').focus();
  }, 100);

  let isPreviewVisible = false;
  const toggleText = document.getElementById('pasteshield-toggle-preview')
  const toggleBtn = document.getElementById('pasteshield-toggle-preview');
  const previewContent = document.getElementById('pasteshield-preview-content');

  if (toggleBtn && previewContent && toggleText){
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isPreviewVisible = !isPreviewVisible;

    if (isPreviewVisible) {
      previewContent.textContent = truncatedPreview;
      previewContent.classList.add('pasteshield-preview-revealed');
      toggleBtn.classList.add('pasteshield-toggle-active');
      toggleText.textContent = 'Hide';
    } else {
      previewContent.textContent = maskedPreview;
      previewContent.classList.remove('pasteshield-preview-revealed');
      toggleBtn.classList.remove('pasteshield-toggle-active');
      toggleText.textContent = "Show";
    }
  });
}

  const copyMaskedBtn = document.getElementById('pasteshield-copy-masked');
  let copyTooltip = null;

  copyMaskedBtn.addEventListener('click', (e) => {
    e.stopPropagation();

    copyMaskedBtn.classList.add('pasteshield-copy-loading');
    copyMaskedBtn.disabled = true;

    navigator.clipboard.writeText(maskedPreview).then(() => {
      copyMaskedBtn.classList.remove('pasteshield-copy-loading')
      copyMaskedBtn.disabled = false;

      if (!copyTooltip) {
        copyTooltip = document.createElement('div');
        copyTooltip.className = 'pasteshield-copy-tooltip';
        copyTooltip.textContent = 'Copied!';
        copyMaskedBtn.appendChild(copyTooltip);
      }

      copyTooltip.classList.add('pasteshield-tooltip-show');
      copyMaskedBtn.classList.add('pasteshield-copy-success');

      setTimeout(() => {
        copyTooltip.classList.remove('pasteshield-tooltip-show');
        copyMaskedBtn.classList.remove('pasteshield-copy-success');
      }, 2000);

      }).catch(err => {
      console.error('PasteShield: Failed to copy', err);

      copyMaskedBtn.classList.remove('pasteshield-copy-loading');
      copyMaskedBtn.disabled = false;

      if (!copyTooltip) {
        copyTooltip = document.createElement('div');
        copyTooltip.className = 'pasteshield-copy-tooltip';
        copyMaskedBtn.appendChild(copyTooltip);
      }

      copyTooltip.textContent = 'Failed!';
      copyTooltip.classList.add('pasteshield-tooltip-show');

      setTimeout(() => {
        copyTooltip.classList.remove('pasteshield-tooltip-show');
      }, 2000);
    });
  });

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

  const closeModal = () => {
    modal.classList.add('pasteshield-closing');
    setTimeout(() => {
      modal.removeEventListener('keydown', handleKeyboard);
      modal.remove();
      pendingPasteData = null;
      pendingPasteEvent = null;
    }, 200);
  };

  const allowOnce = () => {
    modal.classList.add('pasteshield-closing');
    setTimeout(() => {
      modal.removeEventListener('keydown', handleKeyboard);
      modal.remove();
      executePaste();
    }, 200);
  };

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

  modal.addEventListener('keydown', handleKeyboard);

  document.getElementById('pasteshield-cancel').addEventListener('click', closeModal);
  document.getElementById('pasteshield-allow').addEventListener('click', allowOnce);
  document.getElementById('pasteshield-trust').addEventListener('click', trustSite);

  const watermark = document.getElementById("watermark");

  watermark.addEventListener("click", (e) => {
    e.stopPropagation();

    const destination = "https://github.com/thecybro";

    window.open(destination, "_blank");
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
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
  if (window.pasteshieldProcessing) {
    console.log('PasteShield: Already processing, ignoring duplicate event');
    return;
  }
  window.pasteshieldProcessing = true;

  setTimeout(() => {
    window.pasteshieldProcessing = false;
  }, 500);

  if (isCurrentSiteTrusted()) {
    window.pasteshieldProcessing = false; // We reset it right after
    return;
  }

  const pastedText = e.clipboardData.getData('text');

  if (!pastedText || pastedText.length < 3) {
    window.pasteshieldProcessing = false; // We reset it right after
    return;
  }

  const detections = detectSensitiveData(pastedText);
  if (detections.length === 0) {
    window.pasteshieldProcessing = false; // We reset it right after
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  try {
    pendingPasteData = pastedText;
    pendingPasteEvent = e;

    const existingModal = document.getElementById('pasteshield-modal');

    if (existingModal) {
      console.log('PasteShield: Modal already showing, skipping...');
      window.pasteshieldProcessing = false;
      return;
    }

    showWarningModal(detections, pastedText);

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      try{
        chrome.runtime.sendMessage(
          { action: "incrementCounter" }, (response) => {
            if (chrome.runtime.lastError) {
              console.log("PasteShield: Some error occured!");
              return;
            }
            if (response?.count !== undefined) {
              console.log(`PasteShield: Blocked paste #${response.count} today`);
            }
          }
        );
      } catch(err){
        console.log('PasteShield: Could not increment counter', err);
      }
    }

  } catch (err) {
    console.error('PasteShield: Error showing modal:', err);
    window.pasteshieldProcessing = false; // Reset on error

    try {
      const target = e.target;

      if (target?.isContentEditable) {
        document.execCommand('insertText', false, pastedText);
      } else if (
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA"
      ) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const value = target.value;

        target.value = value.substring(0, start) + pastedText + value.substring(end);
        target.selectionStart = target.selectionEnd = start + pastedText.length;

        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch {
      // Created this part so that we catch any errors that might occur during the paste execution to prevent the extension from breaking the user experience ( which I faced alot while testing )
    }
  }

}, true);

chrome.storage.local.get(['protectionSettings'], (result) => {
  if (result.protectionSettings) {
    window.pasteShieldSettings = result.protectionSettings;
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.protectionSettings) {
    window.pasteShieldSettings = changes.protectionSettings.newValue;
    console.log('PasteShield: Protection settings updated', window.pasteShieldSettings)
  }
});