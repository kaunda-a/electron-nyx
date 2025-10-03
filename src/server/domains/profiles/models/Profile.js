const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const LLMService = require('../services/llmService');

class Profile {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.name = data.name || null;
        this.config = data.config || {};
        this.profileNumber = data.profileNumber || null; // Sequential number for file naming (e.g., 1, 2, 3...)
        this.countryCode = data.countryCode || null; // Country code for profile (us, gb, ca, etc.)
        this.category = data.category || 'newVisitor'; // newVisitor, returningRegular, loyalUser
        this.createdAt = data.createdAt || new Date().toISOString();
        this.lastUsed = data.lastUsed || null;
        this.isActive = data.isActive || false;

        // Geographic assignment
        this.geographic = data.geographic || null;

        // Pre-assigned proxy (NEW: Direct proxy assignment during profile creation)
        this.assignedProxy = data.assignedProxy || null;

        // Isolation settings (NEW: Strict isolation per profile)
        this.isolationLevel = data.isolationLevel || 'strict';
        this.isolatedStorage = {
            userDataDir: data.isolatedStorage?.userDataDir || null, // Unique browser data directory
            cookiesFile: data.isolatedStorage?.cookiesFile || null, // Isolated cookies storage
            cacheDir: data.isolatedStorage?.cacheDir || null, // Isolated cache directory
            indexedDBDir: data.isolatedStorage?.indexedDBDir || null, // Isolated IndexedDB
            localStorageFile: data.isolatedStorage?.localStorageFile || null, // Isolated localStorage
            sessionStorageFile: data.isolatedStorage?.sessionStorageFile || null // Isolated sessionStorage
        };

        // Behavioral characteristics
        this.behavioral = {
            bounceRate: data.behavioral?.bounceRate || this.generateBounceRate(),
            avgSessionDuration: data.behavioral?.avgSessionDuration || this.generateSessionDuration(),
            pagesPerSession: data.behavioral?.pagesPerSession || this.generatePagesPerSession(),
            scrollDepth: data.behavioral?.scrollDepth || this.generateScrollDepth(),
            clickFrequency: data.behavioral?.clickFrequency || this.generateClickFrequency(),
            timeOnPage: data.behavioral?.timeOnPage || this.generateTimeOnPage(),
            returnProbability: data.behavioral?.returnProbability || this.generateReturnProbability()
        };

        // Enhanced behavioral characteristics (LLM-based)
        this.enhancedBehavioral = data.enhancedBehavioral || {
            navigationStyle: data.enhancedBehavioral?.navigationStyle || null,
            interactionPattern: data.enhancedBehavioral?.interactionPattern || null,
            timeDistribution: data.enhancedBehavioral?.timeDistribution || null,
            clickBehavior: data.enhancedBehavioral?.clickBehavior || null,
            engagementLevel: data.enhancedBehavioral?.engagementLevel || null
        };

        // Performance metrics
        this.metrics = {
            totalVisits: data.metrics?.totalVisits || 0,
            successfulVisits: data.metrics?.successfulVisits || 0,
            failedVisits: data.metrics?.failedVisits || 0,
            avgResponseTime: data.metrics?.avgResponseTime || 0,
            lastVisitDuration: data.metrics?.lastVisitDuration || 0,
            evolutionScore: data.metrics?.evolutionScore || 0
        };

        // Session management
        this.session = {
            currentSessionId: data.session?.currentSessionId || null,
            sessionStartTime: data.session?.sessionStartTime || null,
            sessionDuration: data.session?.sessionDuration || 0,
            visitsInSession: data.session?.visitsInSession || 0,
            maxVisitsPerSession: data.session?.maxVisitsPerSession || this.generateMaxVisitsPerSession()
        };

        // Fingerprint association
        this.fingerprint = {
            currentFingerprintId: data.fingerprint?.currentFingerprintId || null,
            fingerprintRotationTime: data.fingerprint?.fingerprintRotationTime || null,
            fingerprintHistory: data.fingerprint?.fingerprintHistory || []
        };

        // Evolution tracking
        this.evolution = {
            performanceHistory: data.evolution?.performanceHistory || [],
            behaviorAdjustments: data.evolution?.behaviorAdjustments || [],
            lastEvolution: data.evolution?.lastEvolution || null
        };
    }

    // Generate behavioral characteristics based on category
    generateBounceRate() {
        switch (this.category) {
            case 'newVisitor':
                return Math.random() * 0.4 + 0.5; // 50-90%
            case 'returningRegular':
                return Math.random() * 0.3 + 0.2; // 20-50%
            case 'loyalUser':
                return Math.random() * 0.2 + 0.1; // 10-30%
            default:
                return Math.random() * 0.5 + 0.3; // 30-80%
        }
    }

    generateSessionDuration() {
        switch (this.category) {
            case 'newVisitor':
                return Math.random() * 180 + 60; // 1-4 minutes
            case 'returningRegular':
                return Math.random() * 300 + 180; // 3-8 minutes
            case 'loyalUser':
                return Math.random() * 600 + 300; // 5-15 minutes
            default:
                return Math.random() * 300 + 120; // 2-7 minutes
        }
    }

    generatePagesPerSession() {
        switch (this.category) {
            case 'newVisitor':
                return Math.floor(Math.random() * 3) + 1; // 1-3 pages
            case 'returningRegular':
                return Math.floor(Math.random() * 5) + 2; // 2-6 pages
            case 'loyalUser':
                return Math.floor(Math.random() * 8) + 3; // 3-10 pages
            default:
                return Math.floor(Math.random() * 4) + 1; // 1-4 pages
        }
    }

    generateScrollDepth() {
        switch (this.category) {
            case 'newVisitor':
                return Math.random() * 0.4 + 0.2; // 20-60%
            case 'returningRegular':
                return Math.random() * 0.5 + 0.4; // 40-90%
            case 'loyalUser':
                return Math.random() * 0.3 + 0.7; // 70-100%
            default:
                return Math.random() * 0.6 + 0.3; // 30-90%
        }
    }

    generateClickFrequency() {
        switch (this.category) {
            case 'newVisitor':
                return Math.random() * 3 + 1; // 1-4 clicks per minute
            case 'returningRegular':
                return Math.random() * 5 + 2; // 2-7 clicks per minute
            case 'loyalUser':
                return Math.random() * 7 + 3; // 3-10 clicks per minute
            default:
                return Math.random() * 4 + 2; // 2-6 clicks per minute
        }
    }

    generateTimeOnPage() {
        switch (this.category) {
            case 'newVisitor':
                return Math.random() * 60 + 30; // 30-90 seconds
            case 'returningRegular':
                return Math.random() * 120 + 60; // 1-3 minutes
            case 'loyalUser':
                return Math.random() * 180 + 120; // 2-5 minutes
            default:
                return Math.random() * 90 + 45; // 45-135 seconds
        }
    }

    generateReturnProbability() {
        switch (this.category) {
            case 'newVisitor':
                return Math.random() * 0.3 + 0.1; // 10-40%
            case 'returningRegular':
                return Math.random() * 0.4 + 0.5; // 50-90%
            case 'loyalUser':
                return Math.random() * 0.2 + 0.8; // 80-100%
            default:
                return Math.random() * 0.5 + 0.3; // 30-80%
        }
    }

    generateMaxVisitsPerSession() {
        switch (this.category) {
            case 'newVisitor':
                return Math.floor(Math.random() * 3) + 1; // 1-3 visits
            case 'returningRegular':
                return Math.floor(Math.random() * 5) + 2; // 2-6 visits
            case 'loyalUser':
                return Math.floor(Math.random() * 8) + 3; // 3-10 visits
            default:
                return Math.floor(Math.random() * 4) + 1; // 1-4 visits
        }
    }

    // Update profile metrics after a visit
    updateMetrics(visitData) {
        this.metrics.totalVisits++;
        this.lastUsed = new Date().toISOString();
        
        if (visitData.success) {
            this.metrics.successfulVisits++;
        } else {
            this.metrics.failedVisits++;
        }

        if (visitData.duration) {
            this.metrics.lastVisitDuration = visitData.duration;
            this.metrics.avgResponseTime = (
                (this.metrics.avgResponseTime * (this.metrics.totalVisits - 1) + visitData.duration) / 
                this.metrics.totalVisits
            );
        }

        // Update session tracking
        if (this.session.currentSessionId) {
            this.session.visitsInSession++;
        }

        // Calculate evolution score
        this.calculateEvolutionScore();
    }

    // Calculate performance-based evolution score
    calculateEvolutionScore() {
        const successRate = this.metrics.totalVisits > 0 ? 
            this.metrics.successfulVisits / this.metrics.totalVisits : 0;
        const responseTimeScore = Math.max(0, 1 - (this.metrics.avgResponseTime / 30000)); // 30s baseline
        
        this.metrics.evolutionScore = (successRate * 0.7) + (responseTimeScore * 0.3);
    }

    // Generate enhanced behavioral characteristics using LLM
    async generateEnhancedBehavioral() {
        // Only generate for loyal users to save credits
        if (this.category !== 'loyalUser') {
            return;
        }

        try {
            const llmService = new LLMService();
            
            // Only proceed if LLM service is configured
            if (!llmService.isConfigured()) {
                return;
            }

            // Generate enhanced behavioral characteristics
            const enhancedBehavior = await llmService.generateProfileBehavior({
                id: this.id,
                category: this.category,
                countryCode: this.countryCode,
                metrics: this.metrics,
                behavioral: this.behavioral,
                evolutionScore: this.metrics.evolutionScore
            });

            if (enhancedBehavior) {
                this.enhancedBehavioral = {
                    navigationStyle: enhancedBehavior.navigationStyle || null,
                    interactionPattern: enhancedBehavior.interactionPattern || null,
                    timeDistribution: enhancedBehavior.timeDistribution || null,
                    clickBehavior: enhancedBehavior.clickBehavior || null,
                    engagementLevel: enhancedBehavior.engagementLevel || null
                };
            }
        } catch (error) {
            console.warn(`Failed to generate enhanced behavioral characteristics for profile ${this.id}:`, error.message);
        }
    }

    // Start a new session
    startSession(sessionId, duration) {
        this.session.currentSessionId = sessionId;
        this.session.sessionStartTime = new Date().toISOString();
        this.session.sessionDuration = duration;
        this.session.visitsInSession = 0;
        this.isActive = true;
    }

    // End current session
    endSession() {
        this.session.currentSessionId = null;
        this.session.sessionStartTime = null;
        this.session.visitsInSession = 0;
        this.isActive = false;
    }

    // Check if profile should evolve to next category
    shouldEvolve() {
        if (this.metrics.evolutionScore > 0.8 && this.metrics.totalVisits > 10) {
            if (this.category === 'newVisitor' && Math.random() < 0.3) {
                return 'returningRegular';
            } else if (this.category === 'returningRegular' && Math.random() < 0.2) {
                return 'loyalUser';
            }
        }
        return null;
    }

    // Evolve profile to new category
    async evolve(newCategory) {
        const oldCategory = this.category;
        this.category = newCategory;
        
        // Adjust behavioral characteristics
        this.behavioral.bounceRate = this.generateBounceRate();
        this.behavioral.avgSessionDuration = this.generateSessionDuration();
        this.behavioral.pagesPerSession = this.generatePagesPerSession();
        this.behavioral.scrollDepth = this.generateScrollDepth();
        this.behavioral.clickFrequency = this.generateClickFrequency();
        this.behavioral.timeOnPage = this.generateTimeOnPage();
        this.behavioral.returnProbability = this.generateReturnProbability();
        
        // Generate enhanced behavioral characteristics for loyal users
        if (newCategory === 'loyalUser') {
            await this.generateEnhancedBehavioral();
        }
        
        // Record evolution
        this.evolution.behaviorAdjustments.push({
            timestamp: new Date().toISOString(),
            fromCategory: oldCategory,
            toCategory: newCategory,
            evolutionScore: this.metrics.evolutionScore
        });
        
        this.evolution.lastEvolution = new Date().toISOString();
    }

    // Convert to JSON for storage
    toJSON() {
        return {
            id: this.id,
            name: this.name || `Profile ${this.id.substring(0, 8)}`,
            created_at: this.createdAt,
            updated_at: this.lastUsed || this.createdAt, // Use createdAt as fallback if lastUsed is null
            fingerprint: this.fingerprint,
            config: {
                os: this.config?.os || 'Unknown',
                browser: this.config?.browser || 'Unknown',
                countryCode: this.countryCode,
                category: this.category,
                proxy: this.assignedProxy,
                // Add other config fields as needed
            },
            path: this.getDirName(),
            metadata: {
                profileNumber: this.profileNumber,
                geographic: this.geographic,
                behavioral: this.behavioral,
                metrics: this.metrics,
                session: this.session,
                evolution: this.evolution,
                isActive: this.isActive
            }
        };
    }

    // Get filename for this profile based on profile ID for consistency
    getFileName() {
        // Use profile ID for consistent naming to avoid mismatches
        return `profile_${this.id}.json`;
    }
    
    // Get directory name for this profile
    getDirName() {
        // Use profile ID for consistent directory naming
        return `profile_${this.id}`;
    }

    /**
     * Initialize isolated storage paths for strict profile isolation
     * Each profile gets its own unique storage directories and files
     */
    initializeIsolatedStorage(baseStoragePath) {
        const path = require('path');
        const profileStorageDir = path.join(baseStoragePath, `profile_${this.id}`);

        this.isolatedStorage = {
            // Unique browser data directory per profile
            userDataDir: path.join(profileStorageDir, 'browser_data'),

            // Isolated cookies storage
            cookiesFile: path.join(profileStorageDir, 'cookies.json'),

            // Isolated cache directory
            cacheDir: path.join(profileStorageDir, 'cache'),

            // Isolated IndexedDB directory
            indexedDBDir: path.join(profileStorageDir, 'indexeddb'),

            // Isolated localStorage file
            localStorageFile: path.join(profileStorageDir, 'localStorage.json'),

            // Isolated sessionStorage file
            sessionStorageFile: path.join(profileStorageDir, 'sessionStorage.json'),

            // Profile-specific logs
            logFile: path.join(profileStorageDir, 'profile.log'),

            // Profile fingerprint storage
            fingerprintFile: path.join(profileStorageDir, 'fingerprint.json')
        };

        return this.isolatedStorage;
    }

    /**
     * Ensure all isolated storage directories exist
     */
    async ensureIsolatedStorageDirectories() {
        const fs = require('fs-extra');
        const path = require('path');

        if (!this.isolatedStorage.userDataDir) {
            throw new Error(`Profile ${this.id} isolated storage not initialized`);
        }

        // Create all necessary directories
        await fs.ensureDir(this.isolatedStorage.userDataDir);
        await fs.ensureDir(this.isolatedStorage.cacheDir);
        await fs.ensureDir(this.isolatedStorage.indexedDBDir);
        await fs.ensureDir(path.dirname(this.isolatedStorage.cookiesFile));
        await fs.ensureDir(path.dirname(this.isolatedStorage.localStorageFile));
        await fs.ensureDir(path.dirname(this.isolatedStorage.sessionStorageFile));
        await fs.ensureDir(path.dirname(this.isolatedStorage.logFile));
        await fs.ensureDir(path.dirname(this.isolatedStorage.fingerprintFile));

        // Initialize empty storage files if they don't exist
        if (!await fs.pathExists(this.isolatedStorage.cookiesFile)) {
            await fs.writeJson(this.isolatedStorage.cookiesFile, []);
        }
        if (!await fs.pathExists(this.isolatedStorage.localStorageFile)) {
            await fs.writeJson(this.isolatedStorage.localStorageFile, {});
        }
        if (!await fs.pathExists(this.isolatedStorage.sessionStorageFile)) {
            await fs.writeJson(this.isolatedStorage.sessionStorageFile, {});
        }
    }

    // Get directory name for this profile
    getDirName() {
        // Use profile ID for consistent directory naming
        return `profile_${this.id}`;
    }
    
    // Create from JSON data
    static fromJSON(data) {
        // Ensure assignedProxy is properly restored from config
        if (data.config && data.config.proxy) {
            data.assignedProxy = data.config.proxy;
        }
        return new Profile(data);
    }
}

module.exports = Profile;
