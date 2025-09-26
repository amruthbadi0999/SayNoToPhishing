const { spawn } = require('child_process');
const path = require('path');

let nextApp = null;
let ocrServer = null;

function startServers() {
  // Start Next.js development server
  nextApp = spawn('npm', ['run', 'dev:next'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: 3001 }
  });

  // Start OCR server
  ocrServer = spawn('node', ['ocr-server/server.js'], {
    stdio: 'inherit'
  });

  // Handle server exits
  nextApp.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM') {
      console.log('Next.js server exited. Shutting down...');
      cleanup();
    }
  });

  ocrServer.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM') {
      console.log('OCR server exited. Shutting down...');
      cleanup();
    }
  });
}

function cleanup() {
  if (nextApp) {
    nextApp.kill('SIGTERM');
  }
  if (ocrServer) {
    ocrServer.kill('SIGTERM');
  }
  process.exit();
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  cleanup();
});

// Start the servers
startServers();