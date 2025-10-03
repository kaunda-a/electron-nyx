const config = require('../../../shared/config/config');
const logger = require('../../../shared/utils/logger');
const AdNetworkService = require('./adNetworkService');
const LLMService = require('./llmService');

/**
 * Advanced Ad Interaction Service
 * Handles intelligent ad detection, clicking, and interaction with new tabs
 */
class AdInteractionService {
    constructor() {
        this.config = config.adInteraction;
        this.adNetworkService = new AdNetworkService();
        this.llmService = new LLMService();
        this.activeInteractions = new Map();
        this.adClickStats = {
            totalClicks: 0,
            successfulClicks: 0,
            newTabsOpened: 0,
            returnedToOriginal: 0,
            networkClicks: {
                adsense: 0,
                monetag: 0,
                adsterra: 0,
                popads: 0,
                hilltopads: 0
            },
            formatClicks: {
                pushNotifications: 0,
                inPagePush: 0,
                popunder: 0,
                directLink: 0,
                interstitial: 0,
                native: 0,
                banner: 0,
                video: 0
            }
        };
    }

    /**
     * Initialize ad networks on page load
     * @param {Object} page - Playwright page object
     * @param {Object} profile - Profile object
     * @returns {Object} Initialization result
     */
    async initializeAdNetworks(page, profile) {
        try {
            // Select optimal ad configuration for this profile
            const adConfig = this.adNetworkService.selectOptimalAdConfiguration(
                profile,
                profile.geographic?.country || 'US',
                profile.category
            );

            logger.info('Selected ad configuration', {
                profileId: profile.id,
                network: adConfig.network,
                format: adConfig.format,
                country: profile.geographic?.country
            });

            // Generate and inject ad network code
            const adCode = this.adNetworkService.generateAdImplementationCode(adConfig, profile);

            if (adCode) {
                await page.evaluate((code) => {
                    try {
                        eval(code);
                        return true;
                    } catch (error) {
                        console.error('Ad injection error:', error);
                        return false;
                    }
                }, adCode);

                // Track impression
                this.adNetworkService.trackImpression(adConfig.network, adConfig.format, profile);

                return {
                    success: true,
                    network: adConfig.network,
                    format: adConfig.format,
                    injected: true
                };
            }

            return { success: false, reason: 'No ad code generated' };

        } catch (error) {
            logger.error('Error initializing ad networks', {
                error: error.message,
                profileId: profile.id
            });
            return { success: false, error: error.message };
        }
    }

    /**
     * Detect and interact with ads on the current page
     * @param {Object} page - Playwright page object
     * @param {Object} profile - Profile object with full profile data
     * @returns {Object} Interaction results
     */
    async detectAndInteractWithAds(page, profile) {
        if (!this.config.enabled) {
            return { interacted: false, reason: 'Ad interaction disabled' };
        }

        try {
            // Wait for page to stabilize
            await page.waitForTimeout(this.randomBetween(1000, 3000));

            // Detect ads on the page
            const ads = await this.detectAds(page);

            if (ads.length === 0) {
                return { interacted: false, reason: 'No ads detected' };
            }

            logger.info(`Detected ${ads.length} ads on page`, { profileId: profile.id });

            // Decide whether to interact with ads based on profile behavior
            const clickProbability = this.getProfileClickProbability(profile.category);
            if (Math.random() > clickProbability) {
                return { interacted: false, reason: 'Random decision not to click' };
            }

            // Select a random ad to interact with
            const selectedAd = ads[Math.floor(Math.random() * ads.length)];

            return await this.interactWithAd(page, selectedAd, profile);

        } catch (error) {
            logger.error('Error in ad interaction', { error: error.message, profileId: profile.id });
            return { interacted: false, error: error.message };
        }
    }

    /**
     * Get click probability based on profile category
     * @param {string} profileCategory - Profile category
     * @returns {number} Click probability (0-1)
     */
    getProfileClickProbability(profileCategory) {
        const baseProbability = this.config.clickProbability;

        switch (profileCategory) {
            case 'loyalUser':
                return baseProbability * 0.8; // More cautious
            case 'returningRegular':
                return baseProbability;
            case 'newVisitor':
                return baseProbability * 1.3; // More likely to click
            default:
                return baseProbability;
        }
    }

    /**
     * Detect ads on the current page
     * @param {Object} page - Playwright page object
     * @returns {Array} Array of ad elements
     */
    async detectAds(page) {
        const ads = [];

        for (const selector of this.config.selectors) {
            try {
                const elements = await page.$(selector);
                for (const element of elements) {
                    // Check if element is visible and clickable
                    const isVisible = await element.isVisible();
                    const boundingBox = await element.boundingBox();
                    
                    if (isVisible && boundingBox && boundingBox.width > 50 && boundingBox.height > 50) {
                        // Get ad content for LLM analysis
                        let adContent = '';
                        try {
                            adContent = await element.textContent() || '';
                            // Also get inner HTML for more detailed analysis
                            const innerHTML = await element.innerHTML();
                            adContent += ' ' + innerHTML;
                        } catch (e) {
                            // Continue with text content only
                        }
                        
                        // Use LLM to classify the ad if service is configured
                        let llmClassification = null;
                        if (this.llmService.isGoogleConfigured()) {
                            try {
                                llmClassification = await this.llmService.classifyAdContent(adContent.substring(0, 1000));
                            } catch (llmError) {
                                logger.warn('LLM ad classification failed', { error: llmError.message });
                            }
                        }
                        
                        ads.push({
                            element,
                            selector,
                            boundingBox,
                            type: this.classifyAdType(selector),
                            llmClassification,
                            contentPreview: adContent.substring(0, 100)
                        });
                    }
                }
            } catch (error) {
                // Continue if selector fails
                continue;
            }
        }

        return ads;
    }

    /**
     * Classify ad type based on selector
     * @param {string} selector - CSS selector
     * @returns {string} Ad type
     */
    classifyAdType(selector) {
        if (selector.includes('iframe')) return 'iframe';
        if (selector.includes('video')) return 'video';
        if (selector.includes('popup')) return 'popup';
        if (selector.includes('banner')) return 'banner';
        return 'display';
    }

    /**
     * Interact with a specific ad
     * @param {Object} page - Playwright page object
     * @param {Object} ad - Ad object with element and metadata
     * @param {Object} profile - Profile object
     * @returns {Object} Interaction result
     */
    async interactWithAd(page, ad, profile) {
        try {
            const originalUrl = page.url();
            const originalPageCount = (await page.context().pages()).length;

            // Use LLM classification to determine interaction strategy if available
            let interactionStrategy = 'standard';
            let riskScore = 50; // Default risk score
            
            if (ad.llmClassification) {
                interactionStrategy = ad.llmClassification.interactionStrategy || 'standard';
                riskScore = ad.llmClassification.riskScore || 50;
                
                // Adjust interaction based on risk score
                if (riskScore > 80) {
                    // High risk - reduce interaction probability
                    if (Math.random() > 0.3) {
                        logger.info('Skipping high-risk ad interaction', {
                            profileId: profile.id,
                            riskScore,
                            adType: ad.llmClassification.type
                        });
                        return { interacted: false, reason: 'High risk ad - skipped' };
                    }
                } else if (riskScore < 20) {
                    // Low risk - increase interaction probability
                    logger.info('Low-risk ad detected, proceeding with interaction', {
                        profileId: profile.id,
                        riskScore,
                        adType: ad.llmClassification.type
                    });
                }
            }

            // Hover before clicking (if configured)
            if (Math.random() < this.config.hoverBeforeClickProbability) {
                await this.simulateHover(page, ad.element);
                await page.waitForTimeout(this.randomBetween(500, 2000));
            }

            // Simulate human-like clicking
            await this.simulateHumanClick(page, ad.element);

            // Determine ad network and format from the ad element
            const adNetwork = this.detectAdNetwork(ad);
            const estimatedRevenue = this.estimateRevenue(adNetwork, profile.geographic?.country);

            this.adClickStats.totalClicks++;
            this.adClickStats.networkClicks[adNetwork]++;
            this.adClickStats.formatClicks[ad.type]++;

            // Track click in ad network service
            this.adNetworkService.trackClick(adNetwork, ad.type, profile, estimatedRevenue);

            logger.info('Clicked on ad', {
                profileId: profile.id,
                adType: ad.type,
                selector: ad.selector,
                network: adNetwork,
                estimatedRevenue,
                llmClassification: ad.llmClassification ? {
                    type: ad.llmClassification.type,
                    category: ad.llmClassification.category,
                    interestLevel: ad.llmClassification.interestLevel,
                    riskScore: ad.llmClassification.riskScore
                } : null
            });

            // Wait for potential page changes
            await page.waitForTimeout(this.randomBetween(1000, 3000));

            // Check if new tab/window opened
            const newPageCount = (await page.context().pages()).length;

            if (newPageCount > originalPageCount) {
                return await this.handleNewTab(page, profile.id, originalUrl, adNetwork, ad.type);
            }

            // Check if current page changed
            const currentUrl = page.url();
            if (currentUrl !== originalUrl) {
                return await this.handlePageRedirect(page, profile.id, originalUrl, adNetwork, ad.type);
            }

            this.adClickStats.successfulClicks++;
            return {
                interacted: true,
                type: 'same_page',
                adType: ad.type,
                network: adNetwork,
                estimatedRevenue,
                llmClassification: ad.llmClassification
            };

        } catch (error) {
            logger.error('Error interacting with ad', { error: error.message, profileId: profile.id });
            return { interacted: false, error: error.message };
        }
    }

    /**
     * Detect ad network from ad element
     * @param {Object} ad - Ad object
     * @returns {string} Detected network name
     */
    detectAdNetwork(ad) {
        const selector = ad.selector.toLowerCase();
        const element = ad.element;

        // Check for network-specific indicators
        if (selector.includes('adsbygoogle') || selector.includes('googlesyndication') ||
            selector.includes('google_ads') || selector.includes('adsense')) {
            return 'adsense';
        }
        if (selector.includes('monetag') || selector.includes('popunder')) {
            return 'monetag';
        }
        if (selector.includes('adsterra') || selector.includes('adtng')) {
            return 'adsterra';
        }
        if (selector.includes('popads')) {
            return 'popads';
        }
        if (selector.includes('hilltop')) {
            return 'hilltopads';
        }

        // Fallback to primary network
        return config.adNetworks.primary;
    }

    /**
     * Estimate revenue from ad click
     * @param {string} network - Ad network
     * @param {string} country - Country code
     * @returns {number} Estimated revenue in USD
     */
    estimateRevenue(network, country = 'US') {
        const isTopTier = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK'].includes(country);

        // Base CPM rates (estimated)
        const baseCPM = {
            adsense: isTopTier ? 4.5 : 1.2,  // Higher rates for AdSense
            monetag: isTopTier ? 2.5 : 0.8,
            adsterra: isTopTier ? 2.2 : 0.7,
            popads: isTopTier ? 1.8 : 0.5,
            hilltopads: isTopTier ? 1.5 : 0.4
        };

        // Convert CPM to per-click estimate (assuming 1% CTR)
        const estimatedCPC = (baseCPM[network] || 1.0) / 10;

        // Add some randomness
        return estimatedCPC * (0.8 + Math.random() * 0.4);
    }

    /**
     * Handle new tab opened by ad click
     * @param {Object} originalPage - Original page object
     * @param {string} profileId - Profile identifier
     * @param {string} originalUrl - Original page URL
     * @returns {Object} Interaction result
     */
    async handleNewTab(originalPage, profileId, originalUrl) {
        if (!this.config.newTabInteractionEnabled) {
            return { interacted: true, type: 'new_tab_ignored' };
        }

        try {
            const context = originalPage.context();
            const pages = await context.pages();
            const newPage = pages[pages.length - 1]; // Get the newest page

            this.adClickStats.newTabsOpened++;
            logger.info('New tab opened by ad click', { profileId });

            // Interact with the new tab
            await newPage.bringToFront();
            await newPage.waitForLoadState('domcontentloaded');
            
            // Simulate browsing in the new tab
            const interactionTime = this.randomBetween(
                this.config.newTabMinTime, 
                this.config.newTabMaxTime
            );
            
            await this.simulateBrowsingInNewTab(newPage, interactionTime);

            // Decide whether to return to original tab
            if (Math.random() < this.config.returnToOriginalTabProbability) {
                await originalPage.bringToFront();
                this.adClickStats.returnedToOriginal++;
                
                // Close the ad tab if configured
                if (Math.random() < this.config.closeAdTabProbability) {
                    await newPage.close();
                }
                
                return { 
                    interacted: true, 
                    type: 'new_tab_returned', 
                    interactionTime,
                    returnedToOriginal: true
                };
            }

            return { 
                interacted: true, 
                type: 'new_tab_stayed', 
                interactionTime,
                returnedToOriginal: false
            };

        } catch (error) {
            logger.error('Error handling new tab', { error: error.message, profileId });
            return { interacted: false, error: error.message };
        }
    }

    /**
     * Handle page redirect from ad click
     * @param {Object} page - Page object
     * @param {string} profileId - Profile identifier
     * @param {string} originalUrl - Original page URL
     * @returns {Object} Interaction result
     */
    async handlePageRedirect(page, profileId, originalUrl) {
        try {
            logger.info('Page redirected by ad click', { 
                profileId, 
                from: originalUrl, 
                to: page.url() 
            });

            // Simulate browsing on the redirected page
            const interactionTime = this.randomBetween(
                this.config.minInteractionTime,
                this.config.maxInteractionTime
            );

            await this.simulateBrowsingBehavior(page, interactionTime);

            // Decide whether to go back
            if (Math.random() < this.config.returnToOriginalTabProbability) {
                await page.goBack();
                await page.waitForLoadState('domcontentloaded');
                
                return { 
                    interacted: true, 
                    type: 'redirect_returned', 
                    interactionTime,
                    returnedToOriginal: true
                };
            }

            return { 
                interacted: true, 
                type: 'redirect_stayed', 
                interactionTime,
                returnedToOriginal: false
            };

        } catch (error) {
            logger.error('Error handling page redirect', { error: error.message, profileId });
            return { interacted: false, error: error.message };
        }
    }

    /**
     * Simulate human-like hover behavior
     * @param {Object} page - Page object
     * @param {Object} element - Element to hover
     */
    async simulateHover(page, element) {
        const boundingBox = await element.boundingBox();
        if (boundingBox) {
            // Move to a random point within the element
            const x = boundingBox.x + Math.random() * boundingBox.width;
            const y = boundingBox.y + Math.random() * boundingBox.height;
            
            await page.mouse.move(x, y, { steps: this.randomBetween(5, 15) });
            await page.waitForTimeout(this.randomBetween(200, 800));
        }
    }

    /**
     * Simulate human-like clicking
     * @param {Object} page - Page object
     * @param {Object} element - Element to click
     */
    async simulateHumanClick(page, element) {
        const boundingBox = await element.boundingBox();
        if (boundingBox) {
            // Click at a random point within the element
            const x = boundingBox.x + Math.random() * boundingBox.width;
            const y = boundingBox.y + Math.random() * boundingBox.height;
            
            await page.mouse.click(x, y, { 
                delay: this.randomBetween(50, 150),
                button: 'left'
            });
        }
    }

    /**
     * Simulate browsing behavior in new tab
     * @param {Object} page - Page object
     * @param {number} duration - Duration in milliseconds
     */
    async simulateBrowsingInNewTab(page, duration) {
        const endTime = Date.now() + duration;
        
        while (Date.now() < endTime) {
            // Random actions: scroll, move mouse, wait
            const action = Math.random();
            
            if (action < 0.4) {
                // Scroll
                await page.mouse.wheel(0, this.randomBetween(-300, 300));
            } else if (action < 0.7) {
                // Move mouse randomly
                await page.mouse.move(
                    this.randomBetween(100, 800),
                    this.randomBetween(100, 600),
                    { steps: this.randomBetween(3, 10) }
                );
            }
            
            await page.waitForTimeout(this.randomBetween(1000, 3000));
        }
    }

    /**
     * Simulate browsing behavior on current page
     * @param {Object} page - Page object
     * @param {number} duration - Duration in milliseconds
     */
    async simulateBrowsingBehavior(page, duration) {
        const endTime = Date.now() + duration;
        
        while (Date.now() < endTime) {
            const action = Math.random();
            
            if (action < 0.5) {
                await page.mouse.wheel(0, this.randomBetween(-200, 400));
            } else if (action < 0.8) {
                await page.mouse.move(
                    this.randomBetween(100, 800),
                    this.randomBetween(100, 600),
                    { steps: this.randomBetween(2, 8) }
                );
            }
            
            await page.waitForTimeout(this.randomBetween(800, 2500));
        }
    }

    /**
     * Simulate dwell time after ad interaction
     * @param {Object} page - Page object
     * @returns {number} Dwell time in milliseconds
     */
    async simulateDwellTime(page) {
        const dwellTime = this.randomBetween(this.config.minDwellTime, this.config.maxDwellTime);
        
        // Simulate reading/viewing behavior
        for (let i = 0; i < 3; i++) {
            await page.mouse.wheel(0, this.randomBetween(-100, 200));
            await page.waitForTimeout(dwellTime / 3);
        }
        
        return dwellTime;
    }

    /**
     * Get random number between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    randomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Get ad interaction statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.adClickStats,
            clickRate: this.adClickStats.totalClicks > 0 ? 
                (this.adClickStats.successfulClicks / this.adClickStats.totalClicks) : 0,
            returnRate: this.adClickStats.newTabsOpened > 0 ? 
                (this.adClickStats.returnedToOriginal / this.adClickStats.newTabsOpened) : 0
        };
    }
}

module.exports = AdInteractionService;
