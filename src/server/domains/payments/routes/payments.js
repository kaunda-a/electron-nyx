const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');

// Create controller instance
const paymentController = new PaymentController();

// Public endpoints (no authentication required for price calculation)
router.get('/calculate-price', paymentController.calculateProfilePrice.bind(paymentController));
router.get('/config', paymentController.getPaymentConfig.bind(paymentController));
router.get('/tiers', paymentController.getSubscriptionTiers.bind(paymentController));

// Webhook endpoint (public - no authentication)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handlePaymentWebhook.bind(paymentController));

// Protected endpoints (authentication required)
// These would typically be protected by auth middleware in a real implementation

// Profile purchase endpoints
router.post('/profiles/purchase', paymentController.processProfilePurchase.bind(paymentController));
router.get('/profiles/validate/:sessionId', paymentController.validatePaymentCompletion.bind(paymentController));

// Subscription endpoints
router.post('/subscriptions', paymentController.processSubscription.bind(paymentController));
router.get('/subscriptions/validate/:sessionId', paymentController.validatePaymentCompletion.bind(paymentController));

// Refund endpoints
router.post('/refunds', paymentController.processRefund.bind(paymentController));

// Analytics endpoints
router.get('/analytics', paymentController.getPaymentConfig.bind(paymentController));

module.exports = router;