const hybridDatabaseService = require('./hybridDatabaseService');
const config = require('../shared/config/config');
const logger = require('../shared/utils/logger');

/**
 * Database Settings Storage Service
 * Uses hybrid database service (SQLite + Supabase sync) for user settings storage
 */
class DBSettingsStorageService {
    constructor() {
        this.hybridDB = hybridDatabaseService;
        this.isInitialized = false;
    }

    /**
     * Initialize database storage
     */
    async initialize() {
        try {
            logger.info('Initializing database settings storage service');
            
            // Initialize hybrid database service
            await this.hybridDB.initialize();
            
            // Ensure the user_settings table exists
            await this.createTables();
            
            this.isInitialized = true;
            logger.info('Database settings storage service initialized successfully');
            
            return true;
        } catch (error) {
            logger.error('Failed to initialize database settings storage service', { error: error.message });
            throw error;
        }
    }

    /**
     * Create database tables (delegated to hybrid database service)
     */
    async createTables() {
        try {
            // Ensure user_settings table exists by adding it to the hybrid database
            // The createTables method in the hybrid database creates the user_settings table
            logger.info('Settings database tables handled by hybrid database service');
            return true;
        } catch (error) {
            logger.error('Failed to create settings database tables', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Save user settings to database
     * @param {string} userId - User ID
     * @param {Object} data - Settings data
     * @returns {Object} Saved settings data
     */
    async saveSettings(userId, data) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Saving settings to database', { userId });
            
            // Prepare data for insertion
            const settingsData = {
                id: data.id || `${userId}_settings`, // Use user ID as base for settings ID
                user_id: userId,
                theme: data.theme || 'dark',
                font: data.font || 'inter',
                notifications: JSON.stringify(data.notifications || {
                    email: true,
                    push: true,
                    sms: false,
                    in_app: true,
                    marketing: false,
                    detection_alerts: true,
                    automation_alerts: true,
                    proxy_failure_alerts: true,
                    fingerprint_change_alerts: true,
                }),
                display: JSON.stringify(data.display || {
                    sidebar_collapsed: false,
                    show_welcome: true,
                    density: 'normal',
                    animations: true,
                    items: ['recents', 'home'],
                    show_fingerprint_stats: true,
                    show_detection_risk: true,
                    show_automation_logs: true,
                    real_time_monitoring: true,
                }),
                account: JSON.stringify(data.account || {
                    language: 'en',
                    timezone: 'UTC',
                    date_format: 'MM/DD/YYYY',
                    time_format: '12h',
                }),
                profile: JSON.stringify(data.profile || {
                    name: '',
                    bio: 'I use Nyx for secure, undetectable browsing.',
                    avatar_url: '',
                    urls: [],
                }),
                created_at: data.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: JSON.stringify(data.metadata || {})
            };
            
            // Save using hybrid database service
            const savedSettings = await this.hybridDB.saveRecord('user_settings', settingsData, 'insert');
            
            logger.info('Settings saved to database successfully', { userId });
            
            return savedSettings;
        } catch (error) {
            logger.error('Failed to save settings to database', { 
                error: error.message, 
                userId 
            });
            throw error;
        }
    }

    /**
     * Load user settings from database
     * @param {string} userId - User ID
     * @returns {Object|null} Settings data or null if not found
     */
    async loadSettings(userId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Loading settings from database', { userId });
            
            // Get settings using hybrid database service
            const settings = await this.hybridDB.getRecordById('user_settings', `${userId}_settings`);
            
            if (settings) {
                logger.debug('Settings data loaded from database', { userId });
                
                // Parse JSON fields if they are strings
                const parsedSettings = { ...settings };
                
                try {
                    if (typeof parsedSettings.notifications === 'string') {
                        parsedSettings.notifications = JSON.parse(parsedSettings.notifications);
                    }
                    
                    if (typeof parsedSettings.display === 'string') {
                        parsedSettings.display = JSON.parse(parsedSettings.display);
                    }
                    
                    if (typeof parsedSettings.account === 'string') {
                        parsedSettings.account = JSON.parse(parsedSettings.account);
                    }
                    
                    if (typeof parsedSettings.profile === 'string') {
                        parsedSettings.profile = JSON.parse(parsedSettings.profile);
                    }
                    
                    if (typeof parsedSettings.metadata === 'string') {
                        parsedSettings.metadata = JSON.parse(parsedSettings.metadata);
                    }
                } catch (parseError) {
                    logger.warn('Failed to parse settings JSON fields', {
                        error: parseError.message,
                        userId: userId
                    });
                }
                
                return parsedSettings;
            }
            
            logger.debug('Settings not found in database', { userId });
            return null;
        } catch (error) {
            logger.error('Failed to load settings from database', { 
                error: error.message, 
                userId 
            });
            return null;
        }
    }

    /**
     * Delete user settings from database
     * @param {string} userId - User ID
     */
    async deleteSettings(userId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Deleting settings from database', { userId });
            
            // Create settings ID based on user ID
            const settingsId = `${userId}_settings`;
            
            // Delete using hybrid database service
            await this.hybridDB.deleteRecord('user_settings', settingsId);
            
            logger.debug('Settings deleted from database', { userId });
        } catch (error) {
            logger.error('Failed to delete settings from database', {
                error: error.message,
                userId: userId
            });
            throw error;
        }
    }

    /**
     * List all settings from database
     * @returns {Array} List of settings objects
     */
    async listSettings() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Listing settings from database');
            
            // Get all settings using hybrid database service
            const settings = await this.hybridDB.getRecords('user_settings');
            
            // Parse JSON fields
            const parsedSettings = settings.map(setting => {
                const parsedSetting = { ...setting };
                
                try {
                    if (typeof parsedSetting.notifications === 'string') {
                        parsedSetting.notifications = JSON.parse(parsedSetting.notifications);
                    }
                    
                    if (typeof parsedSetting.display === 'string') {
                        parsedSetting.display = JSON.parse(parsedSetting.display);
                    }
                    
                    if (typeof parsedSetting.account === 'string') {
                        parsedSetting.account = JSON.parse(parsedSetting.account);
                    }
                    
                    if (typeof parsedSetting.profile === 'string') {
                        parsedSetting.profile = JSON.parse(parsedSetting.profile);
                    }
                    
                    if (typeof parsedSetting.metadata === 'string') {
                        parsedSetting.metadata = JSON.parse(parsedSetting.metadata);
                    }
                } catch (parseError) {
                    logger.warn('Failed to parse settings JSON fields', {
                        error: parseError.message,
                        userId: setting.user_id
                    });
                }
                
                return parsedSetting;
            });
            
            logger.debug('Settings listed from database', { count: parsedSettings.length });
            return parsedSettings;
        } catch (error) {
            logger.error('Failed to list settings from database', { error: error.message });
            return [];
        }
    }

    /**
     * Close database connection
     */
    async close() {
        logger.info('Settings database service closed');
    }
}

// Export singleton instance
module.exports = new DBSettingsStorageService();