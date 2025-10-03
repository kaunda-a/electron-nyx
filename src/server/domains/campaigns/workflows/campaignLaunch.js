const workflowManager = require('../services/workflowManager');
const campaignManager = require('../services/campaignManager');
const profilePoolManager = require('../../profiles/services/profilePoolManager');
const ItBrowserAPI = require('../../profiles/services/itBrowserAPI');
const WebsiteNavigationService = require('../../profiles/services/websiteNavigationService');
const AdInteractionService = require('../../profiles/services/adInteractionService');
const logger = require('../../../shared/utils/logger');

/**
 * Campaign Launch Workflow
 * Custom workflow for launching campaigns using our workflow engine
 */
async function campaignLaunchWorkflow({ data, step }) {
  const { campaignId, options = {} } = data;
  const { profileCount = 1, profileIds = [], launchSettings = {} } = options;
  
  logger.info(`Starting campaign launch workflow for campaign ${campaignId}`, { 
    profileCount, 
    profileIds,
    launchSettings 
  });
  
  // Step 1: Validate campaign exists and is active
  const campaign = await step.run("validate-campaign", async () => {
    logger.info(`Validating campaign ${campaignId}`);
    
    // Initialize campaign manager if not already initialized
    if (!campaignManager.isInitialized) {
      await campaignManager.initialize();
    }
    
    const campaign = campaignManager.getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    
    if (campaign.status !== 'active') {
      throw new Error(`Campaign ${campaignId} is not active`);
    }
    
    logger.info(`Campaign ${campaignId} validated successfully`);
    return campaign;
  });
  
  // Step 2: Get profiles to launch
  let profilesToLaunch = [];
  if (profileIds.length > 0) {
    // Use specified profile IDs
    profilesToLaunch = await step.run("get-specified-profiles", async () => {
      logger.info(`Using specified profile IDs for campaign ${campaignId}`);
      const profiles = [];
      for (const profileId of profileIds) {
        const profile = profilePoolManager.getProfileById(profileId);
        if (profile) {
          // Ensure profile has an assigned proxy
          if (!profile.assignedProxy) {
            logger.warn(`Profile ${profileId} does not have an assigned proxy, attempting to assign one`);
            try {
              await profilePoolManager.assignProxyToProfile(profileId);
              // Reload the profile to get the assigned proxy
              const updatedProfile = profilePoolManager.getProfileById(profileId);
              if (updatedProfile && updatedProfile.assignedProxy) {
                profiles.push(updatedProfile);
                logger.info(`Successfully assigned proxy to profile ${profileId}`);
              } else {
                logger.warn(`Failed to assign proxy to profile ${profileId}`);
              }
            } catch (assignError) {
              logger.error(`Error assigning proxy to profile ${profileId}:`, assignError.message);
            }
          } else {
            profiles.push(profile);
          }
        }
      }
      logger.info(`Found ${profiles.length} specified profiles for campaign ${campaignId}`);
      return profiles;
    });
  } else {
    // Get available profiles from pool
    profilesToLaunch = await step.run("get-available-profiles", async () => {
      logger.info(`Getting available profiles for campaign ${campaignId}`);
      const allProfiles = profilePoolManager.getAllProfiles();
      
      // Filter for non-active profiles with assigned proxies
      const availableProfiles = allProfiles.filter(p => 
        !p.isActive && 
        p.assignedProxy && 
        p.assignedProxy.isActive
      );
      
      // If we don't have enough profiles with assigned proxies, try to assign proxies to some
      if (availableProfiles.length < profileCount) {
        logger.warn(`Not enough profiles with assigned proxies (${availableProfiles.length} < ${profileCount}), attempting to assign proxies to more profiles`);
        
        // Get profiles without assigned proxies
        const profilesNeedingProxy = allProfiles.filter(p => 
          !p.isActive && 
          (!p.assignedProxy || !p.assignedProxy.isActive)
        );
        
        // Try to assign proxies to some of these profiles
        for (let i = 0; i < Math.min(profileCount - availableProfiles.length, profilesNeedingProxy.length); i++) {
          try {
            const profile = profilesNeedingProxy[i];
            await profilePoolManager.assignProxyToProfile(profile.id);
            // Reload the profile to get the assigned proxy
            const updatedProfile = profilePoolManager.getProfileById(profile.id);
            if (updatedProfile && updatedProfile.assignedProxy) {
              availableProfiles.push(updatedProfile);
              logger.info(`Successfully assigned proxy to profile ${profile.id}`);
            }
          } catch (assignError) {
            logger.error(`Error assigning proxy to profile ${profilesNeedingProxy[i].id}:`, assignError.message);
          }
        }
      }
      
      // Take up to profileCount profiles
      const selectedProfiles = availableProfiles
        .slice(0, Math.min(profileCount, availableProfiles.length));
      
      logger.info(`Selected ${selectedProfiles.length} profiles for campaign ${campaignId}`);
      return selectedProfiles;
    });
  }
  
  if (profilesToLaunch.length === 0) {
    throw new Error(`No available profiles for campaign ${campaignId}`);
  }
  
  // Validate that all profiles have assigned proxies
  const profilesWithoutProxy = profilesToLaunch.filter(p => !p.assignedProxy);
  if (profilesWithoutProxy.length > 0) {
    throw new Error(`Some profiles do not have assigned proxies: ${profilesWithoutProxy.map(p => p.id).join(', ')}`);
  }
  
  // Validate that all assigned proxies are active
  const profilesWithInactiveProxy = profilesToLaunch.filter(p => p.assignedProxy && !p.assignedProxy.isActive);
  if (profilesWithInactiveProxy.length > 0) {
    throw new Error(`Some profiles have inactive proxies: ${profilesWithInactiveProxy.map(p => p.id).join(', ')}`);
  }
  
  // Step 3: Launch profiles directly (without separate workflow events)
  const profileLaunchResults = await step.run("launch-profiles", async () => {
    logger.info(`Launching ${profilesToLaunch.length} profiles directly for campaign ${campaignId}`);
    
    const results = [];
    const errors = [];
    
    // Launch profiles with staggered delays to avoid overwhelming the system
    for (let i = 0; i < profilesToLaunch.length; i++) {
      const profile = profilesToLaunch[i];
      const delay = i * 2000; // 2 second delay between profile launches
      
      try {
        // Add delay between launches
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        logger.info(`Launching profile ${profile.id} directly for campaign ${campaignId}`);
        
        // Mark profile as active
        profile.isActive = true;
        profile.session.currentSessionId = `session_${Date.now()}`;
        profile.session.sessionStartTime = new Date().toISOString();
        
        // Generate fingerprint for the profile
        const itBrowserAPI = new ItBrowserAPI();
        const fingerprint = await itBrowserAPI.generateFingerprint(profile, {
          geographic: profile.geographic
        });
        
        // Launch browser with profile's assigned proxy
        const browserResult = await itBrowserAPI.launchBrowser(fingerprint.id, {
          proxy: profile.assignedProxy,
          useProxy: true, // Explicitly set to true to ensure proxy is used
          ...launchSettings
        });
        
        // Navigate to campaign URLs
        const websiteNavigationService = new WebsiteNavigationService();
        const navigationResults = [];
        
        if (campaign.targets.urls.length > 0) {
          // Select random URLs from campaign targets
          const urlsToVisit = [];
          const maxUrls = Math.min(5, campaign.targets.urls.length);
          const numUrls = Math.floor(Math.random() * maxUrls) + 1;
          
          for (let j = 0; j < numUrls; j++) {
            const randomIndex = Math.floor(Math.random() * campaign.targets.urls.length);
            urlsToVisit.push(campaign.targets.urls[randomIndex]);
          }
          
          // Navigate to selected URLs
          for (const url of urlsToVisit) {
            try {
              const navResult = await websiteNavigationService.navigateToWebsite(browserResult.browserId, url, {
                campaignId: campaignId,
                maxPages: campaign.settings.sessionDuration.max / 60,
                scrollBehavior: 'natural',
                clickBehavior: 'random'
              });
              navigationResults.push(navResult);
            } catch (navError) {
              logger.error('Failed to navigate to URL', { 
                error: navError.message, 
                url, 
                profileId: profile.id 
              });
            }
          }
        }
        
        // Interact with ads
        const adInteractionService = new AdInteractionService();
        const adResults = [];
        
        try {
          const adResult = await adInteractionService.interactWithAds(browserResult.browserId, {
            campaignId: campaignId,
            clickRate: campaign.settings.clickRate,
            bounceRate: campaign.settings.bounceRate,
            adNetworks: campaign.targeting.adNetworks,
            adFormats: campaign.targeting.adFormats
          });
          adResults.push(adResult);
        } catch (adError) {
          logger.error('Failed to interact with ads', { 
            error: adError.message, 
            profileId: profile.id 
          });
        }
        
        // Close browser
        try {
          await itBrowserAPI.closeBrowser(browserResult.browserId);
        } catch (closeError) {
          logger.error('Failed to close browser', { 
            error: closeError.message, 
            profileId: profile.id 
          });
        }
        
        // Mark profile as inactive
        profile.isActive = false;
        profile.session.currentSessionId = null;
        profile.session.sessionStartTime = null;
        
        // Update campaign statistics
        campaign.performance.totalVisits += 1;
        campaign.performance.lastUpdated = new Date().toISOString();
        await campaignManager.saveCampaign(campaign);
        
        results.push({
          profileId: profile.id,
          browserId: browserResult.browserId,
          status: 'completed',
          navigationResults: navigationResults.length,
          adResults: adResults.length
        });
        
        logger.info(`Completed profile ${profile.id} launch for campaign ${campaignId}`);
      } catch (error) {
        logger.error('Failed to launch profile for campaign', { 
          error: error.message, 
          profileId: profile.id, 
          campaignId 
        });
        
        // Mark profile as inactive on error
        profile.isActive = false;
        profile.session.currentSessionId = null;
        profile.session.sessionStartTime = null;
        
        errors.push({
          profileId: profile.id,
          error: error.message,
          status: 'failed'
        });
      }
    }
    
    return { results, errors };
  });
  
  // Step 4: Update campaign statistics
  await step.run("update-campaign-stats", async () => {
    logger.info(`Updating campaign statistics for campaign ${campaignId}`);
    
    // Update campaign statistics
    campaign.performance.totalVisits += profileLaunchResults.results.length;
    campaign.performance.lastUpdated = new Date().toISOString();
    
    // Save updated campaign
    await campaignManager.saveCampaign(campaign);
    
    logger.info(`Campaign ${campaignId} statistics updated`);
    return { updated: true };
  });
  
  logger.info(`Campaign launch workflow completed for campaign ${campaignId}`);
  
  // Send completion event
  await step.sendEvent("campaign/launch.completed", {
    data: {
      campaignId,
      profilesCompleted: profileLaunchResults.results.length,
      profilesFailed: profileLaunchResults.errors.length,
      results: profileLaunchResults
    }
  });
  
  return { 
    success: true, 
    campaignId,
    profilesCompleted: profileLaunchResults.results.length,
    profilesFailed: profileLaunchResults.errors.length
  };
}

// Register the workflow with our workflow manager
workflowManager.registerWorkflow('campaign-launch', campaignLaunchWorkflow);

module.exports = {
  campaignLaunchWorkflow
};