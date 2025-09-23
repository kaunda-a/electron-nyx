const { v4: uuidv4 } = require('uuid');
const profilePoolManager = require('../services/profilePoolManager');
const sessionStateManager = require('../services/sessionStateManager');
const ItBrowserAPI = require('../services/itBrowserAPI');
const humanBehavior = require('../services/humanBehavior');
const ProxyManager = require('../services/proxyManager');
const AdInteractionService = require('../services/adInteractionService');
const WebsiteNavigationService = require('../services/websiteNavigationService');
const PrePlacedAdService = require('../services/prePlacedAdService');
const config = require('../utils/config');
const logger = require('../utils/logger');

class VisitController {
    constructor() {
        this.activeVisits = new Map();
        this.visitHistory = [];
        this.itBrowserAPI = new ItBrowserAPI();
        this.proxyManager = new ProxyManager();
        this.adInteractionService = new AdInteractionService();
        this.websiteNavigationService = new WebsiteNavigationService();
        this.prePlacedAdService = new PrePlacedAdService();
        this.visitStats = {
            total: 0,
            successful: 0,
            failed: 0,
            avgDuration: 0,
            adInteractions: 0,
            pagesPerVisit: 0,
            categoriesUsed: {
                newVisitor: 0,
                returningRegular: 0,
                loyalUser: 0
            }
        };
    }

    /**
     * Initialize visit controller and all services
     */
    async initialize() {
        logger.info('Initializing visit controller services');

        // Initialize proxy manager
        try {
            await this.proxyManager.initialize();
            logger.info('Proxy manager initialized');
        } catch (error) {
            logger.error('Proxy manager initialization failed:', error);
            logger.info('Continuing without proxy manager - will use direct connection');
        }

        // Initialize other services if needed
        // (Currently other services don't require initialization)

        logger.info('Visit controller initialization completed');
    }

    /**
     * Perform a single website visit
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async performVisit(req, res) {
        const visitId = uuidv4();
        const startTime = Date.now();

        try {
            const { profileCategory, sessionDuration, options = {} } = req.body;

            // Get target URL from configured websites
            const targetWebsites = config.websites.targets;
            if (!targetWebsites || targetWebsites.length === 0) {
                return res.status(500).json({
                    error: 'No target websites configured',
                    message: 'Please configure TARGET_WEBSITES in .env file',
                    visitId
                });
            }

            // Randomly select a target website
            const url = targetWebsites[Math.floor(Math.random() * targetWebsites.length)];

            logger.info('Selected target website for visit', {
                url,
                availableWebsites: targetWebsites.length,
                visitId
            });

            // Validate URL format
            if (!this.isValidUrl(url)) {
                return res.status(500).json({
                    error: 'Invalid URL format in configured websites',
                    url,
                    visitId
                });
            }

            logger.visitStart(visitId, url, profileCategory);

            // Get available profile
            const profile = profilePoolManager.getAvailableProfile(profileCategory);
            if (!profile) {
                return res.status(503).json({
                    error: 'No available profiles',
                    message: 'All profiles are currently in use. Please try again later.',
                    visitId
                });
            }

            // Create or get session
            let session = sessionStateManager.getSession(profile.session.currentSessionId);
            if (!session || sessionStateManager.shouldTerminateSession(session.id)) {
                const duration = sessionDuration || config.getSessionDuration(profile.category);
                session = sessionStateManager.createSession(profile.id, { duration });
                profilePoolManager.startSession(profile.id, duration);
            }

            // Track active visit
            this.activeVisits.set(visitId, {
                visitId,
                profileId: profile.id,
                sessionId: session.id,
                url,
                startTime,
                status: 'in_progress'
            });

            // Perform the visit
            const visitResult = await this.executeVisit(visitId, profile, session, url, options);

            // Update statistics
            this.updateVisitStats(visitResult);

            // Update profile after visit
            await profilePoolManager.updateProfileAfterVisit(profile.id, visitResult);

            // Update session activity
            sessionStateManager.updateSessionActivity(session.id, {
                url,
                duration: visitResult.duration,
                success: visitResult.success,
                fingerprintId: visitResult.fingerprintId,
                behaviorData: visitResult.behaviorData
            });

            // Remove from active visits
            this.activeVisits.delete(visitId);

            // Add to history
            this.visitHistory.unshift({
                ...visitResult,
                visitId,
                timestamp: new Date().toISOString()
            });

            // Keep only last 1000 visits in memory
            if (this.visitHistory.length > 1000) {
                this.visitHistory = this.visitHistory.slice(0, 1000);
            }

            logger.visitComplete(visitId, url, visitResult.duration, visitResult.success);

            res.json({
                success: true,
                visitId,
                result: visitResult,
                profile: {
                    id: profile.id,
                    category: profile.category
                },
                session: {
                    id: session.id,
                    visitsInSession: session.visitsInSession
                }
            });

        } catch (error) {
            logger.visitError(visitId, req.body.url, error.message);
            
            // Remove from active visits
            this.activeVisits.delete(visitId);

            // Update failed stats
            this.visitStats.failed++;
            this.visitStats.total++;

            res.status(500).json({
                success: false,
                visitId,
                error: error.message,
                duration: Date.now() - startTime
            });
        }
    }

    /**
     * Execute the actual visit
     * @param {string} visitId - Visit ID
     * @param {Object} profile - Profile object
     * @param {Object} session - Session object
     * @param {string} url - Target URL
     * @param {Object} options - Visit options
     * @returns {Promise<Object>} Visit result
     */
    async executeVisit(visitId, profile, session, url, options) {
        let browser = null;
        let page = null;
        const startTime = Date.now();

        try {
            // Use pre-assigned proxy from profile (NEW APPROACH)
            let proxy = null;
            let geographic = null;

            if (profile.assignedProxy) {
                // Use the pre-assigned proxy from profile creation
                proxy = profile.assignedProxy;
                geographic = profile.geographic || proxy.geographic;

                logger.info(`🎯 Using pre-assigned proxy for profile ${profile.id}`, {
                    proxyHost: proxy.host,
                    proxyPort: proxy.port,
                    country: proxy.country,
                    sessionId: proxy.sessionId
                });
            } else {
                // Fallback to dynamic proxy assignment (for backward compatibility)
                try {
                    proxy = await this.proxyManager.getProxyForProfile(profile.id, profile.category);
                    geographic = {
                        country: proxy.country,
                        countryName: proxy.countryName,
                        timezone: proxy.timezone,
                        language: proxy.language
                    };
                } catch (proxyError) {
                    logger.error('❌ No proxy available (neither pre-assigned nor dynamic)', { profileId: profile.id, error: proxyError.message });
                    throw new Error(`Profile ${profile.id} has no proxy assigned and dynamic assignment failed`);
                }
            }

            // Update profile with geographic assignment if not set
            if (!profile.geographic) {
                profile.geographic = geographic;
            }

            // Generate fingerprint for this visit with geographic context
            const fingerprint = await this.itBrowserAPI.generateFingerprint(profile, {
                geographic: geographic
            });

            // Format proxy for Playwright (if available)
            const formattedProxy = proxy ? this.proxyManager.formatProxyForPlaywright(proxy) : null;

            // Launch browser with fingerprint and proxy (if available)
            const browserInstance = await this.itBrowserAPI.launchBrowser(fingerprint.id, {
                proxy: formattedProxy,
                contextOptions: {
                    ...options.contextOptions,
                    locale: geographic.language,
                    timezoneId: geographic.timezone
                }
            });

            browser = browserInstance;
            
            // Register browser with session
            sessionStateManager.registerBrowserInstance(session.id, browser.id, {
                fingerprintId: fingerprint.id
            });

            // Create new page
            page = await browser.context.newPage();

            // Select target website if not provided
            const targetUrl = url || this.websiteNavigationService.selectTargetWebsite(profile.category);

            // Navigate to URL
            logger.info('Navigating to URL', { visitId, url: targetUrl, profileId: profile.id });

            const navigationPromise = page.goto(targetUrl, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            await navigationPromise;

            // Check if this is a pre-placed ad site
            const hasPrePlacedAds = this.prePlacedAdService.hasPrePlacedAds(url);
            logger.info('Pre-placed ad check', { visitId, url, hasPrePlacedAds });

            let adInitResult = {};
            if (hasPrePlacedAds) {
                // Handle pre-placed ads (your own Next.js sites)
                adInitResult = await this.prePlacedAdService.interactWithPrePlacedAds(page, profile);
                logger.info('Pre-placed ads interaction completed', { visitId, adInitResult });
            } else {
                // Initialize ad networks on the page (inject ad code)
                adInitResult = await this.adInteractionService.initializeAdNetworks(page, profile);
                logger.info('Ad networks initialized', { visitId, adInitResult });
            }

            // Navigate through multiple pages within the website
            const navigationResult = await this.websiteNavigationService.navigateWebsite(
                page,
                targetUrl,
                profile.id,
                profile.category
            );

            // Simulate human behavior on each page
            let totalBehaviorTime = 0;
            let totalAdInteractions = 0;
            const pageResults = [];

            for (const pageVisit of navigationResult.pagesVisited) {
                // Simulate human behavior on current page
                const behaviorResult = await humanBehavior.simulatePageInteraction(page, profile, page.url());

                // Detect and interact with ads
                const adResult = await this.adInteractionService.detectAndInteractWithAds(page, profile);

                if (adResult.interacted) {
                    totalAdInteractions++;
                }

                pageResults.push({
                    url: pageVisit.url,
                    title: pageVisit.title,
                    timeSpent: pageVisit.timeSpent,
                    behaviorResult,
                    adResult
                });

                totalBehaviorTime += behaviorResult.totalTime || 0;

                // Wait between page interactions
                await page.waitForTimeout(this.randomBetween(1000, 3000));
            }

            // Check if user should bounce
            const shouldBounce = humanBehavior.shouldBounce(profile);
            
            const endTime = Date.now();
            const totalDuration = endTime - startTime;

            // Collect cookies and storage
            const cookies = await page.context().cookies();
            const localStorage = await page.evaluate(() => {
                const data = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    data[key] = localStorage.getItem(key);
                }
                return data;
            });

            // Store session data
            sessionStateManager.storeSessionCookies(session.id, cookies);
            sessionStateManager.storeSessionStorage(session.id, 'localStorage', localStorage);

            const visitResult = {
                success: true,
                duration: totalDuration,
                url: targetUrl,
                profileId: profile.id,
                profileCategory: profile.category,
                sessionId: session.id,
                fingerprintId: fingerprint.id,

                // Navigation data
                navigationResult,
                pagesVisited: navigationResult.pagesVisited.length,
                internalLinksFollowed: navigationResult.internalLinksFollowed,
                externalLinksFollowed: navigationResult.externalLinksFollowed,

                // Ad interaction data
                adInitialization: adInitResult,
                totalAdInteractions,
                pageResults,

                // Behavior data
                totalBehaviorTime,
                bounced: shouldBounce,

                // Page data
                pageTitle: await page.title(),
                finalUrl: page.url(),
                responseStatus: 200, // Simplified
                cookies: cookies.length,
                storageItems: Object.keys(localStorage).length,
                timestamp: new Date().toISOString()
            };

            return visitResult;

        } catch (error) {
            const endTime = Date.now();
            const totalDuration = endTime - startTime;

            logger.error('Visit execution failed', {
                visitId,
                url,
                profileId: profile.id,
                error: error.message,
                duration: totalDuration
            });

            return {
                success: false,
                duration: totalDuration,
                url,
                profileId: profile.id,
                profileCategory: profile.category,
                sessionId: session.id,
                error: error.message,
                timestamp: new Date().toISOString()
            };

        } finally {
            // Cleanup
            try {
                if (page) {
                    await page.close();
                }
                if (browser) {
                    // Save isolated storage before closing browser
                    if (profile?.isolationLevel === 'strict') {
                        await this.itBrowserAPI.saveIsolatedStorage(browser.id, profile);
                    }

                    sessionStateManager.unregisterBrowserInstance(session.id, browser.id);
                    await this.itBrowserAPI.closeBrowser(browser.id);
                }
            } catch (cleanupError) {
                logger.warn('Cleanup error after visit', {
                    visitId,
                    error: cleanupError.message
                });
            }
        }
    }

    /**
     * Perform batch visits
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async performBatchVisits(req, res) {
        try {
            const { urls, profileCategories, sessionDuration, options = {} } = req.body;

            if (!urls || !Array.isArray(urls) || urls.length === 0) {
                return res.status(400).json({
                    error: 'Missing or invalid urls array'
                });
            }

            if (urls.length > 50) {
                return res.status(400).json({
                    error: 'Maximum 50 URLs allowed per batch'
                });
            }

            const batchId = uuidv4();
            const results = [];

            logger.info('Starting batch visit', { batchId, urlCount: urls.length });

            for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                const profileCategory = profileCategories?.[i] || null;

                try {
                    // Simulate individual visit request
                    const mockReq = {
                        body: {
                            url,
                            profileCategory,
                            sessionDuration,
                            options
                        }
                    };

                    const mockRes = {
                        json: (data) => data,
                        status: (code) => ({ json: (data) => ({ ...data, statusCode: code }) })
                    };

                    const result = await new Promise((resolve) => {
                        this.performVisit(mockReq, {
                            json: resolve,
                            status: (code) => ({ json: (data) => resolve({ ...data, statusCode: code }) })
                        });
                    });

                    results.push(result);

                    // Add delay between visits to avoid detection
                    if (i < urls.length - 1) {
                        const delay = config.getRandomDelay(1000, 3000);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                } catch (error) {
                    results.push({
                        success: false,
                        url,
                        error: error.message
                    });
                }
            }

            const successful = results.filter(r => r.success).length;
            const failed = results.length - successful;

            logger.info('Batch visit completed', {
                batchId,
                total: results.length,
                successful,
                failed
            });

            res.json({
                success: true,
                batchId,
                summary: {
                    total: results.length,
                    successful,
                    failed,
                    successRate: (successful / results.length * 100).toFixed(2) + '%'
                },
                results
            });

        } catch (error) {
            logger.error('Batch visit failed', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get visit history
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getVisitHistory(req, res) {
        try {
            const { limit = 100, offset = 0, profileId, success } = req.query;
            
            let filteredHistory = [...this.visitHistory];

            // Apply filters
            if (profileId) {
                filteredHistory = filteredHistory.filter(visit => visit.profileId === profileId);
            }

            if (success !== undefined) {
                const successFilter = success === 'true';
                filteredHistory = filteredHistory.filter(visit => visit.success === successFilter);
            }

            // Apply pagination
            const startIndex = parseInt(offset);
            const endIndex = startIndex + parseInt(limit);
            const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: paginatedHistory,
                pagination: {
                    total: filteredHistory.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: endIndex < filteredHistory.length
                }
            });

        } catch (error) {
            logger.error('Failed to get visit history', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get visit statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getVisitStats(req, res) {
        try {
            const activeVisitsCount = this.activeVisits.size;
            const recentVisits = this.visitHistory.slice(0, 100);
            
            // Calculate recent success rate
            const recentSuccessful = recentVisits.filter(v => v.success).length;
            const recentSuccessRate = recentVisits.length > 0 ? 
                (recentSuccessful / recentVisits.length * 100).toFixed(2) : 0;

            // Calculate average duration for recent visits
            const recentDurations = recentVisits.map(v => v.duration).filter(d => d);
            const avgRecentDuration = recentDurations.length > 0 ?
                recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length : 0;

            res.json({
                success: true,
                stats: {
                    ...this.visitStats,
                    active: activeVisitsCount,
                    recent: {
                        total: recentVisits.length,
                        successful: recentSuccessful,
                        successRate: recentSuccessRate + '%',
                        avgDuration: Math.round(avgRecentDuration)
                    }
                }
            });

        } catch (error) {
            logger.error('Failed to get visit stats', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Update visit statistics
     * @param {Object} visitResult - Visit result data
     */
    updateVisitStats(visitResult) {
        this.visitStats.total++;
        
        if (visitResult.success) {
            this.visitStats.successful++;
        } else {
            this.visitStats.failed++;
        }

        // Update category usage
        if (visitResult.profileCategory) {
            this.visitStats.categoriesUsed[visitResult.profileCategory]++;
        }

        // Update average duration
        if (visitResult.duration) {
            const totalDuration = this.visitStats.avgDuration * (this.visitStats.total - 1) + visitResult.duration;
            this.visitStats.avgDuration = totalDuration / this.visitStats.total;
        }

        // Update ad interaction stats
        if (visitResult.totalAdInteractions) {
            this.visitStats.adInteractions += visitResult.totalAdInteractions;
        }

        // Update pages per visit stats
        if (visitResult.pagesVisited) {
            const totalPages = this.visitStats.pagesPerVisit * (this.visitStats.total - 1) + visitResult.pagesVisited;
            this.visitStats.pagesPerVisit = totalPages / this.visitStats.total;
        }
    }

    /**
     * Get ad network statistics
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getAdStats(req, res) {
        try {
            const adNetworkStats = this.adInteractionService.adNetworkService.getStats();
            const adInteractionStats = this.adInteractionService.adClickStats;

            res.json({
                success: true,
                data: {
                    adNetworkStats,
                    adInteractionStats,
                    summary: {
                        totalImpressions: adNetworkStats.totalImpressions,
                        totalClicks: adNetworkStats.totalClicks,
                        overallCTR: adNetworkStats.overallCTR,
                        totalRevenue: Object.values(adNetworkStats.networkStats)
                            .reduce((sum, network) => sum + network.revenue, 0).toFixed(4),
                        topPerformingNetwork: this.getTopPerformingNetwork(adNetworkStats.networkStats),
                        topPerformingFormat: this.getTopPerformingFormat(adNetworkStats.formatStats)
                    }
                }
            });

        } catch (error) {
            logger.error('Failed to get ad stats', { error: error.message });
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Get top performing network by revenue
     * @param {Object} networkStats - Network statistics
     * @returns {string} Top performing network
     */
    getTopPerformingNetwork(networkStats) {
        let topNetwork = 'none';
        let maxRevenue = 0;

        for (const [network, stats] of Object.entries(networkStats)) {
            if (stats.revenue > maxRevenue) {
                maxRevenue = stats.revenue;
                topNetwork = network;
            }
        }

        return topNetwork;
    }

    /**
     * Get top performing format by clicks
     * @param {Object} formatStats - Format statistics
     * @returns {string} Top performing format
     */
    getTopPerformingFormat(formatStats) {
        let topFormat = 'none';
        let maxClicks = 0;

        for (const [format, stats] of Object.entries(formatStats)) {
            if (stats.clicks > maxClicks) {
                maxClicks = stats.clicks;
                topFormat = format;
            }
        }

        return topFormat;
    }

    /**
     * Generate random number between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} Is valid URL
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = VisitController;
