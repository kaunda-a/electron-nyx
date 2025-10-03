const logger = require('../../../shared/utils/logger');

/**
 * Rate Limiting Service
 * Manages rate limiting for authenticated users and IP addresses
 */
class RateLimitService {
    constructor() {
        // In-memory storage for rate limiting (in production, use Redis)
        this.limits = new Map();
        this.userLimits = new Map();
        
        // Default limits
        this.defaultLimits = {
            general: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 1000
            },
            auth: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 20
            },
            heavy: {
                windowMs: 60 * 60 * 1000, // 1 hour
                max: 100
            }
        };
    }

    /**
     * Check if request is within rate limits
     * @param {string} key - Limit key (user ID or IP)
     * @param {string} category - Limit category
     * @returns {Object} Rate limit info
     */
    checkLimit(key, category = 'general') {
        try {
            const limitKey = `${key}:${category}`;
            const now = Date.now();
            const limitConfig = this.defaultLimits[category] || this.defaultLimits.general;
            
            // Get or create limit record
            let limitRecord = this.limits.get(limitKey);
            if (!limitRecord) {
                limitRecord = {
                    key: limitKey,
                    count: 0,
                    resetTime: now + limitConfig.windowMs,
                    createdAt: now
                };
                this.limits.set(limitKey, limitRecord);
            }
            
            // Reset counter if window has expired
            if (now > limitRecord.resetTime) {
                limitRecord.count = 0;
                limitRecord.resetTime = now + limitConfig.windowMs;
            }
            
            // Increment counter
            limitRecord.count++;
            
            const isAllowed = limitRecord.count <= limitConfig.max;
            const remaining = Math.max(0, limitConfig.max - limitRecord.count);
            const resetIn = Math.ceil((limitRecord.resetTime - now) / 1000); // seconds
            
            logger.debug('Rate limit check', {
                key: limitKey,
                count: limitRecord.count,
                max: limitConfig.max,
                remaining: remaining,
                resetIn: resetIn,
                isAllowed: isAllowed
            });
            
            return {
                allowed: isAllowed,
                limit: limitConfig.max,
                remaining: remaining,
                resetTime: limitRecord.resetTime,
                resetIn: resetIn
            };
        } catch (error) {
            logger.error('Rate limit check failed', {
                error: error.message,
                key: key,
                category: category
            });
            
            // Fail open - allow request if rate limiting fails
            return {
                allowed: true,
                limit: 0,
                remaining: 0,
                resetTime: 0,
                resetIn: 0
            };
        }
    }

    /**
     * Record a request for rate limiting
     * @param {string} key - Limit key (user ID or IP)
     * @param {string} category - Limit category
     * @returns {Object} Rate limit info
     */
    recordRequest(key, category = 'general') {
        return this.checkLimit(key, category);
    }

    /**
     * Get user rate limits
     * @param {string} userId - User ID
     * @returns {Object} User rate limits
     */
    getUserLimits(userId) {
        try {
            const userKey = `user:${userId}`;
            const userLimits = {};
            
            // Get limits for each category
            for (const category in this.defaultLimits) {
                const limitInfo = this.checkLimit(userKey, category);
                userLimits[category] = limitInfo;
            }
            
            return userLimits;
        } catch (error) {
            logger.error('Failed to get user limits', {
                error: error.message,
                userId: userId
            });
            return {};
        }
    }

    /**
     * Reset user rate limits
     * @param {string} userId - User ID
     * @param {string} category - Limit category (optional)
     */
    resetUserLimits(userId, category = null) {
        try {
            const userKey = `user:${userId}`;
            
            if (category) {
                // Reset specific category
                const limitKey = `${userKey}:${category}`;
                this.limits.delete(limitKey);
                logger.info('Reset user rate limits for category', {
                    userId: userId,
                    category: category
                });
            } else {
                // Reset all categories for user
                for (const cat in this.defaultLimits) {
                    const limitKey = `${userKey}:${cat}`;
                    this.limits.delete(limitKey);
                }
                logger.info('Reset all user rate limits', {
                    userId: userId
                });
            }
        } catch (error) {
            logger.error('Failed to reset user limits', {
                error: error.message,
                userId: userId,
                category: category
            });
        }
    }

    /**
     * Cleanup expired rate limit records
     */
    cleanupExpiredLimits() {
        try {
            const now = Date.now();
            let expiredCount = 0;
            
            for (const [key, record] of this.limits.entries()) {
                if (now > record.resetTime + (24 * 60 * 60 * 1000)) { // Expired for more than 24 hours
                    this.limits.delete(key);
                    expiredCount++;
                }
            }
            
            if (expiredCount > 0) {
                logger.info(`Cleaned up ${expiredCount} expired rate limit records`);
            }
        } catch (error) {
            logger.error('Failed to cleanup expired rate limits', {
                error: error.message
            });
        }
    }

    /**
     * Get rate limiting statistics
     * @returns {Object} Statistics
     */
    getStats() {
        try {
            const now = Date.now();
            let activeLimits = 0;
            let expiringSoon = 0;
            
            for (const record of this.limits.values()) {
                if (record.count > 0) {
                    activeLimits++;
                }
                if ((record.resetTime - now) < (5 * 60 * 1000)) { // Expiring in less than 5 minutes
                    expiringSoon++;
                }
            }
            
            return {
                totalRecords: this.limits.size,
                activeLimits: activeLimits,
                expiringSoon: expiringSoon,
                userLimits: this.userLimits.size
            };
        } catch (error) {
            logger.error('Failed to get rate limit stats', {
                error: error.message
            });
            return {
                totalRecords: 0,
                activeLimits: 0,
                expiringSoon: 0,
                userLimits: 0
            };
        }
    }

    /**
     * Start cleanup interval
     */
    startCleanup() {
        // Cleanup expired records every hour
        setInterval(() => {
            this.cleanupExpiredLimits();
        }, 60 * 60 * 1000); // 1 hour
    }
}

// Export singleton instance
module.exports = new RateLimitService();