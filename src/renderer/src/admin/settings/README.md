# Nyx Settings Module

This module provides a comprehensive settings management system for the Nyx undetectable browser, with a clean separation of concerns between server-side settings and client-side preferences.

Nyx is designed to be an undetectable browser with advanced automation capabilities, and the settings reflect this focus on privacy, security, and anti-detection.

## Architecture

The settings module follows a layered architecture:

1. **Database Layer** (`db/settings-db.ts`)
   - Handles all Supabase operations for user settings
   - Provides methods for reading, writing, and updating settings in Supabase
   - Stores user preferences and non-critical configuration

2. **API Layer** (`api/settings-api.ts`)
   - Handles all server API calls related to settings
   - Communicates with the backend server for core settings
   - Manages security-critical and system configuration settings

3. **Context Layer** (`context/settings-context.tsx`)
   - Coordinates between the API and DB layers
   - Provides a unified interface for components to access settings
   - Handles data merging between server and Supabase sources

## Data Flow

The settings data flow follows this pattern:

1. When the application loads:
   - First try to fetch settings from the server API
   - Then fetch additional metadata from Supabase
   - Merge the data from both sources
   - If server API fails, fall back to Supabase data

2. When updating settings:
   - Update the server first (for core functionality)
   - Then update Supabase (for user preferences and metadata)
   - If server update fails, don't update Supabase to maintain consistency

3. When reading settings:
   - Provide merged data from both sources
   - Server data takes precedence for core settings
   - Supabase data provides additional user preferences

## Settings Categories

Settings are divided between server and Supabase based on their nature:

- **Server Settings** (via API):
  - Security settings (two-factor auth, browser isolation, fingerprint protection)
  - System configuration (auto-updates, proxy health checks, browser cleanup)
  - Core application behavior

- **Supabase Settings** (via DB):
  - Theme and appearance preferences
  - Display options and UI customization
  - User profile information
  - Notification preferences (including detection alerts and proxy failure alerts)
  - Other non-critical user preferences

The settings are designed to support Nyx's core functionality as an undetectable browser:

- **Security Settings**: Focus on browser isolation and fingerprint protection
- **System Settings**: Include proxy health checks and browser cleanup intervals
- **Display Settings**: Include options to show fingerprint stats and detection risk
- **Notification Settings**: Include alerts for detection risks and proxy failures

## Usage

To use settings in a component:

```tsx
import { useSettings } from '../context/settings-context';

function NyxComponent() {
  const { settings, updateTheme, updateNotifications, updateSecurity } = useSettings();

  // Access Nyx settings
  const currentTheme = settings.theme;
  const fingerprint_protection = settings.security.fingerprint_protection;
  const showDetectionRisk = settings.display.show_detection_risk;

  // Update Nyx settings
  const handleThemeChange = async (newTheme) => {
    await updateTheme(newTheme);
  };

  const enableFingerPrintProtection = async () => {
    await updateSecurity({ fingerprint_protection: true });
  };

  const toggleDetectionAlerts = async (enabled) => {
    await updateNotifications({ detection_alerts: enabled });
  };

  return (
    // Component JSX for Nyx undetectable browser
  );
}
```

## Supabase Table Structure

The settings module expects a `user_settings` table in Supabase with the following structure:

- `id` (UUID, primary key)
- `user_id` (UUID, foreign key to auth.users)
- `theme` (text)
- `font` (text)
- `notifications` (JSON) - Contains detection alerts, proxy failure alerts, etc.
- `display` (JSON) - Contains fingerprint stats, detection risk display options
- `account` (JSON)
- `profile` (JSON)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

The JSON fields contain structured data that supports Nyx's undetectable browser functionality:

```json
// Example notifications JSON
{
  "email": true,
  "push": true,
  "sms": false,
  "in_app": true,
  "marketing": false,
  "detection_alerts": true,
  "automation_alerts": true,
  "proxy_failure_alerts": true,
  "fingerprint_change_alerts": true
}

// Example display JSON
{
  "sidebar_collapsed": false,
  "show_welcome": true,
  "density": "normal",
  "animations": true,
  "items": ["recents", "home"],
  "show_fingerprint_stats": true,
  "show_detection_risk": true,
  "show_automation_logs": true,
  "real_time_monitoring": true
}
```

## Server API Endpoints

The settings module interacts with the following server endpoints:

- `GET /api/users/settings` - Get user settings
- `PUT /api/users/settings` - Update user settings

The server settings include security and system configurations specific to Nyx's undetectable browser functionality:

```json
// Example server response
{
  "theme": "dark",
  "notifications": true,
  "language": "en",
  "timezone": "UTC",
  "date_format": "MM/DD/YYYY",
  "time_format": "12h",
  "security": {
    "two_factor_auth": true,
    "login_notifications": true,
    "session_timeout": 30,
    "browser_isolation": true,
    "fingerprint_protection": true
  },
  "system": {
    "auto_updates": true,
    "telemetry": false,
    "error_reporting": false,
    "proxy_health_check_interval": 15,
    "browser_cleanup_interval": 60
  }
}
```

## Future Improvements

- Add caching for frequently accessed settings
- Implement settings sync across devices
- Add validation for settings values
- Create migration utilities for settings schema changes
- Add more anti-detection settings as Nyx evolves
- Implement profile-specific settings for different browsing contexts
- Add proxy rotation settings and schedules
- Implement fingerprint randomization settings
- Add browser behavior humanization settings
- Create preset configurations for different use cases (e.g., social media automation, e-commerce, research)
