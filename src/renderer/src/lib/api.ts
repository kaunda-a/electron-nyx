// Placeholder API client for HTTP requests
// This is kept for backward compatibility but all actual API calls 
// now use the IPC API directly via window.api
// The actual API calls are implemented directly in the respective API files 
// using window.api.profiles, window.api.campaigns, window.api.proxies, etc.

// Define a simple interface to maintain compatibility with existing code
interface ApiClient {
  get: (url: string, config?: any) => Promise<any>;
  post: (url: string, data?: any, config?: any) => Promise<any>;
  put: (url: string, data?: any, config?: any) => Promise<any>;
  delete: (url: string, config?: any) => Promise<any>;
}

// Create a placeholder client that will throw an error if used
// This ensures that any remaining code using this API will get a clear error
const api: ApiClient = {
  get: (url: string, config?: any) => {
    throw new Error(`HTTP API client is deprecated. Use window.api directly. Request: GET ${url}`);
  },
  post: (url: string, data?: any, config?: any) => {
    throw new Error(`HTTP API client is deprecated. Use window.api directly. Request: POST ${url}`);
  },
  put: (url: string, data?: any, config?: any) => {
    throw new Error(`HTTP API client is deprecated. Use window.api directly. Request: PUT ${url}`);
  },
  delete: (url: string, config?: any) => {
    throw new Error(`HTTP API client is deprecated. Use window.api directly. Request: DELETE ${url}`);
  }
};

export { api };