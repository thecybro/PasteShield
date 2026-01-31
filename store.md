## Extension Name
**PasteShield – Prevent Accidental Secret & PII Leaks**

(If Chrome truncates, acceptable fallback:)  
**PasteShield – Stop Pasting Secrets by Mistake**

---

## Short Description
Warns you before pasting passwords, API keys, credit cards, emails, or phone numbers. Runs 100% locally.

---

## Detailed Description

PasteShield is a lightweight Chrome extension that helps prevent accidental leaks caused by careless copy-pasting.

I built it after pasting passwords, API keys, and personal data into the wrong places more times than I’d like to admit.

### What it does
Whenever you paste text on a website, PasteShield checks it against local pattern rules, such as:
- Passwords
- API keys or tokens (OpenAI, GitHub, Google, AWS, etc.)
- Credit card numbers
- Email addresses
- Phone numbers

If something risky is detected, the paste is paused and you’re shown a warning.

You decide what happens next.

### When warned, you can:
- **Allow once** – paste it just this time  
- **Trust site** – paste and don’t warn again on this website  
- **Cancel** – don’t paste anything  

Trusted sites are stored locally and can be reviewed or removed at any time from the extension popup.

### Privacy & security
- No data is sent anywhere
- No servers
- No accounts
- No tracking
- Clipboard text is never saved

All detection happens locally inside your browser.

### Limitations
- Detection is pattern-based and not perfect
- False positives are possible
- UI is intentionally minimal
- Some websites may block programmatic paste
- Best suited for single-line sensitive data

PasteShield doesn’t try to be smart.  
It just gives you a moment to think before you mess up.

---

## Category
**Productivity**

---

## Language
English

---

## Permissions Justification
PasteShield only runs locally to inspect pasted text for sensitive patterns.  
It does not transmit, store, or share clipboard data.

---

## Privacy Policy
PasteShield does not collect, transmit, or store any personal data.  
All processing happens locally in the browser using pattern matching.

---

## Version Notes
v0.1.0 – Initial release
