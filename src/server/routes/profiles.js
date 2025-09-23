const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/systemController');

// Create controller instance
const systemController = new SystemController();

// Profile management routes
router.get('/', systemController.getAllProfiles.bind(systemController));
router.post('/', systemController.createProfile.bind(systemController));
router.get('/:profileId', systemController.getProfile.bind(systemController));
router.put('/:profileId', systemController.updateProfile.bind(systemController));
router.delete('/:profileId', systemController.deleteProfile.bind(systemController));
router.get('/:profileId/stats', systemController.getProfileStats.bind(systemController));
router.get('/:profileId/fingerprint', systemController.getProfileFingerprint.bind(systemController));
router.post('/batch', systemController.createBatchProfiles.bind(systemController));
router.post('/:profileId/launch', systemController.launchProfileDirect.bind(systemController));
// Commenting out the route that causes the error since launchProfile method doesn't exist in the current SystemController
// router.post('/:profileId/launch-inngest', systemController.launchProfile.bind(systemController));
router.post('/:profileId/browser-config', systemController.setProfileBrowserConfig.bind(systemController));
router.post('/:profileId/close', systemController.closeProfileBrowser.bind(systemController));
router.post('/import/json', systemController.importProfile.bind(systemController));
router.post('/:profileId/assign-proxy', systemController.assignProxyToProfile.bind(systemController));

module.exports = router;