import { ElectronAPI } from '@electron-toolkit/preload'

export interface Profile {
  id: string
  name: string
  path: string
  created_at: string
  metadata?: any
}

export interface Campaign {
  id: string
  name: string
  type: string
  settings: any
  created_at: string
  updated_at: string
  status: string
}

export interface Proxy {
  id: string
  host: string
  port: number
  username?: string
  password?: string
  status: string
  created_at: string
}

export interface CampaignStats {
  total: number
  active: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  successRate: number
  totalVisits: number
  averageDuration: number
}

export interface ProfileStats {
  id: string
  name: string
  created_at: string
  age_days: number
  total_visits: number
  success_rate: number
  last_used: string
  status: string
  browser_info?: any
}

export interface SystemStatus {
  uptime: number
  memoryUsage: number
  cpuUsage: number
  version: string
  status: string
}

export interface SystemStats {
  totalProfiles: number
  totalCampaigns: number
  totalProxies: number
  activeCampaigns: number
  runningBrowsers: number
  diskUsage: number
}

export interface CampaignLaunchOptions {
  delay?: number
  concurrency?: number
  randomOrder?: boolean
  useProxies?: boolean
}

export interface BatchProfileResponse {
  created_profiles: Profile[]
  failed_count: number
}

export interface CampaignProgress {
  campaignId: string
  progress: number
  total: number
  completed: number
  status: string
}

export interface CampaignLaunchResponse {
  success: boolean
  message: string
  campaignId?: string
}

export interface ProxyValidationResult {
  success: boolean
  message: string
  details?: any
}

export interface Api {
  // Profile-related methods
  profiles: {
    create: (profileData: Partial<Profile>) => Promise<Profile>
    getAll: (filters?: any) => Promise<Profile[]>
    getById: (profileId: string) => Promise<Profile>
    update: (profileId: string, updateData: Partial<Profile>) => Promise<Profile>
    delete: (profileId: string) => Promise<void>
    search: (query: string) => Promise<Profile[]>
    getStats: (profileId: string) => Promise<ProfileStats>
    getFingerprint: (profileId: string) => Promise<any>
    batchCreate: (batchConfig: any) => Promise<BatchProfileResponse>
    launch: (profileId: string, options?: any) => Promise<any>
    setBrowserConfig: (profileId: string, config: any) => Promise<any>
    close: (profileId: string) => Promise<any>
    assignProxy: (profileId: string, proxyId: string) => Promise<any>
    importFromJson: (formData: any) => Promise<Profile[]>
  }

  // Campaign-related methods
  campaigns: {
    getAll: () => Promise<Campaign[]>
    getById: (campaignId: string) => Promise<Campaign>
    create: (campaignData: Partial<Campaign>) => Promise<Campaign>
    update: (campaignId: string, updateData: Partial<Campaign>) => Promise<Campaign>
    delete: (campaignId: string) => Promise<void>
    getStats: () => Promise<CampaignStats>
    launch: (campaignId: string, options?: CampaignLaunchOptions) => Promise<CampaignLaunchResponse>
    getProgress: (campaignId: string) => Promise<CampaignProgress>
    export: (campaignIds: string[]) => Promise<any>
    import: (data: any) => Promise<Campaign[]>
  }

  // Proxy-related methods
  proxies: {
    getAll: () => Promise<Proxy[]>
    getById: (proxyId: string) => Promise<Proxy>
    create: (proxyData: Partial<Proxy>) => Promise<Proxy>
    delete: (proxyId: string) => Promise<void>
    check: (proxyId: string) => Promise<any>
    assign: (profileId: string) => Promise<Proxy | null>
    getStats: () => Promise<any>
    batchCreate: (proxies: Partial<Proxy>[]) => Promise<Proxy[]>
    validate: (proxyData: Partial<Proxy>) => Promise<ProxyValidationResult>
  }

  // System-related methods
  system: {
    getStatus: () => Promise<SystemStatus>
    getStats: () => Promise<SystemStats>
  }

  // General server control
  server: {
    start: () => Promise<{ success: boolean; error?: string }>
    launchBrowser: (url: string) => Promise<{ success: boolean; error?: string }>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}