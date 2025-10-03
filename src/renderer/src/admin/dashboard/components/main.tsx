import { useDashboard } from '../context';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

// Entity-specific dashboard components
import { ProfileStats } from './profiles-components/profile-stats';
import { ProfileCharts } from './profiles-components/profile-charts';
import { CampaignStats } from './campaigns-components/campaign-stats';
import { CampaignCharts } from './campaigns-components/campaign-charts';
import { ProxyStats } from './proxies-components/proxy-stats';
import { ProxyCharts } from './proxies-components/proxy-charts';

export const Main = () => {
  const { dashboardData, loading, error, refreshData } = useDashboard();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center max-w-md">
          <div className="h-12 w-12 text-red-500 mx-auto mb-4 flex items-center justify-center">
            <RefreshCw className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-medium text-red-500 mb-2">Failed to Load Dashboard</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={refreshData} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dashboard Header with Refresh */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">System Dashboard</h1>
        <Button 
          onClick={refreshData} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Profiles Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-xl font-semibold mb-4">Profiles Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProfileStats 
            data={dashboardData} 
            loading={loading} 
          />
          <ProfileCharts 
            data={dashboardData} 
            loading={loading} 
          />
        </div>
      </motion.section>

      {/* Campaigns Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h2 className="text-xl font-semibold mb-4">Campaigns Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CampaignStats 
            data={dashboardData} 
            loading={loading} 
          />
          <CampaignCharts 
            data={dashboardData} 
            loading={loading} 
          />
        </div>
      </motion.section>

      {/* Proxies Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h2 className="text-xl font-semibold mb-4">Proxies Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProxyStats 
            data={dashboardData} 
            loading={loading} 
          />
          <ProxyCharts 
            data={dashboardData} 
            loading={loading} 
          />
        </div>
      </motion.section>
    </div>
  );
};