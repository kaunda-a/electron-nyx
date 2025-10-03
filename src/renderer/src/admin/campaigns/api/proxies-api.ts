// Types
export interface ProxyCreate {
  host: string;
  port: number;
  protocol: string;
  username?: string;
  password?: string;
  verify?: boolean;
}

export interface ProxyResponse {
  id: string;
  host: string;
  port: number;
  protocol: string;
  username?: string;
  status: string;
  failure_count: number;
  success_count: number;
  average_response_time: number;
  assigned_profiles: string[];
  geolocation?: Record<string, any>;
  ip?: string;
}

export interface ProxyAssignmentResponse {
  profile_id: string;
  proxy_id: string;
  success: boolean;
  message: string;
}

/**
 * Proxies API client for interacting with the proxies endpoints
 */
export const proxiesApi = {
  /**
   * Get a list of all proxies
   */
  list: async (): Promise<ProxyResponse[]> => {
    // Check if window.api.proxies exists before calling getAll
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.getAll();
    } else {
      console.warn('window.api.proxies is not available');
      return [];
    }
  },

  /**
   * Create a new proxy
   * 
   * @param proxyData - The proxy data to create
   */
  create: async (proxyData: ProxyCreate): Promise<ProxyResponse> => {
    // Check if window.api.proxies exists before calling create
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.create(proxyData);
    } else {
      throw new Error('window.api.proxies is not available');
    }
  },

  /**
   * Get a specific proxy by ID
   * 
   * @param proxyId - The ID of the proxy to get
   */
  get: async (proxyId: string): Promise<ProxyResponse> => {
    // Check if window.api.proxies exists before calling getById
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.getById(proxyId);
    } else {
      throw new Error('window.api.proxies is not available');
    }
  },

  /**
   * Check if a proxy is working properly
   * 
   * @param proxyId - The ID of the proxy to check
   */
  checkHealth: async (proxyId: string): Promise<Record<string, any>> => {
    // Check if window.api.proxies exists before calling check
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.check(proxyId);
    } else {
      throw new Error('window.api.proxies is not available');
    }
  },

  /**
   * Assign a proxy to a profile
   * 
   * @param profileId - The ID of the profile to assign the proxy to
   * @param proxyId - The ID of the proxy to assign (optional)
   * @param country - The country code for geolocation (optional)
   */
  assignToProfile: async (
    profileId: string,
    proxyId?: string,
    country?: string
  ): Promise<ProxyAssignmentResponse> => {
    // Check if window.api.proxies exists before calling assign
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.assign(profileId);
    } else {
      throw new Error('window.api.proxies is not available');
    }
  },

  /**
   * Delete a proxy
   * 
   * @param proxyId - The ID of the proxy to delete
   */
  delete: async (proxyId: string): Promise<{ success: boolean }> => {
    // Check if window.api.proxies exists before calling delete
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      return await window.api.proxies.delete(proxyId);
    } else {
      throw new Error('window.api.proxies is not available');
    }
  }
};
