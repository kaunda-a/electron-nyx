const express = require('express');
const paymentWebhookService = require('../services/paymentWebhookService');
const logger = require('../../../shared/utils/logger');

const router = express.Router();

// Webhook endpoint - no authentication needed as Stripe validates signature
router.post('/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    logger.error('Stripe webhook secret is not configured');
    return res.status(500).send('Webhook secret not configured');
  }

  try {
    // Process the webhook event
    const result = await paymentWebhookService.processWebhookEvent(
      req.body.toString(),
      sig,
      'stripe'
    );

    if (result.success) {
      logger.info('Stripe webhook processed successfully', {
        eventId: result.eventId,
        eventType: result.eventType
      });
      res.status(200).json({ received: true });
    } else {
      logger.error('Error processing Stripe webhook', {
        error: result.error
      });
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Unexpected error processing webhook', {
      error: error.message
    });
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

module.exports = router;