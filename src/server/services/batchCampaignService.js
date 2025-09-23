const workflowManager = require('../services/workflowManager');
const logger = require('../utils/logger');

/**
 * Batch Campaign Service
 * Handles large-scale campaign launches by breaking them into batches
 */
class BatchCampaignService {
    constructor() {
        this.batchSize = parseInt(process.env.CAMPAIGN_BATCH_SIZE) || 100;
        this.delayBetweenBatches = parseInt(process.env.BATCH_DELAY_MS) || 30000; // 30 seconds
        this.maxConcurrentBatches = parseInt(process.env.MAX_CONCURRENT_BATCHES) || 3;
    }

    /**
     * Launch campaign in batches for large-scale execution
     * @param {string} campaignId - Campaign ID
     * @param {number} totalProfiles - Total number of profiles to launch
     * @param {Object} options - Launch options
     * @returns {Object} Batch launch results
     */
    async launchCampaignInBatches(campaignId, totalProfiles, options = {}) {
        const totalBatches = Math.ceil(totalProfiles / this.batchSize);
        const results = {
            campaignId,
            totalBatches,
            completedBatches: 0,
            totalProfiles,
            completedProfiles: 0,
            errors: [],
            jobId: null
        };

        logger.info(`Launching campaign ${campaignId} in ${totalBatches} batches of ${this.batchSize}`, {
            totalProfiles,
            batchSize: this.batchSize
        });

        // For very large campaigns, launch as a background job
        if (totalBatches > 10) {
            // Create a workflow job for batch processing
            const jobId = await workflowManager.trigger('batch-campaign-launch', {
                campaignId,
                totalProfiles,
                totalBatches,
                options
            });
            
            results.jobId = jobId;
            logger.info(`Large campaign queued as background job`, { jobId });
            
            return {
                success: true,
                message: 'Large campaign queued for background processing',
                data: results
            };
        }

        // For smaller batch campaigns, process synchronously
        for (let batch = 0; batch < totalBatches; batch++) {
            const profilesInBatch = Math.min(this.batchSize, totalProfiles - (batch * this.batchSize));
            
            try {
                logger.info(`Launching batch ${batch + 1}/${totalBatches} with ${profilesInBatch} profiles`);
                
                // Launch batch using existing workflow manager
                const jobId = await workflowManager.trigger('enhanced-campaign-launch', {
                    campaignId,
                    options: {
                        ...options,
                        profileCount: profilesInBatch,
                        batchNumber: batch + 1,
                        totalBatches: totalBatches
                    }
                });

                // Wait for batch completion (or use events)
                await this.waitForBatchCompletion(jobId);
                
                results.completedBatches++;
                results.completedProfiles += profilesInBatch;
                
                logger.info(`Batch ${batch + 1} completed successfully`);
                
                // Delay between batches to avoid overwhelming system
                if (batch < totalBatches - 1) {
                    logger.info(`Waiting ${this.delayBetweenBatches}ms before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
                }
                
            } catch (error) {
                logger.error(`Batch ${batch + 1} failed`, { error: error.message });
                results.errors.push({
                    batch: batch + 1,
                    error: error.message
                });
            }
        }

        logger.info(`Batch campaign launch completed`, results);
        return {
            success: results.errors.length === 0,
            message: `Batch campaign completed with ${results.errors.length} errors`,
            data: results
        };
    }

    /**
     * Wait for batch completion
     * @param {string} jobId - Workflow job ID
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise} Resolves when batch completes
     */
    async waitForBatchCompletion(jobId, timeoutMs = 300000) { // 5 minutes timeout
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                const job = workflowManager.getJob(jobId);
                if (job && job.status === 'completed') {
                    clearInterval(checkInterval);
                    resolve(job);
                } else if (job && job.status === 'failed') {
                    clearInterval(checkInterval);
                    reject(new Error('Batch job failed'));
                } else if (Date.now() - startTime > timeoutMs) {
                    clearInterval(checkInterval);
                    reject(new Error('Batch job timeout'));
                }
            }, 5000); // Check every 5 seconds
        });
    }

    /**
     * Get batch campaign progress
     * @param {string} campaignId - Campaign ID
     * @returns {Object} Progress information
     */
    async getProgress(campaignId) {
        // This would integrate with the storage service to get real progress
        // For now, we'll return a placeholder
        try {
            // In a real implementation, this would query the database or file storage
            // to get actual progress information
            return {
                campaignId,
                status: 'running',
                progress: 0,
                estimatedCompletion: null
            };
        } catch (error) {
            logger.error('Failed to get batch campaign progress', { 
                error: error.message, 
                campaignId 
            });
            return null;
        }
    }
}

module.exports = new BatchCampaignService();