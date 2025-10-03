const config = require('../../shared/config/config');
const logger = require('../../../shared/utils/logger');
const mouseTrackingService = require('./mouseTrackingService');

class HumanBehavior {
    constructor() {
        this.behaviorPatterns = {
            newVisitor: {
                scrollPattern: 'cautious',
                clickPattern: 'minimal',
                readingSpeed: 'fast',
                bounceRate: 0.7,
                explorationDepth: 'shallow'
            },
            returningRegular: {
                scrollPattern: 'moderate',
                clickPattern: 'selective',
                readingSpeed: 'medium',
                bounceRate: 0.35,
                explorationDepth: 'medium'
            },
            loyalUser: {
                scrollPattern: 'thorough',
                clickPattern: 'engaged',
                readingSpeed: 'slow',
                bounceRate: 0.2,
                explorationDepth: 'deep'
            }
        };
        this.mouseTrackingService = mouseTrackingService;
    }

    /**
     * Simulate human-like page interaction
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile with behavioral data
     * @param {string} url - Target URL
     * @returns {Promise<Object>} Interaction results
     */
    async simulatePageInteraction(page, profile, url) {
        try {
            const startTime = Date.now();
            const behaviorPattern = this.behaviorPatterns[profile.category];
            
            logger.info('Starting human behavior simulation', {
                profileId: profile.id,
                category: profile.category,
                url
            });

            // Wait for page load with human-like delay
            await this.waitForPageLoad(page, profile);

            // Simulate reading time based on profile
            await this.simulateReadingTime(page, profile);

            // Perform scrolling behavior
            const scrollData = await this.simulateScrolling(page, profile);

            // Simulate mouse movements
            await this.simulateMouseMovements(page, profile);

            // Perform clicks based on profile behavior
            const clickData = await this.simulateClicks(page, profile);

            // Simulate form interactions if present
            const formData = await this.simulateFormInteractions(page, profile);

            // Final reading/decision time
            await this.simulateFinalReadingTime(page, profile);

            const endTime = Date.now();
            const totalDuration = endTime - startTime;

            const interactionResults = {
                duration: totalDuration,
                scrollDepth: scrollData.maxScrollDepth,
                scrollCount: scrollData.scrollCount,
                clickCount: clickData.clickCount,
                clickTargets: clickData.targets,
                formInteractions: formData.interactions,
                mouseMovements: scrollData.mouseMovements,
                readingTime: totalDuration,
                behaviorPattern: behaviorPattern,
                success: true
            };

            logger.info('Human behavior simulation completed', {
                profileId: profile.id,
                ...interactionResults
            });

            return interactionResults;

        } catch (error) {
            logger.error('Human behavior simulation failed', {
                profileId: profile.id,
                url,
                error: error.message
            });
            
            return {
                duration: Date.now() - Date.now(),
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Wait for page load with human-like timing
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile
     */
    async waitForPageLoad(page, profile) {
        // Wait for network idle
        await page.waitForLoadState('networkidle', { timeout: 30000 });
        
        // Add human-like delay after page load
        const delay = this.getRandomDelay(
            config.behavior.pageLoadWait.min,
            config.behavior.pageLoadWait.max
        );
        
        await this.humanDelay(delay);
    }

    /**
     * Simulate reading time based on profile category
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile
     */
    async simulateReadingTime(page, profile) {
        const baseReadingTime = profile.behavioral.timeOnPage * 1000; // Convert to ms
        const variation = baseReadingTime * 0.3; // 30% variation
        
        const readingTime = baseReadingTime + (Math.random() - 0.5) * variation;
        
        // Split reading time into chunks with micro-interactions
        const chunks = Math.floor(readingTime / 3000) + 1; // 3-second chunks
        const chunkTime = readingTime / chunks;
        
        for (let i = 0; i < chunks; i++) {
            await this.humanDelay(chunkTime);
            
            // Occasional micro-movements during reading
            if (Math.random() < 0.3) {
                await this.simulateMicroMovement(page);
            }
        }
    }

    /**
     * Simulate scrolling behavior
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile
     * @returns {Promise<Object>} Scroll data
     */
    async simulateScrolling(page, profile) {
        const scrollData = {
            scrollCount: 0,
            maxScrollDepth: 0,
            mouseMovements: 0
        };

        try {
            // Get page height
            const pageHeight = await page.evaluate(() => document.body.scrollHeight);
            const viewportHeight = await page.evaluate(() => window.innerHeight);
            
            const targetScrollDepth = profile.behavioral.scrollDepth;
            const maxScroll = pageHeight * targetScrollDepth;
            
            let currentScroll = 0;
            const scrollStep = viewportHeight * 0.3; // Scroll 30% of viewport at a time
            
            while (currentScroll < maxScroll) {
                // Human-like scroll with variation
                const scrollAmount = scrollStep + (Math.random() - 0.5) * scrollStep * 0.5;
                currentScroll += scrollAmount;
                
                // Perform scroll
                await page.evaluate((scroll) => {
                    window.scrollTo({
                        top: scroll,
                        behavior: 'smooth'
                    });
                }, currentScroll);
                
                scrollData.scrollCount++;
                scrollData.maxScrollDepth = Math.max(scrollData.maxScrollDepth, currentScroll / pageHeight);
                
                // Human-like pause between scrolls
                const scrollDelay = this.getRandomDelay(
                    config.behavior.scrollDelay.min,
                    config.behavior.scrollDelay.max
                );
                await this.humanDelay(scrollDelay);
                
                // Occasional reading pause
                if (Math.random() < 0.4) {
                    await this.humanDelay(this.getRandomDelay(1000, 3000));
                }
                
                // Random mouse movement during scroll
                if (Math.random() < 0.6) {
                    await this.simulateMicroMovement(page);
                    scrollData.mouseMovements++;
                }
            }
            
        } catch (error) {
            logger.warn('Scrolling simulation error', { error: error.message });
        }

        return scrollData;
    }

    /**
     * Simulate mouse movements
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile
     */
    async simulateMouseMovements(page, profile) {
        try {
            // Get viewport size for positioning
            const viewport = await page.evaluate(() => ({
                width: window.innerWidth,
                height: window.innerHeight
            }));
            
            // Generate mouse movement pattern using LLM if available
            const pageContext = {
                url: await page.url(),
                title: await page.title(),
                viewport: viewport
            };
            
            // Try to get enhanced mouse movement pattern from LLM
            const pattern = await this.mouseTrackingService.generateMouseMovementPattern(
                pageContext, 
                profile, 
                { model: 'qwen/qwen3-coder:free' }
            );
            
            // Simulate mouse movements based on the pattern
            if (pattern) {
                await this.mouseTrackingService.simulateMouseMovements(page, pattern, viewport);
            } else {
                // Fallback to basic mouse movement simulation
                const movementCount = Math.floor(Math.random() * 5) + 2; // 2-6 movements
                
                for (let i = 0; i < movementCount; i++) {
                    await this.simulateNaturalMouseMovement(page);
                    await this.humanDelay(this.getRandomDelay(500, 2000));
                }
            }
        } catch (error) {
            logger.warn('Enhanced mouse movement simulation failed, falling back to basic', { 
                error: error.message,
                profileId: profile.id
            });
            
            // Fallback to basic mouse movement simulation
            const movementCount = Math.floor(Math.random() * 5) + 2; // 2-6 movements
            
            for (let i = 0; i < movementCount; i++) {
                await this.simulateNaturalMouseMovement(page);
                await this.humanDelay(this.getRandomDelay(500, 2000));
            }
        }
    }

    /**
     * Simulate clicks based on profile behavior
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile
     * @returns {Promise<Object>} Click data
     */
    async simulateClicks(page, profile) {
        const clickData = {
            clickCount: 0,
            targets: []
        };

        try {
            // Find clickable elements
            const clickableElements = await page.$$eval('a, button, [onclick], [role="button"]', elements => {
                return elements.map((el, index) => ({
                    index,
                    tagName: el.tagName,
                    text: el.textContent?.trim().substring(0, 50) || '',
                    href: el.href || '',
                    visible: el.offsetParent !== null
                })).filter(el => el.visible && el.text);
            });

            if (clickableElements.length === 0) {
                return clickData;
            }

            // Determine number of clicks based on profile
            const maxClicks = Math.min(
                Math.floor(profile.behavioral.clickFrequency * 2),
                clickableElements.length,
                5 // Maximum 5 clicks per page
            );

            const clickCount = Math.floor(Math.random() * maxClicks) + 1;

            for (let i = 0; i < clickCount; i++) {
                // Select random clickable element
                const targetIndex = Math.floor(Math.random() * clickableElements.length);
                const target = clickableElements[targetIndex];

                try {
                    // Move to element first
                    const element = await page.locator(`a, button, [onclick], [role="button"]`).nth(target.index);
                    await element.hover();
                    
                    // Human-like delay before click
                    await this.humanDelay(this.getRandomDelay(
                        config.behavior.clickDelay.min,
                        config.behavior.clickDelay.max
                    ));

                    // Perform click (but prevent navigation for most links)
                    if (target.tagName === 'A' && target.href) {
                        // For links, just hover and record the intent
                        clickData.targets.push({
                            type: 'link_hover',
                            text: target.text,
                            href: target.href
                        });
                    } else {
                        // For buttons and other elements, perform actual click
                        await element.click();
                        clickData.targets.push({
                            type: 'click',
                            text: target.text,
                            tagName: target.tagName
                        });
                    }

                    clickData.clickCount++;

                    // Wait after click
                    await this.humanDelay(this.getRandomDelay(1000, 3000));

                } catch (clickError) {
                    logger.debug('Click simulation error', { 
                        target: target.text,
                        error: clickError.message 
                    });
                }
            }

        } catch (error) {
            logger.warn('Click simulation error', { error: error.message });
        }

        return clickData;
    }

    /**
     * Simulate form interactions
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile
     * @returns {Promise<Object>} Form interaction data
     */
    async simulateFormInteractions(page, profile) {
        const formData = {
            interactions: []
        };

        try {
            // Find form elements
            const forms = await page.$$('form');
            
            if (forms.length === 0) {
                return formData;
            }

            // Only interact with forms occasionally and for certain profiles
            if (profile.category === 'newVisitor' && Math.random() > 0.2) {
                return formData; // New visitors rarely fill forms
            }

            if (profile.category === 'returningRegular' && Math.random() > 0.4) {
                return formData;
            }

            // For loyal users, higher chance of form interaction
            if (profile.category === 'loyalUser' && Math.random() > 0.6) {
                return formData;
            }

            // Simple form interaction simulation
            const inputs = await page.$$('input[type="text"], input[type="email"], textarea');
            
            for (let i = 0; i < Math.min(inputs.length, 2); i++) {
                const input = inputs[i];
                
                try {
                    await input.focus();
                    await this.humanDelay(500);
                    
                    // Type some placeholder text
                    await input.type('test', { delay: 100 });
                    await this.humanDelay(1000);
                    
                    // Clear it (simulating user thinking)
                    await input.fill('');
                    
                    formData.interactions.push({
                        type: 'input_interaction',
                        action: 'focus_type_clear'
                    });
                    
                } catch (inputError) {
                    logger.debug('Form interaction error', { error: inputError.message });
                }
            }

        } catch (error) {
            logger.warn('Form simulation error', { error: error.message });
        }

        return formData;
    }

    /**
     * Simulate final reading time before leaving
     * @param {Object} page - Playwright page object
     * @param {Object} profile - User profile
     */
    async simulateFinalReadingTime(page, profile) {
        const finalReadingTime = this.getRandomDelay(1000, 5000);
        await this.humanDelay(finalReadingTime);
    }

    /**
     * Simulate natural mouse movement
     * @param {Object} page - Playwright page object
     */
    async simulateNaturalMouseMovement(page) {
        try {
            const viewport = await page.evaluate(() => ({
                width: window.innerWidth,
                height: window.innerHeight
            }));
            
            // Generate more realistic mouse movements with curves and varying speeds
            const startX = Math.random() * viewport.width;
            const startY = Math.random() * viewport.height;
            const endX = Math.random() * viewport.width;
            const endY = Math.random() * viewport.height;
            
            // Calculate distance and determine number of steps
            const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            const baseSteps = Math.max(5, Math.min(20, Math.floor(distance / 20)));
            
            // Add some randomness to steps
            const steps = baseSteps + Math.floor(Math.random() * 10);
            
            // Move mouse with natural acceleration/deceleration
            await page.mouse.move(startX, startY);
            
            // Simulate movement to destination with variable speed
            for (let i = 1; i <= steps; i++) {
                // Create curved path using quadratic bezier curve
                const t = i / steps;
                
                // Add some natural deviation to the path
                const deviation = (Math.random() - 0.5) * 30;
                const curveX = startX + (endX - startX) * t + deviation;
                const curveY = startY + (endY - startY) * t + deviation;
                
                await page.mouse.move(curveX, curveY);
                
                // Variable delay to simulate human-like speed changes
                const delay = Math.random() * 50 + 10;
                await this.humanDelay(delay);
            }
            
            // Sometimes add a small corrective movement (humans rarely hit exact targets)
            if (Math.random() < 0.3) {
                const correctionX = endX + (Math.random() - 0.5) * 10;
                const correctionY = endY + (Math.random() - 0.5) * 10;
                await page.mouse.move(correctionX, correctionY);
                await this.humanDelay(Math.random() * 30 + 10);
            }
            
        } catch (error) {
            // Fallback to simple movement on error
            const x = Math.random() * 800;
            const y = Math.random() * 600;
            await page.mouse.move(x, y);
        }
    }

    /**
     * Simulate micro mouse movement
     * @param {Object} page - Playwright page object
     */
    async simulateMicroMovement(page) {
        try {
            // Get current mouse position
            const currentPos = await page.evaluate(() => {
                // Since we can't directly get mouse position, we'll simulate a small movement
                return { 
                    x: Math.random() * 800,
                    y: Math.random() * 600
                };
            });
            
            // Generate small, natural movements (typically 5-20 pixels)
            const deltaX = (Math.random() - 0.5) * 40; // -20 to 20 pixels
            const deltaY = (Math.random() - 0.5) * 40; // -20 to 20 pixels
            
            // Move with subtle jitter to simulate hand tremor
            const steps = Math.floor(Math.random() * 8) + 3; // 3-10 steps
            await page.mouse.move(currentPos.x + deltaX, currentPos.y + deltaY, { steps });
            
            // Occasionally add a tiny corrective movement
            if (Math.random() < 0.2) {
                await page.waitForTimeout(Math.random() * 50 + 20);
                const correctionX = (Math.random() - 0.5) * 4;
                const correctionY = (Math.random() - 0.5) * 4;
                await page.mouse.move(
                    currentPos.x + deltaX + correctionX, 
                    currentPos.y + deltaY + correctionY,
                    { steps: 2 }
                );
            }
        } catch (error) {
            // Ignore micro movement errors
            logger.debug('Micro movement simulation error', { error: error.message });
        }
    }

    /**
     * Human-like delay with natural variation
     * @param {number} baseDelay - Base delay in milliseconds
     */
    async humanDelay(baseDelay) {
        const variation = baseDelay * 0.2; // 20% variation
        const actualDelay = baseDelay + (Math.random() - 0.5) * variation;
        await new Promise(resolve => setTimeout(resolve, Math.max(100, actualDelay)));
    }

    /**
     * Get random delay within range
     * @param {number} min - Minimum delay
     * @param {number} max - Maximum delay
     * @returns {number} Random delay
     */
    getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Determine if user should bounce based on profile
     * @param {Object} profile - User profile
     * @returns {boolean} Should bounce
     */
    shouldBounce(profile) {
        return Math.random() < profile.behavioral.bounceRate;
    }

    /**
     * Get behavior summary for profile category
     * @param {string} category - Profile category
     * @returns {Object} Behavior summary
     */
    getBehaviorSummary(category) {
        return this.behaviorPatterns[category] || this.behaviorPatterns.newVisitor;
    }
}

module.exports = new HumanBehavior();
