const { checkResourceCreationQuota } = require('../../auth/middleware/quotaMiddleware');
const logger = require('../../../shared/utils/logger');

/**
 * Profile Quota Middleware
 * Enforces quota limits for profile creation
 */

/**
 * Check if user can create profiles based on their subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function checkProfileCreationQuota(req, res, next) {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.id) {
            logger.warn('Profile creation quota check attempted without authentication', {
                url: req.url,
                method: req.method,
                ip: req.ip
            });

            return res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to create profiles'
            });
        }

        const userId = req.user.id;
        
        // Determine how many profiles are being created
        let requestedAmount = 1;
        
        // Check request body for batch creation
        if (req.body && typeof req.body === 'object') {
            if (req.body.count && typeof req.body.count === 'number') {
                // Batch profile creation
                requestedAmount = req.body.count;
            } else if (Array.isArray(req.body)) {
                // Multiple profile creation
                requestedAmount = req.body.length;
            } else if (req.body.profiles && Array.isArray(req.body.profiles)) {
                // Profile creation with profiles array
                requestedAmount = req.body.profiles.length;
            }
        }

        logger.debug('Checking profile creation quota', {
            userId: userId,
            requestedAmount: requestedAmount,
            url: req.url,
            method: req.method
        });

        // Check quota
        const quotaCheck = await checkResourceCreationQuota(userId, 'profiles', requestedAmount);

        if (!quotaCheck.allowed) {
            logger.warn('Profile creation quota exceeded', {
                userId: userId,
                requestedAmount: requestedAmount,
                reason: quotaCheck.reason,
                url: req.url,
                method: req.method
            });

            return res.status(429).json({
                error: 'Profile quota exceeded',
                message: quotaCheck.reason || `You cannot create ${requestedAmount} more profile(s) with your current subscription.`,
                quotaInfo: quotaCheck.quotaInfo,
                subscription: quotaCheck.subscription,
                requestedAmount: requestedAmount
            });
        }

        // Add quota information to request for downstream use
        req.quotaInfo = quotaCheck;

        logger.debug('Profile creation quota check passed', {
            userId: userId,
            requestedAmount: requestedAmount,
            remainingQuota: quotaCheck.quotaInfo?.remaining
        });

        next();
    } catch (error) {
        logger.error('Profile creation quota check failed', {
            error: error.message,
            userId: req.user?.id,
            url: req.url,
            method: req.method,
            ip: req.ip
        });

        // Fail open - allow profile creation if quota check fails
        next();
    }
}

/**
 * Check if user can import profiles based on their subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function checkProfileImportQuota(req, res, next) {
    try {
        // Check if user is authenticated
        if (!req.user || !req.user.id) {
            logger.warn('Profile import quota check attempted without authentication', {
                url: req.url,
                method: req.method,
                ip: req.ip
            });

            return res.status(401).json({
                error: 'Authentication required',
                message: 'You must be logged in to import profiles'
            });
        }

        const userId = req.user.id;
        
        // For imports, we'll check if user can create at least 1 more profile
        const quotaCheck = await checkResourceCreationQuota(userId, 'profiles', 1);

        if (!quotaCheck.allowed) {
            logger.warn('Profile import quota exceeded', {
                userId: userId,
                reason: quotaCheck.reason,
                url: req.url,
                method: req.method
            });

            return res.status(429).json({
                error: 'Profile quota exceeded',
                message: quotaCheck.reason || 'You cannot import profiles because you have reached your profile limit.',
                quotaInfo: quotaCheck.quotaInfo,
                subscription: quotaCheck.subscription
            });
        }

        // Add quota information to request
        req.quotaInfo = quotaCheck;

        logger.debug('Profile import quota check passed', {
            userId: userId
        });

        next();
    } catch (error) {
        logger.error('Profile import quota check failed', {
            error: error.message,
            userId: req.user?.id,
            url: req.url,
            method: req.method,
            ip: req.ip
        });

        // Fail open - allow profile import if quota check fails
        next();
    }
}

/**
 * Add quota headers to profile-related responses
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function addProfileQuotaHeaders(req, res, next) {
    try {
        // Add quota information to response headers if available
        if (req.quotaInfo && req.quotaInfo.quotaInfo) {
            const quotaInfo = req.quotaInfo.quotaInfo;
            
            res.setHeader('X-Profile-Quota-Max', quotaInfo.maxLimit);
            res.setHeader('X-Profile-Quota-Current', quotaInfo.currentCount);
            res.setHeader('X-Profile-Quota-Remaining', quotaInfo.remaining);
            res.setHeader('X-Profile-Quota-Usage', `${Math.round(quotaInfo.usagePercentage)}%`);
            
            // Add warning header if usage is high
            if (quotaInfo.usagePercentage > 80) {
                res.setHeader('X-Profile-Quota-Warning', `Approaching limit: ${Math.round(quotaInfo.usagePercentage)}% used`);
            }
        }
        
        next();
    } catch (error) {
        logger.error('Failed to add profile quota headers', {
            error: error.message,
            userId: req.user?.id
        });
        
        // Continue even if header addition fails
        next();
    }
}

module.exports = {
    checkProfileCreationQuota,
    checkProfileImportQuota,
    addProfileQuotaHeaders
};