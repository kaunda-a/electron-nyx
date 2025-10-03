const hybridDatabaseService = require('./hybridDatabaseService');
const config = require('../shared/config/config');
const logger = require('../shared/utils/logger');

/**
 * Database Campaign Storage Service
 * Uses hybrid database service (SQLite + Supabase sync) for campaign data storage
 */
class DBCampaignStorageService {
    constructor() {
        this.hybridDB = hybridDatabaseService;
        this.isInitialized = false;
    }

    /**
     * Initialize database storage
     */
    async initialize() {
        try {
            logger.info('Initializing database campaign storage service');
            
            // Initialize hybrid database service
            await this.hybridDB.initialize();
            
            this.isInitialized = true;
            logger.info('Database campaign storage service initialized successfully');
            
            return true;
        } catch (error) {
            logger.error('Failed to initialize database campaign storage service', { error: error.message });
            throw error;
        }
    }

    /**
     * Create database tables (delegated to hybrid database service)
     */
    async createTables() {
        // Tables are created by hybrid database service
        logger.info('Campaign database tables handled by hybrid database service');
        return true;
    }

    /**
     * Save campaign data to database
     * @param {string} campaignId - Campaign ID
     * @param {Object} data - Campaign data
     * @returns {Object} Saved campaign data
     */
    async saveCampaign(campaignId, data) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Saving campaign to database', { campaignId });
            
            // Prepare data for insertion
            const campaignData = {
                id: campaignId,
                name: data.name || `Campaign ${campaignId.substring(0, 8)}`,
                description: data.description || '',
                status: data.status || 'draft',
                type: data.type || 'traffic',
                settings: JSON.stringify(data.settings || {}),
                targeting: JSON.stringify(data.targeting || {}),
                schedule: JSON.stringify(data.schedule || {}),
                targets: JSON.stringify(data.targets || []),
                profiles: JSON.stringify(data.profiles || []),
                performance: JSON.stringify(data.performance || {}),
                created_at: data.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                created_by: data.created_by || '',
                tags: JSON.stringify(data.tags || []),
                priority: data.priority || 'medium',
                metadata: JSON.stringify(data.metadata || {})
            };
            
            // Save using hybrid database service
            const savedCampaign = await this.hybridDB.saveRecord('campaigns', campaignData, 'insert');
            
            logger.info('Campaign saved to database successfully', { campaignId });
            
            return savedCampaign;
        } catch (error) {
            logger.error('Failed to save campaign to database', { 
                error: error.message, 
                campaignId 
            });
            throw error;
        }
    }

    /**
     * Load campaign data
     * @param {string} campaignId - Campaign ID
     * @returns {Object|null} Campaign data or null if not found
     */
    async loadCampaign(campaignId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const stmt = this.db.prepare(`
                SELECT data FROM campaigns WHERE id = ?
            `);
            
            const row = stmt.get(campaignId);
            
            if (row) {
                logger.debug('Campaign data loaded from database', { campaignId });
                return JSON.parse(row.data);
            }
            
            logger.debug('Campaign not found in database', { campaignId });
            return null;
        } catch (error) {
            logger.error('Failed to load campaign data from database', { 
                error: error.message, 
                campaignId 
            });
            return null;
        }
    }

    /**
     * Delete campaign data from database
     * @param {string} campaignId - Campaign ID
     */
    async deleteCampaign(campaignId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Deleting campaign data from database', { campaignId });
            
            // Delete using hybrid database service
            await this.hybridDB.deleteRecord('campaigns', campaignId);
            
            logger.debug('Campaign data deleted from database', { campaignId });
        } catch (error) {
            logger.error('Failed to delete campaign data from database', {
                error: error.message,
                campaignId: campaignId
            });
            throw error;
        }
    }

    /**
     * Save campaign launch data
     * @param {string} campaignId - Campaign ID
     * @param {string} launchId - Launch ID
     * @param {Object} data - Launch data
     */
    async saveLaunchData(campaignId, launchId, data) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const jsonData = JSON.stringify(data);
            const status = data.status || 'unknown';
            const profileId = data.profileId || null;
            const startedAt = data.startedAt || null;
            const completedAt = data.completedAt || null;
            
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO launches 
                (id, campaign_id, profile_id, data, status, started_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run(launchId, campaignId, profileId, jsonData, status, startedAt, completedAt);
            
            logger.debug('Launch data saved to database', { campaignId, launchId });
        } catch (error) {
            logger.error('Failed to save launch data to database', { 
                error: error.message, 
                campaignId, 
                launchId 
            });
            throw error;
        }
    }

    /**
     * Load campaign launch data
     * @param {string} campaignId - Campaign ID
     * @param {string} launchId - Launch ID
     * @returns {Object|null} Launch data or null if not found
     */
    async loadLaunchData(campaignId, launchId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const stmt = this.db.prepare(`
                SELECT data FROM launches WHERE campaign_id = ? AND id = ?
            `);
            
            const row = stmt.get(campaignId, launchId);
            
            if (row) {
                logger.debug('Launch data loaded from database', { campaignId, launchId });
                return JSON.parse(row.data);
            }
            
            logger.debug('Launch data not found in database', { campaignId, launchId });
            return null;
        } catch (error) {
            logger.error('Failed to load launch data from database', { 
                error: error.message, 
                campaignId, 
                launchId 
            });
            return null;
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
            const campaignId = data.campaignId || null;
            const activityType = data.type || 'unknown';
            
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO profile_activities 
                (id, profile_id, campaign_id, activity_type, data)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            stmt.run(activityId, profileId, campaignId, activityType, jsonData);
            
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
     * Get campaign statistics
     * @param {string} campaignId - Campaign ID
     * @returns {Object} Campaign statistics
     */
    async getCampaignStats(campaignId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(*) as total_launches,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_launches,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_launches,
                    SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_launches
                FROM launches WHERE campaign_id = ?
            `);
            
            const row = stmt.get(campaignId);
            
            return {
                campaignId,
                totalLaunches: row.total_launches || 0,
                completedLaunches: row.completed_launches || 0,
                failedLaunches: row.failed_launches || 0,
                runningLaunches: row.running_launches || 0,
                completionRate: row.total_launches > 0 ? 
                    (row.completed_launches || 0) / row.total_launches : 0
            };
        } catch (error) {
            logger.error('Failed to get campaign stats from database', { 
                error: error.message, 
                campaignId 
            });
            return null;
        }
    }

    /**
     * List all campaigns
     * @returns {Array} List of campaign IDs
     */
    async listCampaigns() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const stmt = this.db.prepare(`
                SELECT id FROM campaigns ORDER BY created_at DESC
            `);
            
            const rows = stmt.all();
            const campaignIds = rows.map(row => row.id);
            
            logger.debug('Campaigns listed from database', { count: campaignIds.length });
            return campaignIds;
        } catch (error) {
            logger.error('Failed to list campaigns from database', { error: error.message });
            return [];
        }
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            logger.info('Database connection closed');
        }
    }
}

module.exports = new DBCampaignStorageService();