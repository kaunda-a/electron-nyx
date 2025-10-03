const fs = require('fs-extra');
const path = require('path');
const config = require('../../../shared/config/config');
const logger = require('../../../shared/utils/logger');

/**
 * Campaign Storage Service
 * Uses existing localStorage structure for campaign data storage
 */
class CampaignStorageService {
    constructor() {
        this.campaignsPath = path.join(config.paths.storage, 'campaigns');
    }

    /**
     * Initialize storage directory
     */
    async initialize() {
        try {
            await fs.ensureDir(this.campaignsPath);
            logger.info('Campaign storage initialized', { path: this.campaignsPath });
            return true;
        } catch (error) {
            logger.error('Failed to initialize campaign storage', { error: error.message });
            throw error;
        }
    }

    /**
     * Save campaign data
     * @param {string} campaignId - Campaign ID
     * @param {Object} data - Campaign data
     */
    async saveCampaign(campaignId, data) {
        try {
            const campaignFile = path.join(this.campaignsPath, `${campaignId}.json`);
            await fs.writeJson(campaignFile, data, { spaces: 2 });
            logger.debug('Campaign data saved', { campaignId, file: campaignFile });
        } catch (error) {
            logger.error('Failed to save campaign data', { 
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
        try {
            const campaignFile = path.join(this.campaignsPath, `${campaignId}.json`);
            if (await fs.pathExists(campaignFile)) {
                const data = await fs.readJson(campaignFile);
                logger.debug('Campaign data loaded', { campaignId, file: campaignFile });
                return data;
            }
            return null;
        } catch (error) {
            logger.error('Failed to load campaign data', { 
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
        try {
            const campaignFile = path.join(this.campaignsPath, `${campaignId}.json`);
            if (await fs.pathExists(campaignFile)) {
                await fs.remove(campaignFile);
                logger.debug('Campaign data deleted', { campaignId, file: campaignFile });
            }
        } catch (error) {
            logger.error('Failed to delete campaign data', { 
                error: error.message, 
                campaignId 
            });
            throw error;
        }
    }

    /**
     * List all campaigns
     * @returns {Array} List of campaign IDs
     */
    async listCampaigns() {
        try {
            const files = await fs.readdir(this.campaignsPath);
            const campaignFiles = files.filter(file => file.endsWith('.json'));
            const campaignIds = campaignFiles.map(file => path.basename(file, '.json'));
            logger.debug('Campaigns listed', { count: campaignIds.length });
            return campaignIds;
        } catch (error) {
            logger.error('Failed to list campaigns', { error: error.message });
            return [];
        }
    }

    /**
     * Save campaign launch data
     * @param {string} campaignId - Campaign ID
     * @param {string} launchId - Launch ID
     * @param {Object} data - Launch data
     */
    async saveLaunchData(campaignId, launchId, data) {
        try {
            const launchDir = path.join(this.campaignsPath, campaignId, 'launches');
            await fs.ensureDir(launchDir);
            
            const launchFile = path.join(launchDir, `${launchId}.json`);
            await fs.writeJson(launchFile, data, { spaces: 2 });
            logger.debug('Launch data saved', { campaignId, launchId, file: launchFile });
        } catch (error) {
            logger.error('Failed to save launch data', { 
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
        try {
            const launchFile = path.join(this.campaignsPath, campaignId, 'launches', `${launchId}.json`);
            if (await fs.pathExists(launchFile)) {
                const data = await fs.readJson(launchFile);
                logger.debug('Launch data loaded', { campaignId, launchId, file: launchFile });
                return data;
            }
            return null;
        } catch (error) {
            logger.error('Failed to load launch data', { 
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
        try {
            const profileDir = path.join(this.campaignsPath, 'profiles', profileId);
            await fs.ensureDir(profileDir);
            
            const activityFile = path.join(profileDir, `${activityId}.json`);
            await fs.writeJson(activityFile, data, { spaces: 2 });
            logger.debug('Profile activity saved', { profileId, activityId, file: activityFile });
        } catch (error) {
            logger.error('Failed to save profile activity', { 
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
        try {
            const campaign = await this.loadCampaign(campaignId);
            if (!campaign) {
                return null;
            }

            // Count launches
            const launchDir = path.join(this.campaignsPath, campaignId, 'launches');
            let launchCount = 0;
            let completedLaunches = 0;
            
            if (await fs.pathExists(launchDir)) {
                const launchFiles = await fs.readdir(launchDir);
                launchCount = launchFiles.filter(file => file.endsWith('.json')).length;
                
                // Count completed launches
                for (const file of launchFiles) {
                    if (file.endsWith('.json')) {
                        const launchData = await fs.readJson(path.join(launchDir, file));
                        if (launchData.status === 'completed') {
                            completedLaunches++;
                        }
                    }
                }
            }

            return {
                campaignId,
                totalLaunches: launchCount,
                completedLaunches,
                completionRate: launchCount > 0 ? completedLaunches / launchCount : 0,
                lastUpdated: campaign.lastUpdated || campaign.createdAt
            };
        } catch (error) {
            logger.error('Failed to get campaign stats', { 
                error: error.message, 
                campaignId 
            });
            return null;
        }
    }
}

module.exports = new CampaignStorageService();