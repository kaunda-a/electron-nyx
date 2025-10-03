const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();
const { findBrowserExecutable } = require('./browserFinder');

class Config {
    constructor() {
        this.loadConfig();
    }

    loadConfig() {
        // Server Configuration
        this.server = {
            port: process.env.PORT || 3000,
            nodeEnv: process.env.NODE_ENV || 'development'
        };

        // itBrowser Configuration
        this.itbrowser = {
            executable: findBrowserExecutable(),
            fingerprintGenerator: path.resolve(process.env.ITBROWSER_FINGERPRINT_GENERATOR || './itbrowser_fingerprint.exe'),
            fingerprintDatabasePath: path.resolve(process.env.FINGERPRINT_DATABASE_PATH || './resources/storage/fingerprints/'),
            fingerprintSourcePath: path.resolve(process.env.FINGERPRINT_SOURCE_PATH || './fingerprints/'),
            fingerprintRotationInterval: process.env.FINGERPRINT_ROTATION_INTERVAL || '24h'
        };

        // System Settings
        this.system = {
            dailyVisitTarget: parseInt(process.env.DAILY_VISIT_TARGET) || 5000,
            maxConcurrentVisits: parseInt(process.env.MAX_CONCURRENT_VISITS) || 10,
            profileCount: parseInt(process.env.PROFILE_COUNT) || 0, // 0 = unlimited
            maxProfilesPerBatch: parseInt(process.env.MAX_PROFILES_PER_BATCH) || 1000,
            enableUnlimitedProfiles: process.env.ENABLE_UNLIMITED_PROFILES !== 'false'
        };

        // Profile Distribution (PRIORITIZING US TRAFFIC)
        this.profiles = {
            newVisitorCount: parseInt(process.env.NEW_VISITOR_COUNT) || 402,
            returningRegularCount: parseInt(process.env.RETURNING_REGULAR_COUNT) || 351,
            loyalUserCount: parseInt(process.env.LOYAL_USER_COUNT) || 249,
            // Country distribution weights (US PRIORITIZED)
            countryWeights: {
                us: 60,  // 60% - PRIORITIZED US market
                gb: 15,  // 15% - UK market
                ca: 10,  // 10% - Canada
                au: 8,   // 8% - Australia
                de: 5,   // 5% - Germany
                ar: 2    // 2% - Argentina (minimal)
            }
        };

        // Target Websites Configuration
        this.websites = {
            targets: this.parseArrayConfig(process.env.TARGET_WEBSITES, ['https://example.com']),
            // Websites with pre-placed ad tags (your own Next.js sites)
            prePlacedAdSites: this.parseArrayConfig(process.env.PRE_PLACED_AD_SITES, []),
            rotationEnabled: process.env.WEBSITE_ROTATION_ENABLED === 'true',
            pagesPerWebsiteMin: parseInt(process.env.PAGES_PER_WEBSITE_MIN) || 3,
            pagesPerWebsiteMax: parseInt(process.env.PAGES_PER_WEBSITE_MAX) || 8,
            internalLinkFollowProbability: parseFloat(process.env.INTERNAL_LINK_FOLLOW_PROBABILITY) || 0.7,
            externalLinkFollowProbability: parseFloat(process.env.EXTERNAL_LINK_FOLLOW_PROBABILITY) || 0.2
        };

        // Ad Interaction Configuration
        this.adInteraction = {
            enabled: process.env.AD_CLICK_ENABLED === 'true',
            clickProbability: parseFloat(process.env.AD_CLICK_PROBABILITY) || 0.15,
            hoverBeforeClickProbability: parseFloat(process.env.AD_HOVER_BEFORE_CLICK_PROBABILITY) || 0.6,

            // Timing settings
            minInteractionTime: parseInt(process.env.AD_INTERACTION_MIN_TIME) || 5000,
            maxInteractionTime: parseInt(process.env.AD_INTERACTION_MAX_TIME) || 30000,
            minDwellTime: parseInt(process.env.AD_DWELL_TIME_MIN) || 2000,
            maxDwellTime: parseInt(process.env.AD_DWELL_TIME_MAX) || 8000,

            // New tab handling
            newTabInteractionEnabled: process.env.NEW_TAB_INTERACTION_ENABLED === 'true',
            newTabMinTime: parseInt(process.env.NEW_TAB_MIN_TIME) || 10000,
            newTabMaxTime: parseInt(process.env.NEW_TAB_MAX_TIME) || 45000,
            returnToOriginalTabProbability: parseFloat(process.env.RETURN_TO_ORIGINAL_TAB_PROBABILITY) || 0.9,
            closeAdTabProbability: parseFloat(process.env.CLOSE_AD_TAB_PROBABILITY) || 0.8,

            // Ad detection
            selectors: process.env.AD_SELECTORS ? process.env.AD_SELECTORS.split(',').map(s => s.trim()) : [
                // Google AdSense selectors
                '.adsbygoogle', 'ins.adsbygoogle', '[data-ad-client]', '[data-ad-slot]',
                'iframe[src*="googlesyndication"]', 'iframe[src*="doubleclick"]',
                // Generic ad selectors
                '.ad', '.advertisement', '[data-ad]', '.sponsored', '.promo',
                '.banner', '.ad-banner', '.ad-container', '.ad-wrapper',
                // Network specific selectors
                'iframe[src*="ads"]', 'iframe[src*="monetag"]', 'iframe[src*="adsterra"]',
                '[data-monetag]', '[data-adsterra]', '.popunder', '.pop-ad'
            ],
            popupInteractionEnabled: process.env.POPUP_AD_INTERACTION_ENABLED === 'true',
            bannerInteractionEnabled: process.env.BANNER_AD_INTERACTION_ENABLED === 'true',
            videoInteractionEnabled: process.env.VIDEO_AD_INTERACTION_ENABLED === 'true'
        };

        // Ad Networks Configuration
        this.adNetworks = {
            primary: process.env.PRIMARY_AD_NETWORK || 'adsense',
            secondary: process.env.SECONDARY_AD_NETWORK || 'monetag',
            tertiary: process.env.TERTIARY_AD_NETWORK || 'adsterra',
            fallback: process.env.FALLBACK_AD_NETWORK || 'popads',

            // Google AdSense Configuration
            adsense: {
                enabled: process.env.ADSENSE_ENABLED === 'true',
                publisherId: process.env.ADSENSE_PUBLISHER_ID,
                adClientId: process.env.ADSENSE_AD_CLIENT_ID,
                adSlots: this.parseArrayConfig(process.env.ADSENSE_AD_SLOTS, []),
                formats: {
                    display: process.env.ADSENSE_DISPLAY_ENABLED !== 'false',
                    inFeed: process.env.ADSENSE_INFEED_ENABLED === 'true',
                    inArticle: process.env.ADSENSE_INARTICLE_ENABLED === 'true',
                    matchedContent: process.env.ADSENSE_MATCHED_CONTENT_ENABLED === 'true',
                    autoAds: process.env.ADSENSE_AUTO_ADS_ENABLED === 'true',
                    responsive: process.env.ADSENSE_RESPONSIVE_ENABLED !== 'false',
                    video: process.env.ADSENSE_VIDEO_ENABLED === 'true'
                },
                targeting: {
                    enablePersonalization: process.env.ADSENSE_PERSONALIZATION_ENABLED !== 'false',
                    enableConsentMode: process.env.ADSENSE_CONSENT_MODE_ENABLED === 'true',
                    enableLimitedAds: process.env.ADSENSE_LIMITED_ADS_ENABLED === 'true'
                }
            },

            // Monetag Configuration
            monetag: {
                enabled: process.env.MONETAG_ENABLED === 'true',
                siteId: process.env.MONETAG_SITE_ID,
                siteIds: this.parseArrayConfig(process.env.MONETAG_SITE_IDS, []),
                formats: {
                    pushNotifications: process.env.MONETAG_PUSH_ENABLED === 'true',
                    inPagePush: process.env.MONETAG_INPAGE_PUSH_ENABLED === 'true',
                    popunder: process.env.MONETAG_POPUNDER_ENABLED === 'true',
                    directLink: process.env.MONETAG_DIRECT_LINK_ENABLED === 'true',
                    interstitial: process.env.MONETAG_INTERSTITIAL_ENABLED === 'true',
                    banner: process.env.MONETAG_BANNER_ENABLED === 'true',
                    native: false,
                    video: false
                }
            },

            // Adsterra Configuration
            adsterra: {
                enabled: process.env.ADSTERRA_ENABLED === 'true',
                siteId: process.env.ADSTERRA_SITE_ID,
                siteIds: this.parseArrayConfig(process.env.ADSTERRA_SITE_IDS, []),
                formats: {
                    pushNotifications: process.env.ADSTERRA_PUSH_ENABLED === 'true',
                    inPagePush: process.env.ADSTERRA_INPAGE_PUSH_ENABLED === 'true',
                    popunder: process.env.ADSTERRA_POPUNDER_ENABLED === 'true',
                    directLink: process.env.ADSTERRA_DIRECT_LINK_ENABLED === 'true',
                    interstitial: process.env.ADSTERRA_INTERSTITIAL_ENABLED === 'true',
                    native: process.env.ADSTERRA_NATIVE_ENABLED === 'true',
                    banner: process.env.ADSTERRA_BANNER_ENABLED === 'true',
                    video: false
                }
            },

            // PopAds Configuration
            popads: {
                enabled: process.env.POPADS_ENABLED === 'true',
                siteId: process.env.POPADS_SITE_ID,
                formats: {
                    pushNotifications: false,
                    inPagePush: false,
                    popunder: process.env.POPADS_POPUNDER_ENABLED === 'true',
                    directLink: process.env.POPADS_DIRECT_LINK_ENABLED === 'true',
                    interstitial: false,
                    native: false,
                    banner: false,
                    video: false
                }
            },

            // HilltopAds Configuration
            hilltopads: {
                enabled: process.env.HILLTOPADS_ENABLED === 'true',
                siteId: process.env.HILLTOPADS_SITE_ID,
                formats: {
                    pushNotifications: process.env.HILLTOPADS_PUSH_ENABLED === 'true',
                    inPagePush: false,
                    popunder: process.env.HILLTOPADS_POPUNDER_ENABLED === 'true',
                    directLink: process.env.HILLTOPADS_DIRECT_LINK_ENABLED === 'true',
                    interstitial: false,
                    native: false,
                    banner: process.env.HILLTOPADS_BANNER_ENABLED === 'true',
                    video: process.env.HILLTOPADS_VIDEO_ENABLED === 'true'
                }
            }
        };

        // Ad Format Priorities
        this.adFormatPriorities = {
            pushNotifications: parseInt(process.env.PUSH_NOTIFICATION_PRIORITY) || 8,
            inPagePush: parseInt(process.env.INPAGE_PUSH_PRIORITY) || 7,
            popunder: parseInt(process.env.POPUNDER_PRIORITY) || 9,
            directLink: parseInt(process.env.DIRECT_LINK_PRIORITY) || 6,
            interstitial: parseInt(process.env.INTERSTITIAL_PRIORITY) || 5,
            native: parseInt(process.env.NATIVE_ADS_PRIORITY) || 4,
            banner: parseInt(process.env.BANNER_ADS_PRIORITY) || 3,
            video: parseInt(process.env.VIDEO_ADS_PRIORITY) || 7
        };

        // Geographic Distribution (proxy-driven, not hardcoded)
        this.geographic = {
            topTierCountries: ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK'],
            topTierPercentage: parseFloat(process.env.TOP_TIER_PERCENTAGE) || 0.80,
            // Note: Country-specific data (timezone, language, coordinates) now comes from actual proxy locations
            // This eliminates hardcoded geographic values and ensures consistency with real proxy IPs
        };

        // Proxy Configuration
        this.proxy = {
            providers: {
                nodemaven: {
                    enabled: process.env.NODEMAVEN_ENABLED === 'true',
                    host: process.env.NODEMAVEN_HOST,
                    port: parseInt(process.env.NODEMAVEN_PORT) || 8080,
                    username: process.env.NODEMAVEN_USERNAME,
                    password: process.env.NODEMAVEN_PASSWORD,
                    sessionType: process.env.NODEMAVEN_SESSION_TYPE || 'sticky',
                    sessionDuration: process.env.NODEMAVEN_SESSION_DURATION || '10-24h',
                    protocol: process.env.NODEMAVEN_PROTOCOL || 'http',
                    location: process.env.NODEMAVEN_LOCATION || 'random',
                    quality: process.env.NODEMAVEN_QUALITY || 'medium'
                }
            },
            rotation: {
                enabled: process.env.PROXY_ROTATION_ENABLED === 'true',
                interval: process.env.PROXY_ROTATION_INTERVAL || '24h',
                maxSessionDuration: process.env.MAX_SESSION_DURATION || '24h',
                intelligentAssignment: process.env.INTELLIGENT_IP_ASSIGNMENT === 'true'
            },
            fallback: {
                enabled: process.env.PROXY_FALLBACK_ENABLED === 'true',
                retryAttempts: parseInt(process.env.PROXY_RETRY_ATTEMPTS) || 3,
                timeoutMs: parseInt(process.env.PROXY_TIMEOUT_MS) || 30000
            }
        };

        // Note: Duplicate geographic configuration removed - using proxy-driven data instead



        // Session Management
        this.sessions = {
            newVisitor: {
                minDuration: parseInt(process.env.SESSION_DURATION_NEW_VISITOR_MIN) || 2,
                maxDuration: parseInt(process.env.SESSION_DURATION_NEW_VISITOR_MAX) || 8
            },
            returningRegular: {
                minDuration: parseInt(process.env.SESSION_DURATION_RETURNING_MIN) || 4,
                maxDuration: parseInt(process.env.SESSION_DURATION_RETURNING_MAX) || 12
            },
            loyalUser: {
                minDuration: parseInt(process.env.SESSION_DURATION_LOYAL_MIN) || 8,
                maxDuration: parseInt(process.env.SESSION_DURATION_LOYAL_MAX) || 24
            }
        };

        // Browser Configuration
        this.browser = {
            headless: process.env.BROWSER_HEADLESS === 'true',
            timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
            viewport: {
                width: parseInt(process.env.BROWSER_VIEWPORT_WIDTH) || 1920,
                height: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT) || 1080
            }
        };

        // Logging Configuration
        this.logging = {
            level: process.env.LOG_LEVEL || 'info',
            filePath: path.resolve(process.env.LOG_FILE_PATH || './resources/storage/logs/'),
            maxSize: process.env.LOG_MAX_SIZE || '10m',
            maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
        };

        // Data Paths - Changed to use resources folder instead of localStorage
        this.paths = {
            localStorage: path.resolve('./resources/storage/'),
            storage: path.resolve('./resources/storage/'),
            data: path.resolve('./resources/storage/data/'),
            profiles: path.resolve(process.env.PROFILES_DATA_PATH || './resources/storage/profiles/'),
            proxies: path.resolve(process.env.PROXIES_DATA_PATH || './resources/storage/proxies/'),
            logs: path.resolve(process.env.LOGS_DATA_PATH || './resources/storage/logs/'),
            config: path.resolve(process.env.CONFIG_PATH || './resources/storage/config/')
        };

        // Human Behavior Simulation
        this.behavior = {
            pageLoadWait: {
                min: parseInt(process.env.MIN_PAGE_LOAD_WAIT) || 2000,
                max: parseInt(process.env.MAX_PAGE_LOAD_WAIT) || 5000
            },
            scrollDelay: {
                min: parseInt(process.env.MIN_SCROLL_DELAY) || 500,
                max: parseInt(process.env.MAX_SCROLL_DELAY) || 2000
            },
            clickDelay: {
                min: parseInt(process.env.MIN_CLICK_DELAY) || 1000,
                max: parseInt(process.env.MAX_CLICK_DELAY) || 3000
            }
        };

        // Anti-Detection Settings
        this.antiDetection = {
            enableFingerprintRotation: process.env.ENABLE_FINGERPRINT_ROTATION === 'true',
            enableBehavioralSimulation: process.env.ENABLE_BEHAVIORAL_SIMULATION === 'true',
            enableSessionIsolation: process.env.ENABLE_SESSION_ISOLATION === 'true'
        };
    }

    // Validate configuration and create necessary directories
    async validateAndSetup() {
        try {
            // Ensure all storage directories exist in resources folder (except fingerprints - user doesn't want it auto-created)
            await fs.ensureDir(this.paths.localStorage);
            await fs.ensureDir(this.paths.profiles);
            await fs.ensureDir(this.paths.logs);
            await fs.ensureDir(this.paths.config);
            // Removed: await fs.ensureDir(this.itbrowser.fingerprintDatabasePath);

            // Validate itBrowser executable exists
            if (!await fs.pathExists(this.itbrowser.executable)) {
                throw new Error(`ITBrowser executable not found at: ${this.itbrowser.executable}. The browser must be extracted from the zip file before running the application.`);
            }

            return true;
        } catch (error) {
            throw new Error(`Configuration validation failed: ${error.message}`);
        }
    }

    // Get random value within range
    getRandomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Get session duration for profile category
    getSessionDuration(category) {
        const sessionConfig = this.sessions[category];
        if (!sessionConfig) {
            throw new Error(`Unknown profile category: ${category}`);
        }
        return this.getRandomInRange(sessionConfig.minDuration, sessionConfig.maxDuration);
    }

    /**
     * Parse array configuration from environment variables
     * Supports both comma-separated strings and JSON arrays
     * @param {string} envValue - Environment variable value
     * @param {Array} defaultValue - Default value if parsing fails
     * @returns {Array} Parsed array
     */
    parseArrayConfig(envValue, defaultValue = []) {
        if (!envValue) return defaultValue;

        // Handle JSON array format: ["item1", "item2", "item3"]
        if (envValue.trim().startsWith('[') && envValue.trim().endsWith(']')) {
            try {
                return JSON.parse(envValue);
            } catch (error) {
                console.warn(`Failed to parse JSON array: ${envValue}. Using comma-separated fallback.`);
                // Fallback to comma-separated parsing
                return envValue.replace(/[\[\]"']/g, '').split(',').map(item => item.trim()).filter(item => item);
            }
        }

        // Handle comma-separated format: item1,item2,item3
        if (envValue.includes(',')) {
            return envValue.split(',').map(item => item.trim()).filter(item => item);
        }

        // Single value
        return [envValue.trim()];
    }

    /**
     * Get site ID for specific website and ad network
     * @param {string} website - Target website URL
     * @param {string} network - Ad network name
     * @returns {string} Site ID for the website/network combination
     */
    getSiteIdForWebsite(website, network) {
        const networkConfig = this.adNetworks[network];
        if (!networkConfig) return null;

        // If siteIds array is configured, use website index
        if (Array.isArray(networkConfig.siteIds) && networkConfig.siteIds.length > 0) {
            const websiteIndex = this.websites.targets.indexOf(website);
            const siteIdIndex = websiteIndex >= 0 ? websiteIndex % networkConfig.siteIds.length : 0;
            return networkConfig.siteIds[siteIdIndex];
        }

        // Fallback to single siteId
        return Array.isArray(networkConfig.siteId) ? networkConfig.siteId[0] : networkConfig.siteId;
    }
}

module.exports = new Config();
