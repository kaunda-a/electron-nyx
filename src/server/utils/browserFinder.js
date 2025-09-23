const fs = require('fs');
const path = require('path');

// Function to find the browser executable
function findBrowserExecutable() {
  // Check for extracted browser directory
  const possiblePaths = [
    './chrome.exe',  // Browser extracted to root
    './browser/chrome.exe',  // Browser in browser directory
    '../browser/chrome.exe',  // Relative path from server directory
    './131.0.6778.204/chrome.exe'  // Version-specific directory
  ];

  for (const browserPath of possiblePaths) {
    if (fs.existsSync(browserPath)) {
      return path.resolve(browserPath);
    }
  }

  // Always return the expected path even if file doesn't exist yet
  // This ensures we never fall back to default Chromium
  return path.resolve('./chrome.exe');
}

// Export the function
module.exports = { findBrowserExecutable };