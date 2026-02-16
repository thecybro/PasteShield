chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            trustedSites: [],
            pasteCount: 0,
            lastResetDate: new Date().toDateString(),

            protectionSettings: {
                passwords: true,
                apiKeys: true,
                creditCards: true,
                emails: true,
                phoneNumbers: true,
                customKeywords: []
            }
        });

        console.log('PasteShield installed successfully');
    } else if (details.reason === 'update') {
        console.log('PasteShield updated to version', chrome.runtime.getManifest().version);

        chrome.storage.local.get(['pasteCount', 'lastResetDate'], (result) => {
            if (result.pasteCount === undefined) {
                chrome.storage.local.set({
                    pasteCount: 0,
                    lastResetDate: new Date().toDateString()
                });
            }

            if (!result.protectionSettings){
                chrome.storage.local.set({
                    protectionSettings: {
                        passwords: true,
                        apiKeys: true,
                        creditCards: true,
                        emails: true,
                        phoneNumbers: true,
                        customKeywords: []
                    }
                });
            }
        });
    }
});

function checkAndResetCounter() {
    chrome.storage.local.get(['lastResetDate'], (result) => {
        const today = new Date().toDateString();

        if (result.lastResetDate !== today) {
            chrome.storage.local.set({
                pasteCount: 0,
                lastResetDate: today
            });

            chrome.action.setBadgeText({ text: '' });
            console.log("Daily counter has been reset.");
        }
    });
}

setInterval(checkAndResetCounter, 60000);

checkAndResetCounter();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pasteCount) {
        const count = changes.pasteCount.newValue || 0;
        updateBadge(count);
    }
});

function updateBadge(count) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }); // Red
        chrome.action.setBadgeTextColor({ color: '#ffffff' }); // White text
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

chrome.storage.local.get(['pasteCount'], (result) => {
    updateBadge(result.pasteCount || 0);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'incrementCounter') {
        chrome.storage.local.get(['pasteCount'], (result) => {
            const newCount = (result.pasteCount || 0) + 1;
            chrome.storage.local.set({ pasteCount: newCount });
            sendResponse({ count: newCount });
        });
        return true;
    }

    if (request.action === 'getTrustedSites') {
        chrome.storage.local.get(['trustedSites'], (result) => {
            sendResponse({ trustedSites: result.trustedSites || [] });
        });
        return true;
    }

    if (request.action === 'getStats') {
        chrome.storage.local.get(['pasteCount', 'lastResetDate'], (result) => {
            sendResponse({
                pasteCount: result.pasteCount || 0,
                lastResetDate: result.lastResetDate || new Date().toDateString()
            });
        });
        return true;
    }
});