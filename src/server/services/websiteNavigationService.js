const config = require('../utils/config');
const logger = require('../utils/logger');
const LLMService = require('./llmService');

/**
 * Enhanced Website Navigation Service
 * Handles intelligent navigation within target websites
 */
class WebsiteNavigationService {
    constructor() {
        this.config = config.websites;
        this.llmService = new LLMService();
        this.navigationStats = {
            totalNavigations: 0,
            internalLinksFollowed: 0,
            externalLinksFollowed: 0,
            pagesVisitedPerSession: []
        };
    }

    /**
     * Select a target website for the profile
     * @param {string} profileCategory - Profile category (newVisitor, returningRegular, loyalUser)
     * @returns {string} Selected website URL
     */
    selectTargetWebsite(profileCategory) {
        if (!this.config.rotationEnabled) {
            return this.config.targets[0];
        }

        // Different selection strategies based on profile category
        switch (profileCategory) {
            case 'loyalUser':
                // Loyal users might have preferred sites
                return this.config.targets[Math.floor(Math.random() * Math.min(3, this.config.targets.length))];
            
            case 'returningRegular':
                // Regular users explore more variety
                return this.config.targets[Math.floor(Math.random() * this.config.targets.length)];
            
            case 'newVisitor':
            default:
                // New visitors might stick to popular/first sites
                const popularSites = this.config.targets.slice(0, Math.ceil(this.config.targets.length / 2));
                return popularSites[Math.floor(Math.random() * popularSites.length)];
        }
    }

    /**
     * Navigate through multiple pages within a website
     * @param {Object} page - Playwright page object
     * @param {string} startUrl - Starting URL
     * @param {string} profileId - Profile identifier
     * @param {string} profileCategory - Profile category
     * @returns {Object} Navigation results
     */
    async navigateWebsite(page, startUrl, profileId, profileCategory) {
        try {
            const navigationResult = {
                startUrl,
                pagesVisited: [],
                totalTime: 0,
                internalLinksFollowed: 0,
                externalLinksFollowed: 0,
                errors: []
            };

            const startTime = Date.now();
            
            // Navigate to starting URL
            await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(this.randomBetween(2000, 5000));
            
            navigationResult.pagesVisited.push({
                url: page.url(),
                title: await page.title(),
                visitTime: Date.now(),
                timeSpent: 0
            });

            // Get page content for LLM analysis (only for loyal users to save credits)
            let llmRecommendations = null;
            if (profileCategory === 'loyalUser' && this.llmService.isGoogleConfigured()) {
                try {
                    const pageContent = await page.content();
                    llmRecommendations = await this.llmService.analyzePageContent(
                        pageContent, 
                        profileCategory
                    );
                    logger.info(`LLM analysis completed for profile ${profileId}`, {
                        interestScore: llmRecommendations?.interestScore
                    });
                } catch (error) {
                    logger.error('LLM analysis failed', { 
                        error: error.message, 
                        profileId 
                    });
                }
            }

            // Determine number of pages to visit
            const pagesToVisit = this.randomBetween(
                this.config.pagesPerWebsiteMin,
                this.config.pagesPerWebsiteMax
            );

            logger.info(`Starting website navigation`, {
                profileId,
                startUrl,
                plannedPages: pagesToVisit,
                llmEnhanced: !!llmRecommendations
            });

            // Navigate through additional pages
            for (let i = 1; i < pagesToVisit; i++) {
                const pageStartTime = Date.now();
                
                const navigationAction = await this.selectNavigationAction(page, profileCategory, llmRecommendations);
                
                if (navigationAction.success) {
                    // Use LLM-recommended time on page if available
                    let timeOnPage = this.randomBetween(3000, 8000);
                    if (llmRecommendations?.timeOnPage) {
                        timeOnPage = llmRecommendations.timeOnPage;
                    }
                    await page.waitForTimeout(timeOnPage);
                    
                    const currentPage = {
                        url: page.url(),
                        title: await page.title(),
                        visitTime: Date.now(),
                        timeSpent: Date.now() - pageStartTime,
                        action: navigationAction.type
                    };
                    
                    navigationResult.pagesVisited.push(currentPage);
                    
                    if (navigationAction.type === 'internal') {
                        navigationResult.internalLinksFollowed++;
                    } else if (navigationAction.type === 'external') {
                        navigationResult.externalLinksFollowed++;
                    }
                    
                    logger.info(`Navigated to new page`, {
                        profileId,
                        url: currentPage.url,
                        action: navigationAction.type
                    });
                } else {
                    // If navigation fails, try to find alternative links
                    const alternativeAction = await this.findAlternativeNavigation(page);
                    if (!alternativeAction.success) {
                        logger.warn(`Navigation failed, ending session`, { profileId });
                        break;
                    }
                }
                
                // Update time spent on previous page
                if (navigationResult.pagesVisited.length > 1) {
                    const prevPage = navigationResult.pagesVisited[navigationResult.pagesVisited.length - 2];
                    prevPage.timeSpent = Date.now() - prevPage.visitTime;
                }
            }

            navigationResult.totalTime = Date.now() - startTime;
            this.updateNavigationStats(navigationResult);

            return navigationResult;

        } catch (error) {
            logger.error('Error in website navigation', { 
                error: error.message, 
                profileId, 
                startUrl 
            });
            return { 
                success: false, 
                error: error.message, 
                startUrl,
                pagesVisited: []
            };
        }
    }

    /**
     * Select next navigation action based on profile behavior
     * @param {Object} page - Playwright page object
     * @param {string} profileCategory - Profile category
     * @param {Object} llmRecommendations - LLM recommendations (optional)
     * @returns {Object} Navigation action result
     */
    async selectNavigationAction(page, profileCategory, llmRecommendations = null) {
        try {
            // Get available links
            const links = await this.getNavigableLinks(page);
            
            if (links.length === 0) {
                return { success: false, reason: 'No navigable links found' };
            }

            // If we have LLM recommendations, use them to guide navigation
            if (llmRecommendations && llmRecommendations.internalLinks && llmRecommendations.externalLinks) {
                // Try to find LLM-recommended internal links
                for (const recommendedUrl of llmRecommendations.internalLinks) {
                    const recommendedLink = links.find(link => 
                        link.href.includes(recommendedUrl) || 
                        recommendedUrl.includes(link.href)
                    );
                    if (recommendedLink) {
                        await this.clickLink(page, recommendedLink);
                        return { success: true, type: 'internal', link: recommendedLink };
                    }
                }
                
                // Try to find LLM-recommended external links
                for (const recommendedUrl of llmRecommendations.externalLinks) {
                    const recommendedLink = links.find(link => 
                        link.href.includes(recommendedUrl) || 
                        recommendedUrl.includes(link.href)
                    );
                    if (recommendedLink) {
                        await this.clickLink(page, recommendedLink);
                        return { success: true, type: 'external', link: recommendedLink };
                    }
                }
            }

            // Categorize links
            const internalLinks = links.filter(link => this.isInternalLink(link.href, page.url()));
            const externalLinks = links.filter(link => !this.isInternalLink(link.href, page.url()));

            // Decide navigation strategy based on profile
            const shouldFollowInternal = Math.random() < this.getInternalLinkProbability(profileCategory);
            const shouldFollowExternal = Math.random() < this.config.externalLinkFollowProbability;

            if (shouldFollowInternal && internalLinks.length > 0) {
                const selectedLink = this.selectLinkByWeight(internalLinks, profileCategory);
                await this.clickLink(page, selectedLink);
                return { success: true, type: 'internal', link: selectedLink };
            }

            if (shouldFollowExternal && externalLinks.length > 0) {
                const selectedLink = this.selectLinkByWeight(externalLinks, profileCategory);
                await this.clickLink(page, selectedLink);
                return { success: true, type: 'external', link: selectedLink };
            }

            // Fallback: scroll and stay on current page
            await this.simulatePageReading(page);
            return { success: true, type: 'scroll', action: 'page_reading' };

        } catch (error) {
            logger.error('Error in navigation action selection', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Get navigable links from the current page
     * @param {Object} page - Playwright page object
     * @returns {Array} Array of link objects
     */
    async getNavigableLinks(page) {
        try {
            return await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href]'));
                return links
                    .filter(link => {
                        const rect = link.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 0 && 
                               link.href && 
                               !link.href.startsWith('javascript:') &&
                               !link.href.startsWith('mailto:') &&
                               !link.href.startsWith('tel:');
                    })
                    .map(link => ({
                        href: link.href,
                        text: link.textContent.trim().substring(0, 100),
                        x: link.getBoundingClientRect().x,
                        y: link.getBoundingClientRect().y,
                        width: link.getBoundingClientRect().width,
                        height: link.getBoundingClientRect().height
                    }))
                    .slice(0, 50); // Limit to first 50 links for performance
            });
        } catch (error) {
            logger.error('Error getting navigable links', { error: error.message });
            return [];
        }
    }

    /**
     * Check if a link is internal to the current domain
     * @param {string} linkHref - Link URL
     * @param {string} currentUrl - Current page URL
     * @returns {boolean} True if internal link
     */
    isInternalLink(linkHref, currentUrl) {
        try {
            const linkDomain = new URL(linkHref).hostname;
            const currentDomain = new URL(currentUrl).hostname;
            return linkDomain === currentDomain;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get internal link follow probability based on profile category
     * @param {string} profileCategory - Profile category
     * @returns {number} Probability (0-1)
     */
    getInternalLinkProbability(profileCategory) {
        switch (profileCategory) {
            case 'loyalUser':
                return this.config.internalLinkFollowProbability * 1.2; // 20% higher
            case 'returningRegular':
                return this.config.internalLinkFollowProbability;
            case 'newVisitor':
                return this.config.internalLinkFollowProbability * 0.8; // 20% lower
            default:
                return this.config.internalLinkFollowProbability;
        }
    }

    /**
     * Select a link based on profile behavior patterns
     * @param {Array} links - Available links
     * @param {string} profileCategory - Profile category
     * @returns {Object} Selected link
     */
    selectLinkByWeight(links, profileCategory) {
        // Different selection strategies based on profile
        switch (profileCategory) {
            case 'loyalUser':
                // Loyal users might prefer navigation links, menus
                return this.selectPreferredLink(links, ['nav', 'menu', 'category', 'section']);
            
            case 'returningRegular':
                // Regular users explore content links
                return this.selectPreferredLink(links, ['article', 'post', 'content', 'read']);
            
            case 'newVisitor':
            default:
                // New visitors might click on prominent/first links
                return links[Math.floor(Math.random() * Math.min(5, links.length))];
        }
    }

    /**
     * Select preferred link based on text content
     * @param {Array} links - Available links
     * @param {Array} keywords - Preferred keywords
     * @returns {Object} Selected link
     */
    selectPreferredLink(links, keywords) {
        const preferredLinks = links.filter(link => 
            keywords.some(keyword => 
                link.text.toLowerCase().includes(keyword.toLowerCase())
            )
        );

        if (preferredLinks.length > 0) {
            return preferredLinks[Math.floor(Math.random() * preferredLinks.length)];
        }

        // Fallback to random selection
        return links[Math.floor(Math.random() * links.length)];
    }

    /**
     * Click on a selected link with human-like behavior
     * @param {Object} page - Playwright page object
     * @param {Object} link - Link object to click
     */
    async clickLink(page, link) {
        try {
            // Scroll link into view if needed
            await page.evaluate((linkHref) => {
                const element = document.querySelector(`a[href="${linkHref}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, link.href);

            await page.waitForTimeout(this.randomBetween(500, 1500));

            // Move mouse to link and click
            await page.mouse.move(
                link.x + link.width / 2,
                link.y + link.height / 2,
                { steps: this.randomBetween(3, 8) }
            );

            await page.waitForTimeout(this.randomBetween(200, 800));
            
            await page.mouse.click(
                link.x + link.width / 2,
                link.y + link.height / 2,
                { delay: this.randomBetween(50, 150) }
            );

            // Wait for navigation
            await page.waitForLoadState('domcontentloaded');

        } catch (error) {
            logger.error('Error clicking link', { error: error.message, link: link.href });
            throw error;
        }
    }

    /**
     * Simulate page reading behavior
     * @param {Object} page - Playwright page object
     */
    async simulatePageReading(page) {
        const readingTime = this.randomBetween(5000, 15000);
        const endTime = Date.now() + readingTime;

        while (Date.now() < endTime) {
            // Scroll down slowly
            await page.mouse.wheel(0, this.randomBetween(100, 300));
            await page.waitForTimeout(this.randomBetween(1000, 3000));

            // Occasionally scroll up (re-reading)
            if (Math.random() < 0.2) {
                await page.mouse.wheel(0, this.randomBetween(-200, -100));
                await page.waitForTimeout(this.randomBetween(500, 1500));
            }
        }
    }

    /**
     * Find alternative navigation when primary navigation fails
     * @param {Object} page - Playwright page object
     * @returns {Object} Alternative navigation result
     */
    async findAlternativeNavigation(page) {
        try {
            // Try browser back button
            if (Math.random() < 0.3) {
                await page.goBack();
                await page.waitForLoadState('domcontentloaded');
                return { success: true, type: 'back' };
            }

            // Try scrolling and staying on page
            await this.simulatePageReading(page);
            return { success: true, type: 'scroll' };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Update navigation statistics
     * @param {Object} navigationResult - Navigation result object
     */
    updateNavigationStats(navigationResult) {
        this.navigationStats.totalNavigations++;
        this.navigationStats.internalLinksFollowed += navigationResult.internalLinksFollowed;
        this.navigationStats.externalLinksFollowed += navigationResult.externalLinksFollowed;
        this.navigationStats.pagesVisitedPerSession.push(navigationResult.pagesVisited.length);
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
     * Get navigation statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const avgPagesPerSession = this.navigationStats.pagesVisitedPerSession.length > 0 ?
            this.navigationStats.pagesVisitedPerSession.reduce((a, b) => a + b, 0) / this.navigationStats.pagesVisitedPerSession.length : 0;

        return {
            ...this.navigationStats,
            averagePagesPerSession: avgPagesPerSession,
            internalLinkRate: this.navigationStats.totalNavigations > 0 ?
                this.navigationStats.internalLinksFollowed / this.navigationStats.totalNavigations : 0
        };
    }
}

module.exports = WebsiteNavigationService;
