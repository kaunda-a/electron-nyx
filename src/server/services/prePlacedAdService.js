/**
 * Pre-Placed Ad Service
 * Handles websites with pre-placed ad tags (user's own Next.js sites)
 */

const config = require('../utils/config');

class PrePlacedAdService {
    constructor() {
        this.config = config;
    }

    /**
     * Check if website has pre-placed ad tags
     * @param {string} url - Website URL
     * @returns {boolean} True if website has pre-placed ads
     */
    hasPrePlacedAds(url) {
        return this.config.websites.prePlacedAdSites.some(site => 
            url.includes(site) || site.includes(url.replace(/^https?:\/\//, ''))
        );
    }

    /**
     * Handle interaction with pre-placed ads
     * @param {Object} page - Playwright page object
     * @param {Object} profile - Profile object
     * @returns {Object} Interaction results
     */
    async interactWithPrePlacedAds(page, profile) {
        const results = {
            adsFound: 0,
            adsClicked: 0,
            adTypes: [],
            revenue: 0,
            interactions: []
        };

        try {
            // Wait for page to load completely
            await page.waitForLoadState('networkidle');
            await this.randomDelay(2000, 5000);

            // Detect common ad containers and elements
            const adSelectors = [
                // Google AdSense
                '.adsbygoogle',
                'ins.adsbygoogle',
                
                // Adsterra
                '[data-cfasync="false"]',
                'script[src*="adsterra"]',
                'script[src*="profitableratecpm"]',
                
                // Monetag
                'script[src*="monetag"]',
                'script[src*="push.monetag"]',
                
                // PopAds
                'script[src*="popads"]',
                'script[src*="c1.popads"]',
                
                // Generic ad containers
                '.ad-container',
                '.advertisement',
                '.ads',
                '[class*="ad-"]',
                '[id*="ad-"]',
                
                // Banner ads
                'iframe[src*="ads"]',
                'iframe[src*="doubleclick"]',
                
                // Native ads
                '.native-ad',
                '.sponsored-content'
            ];

            // Check for ad elements
            for (const selector of adSelectors) {
                try {
                    const elements = await page.$$(selector);
                    if (elements.length > 0) {
                        results.adsFound += elements.length;
                        
                        // Determine ad type
                        let adType = 'unknown';
                        if (selector.includes('adsterra') || selector.includes('profitableratecpm')) {
                            adType = 'adsterra';
                        } else if (selector.includes('monetag')) {
                            adType = 'monetag';
                        } else if (selector.includes('popads')) {
                            adType = 'popads';
                        } else if (selector.includes('adsbygoogle')) {
                            adType = 'adsense';
                        } else if (selector.includes('iframe')) {
                            adType = 'banner';
                        } else if (selector.includes('native')) {
                            adType = 'native';
                        }
                        
                        if (!results.adTypes.includes(adType)) {
                            results.adTypes.push(adType);
                        }

                        // Simulate realistic ad interaction
                        await this.simulateAdInteraction(page, elements, profile, results);
                    }
                } catch (error) {
                    console.log(`Error checking selector ${selector}:`, error.message);
                }
            }

            // Check for popunder/popup triggers
            await this.handlePopupAds(page, profile, results);

            // Simulate natural browsing behavior
            await this.simulateNaturalBrowsing(page, profile);

        } catch (error) {
            console.error('Error in pre-placed ad interaction:', error);
        }

        return results;
    }

    /**
     * Simulate realistic ad interaction
     */
    async simulateAdInteraction(page, elements, profile, results) {
        const clickProbability = this.getClickProbability(profile.category);
        
        for (let i = 0; i < Math.min(elements.length, 3); i++) {
            try {
                const element = elements[i];
                
                // Check if element is visible and clickable
                const isVisible = await element.isVisible();
                if (!isVisible) continue;

                // Hover over ad (realistic behavior)
                await element.hover();
                await this.randomDelay(1000, 3000);

                // Decide whether to click
                if (Math.random() < clickProbability) {
                    // Get element position for realistic clicking
                    const box = await element.boundingBox();
                    if (box) {
                        // Click with slight randomization
                        const x = box.x + box.width * (0.3 + Math.random() * 0.4);
                        const y = box.y + box.height * (0.3 + Math.random() * 0.4);
                        
                        await page.mouse.click(x, y);
                        results.adsClicked++;
                        
                        // Handle new tabs/popups
                        await this.handleNewTabs(page);
                        
                        // Estimate revenue
                        results.revenue += this.estimateRevenue(profile.geographic?.country);
                        
                        results.interactions.push({
                            type: 'click',
                            timestamp: new Date().toISOString(),
                            element: await element.getAttribute('class') || 'unknown'
                        });
                    }
                }
            } catch (error) {
                console.log('Error interacting with ad element:', error.message);
            }
        }
    }

    /**
     * Handle popup/popunder ads
     */
    async handlePopupAds(page, profile, results) {
        // Listen for new pages (popups)
        const context = page.context();
        
        context.on('page', async (newPage) => {
            try {
                await newPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
                
                // Simulate brief interaction with popup
                await this.randomDelay(2000, 5000);
                
                // Close popup after realistic delay
                await newPage.close();
                
                results.interactions.push({
                    type: 'popup',
                    timestamp: new Date().toISOString(),
                    action: 'opened_and_closed'
                });
                
                // Estimate popup revenue
                results.revenue += this.estimateRevenue(profile.geographic?.country) * 0.5;
                
            } catch (error) {
                console.log('Error handling popup:', error.message);
            }
        });
    }

    /**
     * Simulate natural browsing behavior
     */
    async simulateNaturalBrowsing(page, profile) {
        // Random scrolling
        const scrollCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < scrollCount; i++) {
            await page.mouse.wheel(0, 200 + Math.random() * 300);
            await this.randomDelay(1000, 3000);
        }

        // Random mouse movements
        const moveCount = 3 + Math.floor(Math.random() * 5);
        for (let i = 0; i < moveCount; i++) {
            await page.mouse.move(
                Math.random() * 800,
                Math.random() * 600
            );
            await this.randomDelay(500, 1500);
        }
    }

    /**
     * Handle new tabs opened by ads
     */
    async handleNewTabs(page) {
        const context = page.context();
        const pages = context.pages();
        
        if (pages.length > 1) {
            // Focus on new tab
            const newTab = pages[pages.length - 1];
            await newTab.bringToFront();
            
            // Simulate brief interaction
            await this.randomDelay(3000, 8000);
            
            // Close new tab and return to original
            await newTab.close();
            await page.bringToFront();
        }
    }

    /**
     * Get click probability based on profile category
     */
    getClickProbability(category) {
        switch (category) {
            case 'newVisitor': return 0.25;
            case 'returningRegular': return 0.15;
            case 'loyalUser': return 0.08;
            default: return 0.15;
        }
    }

    /**
     * Estimate revenue per click based on country
     */
    estimateRevenue(country) {
        const tierRates = {
            'US': 0.15, 'UK': 0.12, 'CA': 0.10, 'AU': 0.09,
            'DE': 0.08, 'FR': 0.07, 'NL': 0.07, 'SE': 0.06,
            'NO': 0.06, 'DK': 0.06
        };
        
        return tierRates[country] || 0.02;
    }

    /**
     * Random delay helper
     */
    async randomDelay(min, max) {
        const delay = min + Math.random() * (max - min);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

module.exports = PrePlacedAdService;
