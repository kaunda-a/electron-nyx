import { toast } from '@/hooks/use-toast';

// Types for dashboard data
export interface DashboardStats {
  totalProfiles: number;
  activeProfiles: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalProxies: number;
  healthyProxies: number;
  uptime: number;
  lastUpdated: string;
}

export interface CampaignPerformance {
  id: string;
  name: string;
  status: string;
  progress: number;
  profileCount: number;
  successRate: number;
  duration: string;
}

export interface RecentActivity {
  id: string;
  action: string;
  campaign?: string;
  profile?: string;
  proxy?: string;
  time: string;
  status: 'success' | 'error' | 'info' | 'warning';
}

export interface AdvancedMetrics {
  profilesCreated: number;
  campaignsLaunched: number;
  proxiesHealthy: number;
  successRate: number;
  avgCampaignDuration: number;
}

export interface DashboardData {
  stats: DashboardStats;
  campaignPerformance: CampaignPerformance[];
  recentActivity: RecentActivity[];
  advancedMetrics: AdvancedMetrics;
}

// Helper function to calculate time ago
function timeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 120) return '1 minute ago';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 7200) return '1 hour ago';
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 172800) return '1 day ago';
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  throw new Error('IPC API not available. Make sure the preload script is properly configured.');
};

/**
 * Dashboard API client for interacting with the main process via IPC
 */
export const dashboardApi = {
  /**
   * Get dashboard statistics
   */
  async getDashboardData(): Promise<DashboardData> {
    try {
      const ipc = getIpcRenderer();
      
      // Fetch all required data in parallel
      const [profiles, campaigns, proxies, systemStats] = await Promise.all([
        ipc.profiles.getAll().catch(() => []),
        ipc.campaigns.getAll().catch(() => []),
        ipc.proxies.getAll().catch(() => []),
        ipc.system.getStats().catch(() => ({ uptime: 0 }))
      ]);

      // Calculate stats from real data without mock values
      const stats: DashboardStats = {
        totalProfiles: profiles.length,
        activeProfiles: profiles.filter((p: any) => p.isActive === true || p.isActive === 1).length,
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter((c: any) => c.status === 'active' || c.status === 'running' || c.status === 'launched').length,
        totalProxies: proxies.length,
        healthyProxies: proxies.filter((p: any) => p.status === 'active' || p.status === 'healthy' || p.isWorking === true).length,
        uptime: systemStats.data?.uptime || systemStats.uptime || 0,
        lastUpdated: new Date().toISOString()
      };

      // Create campaign performance data based on actual data from campaigns
      const campaignPerformance: CampaignPerformance[] = campaigns
        .filter((campaign: any) => campaign.status !== 'deleted') // Only non-deleted campaigns
        .map((campaign: any) => {
          // Extract real performance data from campaign
          let progress = 0;
          let successRate = 0;
          
          // Calculate progress based on actual campaign data
          if (campaign.status === 'completed') {
            progress = 100;
          } else if (campaign.status === 'running' || campaign.status === 'launched') {
            // Try to get progress from campaign's performance or targets data
            if (campaign.performance && campaign.performance.progress !== undefined) {
              progress = Math.min(100, Math.round(campaign.performance.progress));
            } else if (campaign.targets && campaign.targets.completed && campaign.targets.total) {
              progress = Math.min(100, Math.round((campaign.targets.completed / campaign.targets.total) * 100));
            } else {
              progress = 30; // Default for running campaigns without specific progress data
            }
          } else if (campaign.status === 'active' || campaign.status === 'scheduled') {
            progress = 5; // Just started or scheduled
          }
          
          // Calculate success rate from actual performance data
          if (campaign.performance) {
            const { successfulVisits = 0, totalVisits = 0 } = campaign.performance;
            successRate = totalVisits > 0 ? Math.round((successfulVisits / totalVisits) * 100) : 0;
          } else if (campaign.stats) {
            // Fallback to stats if available
            const { successfulLaunches = 0, totalLaunches = 0 } = campaign.stats;
            successRate = totalLaunches > 0 ? Math.round((successfulLaunches / totalLaunches) * 100) : 0;
          }

          return {
            id: campaign.id,
            name: campaign.name || campaign.title || `Campaign ${campaign.id?.substring(0, 8) || 'N/A'}`,
            status: campaign.status || 'draft',
            profileCount: Array.isArray(campaign.profiles) ? campaign.profiles.length : 
                          typeof campaign.profileCount === 'number' ? campaign.profileCount : 0,
            progress: Math.min(100, Math.max(0, progress)), // Ensure progress is between 0-100
            successRate: Math.min(100, Math.max(0, successRate)), // Ensure success rate is between 0-100
            duration: campaign.schedule?.duration || campaign.duration || 'N/A'
          };
        });

      // Fetch recent activity with more detailed information
      const recentActivity: RecentActivity[] = [
        ...campaigns
          .filter((c: any) => (c.status === 'completed' || c.status === 'failed') && c.updated_at)
          .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 3)
          .map((c: any) => ({
            id: `campaign-${c.id}`,
            action: c.status === 'completed' ? 'Campaign completed' : 'Campaign failed',
            campaign: c.name || `Campaign ${c.id?.substring(0, 8) || 'Unknown'}`,
            time: timeAgo(new Date(c.updated_at)),
            status: c.status === 'completed' ? 'success' : 'error'
          })),
        ...profiles
          .filter((p: any) => p.created_at)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3)
          .map((p: any) => ({
            id: `profile-${p.id}`,
            action: 'Profile created',
            profile: p.name || `Profile ${p.id?.substring(0, 8) || 'Unknown'}`,
            time: timeAgo(new Date(p.created_at)),
            status: 'info'
          })),
        ...proxies
          .filter((p: any) => p.status === 'error' || p.status === 'failed' || p.status === 'inactive')
          .slice(0, 2)
          .map((p: any) => ({
            id: `proxy-${p.id}`,
            action: 'Proxy failed',
            proxy: p.host ? `${p.host}:${p.port}` : `Proxy ${p.id?.substring(0, 8) || 'Unknown'}`,
            time: timeAgo(new Date()),
            status: 'error'
          }))
      ].sort((a, b) => {
        // Sort by actual date, not the formatted string
        const timeA = new Date(b.time.includes('ago') ? new Date().getTime() - 1000 : b.time);
        const timeB = new Date(a.time.includes('ago') ? new Date().getTime() - 1000 : a.time);
        return timeB.getTime() - timeA.getTime();
      }).slice(0, 8);

      // Calculate advanced metrics for charts
      const advancedMetrics = {
        profilesCreated: profiles.length,
        campaignsLaunched: campaigns.filter((c: any) => 
          c.status === 'active' || c.status === 'running' || c.status === 'launched'
        ).length,
        proxiesHealthy: proxies.filter((p: any) => 
          p.status === 'active' || p.status === 'healthy' || p.isWorking === true
        ).length,
        successRate: campaigns.length > 0 
          ? Math.round(
              (campaigns.filter((c: any) => c.status === 'completed').length / campaigns.length) * 100
            )
          : 0,
        avgCampaignDuration: campaigns.reduce((acc: number, c: any) => 
          acc + (c.duration ? parseInt(c.duration) : 0), 0
        ) / Math.max(1, campaigns.length),
      };

      return {
        stats,
        campaignPerformance,
        recentActivity,
        advancedMetrics
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to fetch dashboard data',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
      });
      throw error;
    }
  }
};