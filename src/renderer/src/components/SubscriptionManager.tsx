import React, { useState, useEffect } from 'react';
import { licenseApi, useLicense, useResourceQuota, SubscriptionTier } from '@/lib/ipc/licenseApi';

/**
 * Subscription Manager Component
 * Displays subscription information and quota usage
 */

const SubscriptionManager: React.FC = () => {
  const { subscription, loading, error, refetch } = useLicense();
  const { quota: profileQuota, loading: quotaLoading } = useResourceQuota('profiles');
  
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [selectedTier, setSelectedTier] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [tiers, setTiers] = useState<Record<string, SubscriptionTier>>({});
  const [tiersLoading, setTiersLoading] = useState(true);

  useEffect(() => {
    if (subscription) {
      setSelectedTier(subscription.tier);
    }
  }, [subscription]);

  // Fetch available subscription tiers
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const fetchedTiers = await licenseApi.getTiers();
        setTiers(fetchedTiers);
      } catch (error) {
        console.error('Failed to fetch subscription tiers:', error);
        // Set some default tiers as fallback
        setTiers({
          free: {
            name: 'Free',
            price: 0,
            maxProfiles: 5,
            maxCampaigns: 2,
            maxProxies: 3,
            maxConcurrentSessions: 1,
            features: ['Basic features', 'Limited support'],
            limitations: ['Profile limit', 'Campaign limit']
          },
          pro: {
            name: 'Pro',
            price: 19,
            maxProfiles: 50,
            maxCampaigns: 10,
            maxProxies: 20,
            maxConcurrentSessions: 5,
            features: ['Advanced features', 'Priority support', 'Increased quotas'],
            limitations: []
          },
          enterprise: {
            name: 'Enterprise',
            price: 49,
            maxProfiles: 200,
            maxCampaigns: 50,
            maxProxies: 100,
            maxConcurrentSessions: 20,
            features: ['All features', '24/7 support', 'Unlimited access', 'Custom quotas'],
            limitations: []
          }
        });
      } finally {
        setTiersLoading(false);
      }
    };

    fetchTiers();
  }, []);

  const handleUpgrade = async () => {
    if (!selectedTier || selectedTier === subscription?.tier) return;
    
    try {
      setIsUpgrading(true);
      await licenseApi.upgradeSubscription(selectedTier);
      await refetch();
      setShowUpgradeModal(false);
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      alert('Failed to upgrade subscription. Please try again.');
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }
    
    try {
      await licenseApi.cancelSubscription();
      await refetch();
      alert('Subscription cancelled successfully.');
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  if (loading) {
    return <div className="p-4">Loading subscription information...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!subscription) {
    return <div className="p-4">No subscription information available.</div>;
  }

  const tierInfo = subscription.tierInfo;
  const isFreeTier = subscription.tier === 'free';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Subscription & Quotas</h2>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            {isFreeTier ? 'Upgrade Plan' : 'Change Plan'}
          </button>
        </div>

        {/* Current Plan */}
        <div className="border rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{tierInfo.name} Plan</h3>
              <p className="text-3xl font-bold text-gray-900">${tierInfo.price}<span className="text-lg font-normal text-gray-500">/month</span></p>
              <p className="text-sm text-gray-500 mt-1">
                {subscription.status === 'active' ? 'Active' : 'Inactive'} • 
                Created: {new Date(subscription.createdAt).toLocaleDateString()}
              </p>
            </div>
            {!isFreeTier && (
              <button
                onClick={handleCancel}
                className="text-red-600 hover:text-red-800 text-sm underline"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>

        {/* Resource Quotas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <QuotaCard 
            title="Profiles" 
            current={profileQuota?.currentCount || 0} 
            max={tierInfo.maxProfiles} 
            unit="profiles"
            percentage={profileQuota?.usagePercentage || 0}
          />
          <QuotaCard 
            title="Campaigns" 
            current={0} // Would come from actual data
            max={tierInfo.maxCampaigns} 
            unit="campaigns"
            percentage={0}
          />
          <QuotaCard 
            title="Proxies" 
            current={0} // Would come from actual data
            max={tierInfo.maxProxies} 
            unit="proxies"
            percentage={0}
          />
          <QuotaCard 
            title="Sessions" 
            current={0} // Would come from actual data
            max={tierInfo.maxConcurrentSessions} 
            unit="sessions"
            percentage={0}
          />
        </div>

        {/* Features */}
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Plan Features</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {tierInfo.features.map((feature, index) => (
              <div key={index} className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700 capitalize">{feature.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Choose Your Plan</h3>
            
            {tiersLoading ? (
              <div className="text-center py-4">Loading subscription options...</div>
            ) : (
              <div className="space-y-3 mb-6">
                {Object.entries(tiers).map(([tierName, tier]) => (
                  <label key={tierName} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="tier"
                      value={tierName}
                      checked={selectedTier === tierName}
                      onChange={(e) => setSelectedTier(e.target.value)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{tier.name}</div>
                      <div className="text-sm text-gray-500">${tier.price}/month</div>
                    </div>
                    {selectedTier === tierName && (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={isUpgrading || selectedTier === subscription?.tier}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpgrading ? 'Upgrading...' : 'Upgrade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface QuotaCardProps {
  title: string;
  current: number;
  max: number;
  unit: string;
  percentage: number;
}

const QuotaCard: React.FC<QuotaCardProps> = ({ title, current, max, unit, percentage }) => {
  const isOverLimit = current >= max && max > 0;
  const isNearLimit = percentage > 80 && !isOverLimit;
  
  return (
    <div className={`border rounded-lg p-4 ${isOverLimit ? 'border-red-300 bg-red-50' : isNearLimit ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-gray-800">{title}</h4>
        <span className={`text-sm font-medium ${isOverLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-600'}`}>
          {current}/{max === Infinity ? '∞' : max}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div 
          className={`h-2 rounded-full ${isOverLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-blue-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      
      <div className="text-xs text-gray-500">
        {percentage > 0 ? `${Math.round(percentage)}% used` : 'None used'}
      </div>
      
      {isNearLimit && (
        <div className="text-xs text-yellow-600 mt-1">
          Approaching limit
        </div>
      )}
      
      {isOverLimit && max > 0 && (
        <div className="text-xs text-red-600 mt-1">
          Limit reached
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;