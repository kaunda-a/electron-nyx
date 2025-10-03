export { sqliteCampaignsApi } from './sqliteCampaignsApi';
export { sqliteProfilesApi } from './sqliteProfilesApi';
export { sqliteProxiesApi } from './sqliteProxiesApi';
export { syncApi } from './syncApi';

// Combined API object for convenience
export const ipcApi = {
  campaigns: sqliteCampaignsApi,
  profiles: sqliteProfilesApi,
  proxies: sqliteProxiesApi,
  sync: syncApi,
};