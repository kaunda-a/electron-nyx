export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  type: 'traffic' | 'revenue' | 'testing';
  settings: {
    dailyVisitTarget: number;
    maxConcurrentSessions: number;
    sessionDuration: {
      min: number;
      max: number;
    };
    clickRate: {
      min: number;
      max: number;
    };
    bounceRate: {
      min: number;
      max: number;
    };
  };
  targeting: {
    countries: string[];
    adNetworks: string[];
    adFormats: string[];
    deviceTypes: string[];
    browsers: string[];
  };
  schedule: {
    enabled: boolean;
    timezone: string;
    dailySchedule: {
      enabled: boolean;
      startTime: string;
      endTime: string;
    };
    weeklySchedule: {
      enabled: boolean;
      activeDays: number[];
    };
    dateRange: {
      enabled: boolean;
      startDate: string | null;
      endDate: string | null;
    };
  };
  targets: {
    urls: string[];
    behavior: 'random' | 'sequential' | 'weighted';
    weights: Record<string, number>;
  };
  profiles: {
    assignmentType: 'auto' | 'manual' | 'category';
    assignedProfiles: string[];
    categoryDistribution: {
      newVisitor: number;
      returningRegular: number;
      loyalUser: number;
    };
    maxProfilesPerCampaign: number;
  };
  performance: {
    totalVisits: number;
    totalClicks: number;
    totalRevenue: number;
    avgSessionDuration: number;
    avgCTR: number;
    errorRate: number;
    lastUpdated: string | null;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface CampaignCreate {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed';
  type?: 'traffic' | 'revenue' | 'testing';
  settings?: Partial<Campaign['settings']>;
  targeting?: Partial<Campaign['targeting']>;
  schedule?: Partial<Campaign['schedule']>;
  targets?: Partial<Campaign['targets']>;
  profiles?: Partial<Campaign['profiles']>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  createdBy?: string;
}

export interface CampaignUpdate {
  name?: string;
  description?: string;
  status?: Campaign['status'];
  type?: 'traffic' | 'revenue' | 'testing';
  settings?: Partial<Campaign['settings']>;
  targeting?: Partial<Campaign['targeting']>;
  schedule?: Partial<Campaign['schedule']>;
  targets?: Partial<Campaign['targets']>;
  profiles?: Partial<Campaign['profiles']>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
}

export interface CampaignStats {
  total: number;
  active: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalVisits: number;
  totalRevenue: number;
}