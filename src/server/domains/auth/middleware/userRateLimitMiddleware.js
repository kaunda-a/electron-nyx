const rateLimitService = require('../services/rateLimitService');
const logger = require('../../../shared/utils/logger');

/**
 * User-based Rate Limiting Middleware
 * Integrates with existing authentication system
 */

/**
 * Create user-aware rate limiter with plan-based limits
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
function createUserRateLimiter(options = {}) {
    return async (req, res, next) => {
        try {
            // Determine limit key - use user ID if authenticated, otherwise use IP
            let limitKey;
            let userType = 'anonymous';
            let planTier = 'free'; // Default plan tier
            
            // Check for authenticated user (from existing auth system)
            if (req.headers.authorization) {
                // Extract user ID from authorization header or session
                // In the existing system, this might be set by previous middleware
                if (req.user && req.user.id) {
                    limitKey = `user:${req.user.id}`;
                    userType = 'authenticated';
                    planTier = req.user.plan || 'free'; // Get plan from user object
                } else {
                    // For now, use IP for authenticated users without ID
                    limitKey = req.ip;
                    userType = 'authenticated-ip';
                }
            } else {
                // Anonymous user - use IP
                limitKey = req.ip;
                userType = 'anonymous';
            }
            
            // Apply plan-based rate limiting if user is authenticated
            if (userType === 'authenticated') {
                // Get plan-based limits
                const planLimits = await getPlanRateLimits(planTier);
                
                // Merge plan limits with options
                const effectiveOptions = {
                    ...options,
                    max: planLimits.max || options.max || 100,
                    windowMs: planLimits.windowMs || options.windowMs || 15 * 60 * 1000
                };
                
                // Apply rate limiting with plan-based limits
                const limitInfo = rateLimitService.recordRequest(limitKey, effectiveOptions.category || 'general', {
                    max: effectiveOptions.max,
                    windowMs: effectiveOptions.windowMs
                });
                
                // Add rate limit headers
                res.setHeader('X-RateLimit-Limit', limitInfo.limit);
                res.setHeader('X-RateLimit-Remaining', limitInfo.remaining);
                res.setHeader('X-RateLimit-Reset', new Date(Date.now() + (limitInfo.resetIn * 1000)).toUTCString());
                res.setHeader('X-RateLimit-Plan', planTier); // Add plan information
                
                logger.debug('Plan-based rate limit check', {
                    limitKey: limitKey,
                    userType: userType,
                    planTier: planTier,
                    category: effectiveOptions.category || 'general',
                    allowed: limitInfo.allowed,
                    remaining: limitInfo.remaining,
                    resetIn: limitInfo.resetIn,
                    max: effectiveOptions.max,
                    windowMs: effectiveOptions.windowMs
                });
                
                if (!limitInfo.allowed) {
                    logger.warn('Plan-based rate limit exceeded', {
                        limitKey: limitKey,
                        userType: userType,
                        planTier: planTier,
                        category: effectiveOptions.category || 'general',
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        url: req.url,
                        method: req.method
                    });
                    
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: `Rate limit exceeded for ${planTier} plan.`,
                        retryAfter: `${Math.ceil(limitInfo.resetIn / 60)} minutes`,
                        plan: planTier,
                        limit: effectiveOptions.max,
                        window: `${Math.ceil(effectiveOptions.windowMs / 60000)} minutes`
                    });
                }
            } else {
                // Apply standard rate limiting for anonymous users
                const category = options.category || 'general';
                const limitInfo = rateLimitService.recordRequest(limitKey, category);
                
                // Add rate limit headers
                res.setHeader('X-RateLimit-Limit', limitInfo.limit);
                res.setHeader('X-RateLimit-Remaining', limitInfo.remaining);
                res.setHeader('X-RateLimit-Reset', new Date(Date.now() + (limitInfo.resetIn * 1000)).toUTCString());
                res.setHeader('X-RateLimit-Plan', 'anonymous'); // Indicate anonymous
                
                logger.debug('Standard rate limit check', {
                    limitKey: limitKey,
                    userType: userType,
                    category: category,
                    allowed: limitInfo.allowed,
                    remaining: limitInfo.remaining,
                    resetIn: limitInfo.resetIn
                });
                
                if (!limitInfo.allowed) {
                    logger.warn('Standard rate limit exceeded', {
                        limitKey: limitKey,
                        userType: userType,
                        category: category,
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        url: req.url,
                        method: req.method
                    });
                    
                    return res.status(429).json({
                        error: 'Rate limit exceeded',
                        message: 'Too many requests, please try again later.',
                        retryAfter: `${Math.ceil(limitInfo.resetIn / 60)} minutes`
                    });
                }
            }
            
            next();
        } catch (error) {
            logger.error('Rate limiting middleware error', {
                error: error.message,
                ip: req.ip,
                url: req.url,
                method: req.method
            });
            
            // Fail open - allow request if rate limiting fails
            next();
        }
    };
}

/**
 * Create rate limiter for specific categories
 * @param {string} category - Rate limit category
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
function createCategoryRateLimiter(category, options = {}) {
    return createUserRateLimiter({
        ...options,
        category: category
    });
}

/**
 * Create strict rate limiter for authentication endpoints
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
function createAuthRateLimiter(options = {}) {
    return createCategoryRateLimiter('auth', {
        max: options.max || 20,
        windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
        message: options.message || 'Too many authentication attempts'
    });
}

/**
 * Create rate limiter for heavy operations
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
function createHeavyOperationRateLimiter(options = {}) {
    return createCategoryRateLimiter('heavy', {
        max: options.max || 100,
        windowMs: options.windowMs || 60 * 60 * 1000, // 1 hour
        message: options.message || 'Too many heavy operations'
    });
}

/**
 * Get user rate limit information
 * @param {string} userId - User ID
 * @returns {Object} Rate limit information
 */
function getUserRateLimits(userId) {
    return rateLimitService.getUserLimits(userId);
}

/**
 * Get rate limits based on user's plan tier
 * @param {string} planTier - User's plan tier
 * @returns {Object} Rate limit configuration
 */
async function getPlanRateLimits(planTier) {
    try {
        // Define rate limits per plan tier
        const planRateLimits = {
            free: {
                max: 100,      // 100 requests
                windowMs: 15 * 60 * 1000  // 15 minutes
            },
            starter: {
                max: 500,      // 500 requests
                windowMs: 15 * 60 * 1000  // 15 minutes
            },
            professional: {
                max: 2000,     // 2000 requests
                windowMs: 15 * 60 * 1000  // 15 minutes
            },
            enterprise: {
                max: 10000,    // 10000 requests
                windowMs: 15 * 60 * 1000  // 15 minutes
            }
        };

        // Return the appropriate limits for the plan tier
        return planRateLimits[planTier] || planRateLimits.free;
    } catch (error) {
        logger.error('Failed to get plan rate limits', {
            error: error.message,
            planTier: planTier
        });
        
        // Return free tier limits as fallback
        return {
            max: 100,
            windowMs: 15 * 60 * 1000
        };
    }
}

module.exports = {
    createUserRateLimiter,
    createCategoryRateLimiter,
    createAuthRateLimiter,
    createHeavyOperationRateLimiter,
    getUserRateLimits,
    getPlanRateLimits  // Export the new helper function
};