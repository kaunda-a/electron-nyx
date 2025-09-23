const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');
const config = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Database Campaign Storage Service
 * Uses SQLite for campaign data storage instead of file-based approach
 */
class DBCampaignStorageService {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Initialize database storage
     */
    async initialize() {
        try {
            logger.info('Initializing database campaign storage service');
            
            // Ensure localStorage directory exists
            await fs.ensureDir(config.paths.localStorage);
            
            // Create database connection
            const dbPath = path.join(config.paths.localStorage, 'campaigns.db');
            this.db = new Database(dbPath);
            
            // Enable WAL mode for better concurrency
            this.db.pragma('journal_mode = WAL');
            
            // Create tables
            await this.createTables();
            
            this.isInitialized = true;
            logger.info('Database campaign storage service initialized successfully', { dbPath });
            
            return true;
        } catch (error) {
            logger.error('Failed to initialize database campaign storage service', { error: error.message });
            throw error;
        }
    }

    /**
     * Create database tables
     */
    async createTables() {
        try {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS campaigns (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS launches (
                    id TEXT PRIMARY KEY,
                    campaign_id TEXT NOT NULL,
                    profile_id TEXT,
                    data TEXT,
                    status TEXT DEFAULT 'pending',
                    started_at DATETIME,
                    completed_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (campaign_id) REFERENCES campaigns (id)
                )
            `);
            
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS profile_activities (
                    id TEXT PRIMARY KEY,
                    profile_id TEXT NOT NULL,
                    campaign_id TEXT,
                    activity_type TEXT NOT NULL,
                    data TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create indexes for better query performance
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_launches_campaign ON launches(campaign_id)
            `);
            
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_launches_profile ON launches(profile_id)
            `);
            
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_launches_status ON launches(status)
            `);
            
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_activities_profile ON profile_activities(profile_id)
            `);
            
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_activities_campaign ON profile_activities(campaign_id)
            `);
            
            this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_activities_type ON profile_activities(activity_type)
            `);
            
            logger.info('Database tables created successfully');
        } catch (error) {
            logger.error('Failed to create database tables', { error: error.message });
            throw error;
        }
    }

    /**
     * Save campaign data
     * @param {string} campaignId - Campaign ID
     * @param {Object} data - Campaign data
     */
    async saveCampaign(campaignId, data) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const jsonData = JSON.stringify(data);
            
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO campaigns (id, data, updated_at)
                VALUES (?, ?, datetime('now'))
            `);
            
            stmt.run(campaignId, jsonData);
            
            logger.debug('Campaign data saved to database', { campaignId });
        } catch (error) {
            logger.error('Failed to save campaign data to database', { 
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
     * Delete campaign data
     * @param {string} campaignId - Campaign ID
     */
    async deleteCampaign(campaignId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            // Delete related launches first (due to foreign key constraint)
            const launchStmt = this.db.prepare(`
                DELETE FROM launches WHERE campaign_id = ?
            `);
            launchStmt.run(campaignId);
            
            // Delete campaign
            const campaignStmt = this.db.prepare(`
                DELETE FROM campaigns WHERE id = ?
            `);
            campaignStmt.run(campaignId);
            
            logger.debug('Campaign data deleted from database', { campaignId });
        } catch (error) {
            logger.error('Failed to delete campaign data from database', { 
                error: error.message, 
                campaignId 
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