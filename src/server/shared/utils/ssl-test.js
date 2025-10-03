// SSL Test Script for ITBrowser
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🧪 ITBrowser SSL Test');

// Check if browser exists
if (!fs.existsSync('./chrome.exe')) {
    console.log('❌ Browser not found. Please extract first.');
    process.exit(1);
}

// Launch browser with SSL test arguments
const launchArgs = [
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--allow-running-insecure-content',
    '--disable-web-security',
    '--no-sandbox',
    '--test-type',
    '--user-data-dir=./test-profile',
    'https://expired.badssl.com/'  // Test site with expired certificate
];

console.log('🚀 Launching browser with SSL test arguments...');
console.log('Arguments:', launchArgs);

const browser = spawn('./chrome.exe', launchArgs, {
    cwd: process.cwd(),
    stdio: 'pipe'
});

browser.stdout.on('data', (data) => {
    console.log('[BROWSER STDOUT]', data.toString());
});

browser.stderr.on('data', (data) => {
    console.log('[BROWSER STDERR]', data.toString());
});

browser.on('error', (error) => {
    console.error('❌ Browser launch error:', error.message);
});

browser.on('exit', (code) => {
    console.log('🏁 Browser exited with code:', code);
});

// Wait 30 seconds then close
setTimeout(() => {
    console.log('⏰ Test completed. Closing browser...');
    browser.kill();
}, 30000);