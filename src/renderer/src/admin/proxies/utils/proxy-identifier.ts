// Proxy type identification utility

export type ProxyType = 'datacenter' | 'residential' | 'mobile' | 'unknown';

interface ProxyIdentificationResult {
  type: ProxyType;
  confidence: number; // 0-1 confidence score
  provider?: string;  // Detected provider if available
  details?: string;   // Additional details about the identification
}

// Common proxy provider patterns
const PROVIDER_PATTERNS = {
  brightdata: [
    /brd\.superproxy\.io/i,
    /\.brightdata\.com/i,
    /\.luminati\.io/i,
  ],
  smartproxy: [
    /\.smartproxy\.com/i,
    /sp\.smartproxy/i,
  ],
  oxylabs: [
    /\.oxylabs\.io/i,
    /\.oxylabs\.net/i,
  ],
  proxylabs: [
    /\.proxylabs\.co/i,
  ],
  ipburger: [
    /\.ipburger\.com/i,
  ],
  geosurf: [
    /\.geosurf\.io/i,
    /\.geosurf\.com/i,
  ],
  netnut: [
    /\.netnut\.io/i,
  ],
  shifter: [
    /\.shifter\.io/i,
  ],
  packetstream: [
    /\.packetstream\.io/i,
  ],
  stormproxies: [
    /\.stormproxies\.com/i,
  ],
  rayobyte: [
    /\.rayobyte\.com/i,
  ],
  privateproxy: [
    /\.privateproxy\.me/i,
  ],
  proxy_seller: [
    /\.proxy-seller\.com/i,
  ],
  rsocks: [
    /\.rsocks\.net/i,
  ],
  proxyrack: [
    /\.proxyrack\.net/i,
  ],
  proxyscrape: [
    /\.proxyscrape\.com/i,
  ],
  webshare: [
    /\.webshare\.io/i,
  ],
  proxyempire: [
    /\.proxyempire\.io/i,
  ],
};

// Patterns for proxy types
const TYPE_PATTERNS = {
  datacenter: [
    /dc\./i,
    /datacenter/i,
    /static/i,
    /dedicated/i,
    /server/i,
  ],
  residential: [
    /res\./i,
    /residential/i,
    /home/i,
    /consumer/i,
    /dynamic/i,
  ],
  mobile: [
    /mobile/i,
    /cellular/i,
    /4g/i,
    /5g/i,
    /lte/i,
    /carrier/i,
  ],
};

// Provider-specific type identification
const PROVIDER_TYPE_PATTERNS = {
  brightdata: {
    datacenter: [/brd\.superproxy\.io\/data/i, /zproxy\.lum-superproxy\.io/i],
    residential: [/brd\.superproxy\.io\/res/i, /zproxy\.lum-superproxy\.io\/res/i],
    mobile: [/brd\.superproxy\.io\/mobile/i, /zproxy\.lum-superproxy\.io\/mobile/i],
  },
  smartproxy: {
    datacenter: [/dc\.smartproxy\.com/i],
    residential: [/res\.smartproxy\.com/i],
    mobile: [/mobile\.smartproxy\.com/i],
  },
  oxylabs: {
    datacenter: [/dc\.oxylabs\.io/i],
    residential: [/res\.oxylabs\.io/i, /pr\.oxylabs\.io/i],
    mobile: [/mobile\.oxylabs\.io/i],
  },
};

/**
 * Identifies the proxy type and provider based on hostname and other details
 */
export function identifyProxy(
  host: string,
  port?: number,
  username?: string
): ProxyIdentificationResult {
  let result: ProxyIdentificationResult = {
    type: 'unknown',
    confidence: 0,
  };

  // Check for provider first
  for (const [provider, patterns] of Object.entries(PROVIDER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(host)) {
        result.provider = provider;
        result.confidence = 0.6; // Base confidence for provider match
        
        // Check provider-specific type patterns
        if (provider in PROVIDER_TYPE_PATTERNS) {
          const typePatterns = PROVIDER_TYPE_PATTERNS[provider as keyof typeof PROVIDER_TYPE_PATTERNS];
          
          for (const [type, patterns] of Object.entries(typePatterns)) {
            for (const pattern of patterns) {
              if (pattern.test(host) || (username && pattern.test(username))) {
                result.type = type as ProxyType;
                result.confidence = 0.9; // High confidence for provider-specific type match
                return result;
              }
            }
          }
        }
      }
    }
  }

  // If provider is identified but type is not, check generic type patterns
  if (result.provider) {
    for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(host) || (username && pattern.test(username))) {
          result.type = type as ProxyType;
          result.confidence = 0.7; // Medium confidence for generic type match with known provider
          return result;
        }
      }
    }
  }

  // If no provider is identified, check generic type patterns with lower confidence
  for (const [type, patterns] of Object.entries(TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(host) || (username && pattern.test(username))) {
        result.type = type as ProxyType;
        result.confidence = 0.5; // Lower confidence for generic type match without provider
        return result;
      }
    }
  }

  // Port-based heuristics as a fallback
  if (port) {
    if ([3128, 8080, 8888, 3129].includes(port)) {
      result.type = 'datacenter';
      result.confidence = 0.3;
      result.details = 'Identified based on common datacenter port';
    } else if ([9000, 9001].includes(port)) {
      result.type = 'residential';
      result.confidence = 0.3;
      result.details = 'Identified based on common residential port';
    }
  }

  return result;
}

/**
 * Gets a human-readable label for a proxy type
 */
export function getProxyTypeLabel(type: ProxyType): string {
  switch (type) {
    case 'datacenter':
      return 'Datacenter';
    case 'residential':
      return 'Residential';
    case 'mobile':
      return 'Mobile/4G';
    case 'unknown':
    default:
      return 'Unknown';
  }
}

/**
 * Gets a color for a proxy type (for UI display)
 */
export function getProxyTypeColor(type: ProxyType): string {
  switch (type) {
    case 'datacenter':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'residential':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'mobile':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}
