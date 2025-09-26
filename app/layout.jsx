import "./globals.css";

export const metadata = {
  title: "Garuda - AI-Powered Phishing Detection Assistant",
  description: "Advanced AI-powered phishing detection for URLs, emails, messages, and screenshots. Protect yourself from cyber threats with our intelligent security assistant.",
  keywords: "phishing detection, cybersecurity, AI security, URL checker, email security, scam detection",
  authors: [{ name: "ABHAY. R, AMRUTH B, DISHA R, VINAY G. B" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#000000"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
