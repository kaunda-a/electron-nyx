const LLMService = require('./llmService');
const config = require('../../shared/config/config');
const logger = require('../../../shared/utils/logger');

/**
 * Mouse Tracking Service
 * Simulates realistic human mouse movements and interactions
 */
class MouseTrackingService {
    constructor() {
        this.movementHistory = new Map();
    }

    /**
     * Generate human-like mouse movement to a target element
     * @param {Object} page - Playwright page object
     * @param {number} x - Target X coordinate
     * @param {number} y - Target Y coordinate
     * @param {Object} elementInfo - Information about the target element
     * @param {Object} options - Movement options
     */
    async moveMouseToElement(page, x, y, elementInfo = {}, options = {}) {
        try {
            const { 
                steps = 10, 
                duration = 1000,
                profileCategory = 'newVisitor'
            } = options;
            
            logger.debug('Generating mouse movement to element', { x, y, elementInfo });
            
            // Get mouse movement coordinates from LLM or basic algorithm
            let movementCoordinates;
            
            if (LLMService.isMouseMovementConfigured()) {
                // Use OpenRouter for sophisticated mouse movement generation
                const pageContext = {
                    elementType: elementInfo.type || 'generic',
                    x: x,
                    y: y,
                    width: elementInfo.width || 100,
                    height: elementInfo.height || 50,
                    interactionType: 'move',
                    userProfile: profileCategory
                };
                
                movementCoordinates = await LLMService.generateMouseMovement(pageContext);
                logger.debug('Using LLM-generated mouse movement', { 
                    coordinatesCount: movementCoordinates.length 
                });
            } else {
                // Use basic algorithm
                movementCoordinates = await this.generateBasicMouseMovement(x, y, options);
                logger.debug('Using basic mouse movement generation', { 
                    coordinatesCount: movementCoordinates.length 
                });
            }
            
            // Execute the mouse movement
            for (let i = 0; i < movementCoordinates.length; i++) {
                const [moveX, moveY] = movementCoordinates[i];
                const stepDelay = duration / movementCoordinates.length;
                
                await page.mouse.move(moveX, moveY);
                await page.waitForTimeout(stepDelay + Math.random() * 50);
            }
            
            // Store movement in history
            const movementId = `movement_${Date.now()}`;
            this.movementHistory.set(movementId, {
                target: { x, y },
                coordinates: movementCoordinates,
                timestamp: new Date().toISOString(),
                profileCategory
            });
            
            logger.debug('Mouse movement completed', { movementId });
            
        } catch (error) {
            logger.error('Failed to generate mouse movement', { error: error.message });
            // Fallback to basic mouse movement
            await this.basicMouseMove(page, x, y, options);
        }
    }

    /**
     * Generate basic mouse movement coordinates
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @param {Object} options - Movement options
     * @returns {Array} Array of coordinate pairs
     */
    async generateBasicMouseMovement(targetX, targetY, options = {}) {
        const { 
            startX = targetX + (Math.random() * 200 - 100),
            startY = targetY + (Math.random() * 200 - 100),
            steps = 10
        } = options;
        
        const coordinates = [];
        
        // Generate natural-looking path with some curvature
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            
            // Add some natural curvature to the movement
            const curveIntensity = 0.3;
            const curveOffsetX = Math.sin(t * Math.PI) * (Math.random() - 0.5) * 100 * curveIntensity;
            const curveOffsetY = Math.sin(t * Math.PI) * (Math.random() - 0.5) * 100 * curveIntensity;
            
            // Calculate position with easing for more natural movement
            const easeInOut = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            
            const x = startX + (targetX - startX) * easeInOut + curveOffsetX;
            const y = startY + (targetY - startY) * easeInOut + curveOffsetY;
            
            coordinates.push([x, y]);
        }
        
        return coordinates;
    }

    /**
     * Basic mouse move fallback
     * @param {Object} page - Playwright page object
     * @param {number} x - Target X coordinate
     * @param {number} y - Target Y coordinate
     * @param {Object} options - Movement options
     */
    async basicMouseMove(page, x, y, options = {}) {
        const { steps = 5, duration = 500 } = options;
        
        // Simple linear movement with some randomness
        await page.mouse.move(x, y, { steps: steps + Math.floor(Math.random() * 5) });
        await page.waitForTimeout(duration + Math.random() * 200);
    }

    /**
     * Simulate human-like mouse click with preceding movement
     * @param {Object} page - Playwright page object
     * @param {number} x - Click X coordinate
     * @param {number} y - Click Y coordinate
     * @param {Object} elementInfo - Information about the target element
     * @param {Object} options - Click options
     */
    async humanClick(page, x, y, elementInfo = {}, options = {}) {
        try {
            const { 
                delay = 100,
                profileCategory = 'newVisitor'
            } = options;
            
            // Move mouse to element first
            await this.moveMouseToElement(page, x, y, elementInfo, { profileCategory });
            
            // Add small pause before click (human-like)
            await page.waitForTimeout(100 + Math.random() * 200);
            
            // Perform click with slight delay variation
            await page.mouse.click(x, y, { delay: delay + Math.random() * 50 });
            
            logger.debug('Human-like click completed', { x, y });
            
        } catch (error) {
            logger.error('Failed to perform human-like click', { error: error.message });
            // Fallback to basic click
            await page.mouse.click(x, y, { delay: 50 });
        }
    }

    /**
     * Simulate human-like scrolling behavior
     * @param {Object} page - Playwright page object
     * @param {number} scrollAmount - Amount to scroll (positive = down, negative = up)
     * @param {Object} options - Scroll options
     */
    async humanScroll(page, scrollAmount, options = {}) {
        try {
            const { 
                duration = 2000,
                profileCategory = 'newVisitor'
            } = options;
            
            // Determine scroll direction and distance
            const absScrollAmount = Math.abs(scrollAmount);
            const direction = scrollAmount > 0 ? 1 : -1;
            
            // Scroll in small increments to simulate human behavior
            const increment = direction * 100;
            const steps = Math.ceil(absScrollAmount / Math.abs(increment));
            const stepDelay = duration / steps;
            
            for (let i = 0; i < steps; i++) {
                await page.mouse.wheel(0, increment);
                // Variable delays to simulate human-like scrolling
                await page.waitForTimeout(stepDelay + Math.random() * 100);
            }
            
            logger.debug('Human-like scroll completed', { scrollAmount });
            
        } catch (error) {
            logger.error('Failed to perform human-like scroll', { error: error.message });
            // Fallback to basic scroll
            await page.mouse.wheel(0, scrollAmount);
        }
    }

    /**
     * Get mouse movement statistics
     * @returns {Object} Movement statistics
     */
    getMovementStats() {
        return {
            totalMovements: this.movementHistory.size,
            recentMovements: Array.from(this.movementHistory.keys())
                .slice(-10)
                .map(key => this.movementHistory.get(key))
        };
    }

    /**
     * Clear movement history
     */
    clearMovementHistory() {
        this.movementHistory.clear();
        logger.debug('Mouse movement history cleared');
    }
}

module.exports = new MouseTrackingService();