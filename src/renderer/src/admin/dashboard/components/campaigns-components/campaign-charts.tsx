import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, LineChart } from 'lucide-react';

interface CampaignChartsProps {
  data: any;
  loading: boolean;
}

export const CampaignCharts = ({ data, loading }: CampaignChartsProps) => {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChart className="h-5 w-5" />
          Campaign Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded" />
            <Skeleton className="h-40 w-full rounded" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Placeholder for actual charts */}
            <div className="h-40 bg-primary/5 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <LineChart className="h-8 w-8 mx-auto text-primary/50 mb-2" />
                <p className="text-sm text-muted-foreground">Success Rate Over Time</p>
              </div>
            </div>
            
            <div className="h-40 bg-primary/5 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 mx-auto text-primary/50 mb-2" />
                <p className="text-sm text-muted-foreground">Traffic Distribution</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No chart data available</p>
        )}
      </CardContent>
    </Card>
  );
};