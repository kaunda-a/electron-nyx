# Routes Directory

This directory contains the API route definitions for the Nyx itBrowser Automation System.

## Structure

- `index.js` - Main routes file that mounts all individual route modules
- `proxies.js` - Proxy management routes
- `profiles.js` - Profile management routes
- `campaigns.js` - Campaign management routes

## Route Organization

### Proxies Routes
- `GET /api/proxies` - Get all proxies
- `POST /api/proxies` - Create a new proxy
- `POST /api/proxies/batch` - Create multiple proxies
- `POST /api/proxies/validate` - Validate a proxy
- `GET /api/proxies/:proxyId` - Get a specific proxy
- `DELETE /api/proxies/:proxyId` - Delete a proxy
- `GET /api/proxies/stats` - Get proxy statistics
- `POST /api/proxies/assign` - Assign a proxy to a profile

### Profiles Routes
- `GET /api/profiles` - Get all profiles
- `POST /api/profiles` - Create a new profile
- `GET /api/profiles/:profileId` - Get a specific profile
- `PUT /api/profiles/:profileId` - Update a profile
- `DELETE /api/profiles/:profileId` - Delete a profile
- `GET /api/profiles/:profileId/stats` - Get profile statistics
- `GET /api/profiles/:profileId/fingerprint` - Get profile fingerprint
- `POST /api/profiles/batch` - Create multiple profiles
- `POST /api/profiles/:profileId/launch` - Launch a browser with the profile
- `POST /api/profiles/:profileId/browser-config` - Set browser configuration for profile
- `POST /api/profiles/:profileId/close` - Close browser for profile
- `POST /api/profiles/import/json` - Import profile from JSON
- `POST /api/profiles/:profileId/assign-proxy` - Assign a proxy to a profile

### Campaigns Routes
- `GET /api/campaigns` - Get all campaigns
- `POST /api/campaigns` - Create a new campaign
- `GET /api/campaigns/stats` - Get campaign statistics
- `GET /api/campaigns/:campaignId` - Get a specific campaign
- `PUT /api/campaigns/:campaignId` - Update a campaign
- `DELETE /api/campaigns/:campaignId` - Delete a campaign
- `POST /api/campaigns/:campaignId/launch` - Launch a campaign directly

## Benefits of This Structure

1. **Modularity** - Each resource has its own route file
2. **Maintainability** - Easy to find and modify specific routes
3. **Scalability** - Easy to add new resources or endpoints
4. **Separation of Concerns** - Route definitions are separate from business logic
5. **Consistency** - Follows REST API conventions