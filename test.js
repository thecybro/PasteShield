function detectSensitiveData(text) {
    const detections = [];

    // To detected passwords i.e. 8+ chars with uppercase, lowercase, and numbers
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (passwordPattern.test(text.trim())) {
        console.log('Warning: Password detected!');
        detections.push('Warning: Password detected!');
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
            detections.push('Warning: API Key / Token detected!');
            console.log('Warning: API Key / Token detected!');
            break;
        }
    }

    // To detect emails
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailPattern.test(text.trim())) {
        detections.push('Warning: Email Address detected!');
        console.log('Warning: Email Address detected!');
    }

    // // To detect phone numbers i.e. 10-15 digits
    const phonePattern = /^[\d\s\-\(\)\+]{10,15}$/;
    const digitsOnly = text.replace(/[\s\-\(\)\+]/g, '');
    if (phonePattern.test(text.trim()) && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        detections.push('Warning: Phone Number detected!');
        console.log('Warning: Phone Number detected!');
    }

    return detections;
  }

detectSensitiveData("testerbro18@gmail.com")
detectSensitiveData("+44 7700 900000")
detectSensitiveData("AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe")
detectSensitiveData("Yuc8$RikA34%ZoPPao98t")