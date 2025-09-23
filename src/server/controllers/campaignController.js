// Campaign Controller
const logger = require('../utils/logger');
const campaignManager = require('../services/campaignManager');

class CampaignController {
    constructor() {
        // Campaign manager is imported directly as a singleton
        this.campaignManager = campaignManager;
    }
    
    // Get all campaigns
    async getAllCampaigns(req, res) {
        try {
            logger.info('Getting all campaigns');
            
            // Check if campaignManager is initialized
            if (!this.campaignManager.isInitialized) {
                logger.info('Campaign manager not initialized, initializing...');
                await this.campaignManager.initialize();
            }
            
            const campaigns = this.campaignManager.getCampaigns();
            // Convert campaigns to JSON format for the response
            const campaignsJson = campaigns.map(campaign => campaign.toJSON ? campaign.toJSON() : campaign);
            
            logger.info(`Retrieved ${campaigns.length} campaigns`);
            res.json(campaignsJson);
        } catch (error) {
            logger.error('Failed to get all campaigns', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get campaigns',
                message: error.message
            });
        }
    }

    // Get a specific campaign by ID
    async getCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            logger.info('Getting campaign', { campaignId });
            
            const campaign = this.campaignManager.getCampaign(campaignId);
            
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }
            
            res.json({
                success: true,
                data: campaign.toJSON ? campaign.toJSON() : campaign
            });
        } catch (error) {
            logger.error('Failed to get campaign', { error: error.message, campaignId: req.params.campaignId });
            res.status(500).json({
                success: false,
                error: 'Failed to get campaign',
                message: error.message
            });
        }
    }

    // Create a new campaign
    async createCampaign(req, res) {
        try {
            const campaignData = req.body;
            logger.info('Creating campaign', { campaignData });
            
            if (!campaignData.name) {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign name is required'
                });
            }
            
            // Validate campaign data
            const validation = this.validateCampaignData(campaignData);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid campaign data',
                    details: validation.errors
                });
            }
            
            const campaign = await this.campaignManager.createCampaign(campaignData);
            
            res.status(201).json({
                success: true,
                message: 'Campaign created successfully',
                data: campaign.toJSON ? campaign.toJSON() : campaign
            });
        } catch (error) {
            logger.error('Failed to create campaign', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to create campaign',
                message: error.message
            });
        }
    }
    
    // Validate campaign data
    validateCampaignData(campaignData) {
        const errors = [];
        
        // Validate daily visit target
        if (campaignData.settings && campaignData.settings.dailyVisitTarget !== undefined) {
            const dailyTarget = parseInt(campaignData.settings.dailyVisitTarget);
            if (isNaN(dailyTarget) || dailyTarget < 0) {
                errors.push('Daily visit target must be a positive number');
            }
        }
        
        // Validate max concurrent sessions
        if (campaignData.settings && campaignData.settings.maxConcurrentSessions !== undefined) {
            const maxSessions = parseInt(campaignData.settings.maxConcurrentSessions);
            if (isNaN(maxSessions) || maxSessions < 1) {
                errors.push('Max concurrent sessions must be at least 1');
            }
        }
        
        // Validate targeting configuration
        if (campaignData.targeting) {
            if (campaignData.targeting.countries && !Array.isArray(campaignData.targeting.countries)) {
                errors.push('Targeting countries must be an array');
            }
            
            if (campaignData.targeting.adNetworks && !Array.isArray(campaignData.targeting.adNetworks)) {
                errors.push('Targeting ad networks must be an array');
            }
        }
        
        // Validate target URLs
        if (campaignData.targets && campaignData.targets.urls) {
            if (!Array.isArray(campaignData.targets.urls)) {
                errors.push('Target URLs must be an array');
            } else {
                for (const url of campaignData.targets.urls) {
                    try {
                        new URL(url);
                    } catch (e) {
                        errors.push(`Invalid URL: ${url}`);
                    }
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Update a campaign
    async updateCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const updateData = req.body;
            logger.info('Updating campaign', { campaignId, updateData });
            
            // Validate campaign data if provided
            if (Object.keys(updateData).length > 0) {
                const validation = this.validateCampaignData(updateData);
                if (!validation.isValid) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid campaign data',
                        details: validation.errors
                    });
                }
            }
            
            const campaign = await this.campaignManager.updateCampaign(campaignId, updateData);
            
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }
            
            res.json({
                success: true,
                message: 'Campaign updated successfully',
                data: campaign.toJSON ? campaign.toJSON() : campaign
            });
        } catch (error) {
            logger.error('Failed to update campaign', { error: error.message, campaignId: req.params.campaignId });
            res.status(500).json({
                success: false,
                error: 'Failed to update campaign',
                message: error.message
            });
        }
    }

    // Delete a campaign
    async deleteCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            logger.info('Deleting campaign', { campaignId });
            
            const success = await this.campaignManager.deleteCampaign(campaignId);
            
            if (!success) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }
            
            res.json({
                success: true,
                message: 'Campaign deleted successfully'
            });
        } catch (error) {
            logger.error('Failed to delete campaign', { error: error.message, campaignId: req.params.campaignId });
            
            // Handle specific error cases
            if (error.message.includes('active')) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete active campaign',
                    message: 'Please pause the campaign before deleting'
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Failed to delete campaign',
                message: error.message
            });
        }
    }

    // Get campaign statistics
    async getCampaignStats(req, res) {
        try {
            logger.info('Getting campaign statistics');
            
            // Check if campaignManager is initialized
            if (!this.campaignManager.isInitialized) {
                logger.info('Campaign manager not initialized, initializing...');
                await this.campaignManager.initialize();
            }
            
            const stats = this.campaignManager.getStatistics();
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Failed to get campaign statistics', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get campaign statistics',
                message: error.message
            });
        }
    }

    // Get campaign progress
    async getCampaignProgress(req, res) {
        try {
            const { campaignId } = req.params;
            logger.info('Getting campaign progress', { campaignId });

            // Check if campaignManager is initialized
            if (!this.campaignManager.isInitialized) {
                logger.info('Campaign manager not initialized, initializing...');
                await this.campaignManager.initialize();
            }

            // Get campaign to verify it exists
            const campaign = this.campaignManager.getCampaign(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            // Try to get progress from workflow manager
            const workflowManager = require('../services/workflowManager');
            const jobs = workflowManager.getAllJobs();
            
            // Find jobs related to this campaign
            const campaignJobs = jobs.filter(job => 
                job.data && job.data.campaignId === campaignId
            );

            if (campaignJobs.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        campaignId,
                        status: 'pending',
                        progress: 0
                    }
                });
            }

            // Calculate overall progress
            const totalJobs = campaignJobs.length;
            const completedJobs = campaignJobs.filter(job => job.status === 'completed').length;
            const failedJobs = campaignJobs.filter(job => job.status === 'failed').length;
            const runningJobs = campaignJobs.filter(job => job.status === 'running').length;
            
            const progress = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
            
            let status = 'pending';
            if (runningJobs > 0) {
                status = 'running';
            } else if (completedJobs === totalJobs) {
                status = 'completed';
            } else if (failedJobs > 0) {
                status = 'failed';
            }

            res.json({
                success: true,
                data: {
                    campaignId,
                    status,
                    progress,
                    totalJobs,
                    completedJobs,
                    failedJobs,
                    runningJobs,
                    estimatedCompletion: this.estimateCompletionTime(campaignJobs)
                }
            });

        } catch (error) {
            logger.error('Failed to get campaign progress', { error: error.message, campaignId: req.params.campaignId });
            res.status(500).json({
                success: false,
                error: 'Failed to get campaign progress',
                message: error.message
            });
        }
    }

    // Estimate completion time based on current jobs
    estimateCompletionTime(jobs) {
        // Simple estimation based on job status
        const runningJobs = jobs.filter(job => job.status === 'running').length;
        const pendingJobs = jobs.filter(job => job.status === 'pending').length;
        
        if (runningJobs === 0 && pendingJobs === 0) {
            return 'Soon';
        }
        
        // Rough estimate: 2 minutes per job
        const totalRemaining = runningJobs + pendingJobs;
        const minutes = totalRemaining * 2;
        
        if (minutes < 60) {
            return `${minutes} minutes`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes === 0) {
            return `${hours} hours`;
        }
        
        return `${hours}h ${remainingMinutes}m`;
    }

    // Launch a campaign
    async launchCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { 
                profileCount = 1,
                profileIds = [],
                options = {},
                useEnhanced = false,  // Flag to use enhanced workflow with file-based storage
                useBatch = false,     // Flag to use batch processing for large campaigns
                useDatabaseStorage = false  // Flag to use database storage instead of file-based
            } = req.body;

            logger.info('Launching campaign', { campaignId, profileCount, profileIds, useEnhanced, useBatch, useDatabaseStorage });

            // Validate campaign exists and is active
            const campaign = this.campaignManager.getCampaign(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    error: 'Campaign not found'
                });
            }

            if (campaign.status !== 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign is not active',
                    message: 'Only active campaigns can be launched'
                });
            }

            // For very large campaigns, use batch processing automatically
            const useBatchProcessing = useBatch || profileCount > 500;
            
            if (useBatchProcessing) {
                // Use batch campaign service for large campaigns
                const BatchCampaignService = require('../services/batchCampaignService');
                
                // Start batch processing (non-blocking)
                setImmediate(async () => {
                    try {
                        const results = await BatchCampaignService.launchCampaignInBatches(
                            campaignId, 
                            profileCount, 
                            { ...options, useEnhanced, useDatabaseStorage }
                        );
                        logger.info('Batch campaign completed', results);
                    } catch (error) {
                        logger.error('Batch campaign failed', { 
                            error: error.message, 
                            campaignId 
                        });
                    }
                });

                return res.json({
                    success: true,
                    message: 'Large campaign initiated for background processing',
                    data: {
                        campaignId,
                        totalProfiles: profileCount,
                        estimatedBatches: Math.ceil(profileCount / 100),
                        estimatedDuration: `${Math.ceil(profileCount / 100) * 2} minutes`
                    }
                });
            }

            // Trigger campaign launch workflow using our custom workflow manager
            const workflowManager = require('../services/workflowManager');
            const profilePoolManager = require('../services/profilePoolManager');
            
            // Validate that specified profiles have assigned proxies
            if (profileIds && profileIds.length > 0) {
                for (const profileId of profileIds) {
                    const profile = profilePoolManager.getProfileById(profileId);
                    if (profile && !profile.assignedProxy) {
                        logger.warn(`Profile ${profileId} does not have an assigned proxy, attempting to assign one`);
                        try {
                            await profilePoolManager.assignProxyToProfile(profileId);
                        } catch (assignError) {
                            logger.error(`Failed to assign proxy to profile ${profileId}:`, assignError.message);
                            return res.status(400).json({
                                success: false,
                                error: `Failed to assign proxy to profile ${profileId}`,
                                message: assignError.message
                            });
                        }
                    }
                }
            }
            
            // Choose workflow based on flags
            let workflowName = 'campaign-launch'; // Default workflow
            if (useEnhanced) {
                workflowName = 'enhanced-campaign-launch';
            }
            
            const jobId = await workflowManager.trigger(workflowName, {
                campaignId,
                options: {
                    profileCount,
                    profileIds,
                    useDatabaseStorage, // Pass storage option to workflow
                    ...options
                }
            });

            res.json({
                success: true,
                message: 'Campaign launch initiated',
                data: {
                    campaignId,
                    jobId: jobId,
                    workflow: workflowName
                }
            });

        } catch (error) {
            logger.error('Failed to launch campaign', { error: error.message, campaignId: req.params.campaignId });
            res.status(500).json({
                success: false,
                error: 'Failed to launch campaign',
                message: error.message
            });
        }
    }

    // Bulk delete campaigns
    async bulkDeleteCampaigns(req, res) {
        try {
            const { campaignIds } = req.body;
            logger.info('Bulk deleting campaigns', { campaignIds });

            if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign IDs array is required'
                });
            }

            const deletedCampaigns = [];
            const errors = [];

            // Delete each campaign
            for (const campaignId of campaignIds) {
                try {
                    const success = await this.campaignManager.deleteCampaign(campaignId);
                    if (success) {
                        deletedCampaigns.push(campaignId);
                    } else {
                        errors.push(`Campaign not found: ${campaignId}`);
                    }
                } catch (error) {
                    errors.push(`Failed to delete campaign ${campaignId}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Deleted ${deletedCampaigns.length} campaigns successfully`,
                data: deletedCampaigns,
                errors: errors,
                count: deletedCampaigns.length
            });

        } catch (error) {
            logger.error('Failed to bulk delete campaigns', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to bulk delete campaigns',
                message: error.message
            });
        }
    }

    // Bulk update campaigns
    async bulkUpdateCampaigns(req, res) {
        try {
            const { campaignIds, updateData } = req.body;
            logger.info('Bulk updating campaigns', { campaignIds, updateData });

            if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign IDs array is required'
                });
            }

            if (!updateData || typeof updateData !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Update data is required'
                });
            }

            const updatedCampaigns = [];
            const errors = [];

            // Update each campaign
            for (const campaignId of campaignIds) {
                try {
                    const campaign = await this.campaignManager.updateCampaign(campaignId, updateData);
                    if (campaign) {
                        updatedCampaigns.push(campaign.toJSON ? campaign.toJSON() : campaign);
                    } else {
                        errors.push(`Campaign not found: ${campaignId}`);
                    }
                } catch (error) {
                    errors.push(`Failed to update campaign ${campaignId}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Updated ${updatedCampaigns.length} campaigns successfully`,
                data: updatedCampaigns,
                errors: errors,
                count: updatedCampaigns.length
            });

        } catch (error) {
            logger.error('Failed to bulk update campaigns', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to bulk update campaigns',
                message: error.message
            });
        }
    }

    // Bulk pause campaigns
    async bulkPauseCampaigns(req, res) {
        try {
            const { campaignIds } = req.body;
            logger.info('Bulk pausing campaigns', { campaignIds });

            if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Campaign IDs array is required'
                });
            }

            const pausedCampaigns = [];
            const errors = [];

            // Pause each campaign
            for (const campaignId of campaignIds) {
                try {
                    const campaign = this.campaignManager.getCampaign(campaignId);
                    if (!campaign) {
                        errors.push(`Campaign not found: ${campaignId}`);
                        continue;
                    }

                    // Update campaign status to paused
                    const updatedCampaign = await this.campaignManager.updateCampaign(campaignId, { status: 'paused' });
                    pausedCampaigns.push(updatedCampaign.toJSON ? updatedCampaign.toJSON() : updatedCampaign);
                } catch (error) {
                    errors.push(`Failed to pause campaign ${campaignId}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                message: `Paused ${pausedCampaigns.length} campaigns successfully`,
                data: pausedCampaigns,
                errors: errors,
                count: pausedCampaigns.length
            });

        } catch (error) {
            logger.error('Failed to bulk pause campaigns', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to bulk pause campaigns',
                message: error.message
            });
        }
    }
}

module.exports = CampaignController;