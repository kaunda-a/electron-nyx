// Main Auth Module Export
export * from './types';
export * from './api';
export * from './store';

// Default export for convenience
import { authApi } from './api';
import { useAuthStore } from './store';
import * as authTypes from './types';

export default {
  api: authApi,
  store: useAuthStore,
  ...authTypes,
};