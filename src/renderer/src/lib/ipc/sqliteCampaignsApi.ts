import { toast } from '@/hooks/use-toast';

/**
 * SQLite Campaigns API client for interacting with the main process via IPC
 */

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  throw new Error('IPC API not available. Make sure the preload script is properly configured.');
};

export const sqliteCampaignsApi = {
  /**
   * Get a list of all campaigns from SQLite
   */
  list: async (): Promise<any[]> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.campaigns.getAll();
      return result;
    } catch (error) {
      console.error('Failed to fetch campaigns from SQLite:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to fetch campaigns',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Get a specific campaign by ID from SQLite
   */
  get: async (campaignId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.campaigns.getById(campaignId);
      return result;
    } catch (error) {
      console.error(`Failed to fetch campaign ${campaignId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to fetch campaign ${campaignId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Save a campaign to SQLite
   */
  save: async (campaignId: string, campaignData: any): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.campaigns.update(campaignId, campaignData);
      return result;
    } catch (error) {
      console.error(`Failed to save campaign ${campaignId} to SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to save campaign ${campaignId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Delete a campaign from SQLite
   */
  delete: async (campaignId: string): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.campaigns.delete(campaignId);
      toast({
        title: 'Campaign deleted',
        description: `Campaign ${campaignId} has been deleted from local storage.`,
      });
      return result;
    } catch (error) {
      console.error(`Failed to delete campaign ${campaignId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to delete campaign ${campaignId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Get campaign statistics from SQLite
   */
  getStats: async (campaignId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.campaigns.getStats(campaignId);
      return result;
    } catch (error) {
      console.error(`Failed to get campaign stats ${campaignId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to get campaign stats ${campaignId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },
};