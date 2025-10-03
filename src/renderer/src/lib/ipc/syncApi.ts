import { toast } from '@/hooks/use-toast';

/**
 * Sync API client for synchronizing data between SQLite and Supabase
 */

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  throw new Error('IPC API not available. Make sure the preload script is properly configured.');
};

export const syncApi = {
  /**
   * Sync campaigns between SQLite and Supabase
   */
  syncCampaigns: async (userId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      // Assuming sync functionality is available via a server API
      const result = await ipc.server.syncCampaigns ? 
        await ipc.server.syncCampaigns(userId) : 
        { error: 'Sync functionality not implemented' };
      if (!result.error) {
        toast({
          title: 'Campaign sync completed',
          description: 'Campaign data synchronized successfully.',
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to sync campaigns:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to sync campaigns',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Sync profiles between SQLite and Supabase
   */
  syncProfiles: async (userId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      // Assuming sync functionality is available via a server API
      const result = await ipc.server.syncProfiles ? 
        await ipc.server.syncProfiles(userId) : 
        { error: 'Sync functionality not implemented' };
      if (!result.error) {
        toast({
          title: 'Profile sync completed',
          description: 'Profile data synchronized successfully.',
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to sync profiles:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to sync profiles',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Sync proxies between SQLite and Supabase
   */
  syncProxies: async (userId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      // Assuming sync functionality is available via a server API
      const result = await ipc.server.syncProxies ? 
        await ipc.server.syncProxies(userId) : 
        { error: 'Sync functionality not implemented' };
      if (!result.error) {
        toast({
          title: 'Proxy sync completed',
          description: 'Proxy data synchronized successfully.',
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to sync proxies:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to sync proxies',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Sync all data between SQLite and Supabase
   */
  syncAll: async (userId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      // Assuming sync functionality is available via a server API
      const result = await ipc.server.syncAll ? 
        await ipc.server.syncAll(userId) : 
        { error: 'Sync functionality not implemented' };
      if (!result.error) {
        toast({
          title: 'Full sync completed',
          description: 'All data synchronized successfully.',
        });
      }
      return result;
    } catch (error) {
      console.error('Failed to sync all data:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to sync all data',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Get sync status
   */
  getSyncStatus: async (userId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      // Assuming sync functionality is available via a server API
      const result = await ipc.server.getSyncStatus ? 
        await ipc.server.getSyncStatus(userId) : 
        { error: 'Sync functionality not implemented', status: 'unknown' };
      return result;
    } catch (error) {
      console.error('Failed to get sync status:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to get sync status',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },
};