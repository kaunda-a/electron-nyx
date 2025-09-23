const profilePoolManager = require('../services/profilePoolManager');
const sessionStateManager = require('../services/sessionStateManager');
const itBrowserAPI = require('../services/itBrowserAPI');
const campaignManager = require('../services/campaignManager');
const config = require('../utils/config');
const logger = require('../utils/logger');
const Profile = require('../models/Profile');
const { v4: uuidv4 } = require('uuid');

class SystemController {
    constructor() {
        this.proxyManager = profilePoolManager.proxyManager;
        this.systemStatus = {
            status: 'stopped',
            startTime: null,
            uptime: 0,
            version: require('../../package.json').version
        };
        this.isRunning = false;
    }

    /**
     * Initialize services
     */
    async initialize() {
        try {
            // profilePoolManager is a singleton and gets initialized automatically
            // proxyManager is initialized as part of profilePoolManager
        } catch (error) {
            logger.error('Failed to initialize services', { error: error.message });
            throw error;
        }
    }

    /**
     * Get system status and health
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getSystemStatus(req, res) {
        try {
            const healthChecks = {
                proxyManager: {
                    name: 'Proxy Manager',
                    healthy: this.proxyManager.isInitialized,
                    critical: true,
                    message: this.proxyManager.isInitialized ? 
                        'Proxy manager initialized' : 'Proxy manager not initialized'
                }
            };
            
            const status = {
                system: {
                    ...this.systemStatus,
                    isRunning: this.isRunning,
                },
                health: healthChecks,
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                status
            });

        } catch (error) {
            logger.error('Failed to get system status', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get all proxies
     */
    async getAllProxies(req, res) {
        try {
            const proxies = this.proxyManager.getAllProxies();
            // Return the proxies array directly as JSON
            res.json(proxies);
        } catch (error) {
            logger.error('Error getting all proxies', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get proxies',
                message: error.message
            });
        }
    }

    /**
     * Create a new proxy
     */
    async createProxy(req, res) {
        try {
            const proxyData = req.body;
            
            if (!proxyData.host || !proxyData.port) {
                return res.status(400).json({
                    success: false,
                    error: 'Host and port are required'
                });
            }
            
            // Validate port is a number
            const port = parseInt(proxyData.port);
            if (isNaN(port) || port < 1 || port > 65535) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid port number. Must be between 1 and 65535.'
                });
            }
            
            // Set default protocol if not provided
            proxyData.protocol = proxyData.protocol || 'http';

            const proxy = await this.proxyManager.createProxy(proxyData);

            res.status(201).json({
                success: true,
                message: 'Proxy created successfully',
                data: proxy.toJSON()
            });
        } catch (error) {
            logger.error('Failed to create proxy', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to create proxy',
                message: error.message
            });
        }
    }

    /**
     * Create multiple proxies in a batch
     */
    async createBatchProxies(req, res) {
        try {
            const proxiesData = req.body;
            console.log('Received batch proxy data:', proxiesData);

            if (!Array.isArray(proxiesData) || proxiesData.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'An array of proxy data is required'
                });
            }
            
            // Validate each proxy data
            for (let i = 0; i < proxiesData.length; i++) {
                const proxyData = proxiesData[i];
                if (!proxyData.host || !proxyData.port) {
                    return res.status(400).json({
                        success: false,
                        error: `Proxy at index ${i} is missing host or port`
                    });
                }
                
                // Validate port is a number
                const port = parseInt(proxyData.port);
                if (isNaN(port) || port < 1 || port > 65535) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid port number for proxy at index ${i}. Must be between 1 and 65535.`
                    });
                }
                
                // Set default protocol if not provided
                proxyData.protocol = proxyData.protocol || 'http';
            }

            const result = await this.proxyManager.createBatchProxies(proxiesData);
            console.log('Batch create result:', result);

            res.json(result);

        } catch (error) {
            console.error('Failed to create batch proxies:', error);
            logger.error('Failed to create batch proxies', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to create batch proxies',
                message: error.message
            });
        }
    }

    /**
     * Get a specific proxy by ID
     */
    async getProxy(req, res) {
        try {
            const { proxyId } = req.params;
            const proxy = this.proxyManager.getProxyById(proxyId);

            if (!proxy) {
                return res.status(404).json({
                    success: false,
                    error: 'Proxy not found'
                });
            }

            res.json({
                success: true,
                data: proxy.toJSON()
            });
        } catch (error) {
            logger.error('Failed to get proxy', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get proxy',
                message: error.message
            });
        }
    }

    /**
     * Delete a proxy
     */
    async deleteProxy(req, res) {
        try {
            const { proxyId } = req.params;
            console.log('Attempting to delete proxy with ID:', proxyId);

            const success = await this.proxyManager.deleteProxy(proxyId);

            if (success) {
                console.log('Proxy deleted successfully:', proxyId);
                res.json({
                    success: true,
                    message: 'Proxy deleted successfully'
                });
            } else {
                console.log('Proxy not found:', proxyId);
                res.status(404).json({
                    success: false,
                    error: 'Proxy not found'
                });
            }
        } catch (error) {
            console.error('Failed to delete proxy', { error: error.message, proxyId: req.params.proxyId });
            logger.error('Failed to delete proxy', { error: error.message, proxyId: req.params.proxyId });
            res.status(500).json({
                success: false,
                error: 'Failed to delete proxy',
                message: error.message
            });
        }
    }

    /**
     * Validate a proxy
     */
    async validateProxy(req, res) {
        try {
            // Extract proxy data directly from request body to match frontend structure
            let { host, port, protocol, username, password } = req.body;

            // Validate required fields
            if (!host || !port) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid proxy data provided. Host and port are required.'
                });
            }

            // Validate protocol - allow http, https, socks4, socks5
            const supportedProtocols = ['http', 'https', 'socks4', 'socks5'];
            if (protocol && !supportedProtocols.includes(protocol)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid protocol. Supported protocols: ${supportedProtocols.join(', ')}`
                });
            }

            // Create proxy object for validation
            const proxy = {
                host,
                port: parseInt(port),
                protocol: protocol || 'http',
                username: username || null,
                password: password || null
            };

            // Call proxyManager to validate the proxy
            const isValid = await this.proxyManager.testProxyHealth(proxy);

            if (isValid) {
                // Fetch geolocation data for the proxy
                const geolocation = await this.proxyManager.fetchGeolocationData(host);
                
                res.json({
                    success: true,
                    message: 'Proxy is valid and healthy.',
                    data: {
                        host: proxy.host,
                        port: proxy.port,
                        protocol: proxy.protocol,
                        geolocation: geolocation
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'Proxy validation failed. Proxy is unhealthy or unreachable.'
                });
            }
        } catch (error) {
            logger.error('Failed to validate proxy', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to validate proxy',
                message: error.message
            });
        }
    }

    /**
     * Get proxy statistics
     */
    async getProxyStats(req, res) {
        try {
            const proxyStats = this.proxyManager.getStats();

            res.json({
                success: true,
                data: {
                    proxies: proxyStats,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('Error getting proxy stats', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get proxy statistics',
                message: error.message
            });
        }
    }

    /**
     * Get all profiles
     */
    async getAllProfiles(req, res) {
        try {
            console.log('Debug: Getting all profiles request received');
            
            // Check if profilePoolManager is initialized
            if (!profilePoolManager.isInitialized) {
                console.log('Debug: ProfilePoolManager not initialized, initializing...');
                // Try to initialize it
                await profilePoolManager.initialize();
                console.log('Debug: ProfilePoolManager initialized');
            }
            
            console.log('Debug: Getting all profiles from profilePoolManager');
            const profiles = profilePoolManager.getAllProfiles();
            console.log('Debug: Got profiles count:', profiles.length);
            
            // Convert profiles to JSON format for the response
            const profilesJson = profiles.map(profile => {
                console.log('Debug: Converting profile to JSON:', profile.id);
                return profile.toJSON ? profile.toJSON() : profile;
            });
            
            console.log('Debug: Sending profiles response with count:', profilesJson.length);
            res.json(profilesJson);
        } catch (error) {
            console.error('Error getting all profiles', { error: error.message });
            logger.error('Error getting all profiles', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get profiles',
                message: error.message
            });
        }
    }

    /**
     * Get a specific profile by ID
     */
    async getProfile(req, res) {
        try {
            const { profileId } = req.params;
            const profile = profilePoolManager.getProfileById(profileId);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }

            res.json({
                success: true,
                data: profile.toJSON ? profile.toJSON() : profile
            });
        } catch (error) {
            logger.error('Failed to get profile', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get profile',
                message: error.message
            });
        }
    }

    /**
     * Get profile statistics
     */
    async getProfileStats(req, res) {
        try {
            const { profileId } = req.params;
            const profile = profilePoolManager.getProfileById(profileId);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }

            // Calculate profile stats
            const stats = {
                id: profile.id,
                name: profile.name || `Profile ${profile.id}`,
                created_at: profile.createdAt,
                age_days: profile.createdAt ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
                last_access: profile.lastUsed,
                last_access_days: profile.lastUsed ? Math.floor((Date.now() - new Date(profile.lastUsed).getTime()) / (1000 * 60 * 60 * 24)) : null,
                fingerprint_complexity: profile.fingerprint ? Object.keys(profile.fingerprint).length : 0,
                // Profile size would need to be calculated from the file system
                profile_size_bytes: 0,
                profile_size_mb: 0
            };

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting profile stats', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get profile statistics',
                message: error.message
            });
        }
    }

    /**
     * Get profile fingerprint
     */
    async getProfileFingerprint(req, res) {
        try {
            const { profileId } = req.params;
            const profile = profilePoolManager.getProfileById(profileId);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }

            // If profile has a current fingerprint ID, try to load the detailed fingerprint data
            if (profile.fingerprint && profile.fingerprint.currentFingerprintId) {
                const fs = require('fs-extra');
                const path = require('path');
                const config = require('../utils/config');
                
                // Construct the fingerprint file path
                const profileDir = path.join(config.paths.profiles, `profile_${profileId}`);
                const fingerprintFileName = `fingerprint_${profile.fingerprint.currentFingerprintId}.json`;
                const fingerprintFilePath = path.join(profileDir, fingerprintFileName);
                
                // Check if the fingerprint file exists and load it
                if (await fs.pathExists(fingerprintFilePath)) {
                    const fingerprintData = await fs.readJson(fingerprintFilePath);
                    
                    // Transform the raw fingerprint data into the structure expected by the client
                    const transformedData = {
                        ...fingerprintData, // Preserve original data
                        navigator: {
                            userAgent: fingerprintData.userAgent,
                            platform: fingerprintData.platform,
                            language: fingerprintData.language,
                            hardwareConcurrency: fingerprintData.hardware?.cores
                        },
                        screen: {
                            width: fingerprintData.screen?.width,
                            height: fingerprintData.screen?.height,
                            colorDepth: fingerprintData.screen?.colorDepth
                        },
                        window: {
                            innerWidth: fingerprintData.viewport?.width,
                            innerHeight: fingerprintData.viewport?.height
                        },
                        webgl: fingerprintData.webgl
                    };
                    
                    return res.json({
                        success: true,
                        data: transformedData
                    });
                }
            }

            // Fallback to basic fingerprint metadata if detailed data is not available
            res.json({
                success: true,
                data: profile.fingerprint || {}
            });
        } catch (error) {
            logger.error('Failed to get profile fingerprint', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get profile fingerprint',
                message: error.message
            });
        }
    }

    /**
     * Get system statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getSystemStats(req, res) {
        try {
            res.json({
                success: true,
                data: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('Failed to get system stats', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get system stats',
                message: error.message
            });
        }
    }

    /**
     * Create a new profile
     */
    async createProfile(req, res) {
        try {
            const profileData = req.body;
            
            console.log('Debug: Received profile creation request with data:', profileData);
            
            // Validate required fields
            if (!profileData.name) {
                console.log('Debug: Profile name is missing');
                return res.status(400).json({
                    success: false,
                    error: 'Profile name is required'
                });
            }

            // Create the profile using the profile pool manager
            const profile = await profilePoolManager.createProfile(profileData);

            console.log('Debug: Profile created successfully:', profile.id);

            res.status(201).json({
                success: true,
                message: 'Profile created successfully with assigned proxy',
                data: profile.toJSON ? profile.toJSON() : profile
            });
        } catch (error) {
            console.error('Debug: Failed to create profile', { 
                error: error.message, 
                stack: error.stack 
            });
            logger.error('Failed to create profile', { error: error.message });
            
            // Provide more specific error messages
            if (error.message.includes('Proxy not found')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid proxy configuration',
                    message: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to create profile',
                message: error.message
            });
        }
    }

    /**
     * Update a profile
     */
    async updateProfile(req, res) {
        try {
            const { profileId } = req.params;
            const updateData = req.body;
            
            console.log('Debug: Updating profile', profileId, 'with data:', updateData);
            
            // Get the profile
            const profile = profilePoolManager.getProfileById(profileId);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }
            
            // Update profile properties
            if (updateData.name) {
                profile.name = updateData.name;
            }
            
            // Update config if provided
            if (updateData.config) {
                // Handle proxy assignment
                if (updateData.config.proxy !== undefined) {
                    if (updateData.config.proxy === null) {
                        // Remove proxy assignment
                        if (profile.assignedProxy) {
                            // Mark proxy as unassigned
                            profile.assignedProxy.isAssigned = false;
                            profile.assignedProxy.assignedProfileId = null;
                            profile.assignedProxy.assignedAt = null;
                            delete profile.assignedProxy;
                        }
                    } else {
                        // Assign new proxy
                        // In a real implementation, you would validate the proxy and assign it
                        // For now, we'll just store the proxy config
                        profile.assignedProxy = updateData.config.proxy;
                    }
                }
                
                // Update other config properties
                Object.keys(updateData.config).forEach(key => {
                    if (key !== 'proxy') {
                        profile[key] = updateData.config[key];
                    }
                });
            }
            
            // Save the updated profile
            await profilePoolManager.saveProfile(profileId);
            
            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: profile.toJSON ? profile.toJSON() : profile
            });
        } catch (error) {
            console.error('Failed to update profile', { error: error.message, stack: error.stack });
            logger.error('Failed to update profile', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to update profile',
                message: error.message
            });
        }
    }

    /**
     * Delete a profile
     */
    async deleteProfile(req, res) {
        try {
            const { profileId } = req.params;
            console.log('Attempting to delete profile with ID:', profileId);
            
            // Delete the profile using the profile pool manager
            await profilePoolManager.deleteProfile(profileId);
            
            console.log('Profile deleted successfully:', profileId);
            res.json({
                success: true,
                message: 'Profile deleted successfully'
            });
        } catch (error) {
            console.error('Failed to delete profile', { error: error.message, profileId });
            logger.error('Failed to delete profile', { error: error.message, profileId });
            
            // Check if it's a "not found" error
            if (error.message === 'Profile not found') {
                res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to delete profile',
                    message: error.message
                });
            }
        }
    }

    /**
     * Create multiple profiles
     */
    async createBatchProfiles(req, res) {
        try {
            const profilesData = req.body;
            
            // Validate input
            if (!Array.isArray(profilesData) || profilesData.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid input. Expected an array of profile data.'
                });
            }
            
            // Create profiles using the profile pool manager
            const results = [];
            const errors = [];
            
            for (let i = 0; i < profilesData.length; i++) {
                try {
                    const profileData = profilesData[i];
                    const profile = await profilePoolManager.createProfile(profileData);
                    results.push({
                        index: i,
                        profileId: profile.id,
                        name: profile.name
                    });
                } catch (error) {
                    errors.push({
                        index: i,
                        error: error.message
                    });
                }
            }
            
            res.json({
                success: true,
                message: `Batch profile creation completed. ${results.length} profiles created, ${errors.length} errors.`,
                created: results,
                errors: errors
            });
        } catch (error) {
            logger.error('Failed to create batch profiles', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to create batch profiles',
                message: error.message
            });
        }
    }

    /**
     * Launch a browser with the specified profile using direct method (no Inngest)
     */
    async launchProfileDirect(req, res) {
        try {
            const { profileId } = req.params;
            const { 
                headless = false, 
                use_proxy = true, 
                geoip, 
                humanize,
                campaignId
            } = req.query;
            
            // Also check request body for additional options
            const requestBody = req.body || {};
            const { campaignId: bodyCampaignId, options = {} } = requestBody;

            // Verify profile exists before launching
            const profile = profilePoolManager.getProfileById(profileId);
            console.log('DEBUG: profile retrieved in controller:', profile);
            console.log('DEBUG: profile type in controller:', typeof profile);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }

            logger.info('Launching profile directly (no Inngest)', {
                profileId,
                headless,
                use_proxy,
                geoip,
                humanize,
                campaignId: campaignId || bodyCampaignId
            });

            // Prepare launch options with minimal configuration to let itbrowser handle everything
            const launchOptions = {
                headless: headless === 'true' || options.headless === true,
                useProxy: use_proxy === 'true' || options.useProxy === true,
                geoip: geoip === 'true' || options.geoip === true || profile.assignedProxy !== null,
                humanize: humanize === 'true' || options.humanize === true,
                campaignId: campaignId || bodyCampaignId,
                // Add geographic data from assigned proxy if available
                geographic: profile.assignedProxy?.geolocation || null,
                // Minimal browser arguments to work with itbrowser (removed unsupported --disable-setuid-sandbox flag)
                args: [
                    '--no-sandbox'
                ],
                timeout: 300000, // Increased timeout for itbrowser (5 minutes)
                isDirectLaunch: true, // Use direct launch for better itbrowser integration
                ...options // Include any additional options from the request body
            };

            // Launch the profile directly using profilePoolManager
            const result = await profilePoolManager.launchProfile(profileId, launchOptions);

            res.json({
                success: true,
                message: 'Profile launched successfully',
                ...result
            });

        } catch (error) {
            console.error('Failed to launch profile directly', { error: error.message, profileId: req.params.profileId });
            logger.error('Failed to launch profile directly', { error: error.message, profileId: req.params.profileId });
            res.status(500).json({
                success: false,
                error: 'Failed to launch profile',
                message: error.message
            });
        }
    }

    /**
     * Set browser configuration for profile
     */
    async setProfileBrowserConfig(req, res) {
        try {
            const { profileId } = req.params;
            const configData = req.body;
            
            // Get the profile
            const profile = profilePoolManager.getProfileById(profileId);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }
            
            // Update browser configuration
            if (configData.viewport) {
                profile.viewport = configData.viewport;
            }
            
            if (configData.userAgent) {
                profile.userAgent = configData.userAgent;
            }
            
            if (configData.timezone) {
                profile.timezone = configData.timezone;
            }
            
            if (configData.language) {
                profile.language = configData.language;
            }
            
            // Save the updated profile
            await profilePoolManager.saveProfile(profileId);
            
            res.json({
                success: true,
                message: 'Profile browser configuration updated successfully',
                data: profile.toJSON ? profile.toJSON() : profile
            });
        } catch (error) {
            logger.error('Failed to set profile browser config', { error: error.message, profileId: req.params.profileId });
            res.status(500).json({
                success: false,
                error: 'Failed to set profile browser config',
                message: error.message
            });
        }
    }

    /**
     * Close browser for profile
     */
    async closeProfileBrowser(req, res) {
        try {
            const { profileId } = req.params;
            
            // Get the profile
            const profile = profilePoolManager.getProfileById(profileId);
            if (!profile) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }
            
            // Close browser if it's active
            if (profile.isActive && profile.session.currentSessionId) {
                // Close the browser through itBrowserAPI
                try {
                    await profilePoolManager.itBrowserAPI.closeBrowser(profile.session.currentSessionId);
                } catch (browserError) {
                    logger.warn('Failed to close browser gracefully, continuing with profile update', { 
                        error: browserError.message, 
                        profileId, 
                        browserId: profile.session.currentSessionId 
                    });
                }
                
                // Update profile status
                profile.isActive = false;
                profile.session.currentSessionId = null;
                profile.session.sessionStartTime = null;
                
                // Save the updated profile
                await profilePoolManager.saveProfile(profileId);
                
                res.json({
                    success: true,
                    message: 'Profile browser closed successfully'
                });
            } else {
                res.json({
                    success: true,
                    message: 'Profile browser was not active'
                });
            }
        } catch (error) {
            logger.error('Failed to close profile browser', { error: error.message, profileId: req.params.profileId });
            res.status(500).json({
                success: false,
                error: 'Failed to close profile browser',
                message: error.message
            });
        }
    }

    /**
     * Import profile from JSON
     */
    async importProfile(req, res) {
        try {
            const profileData = req.body;
            
            // Validate input
            if (!profileData || typeof profileData !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid profile data provided'
                });
            }
            
            // Import the profile using the profile pool manager
            const profile = await profilePoolManager.createProfile(profileData);
            
            res.status(201).json({
                success: true,
                message: 'Profile imported successfully',
                data: profile.toJSON ? profile.toJSON() : profile
            });
        } catch (error) {
            logger.error('Failed to import profile', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to import profile',
                message: error.message
            });
        }
    }

    /**
     * Assign a proxy to a profile
     */
    async assignProxyToProfile(req, res) {
        try {
            const { profileId } = req.params;
            const { proxyId } = req.body;
            
            // Assign proxy using the profile pool manager
            const result = await profilePoolManager.assignProxyToProfile(profileId, proxyId);
            
            res.json(result);
            
        } catch (error) {
            logger.error('Failed to assign proxy to profile', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to assign proxy to profile',
                message: error.message
            });
        }
    }
}

module.exports = SystemController;