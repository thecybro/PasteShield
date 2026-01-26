function detectSensitiveData(text) {
    const detections = [];

    // To detected passwords i.e. 8+ chars with uppercase, lowercase, and numbers
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (passwordPattern.test(text.trim())) {
        console.log('Password');
        detections.push('Password');
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
            detections.push('API Key / Token');
            console.log('API Key / Token');
            break;
        }
    }

    // To detect emails
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (emailPattern.test(text.trim())) {
        detections.push('Email Address');
        console.log('Email Address');
    }

    // // To detect phone numbers i.e. 10-15 digits
    const phonePattern = /^[\d\s\-\(\)\+]{10,15}$/;
    const digitsOnly = text.replace(/[\s\-\(\)\+]/g, '');
    if (phonePattern.test(text.trim()) && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        detections.push('Phone Number');
        console.log('Phone Number');
    }

    return detections;
  }

detectSensitiveData("testerbro18@gmail.com")