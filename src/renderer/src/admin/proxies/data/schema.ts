export interface ProxyConfig {
  id: string
  host: string
  port: number
  protocol: string
  username?: string
  status: string
  failure_count: number
  success_count: number
  average_response_time: number
  assigned_profiles: string[]
  geolocation?: {
    country?: string
    city?: string
    region?: string
    [key: string]: any
  }
  ip?: string
  type?: string | null
  provider?: string
  rotation?: {
    enabled: boolean
    interval?: number
    last_rotation?: string
    next_rotation?: string
  }
  isAssigned?: boolean
}

export interface CreateProxy {
  host: string
  port: number
  protocol: string
  username?: string
  password?: string
  verify?: boolean
}

export interface UpdateProxy {
  host?: string
  port?: number
  protocol?: string
  username?: string
  password?: string
}

export interface ProxyTestResult {
  id: string
  is_healthy: boolean
  checked_at: string
}

export interface ProxyStats {
  total: number
  active: number
  inactive: number
  countries: {
    [country: string]: number
  }
}

export interface ProxyAssignmentResponse {
  success: boolean
  message: string
  profileId: string
  proxy: ProxyConfig
}
