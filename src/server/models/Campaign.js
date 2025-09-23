const { v4: uuidv4 } = require('uuid');

/**
 * Campaign model for managing ad monetization campaigns
 */
class Campaign {
    constructor(data = {}) {
        this.id = data.id || uuidv4();
        this.name = data.name || '';
        this.description = data.description || '';
        this.status = data.status || 'draft'; // draft, active, paused, completed
        this.type = data.type || 'traffic'; // traffic, revenue, testing
        
        // Campaign settings
        this.settings = {
            dailyVisitTarget: data.settings?.dailyVisitTarget || 1000,
            maxConcurrentSessions: data.settings?.maxConcurrentSessions || 10,
            sessionDuration: data.settings?.sessionDuration || { min: 30, max: 300 }, // seconds
            clickRate: data.settings?.clickRate || { min: 0.5, max: 3.0 }, // percentage
            bounceRate: data.settings?.bounceRate || { min: 20, max: 60 }, // percentage
            ...data.settings
        };

        // Targeting configuration
        this.targeting = {
            countries: data.targeting?.countries || ['US', 'GB', 'CA', 'AU'],
            adNetworks: data.targeting?.adNetworks || ['adsense', 'monetag'],
            adFormats: data.targeting?.adFormats || ['display', 'responsive'],
            deviceTypes: data.targeting?.deviceTypes || ['desktop', 'mobile'],
            browsers: data.targeting?.browsers || ['chrome', 'firefox', 'safari'],
            ...data.targeting
        };

        // Schedule configuration
        this.schedule = {
            enabled: data.schedule?.enabled || false,
            timezone: data.schedule?.timezone || 'UTC',
            dailySchedule: data.schedule?.dailySchedule || {
                enabled: false,
                startTime: '09:00',
                endTime: '17:00'
            },
            weeklySchedule: data.schedule?.weeklySchedule || {
                enabled: false,
                activeDays: [1, 2, 3, 4, 5] // Monday to Friday
            },
            dateRange: data.schedule?.dateRange || {
                enabled: false,
                startDate: null,
                endDate: null
            },
            ...data.schedule
        };

        // Target URLs and behavior
        this.targets = {
            urls: data.targets?.urls || [],
            behavior: data.targets?.behavior || 'random', // random, sequential, weighted
            weights: data.targets?.weights || {},
            ...data.targets
        };

        // Profile assignment
        this.profiles = {
            assignmentType: data.profiles?.assignmentType || 'auto', // auto, manual, category
            assignedProfiles: data.profiles?.assignedProfiles || [],
            categoryDistribution: data.profiles?.categoryDistribution || {
                newVisitor: 40,
                returningRegular: 35,
                loyalUser: 25
            },
            maxProfilesPerCampaign: data.profiles?.maxProfilesPerCampaign || 0, // 0 = unlimited
            ...data.profiles
        };

        // Performance tracking
        this.performance = {
            totalVisits: data.performance?.totalVisits || 0,
            totalClicks: data.performance?.totalClicks || 0,
            totalRevenue: data.performance?.totalRevenue || 0,
            avgSessionDuration: data.performance?.avgSessionDuration || 0,
            avgCTR: data.performance?.avgCTR || 0,
            errorRate: data.performance?.errorRate || 0,
            lastUpdated: data.performance?.lastUpdated || null,
            ...data.performance
        };

        // Metadata
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.createdBy = data.createdBy || 'system';
        this.tags = data.tags || [];
        this.priority = data.priority || 'medium'; // low, medium, high, urgent
    }

    /**
     * Update campaign data
     * @param {Object} updates - Updates to apply
     */
    update(updates) {
        Object.keys(updates).forEach(key => {
            if (key === 'settings' || key === 'targeting' || key === 'schedule' || 
                key === 'targets' || key === 'profiles' || key === 'performance') {
                this[key] = { ...this[key], ...updates[key] };
            } else {
                this[key] = updates[key];
            }
        });
        this.updatedAt = new Date().toISOString();
    }

    /**
     * Validate campaign configuration
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];
        const warnings = [];

        // Required fields
        if (!this.name || this.name.trim().length === 0) {
            errors.push('Campaign name is required');
        }

        if (!this.targets.urls || this.targets.urls.length === 0) {
            errors.push('At least one target URL is required');
        }

        // Settings validation
        if (this.settings.dailyVisitTarget <= 0) {
            errors.push('Daily visit target must be greater than 0');
        }

        if (this.settings.maxConcurrentSessions <= 0) {
            errors.push('Max concurrent sessions must be greater than 0');
        }

        if (this.settings.sessionDuration.min >= this.settings.sessionDuration.max) {
            errors.push('Session duration minimum must be less than maximum');
        }

        // Targeting validation
        if (!this.targeting.countries || this.targeting.countries.length === 0) {
            warnings.push('No target countries specified');
        }

        if (!this.targeting.adNetworks || this.targeting.adNetworks.length === 0) {
            warnings.push('No ad networks specified');
        }

        // Schedule validation
        if (this.schedule.enabled) {
            if (this.schedule.dateRange.enabled) {
                if (!this.schedule.dateRange.startDate || !this.schedule.dateRange.endDate) {
                    errors.push('Start and end dates are required when date range is enabled');
                }
                
                if (new Date(this.schedule.dateRange.startDate) >= new Date(this.schedule.dateRange.endDate)) {
                    errors.push('Start date must be before end date');
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Check if campaign is currently active based on schedule
     * @returns {boolean} Whether campaign should be running
     */
    isActiveNow() {
        if (this.status !== 'active') {
            return false;
        }

        if (!this.schedule.enabled) {
            return true;
        }

        const now = new Date();
        const timezone = this.schedule.timezone || 'UTC';

        // Check date range
        if (this.schedule.dateRange.enabled) {
            const startDate = new Date(this.schedule.dateRange.startDate);
            const endDate = new Date(this.schedule.dateRange.endDate);
            
            if (now < startDate || now > endDate) {
                return false;
            }
        }

        // Check weekly schedule
        if (this.schedule.weeklySchedule.enabled) {
            const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            if (!this.schedule.weeklySchedule.activeDays.includes(dayOfWeek)) {
                return false;
            }
        }

        // Check daily schedule
        if (this.schedule.dailySchedule.enabled) {
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
            const startTime = this.schedule.dailySchedule.startTime;
            const endTime = this.schedule.dailySchedule.endTime;
            
            if (currentTime < startTime || currentTime > endTime) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get campaign summary for display
     * @returns {Object} Campaign summary
     */
    getSummary() {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            type: this.type,
            priority: this.priority,
            dailyTarget: this.settings.dailyVisitTarget,
            assignedProfiles: this.profiles.assignedProfiles.length,
            targetUrls: this.targets.urls.length,
            performance: {
                totalVisits: this.performance.totalVisits,
                totalRevenue: this.performance.totalRevenue,
                avgCTR: this.performance.avgCTR
            },
            isActive: this.isActiveNow(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Convert to JSON
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            status: this.status,
            type: this.type,
            settings: this.settings,
            targeting: this.targeting,
            schedule: this.schedule,
            targets: this.targets,
            profiles: this.profiles,
            performance: this.performance,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            createdBy: this.createdBy,
            tags: this.tags,
            priority: this.priority
        };
    }
}

module.exports = Campaign;
