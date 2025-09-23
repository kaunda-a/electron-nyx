const config = require('../utils/config');
const logger = require('../utils/logger');

/**
 * Ad Network Integration Service
 * Handles integration with multiple ad networks and intelligent format selection
 */
class AdNetworkService {
    constructor() {
        this.config = config.adNetworks;
        this.formatPriorities = config.adFormatPriorities;
        this.adStats = {
            totalImpressions: 0,
            totalClicks: 0,
            networkStats: {
                adsense: { impressions: 0, clicks: 0, revenue: 0 },
                monetag: { impressions: 0, clicks: 0, revenue: 0 },
                adsterra: { impressions: 0, clicks: 0, revenue: 0 },
                popads: { impressions: 0, clicks: 0, revenue: 0 },
                hilltopads: { impressions: 0, clicks: 0, revenue: 0 }
            },
            formatStats: {
                pushNotifications: { impressions: 0, clicks: 0 },
                inPagePush: { impressions: 0, clicks: 0 },
                popunder: { impressions: 0, clicks: 0 },
                directLink: { impressions: 0, clicks: 0 },
                interstitial: { impressions: 0, clicks: 0 },
                native: { impressions: 0, clicks: 0 },
                banner: { impressions: 0, clicks: 0 },
                video: { impressions: 0, clicks: 0 }
            }
        };
    }

    /**
     * Select optimal ad network and format for a profile
     * @param {Object} profile - Profile object
     * @param {string} country - Country code
     * @param {string} profileCategory - Profile category
     * @returns {Object} Selected network and format configuration
     */
    selectOptimalAdConfiguration(profile, country, profileCategory) {
        // Determine network priority based on country tier
        const isTopTierCountry = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK'].includes(country);
        
        let selectedNetwork = this.selectNetwork(isTopTierCountry, profileCategory);
        let selectedFormat = this.selectFormat(selectedNetwork, profileCategory, isTopTierCountry);

        // Fallback if primary selection fails
        if (!selectedFormat) {
            selectedNetwork = this.config.fallback;
            selectedFormat = this.selectFormat(selectedNetwork, profileCategory, isTopTierCountry);
        }

        return {
            network: selectedNetwork,
            format: selectedFormat,
            configuration: this.getNetworkConfiguration(selectedNetwork, selectedFormat),
            priority: this.formatPriorities[selectedFormat] || 5
        };
    }

    /**
     * Select ad network based on country tier and profile category
     * @param {boolean} isTopTierCountry - Whether country is top tier
     * @param {string} profileCategory - Profile category
     * @returns {string} Selected network name
     */
    selectNetwork(isTopTierCountry, profileCategory) {
        if (isTopTierCountry) {
            // Top tier countries: prefer Monetag or Adsterra for higher CPM
            if (profileCategory === 'loyalUser') {
                return Math.random() < 0.6 ? this.config.primary : this.config.secondary;
            } else {
                return Math.random() < 0.7 ? this.config.primary : this.config.secondary;
            }
        } else {
            // Lower tier countries: use HilltopAds or PopAds for better fill rates
            return Math.random() < 0.5 ? 'hilltopads' : this.config.fallback;
        }
    }

    /**
     * Select ad format based on network capabilities and priorities
     * @param {string} networkName - Network name
     * @param {string} profileCategory - Profile category
     * @param {boolean} isTopTierCountry - Whether country is top tier
     * @returns {string} Selected format name
     */
    selectFormat(networkName, profileCategory, isTopTierCountry) {
        const network = this.config[networkName];
        if (!network || !network.enabled) {
            return null;
        }

        // Get available formats for this network
        const availableFormats = Object.keys(network.formats)
            .filter(format => network.formats[format]);

        if (availableFormats.length === 0) {
            return null;
        }

        // Weight formats by priority and profile behavior
        const weightedFormats = this.calculateFormatWeights(
            availableFormats, 
            profileCategory, 
            isTopTierCountry,
            networkName
        );

        return this.selectWeightedFormat(weightedFormats);
    }

    /**
     * Calculate format weights based on various factors
     * @param {Array} availableFormats - Available formats
     * @param {string} profileCategory - Profile category
     * @param {boolean} isTopTierCountry - Whether country is top tier
     * @param {string} networkName - Network name
     * @returns {Object} Format weights
     */
    calculateFormatWeights(availableFormats, profileCategory, isTopTierCountry, networkName) {
        const weights = {};

        availableFormats.forEach(format => {
            let weight = this.formatPriorities[format] || 5;

            // Adjust weights based on profile category
            switch (profileCategory) {
                case 'loyalUser':
                    // Loyal users more likely to interact with push notifications and native ads
                    if (format === 'pushNotifications') weight *= 1.3;
                    if (format === 'native') weight *= 1.2;
                    if (format === 'popunder') weight *= 0.8; // Less aggressive
                    break;
                
                case 'returningRegular':
                    // Regular users balanced approach
                    if (format === 'inPagePush') weight *= 1.2;
                    if (format === 'banner') weight *= 1.1;
                    break;
                
                case 'newVisitor':
                    // New visitors more responsive to popunders and direct links
                    if (format === 'popunder') weight *= 1.4;
                    if (format === 'directLink') weight *= 1.2;
                    if (format === 'pushNotifications') weight *= 0.7; // Less likely to accept
                    break;
            }

            // Adjust for country tier
            if (isTopTierCountry) {
                // Top tier countries: prefer higher-value formats
                if (format === 'video') weight *= 1.3;
                if (format === 'interstitial') weight *= 1.2;
                if (format === 'pushNotifications') weight *= 1.1;
            } else {
                // Lower tier: prefer high-fill formats
                if (format === 'popunder') weight *= 1.2;
                if (format === 'directLink') weight *= 1.1;
            }

            // Network-specific adjustments
            switch (networkName) {
                case 'monetag':
                    if (format === 'inPagePush') weight *= 1.2; // Monetag strength
                    break;
                case 'adsterra':
                    if (format === 'native') weight *= 1.3; // Adsterra strength
                    break;
                case 'popads':
                    if (format === 'popunder') weight *= 1.4; // PopAds specialty
                    break;
                case 'hilltopads':
                    if (format === 'video') weight *= 1.3; // HilltopAds strength
                    break;
            }

            weights[format] = Math.max(weight, 1); // Minimum weight of 1
        });

        return weights;
    }

    /**
     * Select format based on weights
     * @param {Object} weights - Format weights
     * @returns {string} Selected format
     */
    selectWeightedFormat(weights) {
        const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;

        for (const [format, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) {
                return format;
            }
        }

        // Fallback to first available format
        return Object.keys(weights)[0];
    }

    /**
     * Get network configuration for ad implementation
     * @param {string} networkName - Network name
     * @param {string} format - Ad format
     * @returns {Object} Network configuration
     */
    getNetworkConfiguration(networkName, format) {
        const network = this.config[networkName];
        
        const baseConfig = {
            network: networkName,
            format: format,
            siteId: network.siteId,
            enabled: network.enabled
        };

        // Add format-specific configuration
        switch (format) {
            case 'pushNotifications':
                return {
                    ...baseConfig,
                    implementation: 'push_subscription',
                    timing: 'page_load',
                    frequency: 'once_per_session'
                };

            case 'inPagePush':
                return {
                    ...baseConfig,
                    implementation: 'in_page_notification',
                    timing: 'after_interaction',
                    frequency: 'multiple'
                };

            case 'popunder':
                return {
                    ...baseConfig,
                    implementation: 'new_window',
                    timing: 'on_click',
                    frequency: 'once_per_visit'
                };

            case 'directLink':
                return {
                    ...baseConfig,
                    implementation: 'redirect',
                    timing: 'on_click',
                    frequency: 'multiple'
                };

            case 'interstitial':
                return {
                    ...baseConfig,
                    implementation: 'fullscreen_overlay',
                    timing: 'page_transition',
                    frequency: 'limited'
                };

            case 'native':
                return {
                    ...baseConfig,
                    implementation: 'content_integration',
                    timing: 'content_load',
                    frequency: 'multiple'
                };

            case 'banner':
                return {
                    ...baseConfig,
                    implementation: 'display_banner',
                    timing: 'page_load',
                    frequency: 'persistent'
                };

            case 'video':
                return {
                    ...baseConfig,
                    implementation: 'video_player',
                    timing: 'content_interaction',
                    frequency: 'limited'
                };

            default:
                return baseConfig;
        }
    }

    /**
     * Generate ad implementation code for injection
     * @param {Object} adConfig - Ad configuration
     * @param {Object} profile - Profile object
     * @returns {string} JavaScript code for ad implementation
     */
    generateAdImplementationCode(adConfig, profile) {
        const { network, format, siteId } = adConfig;

        switch (network) {
            case 'adsense':
                return this.generateAdSenseCode(format, adConfig, profile);
            case 'monetag':
                return this.generateMonetagCode(format, siteId, profile);
            case 'adsterra':
                return this.generateAdsterraCode(format, siteId, profile);
            case 'popads':
                return this.generatePopAdsCode(format, siteId, profile);
            case 'hilltopads':
                return this.generateHilltopAdsCode(format, siteId, profile);
            default:
                return '';
        }
    }

    /**
     * Generate Google AdSense ad code
     * @param {string} format - Ad format
     * @param {Object} adConfig - Ad configuration
     * @param {Object} profile - Profile object
     * @returns {string} JavaScript code
     */
    generateAdSenseCode(format, adConfig, profile) {
        const adsenseConfig = this.config.adsense;
        const adClientId = adsenseConfig.adClientId;

        if (!adClientId) {
            logger.warn('AdSense client ID not configured');
            return '';
        }

        switch (format) {
            case 'display':
                return this.generateAdSenseDisplayCode(adClientId, profile);
            case 'autoAds':
                return this.generateAdSenseAutoAdsCode(adClientId, profile);
            case 'inFeed':
                return this.generateAdSenseInFeedCode(adClientId, profile);
            case 'inArticle':
                return this.generateAdSenseInArticleCode(adClientId, profile);
            case 'responsive':
                return this.generateAdSenseResponsiveCode(adClientId, profile);
            default:
                return this.generateAdSenseDisplayCode(adClientId, profile);
        }
    }

    /**
     * Generate AdSense Display Ad code
     */
    generateAdSenseDisplayCode(adClientId, profile) {
        const adSlot = this.getRandomAdSlot();
        return `
            (function() {
                // Load AdSense script
                var script = document.createElement('script');
                script.async = true;
                script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClientId}';
                script.crossOrigin = 'anonymous';
                document.head.appendChild(script);

                // Create ad container
                var adContainer = document.createElement('div');
                adContainer.style.cssText = 'margin: 20px auto; text-align: center; max-width: 728px;';

                var adElement = document.createElement('ins');
                adElement.className = 'adsbygoogle';
                adElement.style.cssText = 'display:block; width:728px; height:90px;';
                adElement.setAttribute('data-ad-client', '${adClientId}');
                adElement.setAttribute('data-ad-slot', '${adSlot}');
                adElement.setAttribute('data-ad-format', 'auto');
                adElement.setAttribute('data-full-width-responsive', 'true');

                adContainer.appendChild(adElement);

                // Insert into page
                var targetElement = document.querySelector('main, article, .content, body');
                if (targetElement) {
                    targetElement.appendChild(adContainer);

                    // Initialize AdSense
                    setTimeout(function() {
                        try {
                            (adsbygoogle = window.adsbygoogle || []).push({});
                        } catch (e) {
                            console.log('AdSense initialization delayed');
                        }
                    }, ${this.randomBetween(1000, 3000)});
                }
            })();
        `;
    }

    /**
     * Generate AdSense Auto Ads code
     */
    generateAdSenseAutoAdsCode(adClientId, profile) {
        return `
            (function() {
                var script = document.createElement('script');
                script.async = true;
                script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClientId}';
                script.crossOrigin = 'anonymous';

                script.onload = function() {
                    try {
                        (adsbygoogle = window.adsbygoogle || []).push({
                            google_ad_client: '${adClientId}',
                            enable_page_level_ads: true
                        });
                    } catch (e) {
                        console.log('AdSense Auto Ads initialization error:', e);
                    }
                };

                document.head.appendChild(script);
            })();
        `;
    }

    /**
     * Get random ad slot from configuration
     */
    getRandomAdSlot() {
        const adSlots = this.config.adsense.adSlots;
        if (adSlots && adSlots.length > 0) {
            return adSlots[Math.floor(Math.random() * adSlots.length)];
        }
        return '1234567890'; // Default fallback
    }

    /**
     * Generate Monetag implementation code
     * @param {string} format - Ad format
     * @param {string} siteId - Site ID
     * @param {Object} profile - Profile object
     * @returns {string} JavaScript code
     */
    generateMonetagCode(format, siteId, profile) {
        switch (format) {
            case 'pushNotifications':
                return `
                    (function() {
                        var script = document.createElement('script');
                        script.src = 'https://push.monetag.io/ntfc.js';
                        script.onload = function() {
                            ntfc.init('${siteId}');
                        };
                        document.head.appendChild(script);
                    })();
                `;

            case 'popunder':
                return `
                    (function() {
                        var script = document.createElement('script');
                        script.src = 'https://www.monetag.io/popunder.js';
                        script.setAttribute('data-cfasync', 'false');
                        script.setAttribute('data-site-id', '${siteId}');
                        document.head.appendChild(script);
                    })();
                `;

            case 'banner':
                return `
                    (function() {
                        var div = document.createElement('div');
                        div.innerHTML = '<script async src="https://www.monetag.io/banner.js" data-site-id="${siteId}"></script>';
                        document.body.appendChild(div);
                    })();
                `;

            default:
                return '';
        }
    }

    /**
     * Generate Adsterra implementation code
     * @param {string} format - Ad format
     * @param {string} siteId - Site ID
     * @param {Object} profile - Profile object
     * @returns {string} JavaScript code
     */
    generateAdsterraCode(format, siteId, profile) {
        switch (format) {
            case 'pushNotifications':
                return `
                    (function() {
                        var script = document.createElement('script');
                        script.src = 'https://push.adsterra.com/push.js';
                        script.onload = function() {
                            (adsbygoogle = window.adsbygoogle || []).push({
                                google_ad_client: "${siteId}",
                                enable_page_level_ads: true
                            });
                        };
                        document.head.appendChild(script);
                    })();
                `;

            case 'popunder':
                return `
                    (function() {
                        var script = document.createElement('script');
                        script.type = 'text/javascript';
                        script.src = 'https://a.adtng.com/get/js?sid=${siteId}';
                        document.head.appendChild(script);
                    })();
                `;

            case 'native':
                return `
                    (function() {
                        var script = document.createElement('script');
                        script.async = true;
                        script.src = 'https://a.adtng.com/native.js';
                        script.setAttribute('data-cfasync', 'false');
                        script.setAttribute('data-site-id', '${siteId}');
                        document.head.appendChild(script);
                    })();
                `;

            default:
                return '';
        }
    }

    /**
     * Generate PopAds implementation code
     * @param {string} format - Ad format
     * @param {string} siteId - Site ID
     * @param {Object} profile - Profile object
     * @returns {string} JavaScript code
     */
    generatePopAdsCode(format, siteId, profile) {
        if (format === 'popunder') {
            return `
                (function() {
                    var script = document.createElement('script');
                    script.type = 'text/javascript';
                    script.src = 'https://c1.popads.net/pop.js';
                    script.onload = function() {
                        pop_init('${siteId}');
                    };
                    document.head.appendChild(script);
                })();
            `;
        }
        return '';
    }

    /**
     * Generate HilltopAds implementation code
     * @param {string} format - Ad format
     * @param {string} siteId - Site ID
     * @param {Object} profile - Profile object
     * @returns {string} JavaScript code
     */
    generateHilltopAdsCode(format, siteId, profile) {
        switch (format) {
            case 'video':
                return `
                    (function() {
                        var script = document.createElement('script');
                        script.src = 'https://hilltopads.net/video.js';
                        script.setAttribute('data-site-id', '${siteId}');
                        document.head.appendChild(script);
                    })();
                `;

            case 'popunder':
                return `
                    (function() {
                        var script = document.createElement('script');
                        script.src = 'https://hilltopads.net/popunder.js';
                        script.setAttribute('data-site-id', '${siteId}');
                        document.head.appendChild(script);
                    })();
                `;

            default:
                return '';
        }
    }

    /**
     * Track ad impression
     * @param {string} network - Network name
     * @param {string} format - Ad format
     * @param {Object} profile - Profile object
     */
    trackImpression(network, format, profile) {
        this.adStats.totalImpressions++;
        this.adStats.networkStats[network].impressions++;
        this.adStats.formatStats[format].impressions++;

        logger.info('Ad impression tracked', {
            network,
            format,
            profileId: profile.id,
            country: profile.geographic?.country
        });
    }

    /**
     * Track ad click
     * @param {string} network - Network name
     * @param {string} format - Ad format
     * @param {Object} profile - Profile object
     * @param {number} estimatedRevenue - Estimated revenue from click
     */
    trackClick(network, format, profile, estimatedRevenue = 0) {
        this.adStats.totalClicks++;
        this.adStats.networkStats[network].clicks++;
        this.adStats.networkStats[network].revenue += estimatedRevenue;
        this.adStats.formatStats[format].clicks++;

        logger.info('Ad click tracked', {
            network,
            format,
            profileId: profile.id,
            country: profile.geographic?.country,
            estimatedRevenue
        });
    }

    /**
     * Get ad network statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        const totalImpressions = this.adStats.totalImpressions;
        const totalClicks = this.adStats.totalClicks;
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;

        return {
            ...this.adStats,
            overallCTR: ctr,
            networkCTRs: Object.keys(this.adStats.networkStats).reduce((ctrs, network) => {
                const stats = this.adStats.networkStats[network];
                ctrs[network] = stats.impressions > 0 ? 
                    (stats.clicks / stats.impressions * 100).toFixed(2) : 0;
                return ctrs;
            }, {}),
            formatCTRs: Object.keys(this.adStats.formatStats).reduce((ctrs, format) => {
                const stats = this.adStats.formatStats[format];
                ctrs[format] = stats.impressions > 0 ? 
                    (stats.clicks / stats.impressions * 100).toFixed(2) : 0;
                return ctrs;
            }, {})
        };
    }
}

module.exports = AdNetworkService;
