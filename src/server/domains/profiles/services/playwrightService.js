const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../../shared/config/config');
const logger = require('../../../shared/utils/logger');

/**
 * Playwright Service
 * Advanced browser automation with ITBrowser integration
 */
class PlaywrightService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.activePages = new Map();
        this.isInitialized = false;
    }

    /**
     * Initialize Playwright with ITBrowser
     * @param {Object} options - Browser launch options
     */
    async initialize(options = {}) {
        try {
            logger.info('Initializing Playwright service with ITBrowser');
            
            // Prepare launch options for ITBrowser
            const launchOptions = {
                headless: options.headless !== undefined ? options.headless : config.browser.headless,
                timeout: options.timeout || config.browser.timeout,
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=ReduceAcceptLanguage',
                    '--disable-crash-reporter',
                    '--disable-component-update',
                    '--no-default-browser-check',
                    '--ignore-certificate-errors',
                    '--ignore-ssl-errors',
                    '--allow-running-insecure-content',
                    '--disable-web-security',
                    '--no-sandbox'
                ],
                ...options
            };

            // Always use ITBrowser executable - fail if not available
            if (config.itbrowser.executable && await fs.pathExists(config.itbrowser.executable)) {
                logger.info('Using ITBrowser executable', { path: config.itbrowser.executable });
                launchOptions.executablePath = config.itbrowser.executable;
            } else {
                const error = new Error(`ITBrowser executable not found at: ${config.itbrowser.executable}. Cannot launch browser.`);
                logger.error('Failed to initialize Playwright service', { error: error.message });
                throw error;
            }

            // Launch browser
            this.browser = await chromium.launch(launchOptions);
            this.isInitialized = true;
            
            logger.info('Playwright service initialized successfully');
            return true;
        } catch (error) {
            logger.error('Failed to initialize Playwright service', { error: error.message });
            throw error;
        }
    }

    /**
     * Create a new browser context with fingerprint data
     * @param {Object} fingerprint - Browser fingerprint data
     * @param {Object} options - Context options
     */
    async createContext(fingerprint, options = {}) {
        try {
            if (!this.browser) {
                throw new Error('Playwright service not initialized');
            }

            logger.info('Creating browser context with fingerprint', { 
                hasFingerprint: !!fingerprint,
                options 
            });

            // Prepare context options with fingerprint data
            const contextOptions = {
                viewport: fingerprint?.viewport || config.browser.viewport,
                userAgent: fingerprint?.userAgent || null,
                timezoneId: fingerprint?.timezone || null,
                locale: fingerprint?.language || 'en-US',
                ...options
            };

            // Create context
            const context = await this.browser.newContext(contextOptions);
            
            // Apply additional fingerprint settings if available
            if (fingerprint) {
                await this.applyFingerprint(context, fingerprint);
            }

            logger.info('Browser context created successfully');
            return context;
        } catch (error) {
            logger.error('Failed to create browser context', { error: error.message });
            throw error;
        }
    }

    /**
     * Apply fingerprint data to browser context
     * @param {Object} context - Browser context
     * @param {Object} fingerprint - Fingerprint data
     */
    async applyFingerprint(context, fingerprint) {
        try {
            logger.debug('Applying fingerprint to browser context');
            
            // Add fingerprint script to hide automation
            await context.addInitScript(() => {
                // Override navigator.webdriver
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });

                // Override navigator.plugins
                if (window.fingerprintData && window.fingerprintData.pluginsLength !== undefined) {
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => new Array(window.fingerprintData.pluginsLength),
                    });
                }

                // Override navigator.languages
                if (window.fingerprintData && window.fingerprintData.language) {
                    Object.defineProperty(navigator, 'languages', {
                        get: () => [window.fingerprintData.language],
                    });
                }

                // Hide Chrome automation flags
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => {
                    if (parameters.name === 'notifications') {
                        return Promise.resolve({
                            state: Notification.permission,
                            onchange: null
                        });
                    }
                    return originalQuery(parameters);
                };
            });

            // Set fingerprint data in window object
            await context.addInitScript((fingerprintData) => {
                window.fingerprintData = fingerprintData;
            }, fingerprint);

            logger.debug('Fingerprint applied to browser context');
        } catch (error) {
            logger.error('Failed to apply fingerprint to browser context', { error: error.message });
        }
    }

    /**
     * Create a new page with context
     * @param {Object} context - Browser context
     * @param {Object} options - Page options
     */
    async createPage(context, options = {}) {
        try {
            if (!context) {
                throw new Error('Browser context is required');
            }

            logger.info('Creating new page');
            
            // Create page
            const page = await context.newPage();
            
            // Apply page settings
            if (options.viewport) {
                await page.setViewportSize(options.viewport);
            }

            // Store page reference
            const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.activePages.set(pageId, page);
            
            // Setup page event handlers
            this.setupPageEvents(page, pageId);

            logger.info('Page created successfully', { pageId });
            return { pageId, page };
        } catch (error) {
            logger.error('Failed to create page', { error: error.message });
            throw error;
        }
    }

    /**
     * Setup page event handlers
     * @param {Object} page - Page object
     * @param {string} pageId - Page ID
     */
    setupPageEvents(page, pageId) {
        // Handle page close event
        page.on('close', () => {
            logger.info('Page closed', { pageId });
            this.activePages.delete(pageId);
        });

        // Handle console messages
        page.on('console', (msg) => {
            logger.debug('Page console message', { 
                pageId, 
                type: msg.type(), 
                text: msg.text() 
            });
        });

        // Handle page errors
        page.on('pageerror', (error) => {
            logger.error('Page error', { 
                pageId, 
                error: error.message 
            });
        });

        // Handle request failures
        page.on('requestfailed', (request) => {
            logger.warn('Page request failed', { 
                pageId, 
                url: request.url(), 
                failure: request.failure().errorText 
            });
        });
    }

    /**
     * Navigate to URL with advanced options
     * @param {Object} page - Page object
     * @param {string} url - URL to navigate to
     * @param {Object} options - Navigation options
     */
    async navigateTo(page, url, options = {}) {
        try {
            logger.info('Navigating to URL', { url, options });
            
            // Default navigation options
            const navOptions = {
                waitUntil: 'domcontentloaded',
                timeout: options.timeout || 30000,
                ...options
            };

            // Navigate to URL
            const response = await page.goto(url, navOptions);
            
            logger.info('Navigation completed', { 
                url, 
                status: response?.status(),
                headers: response?.headers()
            });
            
            return response;
        } catch (error) {
            logger.error('Navigation failed', { 
                url, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Simulate human-like mouse movement
     * @param {Object} page - Page object
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Movement options
     */
    async moveMouse(page, x, y, options = {}) {
        try {
            const { steps = 5, delay = 100 } = options;
            
            logger.debug('Moving mouse', { x, y, steps, delay });
            
            // Move mouse with steps for realistic movement
            await page.mouse.move(x, y, { steps });
            
            // Add delay to simulate human behavior
            if (delay > 0) {
                await page.waitForTimeout(delay);
            }
        } catch (error) {
            logger.error('Mouse movement failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Simulate human-like click
     * @param {Object} page - Page object
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Click options
     */
    async click(page, x, y, options = {}) {
        try {
            const { delay = 50, button = 'left' } = options;
            
            logger.debug('Clicking', { x, y, button, delay });
            
            // Move to position first
            await this.moveMouse(page, x, y, { delay: 0 });
            
            // Add small delay before click
            await page.waitForTimeout(50 + Math.random() * 100);
            
            // Perform click
            await page.mouse.click(x, y, { delay, button });
        } catch (error) {
            logger.error('Click failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Simulate human-like scroll
     * @param {Object} page - Page object
     * @param {number} deltaX - Horizontal scroll amount
     * @param {number} deltaY - Vertical scroll amount
     * @param {Object} options - Scroll options
     */
    async scroll(page, deltaX, deltaY, options = {}) {
        try {
            const { delay = 100 } = options;
            
            logger.debug('Scrolling', { deltaX, deltaY, delay });
            
            // Perform scroll
            await page.mouse.wheel(deltaX, deltaY);
            
            // Add delay to simulate human behavior
            if (delay > 0) {
                await page.waitForTimeout(delay);
            }
        } catch (error) {
            logger.error('Scroll failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Extract page content with advanced options
     * @param {Object} page - Page object
     * @param {Object} options - Extraction options
     */
    async extractContent(page, options = {}) {
        try {
            const { 
                includeText = true, 
                includeLinks = true, 
                includeImages = true,
                includeForms = true,
                waitForSelector = null
            } = options;
            
            logger.debug('Extracting page content', { options });
            
            // Wait for specific selector if provided
            if (waitForSelector) {
                await page.waitForSelector(waitForSelector, { timeout: 5000 });
            }
            
            // Extract content based on options
            const content = {};
            
            if (includeText) {
                content.text = await page.evaluate(() => document.body.innerText);
            }
            
            if (includeLinks) {
                content.links = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href]'));
                    return links.map(link => ({
                        text: link.textContent.trim(),
                        href: link.href,
                        target: link.target
                    }));
                });
            }
            
            if (includeImages) {
                content.images = await page.evaluate(() => {
                    const images = Array.from(document.querySelectorAll('img[src]'));
                    return images.map(img => ({
                        src: img.src,
                        alt: img.alt,
                        title: img.title
                    }));
                });
            }
            
            if (includeForms) {
                content.forms = await page.evaluate(() => {
                    const forms = Array.from(document.querySelectorAll('form'));
                    return forms.map(form => ({
                        action: form.action,
                        method: form.method,
                        inputs: Array.from(form.querySelectorAll('input')).map(input => ({
                            name: input.name,
                            type: input.type,
                            value: input.value
                        }))
                    }));
                });
            }
            
            logger.debug('Content extraction completed', { 
                textLength: content.text?.length,
                linkCount: content.links?.length,
                imageCount: content.images?.length,
                formCount: content.forms?.length
            });
            
            return content;
        } catch (error) {
            logger.error('Content extraction failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Close page
     * @param {string} pageId - Page ID
     */
    async closePage(pageId) {
        try {
            const page = this.activePages.get(pageId);
            if (page) {
                await page.close();
                this.activePages.delete(pageId);
                logger.info('Page closed', { pageId });
            }
        } catch (error) {
            logger.error('Failed to close page', { 
                pageId, 
                error: error.message 
            });
        }
    }

    /**
     * Close all pages
     */
    async closeAllPages() {
        try {
            const pageIds = Array.from(this.activePages.keys());
            for (const pageId of pageIds) {
                await this.closePage(pageId);
            }
            logger.info('All pages closed');
        } catch (error) {
            logger.error('Failed to close all pages', { error: error.message });
        }
    }

    /**
     * Close browser context
     * @param {Object} context - Browser context
     */
    async closeContext(context) {
        try {
            if (context) {
                await context.close();
                logger.info('Browser context closed');
            }
        } catch (error) {
            logger.error('Failed to close browser context', { error: error.message });
        }
    }

    /**
     * Shutdown Playwright service
     */
    async shutdown() {
        try {
            logger.info('Shutting down Playwright service');
            
            // Close all pages
            await this.closeAllPages();
            
            // Close browser
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                logger.info('Browser closed');
            }
            
            this.isInitialized = false;
            logger.info('Playwright service shutdown completed');
        } catch (error) {
            logger.error('Error during Playwright service shutdown', { error: error.message });
        }
    }

    /**
     * Check if service is initialized
     * @returns {boolean} Initialization status
     */
    isReady() {
        return this.isInitialized && this.browser !== null;
    }
}

module.exports = new PlaywrightService();