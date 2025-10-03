const express = require('express');
const router = express.Router();
const UnifiedPaymentController = require('../controllers/UnifiedPaymentController');

// Create controller instance
const paymentController = new UnifiedPaymentController();

// Public endpoints (no authentication required for price calculation)
router.get('/calculate-price', paymentController.calculateProfilePrice.bind(paymentController));
router.get('/config', paymentController.getPaymentConfig.bind(paymentController));
router.get('/tiers', paymentController.getSubscriptionTiers.bind(paymentController));

// Webhook endpoint (public - no authentication)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handlePaymentWebhook.bind(paymentController));

// Export the router
module.exports = router;