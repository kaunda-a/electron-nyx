import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, Shield } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProxyStatsProps {
  data: any;
  loading: boolean;
}

export const ProxyStats = ({ data, loading }: ProxyStatsProps) => {
  const stats = data?.stats;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Proxy Statistics
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
                <span className="text-sm font-medium">Healthy Proxies</span>
                <span className="text-2xl font-bold">{stats.healthyProxies}</span>
              </div>
              <Progress value={(stats.healthyProxies / Math.max(1, stats.totalProxies)) * 100} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{stats.totalProxies} total</span>
                <span>{stats.totalProxies - stats.healthyProxies} unhealthy</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Avg. Response Time</div>
                <div className="text-xl font-bold">142ms</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Success Rate</div>
                <div className="text-xl font-bold">97%</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No proxy data available</p>
        )}
      </CardContent>
    </Card>
  );
};