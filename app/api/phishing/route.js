import { NextResponse } from "next/server";

const HF_API = process.env.HUGGINGFACE_API_KEY;
const PHISH_MODEL = process.env.HF_PHISH_MODEL || 'r3ddkahili/final-complete-malicious-url-model';

// URL validation function
function isValidUrlFormat(url) {
  // Basic URL pattern check
  const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  const ipPattern = /^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/i;
  
  // Check if it's a valid domain or IP
  if (urlPattern.test(url) || ipPattern.test(url)) {
    return true;
  }
  
  // Check if it starts with http/https or looks like a domain
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return true;
  }
  
  // Check if it looks like a domain (contains dots and valid characters)
  if (url.includes('.') && /^[a-zA-Z0-9.-]+$/.test(url.split(' ')[0])) {
    return true;
  }
  
  return false;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { url, email, message, screenshot } = body;
    
    // Handle URL detection
    if (url) {
      return await detectUrlPhishing(url);
    }
    
    // Handle email detection
    if (email) {
      return await detectEmailPhishing(email);
    }
    
    // Handle message detection
    if (message) {
      return await detectMessagePhishing(message);
    }
    
    // Handle screenshot detection
    if (screenshot) {
      return await detectScreenshotPhishing(screenshot);
    }
    
    return NextResponse.json({ 
      label: 'Invalid', 
      confidence: 0, 
      details: ['No input provided. Please provide URL, email, message, or screenshot.'] 
    });
  } catch (e) {
    console.error('Phishing detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Internal error: ' + e.message] 
    }, { status: 500 });
  }
}

async function detectUrlPhishing(url) {
  if (!url || !url.trim()) {
    return NextResponse.json({ 
      label: 'Invalid URL', 
      confidence: 0, 
      summary: 'No URL provided. Please enter a valid URL to analyze.',
      details: ['Please provide a URL to check for phishing attempts.'],
      type: 'url'
    });
  }

  // Clean and validate URL format
  const cleanUrl = url.trim();
  
  // Basic URL format validation
  if (!isValidUrlFormat(cleanUrl)) {
    return NextResponse.json({ 
      label: 'Invalid URL', 
      confidence: 0, 
      summary: 'Invalid URL format. Please check the URL and try again.',
      details: ['The provided text does not appear to be a valid URL format.'],
      type: 'url'
    });
  }

  // Check if API key is available
  if (!HF_API || HF_API === 'your_huggingface_api_key_here') {
    return await fallbackUrlDetection(cleanUrl);
  }

  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${PHISH_MODEL}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${HF_API}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        inputs: url, 
        options: { wait_for_model: true } 
      })
    });

    if (!res.ok) {
      return NextResponse.json({
        label: 'API Error',
        confidence: 0,
        summary: `Hugging Face API error: ${res.status} ${res.statusText}`,
        details: ['Please check your API key and try again.']
      });
    }

    const text = await res.text();
    let parsed = null;
    
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({
        label: 'Parse Error',
        confidence: 0,
        summary: `Model did not return valid JSON. Raw response: ${text.substring(0, 200)}...`,
        details: ['The model response could not be parsed. This might be a temporary issue.']
      });
    }

    let label = 'Unknown';
    let confidence = 0;

    if (Array.isArray(parsed) && parsed[0]?.label) {
      label = parsed[0].label;
      confidence = parsed[0].score ?? 0;
    } else if (Array.isArray(parsed) && parsed[0]?.[0]?.label) {
      label = parsed[0][0].label;
      confidence = parsed[0][0].score ?? 0;
    } else if (parsed?.label) {
      label = parsed.label;
      confidence = parsed.score ?? 0;
    } else {
      // Fallback to rule-based detection if API fails
      return await fallbackUrlDetection(url);
    }

    const unsafe = ['phishing', 'malware', 'defacement', 'squatting'];
    let verdict;
    let riskLevel;
    
    if (unsafe.includes(label.toLowerCase())) {
      verdict = 'Unsafe';
      riskLevel = 'High Risk';
    } else if (confidence < 0.3) {
      verdict = 'Safe';
      riskLevel = 'Low Risk';
    } else {
      verdict = 'Suspicious';
      riskLevel = 'Medium Risk';
    }
    
    const summary = verdict === 'Unsafe'
      ? `AI model detected ${label} with ${(confidence*100).toFixed(1)}% confidence. This URL is potentially dangerous.`
      : verdict === 'Suspicious'
      ? `AI model shows some concerns with ${(confidence*100).toFixed(1)}% confidence. Proceed with caution.`
      : `AI model predicts the URL is likely safe with ${(confidence*100).toFixed(1)}% confidence.`;

    const details = [
      `AI Model Analysis: ${label}`,
      `Model Confidence: ${(confidence*100).toFixed(2)}%`,
      `Risk Assessment: ${riskLevel}`
    ];

    // Additional URL analysis
    try {
      const u = new URL(url);
      if ((u.hostname.match(/\./g) || []).length >= 4) details.push('Multiple subdomains detected.');
      if (u.hostname.includes('-')) details.push('Hyphens in host name.');
      if (url.length > 90) details.push('Long URL length.');
      if (u.protocol !== 'https:') details.push('Not using HTTPS protocol.');
    } catch {}

    return NextResponse.json({ 
      label: `${verdict} (${riskLevel})`, 
      confidence, 
      summary, 
      details,
      type: 'url',
      riskLevel,
      modelLabel: label
    });
  } catch (e) {
    console.error('URL detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['URL detection failed: ' + e.message] 
    });
  }
}

async function detectEmailPhishing(email) {
  if (!email) {
    return NextResponse.json({ label: 'Invalid', confidence: 0, details: ['No email provided'] });
  }

  try {
    // Basic email phishing detection using pattern matching
    const suspiciousPatterns = [
      { pattern: /urgent|immediate|act now|limited time/i, weight: 0.3 },
      { pattern: /click here|verify account|update information/i, weight: 0.4 },
      { pattern: /suspended|locked|expired|terminated/i, weight: 0.3 },
      { pattern: /free money|win|prize|lottery/i, weight: 0.5 },
      { pattern: /bank|paypal|amazon|apple|microsoft/i, weight: 0.2 },
      { pattern: /http[s]?:\/\/[^\s]+/i, weight: 0.3 },
      { pattern: /[^\s]+@[^\s]+\.[^\s]+/i, weight: 0.1 }
    ];

    let totalScore = 0;
    const matchedPatterns = [];

    for (const { pattern, weight } of suspiciousPatterns) {
      if (pattern.test(email)) {
        totalScore += weight;
        matchedPatterns.push(pattern.source);
      }
    }

    // Check for suspicious domains
    const domainMatch = email.match(/@([^\s]+)/);
    if (domainMatch) {
      const domain = domainMatch[1].toLowerCase();
      const suspiciousDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
      if (suspiciousDomains.some(d => domain.includes(d))) {
        totalScore += 0.1;
        matchedPatterns.push('Suspicious domain');
      }
    }

    const confidence = Math.min(totalScore, 1);
    const verdict = confidence > 0.5 ? 'Unsafe' : 'Safe';
    
    const summary = verdict === 'Unsafe'
      ? `Email contains ${matchedPatterns.length} suspicious patterns with ${(confidence*100).toFixed(1)}% confidence.`
      : `Email appears legitimate with ${(confidence*100).toFixed(1)}% confidence.`;

    const details = [
      `Suspicious patterns detected: ${matchedPatterns.length}`,
      `Matched patterns: ${matchedPatterns.join(', ')}`,
      `Confidence score: ${(confidence*100).toFixed(2)}%`
    ];

    return NextResponse.json({ 
      label: `${verdict} (Email)`, 
      confidence, 
      summary, 
      details,
      type: 'email'
    });
  } catch (e) {
    console.error('Email detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Email detection failed: ' + e.message] 
    });
  }
}

async function detectMessagePhishing(message) {
  if (!message) {
    return NextResponse.json({ label: 'Invalid', confidence: 0, details: ['No message provided'] });
  }

  try {
    // Similar pattern matching for text messages
    const suspiciousPatterns = [
      { pattern: /urgent|immediate|act now|limited time/i, weight: 0.3 },
      { pattern: /click here|verify|update|confirm/i, weight: 0.4 },
      { pattern: /suspended|locked|expired|terminated/i, weight: 0.3 },
      { pattern: /free money|win|prize|lottery|congratulations/i, weight: 0.5 },
      { pattern: /bank|paypal|amazon|apple|microsoft|google/i, weight: 0.2 },
      { pattern: /http[s]?:\/\/[^\s]+/i, weight: 0.4 },
      { pattern: /call now|text back|reply stop/i, weight: 0.3 }
    ];

    let totalScore = 0;
    const matchedPatterns = [];

    for (const { pattern, weight } of suspiciousPatterns) {
      if (pattern.test(message)) {
        totalScore += weight;
        matchedPatterns.push(pattern.source);
      }
    }

    const confidence = Math.min(totalScore, 1);
    const verdict = confidence > 0.5 ? 'Unsafe' : 'Safe';
    
    const summary = verdict === 'Unsafe'
      ? `Message contains ${matchedPatterns.length} suspicious patterns with ${(confidence*100).toFixed(1)}% confidence.`
      : `Message appears legitimate with ${(confidence*100).toFixed(1)}% confidence.`;

    const details = [
      `Suspicious patterns detected: ${matchedPatterns.length}`,
      `Matched patterns: ${matchedPatterns.join(', ')}`,
      `Confidence score: ${(confidence*100).toFixed(2)}%`
    ];

    return NextResponse.json({ 
      label: `${verdict} (Message)`, 
      confidence, 
      summary, 
      details,
      type: 'message'
    });
  } catch (e) {
    console.error('Message detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Message detection failed: ' + e.message] 
    });
  }
}

async function detectScreenshotPhishing(screenshot) {
  if (!screenshot) {
    return NextResponse.json({ label: 'Invalid', confidence: 0, details: ['No screenshot provided'] });
  }

  try {
    // Extract text from screenshot using OCR
    const extractedText = await extractTextFromImage(screenshot);
    
    if (!extractedText || extractedText.trim().length < 10) {
      return NextResponse.json({ 
        label: 'No Text Detected', 
        confidence: 0, 
        summary: 'No readable text found in the screenshot.',
        details: ['Please ensure the screenshot contains clear, readable text.'],
        type: 'screenshot'
      });
    }

    // Enhanced phishing pattern detection for screenshots
    const suspiciousPatterns = [
      // Prize/Lottery scams (very common in screenshots)
      { pattern: /congratulations|winner|prize|lottery|jackpot/i, weight: 0.5 },
      { pattern: /rs\s*\d+\s*(crore|lakh|thousand)/i, weight: 0.6 },
      { pattern: /audi|bmw|mercedes|car|suv|motors/i, weight: 0.4 },
      { pattern: /promotion|contest|draw|2019|2020|2021|2022|2023|2024/i, weight: 0.4 },
      
      // Payment requests (high priority)
      { pattern: /custom\s*duty|clearance\s*fee|processing\s*fee|notarization/i, weight: 0.7 },
      { pattern: /pay\s*now|urgent\s*payment|immediate\s*action|fee/i, weight: 0.6 },
      { pattern: /inr|rupees|dollars|euros|25000|2500/i, weight: 0.3 },
      
      // Fake authorities and delivery
      { pattern: /delivery\s*officer|courier\s*service|customs|apc/i, weight: 0.5 },
      { pattern: /united\s*kingdom|uk|india|customs|mk14/i, weight: 0.4 },
      { pattern: /flight\s*information|departure|arrival|time/i, weight: 0.4 },
      { pattern: /ramond\s*wayn|officer|mr\./i, weight: 0.3 },
      
      // Urgency tactics
      { pattern: /tomorrow|urgent|immediate|limited\s*time|morning/i, weight: 0.5 },
      { pattern: /act\s*now|don't\s*delay|expires\s*soon|arriving/i, weight: 0.6 },
      
      // Personal information requests
      { pattern: /id\s*card|passport|voter\s*card|pan\s*card|valid\s*id/i, weight: 0.5 },
      { pattern: /personal\s*information|bank\s*details|account|proof/i, weight: 0.5 },
      
      // Contact and phone numbers
      { pattern: /telephone|phone|contact|email|0044/i, weight: 0.3 },
      { pattern: /\d{10,}/, weight: 0.3 }, // Long phone numbers
      
      // Generic greetings and attention grabbers
      { pattern: /attention|dear\s*winner|dear\s*customer/i, weight: 0.4 },
      { pattern: /lucky\s*winner|selected|chosen/i, weight: 0.4 },
      
      // Document and parcel contents
      { pattern: /demand\s*draft|affidavit|covering\s*documents/i, weight: 0.4 },
      { pattern: /parcel|consignment|delivery|contents/i, weight: 0.3 },
      
      // Gmail interface indicators
      { pattern: /gmail|google|mail|sent|inbox/i, weight: 0.1 }
    ];

    let totalScore = 0;
    const matchedPatterns = [];
    const text = extractedText.toLowerCase();

    for (const { pattern, weight } of suspiciousPatterns) {
      if (pattern.test(text)) {
        totalScore += weight;
        matchedPatterns.push(pattern.source);
      }
    }

    // Check for suspicious URLs in the text
    const urlMatches = text.match(/https?:\/\/[^\s]+/g);
    if (urlMatches) {
      for (const url of urlMatches) {
        try {
          const u = new URL(url);
          if (u.hostname.includes('-')) totalScore += 0.2;
          if (u.hostname.split('.').length > 3) totalScore += 0.2;
          if (url.length > 80) totalScore += 0.1;
          // Check for suspicious domains
          const suspiciousDomains = ['bit.ly', 'tinyurl', 'short.link', 't.co', 'goo.gl'];
          if (suspiciousDomains.some(domain => u.hostname.includes(domain))) {
            totalScore += 0.3;
          }
        } catch {}
      }
    }

    // Check for email addresses (potential spoofing)
    const emailMatches = text.match(/[^\s]+@[^\s]+\.[^\s]+/g);
    if (emailMatches) {
      for (const email of emailMatches) {
        const domain = email.split('@')[1];
        const suspiciousDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
        if (suspiciousDomains.some(suspicious => domain.includes(suspicious))) {
          totalScore += 0.2;
        }
      }
    }

    // Check for phone numbers (common in scams)
    const phoneMatches = text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
    if (phoneMatches && phoneMatches.length > 0) {
      totalScore += 0.2;
    }

    // Check for excessive punctuation (common in scam messages)
    const exclamationCount = (text.match(/!/g) || []).length;
    const questionCount = (text.match(/\?/g) || []).length;
    if (exclamationCount > 3 || questionCount > 3) {
      totalScore += 0.2;
    }

    const confidence = Math.min(totalScore, 1);
    const verdict = confidence > 0.2 ? 'Unsafe' : 'Safe'; // Very sensitive threshold for screenshot detection
    
    const summary = verdict === 'Unsafe'
      ? `Screenshot contains ${matchedPatterns.length} suspicious patterns with ${(confidence*100).toFixed(1)}% confidence.`
      : `Screenshot appears legitimate with ${(confidence*100).toFixed(1)}% confidence.`;

    const details = [
      `Text extracted: ${extractedText.length} characters`,
      `Suspicious patterns detected: ${matchedPatterns.length}`,
      `Matched patterns: ${matchedPatterns.slice(0, 3).join(', ')}${matchedPatterns.length > 3 ? '...' : ''}`,
      `Confidence score: ${(confidence*100).toFixed(2)}%`
    ];

    if (urlMatches && urlMatches.length > 0) {
      details.push(`URLs found: ${urlMatches.length}`);
    }
    if (emailMatches && emailMatches.length > 0) {
      details.push(`Email addresses found: ${emailMatches.length}`);
    }
    if (phoneMatches && phoneMatches.length > 0) {
      details.push(`Phone numbers found: ${phoneMatches.length}`);
    }

    return NextResponse.json({ 
      label: `${verdict} (Screenshot)`, 
      confidence, 
      summary, 
      details,
      type: 'screenshot',
      extractedText: extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '')
    });
  } catch (e) {
    console.error('Screenshot detection error:', e);
    return NextResponse.json({ 
      label: 'Error', 
      confidence: 0, 
      details: ['Screenshot detection failed: ' + e.message] 
    });
  }
}

async function fallbackUrlDetection(url) {
  try {
    // Add protocol if missing
    let testUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      testUrl = 'https://' + url;
    }
    
    let u;
    try {
      u = new URL(testUrl);
    } catch (urlError) {
      return NextResponse.json({ 
        label: 'Invalid URL', 
        confidence: 0, 
        summary: 'The provided URL is not valid and cannot be parsed.',
        details: ['Please check the URL format and ensure it is a valid web address.'],
        type: 'url'
      });
    }
    
    let score = 0;
    const details = [];
    const positiveIndicators = [];
    const negativeIndicators = [];
    
    // Check for suspicious patterns
    if (u.hostname.includes('-')) {
      score += 0.2;
      details.push('Hyphens in hostname');
      negativeIndicators.push('Contains hyphens');
    }
    
    if ((u.hostname.match(/\./g) || []).length >= 4) {
      score += 0.3;
      details.push('Multiple subdomains detected');
      negativeIndicators.push('Multiple subdomains');
    }
    
    if (url.length > 90) {
      score += 0.2;
      details.push('Long URL length');
      negativeIndicators.push('Unusually long URL');
    }
    
    if (u.protocol !== 'https:') {
      score += 0.3;
      details.push('Not using HTTPS protocol');
      negativeIndicators.push('No HTTPS encryption');
    } else {
      positiveIndicators.push('Uses HTTPS encryption');
    }
    
    // Enhanced typosquatting detection
    const suspiciousDomains = [
      'g0ogle', 'go0gle', 'g00gle', 'faceb00k', 'amaz0n', 'paypa1', 'micr0soft', 'app1e', 'y0utube',
      'g00gle', 'faceb0ok', 'amaz0n', 'paypai', 'micr0s0ft', 'appie', 'y0utub3',
      'goog1e', 'faceb00k', 'amaz0n', 'paypa1', 'micr0s0ft', 'app1e', 'y0utub3',
      'g00g1e', 'faceb0ok', 'amaz0n', 'paypai', 'micr0s0ft', 'appie', 'y0utub3'
    ];
    if (suspiciousDomains.some(domain => u.hostname.includes(domain))) {
      score += 0.6;
      details.push('Potential typosquatting detected');
    }
    
    // Check for suspicious TLDs
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.click', '.download', '.exe', '.zip', '.pdf'];
    if (suspiciousTlds.some(tld => u.hostname.endsWith(tld))) {
      score += 0.4;
      details.push('Suspicious top-level domain');
    }
    
    // Check for IP addresses
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(u.hostname)) {
      score += 0.4;
      details.push('Uses IP address instead of domain name');
    }
    
    // Check for shortened URLs
    const shorteners = ['bit.ly', 'tinyurl.com', 'short.link', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'v.gd'];
    if (shorteners.some(shortener => u.hostname.includes(shortener))) {
      score += 0.3;
      details.push('Shortened URL detected');
    }
    
    // Enhanced suspicious keywords in path
    const suspiciousKeywords = [
      'login', 'verify', 'account', 'security', 'update', 'confirm', 'validate',
      'password', 'reset', 'unlock', 'suspended', 'locked', 'expired',
      'payment', 'billing', 'invoice', 'refund', 'transaction',
      'support', 'help', 'contact', 'service', 'customer'
    ];
    if (suspiciousKeywords.some(keyword => u.pathname.toLowerCase().includes(keyword))) {
      score += 0.3;
      details.push('Suspicious keywords in URL path');
    }
    
    // Check for suspicious query parameters
    const suspiciousParams = ['password', 'token', 'key', 'secret', 'auth', 'login'];
    if (suspiciousParams.some(param => u.searchParams.has(param))) {
      score += 0.4;
      details.push('Suspicious query parameters detected');
    }
    
    // Check for excessive numbers in domain (common in phishing)
    const numberCount = (u.hostname.match(/\d/g) || []).length;
    if (numberCount > 3) {
      score += 0.2;
      details.push('Excessive numbers in domain name');
    }
    
    // Check for mixed case domains (potential obfuscation)
    if (u.hostname !== u.hostname.toLowerCase() && u.hostname !== u.hostname.toUpperCase()) {
      score += 0.1;
      details.push('Mixed case domain (potential obfuscation)');
    }
    
    // Check for recently registered domains (common in phishing)
    // This would require a WHOIS lookup in a real implementation
    
    // Check for suspicious port numbers
    if (u.port && (u.port !== '80' && u.port !== '443' && u.port !== '8080')) {
      score += 0.2;
      details.push('Non-standard port number');
    }
    
    // Check for URL encoding (potential obfuscation)
    if (url.includes('%') && url.includes('%20')) {
      score += 0.2;
      details.push('URL encoding detected (potential obfuscation)');
    }
    
    // Calculate confidence based on score and indicators
    const confidence = Math.min(score, 1);
    
    // Determine verdict with better thresholds
    let verdict;
    let riskLevel;
    
    if (confidence >= 0.7) {
      verdict = 'Unsafe';
      riskLevel = 'High Risk';
    } else if (confidence >= 0.4) {
      verdict = 'Suspicious';
      riskLevel = 'Medium Risk';
    } else if (confidence >= 0.2) {
      verdict = 'Caution';
      riskLevel = 'Low Risk';
    } else {
      verdict = 'Safe';
      riskLevel = 'Low Risk';
    }
    
    // Create detailed summary
    let summary;
    if (verdict === 'Unsafe') {
      summary = `High risk detected! Found ${negativeIndicators.length} suspicious indicators with ${(confidence*100).toFixed(1)}% confidence. Avoid this URL.`;
    } else if (verdict === 'Suspicious') {
      summary = `Suspicious activity detected. Found ${negativeIndicators.length} concerning indicators with ${(confidence*100).toFixed(1)}% confidence. Proceed with caution.`;
    } else if (verdict === 'Caution') {
      summary = `Some minor concerns detected with ${(confidence*100).toFixed(1)}% confidence. Generally safe but be cautious.`;
    } else {
      summary = `URL appears safe with ${(confidence*100).toFixed(1)}% confidence. No major security concerns detected.`;
    }
    
    // Add positive indicators to details if any
    if (positiveIndicators.length > 0) {
      details.push(`Positive indicators: ${positiveIndicators.join(', ')}`);
    }
    
    return NextResponse.json({ 
      label: `${verdict} (${riskLevel})`, 
      confidence, 
      summary, 
      details,
      type: 'url',
      riskLevel,
      positiveIndicators,
      negativeIndicators
    });
  } catch (e) {
    return NextResponse.json({ 
      label: 'Invalid URL', 
      confidence: 0, 
      summary: 'The provided URL is not valid.',
      details: ['Please check the URL format and try again.'],
      type: 'url'
    });
  }
}

async function extractTextFromImage(imageData) {
  try {
    // Use the OCR API to extract text from the image
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const ocrResponse = await fetch(`${baseUrl}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });

    if (!ocrResponse.ok) {
      throw new Error('OCR API failed');
    }

    const ocrResult = await ocrResponse.json();
    
    if (ocrResult.success) {
      return ocrResult.text;
    } else {
      throw new Error(ocrResult.error || 'OCR failed');
    }
  } catch (e) {
    console.error('Text extraction error:', e);
    // Fallback: return a message indicating OCR is not available
    return 'OCR service temporarily unavailable. Please use URL, Email, or Message detection instead.';
  }
}
