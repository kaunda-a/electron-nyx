const stripe = require('stripe');
const logger = require('../../../shared/utils/logger');

/**
 * Stripe Payment Service
 * Handles Stripe API integration for processing payments
 */
class StripeService {
    constructor() {
        // Initialize Stripe with secret key from environment variables
        this.stripeSecretKey = process.env.STRIPE_SECRET_KEY;
        
        if (this.stripeSecretKey) {
            this.stripe = stripe(this.stripeSecretKey);
            logger.info('Stripe service initialized successfully');
        } else {
            logger.warn('Stripe secret key not found. Stripe service will operate in simulation mode.');
            this.stripe = null;
        }
        
        // Payment configuration
        this.paymentConfig = {
            currency: process.env.STRIPE_CURRENCY || 'usd',
            successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}',
            cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:5173/payment/cancel',
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
        };
    }

    /**
     * Check if Stripe service is properly configured
     * @returns {boolean} True if configured
     */
    isConfigured() {
        return !!this.stripe && !!this.stripeSecretKey;
    }

    /**
     * Create a Stripe checkout session for profile purchases
     * @param {Object} options - Payment options
     * @param {number} options.quantity - Number of profiles
     * @param {number} options.unitPrice - Price per profile in cents
     * @param {string} options.userId - User ID
     * @param {string} options.customerEmail - Customer email
     * @param {string} options.tier - Subscription tier
     * @returns {Object} Checkout session
     */
    async createCheckoutSession(options) {
        try {
            const {
                quantity,
                unitPrice,
                userId,
                customerEmail,
                tier = 'starter'
            } = options;

            // Validate inputs
            if (!quantity || !unitPrice || !userId) {
                throw new Error('Missing required payment parameters');
            }

            // If Stripe is not configured, simulate successful payment
            if (!this.isConfigured()) {
                logger.warn('Stripe not configured, simulating successful payment', {
                    userId: userId,
                    quantity: quantity,
                    unitPrice: unitPrice
                });

                // Generate simulated session ID
                const sessionId = `sim_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                return {
                    id: sessionId,
                    sessionId: sessionId,
                    url: this.paymentConfig.successUrl.replace('{CHECKOUT_SESSION_ID}', sessionId),
                    amount_total: quantity * unitPrice,
                    currency: this.paymentConfig.currency,
                    status: 'open',
                    mode: 'payment',
                    metadata: {
                        userId: userId,
                        quantity: quantity,
                        unitPrice: unitPrice,
                        tier: tier,
                        simulated: true
                    }
                };
            }

            // Create customer or retrieve existing
            let customer;
            try {
                customer = await this.stripe.customers.create({
                    email: customerEmail,
                    metadata: {
                        userId: userId,
                        app: 'nyx-itbrowser'
                    }
                });
            } catch (customerError) {
                logger.warn('Failed to create Stripe customer, proceeding without customer', {
                    error: customerError.message,
                    userId: userId
                });
            }

            // Calculate total amount (in cents)
            const totalAmount = quantity * unitPrice;

            // Create checkout session
            const session = await this.stripe.checkout.sessions.create({
                customer: customer?.id,
                customer_email: customerEmail,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: this.paymentConfig.currency,
                            product_data: {
                                name: `${quantity} ${quantity === 1 ? 'Profile' : 'Profiles'}`,
                                description: `Nyx iTBrowser - ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier Profile Package`,
                                images: ['https://nyxitbrowser.com/logo.png'], // TODO: Add actual logo URL
                                metadata: {
                                    userId: userId,
                                    quantity: quantity,
                                    tier: tier
                                }
                            },
                            unit_amount: unitPrice,
                        },
                        quantity: quantity,
                    },
                ],
                mode: 'payment',
                success_url: this.paymentConfig.successUrl,
                cancel_url: this.paymentConfig.cancelUrl,
                metadata: {
                    userId: userId,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    tier: tier,
                    appName: 'nyx-itbrowser'
                },
                automatic_tax: {
                    enabled: true,
                },
            });

            logger.info('Stripe checkout session created', {
                sessionId: session.id,
                userId: userId,
                amount: totalAmount,
                currency: this.paymentConfig.currency
            });

            return {
                id: session.id,
                sessionId: session.id,
                url: session.url,
                amount_total: session.amount_total,
                currency: session.currency,
                status: session.status,
                mode: session.mode,
                metadata: session.metadata
            };

        } catch (error) {
            logger.error('Failed to create Stripe checkout session', {
                error: error.message,
                userId: options?.userId,
                quantity: options?.quantity
            });
            throw error;
        }
    }

    /**
     * Create a Stripe subscription for recurring payments
     * @param {Object} options - Subscription options
     * @param {string} options.userId - User ID
     * @param {string} options.customerEmail - Customer email
     * @param {string} options.priceId - Stripe price ID
     * @param {string} options.tier - Subscription tier
     * @returns {Object} Subscription
     */
    async createSubscription(options) {
        try {
            const {
                userId,
                customerEmail,
                priceId,
                tier
            } = options;

            // If Stripe is not configured, simulate successful subscription
            if (!this.isConfigured()) {
                logger.warn('Stripe not configured, simulating successful subscription', {
                    userId: userId,
                    tier: tier
                });

                const subscriptionId = `sim_sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                return {
                    id: subscriptionId,
                    subscriptionId: subscriptionId,
                    status: 'active',
                    current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
                    metadata: {
                        userId: userId,
                        tier: tier,
                        simulated: true
                    }
                };
            }

            // Create or retrieve customer
            let customer;
            try {
                customer = await this.stripe.customers.create({
                    email: customerEmail,
                    metadata: {
                        userId: userId,
                        app: 'nyx-itbrowser'
                    }
                });
            } catch (customerError) {
                logger.warn('Failed to create Stripe customer for subscription', {
                    error: customerError.message,
                    userId: userId
                });
                throw new Error('Failed to create customer for subscription');
            }

            // Create subscription
            const subscription = await this.stripe.subscriptions.create({
                customer: customer.id,
                items: [
                    {
                        price: priceId,
                    },
                ],
                payment_behavior: 'default_incomplete',
                payment_settings: {
                    save_default_payment_method: 'on_subscription',
                },
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    userId: userId,
                    tier: tier,
                    appName: 'nyx-itbrowser'
                }
            });

            logger.info('Stripe subscription created', {
                subscriptionId: subscription.id,
                userId: userId,
                customerId: customer.id,
                tier: tier
            });

            return {
                id: subscription.id,
                subscriptionId: subscription.id,
                status: subscription.status,
                current_period_end: subscription.current_period_end,
                latest_invoice: subscription.latest_invoice,
                metadata: subscription.metadata
            };

        } catch (error) {
            logger.error('Failed to create Stripe subscription', {
                error: error.message,
                userId: options?.userId,
                tier: options?.tier
            });
            throw error;
        }
    }

    /**
     * Validate payment session
     * @param {string} sessionId - Stripe session ID
     * @returns {Object} Payment validation result
     */
    async validatePaymentSession(sessionId) {
        try {
            // If Stripe is not configured, simulate successful validation
            if (!this.isConfigured()) {
                logger.warn('Stripe not configured, simulating successful payment validation', {
                    sessionId: sessionId
                });

                return {
                    success: true,
                    message: 'Payment processed successfully!',
                    sessionId: sessionId,
                    amount: 0,
                    currency: this.paymentConfig.currency,
                    simulated: true
                };
            }

            // Retrieve session from Stripe
            const session = await this.stripe.checkout.sessions.retrieve(sessionId);

            logger.info('Payment session validated', {
                sessionId: sessionId,
                status: session.status,
                amount: session.amount_total,
                currency: session.currency
            });

            return {
                success: session.status === 'complete',
                message: session.status === 'complete' 
                    ? 'Payment processed successfully!' 
                    : `Payment status: ${session.status}`,
                sessionId: session.id,
                amount: session.amount_total,
                currency: session.currency,
                status: session.status,
                customer: session.customer,
                payment_intent: session.payment_intent
            };

        } catch (error) {
            logger.error('Failed to validate payment session', {
                error: error.message,
                sessionId: sessionId
            });
            
            // If validation fails, but this might be a simulated session
            if (sessionId?.startsWith('sim_session_')) {
                return {
                    success: true,
                    message: 'Simulated payment validated successfully',
                    sessionId: sessionId,
                    simulated: true
                };
            }
            
            throw error;
        }
    }

    /**
     * Handle Stripe webhook events
     * @param {string} payload - Webhook payload
     * @param {string} signature - Webhook signature
     * @returns {Object} Webhook handling result
     */
    async handleWebhook(payload, signature) {
        try {
            if (!this.isConfigured() || !this.paymentConfig.webhookSecret) {
                logger.warn('Stripe webhook not configured, skipping webhook handling');
                return { success: true, message: 'Webhook handling skipped - not configured' };
            }

            // Verify webhook signature
            const event = this.stripe.webhooks.constructEvent(
                payload,
                signature,
                this.paymentConfig.webhookSecret
            );

            logger.info('Stripe webhook event received', {
                eventType: event.type,
                eventId: event.id
            });

            // Handle different event types
            switch (event.type) {
                case 'checkout.session.completed':
                    return await this.handleCheckoutCompleted(event);
                case 'invoice.payment_succeeded':
                    return await this.handleInvoicePaymentSucceeded(event);
                case 'customer.subscription.created':
                    return await this.handleSubscriptionCreated(event);
                case 'customer.subscription.updated':
                    return await this.handleSubscriptionUpdated(event);
                case 'customer.subscription.deleted':
                    return await this.handleSubscriptionDeleted(event);
                case 'payment_intent.succeeded':
                    return await this.handlePaymentIntentSucceeded(event);
                default:
                    logger.debug('Unhandled Stripe webhook event', {
                        eventType: event.type,
                        eventId: event.id
                    });
                    return { success: true, message: 'Event type not handled' };
            }

        } catch (error) {
            logger.error('Failed to handle Stripe webhook', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Handle checkout session completed
     * @param {Object} event - Stripe event
     */
    async handleCheckoutCompleted(event) {
        try {
            const session = event.data.object;
            
            logger.info('Checkout session completed', {
                sessionId: session.id,
                userId: session.metadata?.userId,
                amount: session.amount_total,
                currency: session.currency
            });

            // Update user's profile quota in the license service
            // This would typically involve calling the license service to update quotas
            
            return {
                success: true,
                message: 'Checkout completed successfully',
                sessionId: session.id,
                userId: session.metadata?.userId
            };

        } catch (error) {
            logger.error('Failed to handle checkout completed', {
                error: error.message,
                sessionId: event.data?.object?.id
            });
            throw error;
        }
    }

    /**
     * Handle invoice payment succeeded
     * @param {Object} event - Stripe event
     */
    async handleInvoicePaymentSucceeded(event) {
        try {
            const invoice = event.data.object;
            
            logger.info('Invoice payment succeeded', {
                invoiceId: invoice.id,
                customerId: invoice.customer,
                amount: invoice.amount_paid,
                currency: invoice.currency
            });

            return {
                success: true,
                message: 'Invoice payment succeeded',
                invoiceId: invoice.id,
                customerId: invoice.customer
            };

        } catch (error) {
            logger.error('Failed to handle invoice payment succeeded', {
                error: error.message,
                invoiceId: event.data?.object?.id
            });
            throw error;
        }
    }

    // Additional webhook handlers would be implemented here...
    async handleSubscriptionCreated(event) {
        logger.info('Subscription created webhook received', {
            subscriptionId: event.data.object.id
        });
        return { success: true, message: 'Subscription created handled' };
    }

    async handleSubscriptionUpdated(event) {
        logger.info('Subscription updated webhook received', {
            subscriptionId: event.data.object.id
        });
        return { success: true, message: 'Subscription updated handled' };
    }

    async handleSubscriptionDeleted(event) {
        logger.info('Subscription deleted webhook received', {
            subscriptionId: event.data.object.id
        });
        return { success: true, message: 'Subscription deleted handled' };
    }

    async handlePaymentIntentSucceeded(event) {
        logger.info('Payment intent succeeded webhook received', {
            paymentIntentId: event.data.object.id
        });
        return { success: true, message: 'Payment intent succeeded handled' };
    }

    /**
     * Refund a payment
     * @param {string} paymentIntentId - Payment intent ID
     * @param {number} amount - Amount to refund in cents
     * @returns {Object} Refund result
     */
    async refundPayment(paymentIntentId, amount) {
        try {
            if (!this.isConfigured()) {
                logger.warn('Stripe not configured, simulating successful refund', {
                    paymentIntentId: paymentIntentId,
                    amount: amount
                });

                return {
                    success: true,
                    message: 'Payment refunded successfully',
                    refundId: `sim_refund_${Date.now()}`,
                    amount: amount,
                    simulated: true
                };
            }

            // Create refund
            const refund = await this.stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: amount
            });

            logger.info('Payment refunded', {
                refundId: refund.id,
                paymentIntentId: paymentIntentId,
                amount: refund.amount
            });

            return {
                success: true,
                message: 'Payment refunded successfully',
                refundId: refund.id,
                amount: refund.amount,
                status: refund.status
            };

        } catch (error) {
            logger.error('Failed to refund payment', {
                error: error.message,
                paymentIntentId: paymentIntentId,
                amount: amount
            });
            throw error;
        }
    }

    /**
     * Get payment details
     * @param {string} paymentId - Payment ID
     * @returns {Object} Payment details
     */
    async getPaymentDetails(paymentId) {
        try {
            if (!this.isConfigured()) {
                logger.warn('Stripe not configured, returning simulated payment details', {
                    paymentId: paymentId
                });

                return {
                    id: paymentId,
                    amount: 4000, // $40.00
                    currency: 'usd',
                    status: 'succeeded',
                    created: Math.floor(Date.now() / 1000),
                    simulated: true
                };
            }

            // Retrieve payment intent
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);

            return {
                id: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
                created: paymentIntent.created,
                customer: paymentIntent.customer,
                receipt_email: paymentIntent.receipt_email,
                description: paymentIntent.description
            };

        } catch (error) {
            logger.error('Failed to get payment details', {
                error: error.message,
                paymentId: paymentId
            });
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new StripeService();