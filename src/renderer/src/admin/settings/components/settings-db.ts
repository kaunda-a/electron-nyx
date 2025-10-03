import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

// Interface for user settings
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

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  throw new Error('IPC API not available. Make sure the preload script is properly configured.');
};

/**
 * SQLite Settings API client for interacting with the main process via IPC
 * Follows the same pattern as other SQLite API clients
 */
export const sqliteSettingsApi = {
  /** 
   * Get user settings from SQLite by user ID
   */
  get: async (userId: string): Promise<UserSettings | null> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.settings.getById(userId);
      return result;
    } catch (error) {
      console.error(`Failed to fetch settings for user ${userId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to fetch settings for user ${userId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      // Don't throw - return null to indicate no settings found
      return null;
    }
  },

  /**
   * Get all settings from SQLite
   */
  list: async (): Promise<UserSettings[]> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.settings.getAll();
      return result;
    } catch (error) {
      console.error('Failed to fetch settings from SQLite:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to fetch settings',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Save user settings to SQLite
   */
  save: async (userId: string, settingsData: any): Promise<UserSettings> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.settings.update(userId, settingsData);
      return result;
    } catch (error) {
      console.error(`Failed to save settings for user ${userId} to SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to save settings for user ${userId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },

  /**
   * Delete user settings from SQLite
   */
  delete: async (userId: string): Promise<void> => {
    try {
      const ipc = getIpcRenderer();
      const result = await ipc.settings.delete(userId);
      toast({
        title: 'Settings deleted',
        description: `Settings for user ${userId} have been deleted from local storage.`,
      });
      return result;
    } catch (error) {
      console.error(`Failed to delete settings for user ${userId} from SQLite:`, error);
      toast({
        variant: 'destructive',
        title: `Failed to delete settings for user ${userId}`,
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  },
};

/**
 * Settings API client for interacting with both Supabase and SQLite
 */
export const settingsDb = {
  /**
   * Get user settings from Supabase with SQLite fallback
   */
  async getSettings(): Promise<UserSettings | null> {
    try {
      // First, get the current session to identify the user
      const { 
        data: { session } 
      } = await supabase.auth.getSession();
      
      if (!session?.user) {
        console.error('No authenticated user to fetch settings for');
        return null;
      }

      let settings: UserSettings | null = null;
      
      // Try to fetch from Supabase first
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error fetching settings from Supabase:', error);
        } else if (data) {
          settings = data as UserSettings;
          // If we got data from Supabase, also save to SQLite for offline access
          try {
            await sqliteSettingsApi.save(session.user.id, data);
          } catch (sqliteError) {
            console.error('Error saving settings to SQLite:', sqliteError);
            // Continue anyway - this is just a cache
          }
        }
      } catch (supabaseError) {
        console.error('Supabase error:', supabaseError);
      }

      // If we still don't have settings, try SQLite
      if (!settings) {
        settings = await sqliteSettingsApi.get(session.user.id);
      }

      return settings;
    } catch (error) {
      console.error('Error in getSettings:', error);
      toast({
        variant: 'destructive',
        title: 'Settings Fetch Error',
        description: 'Failed to fetch user settings',
      });
      return null;
    }
  },

  /**
   * Create default user settings
   */
  async createSettings(): Promise<UserSettings> {
    try {
      const { 
        data: { session } 
      } = await supabase.auth.getSession();
      
      if (!session?.user) {
        throw new Error('No authenticated user to create settings for');
      }

      // Create default settings
      const defaultSettings: Omit<UserSettings, 'id' | 'created_at' | 'updated_at'> = {
        user_id: session.user.id,
        theme: 'dark',
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
          name: session.user.user_metadata?.full_name || session.user.email || '',
          bio: 'I use Nyx for secure, undetectable browsing.',
          avatar_url: session.user.user_metadata?.avatar_url || '',
          urls: [],
        }
      };

      // Create in Supabase
      const { data, error } = await supabase
        .from('user_settings')
        .insert([{
          ...defaultSettings,
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating settings in Supabase:', error);
        // Create in SQLite as fallback
        const localSettings = await sqliteSettingsApi.save(
          session.user.id, 
          {
            ...defaultSettings,
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as UserSettings
        );
        return localSettings;
      }

      // Also save to SQLite
      await sqliteSettingsApi.save(session.user.id, data as UserSettings);
      
      toast({
        title: 'Settings Created',
        description: 'Default settings have been created for your account.',
      });

      return data as UserSettings;
    } catch (error) {
      console.error('Error creating settings:', error);
      toast({
        variant: 'destructive',
        title: 'Settings Creation Error',
        description: 'Failed to create default settings',
      });
      throw error;
    }
  },

  /**
   * Update theme in settings
   */
  async updateTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    const settings = await settingsDb.getSettings();
    if (!settings) {
      throw new Error('No existing settings to update');
    }

    const updatedSettings = { 
      ...settings, 
      theme, 
      updated_at: new Date().toISOString() 
    };
    
    // Update in Supabase
    const { error: supabaseError } = await supabase
      .from('user_settings')
      .update({ theme, updated_at: updatedSettings.updated_at })
      .eq('id', settings.id);

    if (supabaseError) {
      console.error('Error updating theme in Supabase:', supabaseError);
      // Update in SQLite as fallback
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    } else {
      // Update in SQLite as well
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    }
  },

  /**
   * Update font in settings
   */
  async updateFont(font: string): Promise<void> {
    const settings = await settingsDb.getSettings();
    if (!settings) {
      throw new Error('No existing settings to update');
    }

    const updatedSettings = { 
      ...settings, 
      font, 
      updated_at: new Date().toISOString() 
    };
    
    // Update in Supabase
    const { error: supabaseError } = await supabase
      .from('user_settings')
      .update({ font, updated_at: updatedSettings.updated_at })
      .eq('id', settings.id);

    if (supabaseError) {
      console.error('Error updating font in Supabase:', supabaseError);
      // Update in SQLite as fallback
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    } else {
      // Update in SQLite as well
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    }
  },

  /**
   * Update notifications in settings
   */
  async updateNotifications(notifications: Partial<UserSettings['notifications']>): Promise<void> {
    const settings = await settingsDb.getSettings();
    if (!settings) {
      throw new Error('No existing settings to update');
    }

    const updatedNotifications = { ...settings.notifications, ...notifications };
    const updatedSettings = { 
      ...settings, 
      notifications: updatedNotifications, 
      updated_at: new Date().toISOString() 
    };
    
    // Update in Supabase
    const { error: supabaseError } = await supabase
      .from('user_settings')
      .update({ notifications: updatedNotifications, updated_at: updatedSettings.updated_at })
      .eq('id', settings.id);

    if (supabaseError) {
      console.error('Error updating notifications in Supabase:', supabaseError);
      // Update in SQLite as fallback
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    } else {
      // Update in SQLite as well
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    }
  },

  /**
   * Update display settings
   */
  async updateDisplay(display: Partial<UserSettings['display']>): Promise<void> {
    const settings = await settingsDb.getSettings();
    if (!settings) {
      throw new Error('No existing settings to update');
    }

    const updatedDisplay = { ...settings.display, ...display };
    const updatedSettings = { 
      ...settings, 
      display: updatedDisplay, 
      updated_at: new Date().toISOString() 
    };
    
    // Update in Supabase
    const { error: supabaseError } = await supabase
      .from('user_settings')
      .update({ display: updatedDisplay, updated_at: updatedSettings.updated_at })
      .eq('id', settings.id);

    if (supabaseError) {
      console.error('Error updating display settings in Supabase:', supabaseError);
      // Update in SQLite as fallback
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    } else {
      // Update in SQLite as well
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    }
  },

  /**
   * Update account settings
   */
  async updateAccount(account: Partial<UserSettings['account']>): Promise<void> {
    const settings = await settingsDb.getSettings();
    if (!settings) {
      throw new Error('No existing settings to update');
    }

    const updatedAccount = { ...settings.account, ...account };
    const updatedSettings = { 
      ...settings, 
      account: updatedAccount, 
      updated_at: new Date().toISOString() 
    };
    
    // Update in Supabase
    const { error: supabaseError } = await supabase
      .from('user_settings')
      .update({ account: updatedAccount, updated_at: updatedSettings.updated_at })
      .eq('id', settings.id);

    if (supabaseError) {
      console.error('Error updating account settings in Supabase:', supabaseError);
      // Update in SQLite as fallback
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    } else {
      // Update in SQLite as well
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    }
  },

  /**
   * Update profile settings
   */
  async updateProfile(profile: Partial<UserSettings['profile']>): Promise<void> {
    const settings = await settingsDb.getSettings();
    if (!settings) {
      throw new Error('No existing settings to update');
    }

    const updatedProfile = { ...settings.profile, ...profile };
    const updatedSettings = { 
      ...settings, 
      profile: updatedProfile, 
      updated_at: new Date().toISOString() 
    };
    
    // Update in Supabase
    const { error: supabaseError } = await supabase
      .from('user_settings')
      .update({ profile: updatedProfile, updated_at: updatedSettings.updated_at })
      .eq('id', settings.id);

    if (supabaseError) {
      console.error('Error updating profile settings in Supabase:', supabaseError);
      // Update in SQLite as fallback
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    } else {
      // Update in SQLite as well
      await sqliteSettingsApi.save(settings.user_id, updatedSettings);
    }
  },
};