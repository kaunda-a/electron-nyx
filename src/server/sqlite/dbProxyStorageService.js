const hybridDatabaseService = require('./hybridDatabaseService');
const config = require('../shared/config/config');
const logger = require('../shared/utils/logger');

/**
 * Database Proxy Storage Service
 * Uses hybrid database service (SQLite + Supabase sync) for proxy data storage
 */
class DBProxyStorageService {
    constructor() {
        this.hybridDB = hybridDatabaseService;
        this.isInitialized = false;
    }

    /**
     * Initialize database storage
     */
    async initialize() {
        try {
            logger.info('Initializing database proxy storage service');
            
            // Initialize hybrid database service
            await this.hybridDB.initialize();
            
            this.isInitialized = true;
            logger.info('Database proxy storage service initialized successfully');
            
            return true;
        } catch (error) {
            logger.error('Failed to initialize database proxy storage service', { error: error.message });
            throw error;
        }
    }

    /**
     * Create database tables (delegated to hybrid database service)
     */
    async createTables() {
        // Tables are created by hybrid database service
        logger.info('Proxy database tables handled by hybrid database service');
        return true;
    }

    /**
     * Save proxy data to database
     * @param {string} proxyId - Proxy ID
     * @param {Object} data - Proxy data
     * @returns {Object} Saved proxy data
     */
    async saveProxy(proxyId, data) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Saving proxy to database', { proxyId });
            
            // Prepare data for insertion
            const proxyData = {
                id: proxyId,
                host: data.host || '',
                port: data.port || 8080,
                protocol: data.protocol || 'http',
                username: data.username || null,
                password: data.password || null,
                country: data.country || 'us',
                status: data.status || 'active',
                failure_count: data.failure_count || 0,
                success_count: data.success_count || 0,
                average_response_time: data.average_response_time || 0,
                assigned_profiles: JSON.stringify(data.assigned_profiles || []),
                created_at: data.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                geolocation: JSON.stringify(data.geolocation || {}),
                ip: data.ip || '',
                is_assigned: data.is_assigned || false,
                assigned_profile_id: data.assigned_profile_id || null,
                assigned_at: data.assigned_at || null,
                metadata: JSON.stringify(data.metadata || {})
            };
            
            // Save using hybrid database service
            const savedProxy = await this.hybridDB.saveRecord('proxies', proxyData, 'insert');
            
            logger.info('Proxy saved to database successfully', { proxyId });
            
            return savedProxy;
        } catch (error) {
            logger.error('Failed to save proxy to database', { 
                error: error.message, 
                proxyId 
            });
            throw error;
        }
    }

    /**
     * Load proxy data from database
     * @param {string} proxyId - Proxy ID
     * @returns {Object|null} Proxy data or null if not found
     */
    async loadProxy(proxyId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Loading proxy data from database', { proxyId });
            
            // Get proxy using hybrid database service
            const proxy = await this.hybridDB.getRecordById('proxies', proxyId);
            
            if (!proxy) {
                logger.debug('Proxy not found in database', { proxyId });
                return null;
            }
            
            // Parse JSON fields
            const parsedProxy = { ...proxy };
            
            try {
                if (parsedProxy.config && typeof parsedProxy.config === 'string') {
                    parsedProxy.config = JSON.parse(parsedProxy.config);
                }
                
                if (parsedProxy.metadata && typeof parsedProxy.metadata === 'string') {
                    parsedProxy.metadata = JSON.parse(parsedProxy.metadata);
                }
                
                if (parsedProxy.geolocation && typeof parsedProxy.geolocation === 'string') {
                    parsedProxy.geolocation = JSON.parse(parsedProxy.geolocation);
                }
                
                if (parsedProxy.assigned_profiles && typeof parsedProxy.assigned_profiles === 'string') {
                    parsedProxy.assigned_profiles = JSON.parse(parsedProxy.assigned_profiles);
                }
            } catch (parseError) {
                logger.warn('Failed to parse proxy JSON fields', {
                    error: parseError.message,
                    proxyId: proxyId
                });
            }
            
            logger.debug('Proxy data loaded from database successfully', { proxyId });
            
            return parsedProxy;
        } catch (error) {
            logger.error('Failed to load proxy data from database', {
                error: error.message,
                proxyId: proxyId
            });
            return null;
        }
    }

    /**
     * Delete proxy data from database
     * @param {string} proxyId - Proxy ID
     */
    async deleteProxy(proxyId) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Deleting proxy data from database', { proxyId });
            
            // Delete using hybrid database service
            await this.hybridDB.deleteRecord('proxies', proxyId);
            
            logger.debug('Proxy data deleted from database', { proxyId });
        } catch (error) {
            logger.error('Failed to delete proxy data from database', {
                error: error.message,
                proxyId: proxyId
            });
            throw error;
        }
    }

    /**
     * List all proxies from database
     * @returns {Array} List of proxy objects
     */
    async listProxies() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Listing proxies from database');
            
            // Get all proxies using hybrid database service
            const proxies = await this.hybridDB.getAllRecords('proxies');
            
            // Parse JSON fields
            const parsedProxies = proxies.map(proxy => {
                const parsedProxy = { ...proxy };
                
                try {
                    if (parsedProxy.config && typeof parsedProxy.config === 'string') {
                        parsedProxy.config = JSON.parse(parsedProxy.config);
                    }
                    
                    if (parsedProxy.metadata && typeof parsedProxy.metadata === 'string') {
                        parsedProxy.metadata = JSON.parse(parsedProxy.metadata);
                    }
                    
                    if (parsedProxy.geolocation && typeof parsedProxy.geolocation === 'string') {
                        parsedProxy.geolocation = JSON.parse(parsedProxy.geolocation);
                    }
                    
                    if (parsedProxy.assigned_profiles && typeof parsedProxy.assigned_profiles === 'string') {
                        parsedProxy.assigned_profiles = JSON.parse(parsedProxy.assigned_profiles);
                    }
                } catch (parseError) {
                    logger.warn('Failed to parse proxy JSON fields', {
                        error: parseError.message,
                        proxyId: proxy.id
                    });
                }
                
                return parsedProxy;
            });
            
            logger.debug('Proxies listed from database successfully', { count: parsedProxies.length });
            
            return parsedProxies;
        } catch (error) {
            logger.error('Failed to list proxies from database', {
                error: error.message
            });
            return [];
        }
    }

    /**
     * Save proxy test result
     * @param {string} proxyId - Proxy ID
     * @param {string} testId - Test ID
     * @param {Object} data - Test result data
     */
    async saveProxyTest(proxyId, testId, data) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const testResult = JSON.stringify(data.testResult || {});
            const testType = data.testType || 'connectivity';
            const isSuccess = data.isSuccess || false;
            const responseTime = data.responseTime || null;
            
            const stmt = this.db.prepare(`
                INSERT OR REPLACE INTO proxy_tests 
                (id, proxy_id, test_result, test_type, is_success, response_time, tested_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `);
            
            stmt.run(testId, proxyId, testResult, testType, isSuccess, responseTime);
            
            logger.debug('Proxy test result saved to database', { proxyId, testId });
        } catch (error) {
            logger.error('Failed to save proxy test result to database', { 
                error: error.message, 
                proxyId, 
                testId 
            });
            throw error;
        }
    }

    /**
     * Get proxy statistics
     * @param {string} proxyId - Proxy ID
     * @returns {Object} Proxy statistics
     */
    async getProxyStats(proxyId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(*) as total_tests,
                    AVG(response_time) as avg_response_time,
                    SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) as successful_tests,
                    MAX(tested_at) as last_tested
                FROM proxy_tests WHERE proxy_id = ?
            `);
            
            const row = stmt.get(proxyId);
            
            return {
                proxyId,
                totalTests: row.total_tests || 0,
                avgResponseTime: row.avg_response_time,
                successfulTests: row.successful_tests || 0,
                successRate: row.total_tests > 0 ? row.successful_tests / row.total_tests : 0,
                lastTested: row.last_tested
            };
        } catch (error) {
            logger.error('Failed to get proxy stats from database', { 
                error: error.message, 
                proxyId 
            });
            return null;
        }
    }

    /**
     * Update proxy status in database
     * @param {string} proxyId - Proxy ID
     * @param {Object} statusData - Status update data
     * @returns {Object} Updated proxy data
     */
    async updateProxyStatus(proxyId, statusData) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            
            logger.debug('Updating proxy status in database', { proxyId, statusData });
            
            // Get current proxy data
            const currentProxy = await this.hybridDB.getRecordById('proxies', proxyId);
            
            if (!currentProxy) {
                throw new Error(`Proxy not found: ${proxyId}`);
            }
            
            // Prepare updated data
            const updatedData = {
                ...currentProxy,
                status: statusData.status || currentProxy.status,
                failure_count: statusData.failure_count !== undefined ? statusData.failure_count : currentProxy.failure_count,
                success_count: statusData.success_count !== undefined ? statusData.success_count : currentProxy.success_count,
                average_response_time: statusData.average_response_time !== undefined ? statusData.average_response_time : currentProxy.average_response_time,
                updated_at: new Date().toISOString(),
                is_assigned: statusData.is_assigned !== undefined ? statusData.is_assigned : currentProxy.is_assigned,
                assigned_profile_id: statusData.assigned_profile_id !== undefined ? statusData.assigned_profile_id : currentProxy.assigned_profile_id,
                assigned_at: statusData.assigned_at !== undefined ? statusData.assigned_at : currentProxy.assigned_at
            };
            
            // Update using hybrid database service
            const updatedProxy = await this.hybridDB.saveRecord('proxies', updatedData, 'update');
            
            logger.info('Proxy status updated in database successfully', { proxyId, status: statusData.status });
            
            return updatedProxy;
        } catch (error) {
            logger.error('Failed to update proxy status in database', {
                error: error.message,
                proxyId: proxyId,
                statusData: statusData
            });
            throw error;
        }
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
            logger.info('Proxy database connection closed');
        }
    }
}

module.exports = new DBProxyStorageService();