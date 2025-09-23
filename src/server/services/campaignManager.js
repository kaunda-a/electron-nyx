const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Campaign = require('../models/Campaign');
const config = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Campaign Manager Service
 * Manages ad monetization campaigns
 */
class CampaignManager {
    constructor() {
        this.campaigns = new Map();
        this.activeCampaigns = new Set();
        this.campaignStats = new Map();
        this.campaignsPath = path.join(config.paths.localStorage, 'campaigns');
        this.isInitialized = false;
    }

    /**
     * Initialize the campaign manager
     */
    async initialize() {
        try {
            logger.info('Initializing Campaign Manager');
            
            // Ensure campaigns directory exists
            await fs.ensureDir(this.campaignsPath);
            
            // Load existing campaigns
            await this.loadCampaigns();
            
            // Start campaign monitoring
            this.startCampaignMonitoring();
            
            this.isInitialized = true;
            logger.info('Campaign Manager initialized successfully', {
                totalCampaigns: this.campaigns.size,
                activeCampaigns: this.activeCampaigns.size
            });
            
        } catch (error) {
            logger.error('Failed to initialize Campaign Manager', { error: error.message });
            throw error;
        }
    }

    /**
     * Load campaigns from disk
     */
    async loadCampaigns() {
        try {
            const files = await fs.readdir(this.campaignsPath);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.campaignsPath, file);
                    const campaignData = await fs.readJson(filePath);
                    const campaign = new Campaign(campaignData);
                    
                    this.campaigns.set(campaign.id, campaign);
                    
                    // Add to active campaigns if currently active
                    if (campaign.isActiveNow()) {
                        this.activeCampaigns.add(campaign.id);
                    }
                    
                    logger.debug('Loaded campaign', { 
                        id: campaign.id, 
                        name: campaign.name,
                        status: campaign.status 
                    });
                    
                } catch (error) {
                    logger.error('Failed to load campaign file', { 
                        file, 
                        error: error.message 
                    });
                }
            }
            
            logger.info('Campaigns loaded', { 
                total: this.campaigns.size,
                active: this.activeCampaigns.size 
            });
            
        } catch (error) {
            logger.error('Failed to load campaigns', { error: error.message });
        }
    }

    /**
     * Save campaign to disk
     * @param {Campaign} campaign - Campaign to save
     */
    async saveCampaign(campaign) {
        try {
            const filePath = path.join(this.campaignsPath, `${campaign.id}.json`);
            await fs.writeJson(filePath, campaign.toJSON(), { spaces: 2 });
            
            logger.debug('Campaign saved', { 
                id: campaign.id, 
                name: campaign.name 
            });
            
        } catch (error) {
            logger.error('Failed to save campaign', { 
                campaignId: campaign.id, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Create a new campaign
     * @param {Object} campaignData - Campaign configuration
     * @returns {Campaign} Created campaign
     */
    async createCampaign(campaignData) {
        try {
            const campaign = new Campaign(campaignData);
            
            // Validate campaign
            const validation = campaign.validate();
            if (!validation.isValid) {
                throw new Error(`Campaign validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Save to memory and disk
            this.campaigns.set(campaign.id, campaign);
            await this.saveCampaign(campaign);
            
            logger.info('Campaign created', { 
                id: campaign.id, 
                name: campaign.name,
                type: campaign.type 
            });
            
            return campaign;
            
        } catch (error) {
            logger.error('Failed to create campaign', { error: error.message });
            throw error;
        }
    }

    /**
     * Update an existing campaign
     * @param {string} campaignId - Campaign ID
     * @param {Object} updates - Updates to apply
     * @returns {Campaign} Updated campaign
     */
    async updateCampaign(campaignId, updates) {
        try {
            const campaign = this.campaigns.get(campaignId);
            if (!campaign) {
                throw new Error('Campaign not found');
            }
            
            // Apply updates
            campaign.update(updates);
            
            // Validate updated campaign
            const validation = campaign.validate();
            if (!validation.isValid) {
                throw new Error(`Campaign validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Update active campaigns set
            if (campaign.isActiveNow()) {
                this.activeCampaigns.add(campaignId);
            } else {
                this.activeCampaigns.delete(campaignId);
            }
            
            // Save to disk
            await this.saveCampaign(campaign);
            
            logger.info('Campaign updated', { 
                id: campaign.id, 
                name: campaign.name 
            });
            
            return campaign;
            
        } catch (error) {
            logger.error('Failed to update campaign', { 
                campaignId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Delete a campaign
     * @param {string} campaignId - Campaign ID
     */
    async deleteCampaign(campaignId) {
        try {
            const campaign = this.campaigns.get(campaignId);
            if (!campaign) {
                throw new Error('Campaign not found');
            }
            
            // Remove from memory
            this.campaigns.delete(campaignId);
            this.activeCampaigns.delete(campaignId);
            this.campaignStats.delete(campaignId);
            
            // Remove from disk
            const filePath = path.join(this.campaignsPath, `${campaignId}.json`);
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
            
            logger.info('Campaign deleted', { 
                id: campaignId, 
                name: campaign.name 
            });
            
        } catch (error) {
            logger.error('Failed to delete campaign', { 
                campaignId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get campaign by ID
     * @param {string} campaignId - Campaign ID
     * @returns {Campaign|null} Campaign or null if not found
     */
    getCampaign(campaignId) {
        return this.campaigns.get(campaignId) || null;
    }

    /**
     * Get all campaigns
     * @param {Object} filters - Optional filters
     * @returns {Array} Array of campaigns
     */
    getCampaigns(filters = {}) {
        let campaigns = Array.from(this.campaigns.values());
        
        // Apply filters
        if (filters.status) {
            campaigns = campaigns.filter(c => c.status === filters.status);
        }
        
        if (filters.type) {
            campaigns = campaigns.filter(c => c.type === filters.type);
        }
        
        if (filters.active !== undefined) {
            campaigns = campaigns.filter(c => c.isActiveNow() === filters.active);
        }
        
        // Sort by priority and creation date
        campaigns.sort((a, b) => {
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority;
            }
            
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        return campaigns;
    }

    /**
     * Get active campaigns
     * @returns {Array} Array of active campaigns
     */
    getActiveCampaigns() {
        return Array.from(this.activeCampaigns)
            .map(id => this.campaigns.get(id))
            .filter(campaign => campaign && campaign.isActiveNow());
    }

    /**
     * Start campaign monitoring
     */
    startCampaignMonitoring() {
        // Check campaign schedules every minute
        setInterval(() => {
            this.updateActiveCampaigns();
        }, 60000);
        
        logger.info('Campaign monitoring started');
    }

    /**
     * Update active campaigns based on schedules
     */
    updateActiveCampaigns() {
        try {
            const previousActive = new Set(this.activeCampaigns);
            this.activeCampaigns.clear();
            
            // Check each campaign's schedule
            for (const campaign of this.campaigns.values()) {
                if (campaign.isActiveNow()) {
                    this.activeCampaigns.add(campaign.id);
                    
                    // Log newly activated campaigns
                    if (!previousActive.has(campaign.id)) {
                        logger.info('Campaign activated by schedule', { 
                            id: campaign.id, 
                            name: campaign.name 
                        });
                    }
                } else if (previousActive.has(campaign.id)) {
                    // Log newly deactivated campaigns
                    logger.info('Campaign deactivated by schedule', { 
                        id: campaign.id, 
                        name: campaign.name 
                    });
                }
            }
            
        } catch (error) {
            logger.error('Error updating active campaigns', { error: error.message });
        }
    }

    /**
     * Get campaign statistics
     * @returns {Object} Campaign statistics
     */
    getStatistics() {
        const campaigns = Array.from(this.campaigns.values());
        
        return {
            total: campaigns.length,
            active: this.activeCampaigns.size,
            byStatus: campaigns.reduce((acc, campaign) => {
                acc[campaign.status] = (acc[campaign.status] || 0) + 1;
                return acc;
            }, {}),
            byType: campaigns.reduce((acc, campaign) => {
                acc[campaign.type] = (acc[campaign.type] || 0) + 1;
                return acc;
            }, {}),
            totalVisits: campaigns.reduce((sum, campaign) => sum + campaign.performance.totalVisits, 0),
            totalRevenue: campaigns.reduce((sum, campaign) => sum + campaign.performance.totalRevenue, 0)
        };
    }
}

module.exports = new CampaignManager();