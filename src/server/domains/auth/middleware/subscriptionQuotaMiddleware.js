const licenseService = require('../services/licenseService');
const logger = require('../../../shared/utils/logger');

/**
 * Subscription Quota Middleware
 * Enforces subscription-based quotas for different resources
 */

/**
 * Create subscription quota enforcer middleware
 * @param {string} resource - Resource type to enforce quota on (profiles, campaigns, proxies)
 * @param {Function} countCallback - Function to get current resource count for user
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function createSubscriptionQuotaEnforcer(resource, countCallback, options = {}) {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                logger.warn('Subscription quota enforcement attempted without authenticated user', {
                    resource: resource,
                    url: req.url,
                    method: req.method,
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be logged in to perform this action'
                });
            }

            const userId = req.user.id;

            // Validate subscription first
            const subscriptionValidation = await licenseService.validateSubscription(userId);
            if (!subscriptionValidation.valid) {
                logger.warn('Subscription quota enforcement blocked due to invalid subscription', {
                    userId: userId,
                    resource: resource,
                    reason: subscriptionValidation.reason,
                    url: req.url,
                    method: req.method
                });

                return res.status(403).json({
                    error: 'Invalid subscription',
                    message: subscriptionValidation.reason || 'Your subscription is not valid',
                    subscription: subscriptionValidation.subscription
                });
            }

            // Get current resource count using callback
            let currentCount;
            try {
                currentCount = await countCallback(req, userId);
            } catch (callbackError) {
                logger.error('Failed to get resource count for subscription quota enforcement', {
                    error: callbackError.message,
                    userId: userId,
                    resource: resource,
                    url: req.url,
                    method: req.method
                });

                // Fail open - allow request if count check fails
                return next();
            }

            // Check subscription quota limit
            const quotaCheck = await licenseService.checkQuotaLimit(userId, resource, currentCount);

            // Add quota headers to response
            res.setHeader('X-Subscription-Quota-Max', quotaCheck.maxLimit);
            res.setHeader('X-Subscription-Quota-Current', quotaCheck.currentCount);
            res.setHeader('X-Subscription-Quota-Remaining', quotaCheck.remaining);
            res.setHeader('X-Subscription-Quota-Usage-Percentage', Math.round(quotaCheck.usagePercentage));

            logger.debug('Subscription quota check performed', {
                userId: userId,
                resource: resource,
                currentCount: quotaCheck.currentCount,
                maxLimit: quotaCheck.maxLimit,
                withinLimit: quotaCheck.withinLimit,
                usagePercentage: quotaCheck.usagePercentage
            });

            if (!quotaCheck.withinLimit) {
                logger.warn('Subscription quota limit exceeded', {
                    userId: userId,
                    resource: resource,
                    currentCount: quotaCheck.currentCount,
                    maxLimit: quotaCheck.maxLimit,
                    url: req.url,
                    method: req.method
                });

                // Determine if upgrade is recommended
                const upgradeRecommendation = await licenseService.getUpgradeRecommendation(userId);
                
                return res.status(429).json({
                    error: 'Subscription quota exceeded',
                    message: `You have reached the maximum limit of ${quotaCheck.maxLimit} ${resource} for your ${quotaCheck.tier} subscription.`,
                    quotaInfo: {
                        resource: resource,
                        current: quotaCheck.currentCount,
                        limit: quotaCheck.maxLimit,
                        remaining: quotaCheck.remaining,
                        tier: quotaCheck.tier
                    },
                    upgradeSuggestion: upgradeRecommendation.recommended ? {
                        suggested: true,
                        message: `Upgrade to ${upgradeRecommendation.recommendedTier} tier to increase your ${resource} limit`,
                        benefits: upgradeRecommendation.benefits,
                        priceIncrease: `$${upgradeRecommendation.priceDifference}`,
                        currentTier: upgradeRecommendation.currentTier,
                        recommendedTier: upgradeRecommendation.recommendedTier
                    } : {
                        suggested: false,
                        message: 'Consider upgrading for more resources'
                    }
                });
            }

            // Add quota information to request for downstream use
            req.subscriptionQuota = quotaCheck;

            // Check if usage is high and add warning header
            if (quotaCheck.usagePercentage > 80) {
                res.setHeader('X-Subscription-Quota-Warning', `Approaching limit: ${Math.round(quotaCheck.usagePercentage)}% used`);
            }

            next();
        } catch (error) {
            logger.error('Subscription quota enforcement middleware error', {
                error: error.message,
                resource: resource,
                url: req.url,
                method: req.method,
                userId: req.user?.id,
                ip: req.ip
            });

            // Fail open - allow request if quota enforcement fails
            next();
        }
    };
}

/**
 * Create profile quota enforcer for the $40 for 50 profiles model
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function createProfileQuotaEnforcer(options = {}) {
    return createSubscriptionQuotaEnforcer(
        'profiles',
        async (req, userId) => {
            // In a real implementation, this would count existing profiles for the user
            // For now, we'll simulate with a mock count
            try {
                // This would typically call a service to get actual profile count
                // For example: const profileService = require('../../profiles/services/profileService');
                // return await profileService.getProfileCountByUserId(userId);
                
                // For demonstration, return a simulated count
                return Math.floor(Math.random() * 60); // Random count between 0-59
            } catch (error) {
                logger.warn('Failed to get profile count for quota check', {
                    error: error.message,
                    userId: userId
                });
                // Return 0 if we can't get count
                return 0;
            }
        },
        options
    );
}

/**
 * Create campaign quota enforcer
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function createCampaignQuotaEnforcer(options = {}) {
    return createSubscriptionQuotaEnforcer(
        'campaigns',
        async (req, userId) => {
            // In a real implementation, this would count existing campaigns for the user
            // For now, we'll simulate with a mock count
            try {
                // This would typically call a service to get actual campaign count
                // For example: const campaignService = require('../../campaigns/services/campaignService');
                // return await campaignService.getCampaignCountByUserId(userId);
                
                // For demonstration, return a simulated count
                return Math.floor(Math.random() * 30); // Random count between 0-29
            } catch (error) {
                logger.warn('Failed to get campaign count for quota check', {
                    error: error.message,
                    userId: userId
                });
                // Return 0 if we can't get count
                return 0;
            }
        },
        options
    );
}

/**
 * Create proxy quota enforcer
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function createProxyQuotaEnforcer(options = {}) {
    return createSubscriptionQuotaEnforcer(
        'proxies',
        async (req, userId) => {
            // In a real implementation, this would count existing proxies for the user
            // For now, we'll simulate with a mock count
            try {
                // This would typically call a service to get actual proxy count
                // For example: const proxyService = require('../../proxies/services/proxyService');
                // return await proxyService.getProxyCountByUserId(userId);
                
                // For demonstration, return a simulated count
                return Math.floor(Math.random() * 150); // Random count between 0-149
            } catch (error) {
                logger.warn('Failed to get proxy count for quota check', {
                    error: error.message,
                    userId: userId
                });
                // Return 0 if we can't get count
                return 0;
            }
        },
        options
    );
}

/**
 * Create concurrent session quota enforcer
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function createSessionQuotaEnforcer(options = {}) {
    return createSubscriptionQuotaEnforcer(
        'sessions',
        async (req, userId) => {
            // In a real implementation, this would count active sessions for the user
            // For now, we'll simulate with a mock count
            try {
                // This would typically call a service to get actual session count
                // For example: const sessionService = require('../../system/services/sessionService');
                // return await sessionService.getActiveSessionCountByUserId(userId);
                
                // For demonstration, return a simulated count
                return Math.floor(Math.random() * 30); // Random count between 0-29
            } catch (error) {
                logger.warn('Failed to get session count for quota check', {
                    error: error.message,
                    userId: userId
                });
                // Return 0 if we can't get count
                return 0;
            }
        },
        options
    );
}

/**
 * Check resource creation quota before creating resources
 * @param {string} userId - User ID
 * @param {string} resource - Resource type
 * @param {number} requestedAmount - Amount of resources requested
 * @returns {Object} Check result
 */
async function checkResourceCreationQuota(userId, resource, requestedAmount = 1) {
    try {
        // Validate subscription
        const subscriptionValidation = await licenseService.validateSubscription(userId);
        if (!subscriptionValidation.valid) {
            return {
                allowed: false,
                reason: subscriptionValidation.reason || 'Invalid subscription',
                subscription: subscriptionValidation.subscription
            };
        }

        // Get current count
        let currentCount = 0;
        try {
            switch (resource.toLowerCase()) {
                case 'profiles':
                    // This would call the actual profile service
                    // const profileService = require('../../profiles/services/profileService');
                    // currentCount = await profileService.getProfileCountByUserId(userId);
                    currentCount = Math.floor(Math.random() * 50); // Simulated
                    break;
                case 'campaigns':
                    // This would call the actual campaign service
                    // const campaignService = require('../../campaigns/services/campaignService');
                    // currentCount = await campaignService.getCampaignCountByUserId(userId);
                    currentCount = Math.floor(Math.random() * 25); // Simulated
                    break;
                case 'proxies':
                    // This would call the actual proxy service
                    // const proxyService = require('../../proxies/services/proxyService');
                    // currentCount = await proxyService.getProxyCountByUserId(userId);
                    currentCount = Math.floor(Math.random() * 100); // Simulated
                    break;
                default:
                    currentCount = 0;
            }
        } catch (error) {
            logger.warn('Failed to get current resource count for quota check', {
                error: error.message,
                userId: userId,
                resource: resource
            });
        }

        // Check quota
        const quotaCheck = await licenseService.checkQuotaLimit(userId, resource, currentCount + requestedAmount);

        return {
            allowed: quotaCheck.withinLimit,
            quotaInfo: quotaCheck,
            subscription: subscriptionValidation.subscription
        };
    } catch (error) {
        logger.error('Failed to check resource creation quota', {
            error: error.message,
            userId: userId,
            resource: resource,
            requestedAmount: requestedAmount
        });

        // Fail open - allow creation if quota check fails
        return {
            allowed: true,
            error: error.message
        };
    }
}

module.exports = {
    createSubscriptionQuotaEnforcer,
    createProfileQuotaEnforcer,
    createCampaignQuotaEnforcer,
    createProxyQuotaEnforcer,
    createSessionQuotaEnforcer,
    checkResourceCreationQuota
};