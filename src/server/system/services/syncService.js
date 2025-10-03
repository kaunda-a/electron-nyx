const Database = require('better-sqlite3');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../shared/config/config');
const logger = require('../../shared/utils/logger');
const { createClient } = require('@supabase/supabase-js');

// Import our SQLite services
const dbCampaignStorageService = require('../../sqlite/dbCampaignStorageService');
const dbProfileStorageService = require('../../sqlite/dbProfileStorageService');
const dbProxyStorageService = require('../../sqlite/dbProxyStorageService');

/**
 * Sync Service
 * Handles synchronization between local SQLite databases and Supabase remote database
 */
class SyncService {
    constructor() {
        this.supabase = null;
        this.isInitialized = false;
        this.syncInProgress = false;
    }

    /**
     * Initialize sync service with Supabase client
     */
    async initialize() {
        try {
            logger.info('Initializing sync service');
            
            // Initialize Supabase client
            const supabaseUrl = process.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error('Missing Supabase environment variables for sync service');
            }
            
            this.supabase = createClient(supabaseUrl, supabaseAnonKey);
            
            // Initialize SQLite services
            await dbCampaignStorageService.initialize();
            await dbProfileStorageService.initialize();
            await dbProxyStorageService.initialize();
            
            this.isInitialized = true;
            logger.info('Sync service initialized successfully');
            
            return true;
        } catch (error) {
            logger.error('Failed to initialize sync service', { error: error.message });
            throw error;
        }
    }

    /**
     * Synchronize campaigns between SQLite and Supabase
     */
    async syncCampaigns(userId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        if (this.syncInProgress) {
            logger.warn('Sync already in progress, skipping');
            return false;
        }
        
        this.syncInProgress = true;
        logger.info('Starting campaign synchronization', { userId });
        
        try {
            // Step 1: Get local campaigns from SQLite
            const localCampaigns = await dbCampaignStorageService.listCampaigns();
            logger.debug('Local campaigns found', { count: localCampaigns.length });
            
            // Step 2: Get remote campaigns from Supabase
            const { data: remoteCampaigns, error: remoteError } = await this.supabase
                .from('campaigns')
                .select('*')
                .eq('user_id', userId);
                
            if (remoteError) {
                logger.error('Failed to fetch remote campaigns', { error: remoteError.message });
                return false;
            }
            
            logger.debug('Remote campaigns found', { count: remoteCampaigns.length });
            
            // Step 3: Sync from local to remote
            for (const campaignId of localCampaigns) {
                const localCampaign = await dbCampaignStorageService.loadCampaign(campaignId);
                
                if (localCampaign) {
                    // Check if campaign exists in Supabase
                    const remoteCampaign = remoteCampaigns.find(c => c.id === campaignId);
                    
                    if (!remoteCampaign) {
                        // Campaign doesn't exist remotely, create it
                        const { error } = await this.supabase
                            .from('campaigns')
                            .insert([{
                                id: campaignId,
                                user_id: userId,
                                name: localCampaign.name || `Campaign ${campaignId}`,
                                data: localCampaign,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }]);
                            
                        if (error) {
                            logger.error('Failed to insert campaign to Supabase', { 
                                campaignId, 
                                error: error.message 
                            });
                        } else {
                            logger.debug('Campaign created in Supabase', { campaignId });
                        }
                    } else {
                        // Campaign exists, check if it needs updating
                        if (new Date(localCampaign.updated_at || localCampaign.created_at) > new Date(remoteCampaign.updated_at)) {
                            // Local version is newer, update remote
                            const { error } = await this.supabase
                                .from('campaigns')
                                .update({
                                    data: localCampaign,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', campaignId);
                                
                            if (error) {
                                logger.error('Failed to update campaign in Supabase', { 
                                    campaignId, 
                                    error: error.message 
                                });
                            } else {
                                logger.debug('Campaign updated in Supabase', { campaignId });
                            }
                        }
                    }
                }
            }
            
            // Step 4: Sync from remote to local
            for (const remoteCampaign of remoteCampaigns) {
                // Check if campaign exists locally
                const localCampaign = await dbCampaignStorageService.loadCampaign(remoteCampaign.id);
                
                if (!localCampaign) {
                    // Campaign doesn't exist locally, save it
                    await dbCampaignStorageService.saveCampaign(remoteCampaign.id, remoteCampaign.data);
                    logger.debug('Campaign created locally from remote', { campaignId: remoteCampaign.id });
                } else {
                    // Both exist, check which is newer
                    const remoteUpdatedAt = new Date(remoteCampaign.updated_at);
                    const localCampaignData = typeof localCampaign === 'object' ? localCampaign : JSON.parse(localCampaign);
                    const localUpdatedAt = new Date(localCampaignData.updated_at || localCampaignData.created_at);
                    
                    if (remoteUpdatedAt > localUpdatedAt) {
                        // Remote version is newer, update local
                        await dbCampaignStorageService.saveCampaign(remoteCampaign.id, remoteCampaign.data);
                        logger.debug('Campaign updated locally from remote', { campaignId: remoteCampaign.id });
                    }
                }
            }
            
            logger.info('Campaign synchronization completed', { userId });
            return true;
        } catch (error) {
            logger.error('Campaign synchronization failed', { error: error.message });
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Synchronize profiles between SQLite and Supabase
     */
    async syncProfiles(userId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        if (this.syncInProgress) {
            logger.warn('Sync already in progress, skipping');
            return false;
        }
        
        this.syncInProgress = true;
        logger.info('Starting profile synchronization', { userId });
        
        try {
            // Step 1: Get local profiles from SQLite
            const localProfiles = await dbProfileStorageService.listProfiles();
            logger.debug('Local profiles found', { count: localProfiles.length });
            
            // Step 2: Get remote profiles from Supabase
            const { data: remoteProfiles, error: remoteError } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId);
                
            if (remoteError) {
                logger.error('Failed to fetch remote profiles', { error: remoteError.message });
                return false;
            }
            
            logger.debug('Remote profiles found', { count: remoteProfiles.length });
            
            // Step 3: Sync from local to remote
            for (const localProfile of localProfiles) {
                // Find corresponding remote profile
                const remoteProfile = remoteProfiles.find(p => p.id === localProfile.id);
                
                if (!remoteProfile) {
                    // Profile doesn't exist remotely, create it
                    const profileData = await dbProfileStorageService.loadProfile(localProfile.id);
                    
                    const { error } = await this.supabase
                        .from('profiles')
                        .insert([{
                            id: localProfile.id,
                            user_id: userId,
                            name: localProfile.name,
                            data: profileData,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }]);
                        
                    if (error) {
                        logger.error('Failed to insert profile to Supabase', { 
                            profileId: localProfile.id, 
                            error: error.message 
                        });
                    } else {
                        logger.debug('Profile created in Supabase', { profileId: localProfile.id });
                    }
                } else {
                    // Profile exists, check if it needs updating
                    const localProfileData = await dbProfileStorageService.loadProfile(localProfile.id);
                    if (new Date(localProfile.updatedAt || localProfile.createdAt) > new Date(remoteProfile.updated_at)) {
                        // Local version is newer, update remote
                        const { error } = await this.supabase
                            .from('profiles')
                            .update({
                                name: localProfile.name,
                                data: localProfileData,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', localProfile.id);
                            
                        if (error) {
                            logger.error('Failed to update profile in Supabase', { 
                                profileId: localProfile.id, 
                                error: error.message 
                            });
                        } else {
                            logger.debug('Profile updated in Supabase', { profileId: localProfile.id });
                        }
                    }
                }
            }
            
            // Step 4: Sync from remote to local
            for (const remoteProfile of remoteProfiles) {
                // Check if profile exists locally
                const localProfile = await dbProfileStorageService.loadProfile(remoteProfile.id);
                
                if (!localProfile) {
                    // Profile doesn't exist locally, save it
                    await dbProfileStorageService.saveProfile(remoteProfile.id, remoteProfile.data);
                    logger.debug('Profile created locally from remote', { profileId: remoteProfile.id });
                } else {
                    // Both exist, check which is newer
                    const remoteUpdatedAt = new Date(remoteProfile.updated_at);
                    const localProfileData = typeof localProfile === 'object' ? localProfile : JSON.parse(localProfile);
                    const localUpdatedAt = new Date(localProfileData.updatedAt || localProfileData.createdAt);
                    
                    if (remoteUpdatedAt > localUpdatedAt) {
                        // Remote version is newer, update local
                        await dbProfileStorageService.saveProfile(remoteProfile.id, remoteProfile.data);
                        logger.debug('Profile updated locally from remote', { profileId: remoteProfile.id });
                    }
                }
            }
            
            logger.info('Profile synchronization completed', { userId });
            return true;
        } catch (error) {
            logger.error('Profile synchronization failed', { error: error.message });
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Synchronize proxies between SQLite and Supabase
     */
    async syncProxies(userId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        if (this.syncInProgress) {
            logger.warn('Sync already in progress, skipping');
            return false;
        }
        
        this.syncInProgress = true;
        logger.info('Starting proxy synchronization', { userId });
        
        try {
            // Step 1: Get local proxies from SQLite
            const localProxies = await dbProxyStorageService.listProxies();
            logger.debug('Local proxies found', { count: localProxies.length });
            
            // Step 2: Get remote proxies from Supabase
            const { data: remoteProxies, error: remoteError } = await this.supabase
                .from('proxies')
                .select('*')
                .eq('user_id', userId);
                
            if (remoteError) {
                logger.error('Failed to fetch remote proxies', { error: remoteError.message });
                return false;
            }
            
            logger.debug('Remote proxies found', { count: remoteProxies.length });
            
            // Step 3: Sync from local to remote
            for (const localProxy of localProxies) {
                // Find corresponding remote proxy
                const remoteProxy = remoteProxies.find(p => p.id === localProxy.id);
                
                if (!remoteProxy) {
                    // Proxy doesn't exist remotely, create it
                    const proxyData = await dbProxyStorageService.loadProxy(localProxy.id);
                    
                    const { error } = await this.supabase
                        .from('proxies')
                        .insert([{
                            id: localProxy.id,
                            user_id: userId,
                            host: localProxy.host,
                            port: localProxy.port,
                            protocol: localProxy.protocol,
                            username: localProxy.username,
                            password: localProxy.password,
                            status: localProxy.status,
                            is_working: localProxy.isWorking,
                            location: localProxy.location,
                            data: proxyData,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }]);
                        
                    if (error) {
                        logger.error('Failed to insert proxy to Supabase', { 
                            proxyId: localProxy.id, 
                            error: error.message 
                        });
                    } else {
                        logger.debug('Proxy created in Supabase', { proxyId: localProxy.id });
                    }
                } else {
                    // Proxy exists, check if it needs updating
                    const localProxyData = await dbProxyStorageService.loadProxy(localProxy.id);
                    if (new Date(localProxy.updatedAt || localProxy.createdAt) > new Date(remoteProxy.updated_at)) {
                        // Local version is newer, update remote
                        const { error } = await this.supabase
                            .from('proxies')
                            .update({
                                host: localProxy.host,
                                port: localProxy.port,
                                protocol: localProxy.protocol,
                                username: localProxy.username,
                                password: localProxy.password,
                                status: localProxy.status,
                                is_working: localProxy.isWorking,
                                location: localProxy.location,
                                data: localProxyData,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', localProxy.id);
                            
                        if (error) {
                            logger.error('Failed to update proxy in Supabase', { 
                                proxyId: localProxy.id, 
                                error: error.message 
                            });
                        } else {
                            logger.debug('Proxy updated in Supabase', { proxyId: localProxy.id });
                        }
                    }
                }
            }
            
            // Step 4: Sync from remote to local
            for (const remoteProxy of remoteProxies) {
                // Check if proxy exists locally
                const localProxy = await dbProxyStorageService.loadProxy(remoteProxy.id);
                
                if (!localProxy) {
                    // Proxy doesn't exist locally, save it
                    await dbProxyStorageService.saveProxy(remoteProxy.id, remoteProxy.data);
                    logger.debug('Proxy created locally from remote', { proxyId: remoteProxy.id });
                } else {
                    // Both exist, check which is newer
                    const remoteUpdatedAt = new Date(remoteProxy.updated_at);
                    const localProxyData = typeof localProxy === 'object' ? localProxy : JSON.parse(localProxy);
                    const localUpdatedAt = new Date(localProxyData.updatedAt || localProxyData.createdAt);
                    
                    if (remoteUpdatedAt > localUpdatedAt) {
                        // Remote version is newer, update local
                        await dbProxyStorageService.saveProxy(remoteProxy.id, remoteProxy.data);
                        logger.debug('Proxy updated locally from remote', { proxyId: remoteProxy.id });
                    }
                }
            }
            
            logger.info('Proxy synchronization completed', { userId });
            return true;
        } catch (error) {
            logger.error('Proxy synchronization failed', { error: error.message });
            return false;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Run full synchronization for all entities
     */
    async syncAll(userId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        logger.info('Starting full synchronization', { userId });
        
        const results = {
            campaigns: await this.syncCampaigns(userId),
            profiles: await this.syncProfiles(userId),
            proxies: await this.syncProxies(userId)
        };
        
        const successCount = Object.values(results).filter(r => r).length;
        const totalCount = Object.keys(results).length;
        
        logger.info('Full synchronization completed', { 
            userId, 
            results, 
            success: `${successCount}/${totalCount}` 
        });
        
        return results;
    }

    /**
     * Get sync status for all entities
     */
    async getSyncStatus(userId) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            const [localCampaigns, localProfiles, localProxies] = await Promise.all([
                dbCampaignStorageService.listCampaigns(),
                dbProfileStorageService.listProfiles(),
                dbProxyStorageService.listProxies()
            ]);
            
            const [remoteCampaigns, remoteProfiles, remoteProxies] = await Promise.all([
                this.supabase.from('campaigns').select('id, updated_at').eq('user_id', userId),
                this.supabase.from('profiles').select('id, updated_at').eq('user_id', userId),
                this.supabase.from('proxies').select('id, updated_at').eq('user_id', userId)
            ]);
            
            return {
                local: {
                    campaigns: localCampaigns.length,
                    profiles: localProfiles.length,
                    proxies: localProxies.length
                },
                remote: {
                    campaigns: remoteCampaigns.data?.length || 0,
                    profiles: remoteProfiles.data?.length || 0,
                    proxies: remoteProxies.data?.length || 0
                },
                syncStatus: 'up_to_date' // Could be enhanced to check for actual sync status
            };
        } catch (error) {
            logger.error('Failed to get sync status', { error: error.message });
            return null;
        }
    }
}

module.exports = new SyncService();