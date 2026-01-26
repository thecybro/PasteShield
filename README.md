# PasteShield

PasteShield is a small Chrome extension I built to stop myself from doing something stupid — like pasting passwords or API keys into random websites by mistake.

That's it.

## Motive behind making this

I've accidentally pasted:
- passwords into chat boxes  
- API keys into Google searches  
- emails and phone numbers into random forms  

And it caused a lot of trouble for me.

So this extension just **pauses the paste**, warns you, and lets *you* decide.

## Repository Structure

```
PasteShield/
├── manifest.json 
├── background.js 
├── content.js    
├── modal.css     
├── popup.html    
├── popup.css     
├── popup.js      
├── icons/        
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── ICONS_GUIDE.md
└── README.md     
```

## What it does

When you paste text on any website, PasteShield checks if it looks like:

- **Password** - 8+ characters with uppercase, lowercase, and numbers
- **API key / token** - Common patterns like `sk-...`, `ghp_...`, `AIza...`, AWS keys, etc.
- **Email address** - Standard email format like `user@example.com`
- **Phone number** - 10-15 digits (with or without formatting)

If nothing risky is found, PasteShield will let you do your job.

If something sensitive is detected, it stops the paste and shows a warning.

## What happens when it warns you

You'll see a small popup with 3 options:

- **Allow once**  
  Paste it this time only.
  
- **Trust site**  
  Paste it and don't warn me again on this website.
  
- **Cancel**  
  Don't paste anything.

Yep, That's it.

## Trusted sites

If you choose **Trust site**, that website is saved locally in your browser.

To manage trusted sites:
1. Click the PasteShield extension icon
2. View all trusted sites in the list
3. Remove individual sites or click **Clear Trusted Sites** to reset all

Now all sites will warn again.

## Installation (Chrome)

Unfortunately, I can't oublish it in Chrome Store yet :(

### Step-by-step:

1. Download or clone this repository
2. Open Chrome and go to: `chrome://extensions/`
3. Turn on **Developer mode** (In top right corner)
4. Click **Load unpacked**
5. Select the `PasteShield` folder
6. Done!

## Privacy 

- **No data is sent anywhere**
- **No servers**
- **No accounts**
- **No tracking**
- **Clipboard text is never saved**

Everything runs **locally** inside your browser. The extension only uses Chrome's local storage to remember which sites you've trusted.

## Limitations 

- Detection is pattern-based, not perfect
- You might get some false positives (like strong unique usernames triggering the password check)
- UI is very basic but functional
- Some websites with strict paste policies may still block programmatic paste
- Large multi-line pastes might not be detected properly (focused on single-line sensitive data)

This is v0.1, not magic.

## Who this is for

- Developers who work with API keys
- Students copying credentials
- Anyone who copy-pastes sensitive stuff regularly
- People who mess up sometimes (me)

## Technical Details

No permissions are used to send data externally.

## Future ideas (maybe)

- Custom detection patterns
- Whitelist for specific text patterns
- Better false positive handling
- More granular controls
- Firefox support.

But honestly, it does what I need it to do right now.

## Version

**v0.1.0** - January 2026

Built because I needed it.  
If it saves you once, it did its job.

---

## License

MIT License - Do whatever you want with it.

---

**Note:** This extension is a personal project and not affiliated with any company. Use at your own risk, though there's really nothing risky about it since it only runs locally.