import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '@/lib/auth/store';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

function AuthCallbackComponent() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.auth.setUser);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get URL hash and parse parameters
        const hash = window.location.hash.substring(1); // Remove the '#'
        const params = new URLSearchParams(hash);
        
        // Check if this is a signup confirmation
        if (params.get('type') === 'signup') {
          toast({
            title: 'Account confirmed!',
            description: 'Your account has been confirmed. You can now sign in.',
          });
          navigate({ to: '/sign-in' });
          return;
        }
        
        // Check for session data in URL parameters
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const expiresAt = params.get('expires_at');
        
        if (accessToken) {
          // Attempt to set the session with Supabase
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (error) {
            throw error;
          }
          
          // Set user in our auth store
          if (data?.user) {
            setUser(data.user);
            toast({
              title: 'Signed in successfully!',
              description: 'Welcome back!',
            });
            navigate({ to: '/' });
            return;
          }
        }
        
        // If no session was processed, redirect to sign-in
        navigate({ to: '/sign-in' });
      } catch (error) {
        console.error('Auth callback error:', error);
        toast({
          variant: 'destructive',
          title: 'Authentication error',
          description: 'Failed to process authentication callback. Please try again.',
        });
        navigate({ to: '/sign-in' });
      }
    };

    handleAuthCallback();
  }, [navigate, setUser]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4"></div>
        <p>Processing authentication...</p>
      </div>
    </div>
  );
}

import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/(auth)/callback')({
  component: AuthCallbackComponent,
})