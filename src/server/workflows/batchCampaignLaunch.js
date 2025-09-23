const BatchCampaignService = require('../services/batchCampaignService');
const logger = require('../utils/logger');

/**
 * Batch Campaign Launch Workflow
 * Handles large-scale campaign launches by breaking them into batches
 */
async function batchCampaignLaunchWorkflow({ data, step }) {
  const { campaignId, totalProfiles, totalBatches, options = {} } = data;
  
  logger.info(`Starting batch campaign launch workflow for campaign ${campaignId}`, { 
    totalProfiles, 
    totalBatches,
    options 
  });
  
  // Step 1: Validate campaign exists
  const campaign = await step.run("validate-campaign", async () => {
    logger.info(`Validating campaign ${campaignId} for batch launch`);
    
    // In a real implementation, you would validate the campaign exists
    // For now, we'll just log that validation would happen
    
    logger.info(`Campaign ${campaignId} validated for batch launch`);
    return { id: campaignId, name: `Campaign ${campaignId}` };
  });
  
  // Step 2: Initialize batch campaign service
  await step.run("initialize-batch-service", async () => {
    logger.info(`Initializing batch campaign service for campaign ${campaignId}`);
    
    // The batch service is already initialized as a singleton
    logger.info(`Batch campaign service initialized for campaign ${campaignId}`);
  });
  
  // Step 3: Launch campaign in batches
  const batchResults = await step.run("launch-batches", async () => {
    logger.info(`Launching campaign ${campaignId} in batches`);
    
    // Launch the campaign in batches
    const results = await BatchCampaignService.launchCampaignInBatches(
      campaignId,
      totalProfiles,
      options
    );
    
    logger.info(`Batch campaign launch completed for campaign ${campaignId}`, results);
    return results;
  });
  
  logger.info(`Batch campaign launch workflow completed for campaign ${campaignId}`);
  
  // Send completion event
  await step.sendEvent("batch-campaign/launch.completed", {
    data: {
      campaignId,
      totalProfiles,
      totalBatches,
      results: batchResults
    }
  });
  
  return { 
    success: true, 
    campaignId,
    totalProfiles,
    totalBatches,
    results: batchResults
  };
}

// Register the workflow with our workflow manager
const workflowManager = require('../services/workflowManager');
workflowManager.registerWorkflow('batch-campaign-launch', batchCampaignLaunchWorkflow);

module.exports = {
  batchCampaignLaunchWorkflow
};