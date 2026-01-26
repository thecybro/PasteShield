//Background service worker

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // To initialize storage on the very first install
        chrome.storage.local.set({
            trustedSites: []
        });
        // Just printing message in the console
        console.log('PasteShield installed successfully');
    } else if (details.reason === 'update') {
        console.log('PasteShield updated to version', chrome.runtime.getManifest().version);
    }
});

// To listen for messages from popup/content scripts incase we need it
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTrustedSites') {
        chrome.storage.local.get(['trustedSites'], (result) => {
            sendResponse({ trustedSites: result.trustedSites || [] });
        });
        return true;
    }
});