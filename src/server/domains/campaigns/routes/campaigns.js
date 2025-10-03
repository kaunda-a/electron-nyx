const express = require('express');
const router = express.Router();
const CampaignController = require('../../campaigns/controllers/campaignController');
const syncService = require('../../../system/services/syncService');
const campaignManager = require('../../campaigns/services/campaignManager');

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

// Sync-related routes
router.post('/sync', async (req, res) => {
    try {
        const userId = req.user?.id; // Assuming user authentication
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const result = await syncService.syncCampaigns(userId);
        res.json({
            success: true,
            message: 'Campaign sync completed',
            data: result
        });
    } catch (error) {
        console.error('Campaign sync failed:', error);
        res.status(500).json({
            success: false,
            error: 'Campaign sync failed',
            message: error.message
        });
    }
});

module.exports = router;