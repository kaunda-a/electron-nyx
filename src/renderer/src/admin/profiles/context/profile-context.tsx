import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  profilesApi,
  Profile,
  ProfileCreate,
  ProfileUpdate,
  ProfileStats,
  FingerprintData,
  ProxyConfig,
  ProfileFilters
} from '../api/profiles-api';
import { proxiesApi } from '../../proxies/api/proxies-api';
import type { ProxyConfig as ProxyResponse } from '../../proxies/data/schema';

// Profile Context - Fixed syntax errors
// This file provides the profile management context for the application
export interface ProfileLaunchOptions {
  headless?: boolean;
  useProxy?: boolean;
  geoip?: boolean;
  humanize?: boolean;
}

// Define profile context state
interface ProfileContextState {
  profiles: Profile[];
  selectedProfile: Profile | null;
  isLoading: boolean;
  error: Error | null;
  filters: ProfileFilters;
  proxies: ProxyResponse[];
  activeProfiles: Record<string, {
    isRunning: boolean;
    hasProxy: boolean;
    launchTime?: Date;
  }>;

  // Profile CRUD operations
  createProfile: (data: ProfileCreate) => Promise<Profile>;
  updateProfile: (id: string, data: ProfileUpdate) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
  getProfile: (id: string) => Promise<Profile>;

  // Profile actions
  launchProfile: (id: string, options?: ProfileLaunchOptions) => Promise<Record<string, any>>;
  closeBrowser: (id: string) => Promise<Record<string, any>>;
  getFingerprint: (id: string) => Promise<FingerprintData>;
  getProfileStats: (id: string) => Promise<ProfileStats>;

  // Proxy operations
  assignProxyToProfile: (profileId: string, proxyId?: string) => Promise<void>;
  removeProxyFromProfile: (profileId: string) => Promise<void>;

  // UI state
  setFilters: (filters: ProfileFilters) => void;
  selectProfile: (profile: Profile | null) => void;

  // Refetch data
  refetchProfiles: () => Promise<void>;
  refetchProxies: () => Promise<void>;
}

// Create the context
const ProfileContext = createContext<ProfileContextState | undefined>(undefined);

// Create a provider component
export const ProfileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [filters, setFilters] = useState<ProfileFilters>({
    sortBy: 'updated_at',
    sortOrder: 'desc'
  });
  const [activeProfiles, setActiveProfiles] = useState<Record<string, {
    isRunning: boolean;
    hasProxy: boolean;
    launchTime?: Date;
  }>>({});

  // Queries
  const {
    data: profiles = [],
    isLoading: isLoadingProfiles,
    error: profilesError,
    refetch: refetchProfilesQuery
  } = useQuery({
    queryKey: ['profiles', filters],
    queryFn: () => {
      console.log('Fetching profiles with filters:', filters);
      return profilesApi.list(filters);
    }
  });

  const {
    data: proxies = [],
    refetch: refetchProxiesQuery
  } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => {
      console.log('Fetching proxies');
      return proxiesApi.list();
    }
  });

  // Mutations
  const createProfileMutation = useMutation({
    mutationFn: (data: ProfileCreate) => profilesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: 'Profile created',
        description: 'The profile has been created successfully.',
        variant: 'default'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create profile',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProfileUpdate }) =>
      profilesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: 'Profile updated',
        description: 'The profile has been updated successfully.',
        variant: 'default'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update profile',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const deleteProfileMutation = useMutation({
    mutationFn: (id: string) => profilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({
        title: 'Profile deleted',
        description: 'The profile has been deleted successfully.',
        variant: 'default'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to delete profile',
        description: error.message,
        variant: 'destructive'
      });
    }
  }); // Added semicolon here

  const assignProxyMutation = useMutation({
    mutationFn: ({ profileId, proxyId }: { profileId: string; proxyId?: string }) =>
      profilesApi.assignProxyToProfile(profileId, proxyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['proxies'] });
      toast({
        title: 'Proxy assigned',
        description: 'The proxy has been assigned to the profile successfully.',
        variant: 'default'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to assign proxy',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Handler functions
  const createProfile = useCallback(async (data: ProfileCreate) => {
    const profile = await createProfileMutation.mutateAsync(data);
    return profile;
  }, [createProfileMutation]);

  const updateProfile = useCallback(async (id: string, data: ProfileUpdate) => {
    const profile = await updateProfileMutation.mutateAsync({ id, data });
    return profile;
  }, [updateProfileMutation]);

  const deleteProfile = useCallback(async (id: string) => {
    await deleteProfileMutation.mutateAsync(id);
  }, [deleteProfileMutation]);

  const getProfile = useCallback(async (id: string) => {
    return profilesApi.get(id);
  }, []);

  const launchProfile = useCallback(async (id: string, options: ProfileLaunchOptions = {}) => {
    try {
      const result = await profilesApi.launch(id, {
        headless: options.headless ?? false,
        useProxy: options.useProxy ?? true,
        geoip: options.geoip,
        humanize: options.humanize
      });
      setActiveProfiles(prev => ({
        ...prev,
        [id]: {
          isRunning: true,
          hasProxy: result.has_proxy || false,
          launchTime: new Date()
        }
      }));
      toast({
        title: 'Profile launched',
        description: 'The browser has been launched successfully.',
        variant: 'default'
      });
      return result;
    } catch (error) {
      toast({
        title: 'Failed to launch profile',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  const closeBrowser = useCallback(async (id: string) => {
    try {
      const result = await profilesApi.closeBrowser(id);
      setActiveProfiles(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
      toast({
        title: 'Browser closed',
        description: 'The browser has been closed successfully.',
        variant: 'default'
      });
      return result;
    } catch (error) {
      toast({
        title: 'Failed to close browser',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
      throw error;
    }
  }, [toast]);

  const getFingerprint = useCallback(async (id: string) => {
    const fingerprint = await profilesApi.getFingerprint(id);
    return fingerprint;
  }, []);

  const getProfileStats = useCallback(async (id: string) => {
    return profilesApi.getStats(id);
  }, []);

  const assignProxyToProfile = useCallback(async (profileId: string, proxyId?: string) => {
    await assignProxyMutation.mutateAsync({ profileId, proxyId });
  }, [assignProxyMutation]);

  const removeProxyFromProfile = useCallback(async (profileId: string) => {
    await updateProfileMutation.mutateAsync({
      id: profileId,
      data: {
        config: {
          proxy: null
        }
      }
    });
  }, [updateProfileMutation]);

  const refetchProfiles = useCallback(async () => {
    await refetchProfilesQuery();
  }, [refetchProfilesQuery]);

  const refetchProxies = useCallback(async () => {
    await refetchProxiesQuery();
  }, [refetchProxiesQuery]);

  const selectProfile = useCallback((profile: Profile | null) => {
    setSelectedProfile(profile);
  }, []);

  // Context value
  const value: ProfileContextState = {
    profiles,
    selectedProfile,
    isLoading: isLoadingProfiles,
    error: profilesError as Error,
    filters,
    proxies,
    activeProfiles,

    // Profile CRUD operations
    createProfile,
    updateProfile,
    deleteProfile,
    getProfile,

    // Profile actions
    launchProfile,
    closeBrowser,
    getFingerprint,
    getProfileStats,

    // Proxy operations
    assignProxyToProfile,
    removeProxyFromProfile,

    // UI state
    setFilters,
    selectProfile,

    // Refetch data
    refetchProfiles,
    refetchProxies
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
} // Removed semicolon here

// Create a hook to use the context
export const useProfiles = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return context;
}