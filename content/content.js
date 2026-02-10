// Content script

let trustedSites = [];
let pendingPasteData = null;
let pendingPasteEvent = null;

// We load trusted sites at the start and also listen for any updates to it so that we can immediately trust sites without needing a refresh
chrome.storage.local.get(['trustedSites'], (result) => {
    trustedSites = result.trustedSites || [];
});

// We need this listener because when user trusts a site from the modal, we update the trusted sites in storage and we want that change to reflect immediately without needing a page refresh
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.trustedSites) {
        trustedSites = changes.trustedSites.newValue || [];
    }
});

// Checking this at the start of the paste event listener to skip detection for trusted sites and allow pasting directly
function isCurrentSiteTrusted() {
    const currentDomain = window.location.hostname;
    return trustedSites.includes(currentDomain);
}

// Function which will detect when user pasted something, match it with given regexes and if pasted content matches regex pattern(s), it shows warning with severity color and icon based on detected sensitive data type(s)
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

  // API KEY / TOKEN DETECTION

  // To detect API key / token patterns (researched/asked AI because it's not humanly possible to know all these regexes)
  // Didn't support many other providers because that increases false positives
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

  // PASSWORD DETECTION

  // Password regexes with and without special characters to reduce false positives while still catching most passwords. Researched common password patterns and also asked AI for help to come up with these regexes.
  function detectPasswords(input) {
    const passwordPatterns = [
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, // With special char
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/ // Without special char (min 8)
    ];
    return passwordPatterns.some(p => p.test(input));
  }

  // CREDIT CARD DETECTION

  // We first use a broad regex to find potential credit card numbers (13-19 digits, allowing spaces or dashes), then we validate those candidates against known card patterns and the Luhn algorithm to reduce false positives.
  // This way we can detect various card types while minimizing incorrect detections.

  // Luhn algorithm validation (to check if the number is a valid credit card number or not)
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
    const candidates = input.match(/\b(?:\d[ -]*?){13,19}\b/g) ||[];

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


  // EMAIL DETECTION

  // We use a regex pattern that matches common email formats but also includes a negative lookbehind to reduce false positives in cases where an email-like pattern is part of a larger string without clear boundaries

  function detectEmails(input) {
    const emailPattern =
      /(?<!\S)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    return emailPattern.test(input);
  }

  // Regex pattern  for various phone number formats (with or without country code, spaces, dashes, parentheses) but also ensures that the total number of digits falls within a typical range for phone numbers to reduce false positives.

  function detectPhoneNumbers(input){
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

// We separate severity levels to set different colors for different types of sensitive data, which makes it easier for users to quickly identify the nature of the detected content and understand the level of risk associated with it.
// For example, API keys and credit card numbers are marked as critical with a red color, while email addresses are marked as low severity with a green color.
// This visual differentiation helps users prioritize their attention and make informed decisions about how to handle the detected content.
function getSeverityColor(severity) {
    const colors = {
        critical: '#f70202',
        high: '#ff5722',
        medium: '#ffae00',
        low: '#4ae654'
    };
    return colors[severity] || colors.medium;
}

// We hide the detected sensitive content by default incase the user might get in truble if someone accidently saw the sensitve content
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

// Showing only the few initial and last characters of pasted content in the review
function truncateText(text, maxLength = 150) {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

// Show user the warning modal with:
// - Detected sensitive data type with severity color and icon
// - Masked preview of the pasted content with character count
// - Buttons to allow pasting once, trust the site and cancel the paste (including shortcuts for all these actions)
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

    // We determine the highest severity among the detected types to set the overall severity of the modal.
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

    // We use template literals inside js to make us easier to inject dynamic content.
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

    // We used requestAnimationFrame for a smooth animation when showing the modal.
    requestAnimationFrame(() => {
        modal.classList.add('pasteshield-visible');
    });

    // We use a slight delay to ensure the keyboard shortcuts work reliably.
    setTimeout(() => {
        modal.focus();
        // This allows users to quickly allow the paste using the keyboard shortcut without needing to click on the button.
        document.getElementById('pasteshield-allow').focus();
    }, 100);

    // We allow users to toggle the visibility of the pasted content in the preview section
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
        
        // - Esc or C to cancel
        if (key === 'escape' || key === 'c') {
            e.preventDefault();
            e.stopPropagation();
            closeModal();

        // - Enter or A to allow once
        } else if (key === 'enter' || key === 'a') {
            e.preventDefault();
            e.stopPropagation();
            allowOnce();

        // - T to trust site
        } else if (key === 't') {
            e.preventDefault();
            e.stopPropagation();
            trustSite();
        }
    };

    // We add a closing class to trigger the CSS animation and then remove the modal from the DOM after the animation completes.
    // This provides a smoother user experience when closing the modal.
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
    // We execute the paste immediately without trusting the site, which means if the user tries to paste again, it will trigger the detection and warning modal again. 
    const allowOnce = () => {
        modal.classList.add('pasteshield-closing');
        setTimeout(() => {
            modal.removeEventListener('keydown', handleKeyboard);
            modal.remove();
            executePaste();
        }, 200);
    };

    // To add the current site to trusted sites so that it won't trigger any warnings in future.
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

    // We attach the keyboard event listener to the modal itself to ensure that it captures the events even if there are other focusable elements on the page. This way, users can use the shortcuts reliably without needing to worry about where the focus is.
    modal.addEventListener('keydown', handleKeyboard);

    // Event listeners for buttons
    document.getElementById('pasteshield-cancel').addEventListener('click', closeModal);
    document.getElementById('pasteshield-allow').addEventListener('click', allowOnce);
    document.getElementById('pasteshield-trust').addEventListener('click', trustSite);

    // We allow users to click outside the modal (on the overlay) to close it.
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// For contenteditable (HTML element), we can use document.execCommand to insert text at the cursor position, which ensures that the paste behaves as expected in rich text editors and other contenteditable areas.
function executePaste() {
    if (!pendingPasteData || !pendingPasteEvent) return;

    const target = pendingPasteEvent.target;

    // Handle different input types
    // We check if the target element is contenteditable or a standard input/textarea and handle the paste accordingly to ensure that the pasted content is inserted correctly in various contexts across different websites.
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

        // To increase the counter in rt
        chrome.runtime.sendMessage({ action: 'incrementCounter' }, (response) => {
            if (response && response.count) {
                console.log("PasteShield: Blocked paste #" + response.count + "today");
            }
        });

        // Show the warning modal
        showWarningModal(detections, pastedText);
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
        console.log('PasteShield: Protection settings updated', window.pasteshieldSettings)
    }
});