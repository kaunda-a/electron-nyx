import { DatabaseSyncService } from '@/lib/database/DatabaseSyncService';

/**
 * Initialize database schema synchronization
 * This ensures tables exist in both SQLite and Supabase databases
 */
export const initializeDatabaseSchemas = async (): Promise<void> => {
  try {
    console.log('Starting database schema initialization...');
    
    const syncService = new DatabaseSyncService();
    
    // Ensure all required tables exist in both databases
    await syncService.ensureSchemaConsistency();
    
    console.log('Database schema initialization completed');
  } catch (error) {
    console.warn('Warning: Database schema initialization encountered issues (may retry later when IPC is ready):', error);
    // Don't throw error to prevent app crash during initialization
    // The initialization can be retried later when IPC becomes available
  }
};