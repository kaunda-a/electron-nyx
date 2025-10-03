const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');
const config = require('../shared/config/config');
const logger = require('../shared/utils/logger');

/**
 * Hybrid Database Service
 * Combines local SQLite storage with Supabase cloud sync
 * Provides offline-first functionality with cloud backup
 */
class HybridDatabaseService {
    constructor() {
        this.isInitialized = false;
        this.localDB = null;
        this.supabase = null;
        this.isOnline = false;
        this.syncQueue = []; // Queue for pending sync operations
        this.syncInterval = null;
    }

    /**
     * Initialize hybrid database service
     */
    async initialize() {
        try {
            if (this.isInitialized) {
                return true;
            }

            logger.info('Initializing hybrid database service');

            // Initialize local SQLite database
            await this.initializeLocalDB();

            // Initialize Supabase client if available
            await this.initializeSupabase();

            // Start sync interval
            this.startSyncInterval();

            this.isInitialized = true;
            logger.info('Hybrid database service initialized successfully');

            return true;
        } catch (error) {
            logger.error('Failed to initialize hybrid database service', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Initialize local SQLite database
     */
    async initializeLocalDB() {
        try {
            // Ensure database directory exists
            const dbPath = path.join(config.paths.storage, 'hybrid_database.db');
            await fs.ensureDir(path.dirname(dbPath));

            // Create SQLite database connection
            this.localDB = new Database(dbPath);

            // Enable WAL mode for better concurrency
            this.localDB.pragma('journal_mode = WAL');

            // Create tables if they don't exist
            await this.createTables();

            logger.info('Local SQLite database initialized', { dbPath });
        } catch (error) {
            logger.error('Failed to initialize local SQLite database', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Initialize Supabase client
     */
    async initializeSupabase() {
        try {
            // Check if Supabase environment variables are available
            const supabaseUrl = process.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

            if (supabaseUrl && supabaseAnonKey) {
                const { createClient } = require('@supabase/supabase-js');
                this.supabase = createClient(supabaseUrl, supabaseAnonKey);
                logger.info('Supabase client initialized successfully');
            } else {
                logger.warn('Supabase environment variables not found, running in local-only mode');
                this.supabase = null;
            }
        } catch (error) {
            logger.error('Failed to initialize Supabase client', {
                error: error.message
            });
            this.supabase = null;
        }
    }

    /**
     * Create database tables
     */
    async createTables() {
        try {
            // Create profiles table
            this.localDB.exec(`
                CREATE TABLE IF NOT EXISTS profiles (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    config TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT,
                    path TEXT,
                    user_id TEXT,
                    session TEXT
                )
            `);

            // Create campaigns table
            this.localDB.exec(`
                CREATE TABLE IF NOT EXISTS campaigns (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'draft',
                    type TEXT,
                    settings TEXT,
                    targeting TEXT,
                    schedule TEXT,
                    targets TEXT,
                    profiles TEXT,
                    performance TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by TEXT,
                    tags TEXT,
                    priority TEXT DEFAULT 'medium'
                )
            `);

            // Create proxies table
            this.localDB.exec(`
                CREATE TABLE IF NOT EXISTS proxies (
                    id TEXT PRIMARY KEY,
                    host TEXT NOT NULL,
                    port INTEGER NOT NULL,
                    protocol TEXT DEFAULT 'http',
                    username TEXT,
                    password TEXT,
                    country TEXT,
                    status TEXT DEFAULT 'active',
                    failure_count INTEGER DEFAULT 0,
                    success_count INTEGER DEFAULT 0,
                    average_response_time REAL DEFAULT 0,
                    assigned_profiles TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    geolocation TEXT,
                    ip TEXT,
                    is_assigned BOOLEAN DEFAULT FALSE,
                    assigned_profile_id TEXT,
                    assigned_at DATETIME
                )
            `);

            // Create user_settings table
            this.localDB.exec(`
                CREATE TABLE IF NOT EXISTS user_settings (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    theme TEXT DEFAULT 'dark',
                    font TEXT DEFAULT 'inter',
                    notifications TEXT,
                    display TEXT,
                    account TEXT,
                    profile TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    metadata TEXT
                )
            `);

            // Create sync queue table
            this.localDB.exec(`
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    table_name TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    record_id TEXT,
                    data TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    status TEXT DEFAULT 'pending',
                    retries INTEGER DEFAULT 0,
                    error_message TEXT
                )
            `);

            // Create indexes for better performance
            this.localDB.exec(`
                CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
                CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON campaigns(created_by);
                CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
                CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
                CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
                CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp);
            `);

            logger.info('Database tables created successfully');
        } catch (error) {
            logger.error('Failed to create database tables', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Check if we're online
     */
    async checkOnlineStatus() {
        try {
            if (!this.supabase) {
                this.isOnline = false;
                return false;
            }

            // Try to reach Supabase
            const { data, error } = await this.supabase
                .from('profiles')
                .select('id')
                .limit(1);

            this.isOnline = !error;
            return this.isOnline;
        } catch (error) {
            this.isOnline = false;
            return false;
        }
    }

    /**
     * Start sync interval
     */
    startSyncInterval() {
        // Check online status every 30 seconds
        setInterval(async () => {
            await this.checkOnlineStatus();
            if (this.isOnline) {
                await this.processSyncQueue();
            }
        }, 30000);

        // Process sync queue every minute when online
        this.syncInterval = setInterval(async () => {
            if (this.isOnline) {
                await this.processSyncQueue();
            }
        }, 60000);

        logger.info('Sync interval started');
    }

    /**
     * Add operation to sync queue
     * @param {string} tableName - Table name
     * @param {string} operation - Operation type (insert, update, delete)
     * @param {string} recordId - Record ID
     * @param {Object} data - Record data
     */
    async addToSyncQueue(tableName, operation, recordId, data) {
        try {
            if (!this.supabase) {
                logger.debug('Supabase not configured, skipping sync queue');
                return;
            }

            const stmt = this.localDB.prepare(`
                INSERT INTO sync_queue (table_name, operation, record_id, data)
                VALUES (?, ?, ?, ?)
            `);

            stmt.run(tableName, operation, recordId, JSON.stringify(data));

            logger.debug('Operation added to sync queue', {
                tableName: tableName,
                operation: operation,
                recordId: recordId
            });
        } catch (error) {
            logger.error('Failed to add operation to sync queue', {
                error: error.message,
                tableName: tableName,
                operation: operation,
                recordId: recordId
            });
        }
    }

    /**
     * Process sync queue
     */
    async processSyncQueue() {
        try {
            if (!this.supabase || !this.isOnline) {
                return;
            }

            // Get pending operations
            const stmt = this.localDB.prepare(`
                SELECT * FROM sync_queue 
                WHERE status = 'pending' 
                ORDER BY timestamp ASC 
                LIMIT 10
            `);

            const pendingOperations = stmt.all();

            for (const operation of pendingOperations) {
                try {
                    await this.processSyncOperation(operation);
                    
                    // Mark as completed
                    const updateStmt = this.localDB.prepare(`
                        UPDATE sync_queue 
                        SET status = 'completed' 
                        WHERE id = ?
                    `);
                    updateStmt.run(operation.id);
                } catch (error) {
                    logger.error('Failed to process sync operation', {
                        error: error.message,
                        operationId: operation.id
                    });

                    // Increment retry count
                    const updateStmt = this.localDB.prepare(`
                        UPDATE sync_queue 
                        SET retries = retries + 1, error_message = ?
                        WHERE id = ?
                    `);
                    updateStmt.run(error.message, operation.id);

                    // Mark as failed if too many retries
                    if (operation.retries >= 3) {
                        const failStmt = this.localDB.prepare(`
                            UPDATE sync_queue 
                            SET status = 'failed' 
                            WHERE id = ?
                        `);
                        failStmt.run(operation.id);
                    }
                }
            }

            if (pendingOperations.length > 0) {
                logger.info(`Processed ${pendingOperations.length} sync operations`);
            }
        } catch (error) {
            logger.error('Failed to process sync queue', {
                error: error.message
            });
        }
    }

    /**
     * Process individual sync operation
     * @param {Object} operation - Sync operation
     */
    async processSyncOperation(operation) {
        try {
            if (!this.supabase) {
                return;
            }

            const data = JSON.parse(operation.data);
            
            switch (operation.operation) {
                case 'insert':
                case 'update':
                    await this.supabase
                        .from(operation.table_name)
                        .upsert(data, { onConflict: 'id' });
                    break;
                case 'delete':
                    await this.supabase
                        .from(operation.table_name)
                        .delete()
                        .eq('id', operation.record_id);
                    break;
            }

            logger.debug('Sync operation processed', {
                tableName: operation.table_name,
                operation: operation.operation,
                recordId: operation.record_id
            });
        } catch (error) {
            logger.error('Failed to process sync operation', {
                error: error.message,
                tableName: operation.table_name,
                operation: operation.operation,
                recordId: operation.record_id
            });
            throw error;
        }
    }

    /**
     * Save record to local database and queue for sync
     * @param {string} tableName - Table name
     * @param {Object} data - Record data
     * @param {string} operation - Operation type (insert, update)
     */
    async saveRecord(tableName, data, operation = 'insert') {
        try {
            // Save to local database
            const columns = Object.keys(data);
            const values = Object.values(data);
            const placeholders = columns.map(() => '?').join(', ');
            
            const columnNames = columns.join(', ');
            
            const stmt = this.localDB.prepare(`
                INSERT OR REPLACE INTO ${tableName} (${columnNames})
                VALUES (${placeholders})
            `);
            
            stmt.run(...values);

            logger.debug('Record saved to local database', {
                tableName: tableName,
                recordId: data.id,
                operation: operation
            });

            // Queue for sync if Supabase is available
            if (this.supabase) {
                await this.addToSyncQueue(tableName, operation, data.id, data);
            }

            return data;
        } catch (error) {
            logger.error('Failed to save record', {
                error: error.message,
                tableName: tableName,
                recordId: data?.id,
                operation: operation
            });
            throw error;
        }
    }

    /**
     * Delete record from local database and queue for sync
     * @param {string} tableName - Table name
     * @param {string} recordId - Record ID
     */
    async deleteRecord(tableName, recordId) {
        try {
            // Delete from local database
            const stmt = this.localDB.prepare(`
                DELETE FROM ${tableName} WHERE id = ?
            `);
            
            stmt.run(recordId);

            logger.debug('Record deleted from local database', {
                tableName: tableName,
                recordId: recordId
            });

            // Queue for sync if Supabase is available
            if (this.supabase) {
                await this.addToSyncQueue(tableName, 'delete', recordId, { id: recordId });
            }

            return { success: true };
        } catch (error) {
            logger.error('Failed to delete record', {
                error: error.message,
                tableName: tableName,
                recordId: recordId
            });
            throw error;
        }
    }

    /**
     * Get records from local database
     * @param {string} tableName - Table name
     * @param {Object} filters - Query filters
     * @param {Object} options - Query options
     * @returns {Array} Records
     */
    async getRecords(tableName, filters = {}, options = {}) {
        try {
            let query = `SELECT * FROM ${tableName}`;
            const conditions = [];
            const values = [];

            // Add filters
            for (const [key, value] of Object.entries(filters)) {
                conditions.push(`${key} = ?`);
                values.push(value);
            }

            if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
            }

            // Add ordering
            if (options.orderBy) {
                query += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
            }

            // Add limit
            if (options.limit) {
                query += ` LIMIT ${options.limit}`;
            }

            // Add offset
            if (options.offset) {
                query += ` OFFSET ${options.offset}`;
            }

            const stmt = this.localDB.prepare(query);
            const records = stmt.all(...values);

            // Parse JSON fields
            const parsedRecords = records.map(record => {
                const parsedRecord = { ...record };
                
                // Parse JSON fields
                for (const [key, value] of Object.entries(record)) {
                    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                        try {
                            parsedRecord[key] = JSON.parse(value);
                        } catch (e) {
                            // Keep original value if parsing fails
                        }
                    }
                }
                
                return parsedRecord;
            });

            logger.debug('Records retrieved from local database', {
                tableName: tableName,
                count: parsedRecords.length,
                filters: filters
            });

            return parsedRecords;
        } catch (error) {
            logger.error('Failed to get records', {
                error: error.message,
                tableName: tableName,
                filters: filters
            });
            throw error;
        }
    }

    /**
     * Get record by ID from local database
     * @param {string} tableName - Table name
     * @param {string} recordId - Record ID
     * @returns {Object|null} Record or null
     */
    async getRecordById(tableName, recordId) {
        try {
            const stmt = this.localDB.prepare(`
                SELECT * FROM ${tableName} WHERE id = ?
            `);
            
            const record = stmt.get(recordId);

            if (!record) {
                return null;
            }

            // Parse JSON fields
            const parsedRecord = { ...record };
            
            for (const [key, value] of Object.entries(record)) {
                if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
                    try {
                        parsedRecord[key] = JSON.parse(value);
                    } catch (e) {
                        // Keep original value if parsing fails
                    }
                }
            }

            logger.debug('Record retrieved by ID from local database', {
                tableName: tableName,
                recordId: recordId
            });

            return parsedRecord;
        } catch (error) {
            logger.error('Failed to get record by ID', {
                error: error.message,
                tableName: tableName,
                recordId: recordId
            });
            throw error;
        }
    }

    /**
     * Sync data with Supabase
     * @param {string} tableName - Table name
     * @param {Array} records - Records to sync
     */
    async syncWithSupabase(tableName, records) {
        try {
            if (!this.supabase || !this.isOnline) {
                logger.debug('Skipping Supabase sync - offline or not configured');
                return { success: true, synced: 0 };
            }

            // Upsert records to Supabase
            const { data, error } = await this.supabase
                .from(tableName)
                .upsert(records, { onConflict: 'id' });

            if (error) {
                logger.error('Failed to sync with Supabase', {
                    error: error.message,
                    tableName: tableName,
                    recordCount: records.length
                });
                throw error;
            }

            logger.info('Data synced with Supabase', {
                tableName: tableName,
                recordCount: records.length
            });

            return { success: true, synced: records.length };
        } catch (error) {
            logger.error('Failed to sync with Supabase', {
                error: error.message,
                tableName: tableName
            });
            throw error;
        }
    }

    /**
     * Get sync statistics
     * @returns {Object} Sync statistics
     */
    async getSyncStats() {
        try {
            const stats = {
                local: {},
                cloud: {},
                sync: {}
            };

            // Get local database statistics
            try {
                const profileCount = this.localDB.prepare('SELECT COUNT(*) as count FROM profiles').get();
                const campaignCount = this.localDB.prepare('SELECT COUNT(*) as count FROM campaigns').get();
                const proxyCount = this.localDB.prepare('SELECT COUNT(*) as count FROM proxies').get();
                const syncQueueCount = this.localDB.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'").get();

                stats.local = {
                    profiles: profileCount.count,
                    campaigns: campaignCount.count,
                    proxies: proxyCount.count,
                    pendingSync: syncQueueCount.count
                };
            } catch (localError) {
                logger.warn('Failed to get local database stats', {
                    error: localError.message
                });
            }

            // Get cloud database statistics (if online)
            if (this.supabase && this.isOnline) {
                try {
                    const [profileResult, campaignResult, proxyResult] = await Promise.all([
                        this.supabase.from('profiles').select('id', { count: 'exact' }),
                        this.supabase.from('campaigns').select('id', { count: 'exact' }),
                        this.supabase.from('proxies').select('id', { count: 'exact' })
                    ]);

                    stats.cloud = {
                        profiles: profileResult.count || 0,
                        campaigns: campaignResult.count || 0,
                        proxies: proxyResult.count || 0
                    };
                } catch (cloudError) {
                    logger.warn('Failed to get cloud database stats', {
                        error: cloudError.message
                    });
                }
            }

            // Get sync queue statistics
            try {
                const pendingCount = this.localDB.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'").get();
                const completedCount = this.localDB.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'completed'").get();
                const failedCount = this.localDB.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'").get();

                stats.sync = {
                    pending: pendingCount.count,
                    completed: completedCount.count,
                    failed: failedCount.count,
                    online: this.isOnline,
                    supabaseConfigured: !!this.supabase
                };
            } catch (queueError) {
                logger.warn('Failed to get sync queue stats', {
                    error: queueError.message
                });
            }

            return stats;
        } catch (error) {
            logger.error('Failed to get sync statistics', {
                error: error.message
            });
            return {
                local: {},
                cloud: {},
                sync: {
                    online: this.isOnline,
                    supabaseConfigured: !!this.supabase
                }
            };
        }
    }

    /**
     * Shutdown hybrid database service
     */
    async shutdown() {
        try {
            if (this.syncInterval) {
                clearInterval(this.syncInterval);
            }

            if (this.localDB) {
                this.localDB.close();
            }

            logger.info('Hybrid database service shut down successfully');
        } catch (error) {
            logger.error('Failed to shut down hybrid database service', {
                error: error.message
            });
        }
    }
}

// Export singleton instance
module.exports = new HybridDatabaseService();