const logger = require('../../../shared/utils/logger');

/**
 * IPC Authentication Middleware
 * Works with existing Supabase authentication via IPC
 */

/**
 * Validate authentication token from IPC-based auth system
 * This middleware checks for valid authentication tokens
 */
async function validateIPCAuth(req, res, next) {
    try {
        // Check for Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            logger.debug('No authorization header provided', {
                url: req.url,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(401).json({
                error: 'Authentication required',
                message: 'No authorization header provided'
            });
        }

        // Extract token from Bearer header
        const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
        
        if (!token) {
            logger.warn('Invalid authorization header format', {
                url: req.url,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(401).json({
                error: 'Invalid authorization header',
                message: 'Authorization header must be in Bearer token format'
            });
        }

        // For IPC-based auth, we'll treat the token as a session token
        // Validate with real Supabase authentication
        const isValidToken = await validateSessionToken(token);
        
        if (!isValidToken) {
            logger.warn('Invalid session token provided', {
                url: req.url,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(401).json({
                error: 'Invalid session token',
                message: 'Provided session token is invalid or has expired'
            });
        }
        
        // Get user information from Supabase
        const supabaseConfig = require('../../../shared/config/supabase');
        const supabase = await supabaseConfig.initialize();
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        
        if (userError || !userData || !userData.user) {
            logger.error('Failed to get user data from Supabase', {
                error: userError?.message,
                url: req.url,
                method: req.method,
                ip: req.ip
            });
            
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'Failed to retrieve user information'
            });
        }
        
        // Get user profile information
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userData.user.id)
            .maybeSingle();
        
        // Attach user information to request
        req.user = {
            id: userData.user.id,
            email: userData.user.email,
            role: profileData?.role || 'user',
            plan: profileData?.plan_tier || 'free',  // Include plan information
            createdAt: userData.user.created_at,
            lastSignIn: userData.user.last_sign_in_at
        };
        
        logger.debug('IPC authentication successful', {
            userId: req.user.id,
            email: req.user.email,
            plan: req.user.plan,
            url: req.url,
            method: req.method,
            ip: req.ip
        });

        next();
    } catch (error) {
        logger.error('IPC authentication middleware error', {
            error: error.message,
            url: req.url,
            method: req.method,
            ip: req.ip
        });

        return res.status(500).json({
            error: 'Authentication error',
            message: 'An error occurred during authentication'
        });
    }
}

/**
 * Optional authentication - validate token if present
 */
async function optionalIPCAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader) {
            const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
            
            if (token) {
                const isValidToken = await validateSessionToken(token);
                
                if (isValidToken) {
                    // Get user information from Supabase
                    const supabaseConfig = require('../../../shared/config/supabase');
                    const supabase = await supabaseConfig.initialize();
                    const { data: userData, error: userError } = await supabase.auth.getUser(token);
                    
                    if (!userError && userData && userData.user) {
                        // Get user profile information
                        const { data: profileData, error: profileError } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('user_id', userData.user.id)
                            .maybeSingle();
                        
                        // Attach user information to request
                        req.user = {
                            id: userData.user.id,
                            email: userData.user.email,
                            role: profileData?.role || 'user',
                            plan: profileData?.plan_tier || 'free',  // Include plan information
                            createdAt: userData.user.created_at,
                            lastSignIn: userData.user.last_sign_in_at
                        };
                        
                        logger.debug('Optional IPC authentication successful', {
                            userId: req.user.id,
                            email: req.user.email,
                            plan: req.user.plan,
                            url: req.url,
                            method: req.method,
                            ip: req.ip
                        });
                    }
                }
            }
        }
        
        next();
    } catch (error) {
        logger.warn('Optional IPC authentication error', {
            error: error.message,
            url: req.url,
            method: req.method,
            ip: req.ip
        });
        
        next();
    }
}

/**
 * Validate session token with real Supabase authentication
 * @param {string} token - Session token to validate
 * @returns {boolean} True if valid
 */
async function validateSessionToken(token) {
    try {
        // Import Supabase configuration
        const supabaseConfig = require('../../../shared/config/supabase');
        
        // Initialize Supabase client
        const supabase = await supabaseConfig.initialize();
        
        // Validate the token with Supabase
        const { data, error } = await supabase.auth.getUser(token);
        
        if (error) {
            logger.warn('Session token validation failed with Supabase', {
                error: error.message
            });
            return false;
        }
        
        if (!data || !data.user) {
            logger.warn('No user data returned from Supabase token validation');
            return false;
        }
        
        // Token is valid if we got user data
        logger.debug('Session token validated successfully with Supabase', {
            userId: data.user.id,
            email: data.user.email
        });
        
        return true;
    } catch (error) {
        logger.error('Session token validation error with Supabase', {
            error: error.message
        });
        return false;
    }
}

/**
 * Require specific role for route (works with IPC auth)
 * @param {string} requiredRole - Required role
 */
function requireIPCRole(requiredRole) {
    return function(req, res, next) {
        try {
            if (!req.user) {
                logger.warn('Role check required but no user authenticated', {
                    requiredRole: requiredRole,
                    url: req.url,
                    method: req.method
                });

                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'You must be authenticated to access this resource'
                });
            }

            const userRole = req.user.role || 'user';
            if (userRole !== requiredRole && userRole !== 'admin') {
                logger.warn('Insufficient permissions for user', {
                    userId: req.user.id,
                    userRole: userRole,
                    requiredRole: requiredRole,
                    url: req.url,
                    method: req.method
                });

                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: 'You do not have permission to access this resource'
                });
            }

            logger.debug('Role check passed', {
                userId: req.user.id,
                userRole: userRole,
                requiredRole: requiredRole,
                url: req.url,
                method: req.method
            });

            next();
        } catch (error) {
            logger.error('Role check middleware error', {
                error: error.message,
                url: req.url,
                method: req.method
            });

            return res.status(500).json({
                error: 'Permission check error',
                message: 'An error occurred during permission check'
            });
        }
    };
}

module.exports = {
    validateIPCAuth,
    optionalIPCAuth,
    requireIPCRole
};