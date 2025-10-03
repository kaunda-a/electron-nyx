import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DashboardData } from '../api';
import { dashboardApi } from '../api';

// Dashboard context type
interface DashboardContextType {
  dashboardData: DashboardData | null;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  setTimeRange: (range: string) => void;
}

// Create context with default values
const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Dashboard Provider component
export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('7d');
  const [retryCount, setRetryCount] = useState(0);

  // Fetch dashboard data with exponential backoff
  const fetchDashboardData = async (attempt = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await dashboardApi.getDashboardData();
      setDashboardData(data);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(errorMessage);
      console.error('Error fetching dashboard data:', err);
      
      // Exponential backoff retry logic
      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          fetchDashboardData(attempt + 1);
        }, delay);
        setRetryCount(attempt + 1);
      } else {
        setRetryCount(0); // Reset after max retries
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on initial load
  useEffect(() => {
    fetchDashboardData();

    // Set up periodic updates every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);

    return () => clearInterval(interval);
  }, [timeRange]);

  // Function to manually refresh data
  const refreshData = async () => {
    await fetchDashboardData();
  };

  // Simulate real-time updates for a more dynamic experience
  useEffect(() => {
    if (!dashboardData) return;

    const simulateRealTimeUpdates = () => {
      setDashboardData(prevData => {
        if (!prevData) return prevData;
        
        // Create a deep copy to avoid mutation issues
        const newData = JSON.parse(JSON.stringify(prevData));
        
        // Simulate small changes in stats for a more dynamic feel
        if (newData.stats) {
          newData.stats.activeProfiles = Math.max(0, newData.stats.activeProfiles + Math.floor(Math.random() * 3) - 1);
          newData.stats.activeCampaigns = Math.max(0, newData.stats.activeCampaigns + Math.floor(Math.random() * 3) - 1);
          newData.stats.healthyProxies = Math.max(0, newData.stats.healthyProxies + Math.floor(Math.random() * 3) - 1);
        }
        
        // Simulate small changes in campaign performance
        if (newData.campaignPerformance && newData.campaignPerformance.length > 0) {
          const randomIndex = Math.floor(Math.random() * newData.campaignPerformance.length);
          const campaign = newData.campaignPerformance[randomIndex];
          if (campaign) {
            campaign.progress = Math.min(100, Math.max(0, campaign.progress + Math.floor(Math.random() * 5) - 2));
            campaign.successRate = Math.min(100, Math.max(0, campaign.successRate + Math.floor(Math.random() * 3) - 1));
          }
        }
        
        return newData;
      });
    };

    // Update every 5 seconds for a more dynamic feel
    const updateInterval = setInterval(simulateRealTimeUpdates, 5000);
    
    return () => clearInterval(updateInterval);
  }, [dashboardData]);

  // Provide context value
  const value = {
    dashboardData,
    loading,
    error,
    refreshData,
    setTimeRange
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

// Custom hook to use dashboard context
export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};