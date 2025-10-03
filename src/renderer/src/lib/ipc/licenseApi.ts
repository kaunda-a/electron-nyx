import { useState, useEffect } from 'react';

/**
 * License and Subscription IPC API
 * Provides client-side access to license management features
 */

// Dynamically access ipcRenderer from the exposed API
const getIpcRenderer = () => {
  if (typeof window !== 'undefined' && (window as any).api) {
    return (window as any).api;
  }
  throw new Error('IPC API not available. Make sure the preload script is properly configured.');
};

export interface SubscriptionTier {
  name: string;
  price: number;
  maxProfiles: number;
  maxCampaigns: number;
  maxProxies: number;
  maxConcurrentSessions: number;
  features: string[];
  limitations: string[];
}

export interface UserSubscription {
  userId: string;
  tier: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  tierInfo: SubscriptionTier;
}

export interface QuotaInfo {
  withinLimit: boolean;
  maxLimit: number;
  currentCount: number;
  remaining: number;
  usagePercentage: number;
  tier: string;
  upgradeRecommended?: boolean;
}

export interface LicenseAnalytics {
  subscription: UserSubscription;
  usage: Record<string, any>;
  createdAt: string;
}

export interface UpgradeRecommendation {
  recommended: boolean;
  reason?: string;
  currentTier?: string;
  recommendedTier?: string;
  benefits?: string[];
  priceDifference?: number;
}

/**\n * Payment API client\n */
export const paymentApi = {
  /**
   * Create a checkout session for purchasing profiles
   */
  async createCheckoutSession(options: {
    quantity: number;
    price: number;
    userId: string;
    userEmail?: string;
    productName?: string;
    productDescription?: string;
  }): Promise<any> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.payments.createCheckoutSession(options);
      return response.data;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      throw error;
    }
  },

  /**
   * Validate a payment session after completion
   */
  async validatePayment(sessionId: string): Promise<any> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.payments.validatePayment(sessionId);
      return response.data;
    } catch (error) {
      console.error('Failed to validate payment:', error);
      throw error;
    }
  }
};

/**
 * License API client
 */
export const licenseApi = {
  /**
   * Get available subscription tiers
   */
  async getTiers(): Promise<Record<string, SubscriptionTier>> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.getTiers();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch subscription tiers:', error);
      throw error;
    }
  },

  /**
   * Get user's current subscription
   */
  async getSubscription(): Promise<UserSubscription> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.getSubscription();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user subscription:', error);
      throw error;
    }
  },

  /**
   * Get user analytics and usage data
   */
  async getAnalytics(): Promise<LicenseAnalytics> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.getAnalytics();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
      throw error;
    }
  },

  /**
   * Get upgrade recommendation
   */
  async getUpgradeRecommendation(): Promise<UpgradeRecommendation> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.getUpgradeRecommendation();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch upgrade recommendation:', error);
      throw error;
    }
  },

  /**
   * Validate subscription status
   */
  async validateSubscription(): Promise<{ valid: boolean; reason?: string }> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.validateSubscription();
      return response.data;
    } catch (error) {
      console.error('Failed to validate subscription:', error);
      throw error;
    }
  },

  /**
   * Upgrade subscription tier
   */
  async upgradeSubscription(tier: string, paymentMethod?: string): Promise<UserSubscription> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.upgradeSubscription({ tier, paymentMethod });
      return response.data;
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      throw error;
    }
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<UserSubscription> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.cancelSubscription();
      return response.data;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw error;
    }
  },

  /**
   * Get user quota information
   */
  async getQuotas(): Promise<{
    subscription: UserSubscription;
    quotas: Record<string, QuotaInfo>;
    limits: Record<string, number>;
  }> {
    try {
      const ipc = getIpcRenderer();
      const response = await ipc.license.getQuotas();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch quota information:', error);
      throw error;
    }
  }
};

/**
 * Hook for easy access to license information
 */
export const useLicense = () => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const data = await licenseApi.getSubscription();
        setSubscription(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  return { subscription, loading, error, refetch: () => licenseApi.getSubscription() };
};

/**
 * Hook for checking specific resource quotas
 */
export const useResourceQuota = (resource: string) => {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuota = async () => {
      try {
        setLoading(true);
        const quotas = await licenseApi.getQuotas();
        const resourceQuota = quotas.quotas[resource];
        setQuota(resourceQuota || null);
      } catch (error) {
        console.error(`Failed to fetch ${resource} quota:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuota();
  }, [resource]);

  return { quota, loading };
};

export default licenseApi;

// Export payment API as well for consistency
export { paymentApi };