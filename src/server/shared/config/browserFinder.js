const fs = require('fs');
const path = require('path');

// Function to find the browser executable
function findBrowserExecutable() {
  // Check for extracted browser directory
  const possiblePaths = [
    './resources/browser/chrome.exe',  // Browser in resources/browser directory
  ];

  for (const browserPath of possiblePaths) {
    if (fs.existsSync(browserPath)) {
      return path.resolve(browserPath);
    }
  }

  // Always return the expected path even if file doesn't exist yet
  // This ensures we never fall back to default Chromium
  return path.resolve('./resources/browser/chrome.exe');
}

// Export the function
module.exports = { findBrowserExecutable };