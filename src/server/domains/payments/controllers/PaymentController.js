const paymentGatewayService = require('../services/paymentGatewayService');
const logger = require('../../../shared/utils/logger');
const licenseService = require('../../auth/services/licenseService');

/**
 * Payment Controller
 * Handles payment-related HTTP endpoints
 */
class PaymentController {
    /**
     * Process profile purchase
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async processProfilePurchase(req, res) {
        try {
            const { quantity, userId, customerEmail, gateway = 'stripe' } = req.body;

            // Validate input
            if (!quantity || !userId) {
                logger.warn('Profile purchase attempted with missing parameters', {
                    userId: userId,
                    quantity: quantity,
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'Quantity and userId are required'
                });
            }

            // Validate quantity is a positive integer
            if (quantity <= 0 || !Number.isInteger(quantity)) {
                logger.warn('Invalid quantity for profile purchase', {
                    userId: userId,
                    quantity: quantity,
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Invalid quantity',
                    message: 'Quantity must be a positive integer'
                });
            }

            logger.info('$40 for 50 profiles purchase initiated', {
                userId: userId,
                quantity: quantity,
                customerEmail: customerEmail,
                gateway: gateway,
                ip: req.ip
            });

            // Calculate price based on quantity
            const priceCalculation = paymentGatewayService.calculateProfilePrice(quantity);
            const unitPrice = priceCalculation.unitPrice; // Price in cents

            logger.info('Profile price calculated', {
                userId: userId,
                quantity: quantity,
                unitPrice: unitPrice,
                totalPrice: priceCalculation.totalPrice,
                isPackage: priceCalculation.isPackage,
                packageName: priceCalculation.packageName
            });

            // Process payment through gateway
            const paymentResult = await paymentGatewayService.processProfilePurchase({
                userId: userId,
                quantity: quantity,
                unitPrice: unitPrice,
                customerEmail: customerEmail,
                gateway: gateway
            });

            logger.info('Profile purchase payment processed', {
                userId: userId,
                sessionId: paymentResult.sessionId,
                amount: paymentResult.amount,
                currency: paymentResult.currency,
                gateway: paymentResult.gateway
            });

            res.status(200).json({
                success: true,
                message: 'Profile purchase initiated successfully',
                data: {
                    sessionId: paymentResult.sessionId,
                    checkoutUrl: paymentResult.checkoutUrl,
                    amount: paymentResult.amount,
                    currency: paymentResult.currency,
                    gateway: paymentResult.gateway,
                    priceCalculation: priceCalculation
                }
            });

        } catch (error) {
            logger.error('Failed to process profile purchase', {
                error: error.message,
                userId: req.body?.userId,
                quantity: req.body?.quantity,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to process profile purchase',
                message: 'An error occurred while processing your profile purchase'
            });
        }
    }

    /**
     * Process subscription payment
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async processSubscription(req, res) {
        try {
            const { userId, customerEmail, tier, gateway = 'stripe' } = req.body;

            // Validate input
            if (!userId || !customerEmail || !tier) {
                logger.warn('Subscription purchase attempted with missing parameters', {
                    userId: userId,
                    customerEmail: customerEmail,
                    tier: tier,
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'userId, customerEmail, and tier are required'
                });
            }

            logger.info('Subscription purchase initiated', {
                userId: userId,
                customerEmail: customerEmail,
                tier: tier,
                gateway: gateway,
                ip: req.ip
            });

            // Process subscription through gateway
            const subscriptionResult = await paymentGatewayService.processSubscription({
                userId: userId,
                customerEmail: customerEmail,
                tier: tier,
                gateway: gateway
            });

            logger.info('Subscription payment processed', {
                userId: userId,
                subscriptionId: subscriptionResult.subscriptionId,
                status: subscriptionResult.status,
                gateway: subscriptionResult.gateway
            });

            res.status(200).json({
                success: true,
                message: 'Subscription purchase initiated successfully',
                data: subscriptionResult
            });

        } catch (error) {
            logger.error('Failed to process subscription purchase', {
                error: error.message,
                userId: req.body?.userId,
                tier: req.body?.tier,
                ip: req.ip
            });

            if (error.message && error.message.includes('Invalid subscription tier')) {
                return res.status(400).json({
                    error: 'Invalid subscription tier',
                    message: error.message
                });
            }

            if (error.message && error.message.includes('price ID')) {
                return res.status(500).json({
                    error: 'Subscription configuration error',
                    message: 'Subscription pricing is not properly configured. Please contact support.'
                });
            }

            res.status(500).json({
                error: 'Failed to process subscription purchase',
                message: 'An error occurred while processing your subscription purchase'
            });
        }
    }

    /**
     * Validate payment completion
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async validatePaymentCompletion(req, res) {
        try {
            const { sessionId, gateway = 'stripe' } = req.params;

            // Validate input
            if (!sessionId) {
                logger.warn('Payment validation attempted with missing session ID', {
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Missing session ID',
                    message: 'Session ID is required for payment validation'
                });
            }

            logger.info('Validating payment completion', {
                sessionId: sessionId,
                gateway: gateway,
                ip: req.ip
            });

            // Validate payment through gateway
            const validationResult = await paymentGatewayService.validateAndCompletePayment(
                sessionId, 
                gateway
            );

            logger.info('Payment validation completed', {
                sessionId: sessionId,
                success: validationResult.success,
                amount: validationResult.amount,
                currency: validationResult.currency,
                gateway: validationResult.gateway,
                simulated: validationResult.simulated
            });

            // If payment was successful and not simulated, update user quotas
            if (validationResult.success && !validationResult.simulated) {
                // In a real implementation, you would update user's profile quotas here
                logger.info('Payment successful, updating user quotas (simulated)', {
                    sessionId: sessionId,
                    userId: req.user?.id // Would come from auth middleware in real implementation
                });
            }

            res.status(200).json({
                success: true,
                message: validationResult.message,
                data: validationResult
            });

        } catch (error) {
            logger.error('Failed to validate payment completion', {
                error: error.message,
                sessionId: req.params?.sessionId,
                gateway: req.params?.gateway,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to validate payment completion',
                message: 'An error occurred while validating your payment'
            });
        }
    }

    /**
     * Get payment configuration
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getPaymentConfig(req, res) {
        try {
            logger.debug('Payment configuration requested', {
                ip: req.ip
            });

            const gatewayStatus = paymentGatewayService.getGatewayStatus();
            const paymentMethods = paymentGatewayService.getAvailablePaymentMethods();

            res.status(200).json({
                success: true,
                data: {
                    gatewayStatus: gatewayStatus,
                    paymentMethods: paymentMethods,
                    currency: gatewayStatus.stripe.currency,
                    supportedGateways: gatewayStatus.supportedGateways
                }
            });

        } catch (error) {
            logger.error('Failed to get payment configuration', {
                error: error.message,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to get payment configuration',
                message: 'An error occurred while retrieving payment configuration'
            });
        }
    }

    /**
     * Calculate profile price
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async calculateProfilePrice(req, res) {
        try {
            const { quantity } = req.query;

            // Validate input
            if (!quantity) {
                logger.warn('Profile price calculation attempted with missing quantity', {
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Missing quantity parameter',
                    message: 'Quantity is required for price calculation'
                });
            }

            const quantityNum = parseInt(quantity);
            if (isNaN(quantityNum) || quantityNum <= 0) {
                logger.warn('Invalid quantity for price calculation', {
                    quantity: quantity,
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Invalid quantity',
                    message: 'Quantity must be a positive number'
                });
            }

            logger.info('Calculating profile price', {
                quantity: quantityNum,
                ip: req.ip
            });

            // Calculate price
            const priceCalculation = paymentGatewayService.calculateProfilePrice(quantityNum);

            logger.info('Profile price calculated', {
                quantity: quantityNum,
                unitPrice: priceCalculation.unitPrice,
                totalPrice: priceCalculation.totalPrice,
                isPackage: priceCalculation.isPackage
            });

            res.status(200).json({
                success: true,
                message: 'Profile price calculated successfully',
                data: priceCalculation
            });

        } catch (error) {
            logger.error('Failed to calculate profile price', {
                error: error.message,
                quantity: req.query?.quantity,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to calculate profile price',
                message: 'An error occurred while calculating the profile price'
            });
        }
    }

    /**
     * Handle payment webhook
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handlePaymentWebhook(req, res) {
        try {
            const webhookData = req.body;
            const gateway = req.headers['x-payment-gateway'] || 'stripe'; // Custom header to identify gateway

            logger.info('Payment webhook received', {
                eventType: req.headers['content-type'],
                gateway: gateway,
                payloadSize: req.headers['content-length'],
                ip: req.ip
            });

            // Handle webhook through payment gateway service
            const webhookResult = await paymentGatewayService.handlePaymentWebhook(
                webhookData, 
                gateway
            );

            logger.info('Payment webhook handled', {
                success: webhookResult.success,
                message: webhookResult.message,
                gateway: gateway
            });

            res.status(200).json(webhookResult);

        } catch (error) {
            logger.error('Failed to handle payment webhook', {
                error: error.message,
                gateway: req.headers['x-payment-gateway'],
                ip: req.ip
            });

            res.status(400).json({
                error: 'Failed to handle payment webhook',
                message: 'An error occurred while processing the payment webhook'
            });
        }
    }

    /**
     * Get available subscription tiers with pricing
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getSubscriptionTiers(req, res) {
        try {
            logger.debug('Subscription tiers requested', {
                ip: req.ip
            });

            const tiers = licenseService.getAvailableTiers();

            // Add pricing information to each tier
            const pricedTiers = {};
            for (const [tierName, tierInfo] of Object.entries(tiers)) {
                pricedTiers[tierName] = {
                    ...tierInfo,
                    monthlyPrice: tierInfo.price,
                    yearlyPrice: tierInfo.price * 12 * 0.9, // 10% discount for yearly
                    featuresCount: tierInfo.features.length,
                    limitationsCount: tierInfo.limitations.length
                };
            }

            res.status(200).json({
                success: true,
                message: 'Subscription tiers retrieved successfully',
                data: pricedTiers
            });

        } catch (error) {
            logger.error('Failed to get subscription tiers', {
                error: error.message,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to get subscription tiers',
                message: 'An error occurred while retrieving subscription information'
            });
        }
    }

    /**
     * Process refund
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async processRefund(req, res) {
        try {
            const { paymentIntentId, amount, gateway = 'stripe' } = req.body;

            // Validate input
            if (!paymentIntentId || !amount) {
                logger.warn('Refund attempted with missing parameters', {
                    paymentIntentId: paymentIntentId,
                    amount: amount,
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'paymentIntentId and amount are required'
                });
            }

            const amountNum = parseInt(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                logger.warn('Invalid refund amount', {
                    paymentIntentId: paymentIntentId,
                    amount: amount,
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Invalid amount',
                    message: 'Amount must be a positive number'
                });
            }

            logger.info('Processing payment refund', {
                paymentIntentId: paymentIntentId,
                amount: amountNum,
                gateway: gateway,
                ip: req.ip
            });

            // Process refund through payment gateway
            const refundResult = await paymentGatewayService.processRefund({
                paymentIntentId: paymentIntentId,
                amount: amountNum,
                gateway: gateway
            });

            logger.info('Payment refund processed', {
                refundId: refundResult.refundId,
                paymentIntentId: paymentIntentId,
                amount: refundResult.amount,
                success: refundResult.success,
                gateway: gateway
            });

            res.status(200).json({
                success: refundResult.success,
                message: refundResult.message,
                data: refundResult
            });

        } catch (error) {
            logger.error('Failed to process payment refund', {
                error: error.message,
                paymentIntentId: req.body?.paymentIntentId,
                amount: req.body?.amount,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to process refund',
                message: 'An error occurred while processing your refund request'
            });
        }
    }
}

module.exports = PaymentController;