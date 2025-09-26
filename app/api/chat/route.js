import { NextResponse } from "next/server";

const HF_API = process.env.HUGGINGFACE_API_KEY;
const LLAMA_MODEL = process.env.HF_CHAT_MODEL || 'meta-llama/Llama-2-7b-chat-hf';

async function callHfModel(prompt) {
  const res = await fetch(`https://api-inference.huggingface.co/models/${LLAMA_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_API}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true, use_cache: false } })
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (typeof data === 'string') return data;
    if (data?.generated_text) return data.generated_text;
    if (Array.isArray(data) && data[0]?.generated_text) return data[0].generated_text;
    if (data?.error) throw new Error(data.error);
    return JSON.stringify(data);
  } else {
    return await res.text();
  }
}

function buildSystemPrompt() {
  return [
    "You are Secure FinBot — a friendly, concise financial assistant specialized in banking, loans, and fraud alerts.",
    "Answer clearly in simple language. Use short bullet lists when helpful. Do not give legal or financial advice; suggest official sources or a professional.",
    "When asked about scams or fraud, include at least one reputable source where the user can read more."
  ].join('\n');
}

function buildChatPrompt(messages) {
  const sys = buildSystemPrompt();
  const conv = ['System: ' + sys];
  for (const m of messages) {
    const role = m.role === 'user' ? 'User' : (m.role === 'assistant' ? 'Assistant' : m.role);
    conv.push(`${role}: ${m.content}`);
  }
  conv.push('Assistant:');
  return conv.join('\n');
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const lastUser = messages.slice().reverse().find(m => m.role === 'user')?.content || '';
    
    // Check if API key is available, otherwise use fallback
    if (!HF_API || HF_API === 'your_huggingface_api_key_here') {
      const output = generateFallbackResponse(lastUser);
      const citations = generateFallbackCitations(lastUser);
      return NextResponse.json({ message: output, citations });
    }

    const prompt = buildChatPrompt(messages);
    const output = await callHfModel(prompt);

    // Basic keyword-based citations (Wikipedia + FTC)
    const kws = lastUser.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0,6);
    const citations = [];
    for (const k of kws) {
      try {
        if (k.includes('phishing') || k.includes('scam')) citations.push({ title: 'FTC: Recognizing and Avoiding Phishing Scams', url: 'https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams' });
        const s = await fetch(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(k)}&limit=1`);
        if (s.ok) {
          const d = await s.json();
          if (d?.pages?.length) {
            const p = d.pages[0];
            citations.push({ title: p.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/\s+/g,'_'))}` });
          }
        }
      } catch(e){}
    }
    // dedupe and cap
    const uniq = new Map();
    for (const c of citations) if (!uniq.has(c.url)) uniq.set(c.url, c);
    const final = Array.from(uniq.values()).slice(0,3);

    return NextResponse.json({ message: output, citations: final });
  } catch (e) {
    console.error(e);
    // Fallback response on error
    const lastUser = body.messages?.slice().reverse().find(m => m.role === 'user')?.content || '';
    const output = generateFallbackResponse(lastUser);
    const citations = generateFallbackCitations(lastUser);
    return NextResponse.json({ message: output, citations });
  }
}

function generateFallbackResponse(userMessage) {
  const message = userMessage.toLowerCase();
  
  if (message.includes('phishing') || message.includes('scam')) {
    return `🛡️ Phishing is a cyber attack where criminals try to trick you into giving away personal information like passwords, credit card numbers, or bank details. Here's how to protect yourself:

• **Never click suspicious links** in emails or messages
• **Verify the sender** - check if the email address looks legitimate
• **Look for urgent language** - "Act now!" or "Your account will be closed!"
• **Check the URL** - hover over links to see the real destination
• **Don't share personal info** - legitimate companies won't ask for passwords via email
• **When in doubt, contact the company directly** using their official website

Remember: When something seems too good to be true, it usually is!`;
  }
  
  if (message.includes('url') || message.includes('link')) {
    return `🔗 When checking URLs for safety, look for these red flags:

• **Suspicious domains** - misspellings like "g0ogle" instead of "google"
• **No HTTPS** - secure sites start with "https://"
• **Too many subdomains** - like "very.long.suspicious.domain.com"
• **Shortened URLs** - be cautious with bit.ly, tinyurl.com links
• **IP addresses** - legitimate sites use domain names, not numbers

Use the URL detection tool on the right to analyze any suspicious links!`;
  }
  
  if (message.includes('email') || message.includes('message')) {
    return `📧 Suspicious emails and messages often contain:

• **Urgent language** - "Act immediately!" or "Limited time offer!"
• **Generic greetings** - "Dear Customer" instead of your name
• **Suspicious attachments** - unexpected files or documents
• **Links to fake websites** - designed to steal your information
• **Requests for personal info** - passwords, SSN, or account details
• **Poor grammar and spelling** - professional companies proofread their messages

Use the Email or Message detection tools to analyze suspicious content!`;
  }
  
  if (message.includes('help') || message.includes('how')) {
    return `🛡️ I'm Garuda, your phishing detection assistant! Here's how I can help:

• **URL Detection** - Paste suspicious links to check if they're safe
• **Email Analysis** - Upload email content to detect phishing attempts
• **Message Scanning** - Check text messages for suspicious patterns
• **Screenshot Analysis** - Upload images to extract and analyze text

Just ask me about phishing, cybersecurity, or use the detection tools on the right!`;
  }
  
  return `🛡️ I'm Garuda, your AI-powered phishing detection assistant! I can help you identify suspicious URLs, emails, messages, and screenshots. 

Try asking me about:
• How to spot phishing emails
• What makes a URL suspicious
• How to protect yourself from scams
• Or use the detection tools on the right to analyze content!`;
}

function generateFallbackCitations(userMessage) {
  const message = userMessage.toLowerCase();
  const citations = [];
  
  if (message.includes('phishing') || message.includes('scam')) {
    citations.push({ 
      title: 'FTC: Recognizing and Avoiding Phishing Scams', 
      url: 'https://consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams' 
    });
  }
  
  if (message.includes('cybersecurity') || message.includes('security')) {
    citations.push({ 
      title: 'CISA: Cybersecurity Tips', 
      url: 'https://www.cisa.gov/cybersecurity-tips' 
    });
  }
  
  citations.push({ 
    title: 'Wikipedia: Phishing', 
    url: 'https://en.wikipedia.org/wiki/Phishing' 
  });
  
  return citations.slice(0, 3);
}
