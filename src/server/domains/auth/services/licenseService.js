const logger = require('../../../shared/utils/logger');
const config = require('../../../shared/config/config');
const supabaseConfig = require('../../../shared/config/supabase');

/**
 * License and Subscription Management Service
 * Handles user tiers, quotas, and feature entitlements with real Supabase integration
 */
class LicenseService {
    constructor() {
        // Default tier configurations (fallback if Supabase unavailable)
        this.tiers = {
            free: {
                name: 'Free',
                price: 0,
                maxProfiles: 10,
                maxCampaigns: 5,
                maxProxies: 25,
                maxConcurrentSessions: 5,
                features: [
                    'basic_traffic_generation',
                    'profile_management',
                    'simple_campaigns'
                ],
                limitations: [
                    'limited_profiles',
                    'no_advanced_targeting',
                    'community_support'
                ]
            },
            starter: {
                name: 'Starter',
                price: 40,
                maxProfiles: 50,
                maxCampaigns: 25,
                maxProxies: 100,
                maxConcurrentSessions: 25,
                features: [
                    'basic_traffic_generation',
                    'advanced_profile_management',
                    'campaign_scheduling',
                    'proxy_rotation',
                    'email_support'
                ],
                limitations: [
                    'moderate_concurrent_sessions'
                ]
            },
            professional: {
                name: 'Professional',
                price: 99,
                maxProfiles: 200,
                maxCampaigns: 100,
                maxProxies: 500,
                maxConcurrentSessions: 100,
                features: [
                    'all_starter_features',
                    'advanced_targeting',
                    'a_b_testing',
                    'custom_scripts',
                    'priority_support',
                    'api_access'
                ],
                limitations: []
            },
            enterprise: {
                name: 'Enterprise',
                price: 299,
                maxProfiles: 1000,
                maxCampaigns: 500,
                maxProxies: 2500,
                maxConcurrentSessions: 500,
                features: [
                    'all_professional_features',
                    'unlimited_scaling',
                    'dedicated_support',
                    'custom_integrations',
                    'white_labeling',
                    'sla_guarantee'
                ],
                limitations: []
            }
        };

        // Cache for usage limits to reduce database queries
        this.usageLimitsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get user subscription information from Supabase
     * @param {string} userId - User ID
     * @returns {Object} Subscription information
     */
    async getUserSubscription(userId) {
        try {
            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();
            
            // First, try to get user's subscription from subscriptions table
            const { data: subscriptionData, error: subscriptionError } = await supabase
                .from('subscriptions')
                .select(`
                    *,
                    profiles(plan_tier)
                `)
                .eq('user_id', userId)
                .eq('status', 'active')
                .maybeSingle();

            if (subscriptionError) {
                logger.error('Failed to fetch subscription from Supabase', {
                    error: subscriptionError.message,
                    userId: userId
                });
            }

            // If we have a subscription, return it with tier info
            if (subscriptionData) {
                const planTier = subscriptionData.profiles?.plan_tier || subscriptionData.plan_tier || 'free';
                
                // Get tier info from usage_limits table
                const tierInfo = await this.getTierInfo(planTier);
                
                return {
                    userId: userId,
                    tier: planTier,
                    status: subscriptionData.status,
                    stripeCustomerId: subscriptionData.stripe_customer_id,
                    stripeSubscriptionId: subscriptionData.stripe_subscription_id,
                    currentPeriodStart: subscriptionData.current_period_start,
                    currentPeriodEnd: subscriptionData.current_period_end,
                    cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
                    createdAt: subscriptionData.created_at,
                    updatedAt: subscriptionData.updated_at,
                    tierInfo: tierInfo
                };
            }

            // If no active subscription, check user's profile for plan tier
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('plan_tier')
                .eq('user_id', userId)
                .maybeSingle();

            if (profileError) {
                logger.error('Failed to fetch profile from Supabase', {
                    error: profileError.message,
                    userId: userId
                });
            }

            // Get plan tier from profile or default to free
            const planTier = profileData?.plan_tier || 'free';
            const tierInfo = await this.getTierInfo(planTier);

            logger.debug('Default subscription assigned', {
                userId: userId,
                planTier: planTier
            });

            return {
                userId: userId,
                tier: planTier,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: null, // Never expires
                tierInfo: tierInfo
            };
        } catch (error) {
            logger.error('Failed to get user subscription', {
                error: error.message,
                userId: userId
            });

            // Return free tier as fallback
            const tierInfo = await this.getTierInfo('free');
            
            return {
                userId: userId,
                tier: 'free',
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: null,
                tierInfo: tierInfo
            };
        }
    }

    /**
     * Set user subscription tier in Supabase
     * @param {string} userId - User ID
     * @param {string} tier - Tier name
     * @param {Object} options - Subscription options
     * @returns {Object} Updated subscription
     */
    async setUserSubscription(userId, tier, options = {}) {
        try {
            if (!this.tiers[tier]) {
                throw new Error(`Invalid tier: ${tier}`);
            }

            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();

            // Update user's profile with new plan tier
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    plan_tier: tier,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (profileError) {
                logger.error('Failed to update user profile with new plan tier', {
                    error: profileError.message,
                    userId: userId,
                    tier: tier
                });
                throw new Error(`Failed to update profile: ${profileError.message}`);
            }

            // If this is a paid tier, create/update subscription record
            if (tier !== 'free' && options.stripeSubscriptionId) {
                const subscriptionData = {
                    user_id: userId,
                    plan_tier: tier,
                    status: options.status || 'active',
                    stripe_customer_id: options.stripeCustomerId,
                    stripe_subscription_id: options.stripeSubscriptionId,
                    current_period_start: options.currentPeriodStart || new Date().toISOString(),
                    current_period_end: options.currentPeriodEnd || null,
                    cancel_at_period_end: options.cancelAtPeriodEnd || false,
                    updated_at: new Date().toISOString()
                };

                // Insert or update subscription
                const { error: subscriptionError } = await supabase
                    .from('subscriptions')
                    .upsert(subscriptionData, { onConflict: 'user_id' });

                if (subscriptionError) {
                    logger.error('Failed to update subscription in Supabase', {
                        error: subscriptionError.message,
                        userId: userId,
                        tier: tier
                    });
                    // Don't throw here - profile update was successful
                }
            }

            // Get updated subscription info
            const subscription = await this.getUserSubscription(userId);

            logger.info('User subscription updated', {
                userId: userId,
                tier: tier,
                status: subscription.status
            });

            return subscription;
        } catch (error) {
            logger.error('Failed to set user subscription', {
                error: error.message,
                userId: userId,
                tier: tier
            });
            throw error;
        }
    }

    /**
     * Check if user can perform an action based on their tier
     * @param {string} userId - User ID
     * @param {string} action - Action to check
     * @returns {Object} Permission check result
     */
    async canPerformAction(userId, action) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const tierInfo = subscription.tierInfo;

            // Check if action is allowed for this tier
            const hasFeature = tierInfo.features.some(feature => 
                feature === action || feature === 'all_' + action || feature.startsWith(action)
            );

            logger.debug('Action permission check', {
                userId: userId,
                action: action,
                hasFeature: hasFeature,
                tier: subscription.tier
            });

            return {
                allowed: hasFeature,
                tier: subscription.tier,
                tierInfo: tierInfo
            };
        } catch (error) {
            logger.error('Failed to check action permission', {
                error: error.message,
                userId: userId,
                action: action
            });

            return {
                allowed: false,
                error: error.message
            };
        }
    }

    /**
     * Check if user has reached a quota limit with real Supabase data
     * @param {string} userId - User ID
     * @param {string} resource - Resource type (profiles, campaigns, proxies)
     * @param {number} currentCount - Current count of resource
     * @returns {Object} Quota check result
     */
    async checkQuotaLimit(userId, resource, currentCount) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const tierInfo = subscription.tierInfo;

            // Get max limit for this resource
            let maxLimit;
            switch (resource.toLowerCase()) {
                case 'profiles':
                    maxLimit = tierInfo.maxProfiles;
                    break;
                case 'campaigns':
                    maxLimit = tierInfo.maxCampaigns;
                    break;
                case 'proxies':
                    maxLimit = tierInfo.maxProxies;
                    break;
                case 'sessions':
                    maxLimit = tierInfo.maxConcurrentSessions;
                    break;
                default:
                    maxLimit = Infinity;
            }

            const withinLimit = currentCount < maxLimit;
            const remaining = Math.max(0, maxLimit - currentCount);
            const usagePercentage = maxLimit > 0 ? (currentCount / maxLimit) * 100 : 0;

            // Track usage in Supabase
            await this.recordUsage(userId, resource, currentCount);

            logger.debug('Quota limit check', {
                userId: userId,
                resource: resource,
                currentCount: currentCount,
                maxLimit: maxLimit,
                withinLimit: withinLimit,
                remaining: remaining,
                usagePercentage: usagePercentage
            });

            return {
                withinLimit: withinLimit,
                maxLimit: maxLimit,
                currentCount: currentCount,
                remaining: remaining,
                usagePercentage: usagePercentage,
                tier: subscription.tier,
                upgradeRecommended: usagePercentage > 80
            };
        } catch (error) {
            logger.error('Failed to check quota limit', {
                error: error.message,
                userId: userId,
                resource: resource,
                currentCount: currentCount
            });

            return {
                withinLimit: true, // Fail open
                maxLimit: Infinity,
                currentCount: currentCount,
                remaining: Infinity,
                usagePercentage: 0,
                error: error.message
            };
        }
    }

    /**
     * Record resource usage for analytics and billing
     * @param {string} userId - User ID
     * @param {string} resource - Resource type
     * @param {number} count - Resource count
     */
    async recordUsage(userId, resource, count) {
        try {
            // Use hybrid database service for recording usage
            const hybridDB = require('../../../sqlite/hybridDatabaseService');
            
            // Create usage record
            const usageRecord = {
                id: `${userId}-${resource}-${Date.now()}`,
                user_id: userId,
                resource_type: resource,
                count: count,
                timestamp: new Date().toISOString()
            };

            // Save usage record using hybrid database service
            await hybridDB.saveRecord('usage_records', usageRecord, 'insert');

            logger.debug('Usage recorded in hybrid database', {
                userId: userId,
                resource: resource,
                count: count
            });
        } catch (error) {
            logger.warn('Failed to record usage in hybrid database (continuing)', {
                error: error.message,
                userId: userId,
                resource: resource,
                count: count
            });
            // Continue without throwing - don't block the main operation
        }
    }

    /**
     * Get available tiers information
     * @returns {Object} Tier information
     */
    getAvailableTiers() {
        return this.tiers;
    }

    /**
     * Get user analytics and usage data from Supabase
     * @param {string} userId - User ID
     * @returns {Object} Analytics data
     */
    async getUserAnalytics(userId) {
        try {
            const subscription = await this.getUserSubscription(userId);
            
            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();
            
            // Get recent usage records from database
            const { data: usageData, error: usageError } = await supabase
                .from('usage_records')
                .select('*')
                .eq('user_id', userId)
                .order('timestamp', { ascending: false })
                .limit(100);

            if (usageError) {
                logger.error('Failed to fetch usage data from Supabase', {
                    error: usageError.message,
                    userId: userId
                });
            }

            // Organize usage data by resource type
            const usage = {};
            if (usageData) {
                usageData.forEach(record => {
                    if (!usage[record.resource_type]) {
                        usage[record.resource_type] = {
                            history: [],
                            current: 0
                        };
                    }
                    
                    usage[record.resource_type].history.push({
                        timestamp: record.timestamp,
                        count: record.count
                    });
                    
                    // Update current value if this is the most recent record
                    if (usage[record.resource_type].history.length === 1 || 
                        new Date(record.timestamp) > new Date(usage[record.resource_type].currentTimestamp || 0)) {
                        usage[record.resource_type].current = record.count;
                        usage[record.resource_type].currentTimestamp = record.timestamp;
                    }
                });
            }

            return {
                subscription: subscription,
                usage: usage,
                createdAt: subscription.createdAt
            };
        } catch (error) {
            logger.error('Failed to get user analytics', {
                error: error.message,
                userId: userId
            });

            const subscription = await this.getUserSubscription(userId);
            
            return {
                subscription: subscription,
                usage: {},
                error: error.message
            };
        }
    }

    /**
     * Generate upgrade recommendation based on real usage data
     * @param {string} userId - User ID
     * @returns {Object} Upgrade recommendation
     */
    async getUpgradeRecommendation(userId) {
        try {
            const analytics = await this.getUserAnalytics(userId);
            const subscription = analytics.subscription;
            const usage = analytics.usage;

            // Check if user is hitting limits
            let highestUsagePercentage = 0;
            let limitingResource = null;

            for (const [resource, data] of Object.entries(usage)) {
                if (data.current && subscription.tierInfo) {
                    const tierLimit = subscription.tierInfo[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}s`] || Infinity;
                    const usagePercentage = tierLimit > 0 ? (data.current / tierLimit) * 100 : 0;
                    
                    if (usagePercentage > highestUsagePercentage) {
                        highestUsagePercentage = usagePercentage;
                        limitingResource = resource;
                    }
                }
            }

            // Recommend upgrade if usage is high
            if (highestUsagePercentage > 80) {
                const nextTier = this.getNextTier(subscription.tier);
                if (nextTier) {
                    const nextTierInfo = await this.getTierInfo(nextTier);
                    return {
                        recommended: true,
                        reason: `You're approaching the limit for ${limitingResource}`,
                        currentTier: subscription.tier,
                        recommendedTier: nextTier,
                        benefits: nextTierInfo.features,
                        priceDifference: nextTierInfo.price - subscription.tierInfo.price
                    };
                }
            }

            return {
                recommended: false,
                reason: 'Current usage within acceptable limits'
            };
        } catch (error) {
            logger.error('Failed to generate upgrade recommendation', {
                error: error.message,
                userId: userId
            });

            return {
                recommended: false,
                error: error.message
            };
        }
    }

    /**
     * Get tier information from Supabase or fallback to default
     * @param {string} planTier - Plan tier name
     * @returns {Object} Tier information
     */
    async getTierInfo(planTier) {
        try {
            // Check cache first
            const cacheKey = `tier_${planTier}`;
            const cached = this.usageLimitsCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }

            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();
            
            // Get tier info from usage_limits table
            const { data, error } = await supabase
                .from('usage_limits')
                .select('*')
                .eq('plan_tier', planTier)
                .maybeSingle();

            if (error) {
                logger.error('Failed to fetch tier info from Supabase', {
                    error: error.message,
                    planTier: planTier
                });
            }

            if (data) {
                // Convert database fields to our expected format
                const tierInfo = {
                    name: data.plan_tier.charAt(0).toUpperCase() + data.plan_tier.slice(1),
                    price: 0, // Would need to fetch from pricing table
                    maxProfiles: data.max_profiles,
                    maxCampaigns: data.max_campaigns,
                    maxProxies: data.max_proxies,
                    maxConcurrentSessions: data.concurrent_sessions,
                    features: data.ad_network_access || [],
                    limitations: data.custom_target_websites ? [] : ['no_custom_targeting']
                };

                // Cache the result
                this.usageLimitsCache.set(cacheKey, {
                    data: tierInfo,
                    timestamp: Date.now()
                });

                return tierInfo;
            }

            // Fallback to default tiers
            logger.warn('Using fallback tier info', { planTier: planTier });
            const tierInfo = this.tiers[planTier] || this.tiers.free;
            
            // Cache the fallback result
            this.usageLimitsCache.set(cacheKey, {
                data: tierInfo,
                timestamp: Date.now()
            });

            return tierInfo;
        } catch (error) {
            logger.error('Failed to get tier info', {
                error: error.message,
                planTier: planTier
            });

            // Fallback to default tiers
            const tierInfo = this.tiers[planTier] || this.tiers.free;
            
            // Cache the fallback result
            const cacheKey = `tier_${planTier}`;
            this.usageLimitsCache.set(cacheKey, {
                data: tierInfo,
                timestamp: Date.now()
            });

            return tierInfo;
        }
    }

    /**
     * Validate subscription status with real Supabase data
     * @param {string} userId - User ID
     * @returns {Object} Validation result
     */
    async validateSubscription(userId) {
        try {
            const subscription = await this.getUserSubscription(userId);
            
            // Check if subscription is expired
            if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
                return {
                    valid: false,
                    reason: 'Subscription expired',
                    subscription: subscription
                };
            }

            // Check if subscription is active
            if (subscription.status !== 'active') {
                return {
                    valid: false,
                    reason: 'Subscription not active',
                    subscription: subscription
                };
            }

            // Check if subscription period has ended (for paid subscriptions)
            if (subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) < new Date()) {
                // Check if subscription should be renewed
                if (subscription.cancelAtPeriodEnd) {
                    return {
                        valid: false,
                        reason: 'Subscription period ended and cancellation scheduled',
                        subscription: subscription
                    };
                }
            }

            return {
                valid: true,
                subscription: subscription
            };
        } catch (error) {
            logger.error('Failed to validate subscription', {
                error: error.message,
                userId: userId
            });

            return {
                valid: false,
                error: error.message
            };
        }
    }
}

// Export singleton instance
module.exports = new LicenseService();