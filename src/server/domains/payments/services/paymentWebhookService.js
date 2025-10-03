const Stripe = require('stripe');
const logger = require('../../../shared/utils/logger');
const licenseService = require('../../auth/services/licenseService');

/**
 * Payment Gateway Service Webhook Handler
 * Handles incoming webhook events from payment providers (Stripe)
 */
class PaymentWebhookService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  /**
   * Process incoming webhook event from Stripe
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Webhook signature for verification
   * @param {string} provider - Payment provider (currently only 'stripe')
   * @returns {Promise<Object>} Processing result
   */
  async processWebhookEvent(payload, signature, provider = 'stripe') {
    try {
      if (provider !== 'stripe') {
        throw new Error(`Unsupported payment provider: ${provider}`);
      }

      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      logger.info('Processing Stripe webhook event', {
        eventType: event.type,
        eventId: event.id,
      });

      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;
          
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
          
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
          
        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
          break;
      }

      return {
        success: true,
        eventId: event.id,
        eventType: event.type,
        processed: true
      };

    } catch (error) {
      logger.error('Error processing webhook event', {
        error: error.message,
        provider,
        signature
      });
      
      return {
        success: false,
        error: error.message,
        processed: false
      };
    }
  }

  /**
   * Handle checkout session completion
   * @param {Object} session - Stripe checkout session
   */
  async handleCheckoutSessionCompleted(session) {
    try {
      const { client_reference_id: userId, metadata } = session;
      
      if (!userId) {
        logger.warn('Checkout session completed without userId', { session });
        return;
      }

      // Update user's subscription based on checkout result
      const { tier, quantity } = metadata || {};
      
      if (tier) {
        // Update user subscription via license service
        await licenseService.setUserSubscription(userId, tier, {
          status: 'active',
          metadata: {
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent,
            createdAt: new Date().toISOString()
          }
        });
        
        logger.info('User subscription updated after checkout completion', {
          userId,
          tier,
          checkoutSessionId: session.id
        });
      }

    } catch (error) {
      logger.error('Error handling checkout session completion', {
        error: error.message,
        sessionId: session.id
      });
    }
  }

  /**
   * Handle subscription update (creation or update)
   * @param {Object} subscription - Stripe subscription object
   */
  async handleSubscriptionUpdated(subscription) {
    try {
      const userId = subscription.metadata?.userId || subscription.customer;
      
      if (!userId) {
        logger.warn('Subscription updated without userId', { subscription });
        return;
      }

      // Update user subscription via license service
      await licenseService.setUserSubscription(userId, subscription.plan?.nickname || 'pro', {
        status: subscription.status,
        metadata: {
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer,
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          updatedAt: new Date().toISOString()
        }
      });

      logger.info('User subscription updated from webhook', {
        userId,
        subscriptionId: subscription.id,
        status: subscription.status
      });

    } catch (error) {
      logger.error('Error handling subscription update', {
        error: error.message,
        subscriptionId: subscription.id
      });
    }
  }

  /**
   * Handle subscription deletion/cancellation
   * @param {Object} subscription - Stripe subscription object
   */
  async handleSubscriptionDeleted(subscription) {
    try {
      const userId = subscription.metadata?.userId || subscription.customer;
      
      if (!userId) {
        logger.warn('Subscription deleted without userId', { subscription });
        return;
      }

      // Update user subscription to cancelled
      await licenseService.setUserSubscription(userId, 'free', {
        status: 'cancelled',
        metadata: {
          stripeSubscriptionId: subscription.id,
          cancelledAt: new Date().toISOString()
        }
      });

      logger.info('User subscription cancelled from webhook', {
        userId,
        subscriptionId: subscription.id
      });

    } catch (error) {
      logger.error('Error handling subscription deletion', {
        error: error.message,
        subscriptionId: subscription.id
      });
    }
  }

  /**
   * Handle successful invoice payment
   * @param {Object} invoice - Stripe invoice object
   */
  async handleInvoicePaymentSucceeded(invoice) {
    try {
      const userId = invoice.metadata?.userId || invoice.customer;
      
      if (!userId) {
        logger.warn('Invoice payment succeeded without userId', { invoice });
        return;
      }

      // Update user's payment status
      // Additional processing can be added here if needed
      logger.info('Invoice payment succeeded', {
        userId,
        invoiceId: invoice.id,
        amount: invoice.amount_paid
      });

    } catch (error) {
      logger.error('Error handling invoice payment success', {
        error: error.message,
        invoiceId: invoice.id
      });
    }
  }

  /**
   * Handle failed invoice payment
   * @param {Object} invoice - Stripe invoice object
   */
  async handleInvoicePaymentFailed(invoice) {
    try {
      const userId = invoice.metadata?.userId || invoice.customer;
      
      if (!userId) {
        logger.warn('Invoice payment failed without userId', { invoice });
        return;
      }

      // Handle payment failure - could downgrade user, send notifications, etc.
      logger.warn('Invoice payment failed', {
        userId,
        invoiceId: invoice.id,
        amount: invoice.amount_due
      });

    } catch (error) {
      logger.error('Error handling invoice payment failure', {
        error: error.message,
        invoiceId: invoice.id
      });
    }
  }
}

module.exports = new PaymentWebhookService();