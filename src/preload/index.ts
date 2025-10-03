import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  // Utility functions
  utils: {
    openExternal: (url: string) => ipcRenderer.invoke('utils:open-external', url),
  },
  // Profile-related IPC calls
  profiles: {
    create: (profileData: any) => ipcRenderer.invoke('profiles:create', profileData),
    getAll: (filters?: any) => ipcRenderer.invoke('profiles:getAll', filters),
    getById: (profileId: string) => ipcRenderer.invoke('profiles:getById', profileId),
    update: (profileId: string, updateData: any) => ipcRenderer.invoke('profiles:update', profileId, updateData),
    delete: (profileId: string) => ipcRenderer.invoke('profiles:delete', profileId),
    search: (query: string) => ipcRenderer.invoke('profiles:search', query),
    getStats: (profileId: string) => ipcRenderer.invoke('profiles:getStats', profileId),
    getFingerprint: (profileId: string) => ipcRenderer.invoke('profiles:getFingerprint', profileId),
    batchCreate: (batchConfig: any) => ipcRenderer.invoke('profiles:batchCreate', batchConfig),
    launch: (profileId: string, options?: any) => ipcRenderer.invoke('profiles:launch', profileId, options),
    setBrowserConfig: (profileId: string, config: any) => ipcRenderer.invoke('profiles:setBrowserConfig', profileId, config),
    close: (profileId: string) => ipcRenderer.invoke('profiles:close', profileId),
    assignProxy: (profileId: string, proxyId: string) => ipcRenderer.invoke('profiles:assignProxy', profileId, proxyId),
    importFromJson: (formData: any) => ipcRenderer.invoke('profiles:importFromJson', formData),
  },
  
  // Campaign-related IPC calls
  campaigns: {
    getAll: () => ipcRenderer.invoke('campaigns:getAll'),
    getById: (campaignId: string) => ipcRenderer.invoke('campaigns:getById', campaignId),
    create: (campaignData: any) => ipcRenderer.invoke('campaigns:create', campaignData),
    update: (campaignId: string, updateData: any) => ipcRenderer.invoke('campaigns:update', campaignId, updateData),
    delete: (campaignId: string) => ipcRenderer.invoke('campaigns:delete', campaignId),
    getStats: () => ipcRenderer.invoke('campaigns:getStats'),
    launch: (campaignId: string, options?: any) => ipcRenderer.invoke('campaigns:launch', campaignId, options),
    getProgress: (campaignId: string) => ipcRenderer.invoke('campaigns:getProgress', campaignId),
    export: (campaignIds: string[]) => ipcRenderer.invoke('campaigns:export', campaignIds),
    import: (data: any) => ipcRenderer.invoke('campaigns:import', data),
  },
  
  // Proxy-related IPC calls
  proxies: {
    getAll: () => ipcRenderer.invoke('proxies:getAll'),
    getById: (proxyId: string) => ipcRenderer.invoke('proxies:getById', proxyId),
    create: (proxyData: any) => ipcRenderer.invoke('proxies:create', proxyData),
    delete: (proxyId: string) => ipcRenderer.invoke('proxies:delete', proxyId),
    check: (proxyId: string) => ipcRenderer.invoke('proxies:check', proxyId),
    assign: (profileId: string) => ipcRenderer.invoke('proxies:assign', profileId),
    getStats: () => ipcRenderer.invoke('proxies:getStats'),
    batchCreate: (proxies: any[]) => ipcRenderer.invoke('proxies:batchCreate', proxies),
    validate: (proxyData: any) => ipcRenderer.invoke('proxies:validate', proxyData),
  },
  
  // System-related IPC calls
  system: {
    getStatus: () => ipcRenderer.invoke('system:getStatus'),
    getStats: () => ipcRenderer.invoke('system:getStats'),
    // Database management functions
    createTable: (tableData: any) => ipcRenderer.invoke('db:create-table', tableData),
    createSupabaseTable: (tableData: any) => ipcRenderer.invoke('db:create-supabase-table', tableData),
    getTableNames: () => ipcRenderer.invoke('db:get-table-names'),
    getSupabaseTableNames: () => ipcRenderer.invoke('db:get-supabase-table-names'),
  },
  
  // Settings-related IPC calls
  settings: {
    getAll: () => ipcRenderer.invoke('sqlite:settings:getAll'),
    getById: (userId: string) => ipcRenderer.invoke('sqlite:settings:getById', userId),
    update: (userId: string, settingsData: any) => ipcRenderer.invoke('sqlite:settings:save', userId, settingsData),
    delete: (userId: string) => ipcRenderer.invoke('sqlite:settings:delete', userId),
  },
  
  // Authentication-related IPC calls
  auth: {
    signIn: (credentials: { email: string, password: string }) => ipcRenderer.invoke('auth:signIn', credentials),
    signUp: (credentials: { email: string, password: string, metadata?: any }) => ipcRenderer.invoke('auth:signUp', credentials),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    resetPassword: (email: string) => ipcRenderer.invoke('auth:resetPassword', email),
    updatePassword: (request: { password: string }) => ipcRenderer.invoke('auth:updatePassword', request),
    verifyOtp: (request: { email: string, token: string, type: any }) => ipcRenderer.invoke('auth:verifyOtp', request),
    exchangeCodeForSession: (data: { code: string }) => ipcRenderer.invoke('auth:exchangeCodeForSession', data),
    signInWithGoogle: (redirectTo?: string) => ipcRenderer.invoke('auth:signInWithGoogle', redirectTo),
  },
  
  // General server control
  server: {
    start: () => ipcRenderer.invoke('start-server'),
    launchBrowser: (url: string) => ipcRenderer.invoke('launch-browser', url),
    // Sync APIs
    syncCampaigns: (userId: string) => ipcRenderer.invoke('sync:campaigns', userId),
    syncProfiles: (userId: string) => ipcRenderer.invoke('sync:profiles', userId),
    syncProxies: (userId: string) => ipcRenderer.invoke('sync:proxies', userId),
    syncAll: (userId: string) => ipcRenderer.invoke('sync:all', userId),
    getSyncStatus: (userId: string) => ipcRenderer.invoke('sync:status', userId),
  },
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback);
    return () => {
      ipcRenderer.removeListener(channel, callback);
    };
  }
}

// Use `contextBridge` to securely expose APIs to the renderer process
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('ContextBridge error:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}