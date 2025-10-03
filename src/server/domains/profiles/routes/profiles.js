const express = require('express');
const router = express.Router();
const SystemController = require('../../../system/controllers/systemController');
const syncService = require('../../../system/services/syncService');
const { validateIPCAuth } = require('../../../domains/auth/middleware/ipcAuthMiddleware');
const { checkProfileCreationQuota, checkProfileImportQuota, addProfileQuotaHeaders } = require('../middleware/profileQuotaMiddleware');

// Create controller instance
const systemController = new SystemController();

// Profile management routes
router.get('/', addProfileQuotaHeaders, systemController.getAllProfiles.bind(systemController));
router.post('/', checkProfileCreationQuota, addProfileQuotaHeaders, systemController.createProfile.bind(systemController));
router.get('/:profileId', addProfileQuotaHeaders, systemController.getProfile.bind(systemController));
router.put('/:profileId', addProfileQuotaHeaders, systemController.updateProfile.bind(systemController));
router.delete('/:profileId', addProfileQuotaHeaders, systemController.deleteProfile.bind(systemController));
router.get('/:profileId/stats', addProfileQuotaHeaders, systemController.getProfileStats.bind(systemController));
router.get('/:profileId/fingerprint', addProfileQuotaHeaders, systemController.getProfileFingerprint.bind(systemController));
router.post('/batch', checkProfileCreationQuota, addProfileQuotaHeaders, systemController.createBatchProfiles.bind(systemController));
router.post('/:profileId/launch', addProfileQuotaHeaders, systemController.launchProfileDirect.bind(systemController));
router.post('/:profileId/browser-config', addProfileQuotaHeaders, systemController.setProfileBrowserConfig.bind(systemController));
router.post('/:profileId/close', addProfileQuotaHeaders, systemController.closeProfileBrowser.bind(systemController));
router.post('/import/json', checkProfileImportQuota, addProfileQuotaHeaders, systemController.importProfile.bind(systemController));
router.post('/:profileId/assign-proxy', addProfileQuotaHeaders, systemController.assignProxyToProfile.bind(systemController));

// Profile sync routes
router.post('/sync', async (req, res) => {
    try {
        const userId = req.user?.id; // Assuming user authentication
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        
        const result = await syncService.syncProfiles(userId);
        res.json({
            success: true,
            message: 'Profile sync completed',
            data: result
        });
    } catch (error) {
        console.error('Profile sync failed:', error);
        res.status(500).json({
            success: false,
            error: 'Profile sync failed',
            message: error.message
        });
    }
});

module.exports = router;