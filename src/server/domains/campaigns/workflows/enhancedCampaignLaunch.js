const campaignStorageService = require('../services/campaignStorageService');
const dbCampaignStorageService = require('../../../sqlite/dbCampaignStorageService');
const playwrightService = require('../../profiles/services/playwrightService');
const campaignManager = require('../services/campaignManager');
const profilePoolManager = require('../../profiles/services/profilePoolManager');
const ItBrowserAPI = require('../../profiles/services/itBrowserAPI');
const WebsiteNavigationService = require('../../profiles/services/websiteNavigationService');
const AdInteractionService = require('../../profiles/services/adInteractionService');
const LLMService = require('../../profiles/services/llmService');
const logger = require('../../../shared/utils/logger');

// Determine which storage service to use based on environment variable
const useDatabaseStorage = process.env.USE_DATABASE_STORAGE === 'true';
const storageService = useDatabaseStorage ? dbCampaignStorageService : campaignStorageService;

/**
 * Enhanced Campaign Launch Workflow
 * Uses file-based storage for coordination instead of Redis
 */
async function enhancedCampaignLaunchWorkflow({ data, step }) {
  const { campaignId, options = {} } = data;
  const { profileCount = 1, profileIds = [], launchSettings = {} } = options;
  
  logger.info(`Starting enhanced campaign launch workflow for campaign ${campaignId}`, { 
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
  
  // Step 2: Initialize storage service
  await step.run("initialize-storage", async () => {
    logger.info(`Initializing ${useDatabaseStorage ? 'database' : 'file-based'} storage service for campaign ${campaignId}`);
    
    await storageService.initialize();
    
    // Store campaign launch in storage
    await storageService.saveCampaign(campaignId, {
      ...campaign.toJSON(),
      status: 'launching',
      launchedAt: new Date().toISOString(),
      profileCount: profileCount
    });
    
    logger.info(`Storage service initialized for campaign ${campaignId}`);
  });
  
  // Step 3: Initialize Playwright service
  await step.run("initialize-playwright", async () => {
    logger.info(`Initializing Playwright for campaign ${campaignId}`);
    
    if (!playwrightService.isReady()) {
      await playwrightService.initialize({
        headless: launchSettings.headless !== undefined ? launchSettings.headless : true
      });
    }
    
    logger.info(`Playwright initialized for campaign ${campaignId}`);
  });
  
  // Step 4: Get profiles to launch
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
  
  // Step 5: Launch profiles with file-based coordination and Playwright automation
  const profileLaunchResults = await step.run("launch-profiles", async () => {
    logger.info(`Launching ${profilesToLaunch.length} profiles with file-based coordination and Playwright automation for campaign ${campaignId}`);
    
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
        
        logger.info(`Launching profile ${profile.id} for campaign ${campaignId}`);
        
        // Register profile launch in storage
        const profileLaunchId = `launch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await storageService.saveLaunchData(campaignId, profileLaunchId, {
          profileId: profile.id,
          campaignId,
          startedAt: new Date().toISOString(),
          status: 'launching'
        });
        
        // Mark profile as active
        profile.isActive = true;
        profile.session.currentSessionId = `session_${Date.now()}`;
        profile.session.sessionStartTime = new Date().toISOString();
        
        // Generate fingerprint for the profile
        const itBrowserAPI = new ItBrowserAPI();
        const fingerprint = await itBrowserAPI.generateFingerprint(profile, {
          geographic: profile.geographic
        });
        
        // Create Playwright context with fingerprint
        const context = await playwrightService.createContext(fingerprint.data, {
          proxy: profile.assignedProxy ? {
            server: `${profile.assignedProxy.host}:${profile.assignedProxy.port}`,
            username: profile.assignedProxy.username,
            password: profile.assignedProxy.password
          } : undefined
        });
        
        // Create page
        const { pageId, page } = await playwrightService.createPage(context);
        
        // Navigate to campaign URLs using Playwright
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
          
          // Navigate to selected URLs using Playwright
          for (const url of urlsToVisit) {
            try {
              logger.info(`Navigating to URL with Playwright: ${url}`);
              
              // Use Playwright to navigate
              await playwrightService.navigateTo(page, url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
              });
              
              // Extract content using Playwright
              const content = await playwrightService.extractContent(page, {
                includeText: true,
                includeLinks: true
              });
              
              // Use LLM to analyze content if available
              let llmAnalysis = null;
              if (LLMService.isConfigured()) {
                try {
                  llmAnalysis = await LLMService.analyzePageContent(
                    content.text || '', 
                    profile.category
                  );
                  
                  logger.info('LLM analysis completed', {
                    profileId: profile.id,
                    interestScore: llmAnalysis?.interestScore
                  });
                } catch (llmError) {
                  logger.warn('LLM analysis failed', { 
                    error: llmError.message, 
                    profileId: profile.id 
                  });
                }
              }
              
              // Save navigation data to storage
              const navigationId = `nav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              await storageService.saveProfileActivity(profile.id, navigationId, {
                type: 'navigation',
                url,
                visitedAt: new Date().toISOString(),
                contentLength: content.text?.length || 0,
                linkCount: content.links?.length || 0,
                llmAnalysis: llmAnalysis ? {
                  interestScore: llmAnalysis.interestScore,
                  timeOnPage: llmAnalysis.timeOnPage
                } : undefined
              });
              
              navigationResults.push({
                url,
                success: true,
                contentLength: content.text?.length || 0,
                llmInterestScore: llmAnalysis?.interestScore
              });
              
              // Simulate human-like behavior based on LLM analysis or default
              let timeOnPage = 3000 + Math.random() * 2000; // Default 3-5 seconds
              if (llmAnalysis?.timeOnPage) {
                timeOnPage = llmAnalysis.timeOnPage * 1000; // Convert seconds to milliseconds
              }
              
              // Simulate time on page
              await page.waitForTimeout(timeOnPage);
              
              // Simulate scrolling behavior
              if (llmAnalysis?.engagementElements?.length > 0) {
                // If LLM identified engagement elements, scroll to them
                await playwrightService.scroll(page, 0, 300 + Math.random() * 500);
                await page.waitForTimeout(1000 + Math.random() * 2000);
              }
              
            } catch (navError) {
              logger.error('Failed to navigate to URL with Playwright', { 
                error: navError.message, 
                url, 
                profileId: profile.id 
              });
              
              navigationResults.push({
                url,
                success: false,
                error: navError.message
              });
            }
          }
        }
        
        // Interact with ads using Playwright
        const adResults = [];
        try {
          // Extract ads from page using Playwright
          const adElements = await page.evaluate(() => {
            // Find common ad selectors
            const adSelectors = [
              '.adsbygoogle', 'ins.adsbygoogle', '[data-ad-client]', '[data-ad-slot]',
              'iframe[src*="googlesyndication"]', 'iframe[src*="doubleclick"]',
              '.ad', '.advertisement', '[data-ad]', '.sponsored',
              '.banner', '.ad-banner', '.ad-container', '.ad-wrapper'
            ];
            
            const ads = [];
            for (const selector of adSelectors) {
              const elements = document.querySelectorAll(selector);
              for (const element of elements) {
                const rect = element.getBoundingClientRect();
                ads.push({
                  selector,
                  text: element.textContent?.trim().substring(0, 100) || '',
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                });
              }
            }
            return ads;
          });
          
          // Interact with ads if found
          if (adElements.length > 0) {
            logger.info(`Found ${adElements.length} ad elements, interacting with them`);
            
            // Click on ads
            const adsToClick = Math.min(2, adElements.length);
            for (let i = 0; i < adsToClick; i++) {
              const adToClick = adElements[Math.floor(Math.random() * adElements.length)];
              try {
                await playwrightService.click(page, 
                  adToClick.x + adToClick.width / 2, 
                  adToClick.y + adToClick.height / 2,
                  { delay: 100 + Math.random() * 200 }
                );
                
                adResults.push({
                  ad: adToClick,
                  clicked: true,
                  clickedAt: new Date().toISOString()
                });
                
                // Wait after click to simulate user behavior
                await page.waitForTimeout(3000 + Math.random() * 2000);
                
                // Check if new tab was opened and handle it
                const pages = context.pages();
                if (pages.length > 1) {
                  // Close the new tab after a short delay
                  const newPage = pages[pages.length - 1];
                  await newPage.waitForTimeout(5000 + Math.random() * 5000);
                  await newPage.close();
                }
              } catch (clickError) {
                logger.error('Failed to click ad', { 
                  error: clickError.message, 
                  ad: adToClick 
                });
                
                adResults.push({
                  ad: adToClick,
                  clicked: false,
                  error: clickError.message
                });
              }
            }
          }
          
          // Save ad interaction data to storage
          const adInteractionId = `ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await storageService.saveProfileActivity(profile.id, adInteractionId, {
            type: 'ad_interaction',
            timestamp: new Date().toISOString(),
            results: adResults
          });
          
        } catch (adError) {
          logger.error('Failed to interact with ads', { 
            error: adError.message, 
            profileId: profile.id 
          });
        }
        
        // Close page and context
        try {
          await playwrightService.closePage(pageId);
          await playwrightService.closeContext(context);
        } catch (closeError) {
          logger.error('Failed to close Playwright resources', { 
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
        
        // Update launch data with completion status
        await storageService.saveLaunchData(campaignId, profileLaunchId, {
          profileId: profile.id,
          campaignId,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: 'completed',
          navigationResults: navigationResults.length,
          adResults: adResults.length
        });
        
        results.push({
          profileId: profile.id,
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
  
  // Step 6: Update campaign statistics in storage
  await step.run("update-campaign-stats", async () => {
    logger.info(`Updating campaign statistics for campaign ${campaignId}`);
    
    // Update campaign statistics
    campaign.performance.totalVisits += profileLaunchResults.results.length;
    campaign.performance.lastUpdated = new Date().toISOString();
    
    // Save updated campaign
    await campaignManager.saveCampaign(campaign);
    
    // Update campaign data in storage
    await storageService.saveCampaign(campaignId, {
      ...campaign.toJSON(),
      status: 'completed',
      completedAt: new Date().toISOString(),
      profilesCompleted: profileLaunchResults.results.length,
      profilesFailed: profileLaunchResults.errors.length
    });
    
    logger.info(`Campaign ${campaignId} statistics updated`);
    return { updated: true };
  });
  
  logger.info(`Enhanced campaign launch workflow completed for campaign ${campaignId}`);
  
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
const workflowManager = require('../services/workflowManager');
workflowManager.registerWorkflow('enhanced-campaign-launch', enhancedCampaignLaunchWorkflow);

module.exports = {
  enhancedCampaignLaunchWorkflow
};