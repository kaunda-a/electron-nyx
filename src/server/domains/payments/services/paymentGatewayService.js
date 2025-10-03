const stripeService = require('./stripeService');
const paymentWebhookService = require('./paymentWebhookService');
const logger = require('../../../shared/utils/logger');
const licenseService = require('../../auth/services/licenseService');

/**
 * Payment Gateway Service
 * Orchestrates different payment methods and integrates with subscription system
 */
class PaymentGatewayService {
    constructor() {
        this.supportedGateways = ['stripe'];
        this.defaultGateway = 'stripe';
        
        logger.info('Payment gateway service initialized', {
            supportedGateways: this.supportedGateways,
            defaultGateway: this.defaultGateway
        });
    }

    /**
     * Process profile purchase payment
     * @param {Object} options - Payment options
     * @param {string} options.userId - User ID
     * @param {number} options.quantity - Number of profiles to purchase
     * @param {number} options.unitPrice - Price per profile in cents
     * @param {string} options.customerEmail - Customer email
     * @param {string} options.gateway - Payment gateway to use
     * @returns {Object} Payment result
     */
    async processProfilePurchase(options) {
        try {
            const {
                userId,
                quantity,
                unitPrice,
                customerEmail,
                gateway = this.defaultGateway
            } = options;

            // Validate inputs
            if (!userId || !quantity || !unitPrice) {
                throw new Error('Missing required payment parameters');
            }

            if (quantity <= 0 || !Number.isInteger(quantity)) {
                throw new Error('Invalid quantity');
            }

            if (unitPrice <= 0) {
                throw new Error('Invalid unit price');
            }

            logger.info('Processing profile purchase', {
                userId: userId,
                quantity: quantity,
                unitPrice: unitPrice,
                totalAmount: quantity * unitPrice,
                gateway: gateway
            });

            // Select appropriate gateway service
            let gatewayService;
            switch (gateway.toLowerCase()) {
                case 'stripe':
                    gatewayService = stripeService;
                    break;
                default:
                    throw new Error(`Unsupported payment gateway: ${gateway}`);
            }

            // Create checkout session
            const session = await gatewayService.createCheckoutSession({
                quantity: quantity,
                unitPrice: unitPrice,
                userId: userId,
                customerEmail: customerEmail,
                tier: 'profile_purchase'
            });

            logger.info('Profile purchase checkout session created', {
                userId: userId,
                sessionId: session.id,
                amount: session.amount_total,
                currency: session.currency,
                gateway: gateway
            });

            return {
                success: true,
                sessionId: session.id,
                checkoutUrl: session.url,
                amount: session.amount_total,
                currency: session.currency,
                gateway: gateway,
                metadata: {
                    userId: userId,
                    quantity: quantity,
                    unitPrice: unitPrice,
                    tier: 'profile_purchase'
                }
            };

        } catch (error) {
            logger.error('Failed to process profile purchase', {
                error: error.message,
                userId: options?.userId,
                quantity: options?.quantity,
                gateway: options?.gateway
            });
            throw error;
        }
    }

    /**
     * Process subscription payment
     * @param {Object} options - Subscription options
     * @param {string} options.userId - User ID
     * @param {string} options.customerEmail - Customer email
     * @param {string} options.tier - Subscription tier
     * @param {string} options.gateway - Payment gateway to use
     * @returns {Object} Subscription result
     */
    async processSubscription(options) {
        try {
            const {
                userId,
                customerEmail,
                tier,
                gateway = this.defaultGateway
            } = options;

            // Validate inputs
            if (!userId || !customerEmail || !tier) {
                throw new Error('Missing required subscription parameters');
            }

            logger.info('Processing subscription payment', {
                userId: userId,
                tier: tier,
                customerEmail: customerEmail,
                gateway: gateway
            });

            // Get tier information
            const tiers = licenseService.getAvailableTiers();
            const tierInfo = tiers[tier.toLowerCase()];
            
            if (!tierInfo) {
                throw new Error(`Invalid subscription tier: ${tier}`);
            }

            // Select appropriate gateway service
            let gatewayService;
            switch (gateway.toLowerCase()) {
                case 'stripe':
                    gatewayService = stripeService;
                    break;
                default:
                    throw new Error(`Unsupported payment gateway: ${gateway}`);
            }

            // For subscriptions, we need Stripe price IDs
            // This would typically come from configuration or database
            const priceIds = {
                starter: process.env.STRIPE_STARTER_PRICE_ID,
                professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
                enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
            };

            const priceId = priceIds[tier.toLowerCase()];
            if (!priceId) {
                throw new Error(`No price ID configured for ${tier} tier`);
            }

            // Create subscription
            const subscription = await gatewayService.createSubscription({
                userId: userId,
                customerEmail: customerEmail,
                priceId: priceId,
                tier: tier
            });

            logger.info('Subscription created successfully', {
                userId: userId,
                subscriptionId: subscription.id,
                tier: tier,
                status: subscription.status,
                gateway: gateway
            });

            return {
                success: true,
                subscriptionId: subscription.id,
                status: subscription.status,
                currentPeriodEnd: subscription.current_period_end,
                gateway: gateway,
                metadata: {
                    userId: userId,
                    tier: tier
                }
            };

        } catch (error) {
            logger.error('Failed to process subscription payment', {
                error: error.message,
                userId: options?.userId,
                tier: options?.tier,
                gateway: options?.gateway
            });
            throw error;
        }
    }

    /**
     * Validate payment completion and update user quotas
     * @param {string} sessionId - Payment session ID
     * @param {string} gateway - Payment gateway
     * @returns {Object} Validation result
     */
    async validateAndCompletePayment(sessionId, gateway = this.defaultGateway) {
        try {
            logger.info('Validating payment completion', {
                sessionId: sessionId,
                gateway: gateway
            });

            // Select appropriate gateway service
            let gatewayService;
            switch (gateway.toLowerCase()) {
                case 'stripe':
                    gatewayService = stripeService;
                    break;
                default:
                    throw new Error(`Unsupported payment gateway: ${gateway}`);
            }

            // Validate payment session
            const validationResult = await gatewayService.validatePaymentSession(sessionId);

            if (!validationResult.success) {
                logger.warn('Payment validation failed', {
                    sessionId: sessionId,
                    message: validationResult.message,
                    gateway: gateway
                });

                return {
                    success: false,
                    message: validationResult.message,
                    sessionId: sessionId,
                    gateway: gateway
                };
            }

            logger.info('Payment validated successfully', {
                sessionId: sessionId,
                amount: validationResult.amount,
                currency: validationResult.currency,
                gateway: gateway
            });

            // If this was a simulated payment, we still want to proceed
            // In a real implementation, you would update user quotas here
            
            return {
                success: true,
                message: validationResult.message || 'Payment processed successfully',
                sessionId: sessionId,
                amount: validationResult.amount,
                currency: validationResult.currency,
                gateway: gateway,
                simulated: validationResult.simulated || false
            };

        } catch (error) {
            logger.error('Failed to validate and complete payment', {
                error: error.message,
                sessionId: sessionId,
                gateway: gateway
            });
            throw error;
        }
    }

    /**
     * Handle payment webhook and update user subscription
     * @param {Object} webhookData - Webhook data
     * @param {string} signature - Webhook signature for verification
     * @param {string} gateway - Payment gateway
     * @returns {Object} Webhook handling result
     */
    async handlePaymentWebhook(webhookData, signature, gateway = 'stripe') {
        try {
            logger.info('Handling payment webhook', {
                eventType: webhookData?.type,
                eventId: webhookData?.id,
                gateway: gateway
            });

            // Process webhook through dedicated webhook service
            const result = await paymentWebhookService.processWebhookEvent(
                JSON.stringify(webhookData),
                signature,
                gateway
            );

            logger.info('Payment webhook handled successfully', {
                success: result.success,
                eventId: result.eventId,
                eventType: result.eventType,
                gateway: gateway
            });

            return result;

        } catch (error) {
            logger.error('Failed to handle payment webhook', {
                error: error.message,
                gateway: gateway
            });
            throw error;
        }
    }

    /**
     * Process refund for a payment
     * @param {Object} options - Refund options
     * @param {string} options.paymentIntentId - Payment intent ID
     * @param {number} options.amount - Amount to refund in cents
     * @param {string} options.gateway - Payment gateway
     * @returns {Object} Refund result
     */
    async processRefund(options) {
        try {
            const {
                paymentIntentId,
                amount,
                gateway = this.defaultGateway
            } = options;

            // Validate inputs
            if (!paymentIntentId || !amount) {
                throw new Error('Missing required refund parameters');
            }

            if (amount <= 0) {
                throw new Error('Invalid refund amount');
            }

            logger.info('Processing payment refund', {
                paymentIntentId: paymentIntentId,
                amount: amount,
                gateway: gateway
            });

            // Select appropriate gateway service
            let gatewayService;
            switch (gateway.toLowerCase()) {
                case 'stripe':
                    gatewayService = stripeService;
                    break;
                default:
                    throw new Error(`Unsupported payment gateway: ${gateway}`);
            }

            // Process refund
            const refundResult = await gatewayService.refundPayment(paymentIntentId, amount);

            logger.info('Payment refund processed', {
                refundId: refundResult.refundId,
                paymentIntentId: paymentIntentId,
                amount: refundResult.amount,
                status: refundResult.status,
                success: refundResult.success,
                gateway: gateway
            });

            return refundResult;

        } catch (error) {
            logger.error('Failed to process payment refund', {
                error: error.message,
                paymentIntentId: options?.paymentIntentId,
                amount: options?.amount,
                gateway: options?.gateway
            });
            throw error;
        }
    }

    /**
     * Calculate profile purchase price based on quantity
     * @param {number} quantity - Number of profiles
     * @returns {Object} Price calculation
     */
    calculateProfilePrice(quantity) {
        try {
            // Pricing tiers for profile purchases
            const pricingTiers = [
                { min: 1, max: 50, price: 80 },      // $0.80 per profile for 1-50 profiles (in cents)
                { min: 51, max: 200, price: 70 },    // $0.70 per profile for 51-200 profiles
                { min: 201, max: 500, price: 60 },   // $0.60 per profile for 201-500 profiles
                { min: 501, max: 1000, price: 50 },  // $0.50 per profile for 501-1000 profiles
                { min: 1001, max: Infinity, price: 40 } // $0.40 per profile for 1001+ profiles
            ];

            // Special packages
            const packages = [
                { name: 'Starter Pack', quantity: 50, price: 4000 },    // $40.00 for 50 profiles
                { name: 'Professional Pack', quantity: 200, price: 14000 }, // $140.00 for 200 profiles
                { name: 'Enterprise Pack', quantity: 500, price: 30000 }  // $300.00 for 500 profiles
            ];

            // Check if there's a package deal for this quantity
            const packageDeal = packages.find(pkg => pkg.quantity === quantity);
            if (packageDeal) {
                return {
                    packageName: packageDeal.name,
                    quantity: packageDeal.quantity,
                    unitPrice: packageDeal.price / packageDeal.quantity,
                    totalPrice: packageDeal.price,
                    savings: this.calculatePackageSavings(quantity, packageDeal.price),
                    isPackage: true
                };
            }

            // Find applicable pricing tier
            const tier = pricingTiers.find(t => quantity >= t.min && quantity <= t.max);
            if (!tier) {
                throw new Error(`Invalid quantity: ${quantity}`);
            }

            const totalPrice = quantity * tier.price;

            return {
                quantity: quantity,
                unitPrice: tier.price,
                totalPrice: totalPrice,
                tier: tier,
                isPackage: false
            };

        } catch (error) {
            logger.error('Failed to calculate profile price', {
                error: error.message,
                quantity: quantity
            });
            throw error;
        }
    }

    /**
     * Calculate savings from package deals
     * @param {number} quantity - Number of profiles
     * @param {number} packagePrice - Package price in cents
     * @returns {Object} Savings calculation
     */
    calculatePackageSavings(quantity, packagePrice) {
        try {
            // Regular price calculation
            const regularPrice = this.calculateProfilePrice(quantity);
            const regularTotal = regularPrice.totalPrice;
            
            // Savings calculation
            const savingsAmount = regularTotal - packagePrice;
            const savingsPercentage = regularTotal > 0 ? (savingsAmount / regularTotal) * 100 : 0;

            return {
                regularPrice: regularTotal,
                packagePrice: packagePrice,
                savingsAmount: savingsAmount,
                savingsPercentage: Math.round(savingsPercentage * 100) / 100
            };

        } catch (error) {
            logger.error('Failed to calculate package savings', {
                error: error.message,
                quantity: quantity,
                packagePrice: packagePrice
            });
            return {
                regularPrice: 0,
                packagePrice: packagePrice,
                savingsAmount: 0,
                savingsPercentage: 0
            };
        }
    }

    /**
     * Get available payment methods
     * @returns {Array} Available payment methods
     */
    getAvailablePaymentMethods() {
        return [
            {
                id: 'stripe',
                name: 'Credit/Debit Card',
                description: 'Pay with Visa, Mastercard, American Express, and other major cards',
                icon: '💳',
                enabled: stripeService.isConfigured()
            },
            {
                id: 'paypal',
                name: 'PayPal',
                description: 'Pay with your PayPal account',
                icon: '🅿️',
                enabled: false // PayPal integration would need to be implemented
            }
        ];
    }

    /**
     * Get payment gateway status
     * @returns {Object} Gateway status
     */
    getGatewayStatus() {
        return {
            stripe: {
                configured: stripeService.isConfigured(),
                currency: stripeService.paymentConfig?.currency || 'usd'
            },
            supportedGateways: this.supportedGateways,
            defaultGateway: this.defaultGateway
        };
    }
}

// Export singleton instance
module.exports = new PaymentGatewayService();