// Script to manually register workflows
console.log('Registering workflows...');

// Import workflow files to trigger registration
require('./campaignLaunch');
require('./enhancedCampaignLaunch');
require('./batchCampaignLaunch');

console.log('Workflows registered successfully');