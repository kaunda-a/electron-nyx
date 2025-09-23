import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import { settingsApi, ServerSettings, ServerSettingsUpdate } from '../api/settings-api';
import { settingsDb, UserSettings, SettingsUpdate } from '../db/settings-db';

// Combined settings type that merges server and client settings
export interface CombinedSettings {
  // Theme settings
  theme: 'light' | 'dark' | 'system';
  font: string;

  // Notification settings
  notifications: {
    enabled: boolean;
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

  // Display settings
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

  // Account settings
  account: {
    language: string;
    timezone: string;
    date_format: string;
    time_format: string;
  };

  // Profile settings
  profile: {
    name: string;
    bio: string;
    avatar_url: string;
    urls: { value: string }[];
  };

  // Security settings
  security: {
    two_factor_auth: boolean;
    login_notifications: boolean;
    session_timeout: number;
    browser_isolation: boolean;
    fingerprint_protection: boolean;
  };

  // System settings
  system: {
    auto_updates: boolean;
    telemetry: boolean;
    error_reporting: boolean;
    proxy_health_check_interval: number;
    browser_cleanup_interval: number;
  };
}

// Context interface
interface SettingsContextType {
  settings: CombinedSettings;
  isLoading: boolean;
  error: Error | null;

  // Theme methods
  updateTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;
  updateFont: (font: string) => Promise<void>;

  // Notification methods
  updateNotifications: (notifications: Partial<CombinedSettings['notifications']>) => Promise<void>;

  // Display methods
  updateDisplay: (display: Partial<CombinedSettings['display']>) => Promise<void>;

  // Account methods
  updateAccount: (account: Partial<CombinedSettings['account']>) => Promise<void>;

  // Profile methods
  updateProfile: (profile: Partial<CombinedSettings['profile']>) => Promise<void>;

  // Security methods
  updateSecurity: (security: Partial<CombinedSettings['security']>) => Promise<void>;

  // System methods
  updateSystem: (system: Partial<CombinedSettings['system']>) => Promise<void>;

  // General update method
  updateSettings: (settings: Partial<CombinedSettings>) => Promise<void>;

  // Refresh settings
  refreshSettings: () => Promise<void>;
}

// Default settings for Nyx undetectable browser
const defaultSettings: CombinedSettings = {
  theme: 'dark', // Dark theme is better for privacy-focused applications
  font: 'inter',
  notifications: {
    enabled: true,
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
  security: {
    two_factor_auth: true, // Enhanced security by default
    login_notifications: true,
    session_timeout: 30,
    browser_isolation: true, // Prevent cross-profile contamination
    fingerprint_protection: true, // Enable anti-detection by default
  },
  system: {
    auto_updates: true,
    telemetry: false, // Privacy-focused default
    error_reporting: false, // Privacy-focused default
    proxy_health_check_interval: 15, // Check proxy health every 15 minutes
    browser_cleanup_interval: 60, // Clean up browser data every hour
  },
};

// Create context
const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CombinedSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch settings from both sources and merge them
  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to get settings from the server
      let serverSettings: ServerSettings | null = null;
      try {
        serverSettings = await settingsApi.getSettings();
      } catch (serverError) {
        console.error('Error fetching settings from server:', serverError);
        // Continue with null serverSettings
      }

      // Try to get settings from Supabase
      let userSettings: UserSettings | null = null;
      try {
        userSettings = await settingsDb.getSettings();

        // If no settings exist in Supabase, create default ones
        if (!userSettings) {
          userSettings = await settingsDb.createSettings();
        }
      } catch (dbError) {
        console.error('Error fetching settings from Supabase:', dbError);
        // Continue with null userSettings
      }

      // Merge settings from both sources
      const mergedSettings: CombinedSettings = {
        ...defaultSettings,

        // Server settings take precedence for core functionality
        ...(serverSettings && {
          theme: serverSettings.theme as 'light' | 'dark' | 'system',
          account: {
            ...defaultSettings.account,
            language: serverSettings.language,
            timezone: serverSettings.timezone,
            date_format: serverSettings.date_format,
            time_format: serverSettings.time_format,
          },
          security: serverSettings.security,
          system: serverSettings.system,
          notifications: {
            ...defaultSettings.notifications,
            enabled: serverSettings.notifications,
          },
        }),

        // Supabase settings for user preferences
        ...(userSettings && {
          theme: userSettings.theme,
          font: userSettings.font,
          display: userSettings.display,
          profile: userSettings.profile,
          notifications: {
            ...defaultSettings.notifications,
            ...(serverSettings && { enabled: serverSettings.notifications }),
            ...userSettings.notifications,
          },
          account: {
            ...defaultSettings.account,
            ...(serverSettings && {
              language: serverSettings.language,
              timezone: serverSettings.timezone,
              date_format: serverSettings.date_format,
              time_format: serverSettings.time_format,
            }),
            ...userSettings.account,
          },
        }),
      };

      setSettings(mergedSettings);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch settings'));
      toast({
        title: 'Nyx Settings Error',
        description: 'Failed to fetch Nyx settings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchSettings();
  }, []);

  // Update theme
  const updateTheme = async (theme: 'light' | 'dark' | 'system') => {
    try {
      // Update server first
      try {
        await settingsApi.updateTheme(theme);
      } catch (serverError) {
        console.error('Error updating theme on server:', serverError);
        // Continue even if server update fails
      }

      // Then update Supabase
      await settingsDb.updateTheme(theme);

      // Update local state
      setSettings(prev => ({ ...prev, theme }));

      toast({
        title: 'Nyx Theme Updated',
        description: 'Your Nyx theme preference has been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update theme',
        variant: 'destructive',
      });
    }
  };

  // Update font
  const updateFont = async (font: string) => {
    try {
      // Update Supabase only (font is a UI preference)
      await settingsDb.updateFont(font);

      // Update local state
      setSettings(prev => ({ ...prev, font }));

      toast({
        title: 'Font Updated',
        description: 'Your font preference has been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update font',
        variant: 'destructive',
      });
    }
  };

  // Update notifications
  const updateNotifications = async (notifications: Partial<CombinedSettings['notifications']>) => {
    try {
      // If the enabled flag is changing, update server
      if (notifications.enabled !== undefined) {
        try {
          await settingsApi.updateNotifications(notifications.enabled);
        } catch (serverError) {
          console.error('Error updating notifications on server:', serverError);
          // Continue even if server update fails
        }
      }

      // Update Supabase with detailed notification preferences
      const dbNotifications: Partial<UserSettings['notifications']> = {
        email: notifications.email,
        push: notifications.push,
        sms: notifications.sms,
        in_app: notifications.in_app,
        marketing: notifications.marketing,
      };

      // Filter out undefined values
      Object.keys(dbNotifications).forEach(key => {
        if (dbNotifications[key as keyof typeof dbNotifications] === undefined) {
          delete dbNotifications[key as keyof typeof dbNotifications];
        }
      });

      if (Object.keys(dbNotifications).length > 0) {
        await settingsDb.updateNotifications(dbNotifications);
      }

      // Update local state
      setSettings(prev => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          ...notifications,
        },
      }));

      toast({
        title: 'Notifications Updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update notifications',
        variant: 'destructive',
      });
    }
  };

  // Update display settings
  const updateDisplay = async (display: Partial<CombinedSettings['display']>) => {
    try {
      // Update Supabase only (display is a UI preference)
      await settingsDb.updateDisplay(display);

      // Update local state
      setSettings(prev => ({
        ...prev,
        display: {
          ...prev.display,
          ...display,
        },
      }));

      toast({
        title: 'Display Settings Updated',
        description: 'Your display preferences have been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update display settings',
        variant: 'destructive',
      });
    }
  };

  // Update account settings
  const updateAccount = async (account: Partial<CombinedSettings['account']>) => {
    try {
      // Update server first with core account settings
      const serverAccount: Partial<ServerSettings> = {
        language: account.language,
        timezone: account.timezone,
        date_format: account.date_format,
        time_format: account.time_format,
      };

      // Filter out undefined values
      Object.keys(serverAccount).forEach(key => {
        if (serverAccount[key as keyof typeof serverAccount] === undefined) {
          delete serverAccount[key as keyof typeof serverAccount];
        }
      });

      if (Object.keys(serverAccount).length > 0) {
        try {
          await settingsApi.updateSettings(serverAccount);
        } catch (serverError) {
          console.error('Error updating account on server:', serverError);
          // Continue even if server update fails
        }
      }

      // Then update Supabase
      await settingsDb.updateAccount(account);

      // Update local state
      setSettings(prev => ({
        ...prev,
        account: {
          ...prev.account,
          ...account,
        },
      }));

      toast({
        title: 'Account Settings Updated',
        description: 'Your account preferences have been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update account settings',
        variant: 'destructive',
      });
    }
  };

  // Update profile settings
  const updateProfile = async (profile: Partial<CombinedSettings['profile']>) => {
    try {
      // Update Supabase only (profile is a user preference)
      await settingsDb.updateProfile(profile);

      // Update local state
      setSettings(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          ...profile,
        },
      }));

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    }
  };

  // Update security settings
  const updateSecurity = async (security: Partial<CombinedSettings['security']>) => {
    try {
      // Update server only (security is a core functionality)
      try {
        await settingsApi.updateSecurity(security);
      } catch (serverError) {
        console.error('Error updating security on server:', serverError);
        toast({
          title: 'Update Failed',
          description: 'Failed to update security settings',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setSettings(prev => ({
        ...prev,
        security: {
          ...prev.security,
          ...security,
        },
      }));

      toast({
        title: 'Security Settings Updated',
        description: 'Your security preferences have been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update security settings',
        variant: 'destructive',
      });
    }
  };

  // Update system settings
  const updateSystem = async (system: Partial<CombinedSettings['system']>) => {
    try {
      // Update server only (system is a core functionality)
      try {
        await settingsApi.updateSystem(system);
      } catch (serverError) {
        console.error('Error updating system on server:', serverError);
        toast({
          title: 'Update Failed',
          description: 'Failed to update system settings',
          variant: 'destructive',
        });
        return;
      }

      // Update local state
      setSettings(prev => ({
        ...prev,
        system: {
          ...prev.system,
          ...system,
        },
      }));

      toast({
        title: 'System Settings Updated',
        description: 'Your system preferences have been saved.',
      });
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: 'Failed to update system settings',
        variant: 'destructive',
      });
    }
  };

  // General update method
  const updateSettings = async (newSettings: Partial<CombinedSettings>) => {
    // Update each section using the specialized methods
    if (newSettings.theme) {
      await updateTheme(newSettings.theme);
    }

    if (newSettings.font) {
      await updateFont(newSettings.font);
    }

    if (newSettings.notifications) {
      await updateNotifications(newSettings.notifications);
    }

    if (newSettings.display) {
      await updateDisplay(newSettings.display);
    }

    if (newSettings.account) {
      await updateAccount(newSettings.account);
    }

    if (newSettings.profile) {
      await updateProfile(newSettings.profile);
    }

    if (newSettings.security) {
      await updateSecurity(newSettings.security);
    }

    if (newSettings.system) {
      await updateSystem(newSettings.system);
    }
  };

  // Refresh settings
  const refreshSettings = async () => {
    await fetchSettings();
  };



  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        error,
        updateTheme,
        updateFont,
        updateNotifications,
        updateDisplay,
        updateAccount,
        updateProfile,
        updateSecurity,
        updateSystem,
        updateSettings,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// Hook for using the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
