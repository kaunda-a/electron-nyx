

export interface ProxyValidationResult {
  isValid: boolean;
  responseTime?: number;
  ipDetected?: string;
  country?: string;
  error?: string;
  protocols?: string[];
}

/**
 * Validates a proxy by testing its connectivity
 * This is a client-side wrapper for the backend validation endpoint
 */
export async function validateProxy(
  host: string,
  port: number,
  protocol?: string,
  username?: string,
  password?: string
): Promise<ProxyValidationResult> {
  try {
    // Safety check before calling validate
    if (typeof window !== 'undefined' && window.api && window.api.proxies) {
      const response = await window.api.proxies.validate({
        host,
        port,
        protocol,
        username,
        password,
      });
      
      // Return a properly structured result based on the backend response
      return {
        isValid: response.success,
        error: response.success ? undefined : response.message,
      };
    } else {
      console.warn('window.api.proxies.validate is not available');
      // Throw an error so the calling function can handle it appropriately
      throw new Error('IPC API not available - proxy validation cannot be performed');
    }
  } catch (error) {
    // Handle API errors
    if (error instanceof Error) {
      return {
        isValid: false,
        error: error.message,
      };
    }
    
    return {
      isValid: false,
      error: 'Unknown error occurred during validation',
    };
  }
}