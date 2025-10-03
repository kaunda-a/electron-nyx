const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../../../shared/config/config');
const logger = require('../../../shared/utils/logger');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const axios = require('axios');

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.isInitialized = false;
        this.proxyHealthMonitor = new Map();
        this.healthCheckInterval = null;
    }

    /**
     * Initialize proxy manager
     */
    async initialize() {
        if (this.isInitialized) return;

        logger.info('🔧 Initializing ProxyManager...');

        // Load proxies from individual JSON files
        await this.loadProxiesFromIndividualFiles();

        // Start proxy health monitoring
        this.startProxyHealthMonitoring();

        this.isInitialized = true;
        logger.info(`🔧 ProxyManager initialized with ${this.proxies.length} proxies`);
    }

    /**
     * Identifies the proxy type and provider based on hostname and other details
     */
    identifyProxy(host, port, username) {
        let result = {
            type: 'unknown',
            confidence: 0,
        };

        // Common proxy provider patterns
        const PROVIDER_PATTERNS = {
            brightdata: [
                /brd\.superproxy\.io/i,
                /\.brightdata\.com/i,
                /\.luminati\.io/i,
            ],
            smartproxy: [
                /\.smartproxy\.com/i,
                /sp\.smartproxy/i,
            ],
            oxylabs: [
                /\.oxylabs\.io/i,
                /\.oxylabs\.net/i,
            ],
            proxylabs: [
                /\.proxylabs\.co/i,
            ],
            ipburger: [
                /\.ipburger\.com/i,
            ],
            geosurf: [
                /\.geosurf\.io/i,
                /\.geosurf\.com/i,
            ],
            netnut: [
                /\.netnut\.io/i,
            ],
            shifter: [
                /\.shifter\.io/i,
            ],
            packetstream: [
                /\.packetstream\.io/i,
            ],
            stormproxies: [
                /\.stormproxies\.com/i,
            ],
            rayobyte: [
                /\.rayobyte\.com/i,
            ],
            privateproxy: [
                /\.privateproxy\.me/i,
            ],
            proxy_seller: [
                /\.proxy-seller\.com/i,
            ],
            rsocks: [
                /\.rsocks\.net/i,
            ],
            proxyrack: [
                /\.proxyrack\.net/i,
            ],
            proxyscrape: [
                /\.proxyscrape\.com/i,
            ],
            webshare: [
                /\.webshare\.io/i,
            ],
            proxyempire: [
                /\.proxyempire\.io/i,
            ],
        };

        // Patterns for proxy types
        const TYPE_PATTERNS = {
            datacenter: [
                /dc\./i,
                /datacenter/i,
                /static/i,
                /dedicated/i,
                /server/i,
            ],
            residential: [
                /res\./i,
                /residential/i,
                /home/i,
                /consumer/i,
                /dynamic/i,
            ],
            mobile: [
                /mobile/i,
                /cellular/i,
                /4g/i,
                /5g/i,
                /lte/i,
                /carrier/i,
            ],
        };

        // Provider-specific type identification
        const PROVIDER_TYPE_PATTERNS = {
            brightdata: {
                datacenter: [/brd\.superproxy\.io\/data/i, /zproxy\.lum-superproxy\.io/i],
                residential: [/brd\.superproxy\.io\/res/i, /zproxy\.lum-superproxy\.io\/res/i],
                mobile: [/brd\.superproxy\.io\/mobile/i, /zproxy\.lum-superproxy\.io\/mobile/i],
            },
            smartproxy: {
                datacenter: [/dc\.smartproxy\.com/i],
                residential: [/res\.smartproxy\.com/i],
                mobile: [/mobile\.smartproxy\.com/i],
            },
            oxylabs: {
                datacenter: [/dc\.oxylabs\.io/i],
                residential: [/res\.oxylabs\.io/i, /pr\.oxylabs\.io/i],
                mobile: [/mobile\.oxylabs\.io/i],
            },
        };

        // Check for provider first
        for (const [provider, patterns] of Object.entries(PROVIDER_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(host)) {
                    result.provider = provider;
                    result.confidence = 0.6; // Base confidence for provider match
                    
                    // Check provider-specific type patterns
                    if (provider in PROVIDER_TYPE_PATTERNS) {
                        const typePatterns = PROVIDER_TYPE_PATTERNS[provider];
                        
                        for (const [type, patterns] of Object.entries(typePatterns)) {
                            for (const pattern of patterns) {
                                if (pattern.test(host) || (username && pattern.test(username))) {
                                    result.type = type;
                                    result.confidence = 0.9; // High confidence for provider-specific type match
                                    return result;
                                }
                            }
                        }
                    }
                }
            }
        }

        // If provider is identified but type is not, check generic type patterns
        if (result.provider) {
            for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
                for (const pattern of patterns) {
                    if (pattern.test(host) || (username && pattern.test(username))) {
                        result.type = type;
                        result.confidence = 0.7; // Medium confidence for generic type match with known provider
                        return result;
                    }
                }
            }
        }

        // If no provider is identified, check generic type patterns with lower confidence
        for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(host) || (username && pattern.test(username))) {
                    result.type = type;
                    result.confidence = 0.5; // Lower confidence for generic type match without provider
                    return result;
                }
            }
        }

        // Port-based heuristics as a fallback
        if (port) {
            if ([3128, 8080, 8080, 8888, 3129].includes(port)) {
                result.type = 'datacenter';
                result.confidence = 0.3;
                result.details = 'Identified based on common datacenter port';
            } else if ([9000, 9001].includes(port)) {
                result.type = 'residential';
                result.confidence = 0.3;
                result.details = 'Identified based on common residential port';
            }
        }

        return result;
    }

    /**
     * Load proxies from individual JSON files
     */
    async loadProxiesFromIndividualFiles() {
        try {
            const proxiesDir = config.paths.proxies;
            
            // Check if the directory exists
            if (!fs.existsSync(proxiesDir)) {
                logger.info('📝 Proxies directory not found, will create when first proxy is added');
                this.proxies = [];
                return;
            }
            
            // Read all JSON files in the proxies directory
            const files = fs.readdirSync(proxiesDir).filter(file => file.endsWith('.json') && file !== 'proxies.json');
            this.proxies = [];
            
            for (const file of files) {
                try {
                    const filePath = path.join(proxiesDir, file);
                    const jsonData = await fs.promises.readFile(filePath, 'utf8');
                    const proxy = JSON.parse(jsonData);
                    this.proxies.push(proxy);
                } catch (error) {
                    logger.error(`❌ Failed to load proxy from ${file}:`, error);
                }
            }
            
            logger.info(`📁 Loaded ${this.proxies.length} proxies from individual files successfully`);
            console.log('Loaded proxies:', this.proxies);
        } catch (error) {
            logger.error('❌ Failed to load proxies from individual files:', error);
            this.proxies = [];
        }
    }

    /**
     * Save a single proxy to its own JSON file
     */
    async saveProxyToIndividualFile(proxy) {
        try {
            const proxiesDir = config.paths.proxies;
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(proxiesDir)) {
                fs.mkdirSync(proxiesDir, { recursive: true });
            }
            
            // Create a descriptive filename
            const fileName = `${proxy.country}_${proxy.host}_${proxy.port}_${proxy.id}.json`;
            const filePath = path.join(proxiesDir, fileName);
            
            // Convert proxy to JSON format
            const jsonData = JSON.stringify(proxy, null, 2);
            
            // Write to file
            await fs.promises.writeFile(filePath, jsonData);
            logger.info(`✅ Saved proxy to ${filePath}`);
        } catch (error) {
            console.error('Failed to save proxy to individual file:', error);
            logger.error('❌ Failed to save proxy to individual file:', { error: error.message, proxyId: proxy.id });
            throw error;
        }
    }

    /**
     * Save/update a proxy
     * @param {string} proxyId - Proxy ID
     * @param {Object} proxyData - Updated proxy data
     * @returns {boolean} True if proxy was saved successfully
     */
    async saveProxy(proxyId, proxyData) {
        try {
            // Find the proxy in the manager
            const proxyIndex = this.proxies.findIndex(p => p.id === proxyId);
            
            if (proxyIndex === -1) {
                throw new Error(`Proxy not found: ${proxyId}`);
            }
            
            // Update the proxy data
            this.proxies[proxyIndex] = {
                ...this.proxies[proxyIndex],
                ...proxyData,
                updatedAt: new Date().toISOString()
            };
            
            // Save the updated proxy to its individual file
            await this.saveProxyToIndividualFile(this.proxies[proxyIndex]);
            
            logger.info(`✅ Proxy ${proxyId} updated and saved successfully`);
            return true;
        } catch (error) {
            logger.error('Failed to save proxy', { error: error.message, proxyId });
            throw error;
        }
    }

    /**
     * Delete a proxy's individual JSON file
     */
    async deleteProxyFile(proxyId) {
        try {
            const proxiesDir = config.paths.proxies;
            
            // Check if directory exists
            if (!fs.existsSync(proxiesDir)) {
                console.log('Proxies directory does not exist:', proxiesDir);
                return false;
            }
            
            // Method 1: Try to find file by name pattern (most common case)
            const files = fs.readdirSync(proxiesDir).filter(file => 
                file.endsWith('.json') && file.endsWith(`${proxyId}.json`)
            );
            console.log('Found files matching proxy ID pattern:', files);
            
            if (files.length > 0) {
                const filePath = path.join(proxiesDir, files[0]);
                console.log('Deleting proxy file by pattern:', filePath);
                await fs.promises.unlink(filePath);
                logger.info(`🗑️ Deleted proxy file: ${filePath}`);
                console.log('Proxy file deleted successfully by pattern');
                return true;
            }
            
            // Method 2: Try to find file by scanning content (fallback)
            console.log('No files found by pattern, trying content scan for ID:', proxyId);
            const allFiles = fs.readdirSync(proxiesDir).filter(file => file.endsWith('.json'));
            for (const file of allFiles) {
                try {
                    const filePath = path.join(proxiesDir, file);
                    const fileContent = await fs.promises.readFile(filePath, 'utf8');
                    const proxyData = JSON.parse(fileContent);
                    if (proxyData.id === proxyId) {
                        console.log('Found proxy file by content:', filePath);
                        await fs.promises.unlink(filePath);
                        logger.info(`🗑️ Deleted proxy file: ${filePath}`);
                        console.log('Proxy file deleted successfully by content');
                        return true;
                    }
                } catch (parseError) {
                    // Continue to next file if this one can't be parsed
                    console.log('Could not parse file, continuing:', file, parseError.message);
                    continue;
                }
            }
            
            console.log('No proxy file found for ID after all search methods:', proxyId);
            return false;
        } catch (error) {
            console.error('Failed to delete proxy file', { error: error.message, proxyId });
            logger.error('Failed to delete proxy file', { error: error.message, proxyId });
            // Don't throw error, just return false
            return false;
        }
    }

    /**
     * Fetch geolocation data for a proxy using its IP
     * @param {string} ip - IP address of the proxy
     * @returns {Object} Geolocation data
     */
    async fetchGeolocationData(ip) {
        try {
            const response = await axios.get(`http://ip-api.com/json/${ip}`);
            const data = response.data;
            
            // Check if the response was successful
            if (data.status !== 'success') {
                throw new Error(`Geolocation API returned status: ${data.status}`);
            }
            
            return {
                country: data.countryCode?.toLowerCase() || 'us',
                countryName: data.country || 'United States',
                timezone: data.timezone || 'America/New_York',
                language: 'en-US', // Default language
                currency: 'USD',   // Default currency
                region: data.continent || 'North America',
                isp: data.isp || 'Unknown ISP',
                org: data.org || 'Unknown Organization',
                as: data.as || 'Unknown AS',
                city: data.city || 'Unknown City',
                lat: data.lat || 0,
                lon: data.lon || 0,
                zip: data.zip || 'Unknown ZIP'
            };
        } catch (error) {
            logger.error('❌ Failed to fetch geolocation data:', { error: error.message, ip });
            // Return default geolocation data if fetch fails
            return {
                country: 'us',
                countryName: 'United States',
                timezone: 'America/New_York',
                language: 'en-US',
                currency: 'USD',
                region: 'North America',
                isp: 'Unknown ISP',
                org: 'Unknown Organization',
                as: 'Unknown AS',
                city: 'Unknown City',
                lat: 0,
                lon: 0,
                zip: 'Unknown ZIP'
            };
        }
    }

    /**
     * Create a new proxy and add it to the manager
     * @param {Object} proxyData - Data for the new proxy
     * @returns {Object} The newly created proxy
     */
    async createProxy(proxyData) {
        try {
            console.log('Creating proxy with data:', proxyData);
            
            // Check for duplicates before creating
            const isDuplicate = this.proxies.some(p => 
                p.host === proxyData.host && 
                p.port === parseInt(proxyData.port) &&
                p.username === (proxyData.username || null)
            );
            
            if (isDuplicate) {
                throw new Error(`Proxy ${proxyData.host}:${proxyData.port} already exists.`);
            }
            
            // Generate unique ID if not provided
            const id = proxyData.id || uuidv4();

            // Validate protocol - allow http, https, socks4, socks5
            const supportedProtocols = ['http', 'https', 'socks4', 'socks5'];
            if (proxyData.protocol && !supportedProtocols.includes(proxyData.protocol)) {
                throw new Error(`Invalid protocol. Supported protocols: ${supportedProtocols.join(', ')}`);
            }

            // Validate the proxy before creating it
            const isValid = await this.testProxyHealth(proxyData);
            if (!isValid) {
                throw new Error(`Proxy validation failed. Proxy is unhealthy or unreachable.`);
            }

            // Fetch geolocation data
            const geolocation = await this.fetchGeolocationData(proxyData.host);

            // Identify proxy type
            const identification = this.identifyProxy(proxyData.host, parseInt(proxyData.port), proxyData.username);

            // Create a new proxy object
            const newProxy = {
                id: id,
                host: proxyData.host,
                port: parseInt(proxyData.port),
                protocol: proxyData.protocol || 'http',
                username: proxyData.username || null,
                password: proxyData.password || null,
                country: geolocation.country || proxyData.country || 'us',
                status: 'active', // Set to active since we just validated it
                failure_count: 0,
                success_count: 1, // Since we just validated it successfully
                average_response_time: 0,
                assigned_profiles: [],
                createdAt: new Date().toISOString(),
                isActive: true, // Set to active since we just validated it
                geolocation: geolocation,
                type: identification.type,
                provider: identification.provider
            };

            // Add the new proxy to the list
            this.proxies.push(newProxy);
            console.log('Proxy added to list, total proxies:', this.proxies.length);

            // Save the proxy to its individual JSON file
            await this.saveProxyToIndividualFile(newProxy);

            logger.info(`✅ New proxy created and added: ${newProxy.host}:${newProxy.port}`);

            return newProxy;
        } catch (error) {
            console.error('Failed to create proxy:', error);
            logger.error('❌ Failed to create proxy in manager:', { error: error.message, proxyData });
            throw error;
        }
    }

    /**
     * Create multiple proxies in batch
     * @param {Array} proxiesData - Array of proxy data objects
     * @returns {Object} Result with imported and error counts
     */
    async createBatchProxies(proxiesData) {
        try {
            console.log('Creating batch proxies, count:', proxiesData.length);
            const imported = [];
            const errors = [];

            // Validate protocol for all proxies
            const supportedProtocols = ['http', 'https', 'socks4', 'socks5'];
            
            for (const proxyData of proxiesData) {
                try {
                    console.log('Creating proxy:', proxyData);
                    
                    // Validate protocol for each proxy
                    if (proxyData.protocol && !supportedProtocols.includes(proxyData.protocol)) {
                        throw new Error(`Invalid protocol. Supported protocols: ${supportedProtocols.join(', ')}`);
                    }
                    
                    const newProxy = await this.createProxy(proxyData);
                    imported.push(newProxy);
                } catch (error) {
                    console.error('Error creating proxy:', error);
                    errors.push({
                        proxyData,
                        reason: error.message
                    });
                }
            }

            console.log('Batch create completed. Imported:', imported.length, 'Errors:', errors.length);
            
            // Reload proxies from individual files to ensure consistency
            await this.loadProxiesFromIndividualFiles();
            
            return {
                success: true,
                message: `Successfully imported ${imported.length} proxies.`,
                imported: imported.length,
                errors: errors.length,
                details: { imported, errors }
            };
        } catch (error) {
            console.error('Failed to create batch proxies:', error);
            logger.error('Failed to create batch proxies', { error: error.message });
            throw error;
        }
    }

    /**
     * Get all proxies
     * @returns {Array} Array of all proxies
     */
    getAllProxies() {
        console.log('Getting all proxies, count:', this.proxies.length);
        // Return a copy of the proxies array to prevent external modifications
        return [...this.proxies];
    }

    /**
     * Get proxy by ID
     * @param {string} proxyId - Proxy ID
     * @returns {Object|null} Proxy object or null if not found
     */
    getProxyById(proxyId) {
        return this.proxies.find(p => p.id === proxyId) || null;
    }

    /**
     * Delete proxy by ID
     * @param {string} proxyId - Proxy ID
     * @returns {boolean} True if proxy was deleted, false if not found
     */
    async deleteProxy(proxyId) {
        try {
            console.log('Searching for proxy with ID:', proxyId);
            const index = this.proxies.findIndex(p => p.id === proxyId);
            console.log('Proxy index found:', index);
            
            if (index !== -1) {
                const proxyToDelete = this.proxies[index];
                
                // Delete the proxy's individual JSON file
                console.log('Attempting to delete proxy file for ID:', proxyId);
                try {
                    const fileDeleted = await this.deleteProxyFile(proxyId);
                    console.log('Proxy file deletion result:', fileDeleted);
                } catch (fileError) {
                    console.warn('Warning: Failed to delete proxy file, but continuing with removal:', fileError.message);
                    // Continue with proxy removal even if file deletion fails
                }
                
                // If the proxy was assigned to any profiles, mark it as unassigned
                if (proxyToDelete.assigned_profiles && proxyToDelete.assigned_profiles.length > 0) {
                    console.log('Unassigning proxy from profiles:', proxyToDelete.assigned_profiles);
                    // In a real implementation, we would notify the profiles that their proxy was deleted
                    // For now, we'll just log it
                }
                
                this.proxies.splice(index, 1);
                logger.info(`🗑️ Deleted proxy with ID: ${proxyId}`);
                console.log('Proxy removed from memory array');
                return true;
            } else {
                console.log('Proxy not found in memory array for ID:', proxyId);
                // Try to delete the file anyway in case it exists on disk but not in memory
                try {
                    const fileDeleted = await this.deleteProxyFile(proxyId);
                    if (fileDeleted) {
                        console.log('Proxy file deleted even though proxy was not in memory');
                        return true;
                    } else {
                        console.log('No proxy file found to delete for ID:', proxyId);
                    }
                } catch (fileError) {
                    console.log('No proxy file found to delete for ID (error):', proxyId, fileError.message);
                }
            }
            
            return false;
        } catch (error) {
            console.error('Failed to delete proxy', { error: error.message, proxyId });
            logger.error('Failed to delete proxy', { error: error.message, proxyId });
            // Even if there's an error, we should return false rather than throwing
            return false;
        }
    }

    /**
     * Test individual proxy health with SSL certificate handling
     * @param {Object} proxy - Proxy object to test
     * @returns {boolean} True if proxy is healthy
     */
    async testProxyHealth(proxy) {
        try {
            // Create proxy agent based on protocol with proper SSL handling
            const authPart = proxy.username && proxy.password ? 
                `${proxy.username}:${proxy.password}@` : '';
            
            let agent;
            if (proxy.protocol === 'socks4' || proxy.protocol === 'socks5') {
                // For SOCKS proxies, use SocksProxyAgent with SSL options
                const proxyUrl = `${proxy.protocol}://${authPart}${proxy.host}:${proxy.port}`;
                agent = new SocksProxyAgent(proxyUrl, {
                    // SSL certificate options for SOCKS proxies
                    rejectUnauthorized: false, // Ignore certificate errors for proxy compatibility
                });
            } else {
                // For HTTP/HTTPS proxies, use HttpsProxyAgent with SSL options
                const proxyUrl = `${proxy.protocol || 'http'}://${authPart}${proxy.host}:${proxy.port}`;
                agent = new HttpsProxyAgent(proxyUrl, {
                    // SSL certificate options for HTTP/HTTPS proxies
                    rejectUnauthorized: false, // Ignore certificate errors for proxy compatibility
                    secureProtocol: 'TLSv1_2_method', // Use modern TLS
                });
            }

            // Test with a simple HTTP request
            const response = await axios.get('http://httpbin.org/ip', {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: 10000, // 10 second timeout
                validateStatus: (status) => status === 200,
                // Additional SSL options for the request
                httpsAgentOptions: {
                    rejectUnauthorized: false, // Ignore certificate errors
                }
            });

            // Check if we got a valid response with an IP
            if (response.data && response.data.origin) {
                logger.debug(`✅ Proxy healthy: ${proxy.host}:${proxy.port} -> IP: ${response.data.origin}`);
                return true;
            }

            return false;
        } catch (error) {
            // Log SSL-specific errors for debugging
            if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || 
                error.code === 'CERT_HAS_EXPIRED' || 
                error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
                logger.debug(`⚠️ SSL certificate error for proxy ${proxy.host}:${proxy.port} - ${error.message}`);
                // These are expected for many proxies and don't indicate a real problem
                return true; // Consider proxy healthy despite SSL errors
            }
            
            logger.debug(`❌ Proxy health check failed: ${proxy.host}:${proxy.port} - ${error.message}`);
            return false;
        }
    }

    /**
     * Get available proxies for a specific country
     * @param {string} countryCode - Country code to filter proxies by
     * @returns {Array} Array of available proxies
     */
    getAvailableProxies(countryCode = 'us') {
        // Normalize country code to lowercase for comparison with proxy data
        const normalizedCountryCode = countryCode.toLowerCase();
        return this.proxies.filter(proxy => 
            proxy.country === normalizedCountryCode && 
            proxy.status !== 'error' && 
            !proxy.isAssigned
        );
    }

    /**
     * Get the healthiest proxies based on success rate and response time
     * @param {string} countryCode - Country code to filter proxies by
     * @param {number} limit - Maximum number of proxies to return
     * @returns {Array} Array of healthy proxies sorted by health
     */
    getHealthiestProxies(countryCode = 'us', limit = 10) {
        // Normalize country code to lowercase for comparison with proxy data
        const normalizedCountryCode = countryCode.toLowerCase();
        
        // Filter proxies by country and availability
        const availableProxies = this.proxies.filter(proxy => 
            proxy.country === normalizedCountryCode && 
            proxy.status !== 'error' && 
            !proxy.isAssigned
        );
        
        // Sort by health metrics (success rate and response time)
        const sortedProxies = availableProxies.sort((a, b) => {
            // Calculate success rates
            const aSuccessRate = a.success_count ? a.success_count / (a.success_count + (a.failure_count || 0)) : 0;
            const bSuccessRate = b.success_count ? b.success_count / (b.success_count + (b.failure_count || 0)) : 0;
            
            // If success rates are equal, sort by response time
            if (aSuccessRate === bSuccessRate) {
                return (a.average_response_time || 99999) - (b.average_response_time || 99999);
            }
            
            // Sort by success rate (higher is better)
            return bSuccessRate - aSuccessRate;
        });
        
        return sortedProxies.slice(0, limit);
    }

    /**
     * Get proxy statistics
     * @returns {Object} Proxy statistics
     */
    getStats() {
        return {
            totalProxies: this.proxies.length,
            isInitialized: this.isInitialized,
            healthMonitoring: this.healthCheckInterval !== null
        };
    }

    /**
     * Start proxy health monitoring system
     */
    startProxyHealthMonitoring() {
        // Check proxy health every 5 minutes
        this.healthCheckInterval = setInterval(async () => {
            logger.info('🔍 Proxy health monitoring tick - checking proxy health');
            await this.performHealthChecks();
        }, 5 * 60 * 1000);

        logger.info('🔍 Proxy health monitoring started');
    }

    /**
     * Perform health checks on all proxies
     */
    async performHealthChecks() {
        try {
            const healthCheckPromises = this.proxies.map(async (proxy) => {
                try {
                    // Record start time for response time tracking
                    const startTime = Date.now();
                    
                    // Test proxy health
                    const isHealthy = await this.testProxyHealth(proxy);
                    const responseTime = Date.now() - startTime;
                    
                    // Update proxy statistics
                    if (isHealthy) {
                        proxy.success_count = (proxy.success_count || 0) + 1;
                        proxy.status = 'active';
                        
                        // Update average response time
                        if (proxy.average_response_time) {
                            proxy.average_response_time = (proxy.average_response_time + responseTime) / 2;
                        } else {
                            proxy.average_response_time = responseTime;
                        }
                        
                        logger.debug(`✅ Proxy healthy: ${proxy.host}:${proxy.port} (Response: ${responseTime}ms)`);
                    } else {
                        proxy.failure_count = (proxy.failure_count || 0) + 1;
                        proxy.status = 'error';
                        
                        logger.warn(`❌ Proxy unhealthy: ${proxy.host}:${proxy.port} (Failures: ${proxy.failure_count})`);
                        
                        // If proxy has too many failures, consider rotating it
                        if (proxy.failure_count > 5 && proxy.isAssigned) {
                            logger.warn(`🔄 Proxy ${proxy.host}:${proxy.port} has too many failures, marking for rotation`);
                            await this.handleProxyRotation(proxy);
                        }
                    }
                    
                    // Save updated proxy data
                    await this.saveProxyToIndividualFile(proxy);
                    
                    return { proxyId: proxy.id, healthy: isHealthy, responseTime };
                } catch (error) {
                    logger.error(`Error checking health of proxy ${proxy.host}:${proxy.port}`, error);
                    return { proxyId: proxy.id, healthy: false, error: error.message };
                }
            });
            
            // Wait for all health checks to complete
            const results = await Promise.allSettled(healthCheckPromises);
            
            // Log summary
            const healthyCount = results.filter(r => r.status === 'fulfilled' && r.value.healthy).length;
            logger.info(`🔍 Proxy health check completed: ${healthyCount}/${this.proxies.length} proxies healthy`);
            
        } catch (error) {
            logger.error('Error during proxy health checks', error);
        }
    }

    /**
     * Handle proxy rotation when a proxy becomes unhealthy
     * @param {Object} failedProxy - The proxy that failed
     */
    async handleProxyRotation(failedProxy) {
        try {
            logger.info(`🔄 Handling proxy rotation for ${failedProxy.host}:${failedProxy.port}`);
            
            // If this proxy is assigned to a profile, we need to rotate it
            if (failedProxy.assignedProfileId) {
                const profileId = failedProxy.assignedProfileId;
                logger.info(`🔄 Rotating proxy for profile ${profileId}`);
                
                // Find the profile (this would require access to the profile pool manager)
                // For now, we'll just mark the proxy as needing rotation
                failedProxy.needsRotation = true;
                
                // In a full implementation, we would:
                // 1. Find a new proxy for the profile
                // 2. Update the profile with the new proxy
                // 3. Notify the profile pool manager of the change
            }
        } catch (error) {
            logger.error(`Error handling proxy rotation for ${failedProxy.host}:${failedProxy.port}`, error);
        }
    }

    /**
     * Stop proxy health monitoring
     */
    stopProxyHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            logger.info('🔍 Proxy health monitoring stopped');
        }
    }
}

module.exports = ProxyManager;