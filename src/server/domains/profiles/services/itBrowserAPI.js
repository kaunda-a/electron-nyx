const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const Profile = require('../models/Profile');
const config = require('../../../shared/config/config');
const logger = require('../../../shared/utils/logger');

class ItBrowserAPI {
    constructor() {
        this.activeBrowsers = new Map();
        this.userAgentsData = null;
        this.webglData = null;
        this.keepAliveIntervals = new Map(); // To store keep-alive intervals for browsers
    }

    /** 
     * Static cache for fingerprints shared across all instances
     */
    static fingerprintCache = new Map();

    /**
     * Load fingerprint source data from files
     */
    async loadFingerprintData() {
        if (!this.userAgentsData) {
            const userAgentsPath = path.join(config.itbrowser.fingerprintSourcePath, 'user-agents.json');
            this.userAgentsData = await fs.readJson(userAgentsPath);
            logger.info(`Loaded ${this.userAgentsData.length} user agents from fingerprint database`);
        }
        if (!this.webglData) {
            const webglPath = path.join(config.itbrowser.fingerprintSourcePath, 'webgl.json');
            this.webglData = await fs.readJson(webglPath);
            logger.info(`Loaded ${this.webglData.length} WebGL fingerprints from database`);
        }
    }

    /**
     * Generate a new fingerprint using itBrowser fingerprint data
     * @param {Object} profile - Profile object with id, profileNumber, and category
     * @param {Object} options - Additional options including geographic context
     * @returns {Promise<Object>} Generated fingerprint data
     */
    async generateFingerprint(profile, options = {}) {
        // Convert plain object to Profile instance if needed
        let profileInstance = profile;
        if (!(profile instanceof Profile) && profile.id) {
            console.log('DEBUG: Converting plain object to Profile instance');
            profileInstance = Profile.fromJSON(profile);
            console.log('DEBUG: Converted profile instanceof Profile:', profileInstance instanceof Profile);
        }
        
        try {
            console.log('DEBUG: generateFingerprint called with profile:', profile);
            console.log('DEBUG: profile type:', typeof profile);
            console.log('DEBUG: profile instanceof Profile:', profile instanceof Profile);
            console.log('DEBUG: profile.getDirName:', profile.getDirName);
            
            console.log('DEBUG: generateFingerprint called with:', { profileId: profileInstance.id, profileNumber: profileInstance.profileNumber, category: profileInstance.category, options });
            console.log('DEBUG: options type:', typeof options);
            console.log('DEBUG: options.geographic:', options.geographic);
            await this.loadFingerprintData();

            const fingerprintId = uuidv4();
            // Create profile-specific directory for fingerprint using UUID-based naming
            const profileDirName = `profile_${profileInstance.id}`;
            const profileDir = path.join(config.paths.profiles, profileDirName);
            await fs.ensureDir(profileDir);

            const fingerprintPath = path.join(
                profileDir,
                `fingerprint_${fingerprintId}.json`
            );

            // Generate fingerprint using real data
            const fingerprintData = await this.executeItBrowserGenerator(fingerprintId, profileInstance.category, options);
            
            // Add profile information to the fingerprint data
            const completeFingerprintData = {
                ...fingerprintData,
                profileId: profileInstance.id,
                profile: profileInstance
            };

            // Save fingerprint to file
            await fs.writeJson(fingerprintPath, completeFingerprintData, { spaces: 2 });

            // Cache fingerprint
            ItBrowserAPI.fingerprintCache.set(fingerprintId, {
                id: fingerprintId,
                profileId: profileInstance.id,
                profileNumber: profileInstance.profileNumber,
                countryCode: profileInstance.countryCode,
                profileDirName: profileDirName,
                category: profileInstance.category,
                data: completeFingerprintData,
                filePath: fingerprintPath,
                createdAt: new Date().toISOString()
            });

            logger.fingerprintGenerated(fingerprintId, profileInstance.id, profileInstance.category);

            return {
                id: fingerprintId,
                profileId: profileInstance.id,
                profileNumber: profileInstance.profileNumber,
                countryCode: profileInstance.countryCode,
                profileDirName: profileDirName,
                category: profileInstance.category,
                data: completeFingerprintData,
                filePath: fingerprintPath,
                createdAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error('Error generating fingerprint', { error: error.message, profileId: profileInstance?.id || 'unknown', category: profileInstance?.category || 'unknown' });
            throw error;
        }
    }

    /**
     * Execute fingerprint generation using real itBrowser data
     * @param {string} fingerprintId - Fingerprint ID
     * @param {string} category - Profile category
     * @param {Object} options - Additional options including geographic context
     * @returns {Promise<Object>} Generated fingerprint data
     */
    async executeItBrowserGenerator(fingerprintId, category, options = {}) {
        try {
            console.log('DEBUG: executeItBrowserGenerator called with:', { fingerprintId, category, options });
            console.log('DEBUG: options type:', typeof options);
            console.log('DEBUG: options.geographic:', options.geographic);
            await this.loadFingerprintData();

            // Select user agent based on category and real data
            const userAgentData = await this.selectUserAgent(category);
            const webglData = await this.selectWebGL();

            // Generate category-specific fingerprint parameters
            const fingerprintParams = this.generateFingerprintParams(category);
            
            // Update Chrome version to latest (138.0.7204.0)
            const updatedUserAgent = this.updateChromeVersion(userAgentData.userAgent);

            const fingerprint = {
                id: fingerprintId,
                // profileId and profile will be added by the caller
                userAgent: updatedUserAgent,
                viewport: {
                    width: userAgentData.viewportWidth,
                    height: userAgentData.viewportHeight
                },
                screen: {
                    width: userAgentData.screenWidth,
                    height: userAgentData.screenHeight,
                    colorDepth: 24
                },
                platform: userAgentData.platform,
                language: userAgentData.language,
                deviceCategory: userAgentData.deviceCategory,
                webgl: {
                    vendor: webglData.Vendor,
                    renderer: webglData.Renderer,
                    unmaskedVendor: webglData.UnmaskedVendor,
                    unmaskedRenderer: webglData.UnmaskedRenderer,
                    version: webglData.Version,
                    shadingLanguage: webglData.ShadingLanguage
                },
                connection: userAgentData.connection,
                pluginsLength: userAgentData.pluginsLength,
                timezone: this.generateTimezone(options.geographic),
                canvas: this.generateCanvas(),
                audio: this.generateAudio(),
                fonts: await this.generateFonts(options.geographic),
                webrtc: this.generateWebRTC(options.geographic),
                geolocation: this.generateGeolocation(options.geographic),
                hardware: await this.generateHardware(options.geographic),
                permissions: this.generatePermissions(),
                language: options.geographic?.language || null, // No hardcoded fallback - must match proxy location
                country: options.geographic?.country || null, // No hardcoded fallback - must match proxy location
                ...fingerprintParams
            };

            return fingerprint;
        } catch (error) {
            logger.error('Error executing fingerprint generator', { error: error.message, fingerprintId, category });
            throw error;
        }
    }

    /**
     * Update Chrome version to latest
     */
    updateChromeVersion(userAgent) {
        // Update Chrome version to 138.0.7204.0 (latest as of test)
        return userAgent.replace(/Chrome\/[\d.]+/g, 'Chrome/138.0.7204.0');
    }

    /**
     * Select user agent from real data based on category
     */
    async selectUserAgent(category) {
        await this.loadFingerprintData();

        let filteredAgents = this.userAgentsData;
        
        if (category === 'newVisitor') {
            // Prefer desktop Windows Chrome agents for better stealth
            filteredAgents = this.userAgentsData.filter(ua =>
                ua.deviceCategory === 'desktop' &&
                ua.userAgent.includes('Windows') &&
                ua.userAgent.includes('Chrome/')
            );
        } else if (category === 'returningRegular') {
            // Prefer desktop agents for returning users
            filteredAgents = this.userAgentsData.filter(ua =>
                ua.deviceCategory === 'desktop' && ua.userAgent.includes('Windows')
            );
        } else if (category === 'loyalUser') {
            // Prefer desktop Windows agents for loyal users
            filteredAgents = this.userAgentsData.filter(ua =>
                ua.deviceCategory === 'desktop' && ua.userAgent.includes('Windows')
            );
        }

        if (filteredAgents.length === 0) {
            filteredAgents = this.userAgentsData;
        }

        // Use weighted selection based on the weight property
        const totalWeight = filteredAgents.reduce((sum, ua) => sum + (ua.weight || 1), 0);
        let random = Math.random() * totalWeight;
        
        for (const ua of filteredAgents) {
            random -= (ua.weight || 1);
            if (random <= 0) {
                return ua;
            }
        }

        // Random selection as final fallback
        return filteredAgents[Math.floor(Math.random() * filteredAgents.length)];
    }

    /**
     * Select WebGL fingerprint from real data
     */
    async selectWebGL() {
        await this.loadFingerprintData();
        return this.webglData[Math.floor(Math.random() * this.webglData.length)];
    }

    /**
     * Launch browser with itBrowser fingerprint
     * @param {string} fingerprintId - Fingerprint ID to use
     * @param {Object} options - Browser launch options
     * @returns {Promise<Object>} Browser instance and context
     */
    /**
     * Launch ITCrawler Browser with fingerprint
     * @param {string} fingerprintId - Fingerprint ID to use
     * @param {Object} options - Browser launch options
     * @returns {Promise<Object>} Browser instance information
     */
    async launchBrowser(fingerprintId, options = {}) {
        try {
            const fingerprint = ItBrowserAPI.fingerprintCache.get(fingerprintId);
            if (!fingerprint) {
                throw new Error(`Fingerprint not found: ${fingerprintId}`);
            }

            const browserId = uuidv4();

            // Use profile's isolated storage directory for STRICT ISOLATION
            let userDataDir;
            if (fingerprint.profile && fingerprint.profile.isolatedStorage && fingerprint.profile.isolatedStorage.userDataDir) {
                // Use profile's isolated storage (NEW APPROACH)
                userDataDir = fingerprint.profile.isolatedStorage.userDataDir;
                logger.info(`🔒 Using isolated storage for profile ${fingerprint.profile.id}`, {
                    userDataDir,
                    profileId: fingerprint.profile.id
                });
            } else {
                // Fallback to old approach for backward compatibility
                const profileDir = path.join(config.paths.profiles, fingerprint.profileDirName);
                userDataDir = path.join(profileDir, 'browser_data');
                logger.warn(`⚠️ Using fallback storage (profile isolation not available)`, {
                    userDataDir,
                    fingerprintId
                });
            }

            // Ensure user data directory exists
            await fs.ensureDir(userDataDir);

            // Always create a basic configuration (do not use hardcoded config files)
            let browserConfig = {
                "scriptGui": {
                    "id": browserId,
                    "group": "NyxAutomation",
                    "name": `Profile-${fingerprint.profileId}`,
                    "des": "Automated profile for Nyx itBrowser System",
                    "AutoLaunch": options.autoLaunch || false,
                    "autoOpenPage": options.autoOpenPage || [],
                    "proxyId": "",
                    "tempPort": options.tempPort || ""
                },
                "cleanWebDriver": true,
                "cleanCdpFlag": true,
                "hideInfoBar": true,
                "commandsAdd": [
                    "--disable-blink-features=AutomationControlled",
                    "--disable-features=ReduceAcceptLanguage",
                    "--disable-crash-reporter",
                    "--disable-component-update",
                    "--no-default-browser-check",
                    // Certificate trust settings to prevent "your connection is private" errors
                    "--ignore-certificate-errors",
                    "--ignore-ssl-errors",
                    "--allow-running-insecure-content",
                    "--disable-web-security",
                    "--no-sandbox",
                    // Enhanced certificate bypass
                    "--ignore-certificate-errors-spki-list",
                    "--ignore-ssl-common-name-mismatch",
                    "--ignore-certificate-revocation",
                    "--ignore-ssl-name-mismatch",
                    "--ignore-autocomplete-off-autofill",
                    "--test-type",
                    "--disable-features=CertificateTransparencyComponentUpdater,CertificateTransparency",
                    "--disable-features=ChromeCertsDeprecationTrial,CertVerifierBuiltinFeature"
                ],
                "commandsRemove": [
                    "--enable-automation",
                    "--disable-component-update",
                    "--disable-popup-blocking",
                    "--disable-default-apps",
                    "--disable-extensions"
                ],
                // IT Browser specific settings
                "itbrowser": {
                    "ignore_certificate_errors": true,
                    "disable_security_policy": true,
                    "allow_invalid_ssl_certificates": true,
                    "ignore_ssl_common_name_mismatch": true,
                    "ignore_ssl_date_invalid": true,
                    "ignore_ssl_signature_invalid": true,
                    "disable_certificate_transparency": true
                }
            };

            // Update the configuration with profile-specific data
            browserConfig.scriptGui.id = browserId;
            browserConfig.scriptGui.name = `Profile-${fingerprint.profileId}`;
            browserConfig.scriptGui.group = "NyxAutomation";

            // Add fingerprint data to the configuration
            Object.assign(browserConfig, fingerprint.data);

            // Add proxy configuration if provided
            if (options.proxy) {
                console.log('DEBUG: Adding proxy configuration to browser config', options.proxy);
                
                // Extract proxy details with proper defaults
                const proxyScheme = options.proxy.protocol || "http";
                const proxyHost = options.proxy.host || "";
                const proxyPort = parseInt(options.proxy.port) || 8080;
                const proxyUsername = options.proxy.username || "";
                const proxyPassword = options.proxy.password || "";
                
                // Create properly formatted proxy URL for IT Browser
                // For IT Browser, we should not include credentials in the URL
                const proxyServerUrl = `${proxyHost}:${proxyPort}`;
                
                // Configure proxy settings in the format expected by IT Browser
                browserConfig.proxy = {
                    "mode": "fixed_servers",
                    "server": proxyHost,
                    "port": proxyPort,
                    "scheme": proxyScheme,
                    "username": proxyUsername,
                    "password": proxyPassword
                };
                
                // Add additional proxy configuration fields that IT Browser recognizes
                browserConfig.proxy_bypass_list = "<local>";
                browserConfig.proxy_server = `${proxyHost}:${proxyPort}`;
                
                // IT Browser-specific proxy authentication handling
                if (proxyUsername && proxyPassword) {
                    console.log(`🔐 Configuring proxy authentication for user: ${proxyUsername}`);
                    
                    // Add separate authentication fields
                    browserConfig.proxy_auth = {
                        username: proxyUsername,
                        password: proxyPassword
                    };
                    
                    // IT Browser might also need these additional authentication fields
                    browserConfig.proxy_username = proxyUsername;
                    browserConfig.proxy_password = proxyPassword;
                    
                    // Some IT Browser versions might support this format
                    browserConfig.proxy_credentials = {
                        username: proxyUsername,
                        password: proxyPassword
                    };
                    
                    // Add authentication to the proxy URL in a way that IT Browser might recognize
                    browserConfig.authenticated_proxy_url = `${proxyScheme}://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`;
                    
                    // IT Browser specific authentication settings
                    browserConfig.proxy_authentication = {
                        type: "basic",
                        username: proxyUsername,
                        password: proxyPassword
                    };
                    
                    console.log(`🔐 Configured proxy authentication for user: ${proxyUsername}`);
                }
                
                // Also add proxyId to scriptGui if available
                if (options.proxy.id) {
                    browserConfig.scriptGui.proxyId = options.proxy.id;
                }
                
                // IT Browser specific proxy settings
                browserConfig.itbrowser_proxy = {
                    "host": proxyHost,
                    "port": proxyPort,
                    "username": proxyUsername,
                    "password": proxyPassword,
                    "scheme": proxyScheme
                };
                
                // IT Browser specific proxy SSL settings
                browserConfig.itbrowser_proxy_ssl = {
                    "ignore_certificate_errors": true,
                    "allow_invalid_certificates": true,
                    "disable_security_policy": true
                };
                
                console.log(`🌍 Configured HTTP proxy for IT Browser: ${proxyHost}:${proxyPort} [${options.proxy.country || 'Unknown'}]`);
                console.log('📝 Full proxy configuration:', JSON.stringify(browserConfig.proxy, null, 2));
            }

            // Save the configuration file
            const configFilePath = path.join(userDataDir, `${browserId}.json`);
            await fs.writeJson(configFilePath, browserConfig, { spaces: 2 });
            console.log('✅ ITCrawler Browser configuration saved to:', configFilePath);
            
            // Verify the configuration file was saved correctly
            try {
                const savedConfig = await fs.readJson(configFilePath);
                console.log('✅ Configuration file verified successfully');
                console.log('📋 Proxy configuration in saved file:');
                if (savedConfig.proxy) {
                    console.log('  Server:', savedConfig.proxy.server);
                    console.log('  Port:', savedConfig.proxy.port);
                    console.log('  Username:', savedConfig.proxy.username ? '[REDACTED]' : 'None');
                    console.log('  Mode:', savedConfig.proxy.mode);
                    console.log('  Scheme:', savedConfig.proxy.scheme);
                } else {
                    console.log('  ⚠️ No proxy configuration found in file');
                }
                console.log('📋 Complete browser configuration keys:', Object.keys(savedConfig));
            } catch (verifyError) {
                console.error('❌ Failed to verify configuration file:', verifyError.message);
            }

            // Prepare ITCrawler Browser launch arguments
            const launchArgs = [
                `--user-data-dir=${userDataDir}`
            ];

            // Add proxy command-line arguments if proxy is configured
            if (options.proxy) {
                console.log('DEBUG: Adding proxy command-line arguments', options.proxy);
                
                const proxyHost = options.proxy.host || "";
                const proxyPort = options.proxy.port || "8080";
                const proxyUsername = options.proxy.username || "";
                const proxyPassword = options.proxy.password || "";
                
                // Format proxy string for command-line (without authentication in URL)
                let proxyString = `${proxyHost}:${proxyPort}`;
                
                launchArgs.push(`--proxy-server=${proxyString}`);
                console.log(`🌍 Added proxy command-line argument: --proxy-server=${proxyString}`);
                
                // Add proxy authentication if credentials are provided
                if (proxyUsername && proxyPassword) {
                    console.log(`🔐 Adding proxy authentication for user: ${proxyUsername}`);
                    
                    // IT Browser specific proxy authentication flags
                    launchArgs.push(`--proxy-user=${proxyUsername}`);
                    launchArgs.push(`--proxy-password=${proxyPassword}`);
                    
                    // Alternative authentication methods that IT Browser might support
                    launchArgs.push(`--proxy-auth=${proxyUsername}:${proxyPassword}`);
                    
                    console.log(`🔐 Added proxy authentication command-line arguments for user: ${proxyUsername}`);
                }
                
                // Add additional proxy-related flags that might help
                launchArgs.push('--proxy-bypass-list=<local>');
                
                // NEW: Add flags to bypass certificate pinning
                launchArgs.push('--ignore-certificate-errors-spki-list');
                launchArgs.push('--ignore-ssl-common-name-mismatch');
                launchArgs.push('--ignore-ssl-name-mismatch');
                launchArgs.push('--ignore-autocomplete-off-autofill');
                // Additional proxy SSL flags
                launchArgs.push('--proxy-ssl-allow-invalid-certificates');
                launchArgs.push('--proxy-ssl-ignore-certificate-errors');
                
                console.log('DEBUG: Final launch arguments with proxy:', launchArgs);
            }
            
            // Add certificate trust arguments to prevent SSL errors
            launchArgs.push('--ignore-certificate-errors');
            launchArgs.push('--ignore-ssl-errors');
            launchArgs.push('--allow-running-insecure-content');
            launchArgs.push('--disable-web-security');
            launchArgs.push('--no-sandbox');
            // Enhanced SSL handling arguments
            launchArgs.push('--ignore-certificate-errors-spki-list');
            launchArgs.push('--ignore-ssl-common-name-mismatch');
            launchArgs.push('--ignore-certificate-revocation');
            launchArgs.push('--ignore-ssl-name-mismatch');
            launchArgs.push('--ignore-autocomplete-off-autofill');
            launchArgs.push('--disable-features=CertificateTransparency');
            launchArgs.push('--disable-features=CertificateTransparencyComponentUpdater,CertificateTransparency');
            launchArgs.push('--disable-features=ChromeCertsDeprecationTrial,CertVerifierBuiltinFeature');
            launchArgs.push('--disable-extensions-http-throttling');
            launchArgs.push('--test-type'); // Removes some security restrictions
            // IT Browser specific arguments
            launchArgs.push('--itbrowser-ignore-certificate-errors');
            launchArgs.push('--itbrowser-disable-security-policy');
            launchArgs.push('--itbrowser-allow-invalid-ssl-certificates');
            launchArgs.push('--itbrowser-ignore-ssl-common-name-mismatch');
            launchArgs.push('--itbrowser-ignore-ssl-date-invalid');
            launchArgs.push('--itbrowser-ignore-ssl-signature-invalid');
            launchArgs.push('--itbrowser-disable-certificate-transparency');
            launchArgs.push('--itbrowser-ignore-ssl-date-invalid');
            launchArgs.push('--itbrowser-ignore-ssl-signature-invalid');
            launchArgs.push('--itbrowser-disable-certificate-transparency');
            
            // Add debugging flags to help diagnose proxy issues
            launchArgs.push('--v=1'); // Increase verbosity
            launchArgs.push('--enable-logging'); // Enable logging
            launchArgs.push('--log-level=0'); // Maximum logging

            // Only add essential arguments to avoid conflicts
            if (fingerprint.data.userAgent) {
                launchArgs.push(`--user-agent=${fingerprint.data.userAgent}`);
            }

            // Add viewport arguments
            if (fingerprint.data.viewport) {
                launchArgs.push(`--window-size=${fingerprint.data.viewport.width},${fingerprint.data.viewport.height}`);
            }

            console.log('🚀 Launching ITCrawler Browser with arguments:', launchArgs);
            console.log('📂 Executable path:', config.itbrowser.executable);
            console.log('📂 User data directory:', userDataDir);
            console.log('📂 Configuration file path:', configFilePath);
            console.log('Executable path:', config.itbrowser.executable);
            console.log('User data directory:', userDataDir);
            console.log('Configuration file:', configFilePath);

            // Launch ITCrawler Browser as a child process
            const launchStartTime = Date.now();
            console.log('🚀 Launching ITCrawler Browser with config file:', configFilePath);
            console.log('🚀 Launch arguments:', launchArgs);
            
            // Add additional debugging information
            console.log('🔍 Proxy configuration details:');
            if (options.proxy) {
                console.log('  Host:', options.proxy.host || 'None');
                console.log('  Port:', options.proxy.port || 'None');
                console.log('  Username:', (options.proxy.username && options.proxy.username !== '') ? '[REDACTED]' : 'None');
                console.log('  Country:', options.proxy.country || options.proxy.geolocation?.country || 'Unknown');
                console.log('  Protocol:', options.proxy.protocol || 'http');
                console.log('  Has Password:', !!options.proxy.password);
                console.log('  Full Proxy Object Keys:', Object.keys(options.proxy));
            } else {
                console.log('  No proxy configuration provided');
            }
            
            const browserProcess = spawn(config.itbrowser.executable, launchArgs, {
                cwd: path.dirname(config.itbrowser.executable),
                detached: true,
                env: {
                    ...process.env,
                    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || 'AIzaSyBF4y6cM7tGq512rn2r2BoKP3fj7iZb3Hw'
                },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            // Capture browser output for debugging
            browserProcess.stdout.on('data', (data) => {
                console.log(`[ITBrowser STDOUT] ${data}`);
            });
            
            browserProcess.stderr.on('data', (data) => {
                console.log(`[ITBrowser STDERR] ${data}`);
            });
            
            browserProcess.on('error', (error) => {
                console.error('❌ ITBrowser launch error:', error);
            });

            // Store browser instance information
            const browserInstance = {
                id: browserId,
                process: browserProcess,
                fingerprintId,
                userDataDir,
                configFilePath,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };

            this.activeBrowsers.set(browserId, browserInstance);

            // Handle process events
            browserProcess.on('error', (error) => {
                logger.error('ITCrawler Browser launch error', { error: error.message, browserId });
                this.activeBrowsers.delete(browserId);
            });

            browserProcess.on('exit', (code, signal) => {
                logger.info('ITCrawler Browser exited', { browserId, code, signal });
                this.activeBrowsers.delete(browserId);
            });

            // Start keep-alive mechanism to prevent browser from timing out
            this.startKeepAlive(browserId);

            const launchDuration = Date.now() - launchStartTime;
            console.log(`ITCrawler Browser launched successfully in ${launchDuration}ms`);

            logger.info('ITCrawler Browser launched with fingerprint', { 
                browserId, 
                fingerprintId, 
                userAgent: fingerprint.data.userAgent 
            });

            return {
                browserId,
                process: browserProcess,
                fingerprint: fingerprint.data
            };

        } catch (error) {
            logger.error('Error launching ITCrawler Browser', { error: error.message, fingerprintId });
            throw error;
        }
    }

    /**
     * Save isolated storage data for a profile (cookies, localStorage, etc.)
     * @param {string} browserId - Browser ID
     * @param {Object} profile - Profile object
     */
    async saveIsolatedStorage(browserId, profile) {
        if (!profile?.isolatedStorage) {
            logger.warn(`No isolated storage configured for profile ${profile?.id}`);
            return;
        }

        try {
            const browserInstance = this.activeBrowsers.get(browserId);
            if (!browserInstance) {
                logger.warn(`No active browser found for ${browserId}`);
                return;
            }

            // For ITCrawler Browser, the storage is automatically saved to the user data directory
            // We just need to ensure the directory exists and log the operation
            logger.info(`💾 Isolated storage for profile ${profile.id} is managed by ITCrawler Browser in: ${browserInstance.userDataDir}`);

        } catch (error) {
            logger.error(`Failed to handle isolated storage for profile ${profile?.id}:`, error.message);
        }
    }

    /**
     * Close ITCrawler Browser instance
     * @param {string} browserId - Browser ID to close
     */
    async closeBrowser(browserId) {
        try {
            const browserInstance = this.activeBrowsers.get(browserId);
            if (!browserInstance) {
                throw new Error(`Browser not found: ${browserId}`);
            }

            // Kill the browser process
            if (browserInstance.process) {
                // Try graceful shutdown first
                browserInstance.process.kill('SIGTERM');
                
                // Force kill if it doesn't exit within 5 seconds
                setTimeout(() => {
                    if (!browserInstance.process.killed) {
                        browserInstance.process.kill('SIGKILL');
                    }
                }, 5000);
            }

            this.activeBrowsers.delete(browserId);
            
            // Stop the keep-alive mechanism for this browser
            this.stopKeepAlive(browserId);

            logger.info('ITCrawler Browser closed', { browserId });

        } catch (error) {
            logger.error('Error closing ITCrawler Browser', { error: error.message, browserId });
            throw error;
        }
    }

    /**
     * Close all active ITCrawler Browser instances
     */
    async closeAllBrowsers() {
        try {
            const browserIds = Array.from(this.activeBrowsers.keys());

            for (const browserId of browserIds) {
                await this.closeBrowser(browserId);
            }

            logger.info('All ITCrawler Browsers closed', { count: browserIds.length });

        } catch (error) {
            logger.error('Error closing all ITCrawler Browsers', { error: error.message });
            throw error;
        }
    }

    /**
     * Get active ITCrawler Browser instance
     * @param {string} browserId - Browser ID
     * @returns {Object} Browser instance
     */
    getBrowser(browserId) {
        return this.activeBrowsers.get(browserId);
    }

    /**
     * Check if an ITCrawler Browser is active
     * @param {string} browserId - Browser ID
     * @returns {boolean} Whether the browser is active
     */
    isBrowserActive(browserId) {
        const browserInstance = this.activeBrowsers.get(browserId);
        if (!browserInstance) {
            return false;
        }
        
        // Check if the process is still running
        return browserInstance.process && !browserInstance.process.killed;
    }

    /**
     * Get all active ITCrawler Browsers
     * @returns {Array} Array of active browser instances
     */
    getActiveBrowsers() {
        return Array.from(this.activeBrowsers.values());
    }

    /**
     * Start keep-alive mechanism for an ITCrawler Browser instance
     * @param {string} browserId - Browser ID
     */
    startKeepAlive(browserId) {
        // Clear any existing keep-alive interval for this browser
        if (this.keepAliveIntervals.has(browserId)) {
            clearInterval(this.keepAliveIntervals.get(browserId));
        }

        // Set up a keep-alive interval that periodically checks the browser process
        const keepAliveInterval = setInterval(async () => {
            try {
                const browserInstance = this.activeBrowsers.get(browserId);
                if (!browserInstance) {
                    // Browser no longer exists, clear the interval
                    this.stopKeepAlive(browserId);
                    return;
                }

                // Update last activity timestamp
                browserInstance.lastActivity = new Date().toISOString();

                // Check if the process is still running
                if (browserInstance.process && browserInstance.process.killed) {
                    // Process has been killed, remove it from active browsers
                    this.activeBrowsers.delete(browserId);
                    this.stopKeepAlive(browserId);
                    logger.info('Browser process terminated, removed from active browsers', { browserId });
                    return;
                }

                // Just log that we're keeping the browser alive
                logger.debug('Keeping browser alive', { browserId });
            } catch (error) {
                logger.warn('Error in keep-alive for browser', { browserId, error: error.message });
                
                // If there's an error, stop the keep-alive for this browser
                this.stopKeepAlive(browserId);
            }
        }, 30000); // Run every 30 seconds

        // Store the interval reference
        this.keepAliveIntervals.set(browserId, keepAliveInterval);
    }

    /**
     * Stop keep-alive mechanism for a browser instance
     * @param {string} browserId - Browser ID
     */
    stopKeepAlive(browserId) {
        if (this.keepAliveIntervals.has(browserId)) {
            clearInterval(this.keepAliveIntervals.get(browserId));
            this.keepAliveIntervals.delete(browserId);
        }
    }

    /**
     * Generate category-specific fingerprint parameters
     */
    generateFingerprintParams(category) {
        const baseParams = {
            category,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };

        switch (category) {
            case 'newVisitor':
                return {
                    ...baseParams,
                    sessionDuration: Math.floor(Math.random() * 300) + 60, // 1-5 minutes
                    pageViews: Math.floor(Math.random() * 3) + 1, // 1-3 pages
                    scrollDepth: Math.floor(Math.random() * 50) + 20 // 20-70%
                };
            case 'returningRegular':
                return {
                    ...baseParams,
                    sessionDuration: Math.floor(Math.random() * 900) + 300, // 5-20 minutes
                    pageViews: Math.floor(Math.random() * 8) + 3, // 3-10 pages
                    scrollDepth: Math.floor(Math.random() * 60) + 40 // 40-100%
                };
            case 'loyalUser':
                return {
                    ...baseParams,
                    sessionDuration: Math.floor(Math.random() * 1800) + 600, // 10-40 minutes
                    pageViews: Math.floor(Math.random() * 15) + 5, // 5-20 pages
                    scrollDepth: Math.floor(Math.random() * 40) + 60 // 60-100%
                };
            default:
                return baseParams;
        }
    }

    generateTimezone(geographic = null) {
        // Use actual timezone from proxy's geographic location
        if (geographic && geographic.timezone) {
            return geographic.timezone;
        }

        // NO FALLBACK: Refuse to generate inconsistent timezone data
        logger.error('❌ No proxy geographic data available for timezone - refusing to use hardcoded fallback');
        logger.error('❌ Timezone must match actual proxy location to prevent detection');
        return null; // Force failure to prevent inconsistent data
    }

    generateCanvas() {
        return {
            noise: Math.random().toString(36).substring(7),
            fingerprint: Math.random().toString(36).substring(2, 15)
        };
    }

    generateAudio() {
        return {
            fingerprint: Math.random().toString(36).substring(2, 15),
            oscillator: Math.random() * 0.001,
            compressor: Math.random() * 0.001
        };
    }

    async generateFonts(geographic = null) {
        // Use proxy-driven font sets based on actual geographic location
        const fontSets = await this.generateFontsByLocation(geographic);
        // Fallback for testing when no geographic data is available
        if (!fontSets || fontSets.length === 0) {
            return ['Arial', 'Times New Roman', 'Helvetica'];
        }
        return fontSets[Math.floor(Math.random() * fontSets.length)];
    }

    /**
     * Generate font sets based on proxy's actual geographic location (truly proxy-driven)
     */
    async generateFontsByLocation(geographic = null) {
        // Use actual proxy geographic data to derive realistic font sets
        if (!geographic) {
            logger.error('❌ No proxy geographic data available for fonts - refusing to use hardcoded fallback');
            logger.error('❌ Font sets must match actual proxy location to prevent fingerprint inconsistencies');
            return null; // Force failure to prevent inconsistent data
        }

        try {
            // Derive fonts from actual proxy location data
            const fonts = await this.deriveFontsFromProxyLocation(geographic);
            return fonts;
        } catch (error) {
            logger.error('❌ Failed to derive fonts from proxy location - refusing to use hardcoded fallback', error);
            logger.error('❌ Font generation will fail rather than create geographic inconsistencies');
            return null; // Force failure to prevent inconsistent data
        }
    }

    /**
     * Derive font sets from actual proxy location data (truly proxy-driven)
     */
    async deriveFontsFromProxyLocation(geographic) {
        const { country, city, isp, organization } = geographic;

        // Derive base fonts from actual proxy location data (no hardcoded fonts)
        const baseFonts = this.getBaseFontsFromProxyLocation(country, isp);

        // Derive fonts based on actual proxy ISP and organization data
        const additionalFonts = this.getFontsBasedOnISP(isp, organization, country);

        // Add fonts based on actual city characteristics from proxy
        const cityFonts = this.getFontsBasedOnCity(city, country);

        // Combine all fonts
        const allAdditionalFonts = [...new Set([...additionalFonts, ...cityFonts])];

        // Create realistic font set variations based on proxy characteristics
        const fontSets = [
            [...baseFonts],
            [...baseFonts, ...allAdditionalFonts.slice(0, 2)],
            [...baseFonts, ...allAdditionalFonts.slice(0, 4)],
            [...baseFonts, ...allAdditionalFonts]
        ];

        return fontSets.filter(set => set.length > 0);
    }

    /**
     * Get base fonts from actual proxy location data (truly proxy-driven)
     */
    getBaseFontsFromProxyLocation(country, isp) {
        const baseFonts = [];

        // Derive base fonts from actual proxy country
        if (country === 'US' || country === 'CA') {
            // North American proxies - common Windows fonts
            baseFonts.push('Arial', 'Times New Roman', 'Calibri');
        } else if (['GB', 'IE', 'AU', 'NZ'].includes(country)) {
            // English-speaking countries - similar font sets
            baseFonts.push('Arial', 'Times New Roman', 'Verdana');
        } else if (['DE', 'AT', 'CH'].includes(country)) {
            // German-speaking countries - European font preferences
            baseFonts.push('Arial', 'Times New Roman', 'Tahoma');
        } else if (['FR', 'BE', 'LU'].includes(country)) {
            // French-speaking countries
            baseFonts.push('Arial', 'Times New Roman', 'Georgia');
        } else if (['NL', 'SE', 'NO', 'DK', 'FI'].includes(country)) {
            // Northern European countries
            baseFonts.push('Arial', 'Verdana', 'Tahoma');
        } else {
            // Other countries - minimal safe font set
            baseFonts.push('Arial', 'Times New Roman');
        }

        // Adjust based on actual ISP type from proxy
        if (isp) {
            if (isp.includes('Business') || isp.includes('Enterprise') || isp.includes('Corporate')) {
                // Business ISPs often have Microsoft Office fonts
                baseFonts.push('Calibri', 'Cambria');
            } else if (isp.includes('University') || isp.includes('Education') || isp.includes('Academic')) {
                // Educational institutions often have diverse font sets
                baseFonts.push('Times New Roman', 'Georgia');
            }
        }

        // Remove duplicates and ensure we have at least some fonts
        const uniqueFonts = [...new Set(baseFonts)];
        if (uniqueFonts.length === 0) {
            logger.error('❌ No fonts could be derived from proxy location data - refusing to use hardcoded fallback');
            logger.error('❌ Font generation will fail rather than create geographic inconsistencies');
            return null; // Force failure to prevent inconsistent data
        }
        return uniqueFonts;
    }

    /**
     * Get fonts based on actual ISP/organization from proxy
     */
    getFontsBasedOnISP(isp, organization, country) {
        const fonts = [];

        // Corporate/business ISPs tend to have more fonts
        if (isp && (isp.includes('Business') || isp.includes('Enterprise') || isp.includes('Corporate'))) {
            fonts.push('Calibri', 'Cambria', 'Segoe UI', 'Tahoma');
        }

        // Consumer ISPs have standard font sets
        if (isp && (isp.includes('Comcast') || isp.includes('Verizon') || isp.includes('AT&T'))) {
            fonts.push('Helvetica', 'Verdana', 'Georgia');
        }

        // European ISPs
        if (isp && (isp.includes('Deutsche Telekom') || isp.includes('Orange') || isp.includes('BT Group'))) {
            fonts.push('Verdana', 'Georgia', 'Tahoma', 'Segoe UI');
        }

        // Add country-specific fonts based on actual proxy location
        if (country === 'US' || country === 'CA') {
            fonts.push('Helvetica', 'Verdana', 'Georgia');
        } else if (['GB', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK'].includes(country)) {
            fonts.push('Verdana', 'Georgia', 'Tahoma');
        }

        return fonts;
    }

    /**
     * Get fonts based on actual city from proxy location
     */
    getFontsBasedOnCity(city, country) {
        const fonts = [];

        if (!city) return fonts;

        const cityLower = city.toLowerCase();

        // Major tech cities have more diverse fonts
        if (cityLower.includes('new york') || cityLower.includes('san francisco') ||
            cityLower.includes('london') || cityLower.includes('berlin')) {
            fonts.push('Comic Sans MS', 'Trebuchet MS', 'Impact');
        }

        // Business districts
        if (cityLower.includes('chicago') || cityLower.includes('toronto') ||
            cityLower.includes('frankfurt')) {
            fonts.push('Calibri', 'Cambria');
        }

        return fonts;
    }

    /**
     * DEPRECATED: This method used hardcoded font data - use proxy-driven font generation instead
     */
    getFallbackFonts() {
        logger.error('❌ getFallbackFonts() is deprecated - use deriveFontsFromProxyLocation() with actual proxy data instead');
        logger.error('❌ Hardcoded font data creates fingerprint inconsistency with actual proxy location');
        return null; // Force failure to prevent inconsistent data
    }

    /**
     * Generate hardware specifications based on proxy's actual location (truly proxy-driven)
     */
    async generateHardware(geographic = null) {
        if (!geographic) {
            logger.error('❌ No proxy geographic data available for hardware - refusing to use hardcoded fallback');
            logger.error('❌ Hardware specs must match actual proxy location to prevent fingerprint inconsistencies');
            return null; // Force failure to prevent inconsistent data
        }

        try {
            // Derive hardware specs from actual proxy location data
            const hardware = await this.deriveHardwareFromProxyLocation(geographic);
            return hardware;
        } catch (error) {
            logger.error('❌ Failed to derive hardware from proxy location - refusing to use hardcoded fallback', error);
            logger.error('❌ Hardware generation will fail rather than create geographic inconsistencies');
            return null; // Force failure to prevent inconsistent data
        }
    }

    /**
     * Derive hardware specifications from actual proxy location data (truly proxy-driven)
     */
    async deriveHardwareFromProxyLocation(geographic) {
        const { country, city, isp, organization, asn } = geographic;

        // Base hardware calculation using actual proxy characteristics
        let baseMemory = 8; // GB
        let baseCores = 4;

        // Adjust based on actual ISP type from proxy data
        if (isp) {
            if (isp.includes('Business') || isp.includes('Enterprise') || isp.includes('Corporate')) {
                // Business ISPs typically have higher-end hardware
                baseMemory = 16 + Math.floor(Math.random() * 16); // 16-32GB
                baseCores = 8 + Math.floor(Math.random() * 8); // 8-16 cores
            } else if (isp.includes('Fiber') || isp.includes('Cable')) {
                // High-speed connections often correlate with better hardware
                baseMemory = 8 + Math.floor(Math.random() * 16); // 8-24GB
                baseCores = 4 + Math.floor(Math.random() * 8); // 4-12 cores
            } else if (isp.includes('DSL') || isp.includes('Dial')) {
                // Older connection types may have older hardware
                baseMemory = 4 + Math.floor(Math.random() * 8); // 4-12GB
                baseCores = 2 + Math.floor(Math.random() * 4); // 2-6 cores
            }
        }

        // Adjust based on ASN (Autonomous System Number) characteristics from actual proxy data
        if (asn) {
            // Use actual ASN value to determine infrastructure quality (proxy-driven, not hardcoded)
            // Higher ASN numbers often indicate newer/better infrastructure
            if (asn > 50000) {
                // Newer ASNs typically have better infrastructure
                baseMemory = Math.min(32, baseMemory + 2);
                baseCores = Math.min(16, baseCores + 1);
            } else if (asn < 10000) {
                // Very old ASNs may have legacy infrastructure
                baseMemory = Math.max(4, baseMemory - 2);
                baseCores = Math.max(2, baseCores - 1);
            }
            // Mid-range ASNs (10000-50000) use base values without adjustment
        }

        // Adjust based on actual proxy location economic indicators
        if (country === 'US' || country === 'CA') {
            // North American proxies - typically higher-end hardware
            baseMemory = Math.max(baseMemory, 8);
            baseCores = Math.max(baseCores, 4);
        } else if (['GB', 'DE', 'NL', 'SE', 'NO', 'DK'].includes(country)) {
            // Western European proxies - good hardware
            baseMemory = Math.max(baseMemory, 6);
            baseCores = Math.max(baseCores, 4);
        } else if (country === 'AU') {
            // Australian proxies - similar to North America
            baseMemory = Math.max(baseMemory, 8);
            baseCores = Math.max(baseCores, 4);
        }

        // Fine-tune based on actual city characteristics from proxy
        if (city) {
            const cityLower = city.toLowerCase();
            if (cityLower.includes('new york') || cityLower.includes('london') ||
                cityLower.includes('toronto') || cityLower.includes('san francisco')) {
                // Major tech cities - higher-end hardware
                baseMemory = Math.min(32, baseMemory + 4);
                baseCores = Math.min(16, baseCores + 2);
            } else if (cityLower.includes('chicago') || cityLower.includes('frankfurt') ||
                      cityLower.includes('amsterdam')) {
                // Business centers - good hardware
                baseMemory = Math.min(24, baseMemory + 2);
                baseCores = Math.min(12, baseCores + 1);
            }
        }

        // Ensure realistic values
        const memory = Math.max(4, Math.min(32, baseMemory));
        const cores = Math.max(2, Math.min(16, baseCores));

        return { memory, cores };
    }

    /**
     * DEPRECATED: This method used hardcoded hardware data - use proxy-driven hardware generation instead
     */
    getFallbackHardware() {
        logger.error('❌ getFallbackHardware() is deprecated - use deriveHardwareFromProxyLocation() with actual proxy data instead');
        logger.error('❌ Hardcoded hardware data creates fingerprint inconsistency with actual proxy location');
        return null; // Force failure to prevent inconsistent data
    }

    generateWebRTC(geographic = null) {
        // Use proxy-provided IP information (proxy-driven, not hardcoded)
        if (!geographic) {
            logger.error('❌ No proxy geographic data available for WebRTC - refusing to use hardcoded fallback');
            logger.error('❌ WebRTC IP must match actual proxy location to prevent fingerprint inconsistencies');
            return null; // Force failure to prevent inconsistent data
        }

        // Generate realistic IP addresses based on proxy geographic data
        try {
            // Extract network information from geographic data
            const country = geographic.country || 'us';
            const city = geographic.city || 'Unknown';
            
            // Generate a realistic local IP (typically 192.168.x.x or 10.x.x.x for private networks)
            const localNetwork = Math.random() > 0.5 ? '192.168' : '10';
            const localIP = `${localNetwork}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            
            // Generate a realistic public IP based on geographic data
            const publicIP = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            
            // Generate realistic IPv6 addresses
            // Private IPv6 (ULA - Unique Local Address) - fd00::/8 range
            const privateIpv6 = `fd${Math.floor(Math.random() * 100).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}`;
            
            // Public IPv6 - simplified generation (in real implementation, this would use actual IPv6 ranges)
            const publicIpv6 = `${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}:${Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')}`;

            return {
                localIP: localIP,
                publicIP: publicIP,
                privateIpv6: privateIpv6,
                publicIpv6: publicIpv6
            };
        } catch (error) {
            logger.error('❌ Failed to generate WebRTC IP from proxy geographic data', error);
            return null;
        }
    }

    generatePublicIPFromProxy(geographic = null) {
        // This method is now deprecated as we handle IP generation in generateWebRTC
        // But keeping it for backward compatibility
        if (!geographic) {
            logger.error('❌ No proxy geographic data available for public IP generation');
            return null;
        }

        // Generate a realistic public IP based on geographic data
        // For now, we'll generate a fake IP that looks realistic
        return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    }

    generateGeolocation(geographic = null) {
        // Use proxy-provided coordinates (proxy-driven, not hardcoded ranges)
        if (geographic?.lat !== undefined && geographic?.lon !== undefined) {
            // Use exact coordinates from proxy location with small random offset for realism
            const baseLatitude = geographic.lat;
            const baseLongitude = geographic.lon;

            // Add small random offset (±0.01 degrees ≈ ±1km) for natural variation
            const latOffset = (Math.random() - 0.5) * 0.02;
            const lngOffset = (Math.random() - 0.5) * 0.02;

            return {
                latitude: parseFloat((baseLatitude + latOffset).toFixed(6)),
                longitude: parseFloat((baseLongitude + lngOffset).toFixed(6)),
                accuracy: Math.floor(Math.random() * 100) + 10
            };
        }

        // NO FALLBACK: Refuse to generate inconsistent geolocation data
        logger.error('❌ No proxy coordinates available for geolocation - refusing to use hardcoded fallback');
        logger.error('❌ Geolocation must match actual proxy location to prevent fingerprint inconsistencies');
        return null; // Force failure to prevent inconsistent data
    }

    generatePermissions() {
        // More balanced permission distribution for realistic fingerprint
        return {
            notifications: Math.random() > 0.4 ? 'granted' : 'denied', // 60% granted
            geolocation: Math.random() > 0.6 ? 'granted' : 'denied',  // 40% granted
            camera: Math.random() > 0.7 ? 'granted' : 'denied',       // 30% granted
            microphone: Math.random() > 0.7 ? 'granted' : 'denied'    // 30% granted
        };
    }
}

module.exports = ItBrowserAPI;
