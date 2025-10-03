const path = require('path');
const licenseService = require(path.join(__dirname, '../services/licenseService'));
const logger = require(path.join(__dirname, '../../../shared/utils/logger'));

/**
 * Quota Enforcement Middleware
 * Enforces subscription-based quotas and limits
 */

/**
 * Create quota enforcement middleware
 * @param {string} resource - Resource type to enforce quota on
 * @param {Function} countCallback - Function to get current resource count
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function createQuotaEnforcer(resource, countCallback, options = {}) {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user || !req.user.id) {
                logger.warn('Quota enforcement attempted without authenticated user', {
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
                logger.warn('Quota enforcement blocked due to invalid subscription', {
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
                logger.error('Failed to get resource count for quota enforcement', {
                    error: callbackError.message,
                    userId: userId,
                    resource: resource,
                    url: req.url,
                    method: req.method
                });

                // Fail open - allow request if count check fails
                return next();
            }

            // Check quota limit
            const quotaCheck = await licenseService.checkQuotaLimit(userId, resource, currentCount);

            // Add quota headers to response
            res.setHeader('X-Quota-Max', quotaCheck.maxLimit);
            res.setHeader('X-Quota-Current', quotaCheck.currentCount);
            res.setHeader('X-Quota-Remaining', quotaCheck.remaining);
            res.setHeader('X-Quota-Usage-Percentage', Math.round(quotaCheck.usagePercentage));

            logger.debug('Quota check performed', {
                userId: userId,
                resource: resource,
                currentCount: quotaCheck.currentCount,
                maxLimit: quotaCheck.maxLimit,
                withinLimit: quotaCheck.withinLimit,
                usagePercentage: quotaCheck.usagePercentage
            });

            if (!quotaCheck.withinLimit) {
                logger.warn('Quota limit exceeded', {
                    userId: userId,
                    resource: resource,
                    currentCount: quotaCheck.currentCount,
                    maxLimit: quotaCheck.maxLimit,
                    url: req.url,
                    method: req.method
                });

                return res.status(429).json({
                    error: 'Quota limit exceeded',
                    message: `You have reached the maximum limit of ${quotaCheck.maxLimit} ${resource} for your ${quotaCheck.tier} subscription.`,
                    quotaInfo: {
                        resource: resource,
                        current: quotaCheck.currentCount,
                        limit: quotaCheck.maxLimit,
                        remaining: quotaCheck.remaining,
                        tier: quotaCheck.tier
                    },
                    upgradeSuggestion: await getUpgradeSuggestion(userId, resource)
                });
            }

            // Add quota information to request for downstream use
            req.quotaInfo = quotaCheck;

            // Check if usage is high and add warning header
            if (quotaCheck.usagePercentage > 80) {
                res.setHeader('X-Quota-Warning', `Approaching limit: ${Math.round(quotaCheck.usagePercentage)}% used`);
            }

            next();
        } catch (error) {
            logger.error('Quota enforcement middleware error', {
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
 * Get upgrade suggestion for user
 * @param {string} userId - User ID
 * @param {string} resource - Resource that triggered the suggestion
 * @returns {Object} Upgrade suggestion
 */
async function getUpgradeSuggestion(userId, resource) {
    try {
        const recommendation = await licenseService.getUpgradeRecommendation(userId);
        
        if (recommendation.recommended) {
            return {
                suggested: true,
                message: `Upgrade to ${recommendation.recommendedTier} tier to increase your ${resource} limit`,
                benefits: recommendation.benefits,
                priceIncrease: `$${recommendation.priceDifference}`,
                currentTier: recommendation.currentTier,
                recommendedTier: recommendation.recommendedTier
            };
        }
        
        return {
            suggested: false,
            message: 'Consider upgrading for more resources'
        };
    } catch (error) {
        logger.error('Failed to generate upgrade suggestion', {
            error: error.message,
            userId: userId,
            resource: resource
        });
        
        return {
            suggested: false,
            error: 'Unable to generate upgrade suggestion'
        };
    }
}

/**
 * Create profile quota enforcer
 * @param {Object} options - Options
 * @returns {Function} Express middleware
 */
function createProfileQuotaEnforcer(options = {}) {
    return createQuotaEnforcer(
        'profiles',
        async (req, userId) => {
            // In a real implementation, this would count existing profiles for the user
            // For now, simulate with a mock count
            const profileService = require(path.join(__dirname, '../../../domains/profiles/services/profilePoolManager'));
            try {
                const profiles = await profileService.getProfilesByUserId(userId);
                return profiles.length;
            } catch (error) {
                // If we can't get real count, use a simulated count
                return Math.floor(Math.random() * 100);
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
    return createQuotaEnforcer(
        'campaigns',
        async (req, userId) => {
            // In a real implementation, this would count existing campaigns for the user
            // For now, simulate with a mock count
            const campaignService = require(path.join(__dirname, '../../../domains/campaigns/services/campaignManager'));
            try {
                const campaigns = await campaignService.getCampaignsByUserId(userId);
                return campaigns.length;
            } catch (error) {
                // If we can't get real count, use a simulated count
                return Math.floor(Math.random() * 50);
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
    return createQuotaEnforcer(
        'proxies',
        async (req, userId) => {
            // In a real implementation, this would count existing proxies for the user
            // For now, simulate with a mock count
            const proxyService = require(path.join(__dirname, '../../../domains/proxies/services/proxyManager'));
            try {
                const proxies = await proxyService.getProxiesByUserId(userId);
                return proxies.length;
            } catch (error) {
                // If we can't get real count, use a simulated count
                return Math.floor(Math.random() * 200);
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
    return createQuotaEnforcer(
        'sessions',
        async (req, userId) => {
            // In a real implementation, this would count active sessions for the user
            // For now, simulate with a mock count
            const sessionService = require(path.join(__dirname, '../../../system/services/sessionStateManager'));
            try {
                const sessions = await sessionService.getActiveSessionsByUserId(userId);
                return sessions.length;
            } catch (error) {
                // If we can't get real count, use a simulated count
                return Math.floor(Math.random() * 20);
            }
        },
        options
    );
}

/**
 * Check quota before resource creation
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
                    const profileService = require(path.join(__dirname, '../../../domains/profiles/services/profilePoolManager'));
                    const profiles = await profileService.getProfilesByUserId(userId);
                    currentCount = profiles.length;
                    break;
                case 'campaigns':
                    const campaignService = require(path.join(__dirname, '../../../domains/campaigns/services/campaignManager'));
                    const campaigns = await campaignService.getCampaignsByUserId(userId);
                    currentCount = campaigns.length;
                    break;
                case 'proxies':
                    const proxyService = require(path.join(__dirname, '../../../domains/proxies/services/proxyManager'));
                    const proxies = await proxyService.getProxiesByUserId(userId);
                    currentCount = proxies.length;
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
    createQuotaEnforcer,
    createProfileQuotaEnforcer,
    createCampaignQuotaEnforcer,
    createProxyQuotaEnforcer,
    createSessionQuotaEnforcer,
    checkResourceCreationQuota
};