# PasteShield

PasteShield is a small Chrome extension I built to stop myself from doing something stupid — like pasting passwords or API keys into random websites by mistake.

It works entirely **locally** and simply pauses the paste, warns you, and lets *you* decide what to do.

**Checkout** *[Test Results](https://github.com/thecybro/PasteShield/blob/main/TestResults.md)* ***for more information.***

## Status

*PasteShield* is not yet published on the Chrome Web Store.
This repository contains the full source for local testing via *Developer Mode.*

## Motive behind making this

I've accidentally pasted:
- passwords into chat boxes  
- API keys into Google searches  
- emails and phone numbers into random forms  

And it caused real trouble for me.

So this extension just **pauses the paste**, warns you, and lets *you* decide.

## Repository Structure
```
PasteShield
├── background.js
├── content
│   └── content.js
├── icons
│   ├── icon128.png
│   ├── icon16.png
│   └── icon48.png
├── manifest.json
├── modal.css
├── popup.css
├── popup.html
├── popup.js
├── Previews
│   ├── 01_popup.png
│   ├── 02_Trusted_sites.png
│   ├── 03_Warning.png
│   ├── 04_Normal_paste.png
│   └── 05_Normal_paste.png
├── README.md
├── store.md
└── TestResults.md
```


## What it does

When you paste text on any website, *PasteShield* checks if it looks like:

- **Password** – 8+ characters with uppercase, lowercase, and numbers  
- **API key / token** – Common patterns like `sk-...`, `ghp_...`, `AIza...`, AWS keys, etc.  
- **Credit card** – A common 16-digit Primary Account Number (PAN), based on ISO/IEC 7812 patterns  
- **Email address** – Standard format like `user@example.com`  
- **Phone number** – 10–15 digits (with or without formatting)

If nothing risky is found, *PasteShield* lets the paste go through normally.

If something sensitive is detected, it stops the paste and shows a warning.

## Previews

<img src="https://github.com/thecybro/PasteShield/blob/main/Previews/01_popup.png" alt="PasteShield Popup">

<img src="https://github.com/thecybro/PasteShield/blob/main/Previews/02_Trusted_sites.png" alt="PasteShield Popup-Trusted sites">

<img src="https://github.com/thecybro/PasteShield/blob/main/Previews/03_Warning.png" alt="PasteShield Warning">

<img src="https://github.com/thecybro/PasteShield/blob/main/Previews/04_Normal_paste.png" alt="PasteShield Normal Paste: before">

<img src="https://github.com/thecybro/PasteShield/blob/main/Previews/05_Normal_paste.png" alt="PasteShield Normal Paste: after">

## What happens when it warns you

You'll see a small popup with 3 options:

- **Cancel**  
  - **Shortcut:** *Esc* or *C* 
  Don’t paste anything.

- **Trust site**  
  - **Shortcut:** *Ctrl* or *T*
  Paste it and don’t warn me again on this website.

- **Allow once**  
  - **Shortcut:** *Enter* or *A*
  Paste it this time only.


**You can also select options using the shortcut keys shown in the popup.**  
That’s it.

## Trusted sites

If you choose **Trust site**, that website is saved locally in your browser.

To manage trusted sites:
1. Click the *PasteShield* extension icon
2. View all trusted sites in the list
3. Remove individual sites or click **Clear Trusted Sites** to reset all

After clearing, all sites will warn again.

## Installation (Chrome)

Will be available on the Chrome Web Store soon.


### Manual installation (for now):

1. Download or clone this repository
2. Open Chrome and go to: `chrome://extensions/`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `PasteShield` folder


## Privacy

- **No data is sent anywhere**
- **No servers**
- **No accounts**
- **No tracking**
- **Clipboard text is never saved**

Everything runs **locally** inside your browser. The extension only uses Chrome’s local storage to remember which sites you’ve trusted.

## Limitations

- Detection is pattern-based and not perfect
- You may get false positives (e.g., strong unique strings triggering the password check)
- UI is very basic but functional
- Some websites with strict paste policies may still block programmatic paste
- Large multi-line pastes may not be detected reliably (focus is on single-line sensitive data)

## Who this is for

- Developers who work with API keys
- Students copying credentials
- Anyone who copy-pastes sensitive data regularly
- People who mess up sometimes (me)

## Technical details

All detection is done locally using pattern matching.  
No permissions are used to send data externally.

## Version

**v0.1.0** – January 2026

Built because I needed it.  
If it saves you once, it did its job.

---

## License

MIT License – Do whatever you want with it.

---

**Note:** This is a personal project and not affiliated with any company. Use at your own risk, though the extension only runs locally and does not transmit any data.
