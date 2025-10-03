const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../shared/config/config');
const logger = require('../../shared/utils/logger');

class SessionStateManager {
    constructor() {
        this.activeSessions = new Map();
        this.sessionHistory = new Map();
        this.isolationGroups = new Map();
        this.sessionCleanupInterval = null;
    }

    /**
     * Initialize session state manager
     */
    async initialize() {
        try {
            logger.info('Initializing session state manager');
            
            // Load existing session data if any
            await this.loadSessionState();
            
            // Start cleanup interval
            this.startCleanupInterval();
            
            logger.info('Session state manager initialized', {
                activeSessions: this.activeSessions.size,
                isolationGroups: this.isolationGroups.size
            });

        } catch (error) {
            logger.error('Failed to initialize session state manager', { error: error.message });
            throw error;
        }
    }

    /**
     * Create new isolated session
     * @param {string} profileId - Profile ID
     * @param {Object} sessionConfig - Session configuration
     * @returns {Object} Session data
     */
    createSession(profileId, sessionConfig = {}) {
        const sessionId = uuidv4();
        const isolationGroupId = uuidv4();
        
        const session = {
            id: sessionId,
            profileId,
            isolationGroupId,
            startTime: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            duration: sessionConfig.duration || config.getSessionDuration('newVisitor'),
            maxVisits: sessionConfig.maxVisits || 10,
            currentVisits: 0,
            status: 'active',
            browserInstances: new Map(),
            cookies: new Map(),
            localStorage: new Map(),
            sessionStorage: new Map(),
            fingerprints: [],
            visitHistory: [],
            isolationLevel: sessionConfig.isolationLevel || 'strict',
            antiContamination: {
                enabled: true,
                crossSessionLeakage: false,
                fingerprintConsistency: true,
                cookieIsolation: true,
                storageIsolation: true
            }
        };

        // Add to active sessions
        this.activeSessions.set(sessionId, session);
        
        // Create isolation group
        this.isolationGroups.set(isolationGroupId, {
            id: isolationGroupId,
            sessionIds: [sessionId],
            createdAt: new Date().toISOString(),
            isolationLevel: session.isolationLevel
        });

        logger.sessionStart(sessionId, profileId, session.duration);
        
        return session;
    }

    /**
     * Get session by ID
     * @param {string} sessionId - Session ID
     * @returns {Object} Session data
     */
    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }

    /**
     * Update session activity
     * @param {string} sessionId - Session ID
     * @param {Object} activityData - Activity data
     */
    updateSessionActivity(sessionId, activityData) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        session.lastActivity = new Date().toISOString();
        session.currentVisits++;

        // Add visit to history
        session.visitHistory.push({
            timestamp: new Date().toISOString(),
            url: activityData.url,
            duration: activityData.duration,
            success: activityData.success,
            fingerprintId: activityData.fingerprintId,
            behaviorData: activityData.behaviorData
        });

        // Update anti-contamination tracking
        this.updateAntiContaminationState(session, activityData);

        logger.profileActivity(session.profileId, 'session_activity', {
            sessionId,
            currentVisits: session.currentVisits,
            maxVisits: session.maxVisits
        });
    }

    /**
     * Update anti-contamination state
     * @param {Object} session - Session object
     * @param {Object} activityData - Activity data
     */
    updateAntiContaminationState(session, activityData) {
        // Check for cross-session leakage indicators
        if (activityData.detectedLeakage) {
            session.antiContamination.crossSessionLeakage = true;
            logger.security('cross_session_leakage_detected', {
                sessionId: session.id,
                profileId: session.profileId,
                leakageType: activityData.detectedLeakage
            });
        }

        // Verify fingerprint consistency
        if (activityData.fingerprintId) {
            if (!session.fingerprints.includes(activityData.fingerprintId)) {
                session.fingerprints.push(activityData.fingerprintId);
            }
            
            // Check for unexpected fingerprint changes
            if (session.fingerprints.length > 1) {
                session.antiContamination.fingerprintConsistency = false;
                logger.security('fingerprint_inconsistency', {
                    sessionId: session.id,
                    profileId: session.profileId,
                    fingerprints: session.fingerprints
                });
            }
        }
    }

    /**
     * Store session cookies
     * @param {string} sessionId - Session ID
     * @param {Array} cookies - Cookie data
     */
    storeSessionCookies(sessionId, cookies) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Store cookies with isolation
        for (const cookie of cookies) {
            const cookieKey = `${cookie.domain}:${cookie.name}`;
            session.cookies.set(cookieKey, {
                ...cookie,
                sessionId,
                timestamp: new Date().toISOString()
            });
        }

        logger.profileActivity(session.profileId, 'cookies_stored', {
            sessionId,
            cookieCount: cookies.length
        });
    }

    /**
     * Get session cookies
     * @param {string} sessionId - Session ID
     * @param {string} domain - Optional domain filter
     * @returns {Array} Cookie data
     */
    getSessionCookies(sessionId, domain = null) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        let cookies = Array.from(session.cookies.values());
        
        if (domain) {
            cookies = cookies.filter(cookie => cookie.domain === domain);
        }

        return cookies;
    }

    /**
     * Store session storage data
     * @param {string} sessionId - Session ID
     * @param {string} storageType - 'localStorage' or 'sessionStorage'
     * @param {Object} data - Storage data
     */
    storeSessionStorage(sessionId, storageType, data) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const storage = storageType === 'localStorage' ? session.localStorage : session.sessionStorage;
        
        for (const [key, value] of Object.entries(data)) {
            storage.set(key, {
                value,
                sessionId,
                timestamp: new Date().toISOString()
            });
        }

        logger.profileActivity(session.profileId, 'storage_updated', {
            sessionId,
            storageType,
            keyCount: Object.keys(data).length
        });
    }

    /**
     * Get session storage data
     * @param {string} sessionId - Session ID
     * @param {string} storageType - 'localStorage' or 'sessionStorage'
     * @returns {Object} Storage data
     */
    getSessionStorage(sessionId, storageType) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const storage = storageType === 'localStorage' ? session.localStorage : session.sessionStorage;
        const data = {};
        
        for (const [key, item] of storage) {
            data[key] = item.value;
        }

        return data;
    }

    /**
     * Register browser instance for session
     * @param {string} sessionId - Session ID
     * @param {string} browserId - Browser instance ID
     * @param {Object} browserData - Browser data
     */
    registerBrowserInstance(sessionId, browserId, browserData) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        session.browserInstances.set(browserId, {
            id: browserId,
            sessionId,
            fingerprintId: browserData.fingerprintId,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
            status: 'active'
        });

        logger.profileActivity(session.profileId, 'browser_registered', {
            sessionId,
            browserId,
            fingerprintId: browserData.fingerprintId
        });
    }

    /**
     * Unregister browser instance
     * @param {string} sessionId - Session ID
     * @param {string} browserId - Browser instance ID
     */
    unregisterBrowserInstance(sessionId, browserId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const browserInstance = session.browserInstances.get(browserId);
        if (browserInstance) {
            browserInstance.status = 'closed';
            browserInstance.closedAt = new Date().toISOString();
        }

        logger.profileActivity(session.profileId, 'browser_unregistered', {
            sessionId,
            browserId
        });
    }

    /**
     * Check if session should be terminated
     * @param {string} sessionId - Session ID
     * @returns {boolean} Should terminate
     */
    shouldTerminateSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return true;
        }

        const now = new Date();
        const sessionStart = new Date(session.startTime);
        const sessionAge = now - sessionStart;
        const maxDuration = session.duration * 60 * 60 * 1000; // Convert hours to ms

        // Check duration limit
        if (sessionAge > maxDuration) {
            return true;
        }

        // Check visit limit
        if (session.currentVisits >= session.maxVisits) {
            return true;
        }

        // Check for contamination
        if (session.antiContamination.crossSessionLeakage) {
            return true;
        }

        return false;
    }

    /**
     * Terminate session
     * @param {string} sessionId - Session ID
     * @param {string} reason - Termination reason
     */
    async terminateSession(sessionId, reason = 'completed') {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Update session status
        session.status = 'terminated';
        session.endTime = new Date().toISOString();
        session.terminationReason = reason;

        // Close all browser instances
        for (const [browserId, browserInstance] of session.browserInstances) {
            if (browserInstance.status === 'active') {
                this.unregisterBrowserInstance(sessionId, browserId);
            }
        }

        // Move to history
        this.sessionHistory.set(sessionId, session);
        this.activeSessions.delete(sessionId);

        // Clean up isolation group
        const isolationGroup = this.isolationGroups.get(session.isolationGroupId);
        if (isolationGroup) {
            isolationGroup.sessionIds = isolationGroup.sessionIds.filter(id => id !== sessionId);
            if (isolationGroup.sessionIds.length === 0) {
                this.isolationGroups.delete(session.isolationGroupId);
            }
        }

        // Save session state
        await this.saveSessionState();

        const actualDuration = new Date(session.endTime) - new Date(session.startTime);
        logger.sessionEnd(sessionId, session.profileId, actualDuration, session.currentVisits);
    }

    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    getSessionStatistics() {
        const stats = {
            active: this.activeSessions.size,
            total: this.activeSessions.size + this.sessionHistory.size,
            isolationGroups: this.isolationGroups.size,
            avgDuration: 0,
            avgVisitsPerSession: 0,
            contaminationEvents: 0
        };

        // Calculate averages from active sessions
        let totalDuration = 0;
        let totalVisits = 0;
        let contaminationCount = 0;

        for (const session of this.activeSessions.values()) {
            const sessionAge = new Date() - new Date(session.startTime);
            totalDuration += sessionAge;
            totalVisits += session.currentVisits;
            
            if (session.antiContamination.crossSessionLeakage) {
                contaminationCount++;
            }
        }

        if (this.activeSessions.size > 0) {
            stats.avgDuration = totalDuration / this.activeSessions.size;
            stats.avgVisitsPerSession = totalVisits / this.activeSessions.size;
        }

        stats.contaminationEvents = contaminationCount;

        return stats;
    }

    /**
     * Load session state from disk
     */
    async loadSessionState() {
        try {
            const stateFile = path.join(config.paths.logs, 'session_state.json');
            
            if (await fs.pathExists(stateFile)) {
                const stateData = await fs.readJson(stateFile);
                
                // Restore session history (active sessions are not restored on restart)
                if (stateData.sessionHistory) {
                    for (const [sessionId, sessionData] of Object.entries(stateData.sessionHistory)) {
                        this.sessionHistory.set(sessionId, sessionData);
                    }
                }
                
                logger.info('Session state loaded', {
                    historyCount: this.sessionHistory.size
                });
            }
        } catch (error) {
            logger.warn('Failed to load session state', { error: error.message });
        }
    }

    /**
     * Save session state to disk
     */
    async saveSessionState() {
        try {
            const stateFile = path.join(config.paths.logs, 'session_state.json');
            
            const stateData = {
                sessionHistory: Object.fromEntries(this.sessionHistory),
                lastSaved: new Date().toISOString()
            };
            
            await fs.writeJson(stateFile, stateData, { spaces: 2 });
            
        } catch (error) {
            logger.error('Failed to save session state', { error: error.message });
        }
    }

    /**
     * Start cleanup interval for expired sessions
     */
    startCleanupInterval() {
        // Run cleanup every 5 minutes
        this.sessionCleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }

    /**
     * Cleanup expired sessions
     */
    cleanupExpiredSessions() {
        const expiredSessions = [];
        
        for (const [sessionId, session] of this.activeSessions) {
            if (this.shouldTerminateSession(sessionId)) {
                expiredSessions.push(sessionId);
            }
        }

        for (const sessionId of expiredSessions) {
            this.terminateSession(sessionId, 'expired').catch(error => {
                logger.error('Failed to terminate expired session', {
                    sessionId,
                    error: error.message
                });
            });
        }

        if (expiredSessions.length > 0) {
            logger.info(`Cleaned up ${expiredSessions.length} expired sessions`);
        }
    }

    /**
     * Shutdown session manager
     */
    async shutdown() {
        // Clear cleanup interval
        if (this.sessionCleanupInterval) {
            clearInterval(this.sessionCleanupInterval);
        }

        // Terminate all active sessions
        const activeSessions = Array.from(this.activeSessions.keys());
        for (const sessionId of activeSessions) {
            await this.terminateSession(sessionId, 'shutdown');
        }

        // Save final state
        await this.saveSessionState();

        logger.info('Session state manager shutdown completed');
    }
}

module.exports = new SessionStateManager();
