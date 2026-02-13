document.addEventListener('DOMContentLoaded', () => {
    loadTrustedSites();
    loadStats(); // To Load the counter

    loadProtectionSettings();
    setupToggleListeners();

    // Clear button event listener
    document.getElementById('clear-btn').addEventListener('click', clearTrustedSites);
});

function loadTrustedSites() {
    chrome.storage.local.get(['trustedSites'], (result) => {
        const sites = result.trustedSites || [];
        displayTrustedSites(sites);
    });
}

// Function which will load the counter value from background.js & display it in popup.html
function loadStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
        if (response) {
            const countElement = document.getElementById('paste-count');
            countElement.textContent = response.pasteCount || 0;
        }
    });
}

// To look out for updates in the counter value and update the badge accordingly in rt
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pasteCount) {
        const countElement = document.getElementById('paste-count');
        const newCount = changes.pasteCount.newValue || 0;

        // For a little animation while the number changes
        countElement.classList.add('updated');
        countElement.textContent = newCount;

        setTimeout(() => {
            countElement.classList.remove('updated');
        }, 300);
    }
});

function displayTrustedSites(sites) {
    const trustedList = document.getElementById('trusted-list');
    const trustedCount = document.getElementById('trusted-count');
    const clearBtn = document.getElementById('clear-btn');

    trustedCount.textContent = sites.length;

    if (sites.length === 0) {
        trustedList.innerHTML = '<p class="empty-state">No trusted sites yet</p>';
        console.log("No trusted sites yet");
        clearBtn.disabled = true;
    } else {
        trustedList.innerHTML = '';
        clearBtn.disabled = false;

        sites.forEach((site) => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';

            siteItem.innerHTML = `
        <span class="site-name" title="${site}">${site}</span>
        <button class="remove-btn" data-site="${site}" title="Untrust this site">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

            trustedList.appendChild(siteItem);
        });

        // Event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const siteToRemove = e.currentTarget.getAttribute('data-site');
                removeTrustedSite(siteToRemove);
            });
        });
    }
}

function removeTrustedSite(siteToRemove) {
    chrome.storage.local.get(['trustedSites'], (result) => {
        let sites = result.trustedSites || [];
        sites = sites.filter(site => site !== siteToRemove);

        chrome.storage.local.set({ trustedSites: sites }, () => {
            loadTrustedSites();
        });
    });
}

function clearTrustedSites() {
    if (confirm('Are you sure you wanna clear all trusted sites? Think again..')) {
        chrome.storage.local.set({ trustedSites: [] }, () => {
            loadTrustedSites();
        });
    }
}

// For loading the protection Settings
function loadProtectionSettings(){
    chrome.storage.local.get(['protectionSettings'], (result) => {
        const settings = result.protectionSettings || {
            passwords: true,
            creditCards: true,
            apiKeys: true,
            emails: true,
            phoneNumbers: true,
            customKeywords: []
        };

        document.getElementById('toggle-passwords').checked = settings.passwords;
        document.getElementById('toggle-apiKeys').checked = settings.apiKeys;
        document.getElementById('toggle-emails').checked = settings.emails;
        document.getElementById('toggle-phoneNumbers').checked = settings.phoneNumbers;
        document.getElementById('toggle-creditCards').checked = settings.creditCards;
    });
}

//Now to save all our protection Settings
function saveProtectionSettings() {
    const settings = {
        passwords: document.getElementById('toggle-passwords').checked,
        apiKeys: document.getElementById('toggle-apiKeys').checked,
        emails: document.getElementById('toggle-emails').checked,
        phoneNumbers: document.getElementById('toggle-phoneNumbers').checked,
        creditCards: document.getElementById('toggle-creditCards').checked
    };

    chrome.storage.local.set({ protectionSettings: settings }, () => {
        console.log("Protection settings saved:", settings);
    });
}

function setupToggleListeners() {
    const toggles = ['passwords', 'apiKeys', 'emails', 'phoneNumbers', 'creditCards'];

    toggles.forEach(type => {
        const checkbox = document.getElementById(`toggle-${type}`);

        if (checkbox) {
            checkbox.addEventListener('change', saveProtectionSettings);
        }
    });
}

// Making the watermark clickable to direct user to a destination if they click it
const watermark = document.getElementById("watermark");

watermark.addEventListener("click", (e) => {
    // The user will be directed to this location
    const destination = "https://github.com/thecybro";

    window.open(destination, "_blank");
});