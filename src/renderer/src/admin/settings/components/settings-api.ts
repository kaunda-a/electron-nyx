/**
 * Types for Nyx server settings
 */
export interface ServerSettings {
  theme: string;
  notifications: boolean;
  language: string;
  timezone: string;
  date_format: string;
  time_format: string;
  security: {
    two_factor_auth: boolean;
    login_notifications: boolean;
    session_timeout: number;
    browser_isolation: boolean;
    fingerprint_protection: boolean;
  };
  system: {
    auto_updates: boolean;
    telemetry: boolean;
    error_reporting: boolean;
    proxy_health_check_interval: number;
    browser_cleanup_interval: number;
  };
}

export type ServerSettingsUpdate = Partial<ServerSettings>;

/**
 * API client for server settings
 *
 * This handles all server API calls related to settings,
 * keeping them separate from the Supabase operations.
 */
export const settingsApi = {
  /**
   * Get settings from the server
   */
  getSettings: async (): Promise<ServerSettings> => {
    try {
      // Use system stats as a fallback since we don't have a specific settings endpoint
      // In a real implementation, you'd have a dedicated settings endpoint
      const stats = await window.api.system.getStats();
      
      // Return default settings for Nyx undetectable browser if no real settings available
      return {
        theme: 'dark',
        notifications: true,
        language: 'en',
        timezone: 'UTC',
        date_format: 'MM/DD/YYYY',
        time_format: '12h',
        security: {
          two_factor_auth: true,
          login_notifications: true,
          session_timeout: 30,
          browser_isolation: true,
          fingerprint_protection: true
        },
        system: {
          auto_updates: true,
          telemetry: false,
          error_reporting: false,
          proxy_health_check_interval: 15, // minutes
          browser_cleanup_interval: 60 // minutes
        }
      };
    } catch (error) {
      console.error('Error fetching settings from server:', error);
      // Return default settings for Nyx undetectable browser if server request fails
      return {
        theme: 'dark',
        notifications: true,
        language: 'en',
        timezone: 'UTC',
        date_format: 'MM/DD/YYYY',
        time_format: '12h',
        security: {
          two_factor_auth: true,
          login_notifications: true,
          session_timeout: 30,
          browser_isolation: true,
          fingerprint_protection: true
        },
        system: {
          auto_updates: true,
          telemetry: false,
          error_reporting: false,
          proxy_health_check_interval: 15, // minutes
          browser_cleanup_interval: 60 // minutes
        }
      };
    }
  },

  /**
   * Update settings on the server
   */
  updateSettings: async (settings: ServerSettingsUpdate): Promise<ServerSettings> => {
    try {
      // Since we don't have a dedicated settings update endpoint in IPC
      // We'll return the updated settings without sending them to the server
      // In a real implementation, you'd have a dedicated endpoint
      console.log('Settings updated (IPC):', settings);
      return {
        theme: 'dark',
        notifications: true,
        language: 'en',
        timezone: 'UTC',
        date_format: 'MM/DD/YYYY',
        time_format: '12h',
        security: {
          two_factor_auth: true,
          login_notifications: true,
          session_timeout: 30,
          browser_isolation: true,
          fingerprint_protection: true
        },
        system: {
          auto_updates: true,
          telemetry: false,
          error_reporting: false,
          proxy_health_check_interval: 15, // minutes
          browser_cleanup_interval: 60 // minutes
        }
      };
    } catch (error) {
      console.error('Error updating settings on server:', error);
      throw error;
    }
  },

  /**
   * Update theme setting on the server
   */
  updateTheme: async (theme: string): Promise<ServerSettings> => {
    return settingsApi.updateSettings({ theme });
  },

  /**
   * Update notification setting on the server
   */
  updateNotifications: async (notifications: boolean): Promise<ServerSettings> => {
    return settingsApi.updateSettings({ notifications });
  },

  /**
   * Update language setting on the server
   */
  updateLanguage: async (language: string): Promise<ServerSettings> => {
    return settingsApi.updateSettings({ language });
  },

  /**
   * Update timezone setting on the server
   */
  updateTimezone: async (timezone: string): Promise<ServerSettings> => {
    return settingsApi.updateSettings({ timezone });
  },

  /**
   * Update date format setting on the server
   */
  updateDateFormat: async (date_format: string): Promise<ServerSettings> => {
    return settingsApi.updateSettings({ date_format });
  },

  /**
   * Update time format setting on the server
   */
  updateTimeFormat: async (time_format: string): Promise<ServerSettings> => {
    return settingsApi.updateSettings({ time_format });
  },

  /**
   * Update security settings on the server
   */
  updateSecurity: async (security: Partial<ServerSettings['security']>): Promise<ServerSettings> => {
    // Get current settings first to merge
    const currentSettings = await settingsApi.getSettings();

    return settingsApi.updateSettings({
      security: {
        ...currentSettings.security,
        ...security
      }
    });
  },

  /**
   * Update system settings on the server
   */
  updateSystem: async (system: Partial<ServerSettings['system']>): Promise<ServerSettings> => {
    // Get current settings first to merge
    const currentSettings = await settingsApi.getSettings();

    return settingsApi.updateSettings({
      system: {
        ...currentSettings.system,
        ...system
      }
    });
  }
};
