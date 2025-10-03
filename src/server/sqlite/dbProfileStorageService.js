const hybridDatabaseService = require('./hybridDatabaseService');
const config = require('../shared/config/config');
const logger = require('../shared/utils/logger');

/**
 * Database Profile Storage Service
 * Uses hybrid database service (SQLite + Supabase sync) for profile data storage
 */
class DBProfileStorageService {
    constructor() {
        this.hybridDB = hybridDatabaseService;
        this.isInitialized = false;
    }

    /**
     * Initialize database storage
     */
    async initialize() {
        try {
            logger.info('Initializing database profile storage service');
            
            // Initialize hybrid database service
            await this.hybridDB.initialize();
            
            this.isInitialized = true;
            logger.info('Database profile storage service initialized successfully');
            
            return true;
        } catch (error) {
            logger.error('Failed to initialize database profile storage service', { error: error.message });
            throw error;
        }
    }

    /**
     * Create database tables (delegated to hybrid database service)
     */
    async createTables() {
        // Tables are created by hybrid database service
        logger.info('Profile database tables handled by hybrid database service');
        return true;
    }

    /**
     * Save profile data to database
     * @param {string} profileId - Profile ID
     * @param {Object} data - Profile data
     * @returns {Object} Saved profile data
     */
    async saveProfile(profileId, data) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Saving profile to database', { profileId });
            
            // Prepare data for insertion
            const profileData = {
                id: profileId,
                name: data.name || `Profile ${profileId.substring(0, 8)}`,
                description: data.description || '',
                config: JSON.stringify(data.config || {}),
                created_at: data.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: JSON.stringify(data.metadata || {}),
                path: data.path || '',
                user_id: data.user_id || '',
                session: JSON.stringify(data.session || {})
            };
            
            // Save using hybrid database service
            const savedProfile = await this.hybridDB.saveRecord('profiles', profileData, 'insert');
            
            logger.info('Profile saved to database successfully', { profileId });
            
            return savedProfile;
        } catch (error) {
            logger.error('Failed to save profile to database', { 
                error: error.message, 
                profileId 
            });
            throw error;
        }
    }

    /**
     * Load profile data
     * @param {string} profileId - Profile ID
     * @returns {Object|null} Profile data or null if not found
     */
    async loadProfile(profileId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            // Get profile using hybrid database service
            const profile = await this.hybridDB.getRecordById('profiles', profileId);
            
            if (profile) {
                logger.debug('Profile data loaded from database', { profileId });
                
                // Parse JSON fields if needed
                const parsedProfile = { ...profile };
                
                try {
                    if (parsedProfile.data && typeof parsedProfile.data === 'string') {
                        parsedProfile.data = JSON.parse(parsedProfile.data);
                    }
                    
                    if (parsedProfile.geolocation && typeof parsedProfile.geolocation === 'string') {
                        parsedProfile.geolocation = JSON.parse(parsedProfile.geolocation);
                    }
                } catch (parseError) {
                    logger.warn('Failed to parse profile JSON fields', {
                        error: parseError.message,
                        profileId: profileId
                    });
                }
                
                return {
                    ...parsedProfile.data,
                    id: parsedProfile.id,
                    name: parsedProfile.name,
                    email: parsedProfile.email,
                    userAgent: parsedProfile.userAgent || parsedProfile.user_agent,
                    timezone: parsedProfile.timezone,
                    locale: parsedProfile.locale,
                    screenResolution: parsedProfile.screenResolution || parsedProfile.screen_resolution,
                    geolocation: parsedProfile.geolocation
                };
            }
            
            logger.debug('Profile not found in database', { profileId });
            return null;
        } catch (error) {
            logger.error('Failed to load profile data from database', { 
                error: error.message, 
                profileId 
            });
            return null;
        }
    }

    /**
     * Delete profile data
     * @param {string} profileId - Profile ID
     */
    async deleteProfile(profileId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            logger.debug('Deleting profile data from database', { profileId });
            
            // Delete using hybrid database service
            // Delete related activities first (due to foreign key constraint)
            await this.hybridDB.deleteRecord('profile_activities', profileId, 'profile_id');
            // Delete profile
            await this.hybridDB.deleteRecord('profiles', profileId);
            
            logger.debug('Profile data deleted from database', { profileId });
        } catch (error) {
            logger.error('Failed to delete profile data from database', { 
                error: error.message, 
                profileId 
            });
            throw error;
        }
    }

    /**
     * List all profiles
     * @returns {Array} List of profile objects
     */
    async listProfiles() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            // Get all profiles using hybrid database service
            const profiles = await this.hybridDB.getAllRecords('profiles');
            
            // Parse JSON fields
            const parsedProfiles = profiles.map(profile => {
                const parsedProfile = { ...profile };
                
                try {
                    if (parsedProfile.config && typeof parsedProfile.config === 'string') {
                        parsedProfile.config = JSON.parse(parsedProfile.config);
                    }
                    
                    if (parsedProfile.metadata && typeof parsedProfile.metadata === 'string') {
                        parsedProfile.metadata = JSON.parse(parsedProfile.metadata);
                    }
                    
                    if (parsedProfile.session && typeof parsedProfile.session === 'string') {
                        parsedProfile.session = JSON.parse(parsedProfile.session);
                    }
                } catch (parseError) {
                    logger.warn('Failed to parse profile JSON fields', {
                        error: parseError.message,
                        profileId: profile.id
                    });
                }
                
                return parsedProfile;
            });
            
            logger.debug('Profiles listed from database', { count: parsedProfiles.length });
            return parsedProfiles;
        } catch (error) {
            logger.error('Failed to list profiles from database', { error: error.message });
            return [];
        }
    }

    /**
     * Save profile activity data
     * @param {string} profileId - Profile ID
     * @param {string} activityId - Activity ID
     * @param {Object} data - Activity data
     */
    async saveProfileActivity(profileId, activityId, data) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const jsonData = JSON.stringify(data);
            const activityType = data.type || 'unknown';
            
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO profile_activities 
                (id, profile_id, activity_type, data)
                VALUES (?, ?, ?, ?)
            `);
            
            stmt.run(activityId, profileId, activityType, jsonData);
            
            logger.debug('Profile activity saved to database', { profileId, activityId });
        } catch (error) {
            logger.error('Failed to save profile activity to database', { 
                error: error.message, 
                profileId, 
                activityId 
            });
            throw error;
        }
    }

    /**
     * Get profile statistics
     * @param {string} profileId - Profile ID
     * @returns {Object} Profile statistics
     */
    async getProfileStats(profileId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(*) as total_activities,
                    MAX(created_at) as last_activity
                FROM profile_activities WHERE profile_id = ?
            `);
            
            const row = stmt.get(profileId);
            
            return {
                profileId,
                totalActivities: row.total_activities || 0,
                lastActivity: row.last_activity
            };
        } catch (error) {
            logger.error('Failed to get profile stats from database', { 
                error: error.message, 
                profileId 
            });
            return null;
        }
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            logger.info('Profile database connection closed');
        }
    }
}

module.exports = new DBProfileStorageService();