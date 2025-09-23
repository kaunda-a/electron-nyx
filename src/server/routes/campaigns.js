const express = require('express');
const router = express.Router();
const CampaignController = require('../controllers/campaignController');
const campaignManager = require('../services/campaignManager');

// Create controller instance with campaign manager
const campaignController = new CampaignController(campaignManager);

// Campaign management routes
router.get('/', campaignController.getAllCampaigns.bind(campaignController));
router.post('/', campaignController.createCampaign.bind(campaignController));
router.get('/stats', campaignController.getCampaignStats.bind(campaignController));
router.get('/:campaignId', campaignController.getCampaign.bind(campaignController));
router.put('/:campaignId', campaignController.updateCampaign.bind(campaignController));
router.delete('/:campaignId', campaignController.deleteCampaign.bind(campaignController));
router.post('/:campaignId/launch', campaignController.launchCampaign.bind(campaignController));
router.get('/:campaignId/progress', campaignController.getCampaignProgress.bind(campaignController));

// Bulk operations
router.post('/bulk/update', campaignController.bulkUpdateCampaigns.bind(campaignController));
router.post('/bulk/delete', campaignController.bulkDeleteCampaigns.bind(campaignController));
router.post('/bulk/pause', campaignController.bulkPauseCampaigns.bind(campaignController));

module.exports = router;