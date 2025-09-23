const express = require('express');
const router = express.Router();

// Import individual route modules
const proxyRoutes = require('./proxies');
const profileRoutes = require('./profiles');
const campaignRoutes = require('./campaigns');
const SystemController = require('../controllers/systemController');

// Create controller instance
const systemController = new SystemController();

// Mount individual routes
router.use('/proxies', proxyRoutes);
router.use('/profiles', profileRoutes);
router.use('/campaigns', campaignRoutes);

// System routes
router.get('/status', systemController.getSystemStatus.bind(systemController));
router.get('/stats', systemController.getSystemStats.bind(systemController));

module.exports = router;