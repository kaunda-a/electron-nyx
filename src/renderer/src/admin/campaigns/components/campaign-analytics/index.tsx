import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  LineChart, 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Download,
  RefreshCw
} from 'lucide-react';
import { Campaign } from '../../data/schema';

interface CampaignAnalyticsProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function CampaignAnalytics({ campaigns, isLoading, onRefresh }: CampaignAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Calculate analytics data
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.performance?.totalRevenue || 0), 0);
  const totalVisits = campaigns.reduce((sum, c) => sum + (c.performance?.totalVisits || 0), 0);
  const avgCTR = totalCampaigns > 0 
    ? campaigns.reduce((sum, c) => sum + (c.performance?.avgCTR || 0), 0) / totalCampaigns 
    : 0;

  // Status distribution
  const statusDistribution = {
    draft: campaigns.filter(c => c.status === 'draft').length,
    active: campaigns.filter(c => c.status === 'active').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
    completed: campaigns.filter(c => c.status === 'completed').length
  };

  // Type distribution
  const typeDistribution = {
    traffic: campaigns.filter(c => c.type === 'traffic').length,
    revenue: campaigns.filter(c => c.type === 'revenue').length,
    testing: campaigns.filter(c => c.type === 'testing').length
  };

  // Top performing campaigns by revenue
  const topRevenueCampaigns = [...campaigns]
    .sort((a, b) => (b.performance?.totalRevenue || 0) - (a.performance?.totalRevenue || 0))
    .slice(0, 5);

  // Top performing campaigns by visits
  const topVisitCampaigns = [...campaigns]
    .sort((a, b) => (b.performance?.totalVisits || 0) - (a.performance?.totalVisits || 0))
    .slice(0, 5);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Format number
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('90d')}
          >
            90 Days
          </Button>
          <Button
            variant={timeRange === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('all')}
          >
            All Time
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalCampaigns)}</div>
            <p className="text-xs text-muted-foreground">
              {activeCampaigns} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Avg. {formatCurrency(totalCampaigns > 0 ? totalRevenue / totalCampaigns : 0)} per campaign
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalVisits)}</div>
            <p className="text-xs text-muted-foreground">
              Avg. {formatNumber(totalCampaigns > 0 ? totalVisits / totalCampaigns : 0)} per campaign
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg. CTR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(avgCTR)}</div>
            <p className="text-xs text-muted-foreground">
              Click-through rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCampaigns > 0 
                ? `${Math.round((completedCampaigns / totalCampaigns) * 100)}%` 
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(completedCampaigns)} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-4 w-4 mr-2" />
              Campaign Status Distribution
            </CardTitle>
            <CardDescription>
              Distribution of campaigns by status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statusDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Badge 
                      variant="outline" 
                      className="mr-2 capitalize"
                    >
                      {status}
                    </Badge>
                    <span className="text-sm">{formatNumber(count)}</span>
                  </div>
                  <div className="flex items-center w-32">
                    <Progress 
                      value={totalCampaigns > 0 ? (count / totalCampaigns) * 100 : 0} 
                      className="w-full" 
                    />
                    <span className="text-sm ml-2 w-12">
                      {totalCampaigns > 0 ? `${Math.round((count / totalCampaigns) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Campaign Type Distribution
            </CardTitle>
            <CardDescription>
              Distribution of campaigns by type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(typeDistribution).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Badge 
                      variant="outline" 
                      className="mr-2 capitalize"
                    >
                      {type}
                    </Badge>
                    <span className="text-sm">{formatNumber(count)}</span>
                  </div>
                  <div className="flex items-center w-32">
                    <Progress 
                      value={totalCampaigns > 0 ? (count / totalCampaigns) * 100 : 0} 
                      className="w-full" 
                    />
                    <span className="text-sm ml-2 w-12">
                      {totalCampaigns > 0 ? `${Math.round((count / totalCampaigns) * 100)}%` : '0%'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Revenue Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Top Revenue Campaigns
            </CardTitle>
            <CardDescription>
              Campaigns with highest revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topRevenueCampaigns.map((campaign, index) => (
                <div key={campaign.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">#{index + 1}</span>
                    <span className="text-sm truncate max-w-[120px]">{campaign.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatCurrency(campaign.performance?.totalRevenue || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(campaign.performance?.totalVisits || 0)} visits
                    </div>
                  </div>
                </div>
              ))}
              {topRevenueCampaigns.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No campaigns with revenue data
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Visit Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart className="h-4 w-4 mr-2" />
              Top Visit Campaigns
            </CardTitle>
            <CardDescription>
              Campaigns with highest visit counts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topVisitCampaigns.map((campaign, index) => (
                <div key={campaign.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">#{index + 1}</span>
                    <span className="text-sm truncate max-w-[120px]">{campaign.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatNumber(campaign.performance?.totalVisits || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(campaign.performance?.totalRevenue || 0)} revenue
                    </div>
                  </div>
                </div>
              ))}
              {topVisitCampaigns.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No campaigns with visit data
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <div className="flex justify-end">
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>
    </div>
  );
}