#!/usr/bin/env node

// SSL Certificate Diagnostic Tool
const fs = require('fs');
const path = require('path');

console.log('🔍 ITBrowser SSL Certificate Diagnostic Tool');
console.log('============================================\n');

// Check if browser executable exists
const browserPath = './chrome.exe';
if (!fs.existsSync(browserPath)) {
    console.log('❌ Browser executable not found at:', browserPath);
    console.log('💡 Please extract the browser using: node client/build-with-browser.js');
    process.exit(1);
}

console.log('✅ Browser executable found');

// Check launch arguments in itBrowserAPI.js
const itBrowserAPIPath = './server/src/services/itBrowserAPI.js';
if (fs.existsSync(itBrowserAPIPath)) {
    const content = fs.readFileSync(itBrowserAPIPath, 'utf8');
    
    const sslFlags = [
        '--ignore-certificate-errors',
        '--ignore-ssl-errors', 
        '--allow-running-insecure-content',
        '--disable-web-security',
        '--no-sandbox'
    ];
    
    console.log('\n📋 Checking SSL launch arguments...');
    sslFlags.forEach(flag => {
        if (content.includes(flag)) {
            console.log(`✅ Found: ${flag}`);
        } else {
            console.log(`❌ Missing: ${flag}`);
        }
    });
} else {
    console.log('❌ itBrowserAPI.js not found at:', itBrowserAPIPath);
}

// Check if fingerprint browser zip exists
const zipPath = './fingerprint_browser_v1.0.7z';
if (fs.existsSync(zipPath)) {
    console.log('\n✅ Browser zip file found');
    const stats = fs.statSync(zipPath);
    console.log(`📦 File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
} else {
    console.log('\n⚠️ Browser zip file not found locally');
    console.log('💡 The build process will automatically download it from:');
    console.log('   https://github.com/itbrowser-net/undetectable-fingerprint-browser/releases/download/v1.0.0/fingerprint_browser_v1.0.7z');
    console.log('   Alternatively, you can manually download it and place it in the project root directory.');
}

// Check proxy configuration
console.log('\n🌐 Proxy Configuration Check');
console.log('---------------------------');

// Try to read proxy configuration from environment or files
const proxyConfigPaths = [
    './server/.env',
    './server/config/proxy.json',
    './localStorage/proxies/'
];

let foundProxyConfig = false;
for (const configPath of proxyConfigPaths) {
    if (fs.existsSync(configPath)) {
        console.log(`✅ Found configuration at: ${configPath}`);
        foundProxyConfig = true;
        
        if (configPath.endsWith('.env')) {
            const envContent = fs.readFileSync(configPath, 'utf8');
            if (envContent.includes('PROXY')) {
                console.log('  📋 Contains proxy configuration');
            }
        }
    }
}

if (!foundProxyConfig) {
    console.log('⚠️  No proxy configuration found');
    console.log('💡 Create a .env file in the server directory with proxy settings');
}

console.log('\n🔧 Recommended Solutions if SSL Errors Persist:');
console.log('1. Add --test-type flag to browser launch arguments');
console.log('2. Ensure proxy authentication is properly configured');
console.log('3. Check if the website uses certificate pinning');
console.log('4. Verify proxy SSL certificate compatibility');
console.log('5. Try different proxy protocols (HTTP vs HTTPS vs SOCKS)');

console.log('\n🧪 Test Command:');
console.log('node server/src/utils/ssl-test.js');

console.log('\n✅ Diagnostic complete');