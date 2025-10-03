import { useEffect, useState } from 'react';

interface OAuthCallbackData {
  code?: string;
  error?: string;
  state?: string;
}

// Custom hook to handle OAuth callbacks from the main process
export const useOAuthCallback = () => {
  const [callbackData, setCallbackData] = useState<OAuthCallbackData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if we're in the browser environment (not server-side)
    if (typeof window !== 'undefined' && (window as any).api) {
      const handleOAuthSuccess = (_, data: OAuthCallbackData) => {
        setCallbackData(data);
      };

      const handleOAuthError = (_, data: OAuthCallbackData) => {
        setCallbackData(data);
      };

      // Add event listeners
      const ipc = (window as any).api;
      ipc?.on && ipc.on('oauth-success', handleOAuthSuccess);
      ipc?.on && ipc.on('oauth-error', handleOAuthError);

      // Clean up event listeners on unmount
      return () => {
        ipc?.removeListener && ipc.removeListener('oauth-success', handleOAuthSuccess);
        ipc?.removeListener && ipc.removeListener('oauth-error', handleOAuthError);
      };
    }
  }, []);

  return { callbackData, isLoading };
};