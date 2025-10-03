
import type {
  ProxyConfig,
  CreateProxy,
  UpdateProxy,
  ProxyStats
} from '../data/schema'
import { sqliteProxiesApi } from '@/lib/ipc/sqliteProxiesApi';

export interface BatchProxyCreateResponse {
  imported: number;
  errors: number;
}

export const proxiesApi = {
  /**
   * Get a list of proxies
   */
  list: async (useDatabaseStorage = false): Promise<ProxyConfig[]> => {
    try {
      if (useDatabaseStorage) {
        // Get proxies from SQLite
        const sqliteProxies = await sqliteProxiesApi.list();
        
        // Also get from main process and merge
        try {
          let mainProcessProxies = [];
          if (typeof window !== 'undefined' && window.api && window.api.proxies) {
            mainProcessProxies = await window.api.proxies.getAll();
          } else {
            console.warn('window.api.proxies.getAll is not available');
            mainProcessProxies = [];
          }
          
          // Merge SQLite and main process proxies (prefer main process data if conflict)
          const allProxies = [...mainProcessProxies];
          for (const sqliteProxy of sqliteProxies) {
            const existingIndex = allProxies.findIndex(p => p.id === sqliteProxy.id);
            if (existingIndex === -1) {
              allProxies.push(sqliteProxy);
            }
          }
          
          return allProxies;
        } catch (mainProcessError) {
          console.warn('Failed to fetch proxies from main process, using SQLite data:', mainProcessError);
          // Use SQLite data as fallback
          return sqliteProxies;
        }
      } else {
        // Check if window.api.proxies exists before calling getAll
        if (typeof window !== 'undefined' && window.api && window.api.proxies) {
          return await window.api.proxies.getAll();
        } else {
          console.warn('window.api.proxies is not available');
          return [];
        }
      }
    } catch (error) {
      console.error('Failed to fetch proxies:', error);
      // Make sure we return an empty array even if there's an error
      return [];
    }
  },

  get: async (id: string, useDatabaseStorage = false) => {
    try {
      if (useDatabaseStorage) {
        // Try SQLite first
        let proxy = await sqliteProxiesApi.get(id);
        
        if (proxy) {
          return proxy;
        }
        
        // Fallback to main process with safety check
        if (typeof window !== 'undefined' && window.api && window.api.proxies) {
          return await window.api.proxies.getById(id)
        } else {
          console.warn('window.api.proxies.getById is not available');
          throw new Error('IPC API not available');
        }
      }
      // Direct main process call with safety check
      if (typeof window !== 'undefined' && window.api && window.api.proxies) {
        return await window.api.proxies.getById(id)
      } else {
        console.warn('window.api.proxies.getById is not available');
        throw new Error('IPC API not available');
      }
    } catch (error) {
      console.error('Failed to get proxy:', error);
      throw error;
    }
  },

  create: async (data: CreateProxy, useDatabaseStorage = false) => {
    if (useDatabaseStorage) {
      // Create via SQLite
      const proxyId = data.id || `proxy_${Date.now()}`;
      const proxyWithId = { ...data, id: proxyId };
      await sqliteProxiesApi.save(proxyId, proxyWithId);
      return proxyWithId;
    }
    // Safety check before calling create
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.create(data)
    } else {
      console.warn('window.api.proxies.create is not available');
      throw new Error('IPC API not available');
    }
  },

  update: async (id: string, data: UpdateProxy) => {
    // The server doesn't have a direct update endpoint
    // For now, we'll throw an error as this functionality isn't directly supported
    throw new Error('Proxy update not supported directly. Modify via import.')
  },

  delete: async (id: string, useDatabaseStorage = false) => {
    if (useDatabaseStorage) {
      // Delete from main process and SQLite with safety checks
      try {
        if (typeof window !== 'undefined' && window.api && window.api.proxies) {
          await window.api.proxies.delete(id)
        } else {
          console.warn('window.api.proxies.delete is not available');
        }
        await sqliteProxiesApi.delete(id)
        return { success: true }
      } catch (error) {
        console.error('Failed to delete proxy:', error);
        throw error;
      }
    }
    // Direct main process call with safety check
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.delete(id)
    } else {
      console.warn('window.api.proxies.delete is not available');
      throw new Error('IPC API not available');
    }
  },

  stats: async () => {
    // Safety check before calling getStats
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.getStats()
    } else {
      console.warn('window.api.proxies.getStats is not available');
      // Return default stats
      return {
        total: 0,
        active: 0,
        inactive: 0,
        error: 0,
        rotating: 0,
        countries: 0,
        protocols: {}
      }
    }
  },

  createBatch: async (proxies: CreateProxy[]): Promise<BatchProxyCreateResponse> => {
    try {
      // Safety check before calling batchCreate
      if (typeof window !== 'undefined' && window.api && window.api.proxies) {
        const response = await window.api.proxies.batchCreate(proxies);
        console.log('Raw batch create response:', response);
        
        // Handle the actual response structure from the server
        // Server returns: {success, message, imported, errors, details}
        if (response && response.imported !== undefined) {
          return {
            imported: response.imported || 0,
            errors: response.errors || 0
          };
        }
        
        // If we somehow get an object with a data property
        if (response && response.data && response.data.imported !== undefined) {
          return {
            imported: response.data.imported || 0,
            errors: response.data.errors || 0
          };
        }
        
        // Fallback response
        return {
          imported: 0,
          errors: 0
        };
      } else {
        console.warn('window.api.proxies.batchCreate is not available');
        // Return a response indicating failure
        return {
          imported: 0,
          errors: proxies.length // All proxies failed if IPC is not available
        };
      }
    } catch (error) {
      console.error('Batch proxy creation failed:', error);
      // Return a response indicating the failure
      return {
        imported: 0,
        errors: proxies.length // All proxies failed if we caught an error
      };
    }
  }
}