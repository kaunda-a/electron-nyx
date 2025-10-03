import { toast } from '@/hooks/use-toast';

/**
 * SQLite Proxies API client for interacting with the main process via IPC
 */

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  throw new Error('IPC API not available. Make sure the preload script is properly configured.');
};

export const sqliteProxiesApi = {
  /**
   * Get a list of all proxies from SQLite
   */
  list: async (filters?: any): Promise<any[]> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.proxies.getAll(filters);
      return result;
    } catch (error) {
      console.error('Failed to fetch proxies from SQLite:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to fetch proxies',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Get a specific proxy by ID from SQLite
   */
  get: async (proxyId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.proxies.getById(proxyId);
      return result;
    } catch (error) {
      console.error(`Failed to fetch proxy ${proxyId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to fetch proxy ${proxyId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Save a proxy to SQLite
   */
  save: async (proxyId: string, proxyData: any): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.proxies.update(proxyId, proxyData);
      return result;
    } catch (error) {
      console.error(`Failed to save proxy ${proxyId} to SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to save proxy ${proxyId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Delete a proxy from SQLite
   */
  delete: async (proxyId: string): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.proxies.delete(proxyId);
      toast({
        title: 'Proxy deleted',
        description: `Proxy ${proxyId} has been deleted from local storage.`,
      });
      return result;
    } catch (error) {
      console.error(`Failed to delete proxy ${proxyId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to delete proxy ${proxyId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Save proxy test result to SQLite
   */
  saveTestResult: async (proxyId: string, testId: string, testData: any): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      // Update proxy with test data
      const proxyData = await ipc.proxies.getById(proxyId);
      const updatedProxyData = { ...proxyData, testResults: { ...proxyData.testResults, [testId]: testData } };
      const result = await ipc.proxies.update(proxyId, updatedProxyData);
      return result;
    } catch (error) {
      console.error(`Failed to save proxy test result for proxy ${proxyId} to SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to save proxy test result for ${proxyId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Get proxy statistics from SQLite
   */
  getStats: async (proxyId: string): Promise<any> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.proxies.check(proxyId);
      return result;
    } catch (error) {
      console.error(`Failed to get proxy stats ${proxyId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to get proxy stats ${proxyId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Update proxy status in SQLite
   */
  updateStatus: async (proxyId: string, statusData: any): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const proxyData = await ipc.proxies.getById(proxyId);
      const updatedProxyData = { ...proxyData, ...statusData };
      const result = await ipc.proxies.update(proxyId, updatedProxyData);
      return result;
    } catch (error) {
      console.error(`Failed to update proxy status for proxy ${proxyId} in SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to update proxy status for ${proxyId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },
};