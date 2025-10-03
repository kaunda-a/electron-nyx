import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProfileStatsProps {
  data: any;
  loading: boolean;
}

export const ProfileStats = ({ data, loading }: ProfileStatsProps) => {
  const stats = data?.stats;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Profile Statistics
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
                <span className="text-sm font-medium">Total Profiles</span>
                <span className="text-2xl font-bold">{stats.totalProfiles}</span>
              </div>
              <Progress value={(stats.activeProfiles / stats.totalProfiles) * 100} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{stats.activeProfiles} active</span>
                <span>{stats.totalProfiles - stats.activeProfiles} inactive</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Created Today</div>
                <div className="text-xl font-bold">12</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="text-sm text-muted-foreground">Success Rate</div>
                <div className="text-xl font-bold">94%</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No profile data available</p>
        )}
      </CardContent>
    </Card>
  );
};