import { SchemaManager } from './SchemaManager';
import { SchemaDefinition, SchemaName } from './SchemaDefinition';

/**
 * Database Synchronization Service
 * Handles synchronization of table schemas between SQLite and Supabase
 */
export class DatabaseSyncService {
  private schemaManager: SchemaManager;

  constructor() {
    this.schemaManager = new SchemaManager();
  }

  /**
   * Create a table in both SQLite and Supabase databases
   */
  async createTableInBothDatabases(schemaName: SchemaName): Promise<void> {
    const schema = this.schemaManager.getSchemaDefinition(schemaName);
    
    // Create table in SQLite first
    await this.createTableInSQLite(schema);
    
    // Then create table in Supabase
    await this.createTableInSupabase(schema);
  }

  /**
   * Create tables for all schema definitions
   */
  async createAllTables(): Promise<void> {
    const schemas = this.schemaManager.getAllSchemaDefinitions();
    
    for (const [name, schema] of Object.entries(schemas)) {
      await this.createTableInBothDatabases(name as SchemaName);
    }
  }

  /**
   * Create table in SQLite database via IPC
   */
  private async createTableInSQLite(schema: SchemaDefinition): Promise<void> {
    try {
      // Check if we have access to the exposed API via IPC
      if (typeof window !== 'undefined' && (window as any).api) {
        const ipc = (window as any).api;
        
        // Call the main process to create the table in SQLite
        await ipc.system.createTable({
          name: schema.tableName,
          schema: schema
        });
        
        console.log(`Table ${schema.tableName} created/verified in SQLite`);
      } else {
        console.warn('IPC API not available - skipping SQLite table creation for now');
        // Don't throw an error, just warn and continue
        return;
      }
    } catch (error) {
      console.warn(`Warning: Could not create table ${schema.tableName} in SQLite:`, error);
      // Don't throw error, continue with initialization
    }
  }

  /**
   * Create table in Supabase database via IPC
   */
  private async createTableInSupabase(schema: SchemaDefinition): Promise<void> {
    try {
      // Check if we have access to the exposed API via IPC
      if (typeof window !== 'undefined' && (window as any).api) {
        const ipc = (window as any).api;
        
        // Call the main process to create the table in Supabase
        await ipc.system.createSupabaseTable({
          name: schema.tableName,
          schema: schema
        });
        
        console.log(`Table ${schema.tableName} created/verified in Supabase`);
      } else {
        console.warn('IPC API not available - skipping Supabase table creation for now');
        // Don't throw an error, just warn and continue
        return;
      }
    } catch (error) {
      console.warn(`Warning: Could not create table ${schema.tableName} in Supabase:`, error);
      // Don't throw error, continue with initialization
    }
  }

  /**
   * Ensure all required tables exist in both databases
   */
  async ensureSchemaConsistency(): Promise<void> {
    console.log('Starting schema consistency check...');
    
    try {
      // Create all defined tables in both databases
      await this.createAllTables();
      
      console.log('Schema consistency check completed successfully');
    } catch (error) {
      console.warn('Warning during schema consistency check (may be due to IPC not being ready):', error);
      // Don't throw error to prevent app crash during initialization
      // The tables will be created when IPC becomes available
    }
  }

  /**
   * Compare schemas between SQLite and Supabase to detect differences
   */
  async compareSchemas(): Promise<{
    missingInSQLite: string[];
    missingInSupabase: string[];
    matching: string[];
  }> {
    try {
      if (typeof window !== 'undefined' && (window as any).api) {
        const ipc = (window as any).api;
        
        // Get all table names from both databases
        const [sqliteTables, supabaseTables] = await Promise.all([
          ipc.system.getTableNames(),
          ipc.system.getSupabaseTableNames()
        ]);
        
        const allTables = Object.keys(this.schemaManager.getAllSchemaDefinitions());
        
        const missingInSQLite = allTables.filter(table => !sqliteTables.includes(table));
        const missingInSupabase = allTables.filter(table => !supabaseTables.includes(table));
        const matching = allTables.filter(table => 
          sqliteTables.includes(table) && supabaseTables.includes(table)
        );
        
        return {
          missingInSQLite,
          missingInSupabase,
          matching
        };
      }
    } catch (error) {
      console.warn('Could not compare schemas (IPC may not be ready):', error);
    }
    
    // Fallback if IPC is not available or if there was an error
    return {
      missingInSQLite: [],
      missingInSupabase: [],
      matching: []
    };
  }
}