const express = require('express');
const router = express.Router();
const LicenseController = require('../controllers/LicenseController');
const { validateIPCAuth } = require('../middleware/ipcAuthMiddleware');

// Create controller instance
const licenseController = new LicenseController();

// Public routes
router.get('/tiers', licenseController.getTiers.bind(licenseController));

// Protected routes (require authentication)
router.get('/subscription', validateIPCAuth, licenseController.getSubscription.bind(licenseController));
router.get('/analytics', validateIPCAuth, licenseController.getAnalytics.bind(licenseController));
router.get('/upgrade-recommendation', validateIPCAuth, licenseController.getUpgradeRecommendation.bind(licenseController));
router.get('/validate', validateIPCAuth, licenseController.validateSubscription.bind(licenseController));
router.get('/quotas', validateIPCAuth, licenseController.getQuotas.bind(licenseController));

// Subscription management routes
router.post('/upgrade', validateIPCAuth, licenseController.upgradeSubscription.bind(licenseController));
router.post('/cancel', validateIPCAuth, licenseController.cancelSubscription.bind(licenseController));

module.exports = router;