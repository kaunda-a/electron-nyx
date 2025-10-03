const express = require('express');
const AuthController = require('../controllers/AuthController');
const validateIPCAuth = require('../middleware/ipcAuthMiddleware');

const router = express.Router();
const authController = new AuthController();

// Google OAuth endpoints
router.get('/google', validateIPCAuth, (req, res) => authController.signInWithGoogle(req, res));
// The callback endpoint is accessible without IPC validation as it handles the OAuth redirect
router.get('/callback', (req, res) => authController.handleOAuthCallback(req, res));
// Add a direct code exchange endpoint for use with IPC
router.post('/exchange-code', validateIPCAuth, (req, res) => authController.exchangeCodeForSession(req, res));

// Standard endpoints
router.post('/logout', validateIPCAuth, (req, res) => authController.logout(req, res));
router.get('/me', validateIPCAuth, (req, res) => authController.getCurrentUser(req, res));

module.exports = router;