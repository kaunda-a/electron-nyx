import React, { useState, useCallback, createContext, useContext, ReactNode, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Campaign, CampaignStats } from '../data/schema';
import { campaignsApi } from '../api';
import { CampaignValidator } from '../utils/validation';
import { CampaignErrorHandler } from '../utils/error-handler';
// Import profiles context and API to manage profiles used by campaigns
import { useProfiles } from '@/admin/profiles/context/profile-context';
import { profilesApi } from '@/admin/profiles/api/profiles-api';

// Define filter and pagination types
export interface CampaignFilters {
  search?: string;
  status?: string;
  type?: string;
  priority?: string;
  minRevenue?: number;
  maxRevenue?: number;
  minVisits?: number;
  maxVisits?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

  // Define campaign context state
interface CampaignContextState {
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  isLoading: boolean;
  error: Error | null;
  filters: CampaignFilters;
  stats: CampaignStats | null;

  // Campaign CRUD operations
  createCampaign: (data: Partial<Campaign>) => Promise<Campaign>;
  updateCampaign: (id: string, data: Partial<Campaign>) => Promise<Campaign>;
  deleteCampaign: (id: string) => Promise<void>;
  getCampaign: (id: string) => Promise<Campaign>;

  // Campaign duplication
  duplicateCampaign: (id: string) => Promise<Campaign>;

  // Bulk campaign operations
  bulkDeleteCampaigns: (ids: string[]) => Promise<void>;
  bulkUpdateCampaigns: (ids: string[], data: Partial<Campaign>) => Promise<void>;

  // Campaign export/import
  exportCampaigns: (campaignIds?: string[]) => Promise<any>;
  importCampaigns: (data: any) => Promise<any>;

  // Campaign launch and progress
  launchCampaign: (campaignId: string, options?: any) => Promise<any>;
  getCampaignProgress: (campaignId: string) => Promise<any>;

  // Campaign stats
  fetchCampaignStats: () => Promise<CampaignStats>;

  // UI state
  setFilters: (filters: CampaignFilters) => void;
  selectCampaign: (campaign: Campaign | null) => void;

  // Refetch data
  refetchCampaigns: () => Promise<void>;
  
  // Cache management
  clearCache: () => void;
  
  // Profile management for campaigns
  getCampaignProfiles: (campaignId: string) => Promise<any[]>;
  validateCampaignProfiles: (campaignId: string) => Promise<{ valid: boolean; message: string }>;
}

// Create the context
const CampaignContext = createContext<CampaignContextState | undefined>(undefined);

// Create a provider component
export const CampaignProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const {
    profiles,
    isLoading: profilesLoading,
    assignProxyToProfile,
    refetchProfiles
  } = useProfiles();

  // State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [filters, setFilters] = useState<CampaignFilters>({
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await campaignsApi.list();
      
      // Apply filters
      const filteredData = data.filter(campaign => {
        // Search filter
        if (filters.search && !(campaign.name || '').toLowerCase().includes(filters.search.toLowerCase())) {
          return false;
        }

        // Status filter
        if (filters.status && campaign.status !== filters.status) {
          return false;
        }
        
        // Type filter
        if (filters.type && campaign.type !== filters.type) {
          return false;
        }
        
        // Priority filter
        if (filters.priority && campaign.priority !== filters.priority) {
          return false;
        }
        
        // Revenue filters
        if (filters.minRevenue !== undefined && (campaign.performance?.totalRevenue || 0) < filters.minRevenue) {
          return false;
        }
        
        if (filters.maxRevenue !== undefined && (campaign.performance?.totalRevenue || 0) > filters.maxRevenue) {
          return false;
        }
        
        // Visits filters
        if (filters.minVisits !== undefined && (campaign.performance?.totalVisits || 0) < filters.minVisits) {
          return false;
        }
        
        if (filters.maxVisits !== undefined && (campaign.performance?.totalVisits || 0) > filters.maxVisits) {
          return false;
        }
        
        // Date filters
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          const campaignDate = new Date(campaign.createdAt);
          if (campaignDate < fromDate) {
            return false;
          }
        }
        
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          const campaignDate = new Date(campaign.createdAt);
          if (campaignDate > toDate) {
            return false;
          }
        }

        return true;
      }).sort((a, b) => {
        // Sort by the specified field
        const sortBy = filters.sortBy || 'createdAt';
        const sortOrder = filters.sortOrder || 'desc';

        // Handle different field types
        if (sortBy === 'name') {
          const aName = a.name || '';
          const bName = b.name || '';
          return sortOrder === 'asc'
            ? aName.localeCompare(bName)
            : bName.localeCompare(aName);
        }

        // Date fields
        if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
          const aDate = new Date(a[sortBy] || 0).getTime();
          const bDate = new Date(b[sortBy] || 0).getTime();
          return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
        }
        
        // Performance fields
        if (sortBy === 'totalRevenue') {
          const aRevenue = a.performance?.totalRevenue || 0;
          const bRevenue = b.performance?.totalRevenue || 0;
          return sortOrder === 'asc' ? aRevenue - bRevenue : bRevenue - aRevenue;
        }
        
        if (sortBy === 'totalVisits') {
          const aVisits = a.performance?.totalVisits || 0;
          const bVisits = b.performance?.totalVisits || 0;
          return sortOrder === 'asc' ? aVisits - bVisits : bVisits - aVisits;
        }

        return 0;
      });
      
      setCampaigns(filteredData);
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'fetch campaigns');
      setError(new Error(apiError.message));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const fetchCampaignStats = useCallback(async () => {
    try {
      const statsData = await campaignsApi.getStats();
      setStats(statsData);
      return statsData;
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'fetch campaign stats');
      throw new Error(apiError.message);
    }
  }, []);

  // Handler functions
  const createCampaign = useCallback(async (data: Partial<Campaign>) => {
    try {
      // Validate campaign data
      const validationErrors = CampaignValidator.validateCreate(data);
      if (CampaignValidator.hasErrors(validationErrors)) {
        CampaignValidator.handleValidationErrors(validationErrors);
        throw new Error('Validation failed');
      }

      const campaign = await campaignsApi.create(data);
      await fetchCampaigns();
      CampaignErrorHandler.handleSuccess('Campaign created', 'The campaign has been created successfully.');
      return campaign;
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'create campaign');
      throw new Error(apiError.message);
    }
  }, [fetchCampaigns]);

  const updateCampaign = useCallback(async (id: string, data: Partial<Campaign>) => {
    try {
      // Validate campaign data
      const validationErrors = CampaignValidator.validateUpdate(data);
      if (CampaignValidator.hasErrors(validationErrors)) {
        CampaignValidator.handleValidationErrors(validationErrors);
        throw new Error('Validation failed');
      }

      const campaign = await campaignsApi.update(id, data);
      await fetchCampaigns();
      
      // Show specific message based on what was updated
      if (data.status === 'active') {
        CampaignErrorHandler.handleSuccess('Campaign started', 'The campaign has been started successfully.');
      } else if (data.status === 'paused') {
        CampaignErrorHandler.handleSuccess('Campaign paused', 'The campaign has been paused successfully.');
      } else {
        CampaignErrorHandler.handleSuccess('Campaign updated', 'The campaign has been updated successfully.');
      }
      
      return campaign;
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'update campaign');
      throw new Error(apiError.message);
    }
  }, [fetchCampaigns]);

  const deleteCampaign = useCallback(async (id: string) => {
    try {
      await campaignsApi.delete(id);
      await fetchCampaigns();
      CampaignErrorHandler.handleSuccess('Campaign deleted', 'The campaign has been deleted successfully.');
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'delete campaign');
      throw new Error(apiError.message);
    }
  }, [fetchCampaigns]);

  const getCampaign = useCallback(async (id: string) => {
    try {
      return await campaignsApi.get(id);
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'get campaign');
      throw new Error(apiError.message);
    }
  }, []);

  const duplicateCampaign = useCallback(async (id: string) => {
    try {
      // Get the original campaign
      const originalCampaign = await getCampaign(id);
      
      // Create a new campaign based on the original
      const newCampaignData = {
        ...originalCampaign,
        name: `${originalCampaign.name} (Copy)`,
        status: 'draft' as const, // Start as draft
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user', // Or however you want to track this
        performance: {
          totalVisits: 0,
          totalClicks: 0,
          totalRevenue: 0,
          avgSessionDuration: 0,
          avgCTR: 0,
          errorRate: 0,
          lastUpdated: null
        }
      };
      
      // Remove ID since it will be generated
      delete (newCampaignData as any).id;
      
      const campaign = await campaignsApi.create(newCampaignData);
      await fetchCampaigns();
      CampaignErrorHandler.handleSuccess('Campaign duplicated', 'The campaign has been duplicated successfully.');
      return campaign;
    } catch (err) {
      console.error('Failed to duplicate campaign:', err);
      const apiError = CampaignErrorHandler.handleApiError(err, 'duplicate campaign');
      throw new Error(apiError.message);
    }
  }, [getCampaign, fetchCampaigns]);

  const launchCampaign = useCallback(async (campaignId: string, options: any = {}) => {
    try {
      // Get the campaign to validate it
      const campaign = await getCampaign(campaignId);
      
      // Validate the campaign before launching
      const validationErrors = CampaignValidator.validateLaunch(campaign);
      if (CampaignValidator.hasErrors(validationErrors)) {
        CampaignValidator.handleValidationErrors(validationErrors);
        throw new Error('Validation failed');
      }

      const result = await campaignsApi.launch(campaignId, options);
      CampaignErrorHandler.handleSuccess('Campaign launched', 'The campaign has been launched successfully.');
      return result;
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'launch campaign');
      throw new Error(apiError.message);
    }
  }, [getCampaign]);

  const getCampaignProgress = useCallback(async (campaignId: string) => {
    try {
      return await campaignsApi.getProgress(campaignId);
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'get campaign progress');
      throw new Error(apiError.message);
    }
  }, []);

  const bulkDeleteCampaigns = useCallback(async (ids: string[]) => {
    try {
      // Delete campaigns in parallel
      await Promise.all(ids.map(id => deleteCampaign(id)));
      
      CampaignErrorHandler.handleSuccess('Campaigns deleted', `${ids.length} campaign(s) have been deleted successfully.`);
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'delete campaigns');
      throw new Error(apiError.message);
    }
  }, [deleteCampaign]);

  const bulkUpdateCampaigns = useCallback(async (ids: string[], data: Partial<Campaign>) => {
    try {
      // Update campaigns in parallel
      await Promise.all(ids.map(id => updateCampaign(id, data)));
      
      // Show specific message based on what was updated
      if (data.status === 'active') {
        CampaignErrorHandler.handleSuccess('Campaigns started', `${ids.length} campaign(s) have been started successfully.`);
      } else if (data.status === 'paused') {
        CampaignErrorHandler.handleSuccess('Campaigns paused', `${ids.length} campaign(s) have been paused successfully.`);
      } else {
        CampaignErrorHandler.handleSuccess('Campaigns updated', `${ids.length} campaign(s) have been updated successfully.`);
      }
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'update campaigns');
      throw new Error(apiError.message);
    }
  }, [updateCampaign]);

  const exportCampaigns = useCallback(async (campaignIds?: string[]) => {
    try {
      const data = await campaignsApi.export(campaignIds);
      
      // Create a Blob with the data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaigns-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      CampaignErrorHandler.handleSuccess('Campaigns exported', 'Campaign data has been exported successfully.');
      
      return data;
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'export campaigns');
      throw new Error(apiError.message);
    }
  }, []);

  const importCampaigns = useCallback(async (data: any) => {
    try {
      const result = await campaignsApi.import(data);
      
      // Refresh campaigns after import
      await fetchCampaigns();
      
      CampaignErrorHandler.handleSuccess('Campaigns imported', `${result.imported || 0} campaign(s) have been imported successfully.`);
      
      return result;
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'import campaigns');
      throw new Error(apiError.message);
    }
  }, [fetchCampaigns]);

  const selectCampaign = useCallback((campaign: Campaign | null) => {
    setSelectedCampaign(campaign);
  }, []);

  const refetchCampaigns = useCallback(async () => {
    await fetchCampaigns();
  }, [fetchCampaigns]);

  const clearCache = useCallback(() => {
    campaignsApi.clearCache();
    toast({
      title: 'Cache cleared',
      description: 'Campaign data cache has been cleared.',
    });
  }, [toast]);

  // Profile management functions for campaigns
  const getCampaignProfiles = useCallback(async (campaignId: string) => {
    try {
      // Get the campaign
      const campaign = await getCampaign(campaignId);
      
      // Get all profiles that have assigned proxies (filtered by the profiles context)
      const profiles = await profilesApi.list({ hasProxy: true });
      
      // Return profiles based on campaign assignment type
      if (campaign.profiles?.assignmentType === 'manual' && campaign.profiles.assignedProfiles) {
        // Return manually assigned profiles that have proxies
        return profiles.filter(profile => 
          campaign.profiles.assignedProfiles.includes(profile.id)
        );
      } else if (campaign.profiles?.assignmentType === 'category') {
        // Return profiles based on category distribution that have proxies
        return profiles.filter(profile => {
          const category = profile.config?.category || 'newVisitor';
          return campaign.profiles.categoryDistribution && 
                 campaign.profiles.categoryDistribution[category as keyof typeof campaign.profiles.categoryDistribution] > 0;
        });
      } else {
        // Auto assignment - return all profiles with proxies (or apply some filtering logic)
        return profiles;
      }
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'get campaign profiles');
      throw new Error(apiError.message);
    }
  }, [getCampaign]);

  const validateCampaignProfiles = useCallback(async (campaignId: string) => {
    try {
      // Get campaign profiles that have assigned proxies
      const campaignProfiles = await getCampaignProfiles(campaignId);
      
      // Get the campaign to check assignment type
      const campaign = await getCampaign(campaignId);
      
      let expectedProfileCount = 0;
      
      if (campaign.profiles?.assignmentType === 'manual' && campaign.profiles.assignedProfiles) {
        // For manual assignment, check if all assigned profiles have proxies
        expectedProfileCount = campaign.profiles.assignedProfiles.length;
      } else if (campaign.profiles?.assignmentType === 'category') {
        // For category assignment, we can't easily determine expected count
        // Just validate that we have some profiles with proxies
        if (campaignProfiles.length === 0) {
          return {
            valid: false,
            message: 'No profiles with assigned proxies found. Anti-detection system cannot function without proxies.'
          };
        }
        return {
          valid: true,
          message: `Found ${campaignProfiles.length} profile(s) with assigned proxies. Ready for anti-detection system.`
        };
      } else {
        // Auto assignment - check if we have profiles with proxies
        if (campaignProfiles.length === 0) {
          return {
            valid: false,
            message: 'No profiles with assigned proxies found. Anti-detection system cannot function without proxies.'
          };
        }
        return {
          valid: true,
          message: `Found ${campaignProfiles.length} profile(s) with assigned proxies. Ready for anti-detection system.`
        };
      }
      
      // For manual assignment, check if we have all expected profiles
      if (campaign.profiles?.assignmentType === 'manual') {
        if (campaignProfiles.length < expectedProfileCount) {
          const missingCount = expectedProfileCount - campaignProfiles.length;
          return {
            valid: false,
            message: `${missingCount} of the assigned profiles do not have proxies. This may affect the anti-detection system.`
          };
        }
        
        if (campaignProfiles.length === 0) {
          return {
            valid: false,
            message: 'No profiles with assigned proxies found. Anti-detection system cannot function without proxies.'
          };
        }
        
        return {
          valid: true,
          message: `All ${campaignProfiles.length} assigned profile(s) have proxies. Ready for anti-detection system.`
        };
      }
      
      return {
        valid: true,
        message: 'Campaign profiles validated successfully.'
      };
    } catch (err) {
      const apiError = CampaignErrorHandler.handleApiError(err, 'validate campaign profiles');
      throw new Error(apiError.message);
    }
  }, [getCampaignProfiles, getCampaign]);

  // Context value
  const value: CampaignContextState = {
    campaigns,
    selectedCampaign,
    isLoading,
    error,
    filters,
    stats,

    // Campaign CRUD operations
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaign,

    // Campaign duplication
    duplicateCampaign,

    // Bulk campaign operations
    bulkDeleteCampaigns,
    bulkUpdateCampaigns,

    // Campaign export/import
    exportCampaigns,
    importCampaigns,

    // Campaign launch and progress
    launchCampaign,
    getCampaignProgress,

    // Campaign stats
    fetchCampaignStats,

    // UI state
    setFilters,
    selectCampaign,

    // Refetch data
    refetchCampaigns,
    
    // Cache management
    clearCache,
    
    // Profile management for campaigns
    getCampaignProfiles,
    validateCampaignProfiles
  };

  // Fetch campaigns on component mount
  useEffect(() => {
    fetchCampaigns();
    fetchCampaignStats();
  }, [fetchCampaigns, fetchCampaignStats]);

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
};

// Create a hook to use the context
export const useCampaigns = () => {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error('useCampaigns must be used within a CampaignProvider');
  }
  return context;
};