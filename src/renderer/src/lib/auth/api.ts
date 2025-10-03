import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  // Don't throw an error, just return null so we can handle it gracefully
  return null;
};

import { 
  AuthResponse, 
  UserProfile 
} from './types';

/**
 * Authentication API client
 * Supports both direct Supabase calls and IPC communication
 * Google OAuth only
 */
export const authApi = {
  /**
   * Sign in with Google OAuth using system browser
   * Opens the default browser for authentication and handles the callback
   */
  signInWithGoogle: async (useIpc = true, redirectTo = '/admin'): Promise<AuthResponse> => {
    // Check if IPC is available when useIpc is true
    const isIpcAvailable = useIpc && getIpcRenderer() !== null;
    
    if (isIpcAvailable) {
      try {
        const ipc = getIpcRenderer();
        const result = await ipc.auth.signInWithGoogle(redirectTo);
        return result;
      } catch (error) {
        console.error('Google sign in error (IPC):', error);
        toast({
          variant: 'destructive',
          title: 'Google sign in failed',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
        });
        return {
          user: null,
          session: null,
          error: error instanceof Error ? error.message : 'Failed to sign in with Google',
        };
      }
    }
    
    try {
      // For Electron desktop apps, we need to handle OAuth differently
      // Use Supabase OAuth with a custom flow that handles the redirect
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'electron-nyx://oauth/callback', // Use custom protocol for desktop app
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        throw error;
      }

      // Open the OAuth URL in the system browser
      if (data?.url) {
        const ipc = getIpcRenderer();
        if (ipc) {
          // Use IPC to open URL in default browser
          try {
            const result = await ipc.utils.openExternal(data.url);
            if (!result.success) {
              throw new Error(result.error || 'Failed to open browser');
            }
          } catch (ipcError) {
            console.error('IPC error opening browser:', ipcError);
            // Fallback to shell.openExternal simulation if IPC fails
            // In a real renderer context, we can't directly open URLs, so we'll need to use a different approach
            // This is why using IPC from the main process is preferred
            console.warn('Falling back to window.open, which may not work for OAuth in Electron');
            window.open(data.url, '_blank', 'noreferrer');
          }
        } else {
          // This shouldn't happen in a proper Electron setup, but just in case
          console.warn('IPC not available in renderer - OAuth flow may not work properly');
          window.open(data.url, '_blank', 'noreferrer');
        }
      }

      // Return a pending state - user will be redirected back via callback
      // The actual user/session will be handled when the OAuth callback returns
      return {
        user: null, // Will be set after successful callback
        session: null,
        error: null,
      };
    } catch (error: any) {
      console.error('Google sign in error:', error.message);
      return {
        user: null,
        session: null,
        error: error.message || 'Failed to sign in with Google',
      };
    }
  },

  /**
   * Exchange authorization code for session
   */
  exchangeCodeForSession: async (code: string, useIpc = false): Promise<AuthResponse> => {
    // Check if IPC is available when useIpc is true
    const isIpcAvailable = useIpc && getIpcRenderer() !== null;
    
    if (isIpcAvailable) {
      try {
        const ipc = getIpcRenderer();
        const result = await ipc.auth.exchangeCodeForSession({ code });
        return result;
      } catch (error) {
        console.error('Exchange code error (IPC):', error);
        return {
          user: null,
          session: null,
          error: error instanceof Error ? error.message : 'Failed to exchange code for session',
        };
      }
    }

    try {
      // Use Supabase to exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        throw error;
      }

      return {
        user: data.user,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : null,
      };
    } catch (error: any) {
      console.error('Exchange code error:', error.message);
      return {
        user: null,
        session: null,
        error: error.message || 'Failed to exchange code for session',
      };
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async (useIpc = false): Promise<{ success: boolean; error?: string }> => {
    // Check if IPC is available when useIpc is true
    const isIpcAvailable = useIpc && getIpcRenderer() !== null;
    
    if (isIpcAvailable) {
      try {
        const ipc = getIpcRenderer();
        const result = await ipc.auth.signOut();
        if (result.success) {
          toast({
            title: 'Signed out',
            description: 'You have been successfully signed out.',
          });
        }
        return result;
      } catch (error) {
        console.error('Sign out error (IPC):', error);
        toast({
          variant: 'destructive',
          title: 'Sign out failed',
          description: error instanceof Error ? error.message : 'An unknown error occurred',
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to sign out',
        };
      }
    }
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to sign out',
      };
    }
  },

  /**
   * Get the current session
   */
  getSession: async (useIpc = false): Promise<AuthResponse> => {
    // Check if IPC is available when useIpc is true
    const isIpcAvailable = useIpc && getIpcRenderer() !== null;
    
    if (isIpcAvailable) {
      try {
        const ipc = getIpcRenderer();
        const result = await ipc.auth.getSession();
        return result;
      } catch (error) {
        console.error('Get session error (IPC):', error);
        return {
          user: null,
          session: null,
          error: error instanceof Error ? error.message : 'Failed to get session',
        };
      }
    }
    
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }

      return {
        user: data.session?.user || null,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : null,
      };
    } catch (error: any) {
      console.error('Get session error:', error.message);
      return {
        user: null,
        session: null,
        error: error.message || 'Failed to get session',
      };
    }
  },

  /**
   * Get the current user's profile
   */
  getUserProfile: async (): Promise<UserProfile | null> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        return null;
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.session.user.id)
        .single();

      if (error) {
        throw error;
      }

      return data as UserProfile;
    } catch (error: any) {
      console.error('Get user profile error:', error.message);
      return null;
    }
  },

  /**
   * Update the user's profile
   */
  updateUserProfile: async (profile: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('users')
        .update(profile)
        .eq('id', session.session.user.id);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error: any) {
      console.error('Update user profile error:', error.message);
      return {
        success: false,
        error: error.message || 'Failed to update profile',
      };
    }
  },

  
};