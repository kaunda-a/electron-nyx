const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Profile = require('../models/Profile');
const ProxyManager = require('../../proxies/services/proxyManager');
const ItBrowserAPI = require('./itBrowserAPI');
const config = require('../../../shared/config/config');
const logger = require('../../../shared/utils/logger');
const csv = require('csv-parser');

class ProfilePoolManager {
    constructor() {
        this.profiles = new Map();
        this.activeSessions = new Map();
        this.profilesByCategory = {
            newVisitor: [],
            returningRegular: [],
            loyalUser: []
        };
        this.proxyManager = new ProxyManager();
        this.itBrowserAPI = new ItBrowserAPI();
        // Track profile numbers per country
        this.countryProfileCounters = {
            us: 0,
            gb: 0,
            ca: 0,
            au: 0,
            de: 0
        };
        this.isInitialized = false;
    }

    /**
     * Initialize the profile pool
     */
    async initialize() {
        try {
            logger.info('Initializing profile pool manager');
            
            // Initialize proxy manager to load proxies
            await this.proxyManager.initialize();
            
            // Load existing profiles or generate new ones
            await this.loadProfiles();
            
            // Validate profile distribution
            await this.validateProfileDistribution();
            
            this.isInitialized = true;
            
            logger.info('Profile pool manager initialized', {
                totalProfiles: this.profiles.size,
                newVisitor: this.profilesByCategory.newVisitor.length,
                returningRegular: this.profilesByCategory.returningRegular.length,
                loyalUser: this.profilesByCategory.loyalUser.length
            });

        } catch (error) {
            logger.error('Failed to initialize profile pool manager', { error: error.message });
            throw error;
        }
    }

    /**
     * Load profiles from storage or generate new ones
     */
    async loadProfiles() {
        const profilesDir = config.paths.profiles;
        await fs.ensureDir(profilesDir);

        try {
            // Check if profiles already exist by looking for profile directories
            const profileItems = await fs.readdir(profilesDir);
            const profileDirs = profileItems.filter(item => item.startsWith('profile_'));

            if (profileDirs.length > 0) {
                logger.info(`Loading ${profileDirs.length} existing profiles`);
                await this.loadExistingProfiles(profileDirs);
                // Update counter based on existing profiles
                this.updateProfileNumberCounter();
            } else {
                logger.info('No existing profiles found. Profiles will be created via GUI or API.');
                // Don't auto-generate profiles - they will be created via GUI
            }

        } catch (error) {
            logger.error('Error loading profiles', { error: error.message });
            throw error;
        }
    }

    /**
     * Load existing profiles from files
     * @param {Array} profileDirs - Array of profile directory names
     */
    async loadExistingProfiles(profileDirs) {
        const profilesDir = config.paths.profiles;

        for (const dirName of profileDirs) {
            try {
                // Skip non-directory items
                const dirPath = path.join(profilesDir, dirName);
                const stat = await fs.stat(dirPath);
                if (!stat.isDirectory()) {
                    continue;
                }

                // Read files in the profile directory
                const profileFiles = await fs.readdir(dirPath);
                // Look for both old and new filename formats for backward compatibility
                const jsonFiles = profileFiles.filter(file => 
                    file.endsWith('.json') && 
                    (file.startsWith('profile-') || file.startsWith('profile_'))
                );
                
                if (jsonFiles.length > 0) {
                    // Use the first JSON file that starts with "profile-"
                    const fileName = jsonFiles[0];
                    const filePath = path.join(dirPath, fileName);
                    const profileData = await fs.readJson(filePath);
                    const profile = Profile.fromJSON(profileData);

                    // Assign profile number and country if not present (for legacy profiles)
                    if (!profile.profileNumber || !profile.countryCode) {
                        // Assign country based on weighted distribution for legacy profiles
                        if (!profile.countryCode) {
                            profile.countryCode = this.assignCountryForLegacyProfile();
                        }
                        // Ensure country code is uppercase for consistency
                        if (profile.countryCode) {
                            profile.countryCode = profile.countryCode.toUpperCase();
                        }
                        // Assign profile number for the assigned country
                        if (!profile.profileNumber) {
                            profile.profileNumber = this.getNextProfileNumberForCountry(profile.countryCode);
                        }
                    } else {
                        // Ensure existing country codes are uppercase for consistency
                        if (profile.countryCode) {
                            profile.countryCode = profile.countryCode.toUpperCase();
                        }
                    }

                    // Initialize isolated storage for loaded profiles
                    if (!profile.isolatedStorage || !profile.isolatedStorage.userDataDir) {
                        profile.initializeIsolatedStorage(config.paths.profiles);
                        await profile.ensureIsolatedStorageDirectories();
                    }

                    this.addProfileToPool(profile);
                }

            } catch (error) {
                logger.warn(`Failed to load profile from directory ${dirName}`, { error: error.message });
            }
        }
    }

    /**
     * Generate new profile pool
     */
    async generateProfilePool(customCount = null, customDistribution = null) {
        const totalProfiles = customCount || config.system.profileCount;
        const distribution = customDistribution || config.profiles;

        // Support unlimited profiles
        if (config.system.enableUnlimitedProfiles && totalProfiles === 0) {
            logger.info('Unlimited profiles mode enabled - generating default batch');
            const defaultBatch = config.system.maxProfilesPerBatch;
            await this.generateProfilesByCategory('newVisitor', Math.floor(defaultBatch * 0.4));
            await this.generateProfilesByCategory('returningRegular', Math.floor(defaultBatch * 0.35));
            await this.generateProfilesByCategory('loyalUser', Math.floor(defaultBatch * 0.25));
        } else {
            // Generate profiles by category with country distribution
            await this.generateProfilesByCategory('newVisitor', distribution.newVisitorCount);
            await this.generateProfilesByCategory('returningRegular', distribution.returningRegularCount);
            await this.generateProfilesByCategory('loyalUser', distribution.loyalUserCount);
        }

        // Save all profiles to disk
        await this.saveAllProfiles();

        logger.info('Profile pool generation completed', {
            totalGenerated: this.profiles.size,
            newVisitor: distribution.newVisitorCount,
            returningRegular: distribution.returningRegularCount,
            loyalUser: distribution.loyalUserCount,
            countryDistribution: this.countryProfileCounters
        });
    }

    /**
     * Generate profiles for a specific category with country distribution and pre-assigned proxies
     * @param {string} category - Profile category
     * @param {number} count - Number of profiles to generate
     */
    async generateProfilesByCategory(category, count) {
        logger.info(`Generating ${count} ${category} profiles with pre-assigned proxies`);

        // Define country weights (PRIORITIZING US TRAFFIC)
        const countryWeights = [
            { code: 'us', weight: 60 },   // 60% - PRIORITIZED US market
            { code: 'gb', weight: 15 },   // 15% - UK market
            { code: 'ca', weight: 10 },   // 10% - Canada
            { code: 'au', weight: 8 },    // 8% - Australia
            { code: 'de', weight: 5 },    // 5% - Germany
            { code: 'ar', weight: 2 }     // 2% - Argentina (minimal)
        ];

        // Load all country proxies before profile generation
        const countryProxies = await this.loadAllCountryProxies();

        // Calculate how many profiles each country should get
        const countryDistribution = this.calculateCountryDistribution(count, countryWeights);

        // Generate profiles for each country with pre-assigned proxies
        for (const [countryCode, profileCount] of Object.entries(countryDistribution)) {
            const availableProxies = countryProxies[countryCode] || [];

            if (availableProxies.length === 0) {
                logger.warn(`No proxies available for country ${countryCode}, skipping ${profileCount} profiles`);
                continue;
            }

            for (let i = 0; i < profileCount; i++) {
                const profileId = uuidv4();
                const profileNumber = this.getNextProfileNumberForCountry(countryCode);

                // STRICT ISOLATION: Each profile gets a UNIQUE proxy (no reuse)
                if (i >= availableProxies.length) {
                    logger.warn(`Not enough unique proxies for ${countryCode}. Need ${profileCount}, have ${availableProxies.length}. Skipping remaining profiles.`);
                    break;
                }

                const assignedProxy = availableProxies[i]; // UNIQUE proxy per profile (no round-robin)

                // Mark proxy as permanently assigned to prevent reuse
                assignedProxy.isAssigned = true;
                assignedProxy.assignedProfileId = profileId;
                assignedProxy.assignedAt = new Date().toISOString();

                const profile = new Profile({
                    id: profileId,
                    profileNumber: profileNumber,
                    countryCode: countryCode.toUpperCase(),
                    category,
                    geographic: assignedProxy.geographic, // Pre-assign geographic data from proxy
                    assignedProxy: assignedProxy, // UNIQUE PROXY PER PROFILE
                    isolationLevel: 'strict' // Enable strict isolation
                });

                // Initialize isolated storage for this profile
                profile.initializeIsolatedStorage(config.paths.profiles);

                // Ensure storage directories exist
                await profile.ensureIsolatedStorageDirectories();

                this.addProfileToPool(profile);

                logger.info(`✅ Profile ${profileId} created with unique proxy and isolated storage`, {
                    country: countryCode,
                    proxyHost: assignedProxy.host,
                    storageDir: profile.isolatedStorage.userDataDir
                });
            }
        }

        logger.info(`✅ Generated ${count} ${category} profiles with pre-assigned proxies:`, countryDistribution);
    }

    /**
     * Load all country proxies from CSV files
     * @returns {Object} Object with country codes as keys and proxy arrays as values
     */
    async loadAllCountryProxies() {

        const countryProxies = {};
        const proxiesDir = path.resolve('./proxies');

        // Define country files mapping
        const countryFiles = {
            'us': 'us-proxies.csv',
            'gb': 'gb-proxies.csv',
            'ca': 'ca-proxies.csv',
            'au': 'au-proxies.csv',
            'de': 'de-proxies.csv',
            'ar': 'ar-proxies.csv'
        };

        for (const [countryCode, fileName] of Object.entries(countryFiles)) {
            const filePath = path.join(proxiesDir, fileName);

            try {
                if (await fs.pathExists(filePath)) {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('Proxy strings'));

                    const proxies = lines.map(line => {
                        const proxyString = line.trim();
                        const proxy = this.parseProxyString(proxyString, countryCode);
                        return proxy;
                    }).filter(proxy => proxy !== null);

                    countryProxies[countryCode] = proxies;
                    logger.info(`Loaded ${proxies.length} proxies for ${countryCode.toUpperCase()}`);
                } else {
                    logger.warn(`Proxy file not found: ${filePath}`);
                    countryProxies[countryCode] = [];
                }
            } catch (error) {
                logger.error(`Error loading proxies for ${countryCode}:`, error.message);
                countryProxies[countryCode] = [];
            }
        }

        const totalProxies = Object.values(countryProxies).reduce((sum, proxies) => sum + proxies.length, 0);
        logger.info(`✅ Loaded total ${totalProxies} proxies across all countries`);

        return countryProxies;
    }

    /**
     * Parse proxy string from CSV format
     * @param {string} proxyString - Proxy string from CSV
     * @param {string} countryCode - Country code
     * @returns {Object} Parsed proxy object
     */
    parseProxyString(proxyString, countryCode) {
        try {
            // Format: host:port:username:password
            const parts = proxyString.split(':');
            if (parts.length < 4) return null;

            const host = parts[0];
            const port = parseInt(parts[1]);
            const username = parts[2];
            const password = parts[3];

            // Extract session ID from username for sticky sessions
            const sessionIdMatch = username.match(/sid-([a-f0-9]+)/);
            const sessionId = sessionIdMatch ? sessionIdMatch[1] : uuidv4();

            return {
                id: uuidv4(),
                host,
                port,
                username,
                password,
                protocol: 'http',
                country: countryCode,
                sessionId,
                isActive: false,
                assignedProfile: null,
                createdAt: new Date().toISOString(),
                geographic: this.getCountryGeographic(countryCode)
            };
        } catch (error) {
            logger.error(`Error parsing proxy string: ${proxyString}`, error.message);
            return null;
        }
    }

    /**
     * Get geographic data for country
     * @param {string} countryCode - Country code
     * @returns {Object} Geographic data
     */
    getCountryGeographic(countryCode) {
        const countryData = {
            'us': {
                country: 'US',
                countryName: 'United States',
                timezone: 'America/New_York',
                language: 'en-US',
                currency: 'USD',
                region: 'North America'
            },
            'gb': {
                country: 'GB',
                countryName: 'United Kingdom',
                timezone: 'Europe/London',
                language: 'en-GB',
                currency: 'GBP',
                region: 'Europe'
            },
            'ca': {
                country: 'CA',
                countryName: 'Canada',
                timezone: 'America/Toronto',
                language: 'en-CA',
                currency: 'CAD',
                region: 'North America'
            },
            'au': {
                country: 'AU',
                countryName: 'Australia',
                timezone: 'Australia/Sydney',
                language: 'en-AU',
                currency: 'AUD',
                region: 'Oceania'
            },
            'de': {
                country: 'DE',
                countryName: 'Germany',
                timezone: 'Europe/Berlin',
                language: 'de-DE',
                currency: 'EUR',
                region: 'Europe'
            },
            'ar': {
                country: 'AR',
                countryName: 'Argentina',
                timezone: 'America/Argentina/Buenos_Aires',
                language: 'es-AR',
                currency: 'ARS',
                region: 'South America'
            }
        };

        return countryData[countryCode] || countryData['us']; // Default to US
    }

    /**
     * Add profile to the pool
     * @param {Profile} profile - Profile instance
     */
    addProfileToPool(profile) {
        // Ensure we're working with a proper Profile instance
        let profileInstance = profile;
        if (!(profile instanceof Profile)) {
            profileInstance = Profile.fromJSON(profile);
        }
        
        console.log('DEBUG: Adding profile to pool:', profileInstance.id);
        this.profiles.set(profileInstance.id, profileInstance);
        this.profilesByCategory[profileInstance.category].push(profileInstance.id);
    }

    /**
     * Save all profiles to disk
     */
    async saveAllProfiles() {
        const profilesDir = config.paths.profiles;
        const savePromises = [];

        for (const [profileId, profile] of this.profiles) {
            const fileName = profile.getFileName();
            // Save the profile JSON file inside the profile directory
            const profileDir = path.join(profilesDir, `profile_${profileId}`);
            const filePath = path.join(profileDir, fileName);
            savePromises.push(
                fs.ensureDir(profileDir).then(() => 
                    fs.writeJson(filePath, profile.toJSON(), { spaces: 2 })
                )
            );
        }

        await Promise.all(savePromises);
    }

    /**
     * Save individual profile to disk
     * @param {string} profileId - Profile ID
     */
    async saveProfile(profileId) {
        const profile = this.getProfile(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }

        console.log('DEBUG: Saving profile', profileId, 'with data:', profile);
        const fileName = profile.getFileName();
        // Save the profile JSON file inside the profile directory
        const profileDir = path.join(config.paths.profiles, `profile_${profileId}`);
        const filePath = path.join(profileDir, fileName);
        console.log('DEBUG: Saving profile to file:', filePath);
        await fs.ensureDir(profileDir); // Ensure the directory exists
        await fs.writeJson(filePath, profile.toJSON(), { spaces: 2 });
        console.log('DEBUG: Profile saved successfully');
    }

    /**
     * Get available profile for visit
     * @param {string} preferredCategory - Preferred profile category
     * @returns {Profile} Available profile
     */
    getAvailableProfile(preferredCategory = null) {
        if (!this.isInitialized) {
            throw new Error('Profile pool manager not initialized');
        }

        // Try to get profile from preferred category first
        if (preferredCategory && this.profilesByCategory[preferredCategory]) {
            const availableInCategory = this.profilesByCategory[preferredCategory]
                .filter(profileId => {
                    const profile = this.profiles.get(profileId);
                    // Ensure we're working with a proper Profile instance
                    if (!(profile instanceof Profile)) {
                        // Check if profile is not active AND browser is not running
                        return !profile.isActive || !this.itBrowserAPI.isBrowserActive(profile.session?.currentSessionId);
                    }
                    // Check if profile is not active AND browser is not running
                    return !profile.isActive || !this.itBrowserAPI.isBrowserActive(profile.session?.currentSessionId);
                });
            
            if (availableInCategory.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableInCategory.length);
                const profileId = availableInCategory[randomIndex];
                return this.getProfile(profileId);
            }
        }

        // If no preferred category or none available, get any available profile
        const allAvailable = Array.from(this.profiles.values())
            .filter(profile => {
                // Ensure we're working with a proper Profile instance
                if (!(profile instanceof Profile)) {
                    // Check if profile is not active AND browser is not running
                    return !profile.isActive || !this.itBrowserAPI.isBrowserActive(profile.session?.currentSessionId);
                }
                // Check if profile is not active AND browser is not running
                return !profile.isActive || !this.itBrowserAPI.isBrowserActive(profile.session?.currentSessionId);
            })
            .map(profile => {
                // Ensure we return proper Profile instances
                if (!(profile instanceof Profile)) {
                    return Profile.fromJSON(profile);
                }
                return profile;
            });

        if (allAvailable.length === 0) {
            throw new Error('No available profiles in pool');
        }

        const randomIndex = Math.floor(Math.random() * allAvailable.length);
        return allAvailable[randomIndex];
    }

    /**
     * Start session for profile
     * @param {string} profileId - Profile ID
     * @param {number} duration - Session duration in hours
     * @returns {string} Session ID
     */
    startSession(profileId, duration) {
        const profile = this.getProfile(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }

        if (profile.isActive) {
            throw new Error(`Profile ${profileId} is already active`);
        }

        const sessionId = uuidv4();
        profile.startSession(sessionId, duration);

        this.activeSessions.set(sessionId, {
            sessionId,
            profileId,
            startTime: new Date(),
            duration: duration * 60 * 60 * 1000, // Convert to milliseconds
            visitsCompleted: 0
        });

        logger.sessionStart(sessionId, profileId, duration);
        return sessionId;
    }

    /**
     * End session for profile
     * @param {string} sessionId - Session ID
     */
    async endSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const profile = this.getProfile(session.profileId);
        if (profile) {
            // Close the browser if it's still running
            if (profile.session.currentSessionId) {
                try {
                    await this.itBrowserAPI.closeBrowser(profile.session.currentSessionId);
                } catch (error) {
                    logger.warn('Failed to close browser gracefully during session end', { 
                        error: error.message, 
                        profileId: session.profileId, 
                        browserId: profile.session.currentSessionId 
                    });
                }
            }
            
            profile.endSession();
            
            const actualDuration = Date.now() - session.startTime.getTime();
            logger.sessionEnd(sessionId, session.profileId, actualDuration, session.visitsCompleted);
        }

        this.activeSessions.delete(sessionId);
    }

    /**
     * Update profile after visit
     * @param {string} profileId - Profile ID
     * @param {Object} visitData - Visit result data
     */
    async updateProfileAfterVisit(profileId, visitData) {
        const profile = this.getProfile(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }

        // Update profile metrics
        profile.updateMetrics(visitData);

        // Check for evolution
        const newCategory = profile.shouldEvolve();
        if (newCategory) {
            await this.evolveProfile(profileId, newCategory);
        }

        // Update session visit count
        if (profile.session.currentSessionId) {
            const session = this.activeSessions.get(profile.session.currentSessionId);
            if (session) {
                session.visitsCompleted++;
            }
        }

        // Save updated profile
        await this.saveProfile(profileId);

        logger.profileActivity(profileId, 'visit_completed', {
            success: visitData.success,
            duration: visitData.duration,
            totalVisits: profile.metrics.totalVisits,
            evolutionScore: profile.metrics.evolutionScore
        });
    }

    /**
     * Evolve profile to new category
     * @param {string} profileId - Profile ID
     * @param {string} newCategory - New category
     */
    async evolveProfile(profileId, newCategory) {
        const profile = this.getProfile(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }

        const oldCategory = profile.category;
        
        // Remove from old category
        const oldCategoryIndex = this.profilesByCategory[oldCategory].indexOf(profileId);
        if (oldCategoryIndex > -1) {
            this.profilesByCategory[oldCategory].splice(oldCategoryIndex, 1);
        }

        // Evolve profile (now async)
        await profile.evolve(newCategory);

        // Add to new category
        this.profilesByCategory[newCategory].push(profileId);

        logger.profileActivity(profileId, 'evolved', {
            fromCategory: oldCategory,
            toCategory: newCategory,
            evolutionScore: profile.metrics.evolutionScore
        });
    }

    /**
     * Get profile by ID
     * @param {string} profileId - Profile ID
     * @returns {Profile} Profile instance
     */
    getProfile(profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) return null;
        
        // Ensure we return a proper Profile instance
        if (!(profile instanceof Profile)) {
            return Profile.fromJSON(profile);
        }
        
        return profile;
    }

    /**
     * Get profiles by category
     * @param {string} category - Profile category
     * @returns {Array} Array of profiles
     */
    getProfilesByCategory(category) {
        return this.profilesByCategory[category]
            .map(profileId => this.getProfile(profileId))
            .filter(profile => profile);
    }

    /**
     * Get pool statistics
     * @returns {Object} Pool statistics
     */
    getPoolStatistics() {
        const stats = {
            total: this.profiles.size,
            active: 0,
            categories: {},
            sessions: {
                active: this.activeSessions.size,
                total: 0
            },
            performance: {
                avgSuccessRate: 0,
                avgEvolutionScore: 0
            }
        };

        // Calculate category and performance stats
        for (const [category, profileIds] of Object.entries(this.profilesByCategory)) {
            const categoryProfiles = profileIds.map(id => this.getProfile(id)).filter(p => p);
            
            stats.categories[category] = {
                total: categoryProfiles.length,
                active: categoryProfiles.filter(p => p.isActive).length,
                avgSuccessRate: this.calculateAvgSuccessRate(categoryProfiles),
                avgEvolutionScore: this.calculateAvgEvolutionScore(categoryProfiles)
            };

            stats.active += stats.categories[category].active;
        }

        // Calculate overall performance
        const allProfiles = Array.from(this.profiles.values());
        stats.performance.avgSuccessRate = this.calculateAvgSuccessRate(allProfiles);
        stats.performance.avgEvolutionScore = this.calculateAvgEvolutionScore(allProfiles);

        return stats;
    }

    /**
     * Calculate average success rate for profiles
     * @param {Array} profiles - Array of profiles
     * @returns {number} Average success rate
     */
    calculateAvgSuccessRate(profiles) {
        if (profiles.length === 0) return 0;
        
        const totalSuccessRate = profiles.reduce((sum, profile) => {
            const successRate = profile.metrics.totalVisits > 0 ? 
                profile.metrics.successfulVisits / profile.metrics.totalVisits : 0;
            return sum + successRate;
        }, 0);

        return totalSuccessRate / profiles.length;
    }

    /**
     * Calculate average evolution score for profiles
     * @param {Array} profiles - Array of profiles
     * @returns {number} Average evolution score
     */
    calculateAvgEvolutionScore(profiles) {
        if (profiles.length === 0) return 0;
        
        const totalEvolutionScore = profiles.reduce((sum, profile) => {
            return sum + profile.metrics.evolutionScore;
        }, 0);

        return totalEvolutionScore / profiles.length;
    }

    /**
     * Validate profile distribution (informational only)
     */
    async validateProfileDistribution() {
        const actualDistribution = {
            newVisitor: this.profilesByCategory.newVisitor.length,
            returningRegular: this.profilesByCategory.returningRegular.length,
            loyalUser: this.profilesByCategory.loyalUser.length
        };

        logger.info('Current profile distribution', actualDistribution);

        // Don't auto-generate profiles - they will be created via GUI
        if (this.profiles.size === 0) {
            logger.info('No profiles found. Use the GUI to create profiles or import from files.');
        }
    }

    /**
     * Cleanup expired sessions
     */
    async cleanupExpiredSessions() {
        const now = Date.now();
        const expiredSessions = [];

        for (const [sessionId, session] of this.activeSessions) {
            const sessionAge = now - session.startTime.getTime();
            if (sessionAge > session.duration) {
                expiredSessions.push(sessionId);
            }
        }

        for (const sessionId of expiredSessions) {
            await this.endSession(sessionId);
        }

        if (expiredSessions.length > 0) {
            logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
        }
    }

    /**
     * Get the next available profile number
     * @returns {number} Next profile number
     */
    getNextProfileNumber() {
        return ++this.profileNumberCounter;
    }

    /**
     * Update profile number counter based on existing profiles
     */
    updateProfileNumberCounter() {
        // This method is now deprecated - use updateCountryProfileCounters instead
        this.updateCountryProfileCounters();
    }

    /**
     * Calculate country distribution for profiles
     * @param {number} totalCount - Total number of profiles to distribute
     * @param {Array} countryWeights - Array of country weight objects
     * @returns {Object} Distribution of profiles per country
     */
    calculateCountryDistribution(totalCount, countryWeights) {
        const distribution = {};
        let remaining = totalCount;

        // Calculate profiles for each weighted country
        for (const country of countryWeights) {
            const profileCount = Math.floor(totalCount * (country.weight / 100));
            distribution[country.code] = profileCount;
            remaining -= profileCount;
        }

        // Distribute remaining profiles to US (primary market)
        if (remaining > 0) {
            distribution.us = (distribution.us || 0) + remaining;
        }

        return distribution;
    }

    /**
     * Get next available profile number for a specific country
     * @param {string} countryCode - Country code (us, gb, ca, etc.)
     * @returns {number} Next profile number for that country
     */
    getNextProfileNumberForCountry(countryCode) {
        if (!this.countryProfileCounters[countryCode]) {
            this.countryProfileCounters[countryCode] = 0;
        }
        return ++this.countryProfileCounters[countryCode];
    }

    /**
     * Update country profile counters based on existing profiles
     */
    updateCountryProfileCounters() {
        // Reset counters
        this.countryProfileCounters = {
            us: 0,
            gb: 0,
            ca: 0,
            au: 0,
            de: 0
        };

        // Find max profile number for each country
        for (const profile of this.profiles.values()) {
            if (profile.countryCode && profile.profileNumber) {
                const currentMax = this.countryProfileCounters[profile.countryCode] || 0;
                if (profile.profileNumber > currentMax) {
                    this.countryProfileCounters[profile.countryCode] = profile.profileNumber;
                }
            }
        }

        logger.info('📊 Country profile counters updated:', this.countryProfileCounters);
    }

    /**
     * Assign country for legacy profile based on weighted distribution
     * @returns {string} Country code
     */
    assignCountryForLegacyProfile() {
        const countryWeights = [
            { code: 'us', weight: 48 },
            { code: 'gb', weight: 12 },
            { code: 'ca', weight: 8 },
            { code: 'au', weight: 6.4 },
            { code: 'de', weight: 5.6 }
        ];

        const totalWeight = countryWeights.reduce((sum, country) => sum + country.weight, 0);
        let random = Math.random() * totalWeight;

        for (const country of countryWeights) {
            random -= country.weight;
            if (random <= 0) {
                return country.code;
            }
        }

        // Fallback to US
        return 'us';
    }

    /**
     * Get profile by ID
     * @param {string} profileId - Profile ID
     * @returns {Profile|null} Profile object or null if not found
     */
    getProfileById(profileId) {
        const profile = this.profiles.get(profileId);
        if (!profile) return null;
        
        // Ensure we return a proper Profile instance
        if (!(profile instanceof Profile)) {
            return Profile.fromJSON(profile);
        }
        
        return profile;
    }

    /**
     * Get all profiles
     * @returns {Array} Array of all profiles
     */
    getAllProfiles() {
        console.log('Debug: Getting all profiles from map, count:', this.profiles.size);
        console.log('Debug: Profiles map keys:', Array.from(this.profiles.keys()));
        const profiles = Array.from(this.profiles.values()).map(profile => {
            // Ensure we return proper Profile instances
            if (!(profile instanceof Profile)) {
                console.log('Debug: Converting profile from JSON:', profile.id);
                return Profile.fromJSON(profile);
            }
            console.log('Debug: Returning existing profile:', profile.id);
            return profile;
        });
        console.log('Debug: Returning profiles array, count:', profiles.length);
        return profiles;
    }

    /**
     * Save individual profile to disk
     * @param {Profile} profile - Profile to save
     */
    async saveProfileObject(profile) {
        try {
            // Ensure we're working with a proper Profile instance
            let profileInstance = profile;
            if (!(profile instanceof Profile)) {
                profileInstance = Profile.fromJSON(profile);
            }
            
            const fileName = profileInstance.getFileName();
            // Save the profile JSON file inside the profile directory
            const profileDir = path.join(config.paths.profiles, `profile_${profileInstance.id}`);
            const filePath = path.join(profileDir, fileName);
            await fs.ensureDir(profileDir); // Ensure the directory exists
            await fs.writeJson(filePath, profileInstance.toJSON(), { spaces: 2 });
            logger.debug(`Profile ${profileInstance.id} saved to ${fileName}`);
        } catch (error) {
            logger.error(`Error saving profile ${profile.id || profile?.id}:`, error.message);
            throw error;
        }
    }

    /**
     * Handle proxy expiration for a profile
     * @param {string} profileId - Profile ID
     * @param {Object} expiredProxy - Expired proxy object
     * @param {Object} newProxy - New proxy object
     */
    async handleProxyExpiration(profileId, expiredProxy, newProxy) {
        try {
            const profile = this.getProfileById(profileId);
            if (!profile) {
                throw new Error(`Profile ${profileId} not found`);
            }

            logger.info(`🔄 Handling proxy expiration for profile ${profileId}`, {
                oldProxy: `${expiredProxy.host}:${expiredProxy.port}`,
                newProxy: `${newProxy.host}:${newProxy.port}`,
                country: profile.countryCode
            });

            // Update profile with new proxy
            profile.assignedProxy = newProxy;

            // Update geographic data if needed
            if (newProxy.geographic) {
                profile.geographic = newProxy.geographic;
            }

            // Add expiration event to profile history
            if (!profile.proxyHistory) {
                profile.proxyHistory = [];
            }

            profile.proxyHistory.push({
                event: 'proxy_expired',
                timestamp: new Date().toISOString(),
                oldProxy: {
                    host: expiredProxy.host,
                    port: expiredProxy.port,
                    sessionId: expiredProxy.sessionId
                },
                newProxy: {
                    host: newProxy.host,
                    port: newProxy.port,
                    sessionId: newProxy.sessionId
                }
            });

            // Save updated profile
            await this.saveProfileObject(profile);

            logger.info(`✅ Profile ${profileId} updated with new proxy successfully`);

        } catch (error) {
            logger.error(`Error handling proxy expiration for profile ${profileId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get profiles with expired proxies
     * @returns {Array} Array of profile IDs with proxy issues
     */
    getProfilesWithProxyIssues() {
        const profilesWithIssues = [];

        for (const [profileId, profileData] of this.profiles) {
            // Ensure we're working with a proper Profile instance
            const profile = this.getProfile(profileId);
            
            if (!profile.assignedProxy ||
                profile.assignedProxy.expiredAt ||
                !profile.assignedProxy.isActive) {
                profilesWithIssues.push({
                    profileId,
                    country: profile.countryCode,
                    category: profile.category,
                    issue: profile.assignedProxy ? 'expired' : 'no_proxy'
                });
            }
        }

        return profilesWithIssues;
    }

    /**
     * Temporarily disable profile due to proxy issues
     * @param {string} profileId - Profile ID to disable
     * @param {string} reason - Reason for disabling
     */
    async disableProfile(profileId, reason = 'proxy_unavailable') {
        try {
            const profile = this.getProfileById(profileId);
            if (!profile) {
                throw new Error(`Profile ${profileId} not found`);
            }

            profile.isActive = false;
            profile.disabledAt = new Date().toISOString();
            profile.disabledReason = reason;

            await this.saveProfileObject(profile);

            logger.warn(`⚠️ Profile ${profileId} disabled due to: ${reason}`);

        } catch (error) {
            logger.error(`Error disabling profile ${profileId}:`, error.message);
        }
    }

    /**
     * Re-enable profile when proxy becomes available
     * @param {string} profileId - Profile ID to re-enable
     * @param {Object} newProxy - New proxy for the profile
     */
    async enableProfile(profileId, newProxy) {
        try {
            const profile = this.getProfileById(profileId);
            if (!profile) {
                throw new Error(`Profile ${profileId} not found`);
            }

            profile.isActive = true;
            profile.assignedProxy = newProxy;
            delete profile.disabledAt;
            delete profile.disabledReason;

            await this.saveProfileObject(profile);

            logger.info(`✅ Profile ${profileId} re-enabled with new proxy`);

        } catch (error) {
            logger.error(`Error enabling profile ${profileId}:`, error.message);
        }
    }

    /**
     * Import profiles from CSV file
     * @param {string} filePath - Path to CSV file
     * @param {Object} options - Import options
     * @returns {Object} Import result
     */
    async importProfilesFromCSV(filePath, options = {}) {
        try {
            const results = [];
            const errors = [];
            let lineNumber = 0;

            return new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (data) => {
                        lineNumber++;
                        try {
                            const profile = this.parseProfileData(data, lineNumber, 'csv');
                            if (profile) {
                                results.push(profile);
                            }
                        } catch (error) {
                            errors.push({
                                line: lineNumber,
                                error: error.message,
                                data
                            });
                        }
                    })
                    .on('end', async () => {
                        try {
                            const importResult = await this.processImportedProfiles(results, options);
                            resolve({
                                success: true,
                                imported: importResult.imported,
                                skipped: importResult.skipped,
                                errors,
                                total: lineNumber
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', reject);
            });

        } catch (error) {
            logger.error('Error importing profiles from CSV', { error: error.message, filePath });
            throw error;
        }
    }

    /**
     * Import profiles from TXT file (one profile per line)
     * @param {string} filePath - Path to TXT file
     * @param {Object} options - Import options
     * @returns {Object} Import result
     */
    async importProfilesFromTXT(filePath, options = {}) {
        try {
            const fileContent = await fs.readFile(filePath, 'utf8');
            const lines = fileContent.split('\n').filter(line => line.trim());

            const results = [];
            const errors = [];

            for (let i = 0; i < lines.length; i++) {
                const lineNumber = i + 1;
                try {
                    const profile = this.parseProfileData(lines[i], lineNumber, 'txt');
                    if (profile) {
                        results.push(profile);
                    }
                } catch (error) {
                    errors.push({
                        line: lineNumber,
                        error: error.message,
                        data: lines[i]
                    });
                }
            }

            const importResult = await this.processImportedProfiles(results, options);

            return {
                success: true,
                imported: importResult.imported,
                skipped: importResult.skipped,
                errors,
                total: lines.length
            };

        } catch (error) {
            logger.error('Error importing profiles from TXT', { error: error.message, filePath });
            throw error;
        }
    }

    /**
     * Parse profile data from imported file
     * @param {Object|string} data - Profile data
     * @param {number} lineNumber - Line number for error reporting
     * @param {string} format - File format (csv/txt)
     * @returns {Object} Parsed profile
     */
    parseProfileData(data, lineNumber, format) {
        try {
            let profileData;

            if (format === 'csv') {
                // Expected CSV columns: name, category, country, proxy, userAgent, etc.
                profileData = {
                    name: data.name || `Imported Profile ${lineNumber}`,
                    category: data.category || 'newVisitor',
                    countryCode: data.country || data.countryCode || 'us',
                    proxy: data.proxy,
                    userAgent: data.userAgent,
                    viewport: data.viewport ? JSON.parse(data.viewport) : null,
                    timezone: data.timezone,
                    language: data.language || 'en-US'
                };
            } else if (format === 'txt') {
                // Try to parse JSON or use as simple profile name
                if (data.trim().startsWith('{')) {
                    profileData = JSON.parse(data);
                } else {
                    profileData = {
                        name: data.trim() || `Imported Profile ${lineNumber}`,
                        category: 'newVisitor',
                        countryCode: 'us'
                    };
                }
            }

            // Validate required fields
            if (!profileData.name) {
                throw new Error('Profile name is required');
            }

            return profileData;

        } catch (error) {
            throw new Error(`Failed to parse profile data: ${error.message}`);
        }
    }

    /**
     * Process imported profiles and create Profile instances
     * @param {Array} profilesData - Array of profile data
     * @param {Object} options - Processing options
     * @returns {Object} Processing result
     */
    async processImportedProfiles(profilesData, options = {}) {
        const imported = [];
        const skipped = [];
        const autoAssignProxies = options.autoAssignProxies !== false;

        for (const profileData of profilesData) {
            try {
                // Check if profile already exists
                const existingProfile = this.findProfileByName(profileData.name);
                if (existingProfile && !options.allowDuplicates) {
                    skipped.push({
                        name: profileData.name,
                        reason: 'Profile already exists'
                    });
                    continue;
                }

                // Generate unique ID
                const profileId = uuidv4();
                const profileNumber = this.getNextProfileNumber(profileData.countryCode);

                // Auto-assign proxy if enabled
                let assignedProxy = null;
                if (autoAssignProxies) {
                    const availableProxies = await this.proxyManager.getAvailableProxies(profileData.countryCode);
                    if (availableProxies.length > 0) {
                        assignedProxy = availableProxies[0];
                        assignedProxy.isAssigned = true;
                        assignedProxy.assignedProfileId = profileId;
                        assignedProxy.assignedAt = new Date().toISOString();
                    }
                }

                // Create profile instance
                const profile = new Profile({
                    id: profileId,
                    profileNumber,
                    name: profileData.name,
                    countryCode: profileData.countryCode,
                    category: profileData.category,
                    assignedProxy,
                    userAgent: profileData.userAgent,
                    viewport: profileData.viewport,
                    timezone: profileData.timezone,
                    language: profileData.language,
                    isolationLevel: 'strict',
                    imported: true,
                    importedAt: new Date().toISOString()
                });

                // Add to pool
                this.profiles.set(profileId, profile);
                this.profilesByCategory[profile.category].push(profile);

                imported.push({
                    id: profileId,
                    name: profile.name,
                    category: profile.category,
                    country: profile.countryCode
                });

                logger.info('Imported profile', {
                    profileId,
                    name: profile.name,
                    category: profile.category,
                    country: profile.countryCode
                });

            } catch (error) {
                skipped.push({
                    name: profileData.name,
                    reason: error.message
                });
                logger.warn('Skipped profile during import', {
                    name: profileData.name,
                    error: error.message
                });
            }
        }

        // Save imported profiles
        if (imported.length > 0) {
            await this.saveAllProfiles();
        }

        return { imported, skipped };
    }

    /**
     * Find profile by name
     * @param {string} name - Profile name
     * @returns {Object|null} Profile or null
     */
    findProfileByName(name) {
        for (const profile of this.profiles.values()) {
            if (profile.name === name) {
                return profile;
            }
        }
        return null;
    }

    /**
     * Bulk assign profiles to specific campaigns or targets
     * @param {Array} profileIds - Array of profile IDs
     * @param {Object} assignment - Assignment configuration
     * @returns {Object} Assignment result
     */
    async bulkAssignProfiles(profileIds, assignment) {
        const results = {
            assigned: [],
            failed: []
        };

        for (const profileId of profileIds) {
            try {
                const profile = this.getProfile(profileId);
                if (!profile) {
                    results.failed.push({
                        profileId,
                        reason: 'Profile not found'
                    });
                    continue;
                }

                // Apply assignment
                if (assignment.targetUrls) {
                    profile.assignedTargets = assignment.targetUrls;
                }
                if (assignment.campaign) {
                    profile.assignedCampaign = assignment.campaign;
                }
                if (assignment.schedule) {
                    profile.schedule = assignment.schedule;
                }
                if (assignment.behavior) {
                    profile.behaviorOverrides = assignment.behavior;
                }

                profile.lastAssignedAt = new Date().toISOString();

                results.assigned.push({
                    profileId,
                    name: profile.name,
                    assignment
                });

                logger.info('Profile assigned', {
                    profileId,
                    assignment
                });

            } catch (error) {
                results.failed.push({
                    profileId,
                    reason: error.message
                });
            }
        }

        // Save changes
        await this.saveAllProfiles();

        return results;
    }

    /**
     * Delete a profile
     * @param {string} profileId - Profile ID to delete
     * @returns {boolean} True if profile was deleted, false if not found
     */
    async deleteProfile(profileId) {
        try {
            console.log('Attempting to delete profile with ID:', profileId);
            const profile = this.getProfile(profileId);
            if (!profile) {
                console.log('Profile not found:', profileId);
                return false;
            }

            // Remove from main profiles map
            this.profiles.delete(profileId);

            // Remove from category arrays
            for (const category in this.profilesByCategory) {
                const index = this.profilesByCategory[category].findIndex(p => p.id === profileId);
                if (index !== -1) {
                    this.profilesByCategory[category].splice(index, 1);
                }
            }

            // Release assigned proxy
            if (profile.assignedProxy) {
                profile.assignedProxy.isAssigned = false;
                profile.assignedProxy.assignedProfileId = null;
                profile.assignedProxy.assignedAt = null;
            }

            // Remove profile directory
            const profileDir = path.join(config.paths.profiles, `profile_${profileId}`);
            console.log('Constructed profile directory path:', profileDir);
            if (await fs.pathExists(profileDir)) {
                console.log('Profile directory exists, removing:', profileDir);
                await fs.remove(profileDir);
                console.log('Profile directory removed successfully:', profileDir);
            } else {
                console.log('Profile directory not found:', profileDir);
            }

            logger.info('Profile deleted', {
                profileId,
                name: profile.name,
                category: profile.category
            });
            console.log('Profile deleted successfully:', profileId);

            return true;

        } catch (error) {
            console.error('Error deleting profile', {
                profileId,
                error: error.message
            });
            logger.error('Error deleting profile', {
                profileId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Create a new profile
     * @param {Object} profileData - Data for the new profile
     * @returns {Profile} Created profile
     */
    async createProfile(profileData) {
        try {
            console.log('Debug: Creating profile with data', profileData);
            
            // Extract config data and set autoAssignProxy to true by default
            const profileConfig = profileData.config || {};
            // Always auto-assign proxy unless explicitly disabled
            profileConfig.autoAssignProxy = profileConfig.autoAssignProxy !== false;
            
            // Generate unique ID
            const profileId = uuidv4();
            console.log('Debug: Generated profile ID', profileId);
            
            // Ensure country code is lowercase for consistency with proxies
            const normalizedCountryCode = (profileConfig.countryCode || 'us').toLowerCase();
            
            // Get profile number
            const profileNumber = this.getNextProfileNumberForCountry(normalizedCountryCode);
            console.log('Debug: Generated profile number', profileNumber);
            
            // Auto-assign proxy by default (always true)
            let assignedProxy = null;
            let geographicData = null;
            if (profileConfig.autoAssignProxy !== false) { // This will now always be true unless explicitly set to false
                console.log('Debug: Attempting to auto-assign proxy for country', normalizedCountryCode);
                // Use healthiest proxies instead of just available ones
                const healthyProxies = this.proxyManager.getHealthiestProxies(normalizedCountryCode, 5);
                console.log('Debug: Healthy proxies count', healthyProxies.length);
                if (healthyProxies.length > 0) {
                    assignedProxy = healthyProxies[0];
                    assignedProxy.isAssigned = true;
                    assignedProxy.assignedProfileId = profileId;
                    assignedProxy.assignedAt = new Date().toISOString();
                    console.log('Debug: Assigned proxy', assignedProxy.host, assignedProxy.port);
                    // Get geographic data from the assigned proxy
                    geographicData = assignedProxy.geolocation || assignedProxy.geographic;
                } else {
                    // Fallback to available proxies if no healthy ones found
                    const availableProxies = this.proxyManager.getAvailableProxies(normalizedCountryCode);
                    console.log('Debug: Available proxies count', availableProxies.length);
                    if (availableProxies.length > 0) {
                        assignedProxy = availableProxies[0];
                        assignedProxy.isAssigned = true;
                        assignedProxy.assignedProfileId = profileId;
                        assignedProxy.assignedAt = new Date().toISOString();
                        console.log('Debug: Assigned fallback proxy', assignedProxy.host, assignedProxy.port);
                        // Get geographic data from the assigned proxy
                        geographicData = assignedProxy.geolocation || assignedProxy.geographic;
                    }
                }
            }
            
            // Create profile instance
            console.log('Debug: Creating profile instance with data', {
                id: profileId,
                profileNumber,
                name: profileData.name,
                config: profileConfig,
                countryCode: profileConfig.countryCode || 'US',
                category: profileConfig.category || 'newVisitor',
                geographic: geographicData,
                assignedProxy,
                userAgent: profileConfig.userAgent,
                viewport: profileConfig.viewport,
                timezone: profileConfig.timezone,
                language: profileConfig.language,
                isolationLevel: profileConfig.isolationLevel || 'strict',
                createdAt: new Date().toISOString()
            });
            
            const profile = new Profile({
                id: profileId,
                profileNumber,
                name: profileData.name,
                config: profileConfig,
                countryCode: normalizedCountryCode,
                category: profileConfig.category || 'newVisitor',
                geographic: geographicData,
                assignedProxy,
                userAgent: profileConfig.userAgent,
                viewport: profileConfig.viewport,
                timezone: profileConfig.timezone,
                language: profileConfig.language,
                isolationLevel: profileConfig.isolationLevel || 'strict',
                createdAt: new Date().toISOString()
            });
            
            // Generate initial fingerprint for the profile if we have a proxy assigned
            if (assignedProxy) {
                try {
                    console.log('Debug: Generating initial fingerprint for profile');
                    const fingerprint = await this.itBrowserAPI.generateFingerprint(profile, {
                        geographic: geographicData
                    });
                    
                    console.log('Debug: Generated fingerprint data:', fingerprint);
                    
                    // Update profile with fingerprint data (data is nested inside the fingerprint object)
                    if (fingerprint.data && fingerprint.data.userAgent) {
                        profile.userAgent = fingerprint.data.userAgent;
                        console.log('Debug: Set profile userAgent to:', fingerprint.data.userAgent);
                    }
                    if (fingerprint.data && fingerprint.data.viewport) {
                        profile.viewport = fingerprint.data.viewport;
                        console.log('Debug: Set profile viewport to:', fingerprint.data.viewport);
                    }
                    if (fingerprint.data && fingerprint.data.timezone) {
                        profile.timezone = fingerprint.data.timezone;
                        console.log('Debug: Set profile timezone to:', fingerprint.data.timezone);
                    }
                    if (fingerprint.data && fingerprint.data.language) {
                        profile.language = fingerprint.data.language;
                        console.log('Debug: Set profile language to:', fingerprint.data.language);
                    }
                    
                    // Store fingerprint ID in profile
                    if (fingerprint.id) {
                        profile.fingerprint.currentFingerprintId = fingerprint.id;
                        console.log('Debug: Set profile fingerprint ID to:', fingerprint.id);
                        
                        // Initialize fingerprint history if it doesn't exist
                        if (!profile.fingerprint.fingerprintHistory) {
                            profile.fingerprint.fingerprintHistory = [];
                        }
                        
                        // Add initial fingerprint to history
                        profile.fingerprint.fingerprintHistory.push({
                            fingerprintId: fingerprint.id,
                            createdAt: new Date().toISOString(),
                            isFirst: true
                        });
                    }
                    
                    console.log('Debug: Initial fingerprint generated successfully');
                } catch (error) {
                    console.error('Debug: Failed to generate initial fingerprint', error.message);
                    // Continue without fingerprint if generation fails
                }
            }
            
            // Initialize isolated storage for the new profile
            profile.initializeIsolatedStorage(config.paths.profiles);
            await profile.ensureIsolatedStorageDirectories();
            
            // Add to pool
            console.log('DEBUG: Adding profile to pool');
            this.addProfileToPool(profile);
            
            // Save profile
            console.log('Debug: Saving profile');
            await this.saveProfile(profileId);
            
            logger.info('Profile created', {
                profileId,
                name: profile.name,
                category: profile.category,
                country: profile.countryCode
            });
            
            return profile;
        } catch (error) {
            console.error('Failed to create profile', { error: error.message, stack: error.stack });
            logger.error('Failed to create profile', { error: error.message });
            throw error;
        }
    }

    /**
     * Launch a browser with the specified profile
     * @param {string} profileId - Profile ID to launch
     * @param {Object} options - Launch options
     * @returns {Object} Launch result
     */
    async launchProfile(profileId, options = {}) {
        try {
            console.log('Debug: Launching profile', { profileId, options });
            
            // Get the profile
            const profile = this.getProfileById(profileId);
            if (!profile) {
                throw new Error(`Profile not found: ${profileId}`);
            }
            
            let fingerprint;
            
            // Check if profile already has a current fingerprint and we should reuse it
            if (profile.fingerprint && profile.fingerprint.currentFingerprintId && options.reuseFingerprint !== false) {
                console.log('Debug: Reusing existing fingerprint for profile', { 
                    profileId, 
                    fingerprintId: profile.fingerprint.currentFingerprintId 
                });
                
                // Try to get the existing fingerprint from cache
                fingerprint = this.itBrowserAPI.constructor.fingerprintCache.get(profile.fingerprint.currentFingerprintId);
                
                // If not in cache, try to load it from file
                if (!fingerprint) {
                    const fs = require('fs-extra');
                    const path = require('path');
                    const config = require('../../shared/config/config');
                    
                    const profileDirName = `profile_${profile.id}`;
                    const profileDir = path.join(config.paths.profiles, profileDirName);
                    const fingerprintPath = path.join(
                        profileDir,
                        `fingerprint_${profile.fingerprint.currentFingerprintId}.json`
                    );
                    
                    if (await fs.pathExists(fingerprintPath)) {
                        const fingerprintData = await fs.readJson(fingerprintPath);
                        fingerprint = {
                            id: profile.fingerprint.currentFingerprintId,
                            profileId: profile.id,
                            profileNumber: profile.profileNumber,
                            countryCode: profile.countryCode,
                            profileDirName: profileDirName,
                            category: profile.category,
                            data: fingerprintData,
                            filePath: fingerprintPath,
                            createdAt: new Date().toISOString()
                        };
                        
                        // Add to cache
                        this.itBrowserAPI.constructor.fingerprintCache.set(profile.fingerprint.currentFingerprintId, fingerprint);
                    }
                }
            }
            
            // If we still don't have a fingerprint, generate a new one
            if (!fingerprint) {
                console.log('Debug: Generating new fingerprint for profile', { profileId });
                fingerprint = await this.itBrowserAPI.generateFingerprint(profile, options);
                
                // Update profile with the new fingerprint ID
                profile.fingerprint.currentFingerprintId = fingerprint.id;
            }
            
            // Prepare launch options with proxy information from profile
            const launchOptions = {
                ...options,
                isDirectLaunch: true,
                autoLaunch: options.autoLaunch || false,
                autoOpenPage: options.autoOpenPage || [],
                tempPort: options.tempPort || "",
                useProxy: options.useProxy !== false // Default to true unless explicitly set to false
            };
            
            // Add proxy information if available and requested
            console.log('Debug: Checking proxy conditions', {
                useProxyOption: options.useProxy,
                hasAssignedProxy: !!profile.assignedProxy,
                useProxy: options.useProxy !== false && !!profile.assignedProxy
            });
            
            if (options.useProxy !== false && profile.assignedProxy) {
                // Format proxy configuration for IT Browser - maintaining original structure
                launchOptions.proxy = {
                    id: profile.assignedProxy.id,
                    host: profile.assignedProxy.host,
                    port: profile.assignedProxy.port,
                    username: profile.assignedProxy.username || "",
                    password: profile.assignedProxy.password || "",
                    country: profile.assignedProxy.country || profile.assignedProxy.geolocation?.country || "us",
                    protocol: profile.assignedProxy.protocol || "http",
                    geolocation: profile.assignedProxy.geolocation || profile.assignedProxy.geographic || null
                };
                console.log('Debug: Added proxy to launch options', launchOptions.proxy);
                console.log('Debug: Full assignedProxy data:', JSON.stringify(profile.assignedProxy, null, 2));
            } else {
                console.log('Debug: No proxy assigned or proxy use disabled', {
                    useProxy: options.useProxy,
                    hasAssignedProxy: !!profile.assignedProxy
                });
            }
            
            // Launch the browser with the fingerprint
            console.log('Debug: Launching browser with fingerprint', { fingerprintId: fingerprint.id });
            console.log('Debug: Launch options:', JSON.stringify(launchOptions, null, 2));
            const browserResult = await this.itBrowserAPI.launchBrowser(fingerprint.id, launchOptions);
            
            // Update profile status to active and store browser ID
            profile.isActive = true;
            profile.session.currentSessionId = browserResult.browserId;
            profile.session.sessionStartTime = new Date().toISOString();
            
            // Update fingerprint history if we have a fingerprint
            if (fingerprint && fingerprint.id) {
                // Initialize fingerprint history if it doesn't exist
                if (!profile.fingerprint.fingerprintHistory) {
                    profile.fingerprint.fingerprintHistory = [];
                }
                
                // Add fingerprint usage to history
                profile.fingerprint.fingerprintHistory.push({
                    fingerprintId: fingerprint.id,
                    usedAt: new Date().toISOString(),
                    browserId: browserResult.browserId
                });
                
                // Keep only the last 10 fingerprint usages to prevent history from growing too large
                if (profile.fingerprint.fingerprintHistory.length > 10) {
                    profile.fingerprint.fingerprintHistory = profile.fingerprint.fingerprintHistory.slice(-10);
                }
            }
            
            // Save the updated profile
            await this.saveProfile(profileId);
            
            logger.info('Profile launched successfully', {
                profileId,
                browserId: browserResult.browserId,
                hasProxy: options.useProxy,
                reusedFingerprint: !!profile.fingerprint.currentFingerprintId
            });
            
            return {
                success: true,
                message: 'Profile launched successfully',
                browserId: browserResult.browserId,
                has_proxy: options.useProxy || false,
                reused_fingerprint: !!profile.fingerprint.currentFingerprintId
            };
            
        } catch (error) {
            console.error('Failed to launch profile', { error: error.message, stack: error.stack });
            logger.error('Failed to launch profile', { error: error.message, profileId });
            throw error;
        }
    }

    /**
     * Assign a proxy to an existing profile
     * @param {string} profileId - Profile ID
     * @param {string} proxyId - Proxy ID (optional, if not provided will auto-assign)
     * @returns {Object} Assignment result
     */
    async assignProxyToProfile(profileId, proxyId) {
        try {
            // Get the profile
            const profile = this.getProfileById(profileId);
            if (!profile) {
                throw new Error(`Profile not found: ${profileId}`);
            }
            
            // If no proxyId provided, auto-assign based on profile's country
            if (!proxyId) {
                const countryCode = profile.countryCode || 'us';
                // Use healthiest proxies instead of just available ones
                const healthyProxies = this.proxyManager.getHealthiestProxies(countryCode, 5);
                
                let assignedProxy = null;
                if (healthyProxies.length > 0) {
                    assignedProxy = healthyProxies[0];
                } else {
                    // Fallback to available proxies if no healthy ones found
                    const availableProxies = this.proxyManager.getAvailableProxies(countryCode);
                    if (availableProxies.length > 0) {
                        assignedProxy = availableProxies[0];
                    }
                }
                
                if (assignedProxy) {
                    assignedProxy.isAssigned = true;
                    assignedProxy.assignedProfileId = profileId;
                    assignedProxy.assignedAt = new Date().toISOString();
                    
                    profile.assignedProxy = assignedProxy;
                    
                    // Save the updated profile
                    await this.saveProfile(profileId);
                    
                    logger.info('Proxy auto-assigned to profile', {
                        profileId,
                        proxyId: assignedProxy.id,
                        country: countryCode
                    });
                    
                    return {
                        success: true,
                        message: 'Proxy auto-assigned to profile',
                        profileId: profile.id,
                        proxy: assignedProxy
                    };
                } else {
                    throw new Error(`No available proxies for country ${countryCode}`);
                }
            } else {
                // Assign specific proxy
                const proxy = this.proxyManager.getProxyById(proxyId);
                if (!proxy) {
                    throw new Error(`Proxy not found: ${proxyId}`);
                }
                
                // Check if proxy is already assigned
                if (proxy.isAssigned && proxy.assignedProfileId !== profileId) {
                    throw new Error('Proxy is already assigned to another profile');
                }
                
                // If profile already has a proxy, unassign it first
                if (profile.assignedProxy) {
                    const oldProxy = this.proxyManager.getProxyById(profile.assignedProxy.id);
                    if (oldProxy) {
                        oldProxy.isAssigned = false;
                        oldProxy.assignedProfileId = null;
                        oldProxy.assignedAt = null;
                    }
                }
                
                // Assign the new proxy
                proxy.isAssigned = true;
                proxy.assignedProfileId = profileId;
                proxy.assignedAt = new Date().toISOString();
                
                profile.assignedProxy = proxy;
                
                // Save the updated profile
                await this.saveProfile(profileId);
                
                logger.info('Proxy assigned to profile', {
                    profileId,
                    proxyId: proxy.id
                });
                
                return {
                    success: true,
                    message: 'Proxy assigned to profile successfully',
                    profileId: profile.id,
                    proxy: proxy
                };
            }
        } catch (error) {
            logger.error('Failed to assign proxy to profile', { error: error.message, profileId, proxyId });
            throw error;
        }
    }

    /**
     * Save individual profile to disk
     * @param {string} profileId - Profile ID to save
     */
    async saveProfile(profileId) {
        const profile = this.getProfileById(profileId);
        if (!profile) {
            throw new Error(`Profile not found: ${profileId}`);
        }
        return await this.saveProfileObject(profile);
    }
}

module.exports = new ProfilePoolManager();
