import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { authApi } from './api';
import { supabase } from '../supabase';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  useIpc: boolean; // Configuration for whether to use IPC
}

interface AuthActions {
  signInWithGoogle: (useIpc?: boolean, redirectTo?: string) => Promise<void>;
  exchangeCodeForSession: (code: string, useIpc?: boolean) => Promise<void>;
  signOut: (useIpc?: boolean) => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearError: () => void;
  setUseIpc: (useIpc: boolean) => void; // Method to toggle IPC usage
  reset: () => void; // Add reset function
  setUser: (user: User | null) => void; // Add setUser function to directly set user
}

interface AuthStore {
  auth: AuthState & AuthActions;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  // Check if we're running in an Electron environment with proper API available
  const isElectron = typeof window !== 'undefined' && (window as any).api && typeof (window as any).api.auth !== 'undefined';

  const initialState = {
    user: null,
    isLoading: false,
    error: null,
    useIpc: isElectron, // Use IPC by default if running in Electron with proper API
  };

  return {
    auth: {
      ...initialState,
      signInWithGoogle: async (useIpc, redirectTo = '/admin') => {
        // Check if a specific useIpc value was provided, otherwise use the store value
        let shouldUseIpc = get().auth.useIpc;
        if (useIpc !== undefined) {
          shouldUseIpc = useIpc;
        }
        
        // Check if IPC is actually available before using it
        const isIpcAvailable = typeof window !== 'undefined' && (window as any).api && typeof (window as any).api.auth !== 'undefined';
        if (!isIpcAvailable) {
          shouldUseIpc = false; // Force fallback to non-IPC method
        }
        
        set({ auth: { ...get().auth, isLoading: true, error: null } });
        try {
          const response = await authApi.signInWithGoogle(shouldUseIpc, redirectTo);
          if (response.error) {
            throw new Error(response.error);
          }
          // For OAuth, we set isLoading to false but don't update user yet
          // The user will be handled after returning from the OAuth provider
          set({ auth: { ...get().auth, isLoading: false } });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Sign in with Google failed';
          set({ auth: { ...get().auth, error: errorMessage, isLoading: false } });
          throw new Error(errorMessage);
        }
      },
      exchangeCodeForSession: async (code, useIpc) => {
        const shouldUseIpc = useIpc !== undefined ? useIpc : get().auth.useIpc;
        set({ auth: { ...get().auth, isLoading: true, error: null } });
        try {
          const response = await authApi.exchangeCodeForSession(code, shouldUseIpc);
          if (response.error) {
            throw new Error(response.error);
          }
          
          // Update the user in the store
          set({ auth: { ...get().auth, user: response.user, isLoading: false } });
          
          // Update the Supabase session if needed
          if (response.session) {
            // The session is already handled by Supabase automatically
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to exchange code for session';
          set({ auth: { ...get().auth, error: errorMessage, isLoading: false } });
          throw new Error(errorMessage);
        }
      },
      signOut: async (useIpc) => {
        const shouldUseIpc = useIpc !== undefined ? useIpc : get().auth.useIpc;
        set({ auth: { ...get().auth, isLoading: true } });
        try {
          if (shouldUseIpc) {
            await authApi.signOut(shouldUseIpc);
          } else {
            await supabase.auth.signOut();
          }
          set({ auth: { ...get().auth, user: null, isLoading: false } });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Sign out failed';
          set({ auth: { ...get().auth, error: errorMessage, isLoading: false } });
          throw new Error(errorMessage);
        }
      },
      initializeAuth: async () => {
        set({ auth: { ...get().auth, isLoading: true } });
        try {
          const response = await authApi.getSession(get().auth.useIpc);
          set({ auth: { ...get().auth, user: response.session?.user || null, isLoading: false } });
        } catch (error) {
          set({ auth: { ...get().auth, user: null, isLoading: false } });
          // Don't set error here since it's expected that users might not be logged in
        }
      },
      clearError: () => set({ auth: { ...get().auth, error: null } }),
      setUseIpc: (useIpc) => set({ auth: { ...get().auth, useIpc } }),
      updateIpcAvailability: () => {
        const isIpcAvailable = typeof window !== 'undefined' && (window as any).api && typeof (window as any).api.auth !== 'undefined';
        if (isIpcAvailable !== get().auth.useIpc) {
          set({ auth: { ...get().auth, useIpc: isIpcAvailable } });
        }
      },
      reset: () => set({ auth: { ...initialState, signInWithGoogle: get().auth.signInWithGoogle, signOut: get().auth.signOut, initializeAuth: get().auth.initializeAuth, clearError: get().auth.clearError, setUseIpc: get().auth.setUseIpc, reset: get().auth.reset, setUser: get().auth.setUser } }),
      setUser: (user) => set({ auth: { ...get().auth, user } }),
    }
  };
});

// Selector hooks for common auth state access
export const useAuthUser = () => useAuthStore((state) => state.auth.user);
export const useAuthIsLoading = () => useAuthStore((state) => state.auth.isLoading);
export const useAuthError = () => useAuthStore((state) => state.auth.error);
export const useAuthInitialized = () => useAuthStore((state) => state.auth.user !== undefined);