import { toast } from '@/hooks/use-toast';

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

export class CampaignErrorHandler {
  static handleApiError(error: any, operation: string): ApiError {
    let errorMessage = 'An unknown error occurred';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      if (error.message) {
        errorMessage = error.message;
      }
      if (error.code) {
        errorCode = error.code;
      }
    }
    
    // Handle specific error cases
    if (errorMessage.includes('Network Error')) {
      errorMessage = 'Network connection failed. Please check your internet connection.';
      errorCode = 'NETWORK_ERROR';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.';
      errorCode = 'TIMEOUT_ERROR';
    } else if (errorMessage.includes('401')) {
      errorMessage = 'Authentication failed. Please log in again.';
      errorCode = 'AUTH_ERROR';
    } else if (errorMessage.includes('403')) {
      errorMessage = 'Access denied. You do not have permission to perform this action.';
      errorCode = 'PERMISSION_ERROR';
    } else if (errorMessage.includes('404')) {
      errorMessage = 'Resource not found.';
      errorCode = 'NOT_FOUND_ERROR';
    } else if (errorMessage.includes('500')) {
      errorMessage = 'Server error. Please try again later.';
      errorCode = 'SERVER_ERROR';
    }
    
    // Show toast notification
    toast({
      title: `Failed to ${operation}`,
      description: errorMessage,
      variant: 'destructive'
    });
    
    return {
      message: errorMessage,
      code: errorCode,
      details: error
    };
  }
  
  static handleValidationErrors(errors: { field: string; message: string }[]): void {
    if (errors.length === 0) return;
    
    // Show the first error in a toast
    toast({
      title: 'Validation Error',
      description: errors[0].message,
      variant: 'destructive'
    });
    
    // Log all errors to console for debugging
    console.error('Validation errors:', errors);
  }
  
  static handleSuccess(message: string, description?: string): void {
    toast({
      title: message,
      description: description,
      variant: 'default'
    });
  }
  
  static handleInfo(message: string, description?: string): void {
    toast({
      title: message,
      description: description,
      variant: 'default'
    });
  }
  
  static handleWarning(message: string, description?: string): void {
    toast({
      title: message,
      description: description,
      variant: 'default'
    });
  }
}