import { sqliteProfilesApi } from '@/lib/ipc/sqliteProfilesApi';

// Types
export interface Screen {
  width: number;
  height: number;
  colorDepth: number;
}

export interface Window {
  innerWidth?: number;
  innerHeight?: number;
  outerWidth?: number;
  outerHeight?: number;
}

/**
 * Proxy configuration for browser profiles
 *
 * Note: This structure must match the backend's ProxyConfig model.
 * The server field should contain the full proxy server address (e.g., 'http://proxy.example.com:8080')
 * Username and password are optional and should be provided separately (not embedded in the URL)
 * to prevent 407 Proxy Authentication errors.
 *
 * The protocol, host, and port fields are used for UI purposes only and are not sent to the server.
 * They are combined to create the server field which is what the server actually uses.
 */
export interface ProxyConfig {
  // This is the field that gets sent to the server
  server: string;

  // These fields are for UI purposes only and don't get sent to the server
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}

export interface Geolocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface ProfileConfigCreate {
  os?: string;
  browser?: string;
  screen?: Screen;
  humanize?: boolean;
  block_webrtc?: boolean;
  geoip?: boolean;
  locale?: string;
  proxy?: ProxyConfig;
  countryCode?: string;
  category?: string;
  autoAssignProxy?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  timezone?: string;
  language?: string;
}

export interface ProfileCreate {
  name?: string;
  description?: string;
  config?: ProfileConfigCreate;
}

export interface ProfileUpdate {
  name?: string;
  description?: string;
  config?: ProfileConfigCreate;
  regenerate_fingerprint?: boolean;
}

export interface FingerprintData {
  navigator?: {
    userAgent?: string;
    doNotTrack?: string;
    appCodeName?: string;
    appName?: string;
    appVersion?: string;
    oscpu?: string;
    language?: string;
    languages?: string[];
    platform?: string;
    hardwareConcurrency?: number;
    product?: string;
    productSub?: string;
    maxTouchPoints?: number;
    cookieEnabled?: boolean;
    globalPrivacyControl?: boolean;
    buildID?: string;
    onLine?: boolean;
    [key: string]: any; // Allow for other properties
  };
  screen?: {
    availHeight?: number;
    availWidth?: number;
    availTop?: number;
    availLeft?: number;
    height?: number;
    width?: number;
    colorDepth?: number;
    pixelDepth?: number;
    pageXOffset?: number;
    pageYOffset?: number;
    [key: string]: any; // Allow for other properties
  };
  window?: {
    scrollMinX?: number;
    scrollMinY?: number;
    scrollMaxX?: number;
    scrollMaxY?: number;
    outerHeight?: number;
    outerWidth?: number;
    innerHeight?: number;
    innerWidth?: number;
    screenX?: number;
    screenY?: number;
    devicePixelRatio?: number;
    [key: string]: any; // Allow for other properties
  };
  webgl?: {
    vendor?: string;
    renderer?: string;
    version?: string;
    shadingLanguageVersion?: string;
    [key: string]: any; // Allow for other properties
  };
  note?: string;
  [key: string]: any; // Allow for other categories
}

export interface Profile {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  fingerprint?: FingerprintData;
  config: {
    os?: string;
    browser?: string;
    countryCode?: string;
    category?: string;
    autoAssignProxy?: boolean;
    viewport?: {
      width: number;
      height: number;
    };
    timezone?: string;
    language?: string;
    [key: string]: any;
  };
  path: string;
  metadata: {
    profileNumber?: number;
    geographic?: {
      country: string;
      countryName: string;
      timezone: string;
      language: string;
      currency: string;
      region: string;
      isp: string;
      org: string;
      as: string;
      city: string;
      lat: number;
      lon: number;
      zip: string;
    };
    behavioral?: Record<string, any>;
    metrics?: Record<string, any>;
    session?: Record<string, any>;
    evolution?: Record<string, any>;
    isActive?: boolean;
    [key: string]: any;
  };
}

export interface ProfileStats {
  id: string;
  name: string;
  created_at: string;
  age_days: number;
  last_access?: string;
  last_access_days?: number;
  fingerprint_complexity: number;
  profile_size_bytes: number;
  profile_size_mb: number;
}

export interface ProfileValidation {
  id: string;
  name: string;
  is_valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface BatchProfileCreate {
  count: number;
  base_config?: ProfileConfigCreate;
  name_prefix?: string;
  ensure_diversity: boolean;
}

export interface BatchProfileResponse {
  created_profiles: Profile[];
  failed_count: number;
}

export interface ProfileFilters {
  search?: string;
  os?: string;
  browser?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  hasProxy?: boolean;
}

/**
 * Profiles API client for interacting with the profiles endpoints
 */
export const profilesApi = {
  /**
   * Create a new browser profile
   */
  create: async (profileData: ProfileCreate, useDatabaseStorage = false): Promise<Profile> => {
    if (useDatabaseStorage) {
      // Create via SQLite
      const profileId = profileData.name || `profile_${Date.now()}`;
      const profileWithId = { ...profileData, id: profileId, created_at: new Date().toISOString() };
      await sqliteProfilesApi.save(profileId, profileWithId);
      return profileWithId as Profile;
    }
    return await window.api.profiles.create(profileData);
  },

  /**
   * Get a list of profiles
   */
  list: async (filters?: ProfileFilters, useDatabaseStorage = false): Promise<Profile[]> => {
    try {
      if (useDatabaseStorage) {
        // Get profiles from SQLite
        const sqliteProfiles = await sqliteProfilesApi.list();
        
        // Also get from main process and merge
        try {
          const mainProcessProfiles = await window.api.profiles.getAll(filters);
          
          // Merge SQLite and main process profiles (prefer main process data if conflict)
          const allProfiles = [...mainProcessProfiles];
          for (const sqliteProfile of sqliteProfiles) {
            const existingIndex = allProfiles.findIndex(p => p.id === sqliteProfile.id);
            if (existingIndex === -1) {
              allProfiles.push(sqliteProfile);
            }
          }
          
          return allProfiles;
        } catch (mainProcessError) {
          console.warn('Failed to fetch profiles from main process, using SQLite data:', mainProcessError);
          // Use SQLite data as fallback
          return sqliteProfiles;
        }
      } else {
        return await window.api.profiles.getAll(filters);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      return [];
    }
  },

  /**
   * Get a specific profile by ID
   */
  get: async (profileId: string, useDatabaseStorage = false): Promise<Profile> => {
    if (useDatabaseStorage) {
      // Try SQLite first
      let profile = await sqliteProfilesApi.get(profileId);
      
      if (profile) {
        return profile;
      }
      
      // Fallback to main process
      return await window.api.profiles.getById(profileId);
    }
    return await window.api.profiles.getById(profileId);
  },

  /**
   * Update a profile with new values
   */
  update: async (
    profileId: string,
    updateData: ProfileUpdate
  ): Promise<Profile> => {
    return await window.api.profiles.update(profileId, updateData);
  },

  /**
   * Delete a profile
   */
  delete: async (profileId: string, useDatabaseStorage = false): Promise<void> => {
    console.log('Deleting profile with ID:', profileId);
    try {
      if (useDatabaseStorage) {
        // Delete from main process and SQLite
        await window.api.profiles.delete(profileId);
        await sqliteProfilesApi.delete(profileId);
      } else {
        await window.api.profiles.delete(profileId);
      }
      console.log('Profile deleted successfully:', profileId);
    } catch (error) {
      console.error('Failed to delete profile:', profileId, error);
      throw error;
    }
  },

  /**
   * Get detailed statistics for a profile
   */
  getStats: async (profileId: string): Promise<ProfileStats> => {
    return await window.api.profiles.getStats(profileId);
  },

  /**
   * Get the actual fingerprint for a profile
   */
  getFingerprint: async (profileId: string): Promise<FingerprintData> => {
    return await window.api.profiles.getFingerprint(profileId);
  },

  /**
   * Create multiple unique profiles at once
   */
  createBatch: async (batchConfig: BatchProfileCreate): Promise<BatchProfileResponse> => {
    return await window.api.profiles.batchCreate(batchConfig);
  },

  /**
   * Launch a browser with the specified profile (direct launch)
   */
  launch: async (
    profileId: string,
    options: {
      headless?: boolean;
      useProxy?: boolean;
      geoip?: boolean;
      humanize?: boolean;
    } = {}
  ): Promise<Record<string, any>> => {
    return await window.api.profiles.launch(profileId, options);
  },

  /**
   * Set a custom browser configuration for a profile
   */
  setBrowserConfig: async (
    profileId: string,
    config: Record<string, any>
  ): Promise<Record<string, any>> => {
    return await window.api.profiles.setBrowserConfig(profileId, config);
  },

  /**
   * Close a browser instance for the specified profile
   */
  closeBrowser: async (profileId: string): Promise<Record<string, any>> => {
    return await window.api.profiles.close(profileId);
  },

  /**
   * Assign a proxy to a profile
   */
  assignProxyToProfile: async (
    profileId: string,
    proxyId?: string
  ): Promise<Record<string, any>> => {
    return await window.api.profiles.assignProxy(profileId, proxyId || '');
  },

  /**
   * Export a profile as a JSON file
   */
  export: async (profileId: string): Promise<void> => {
    const profile = await profilesApi.get(profileId);

    const blob = new Blob([JSON.stringify(profile, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `profile-${profileId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Import a profile from a JSON file
   * @param file - The JSON file to import
   */
  importProfile: async (file: File): Promise<any> => {
    try {
      // Create a FormData object with the file
      const formData = new FormData();
      formData.append('file', file);
      
      // For now, we'll use IPC to import the profile
    const response = await window.api.profiles.importFromJson(formData);
    return response;
    } catch (error) {
      console.error('Profile import failed:', error);
      throw error;
    }
  },
};
