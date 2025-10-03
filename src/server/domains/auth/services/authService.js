const supabaseConfig = require('../../../shared/config/supabase');
const logger = require('../../../shared/utils/logger');

/**
 * Authentication Service
 * Handles Google OAuth authentication with Supabase
 */
class AuthService {
    /**
     * Initiate Google OAuth flow with Supabase
     * @returns {Object} OAuth URL and provider-specific data
     */
    async initiateGoogleOAuth(redirectTo = '/auth/callback') {
        try {
            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();
            
            // Sign in with Google OAuth
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${process.env.APP_URL || 'http://localhost:5173'}${redirectTo}`,
                },
            });

            if (error) {
                logger.error('Failed to initiate Google OAuth with Supabase', {
                    error: error.message
                });
                throw error;
            }

            return data;
        } catch (error) {
            logger.error('Error initiating Google OAuth', {
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Handle OAuth callback and retrieve user session
     * @param {string} code - OAuth code from callback
     * @returns {Object} User session data
     */
    async handleOAuthCallback(code) {
        try {
            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();
            
            // Exchange the OAuth code for a session
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                logger.error('Failed to exchange OAuth code for session', {
                    error: error.message,
                    code
                });
                throw error;
            }

            const userData = data.user;
            
            // Get or create user profile from Supabase database
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userData.id)
                .single();

            let user = null;
            if (profileError) {
                // Create a default user record for the OAuth user
                const defaultUser = {
                    id: userData.id,
                    email: userData.email,
                    full_name: userData.user_metadata.full_name || userData.user_metadata.name || userData.user_metadata.given_name,
                    avatar_url: userData.user_metadata.avatar_url || userData.user_metadata.picture,
                    first_name: userData.user_metadata.given_name || '',
                    last_name: userData.user_metadata.family_name || '',
                    status: 'active',
                    last_sign_in_at: new Date().toISOString(),
                    confirmed_at: new Date().toISOString(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    metadata: JSON.stringify({ provider: 'google' })
                };

                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([defaultUser])
                    .select()
                    .single();

                if (!createError) {
                    user = newUser;
                }
            } else {
                // Update existing user if needed
                const updatedUser = {
                    email: userData.email,
                    full_name: userData.user_metadata.full_name || userData.user_metadata.name || userData.user_metadata.given_name,
                    avatar_url: userData.user_metadata.avatar_url || userData.user_metadata.picture,
                    last_sign_in_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                
                await supabase
                    .from('users')
                    .update(updatedUser)
                    .eq('id', userData.id);
                    
                user = profileData;
            }

            logger.info('OAuth callback handled successfully', {
                userId: userData.id,
                email: userData.email,
                provider: 'google'
            });

            // Return user object with user information
            return {
                user: {
                    id: userData.id,
                    email: userData.email,
                    full_name: userData.user_metadata.full_name || userData.user_metadata.name || userData.user_metadata.given_name,
                    avatar_url: userData.user_metadata.avatar_url || userData.user_metadata.picture,
                    status: user?.status || 'active',
                    lastSignIn: userData.last_sign_in_at,
                    provider: 'google'
                },
                session: data.session
            };
        } catch (error) {
            logger.error('Error handling OAuth callback', {
                error: error.message,
                code
            });
            throw error;
        }
    }

    /**
     * Get user by ID with real Supabase lookup
     * @param {string} userId - User ID
     * @returns {Object} User object
     */
    async getUserById(userId) {
        try {
            // Initialize Supabase client
            const supabase = await supabaseConfig.initialize();
            
            // Get user from Supabase Auth
            const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);

            if (authError) {
                logger.error('Failed to get user from Supabase Auth', {
                    error: authError.message,
                    userId: userId
                });
                return null;
            }

            // Get user data from Supabase database
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            logger.debug('User fetched by ID from Supabase', {
                userId: authUser.user.id,
                email: authUser.user.email
            });

            // Return user object with user information
            return {
                id: authUser.user.id,
                email: authUser.user.email,
                full_name: authUser.user.user_metadata.full_name || authUser.user.user_metadata.name || authUser.user.user_metadata.given_name,
                avatar_url: authUser.user.user_metadata.avatar_url || authUser.user.user_metadata.picture,
                status: userData?.status || 'active',
                createdAt: authUser.user.created_at,
                lastSignIn: authUser.user.last_sign_in_at,
                provider: authUser.user.app_metadata?.provider || 'google'
            };
        } catch (error) {
            logger.error('Failed to fetch user by ID from Supabase', {
                error: error.message,
                userId: userId
            });
            return null;
        }
    }
}

// Export singleton instance
module.exports = new AuthService();