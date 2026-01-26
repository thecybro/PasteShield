document.addEventListener('DOMContentLoaded', () => {
    loadTrustedSites();

    // Clear button event listener
    document.getElementById('clear-btn').addEventListener('click', clearTrustedSites);
});

function loadTrustedSites() {
    chrome.storage.local.get(['trustedSites'], (result) => {
        const sites = result.trustedSites || [];
        displayTrustedSites(sites);
    });
}

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
        <button class="remove-btn" data-site="${site}" title="Remove this site">
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