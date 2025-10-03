const express = require('express');
const router = express.Router();
const SystemController = require('../../../system/controllers/systemController');
const syncService = require('../../../system/services/syncService');

// Create controller instance
const systemController = new SystemController();

// Proxy management routes
// NOTE: Specific routes must be defined BEFORE parameterized routes
router.get('/stats', systemController.getProxyStats.bind(systemController));
router.get('/', systemController.getAllProxies.bind(systemController));
router.post('/', systemController.createProxy.bind(systemController));
router.post('/batch', systemController.createBatchProxies.bind(systemController));
router.post('/validate', systemController.validateProxy.bind(systemController));
router.post('/assign', systemController.assignProxyToProfile.bind(systemController));
router.get('/:proxyId', systemController.getProxy.bind(systemController));
router.delete('/:proxyId', systemController.deleteProxy.bind(systemController));

module.exports = router;