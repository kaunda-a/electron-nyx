import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication...');
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuthStore((state) => state.auth.setUser);

  useEffect(() => {
    console.log('[Renderer] OAuthCallback component mounted.');

    const handleSetSession = async (accessToken: string, refreshToken: string) => {
      console.log('[Renderer] Calling supabase.auth.setSession().');
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[Renderer] Error in setSession:', error);
        throw error;
      }

      console.log('[Renderer] setSession successful. Calling getUser().');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('[Renderer] getUser() returned no user.');
        throw new Error('Could not retrieve user information after setting session.');
      }
      
      console.log('[Renderer] Successfully retrieved user:', user.email);
      setUser(user);
      toast({ title: 'Signed in successfully', description: 'Welcome back!' });
      navigate({ to: '/admin/dashboard', replace: true });
    };

    const handleOAuthData = (data: any) => {
      console.log('[Renderer] Received oauth-callback data:', data);
      if (data.access_token && data.refresh_token) {
        setStatus('Finalizing session...');
        handleSetSession(data.access_token, data.refresh_token).catch((e) => {
          console.error('[Renderer] OAuth Error in handleSetSession:', e);
          setError(e.message || 'An unknown error occurred.');
          setStatus('Authentication failed.');
        });
      } else if (data.error) {
        console.error('[Renderer] OAuth Error from callback data:', data.error, data.error_description);
        setError(data.error_description || data.error);
        setStatus('Authentication failed.');
      } else {
        console.error('[Renderer] Invalid authentication data received.', data);
        setError('Invalid authentication data received.');
        setStatus('Authentication failed.');
      }
    };

    console.log('[Renderer] Attaching IPC listener for "oauth-callback".');
    // The preload script exposes an 'on' function that returns an 'unsubscribe' function.
    // @ts-ignore
    const unsubscribe = window.api.on('oauth-callback', (_, data) => {
      handleOAuthData(data);
    });

    // Timeout to prevent getting stuck indefinitely
    const timeoutId = setTimeout(() => {
        if (status === 'Processing authentication...') {
            console.error('[Renderer] Authentication timed out.');
            setError('Authentication timed out. Please try again.');
            setStatus('Authentication failed.');
        }
    }, 30000); // 30 seconds

    return () => {
      console.log('[Renderer] Cleaning up IPC listener for "oauth-callback".');
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate, setUser, status]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-destructive">Authentication Error</h2>
          <p className="mt-2">{error}</p>
          <button 
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            onClick={() => navigate({ to: '/auth/sign-in' })}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        <p className="mt-4 text-lg">{status}</p>
        <p className="text-sm text-muted-foreground mt-2">Please complete the sign-in process in your browser.</p>
      </div>
    </div>
  );
}