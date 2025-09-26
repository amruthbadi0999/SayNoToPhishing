'use client';

import { useEffect, useRef, useState } from "react";
import { Send, Link2, ShieldAlert, Loader2, Mail, MessageSquare, Camera, Upload, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export default function Page() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "🛡️ Hello! I'm Garuda, your AI-powered phishing detection assistant. I can help you identify suspicious URLs, emails, messages, and screenshots. What would you like me to check for you?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Phishing detection states
  const [detectionType, setDetectionType] = useState('url');
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);

  const endRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => { 
    // Only auto-scroll when new messages are added or results are received
    if (mounted && hasUserInteracted && (messages.length > 0 || checkResult)) {
      const timeoutId = setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, checkResult, mounted, hasUserInteracted]);

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setHasUserInteracted(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].slice(-12) })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, citations: data.citations || [] }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Error: could not fetch response from model.' }]);
    } finally {
      setLoading(false);
    }
  }

    async function checkPhishing() {
    let inputData = {};
    let hasInput = false;

    switch (detectionType) {
      case 'url':
        if (!url.trim()) return;
        inputData = { url: url.trim() };
        hasInput = true;
        break;
      case 'email':
        if (!email.trim()) return;
        inputData = { email: email.trim() };
        hasInput = true;
        break;
      case 'message':
        if (!message.trim()) return;
        inputData = { message: message.trim() };
        hasInput = true;
        break;
        case 'screenshot':
        if (!screenshot) return;
        // Clear previous results when starting new analysis
        setCheckResult(null);
        setOcrProcessing(true);
        console.log('Sending screenshot for analysis...');
        
        // For screenshot analysis, use our OCR server
        try {
          setChecking(true);
          const ocrResponse = await fetch('http://localhost:3002/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: screenshot })
          });          const ocrResult = await ocrResponse.json();
          if (!ocrResult.success) {
            throw new Error(ocrResult.error || 'OCR processing failed');
          }
          
          // Use the OCR text for phishing analysis
          inputData = { message: ocrResult.text };
          hasInput = true;
        } catch (error) {
          console.error('OCR processing error:', error);
          setCheckResult({
            label: 'Error',
            confidence: 0,
            details: ['Failed to process image: ' + error.message]
          });
          return;
        } finally {
          setOcrProcessing(false);
        }
        break;
    }    if (!hasInput) return;

    setChecking(true);
    setCheckResult(null);
    setHasUserInteracted(true);
    try {
      const res = await fetch('/api/phishing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputData)
      });
      const data = await res.json();
      setCheckResult(data);
    } catch (e) {
      setCheckResult({ label: 'Error', confidence: 0, details: ['Could not check'] });
    } finally {
      setChecking(false);
    }
  }

  function handleScreenshotUpload(event) {
    const file = event.target.files[0];
    if (file) {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target.result;
        setScreenshot(base64String);
        console.log('Image converted to base64 successfully');
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        alert('Error reading the image file');
      };
      reader.readAsDataURL(file);
    }
  }

  function clearInputs() {
    setUrl("");
    setEmail("");
    setMessage("");
    setScreenshot(null);
    setCheckResult(null);
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Garuda</h1>
                <p className="text-sm text-gray-400">Phishing Detection Assistant</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>AI Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chatbot Area - 2/3 on large screens */}
          <div className="lg:col-span-2">
            <div className="card fade-in">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                  <ShieldAlert className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">🛡️ Garuda</h2>
                  <p className="text-gray-400">AI-powered phishing detection assistant</p>
                </div>
              </div>

              <div className="h-[60vh] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} slide-in`}>
                    <div className={`${m.role === 'user' ? 'message-user' : 'message-bot'} hover-lift max-w-[80%]`}>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {m.content}
                      </div>
                      {m.citations?.length ? (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="text-xs font-semibold text-blue-400 mb-2">📚 Sources:</div>
                          <ul className="space-y-1">
                            {m.citations.map((c,idx) => (
                              <li key={idx}>
                                <a 
                                  target="_blank" 
                                  href={c.url} 
                                  className="text-xs text-blue-300 hover:text-blue-200 underline transition-colors"
                                >
                                  {c.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="message-bot animation-dots">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="mt-6 flex gap-3">
                <input
                  className="input flex-1"
                  placeholder="Ask about phishing, cybersecurity, or fraud safety..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                />
                <button
                  className="btn inline-flex items-center gap-2 px-6"
                  onClick={sendMessage}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                We don't store chats. Always verify financial decisions with official sources.
              </div>
            </div>
          </div>

          {/* Phishing Detector - 1/3 on large screens */}
          <div className="lg:col-span-1">
            <div className="card fade-in">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Phishing Detector</h2>
                  <p className="text-sm text-gray-400">AI-powered threat analysis</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Detection Type Selector */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'url', label: 'URL', icon: Link2 },
                    { id: 'email', label: 'Email', icon: Mail },
                    { id: 'message', label: 'Message', icon: MessageSquare },
                    { id: 'screenshot', label: 'Screenshot', icon: Camera }
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => { setDetectionType(id); clearInputs(); }}
                      className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-200 hover-lift ${
                        detectionType === id 
                          ? 'bg-blue-600 text-white shadow-lg' 
                          : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Input Fields */}
                <div className="space-y-3">
                  {detectionType === 'url' && (
                    <div className="space-y-3">
                      <input
                        className="input"
                        placeholder="https://example.com"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') checkPhishing(); }}
                      />
                      <button 
                        className="btn w-full flex items-center justify-center gap-2" 
                        onClick={checkPhishing} 
                        disabled={checking || !url.trim()}
                      >
                        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                        {checking ? 'Analyzing...' : 'Check URL'}
                      </button>
                    </div>
                  )}

                  {detectionType === 'email' && (
                    <div className="space-y-3">
                      <textarea
                        className="input min-h-[120px] resize-none"
                        placeholder="Paste email content here..."
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                      <button 
                        className="btn w-full flex items-center justify-center gap-2" 
                        onClick={checkPhishing} 
                        disabled={checking || !email.trim()}
                      >
                        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        {checking ? 'Analyzing...' : 'Check Email'}
                      </button>
                    </div>
                  )}

                  {detectionType === 'message' && (
                    <div className="space-y-3">
                      <textarea
                        className="input min-h-[120px] resize-none"
                        placeholder="Paste message content here..."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                      />
                      <button 
                        className="btn w-full flex items-center justify-center gap-2" 
                        onClick={checkPhishing} 
                        disabled={checking || !message.trim()}
                      >
                        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                        {checking ? 'Analyzing...' : 'Check Message'}
                      </button>
                    </div>
                  )}

                  {detectionType === 'screenshot' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotUpload}
                          className="input"
                        />
                        <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      </div>
                      <div className="bg-blue-900/20 border border-blue-700 rounded-2xl p-3">
                        <div className="flex items-center gap-2 text-blue-400 text-sm">
                          <Camera className="w-4 h-4" />
                          <span className="font-medium">Screenshot Analysis</span>
                        </div>
                        <p className="text-blue-300 text-xs mt-1">
                          Upload a screenshot to detect phishing emails, fake websites, or suspicious messages. Works best with clear text content.
                        </p>
                      </div>
                      {screenshot && (
                        <div className="space-y-3">
                          <img 
                            src={screenshot} 
                            alt="Screenshot preview" 
                            className="w-full h-32 object-cover rounded-2xl border border-gray-700" 
                          />
                          <button
                            className="btn w-full flex items-center justify-center gap-2"
                            onClick={checkPhishing}
                            disabled={checking || ocrProcessing}
                          >
                            {(checking || ocrProcessing) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            {ocrProcessing ? 'Reading Text...' : checking ? 'Analyzing...' : 'Analyze Screenshot'}
                            {(checking || ocrProcessing) && (
                              <div className="absolute top-full left-0 right-0 mt-2 text-xs text-blue-400 text-center">
                                {ocrProcessing ? 'Converting image to text...' : 'Analyzing for phishing indicators...'}
                              </div>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Results */}
                {checkResult && (
                  <div className="mt-4 p-4 rounded-2xl border border-gray-700 bg-gray-800/50 backdrop-blur-xl slide-in">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {checkResult.label?.includes('Unsafe') ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : checkResult.label?.includes('Safe') ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        )}
                        <div className="text-sm font-semibold text-white">{checkResult.label}</div>
                      </div>
                      <div className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-lg">
                        {Math.round((checkResult.confidence || 0) * 100)}% confidence
                      </div>
                    </div>
                    <div className="text-sm text-gray-300 mb-3">{checkResult.summary}</div>
                    {checkResult.details && checkResult.details.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-400 mb-2">Analysis Details:</div>
                        <ul className="text-xs text-gray-400 space-y-1">
                          {checkResult.details.map((d, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <div className="w-1 h-1 bg-gray-500 rounded-full mt-2 flex-shrink-0"></div>
                              <span>{d}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer with Developer Credits */}
      <footer className="bg-black border-t border-gray-800 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">Garuda</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              AI-powered phishing detection and cybersecurity assistant
            </p>
            <div className="border-t border-gray-800 pt-6">
              <p className="text-gray-500 text-sm">
                Developed by <span className="text-white font-medium">Amruth Badi</span> 👨‍🔧
              </p>
              <p className="text-gray-600 text-xs mt-2">
                © 2025 Techy guy. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
