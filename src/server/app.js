const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
const config = require('./utils/config');
const logger = require('./utils/logger');
// Import routes
const apiRoutes = require('./routes');
// Import and register workflows
require('./workflows/campaignLaunch');
require('./workflows/enhancedCampaignLaunch');
require('./workflows/batchCampaignLaunch');

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
            // Services are now initialized on demand by controllers
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

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // Limit each IP to 1000 requests per windowMs
            message: {
                error: 'Too many requests from this IP, please try again later.',
                retryAfter: '15 minutes'
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api/', limiter);

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
        // Mount API routes
        this.app.use('/api', apiRoutes);

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
        this.app.use('*', (req, res) => {
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