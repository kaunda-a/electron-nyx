const authService = require('../services/authService');
const logger = require('../../../shared/utils/logger');
const supabaseConfig = require('../../../shared/config/supabase');

/**
 * Authentication Controller
 * Handles Google OAuth authentication
 */
class AuthController {
    /**
     * Initiate Google OAuth flow
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async signInWithGoogle(req, res) {
        try {
            const redirectTo = req.query.redirectTo || '/dashboard';
            
            logger.info('Initiating Google OAuth', {
                ip: req.ip
            });

            // This will redirect the user to Google's authentication page
            const oauthData = await authService.initiateGoogleOAuth(redirectTo);
            
            // For Electron app, we need to handle OAuth differently
            // Since we can't control the redirect in the same way as a web app,
            // We'll return the OAuth URL for the frontend to handle
            res.status(200).json({
                success: true,
                message: 'Google OAuth initiated',
                oauthUrl: oauthData.url // This is the URL to redirect to
            });
        } catch (error) {
            logger.error('Google OAuth initiation error', {
                error: error.message,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Google OAuth failed',
                message: 'An error occurred during Google OAuth initiation'
            });
        }
    }

    /**
     * Handle OAuth callback and complete the authentication process
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleOAuthCallback(req, res) {
        try {
            const { code } = req.query;
            
            if (!code) {
                logger.warn('OAuth callback without code', {
                    ip: req.ip
                });
                
                return res.status(400).json({
                    error: 'Missing code',
                    message: 'Authorization code is required'
                });
            }

            logger.info('Handling OAuth callback', {
                ip: req.ip
            });

            const data = await authService.handleOAuthCallback(code);
            
            logger.info('OAuth callback successful', {
                userId: data.user.id,
                email: data.user.email,
                ip: req.ip
            });

            // Return the session data to the client
            res.status(200).json({
                success: true,
                message: 'OAuth successful',
                data: data
            });
        } catch (error) {
            logger.error('OAuth callback error', {
                error: error.message,
                ip: req.ip
            });

            res.status(500).json({
                error: 'OAuth callback failed',
                message: 'An error occurred during OAuth callback'
            });
        }
    }

    /**
     * Exchange OAuth code for session (can be called directly from client)
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async exchangeCodeForSession(req, res) {
        try {
            const { code } = req.body;
            
            if (!code) {
                logger.warn('Exchange code for session called without code', {
                    ip: req.ip
                });
                
                return res.status(400).json({
                    error: 'Missing code',
                    message: 'Authorization code is required'
                });
            }

            logger.info('Exchanging OAuth code for session', {
                ip: req.ip
            });

            const data = await authService.handleOAuthCallback(code);
            
            logger.info('Code exchange successful', {
                userId: data.user.id,
                email: data.user.email,
                ip: req.ip
            });

            res.status(200).json({
                success: true,
                message: 'Session created successfully',
                data: data
            });
        } catch (error) {
            logger.error('Code exchange error', {
                error: error.message,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Code exchange failed',
                message: 'An error occurred during code exchange'
            });
        }
    }

    /**
     * User logout endpoint
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async logout(req, res) {
        try {
            const supabase = await supabaseConfig.initialize();
            await supabase.auth.signOut();

            res.status(200).json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            logger.error('Logout endpoint error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Logout failed',
                message: 'An error occurred during logout'
            });
        }
    }

    /**
     * Get current user information
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getCurrentUser(req, res) {
        try {
            if (!req.user) {
                logger.warn('Get current user called without authentication', {
                    ip: req.ip
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'No authenticated user found'
                });
            }

            // Get user information
            const user = await authService.getUserById(req.user.id);

            logger.debug('Current user information retrieved', {
                userId: user.id,
                email: user.email
            });

            res.status(200).json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        avatar_url: user.avatar_url,
                        role: user.role,
                        plan: user.plan || 'free',  // Include plan information
                        createdAt: user.createdAt,
                        provider: user.provider
                    }
                }
            });
        } catch (error) {
            logger.error('Get current user error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to retrieve user information',
                message: 'An error occurred while retrieving user information'
            });
        }
    }

    /**
     * Handle OAuth callback from external providers
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleOAuthCallback(req, res) {
        try {
            // For OAuth callbacks, we typically get a code parameter
            // But in desktop apps with custom protocols, we might get tokens directly
            const { code, state, error, error_description } = req.query;
            
            if (error) {
                logger.warn('OAuth callback with error', {
                    error: error,
                    error_description: error_description,
                    ip: req.ip
                });
                
                // Redirect back to the app with the error
                return res.redirect(`electron-nyx://oauth/callback?error=${encodeURIComponent(error_description || error)}`);
            }
            
            if (code) {
                // If we have a code, we need to exchange it for a session
                // This would typically be handled by the frontend via IPC
                logger.info('OAuth callback with code received', {
                    code_length: code.length,
                    ip: req.ip
                });
                
                // Redirect back to the app with the code
                return res.redirect(`electron-nyx://oauth/callback?code=${encodeURIComponent(code)}`);
            }
            
            // If we have tokens directly in the query (PKCE flow for desktop apps)
            const { access_token, refresh_token, expires_in, token_type } = req.query;
            
            if (access_token) {
                logger.info('OAuth callback with tokens received', {
                    access_token_length: access_token.length,
                    token_type: token_type,
                    ip: req.ip
                });
                
                // Redirect back to the app with the tokens
                const redirectUrl = new URL('electron-nyx://oauth/callback');
                redirectUrl.searchParams.set('access_token', access_token);
                if (refresh_token) redirectUrl.searchParams.set('refresh_token', refresh_token);
                if (expires_in) redirectUrl.searchParams.set('expires_at', (Date.now() + (expires_in * 1000)).toString());
                if (token_type) redirectUrl.searchParams.set('token_type', token_type);
                
                return res.redirect(redirectUrl.toString());
            }
            
            // No recognizable parameters, redirect with error
            logger.warn('OAuth callback with no recognizable parameters', {
                query_params: Object.keys(req.query),
                ip: req.ip
            });
            
            return res.redirect(`electron-nyx://oauth/callback?error=invalid_callback_parameters`);
            
        } catch (error) {
            logger.error('OAuth callback error', {
                error: error.message,
                stack: error.stack,
                ip: req.ip
            });
            
            return res.redirect(`electron-nyx://oauth/callback?error=${encodeURIComponent('An error occurred during authentication')}`);
        }
    }

    /**
     * Exchange OAuth code for session
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async exchangeCodeForSession(req, res) {
        try {
            const { code } = req.body;
            
            if (!code) {
                logger.warn('Exchange code for session called without code', {
                    ip: req.ip
                });
                
                return res.status(400).json({
                    error: 'Missing code',
                    message: 'Authorization code is required'
                });
            }

            logger.info('Exchanging OAuth code for session', {
                code_length: code.length,
                ip: req.ip
            });

            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();
            
            // Exchange the code for a session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                logger.error('Failed to exchange OAuth code for session', {
                    error: error.message,
                    code_length: code.length,
                    ip: req.ip
                });
                
                throw error;
            }

            logger.info('OAuth code exchanged for session successfully', {
                userId: data.user.id,
                email: data.user.email,
                ip: req.ip
            });

            res.status(200).json({
                success: true,
                message: 'Session created successfully',
                data: {
                    user: data.user,
                    session: data.session ? {
                        access_token: data.session.access_token,
                        refresh_token: data.session.refresh_token,
                        expires_at: data.session.expires_at,
                    } : null,
                }
            });
        } catch (error) {
            logger.error('Exchange code for session error', {
                error: error.message,
                ip: req.ip
            });

            res.status(500).json({
                error: 'Failed to exchange code for session',
                message: error.message || 'An error occurred during code exchange'
            });
        }
    }
}

module.exports = AuthController;