import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CampaignStatsProps {
  data: any;
  loading: boolean;
}

export const CampaignStats = ({ data, loading }: CampaignStatsProps) => {
  const stats = data?.stats;
  const campaignPerformance = data?.campaignPerformance;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Campaign Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Active Campaigns</span>
                <span className="text-2xl font-bold">{stats.activeCampaigns}</span>
              </div>
              <Progress value={(stats.activeCampaigns / Math.max(1, stats.totalCampaigns)) * 100} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{stats.totalCampaigns} total</span>
                <span>{stats.totalCampaigns - stats.activeCampaigns} completed</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Avg. Success Rate</div>
                <div className="text-xl font-bold">
                  {campaignPerformance && campaignPerformance.length > 0 
                    ? Math.round(campaignPerformance.reduce((sum: number, c: any) => sum + c.successRate, 0) / campaignPerformance.length) + '%' 
                    : '0%'}
                </div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Running</div>
                <div className="text-xl font-bold">
                  {campaignPerformance ? campaignPerformance.filter((c: any) => c.status === 'running').length : '0'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No campaign data available</p>
        )}
      </CardContent>
    </Card>
  );
};