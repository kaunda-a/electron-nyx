const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs-extra');
const config = require('./shared/config/config');
const logger = require('./shared/utils/logger');
// Import individual route modules from domains
const proxyRoutes = require('./domains/proxies/routes/proxies');
const profileRoutes = require('./domains/profiles/routes/profiles');
const campaignRoutes = require('./domains/campaigns/routes/campaigns');
const authRoutes = require('./domains/auth/routes/auth');
const SystemController = require('./system/controllers/systemController');

// Create controller instance
const systemController = new SystemController();

// Import and register workflows
require('./domains/campaigns/workflows/campaignLaunch');
require('./domains/campaigns/workflows/enhancedCampaignLaunch');
require('./domains/campaigns/workflows/batchCampaignLaunch');

class NyxServer {
    constructor() {
        console.log('Debug: NyxServer constructor started');
        this.app = express();
        this.server = null;
        this.isInitialized = false;
        this.isShuttingDown = false;
        console.log('Debug: NyxServer constructor completed');
    }

    /**
     * Initialize the Nyx server
     */
    async initialize() {
        try {
            console.log('Debug: Starting server initialization');
            logger.info('Initializing Nyx itBrowser Automation System');

            // Initialize core services
            console.log('Debug: Initializing services...');
            await this.initializeServices();

            // Setup Express middleware
            console.log('Debug: Setting up middleware...');
            this.setupMiddleware();

            // Setup routes
            console.log('Debug: Setting up routes...');
            this.setupRoutes();

            // Setup error handling
            console.log('Debug: Setting up error handling...');
            this.setupErrorHandling();

            // Start rate limiting cleanup
            const rateLimitService = require('./domains/auth/services/rateLimitService');
            rateLimitService.startCleanup();

            this.isInitialized = true;
            console.log('Debug: Server initialization completed');
            logger.info('Nyx server initialization completed');

        } catch (error) {
            console.log('Debug: Error during initialization:', error.message);
            logger.error('Failed to initialize Nyx server', { error: error.message });
            throw error;
        }
    }

    /**
     * Initialize core services
     */
    async initializeServices() {
        console.log('Debug: Initializing core services...');
        logger.info('Initializing core services');

        try {
            // Initialize the hybrid database service for offline-first functionality
            const hybridDatabaseService = require('./sqlite/hybridDatabaseService');
            await hybridDatabaseService.initialize();
            
            // Initialize the sync service for cloud synchronization
            const syncService = require('./system/services/syncService');
            await syncService.initialize();
            
            console.log('Debug: Core services initialization completed');
            logger.info('Core services initialized successfully');

        } catch (error) {
            console.log('Debug: Error initializing services:', error.message);
            logger.error('Failed to initialize core services', { error: error.message });
            throw error;
        }
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: false, // Disable for API
            crossOriginEmbedderPolicy: false
        }));

        // CORS configuration
        this.app.use(cors({
            origin: config.server.corsOrigins || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        }));

        // Import enhanced rate limiting
        const { createUserRateLimiter, createAuthRateLimiter, createHeavyOperationRateLimiter } = require('./domains/auth/middleware/userRateLimitMiddleware');

        // Rate limiting - General API rate limiting (user-aware)
        const generalLimiter = createUserRateLimiter({
            category: 'general',
            max: 1000,
            windowMs: 15 * 60 * 1000 // 15 minutes
        });

        // Rate limiting - Auth endpoints (more restrictive)
        const authLimiter = createAuthRateLimiter({
            max: 20,
            windowMs: 15 * 60 * 1000 // 15 minutes
        });

        // Rate limiting - Heavy endpoints (campaigns, profiles) - more restrictive
        const heavyOperationLimiter = createHeavyOperationRateLimiter({
            max: 100,
            windowMs: 60 * 60 * 1000 // 1 hour
        });

        // Apply rate limiting
        this.app.use('/api/', generalLimiter);
        this.app.use('/api/auth', authLimiter);
        this.app.use('/api/campaigns', heavyOperationLimiter);
        this.app.use('/api/profiles', heavyOperationLimiter);
        this.app.use('/api/proxies', heavyOperationLimiter);

        // Compression
        this.app.use(compression());

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                logger.info('HTTP Request', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip
                });
            });

            next();
        });

        // Health check endpoint (before rate limiting)
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('./package.json').version
            });
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Mount individual domain routes under /api
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/proxies', proxyRoutes);
        this.app.use('/api/profiles', profileRoutes);
        this.app.use('/api/campaigns', campaignRoutes);
        this.app.use('/api/license', require('./domains/auth/routes/license'));
        this.app.use('/api/payments', require('./domains/payments/routes/payments'));
        this.app.use('/api/webhooks', require('./domains/payments/routes/webhooks'));

        // System routes
        this.app.get('/api/status', systemController.getSystemStatus.bind(systemController));
        this.app.get('/api/stats', systemController.getSystemStats.bind(systemController));

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Nyx itBrowser Automation System',
                version: require('./package.json').version,
                description: 'Advanced website visit automation with anti-detection technology',
                endpoints: {
                    health: '/health',
                    api: '/api',
                    documentation: '/api/docs',
                    profiles: {
                        list: 'GET /api/profiles',
                        create: 'POST /api/profiles',
                        get: 'GET /api/profiles/:profileId',
                        update: 'PUT /api/profiles/:profileId',
                        delete: 'DELETE /api/profiles/:profileId',
                        stats: 'GET /api/profiles/:profileId/stats',
                        fingerprint: 'GET /api/profiles/:profileId/fingerprint',
                        batch: 'POST /api/profiles/batch',
                        launch: 'POST /api/profiles/:profileId/launch',
                        browserConfig: 'POST /api/profiles/:profileId/browser-config',
                        close: 'POST /api/profiles/:profileId/close',
                        import: 'POST /api/profiles/import/json'
                    },
                    proxies: {
                        list: 'GET /api/proxies',
                        create: 'POST /api/proxies',
                        batch: 'POST /api/proxies/batch',
                        validate: 'POST /api/proxies/validate',
                        get: 'GET /api/proxies/:proxyId',
                        delete: 'DELETE /api/proxies/:proxyId',
                        stats: 'GET /api/proxies/stats'
                    },
                    campaigns: {
                        list: 'GET /api/campaigns',
                        create: 'POST /api/campaigns',
                        get: 'GET /api/campaigns/:campaignId',
                        update: 'PUT /api/campaigns/:campaignId',
                        delete: 'DELETE /api/campaigns/:campaignId',
                        stats: 'GET /api/campaigns/stats',
                        launch: 'POST /api/campaigns/:campaignId/launch'
                    }
                },
                status: this.isInitialized ? 'ready' : 'initializing'
            });
        });

        // Health check endpoint (before rate limiting)
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('./package.json').version
            });
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                message: `The requested endpoint ${req.method} ${req.originalUrl} was not found`,
                availableEndpoints: [
                    'GET /',
                    'GET /health',
                    'GET /api/status',
                    'GET /api/stats',
                    'GET /api/profiles',
                    'POST /api/profiles',
                    'GET /api/profiles/:profileId',
                    'PUT /api/profiles/:profileId',
                    'DELETE /api/profiles/:profileId',
                    'GET /api/profiles/:profileId/stats',
                    'GET /api/profiles/:profileId/fingerprint',
                    'POST /api/profiles/batch',
                    'POST /api/profiles/:profileId/launch',
                    'POST /api/profiles/:profileId/browser-config',
                    'POST /api/profiles/:profileId/close',
                    'POST /api/profiles/import/json',
                    'GET /api/campaigns',
                    'POST /api/campaigns',
                    'GET /api/campaigns/:campaignId',
                    'PUT /api/campaigns/:campaignId',
                    'DELETE /api/campaigns/:campaignId',
                    'GET /api/campaigns/stats',
                    'POST /api/campaigns/:campaignId/launch',
                    'GET /api/proxies',
                    'POST /api/proxies',
                    'POST /api/proxies/batch',
                    'POST /api/proxies/validate',
                    'GET /api/proxies/:proxyId',
                    'DELETE /api/proxies/:proxyId',
                    'GET /api/proxies/stats'
                ]
            });
        });

        // Global error handler
        this.app.use((error, req, res, next) => {
            logger.error('Unhandled error in request', {
                error: error.message,
                stack: error.stack,
                method: req.method,
                url: req.url,
                body: req.body
            });

            // Don't expose internal errors in production
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            res.status(error.status || 500).json({
                error: 'Internal server error',
                message: isDevelopment ? error.message : 'An unexpected error occurred',
                timestamp: new Date().toISOString(),
                requestId: req.id || 'unknown'
            });
        });
    }

    /**
     * Start the server
     * @param {number} port - Port to listen on
     * @returns {Promise} Server instance
     */
    async start(port = config.server.port) {
        console.log('Debug: Start method called with port:', port);
        if (!this.isInitialized) {
            console.log('Debug: Server not initialized, initializing...');
            await this.initialize();
        }

        console.log('Debug: Starting server on port:', port);
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, () => {
                console.log('Debug: Server started successfully on port:', port);
                logger.info('Nyx server started successfully', {
                    port,
                    environment: process.env.NODE_ENV || 'development',
                    pid: process.pid
                });
                resolve(this.server);
            });

            this.server.on('error', (error) => {
                console.log('Debug: Server error:', error.message);
                logger.error('Failed to start server', { error: error.message, port });
                reject(error);
            });
        });
    }

    /**
     * Get Express app instance
     * @returns {Object} Express app
     */
    getApp() {
        return this.app;
    }
}

// Create and export server instance
const nyxServer = new NyxServer();

// Start server if this file is run directly
if (require.main === module) {
    nyxServer.start(config.server.port).catch(error => {
        logger.error('Failed to start Nyx server', { error: error.message });
        process.exit(1);
    });
}

module.exports = nyxServer;