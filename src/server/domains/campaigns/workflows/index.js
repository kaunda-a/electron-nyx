// Export all custom workflows
const { campaignLaunchWorkflow } = require('./campaignLaunch');
const { enhancedCampaignLaunchWorkflow } = require('./enhancedCampaignLaunch');
const { batchCampaignLaunchWorkflow } = require('./batchCampaignLaunch');

module.exports = {
  campaignLaunchWorkflow,
  enhancedCampaignLaunchWorkflow,
  batchCampaignLaunchWorkflow
};