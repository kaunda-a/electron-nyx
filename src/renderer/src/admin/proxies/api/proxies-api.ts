import { api } from '@/lib/api'
import type {
  ProxyConfig,
  CreateProxy,
  UpdateProxy,
  ProxyStats
} from '../data/schema'

export interface BatchProxyCreateResponse {
  imported: number;
  errors: number;
}

export const proxiesApi = {
  /**
   * Get a list of proxies
   */
  list: async (): Promise<ProxyConfig[]> => {
    try {
      const data = await api.get('/api/proxies')
      
      // Handle the actual response structure from the server
      // The api client already returns response.data, so data should be the array of proxies
      if (Array.isArray(data)) {
        return data;
      }
      
      // If we get an object with a data property that's an array
      if (data && Array.isArray(data.data)) {
        return data.data;
      }
      
      // Fallback to empty array
      return [];
    } catch (error) {
      console.error('Failed to fetch proxies:', error);
      return [];
    }
  },

  get: async (id: string) => {
    const response = await api.get(`/api/proxies/${id}`)
    return response
  },

  create: async (data: CreateProxy) => {
    const response = await api.post('/api/proxies', data)
    return response
  },

  update: async (id: string, data: UpdateProxy) => {
    // The server doesn't have a direct update endpoint
    // For now, we'll throw an error as this functionality isn't directly supported
    throw new Error('Proxy update not supported directly. Modify via import.')
  },

  delete: async (id: string) => {
    const response = await api.delete(`/api/proxies/${id}`)
    return response
  },

  stats: async () => {
    const response = await api.get('/api/proxies/stats')
    return response
  },

  createBatch: async (proxies: CreateProxy[]): Promise<BatchProxyCreateResponse> => {
    try {
      const response = await api.post('/api/proxies/batch', proxies);
      console.log('Raw batch create response:', response);
      
      // Handle the actual response structure from the server
      // The api client already returns response.data, so response should be the data object
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