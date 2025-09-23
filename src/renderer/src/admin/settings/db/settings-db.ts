import { supabase } from '@/lib/supabase';

/**
 * Types for settings
 */
export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  font: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
    in_app: boolean;
    marketing: boolean;
    detection_alerts: boolean;
    automation_alerts: boolean;
    proxy_failure_alerts: boolean;
    fingerprint_change_alerts: boolean;
  };
  display: {
    sidebar_collapsed: boolean;
    show_welcome: boolean;
    density: 'compact' | 'normal' | 'spacious';
    animations: boolean;
    items: string[];
    show_fingerprint_stats: boolean;
    show_detection_risk: boolean;
    show_automation_logs: boolean;
    real_time_monitoring: boolean;
  };
  account: {
    language: string;
    timezone: string;
    date_format: string;
    time_format: string;
  };
  profile: {
    name: string;
    bio: string;
    avatar_url: string;
    urls: { value: string }[];
  };
  created_at: string;
  updated_at: string;
}

export type SettingsUpdate = Partial<Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

/**
 * Supabase database operations for user settings
 *
 * This module handles all Supabase-specific operations for settings,
 * keeping them separate from the API calls to the server.
 */
export const settingsDb = {
  /**
   * Get user settings from Supabase
   */
  getSettings: async (): Promise<UserSettings | null> => {
    try {
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found');
        return null;
      }

      const userId = session.user.id;

      // Get the user's settings
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no settings found, this might be the first time
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching user settings from Supabase:', error);
        throw error;
      }

      return data as UserSettings;
    } catch (error) {
      console.error('Error in getSettings:', error);
      return null;
    }
  },

  /**
   * Create initial user settings in Supabase
   */
  createSettings: async (initialSettings?: Partial<UserSettings>): Promise<UserSettings | null> => {
    try {
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found');
        return null;
      }

      const userId = session.user.id;

      // Default settings for Nyx undetectable browser
      const defaultSettings = {
        user_id: userId,
        theme: 'dark', // Dark theme is better for privacy-focused applications
        font: 'inter',
        notifications: {
          email: true,
          push: true,
          sms: false,
          in_app: true,
          marketing: false,
          detection_alerts: true,
          automation_alerts: true,
          proxy_failure_alerts: true,
          fingerprint_change_alerts: true,
        },
        display: {
          sidebar_collapsed: false,
          show_welcome: true,
          density: 'normal',
          animations: true,
          items: ['recents', 'home'],
          show_fingerprint_stats: true,
          show_detection_risk: true,
          show_automation_logs: true,
          real_time_monitoring: true,
        },
        account: {
          language: 'en',
          timezone: 'UTC',
          date_format: 'MM/DD/YYYY',
          time_format: '12h',
        },
        profile: {
          name: '',
          bio: 'I use Nyx for secure, undetectable browsing.',
          avatar_url: '',
          urls: [],
        },
        ...initialSettings
      };

      // Insert the settings
      const { data, error } = await supabase
        .from('user_settings')
        .insert([defaultSettings])
        .select()
        .single();

      if (error) {
        console.error('Error creating user settings in Supabase:', error);
        throw error;
      }

      return data as UserSettings;
    } catch (error) {
      console.error('Error in createSettings:', error);
      return null;
    }
  },

  /**
   * Update user settings in Supabase
   */
  updateSettings: async (settings: SettingsUpdate): Promise<UserSettings | null> => {
    try {
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found');
        return null;
      }

      const userId = session.user.id;

      // Update the settings
      const { data, error } = await supabase
        .from('user_settings')
        .update(settings)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user settings in Supabase:', error);
        throw error;
      }

      return data as UserSettings;
    } catch (error) {
      console.error('Error in updateSettings:', error);
      return null;
    }
  },

  /**
   * Update theme setting in Supabase
   */
  updateTheme: async (theme: 'light' | 'dark' | 'system'): Promise<UserSettings | null> => {
    return settingsDb.updateSettings({ theme });
  },

  /**
   * Update font setting in Supabase
   */
  updateFont: async (font: string): Promise<UserSettings | null> => {
    return settingsDb.updateSettings({ font });
  },

  /**
   * Update notification settings in Supabase
   */
  updateNotifications: async (notifications: Partial<UserSettings['notifications']>): Promise<UserSettings | null> => {
    // Get current settings first
    const currentSettings = await settingsDb.getSettings();
    if (!currentSettings) {
      return null;
    }

    // Merge with current notifications
    const updatedNotifications = {
      ...currentSettings.notifications,
      ...notifications
    };

    return settingsDb.updateSettings({ notifications: updatedNotifications });
  },

  /**
   * Update display settings in Supabase
   */
  updateDisplay: async (display: Partial<UserSettings['display']>): Promise<UserSettings | null> => {
    // Get current settings first
    const currentSettings = await settingsDb.getSettings();
    if (!currentSettings) {
      return null;
    }

    // Merge with current display settings
    const updatedDisplay = {
      ...currentSettings.display,
      ...display
    };

    return settingsDb.updateSettings({ display: updatedDisplay });
  },

  /**
   * Update account settings in Supabase
   */
  updateAccount: async (account: Partial<UserSettings['account']>): Promise<UserSettings | null> => {
    // Get current settings first
    const currentSettings = await settingsDb.getSettings();
    if (!currentSettings) {
      return null;
    }

    // Merge with current account settings
    const updatedAccount = {
      ...currentSettings.account,
      ...account
    };

    return settingsDb.updateSettings({ account: updatedAccount });
  },

  /**
   * Update profile settings in Supabase
   */
  updateProfile: async (profile: Partial<UserSettings['profile']>): Promise<UserSettings | null> => {
    // Get current settings first
    const currentSettings = await settingsDb.getSettings();
    if (!currentSettings) {
      return null;
    }

    // Merge with current profile settings
    const updatedProfile = {
      ...currentSettings.profile,
      ...profile
    };

    return settingsDb.updateSettings({ profile: updatedProfile });
  }
};
