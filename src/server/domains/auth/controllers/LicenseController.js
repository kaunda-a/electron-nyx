const licenseService = require('../services/licenseService');
const logger = require('../../../shared/utils/logger');

/**
 * License and Subscription Management Controller
 * Handles license-related HTTP endpoints
 */
class LicenseController {
    /**
     * Get available subscription tiers
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getTiers(req, res) {
        try {
            logger.debug('Fetching available subscription tiers', {
                userId: req.user?.id,
                ip: req.ip
            });

            const tiers = licenseService.getAvailableTiers();

            res.status(200).json({
                success: true,
                data: tiers,
                message: 'Subscription tiers retrieved successfully'
            });

        } catch (error) {
            logger.error('Failed to fetch subscription tiers', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to fetch subscription tiers',
                message: 'An error occurred while retrieving subscription information'
            });
        }
    }

    /**
     * Get user's current subscription
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getSubscription(req, res) {
        try {
            if (!req.user || !req.user.id) {
                logger.warn('Subscription info requested without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to view subscription information'
                });
            }

            const userId = req.user.id;

            logger.debug('Fetching user subscription', {
                userId: userId,
                ip: req.ip
            });

            const subscription = await licenseService.getUserSubscription(userId);

            res.status(200).json({
                success: true,
                data: subscription,
                message: 'Subscription information retrieved successfully'
            });

        } catch (error) {
            logger.error('Failed to fetch user subscription', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to fetch subscription information',
                message: 'An error occurred while retrieving your subscription information'
            });
        }
    }

    /**
     * Get user analytics and usage data
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getAnalytics(req, res) {
        try {
            if (!req.user || !req.user.id) {
                logger.warn('Analytics requested without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to view analytics'
                });
            }

            const userId = req.user.id;

            logger.debug('Fetching user analytics', {
                userId: userId,
                ip: req.ip
            });

            const analytics = await licenseService.getUserAnalytics(userId);

            res.status(200).json({
                success: true,
                data: analytics,
                message: 'Analytics data retrieved successfully'
            });

        } catch (error) {
            logger.error('Failed to fetch user analytics', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to fetch analytics data',
                message: 'An error occurred while retrieving your analytics data'
            });
        }
    }

    /**
     * Get upgrade recommendation
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getUpgradeRecommendation(req, res) {
        try {
            if (!req.user || !req.user.id) {
                logger.warn('Upgrade recommendation requested without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to get upgrade recommendations'
                });
            }

            const userId = req.user.id;

            logger.debug('Fetching upgrade recommendation', {
                userId: userId,
                ip: req.ip
            });

            const recommendation = await licenseService.getUpgradeRecommendation(userId);

            if (recommendation.error) {
                return res.status(500).json({
                    error: 'Failed to generate recommendation',
                    message: recommendation.error
                });
            }

            res.status(200).json({
                success: true,
                data: recommendation,
                message: recommendation.recommended 
                    ? 'Upgrade recommendation generated' 
                    : 'No upgrade recommendation at this time'
            });

        } catch (error) {
            logger.error('Failed to generate upgrade recommendation', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to generate upgrade recommendation',
                message: 'An error occurred while generating upgrade recommendations'
            });
        }
    }

    /**
     * Validate subscription status
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async validateSubscription(req, res) {
        try {
            if (!req.user || !req.user.id) {
                logger.warn('Subscription validation requested without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to validate subscription'
                });
            }

            const userId = req.user.id;

            logger.debug('Validating subscription status', {
                userId: userId,
                ip: req.ip
            });

            const validation = await licenseService.validateSubscription(userId);

            if (validation.error) {
                return res.status(500).json({
                    error: 'Subscription validation failed',
                    message: validation.error
                });
            }

            res.status(200).json({
                success: true,
                data: validation,
                message: validation.valid 
                    ? 'Subscription is valid' 
                    : 'Subscription validation failed'
            });

        } catch (error) {
            logger.error('Failed to validate subscription', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Subscription validation failed',
                message: 'An error occurred while validating your subscription'
            });
        }
    }

    /**
     * Upgrade subscription tier
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async upgradeSubscription(req, res) {
        try {
            if (!req.user || !req.user.id) {
                logger.warn('Subscription upgrade requested without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to upgrade your subscription'
                });
            }

            const userId = req.user.id;
            const { tier, paymentMethod } = req.body;

            // Validate input
            if (!tier) {
                logger.warn('Subscription upgrade requested without tier', {
                    userId: userId,
                    ip: req.ip
                });

                return res.status(400).json({
                    error: 'Missing tier',
                    message: 'Subscription tier is required for upgrade'
                });
            }

            logger.info('Processing subscription upgrade request', {
                userId: userId,
                tier: tier,
                paymentMethod: paymentMethod,
                ip: req.ip
            });

            // In a real implementation, this would:
            // 1. Process payment
            // 2. Validate payment success
            // 3. Update subscription in database
            // 4. Apply new tier limits

            // For demonstration, we'll simulate the upgrade
            const subscription = await licenseService.setUserSubscription(userId, tier, {
                status: 'active',
                metadata: {
                    upgradedAt: new Date().toISOString(),
                    paymentMethod: paymentMethod
                }
            });

            logger.info('Subscription upgraded successfully', {
                userId: userId,
                tier: tier,
                subscriptionId: subscription.userId
            });

            res.status(200).json({
                success: true,
                data: subscription,
                message: `Successfully upgraded to ${subscription.tierInfo.name} tier`
            });

        } catch (error) {
            logger.error('Failed to upgrade subscription', {
                error: error.message,
                userId: req.user?.id,
                tier: req.body?.tier,
                ip: req.ip
            });

            if (error.message && error.message.includes('Invalid tier')) {
                return res.status(400).json({
                    error: 'Invalid tier',
                    message: error.message
                });
            }

            res.status(500).json({
                error: 'Subscription upgrade failed',
                message: 'An error occurred while processing your subscription upgrade'
            });
        }
    }

    /**
     * Cancel subscription
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async cancelSubscription(req, res) {
        try {
            if (!req.user || !req.user.id) {
                logger.warn('Subscription cancellation requested without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to cancel your subscription'
                });
            }

            const userId = req.user.id;

            logger.info('Processing subscription cancellation request', {
                userId: userId,
                ip: req.ip
            });

            // In a real implementation, this would:
            // 1. Process cancellation
            // 2. Schedule downgrade to free tier
            // 3. Handle billing period end

            // For demonstration, we'll downgrade to free tier
            const subscription = await licenseService.setUserSubscription(userId, 'free', {
                status: 'cancelled',
                metadata: {
                    cancelledAt: new Date().toISOString()
                }
            });

            logger.info('Subscription cancelled successfully', {
                userId: userId,
                subscriptionId: subscription.userId
            });

            res.status(200).json({
                success: true,
                data: subscription,
                message: 'Subscription cancelled successfully. You will be downgraded to the free tier at the end of your billing period.'
            });

        } catch (error) {
            logger.error('Failed to cancel subscription', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Subscription cancellation failed',
                message: 'An error occurred while processing your subscription cancellation'
            });
        }
    }

    /**
     * Get user quota information
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getQuotas(req, res) {
        try {
            if (!req.user || !req.user.id) {
                logger.warn('Quota information requested without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to view quota information'
                });
            }

            const userId = req.user.id;

            logger.debug('Fetching user quota information', {
                userId: userId,
                ip: req.ip
            });

            // Get subscription info
            const subscription = await licenseService.getUserSubscription(userId);
            const tierInfo = subscription.tierInfo;

            // Get current usage for each resource
            const quotas = {
                profiles: await licenseService.checkQuotaLimit(userId, 'profiles', 0),
                campaigns: await licenseService.checkQuotaLimit(userId, 'campaigns', 0),
                proxies: await licenseService.checkQuotaLimit(userId, 'proxies', 0),
                sessions: await licenseService.checkQuotaLimit(userId, 'sessions', 0)
            };

            res.status(200).json({
                success: true,
                data: {
                    subscription: subscription,
                    quotas: quotas,
                    limits: {
                        profiles: tierInfo.maxProfiles,
                        campaigns: tierInfo.maxCampaigns,
                        proxies: tierInfo.maxProxies,
                        sessions: tierInfo.maxConcurrentSessions
                    }
                },
                message: 'Quota information retrieved successfully'
            });

        } catch (error) {
            logger.error('Failed to fetch quota information', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to fetch quota information',
                message: 'An error occurred while retrieving your quota information'
            });
        }
    }
}

module.exports = LicenseController;