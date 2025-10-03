import { toast } from '@/hooks/use-toast';

/**
 * SQLite Profiles API client for interacting with the main process via IPC
 */

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  throw new Error('IPC API not available. Make sure the preload script is properly configured.');
};

export const sqliteProfilesApi = {
  /**
   * Get a list of all profiles from SQLite
   */
  list: async (): Promise<any[]> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.profiles.getAll();
      return result;
    } catch (error) {
      console.error('Failed to fetch profiles from SQLite:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to fetch profiles',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Get a specific profile by ID from SQLite
   */
  get: async (profileId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.profiles.getById(profileId);
      return result;
    } catch (error) {
      console.error(`Failed to fetch profile ${profileId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to fetch profile ${profileId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Save a profile to SQLite
   */
  save: async (profileId: string, profileData: any): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.profiles.update(profileId, profileData);
      return result;
    } catch (error) {
      console.error(`Failed to save profile ${profileId} to SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to save profile ${profileId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Delete a profile from SQLite
   */
  delete: async (profileId: string): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.profiles.delete(profileId);
      toast({
        title: 'Profile deleted',
        description: `Profile ${profileId} has been deleted from local storage.`,
      });
      return result;
    } catch (error) {
      console.error(`Failed to delete profile ${profileId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to delete profile ${profileId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Get profile statistics from SQLite
   */
  getStats: async (profileId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.profiles.getStats(profileId);
      return result;
    } catch (error) {
      console.error(`Failed to get profile stats ${profileId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to get profile stats ${profileId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },
};