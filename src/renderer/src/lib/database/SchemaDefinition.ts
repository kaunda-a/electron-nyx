/**
 * Schema Definition Interface
 * Defines the structure for database tables that can be synchronized between SQLite and Supabase
 */

export interface SchemaColumn {
  name: string;
  type: string; // SQLite type (will be converted for PostgreSQL)
  constraints?: string; // e.g. 'PRIMARY KEY', 'NOT NULL', 'UNIQUE', etc.
  defaultValue?: string;
}

export interface SchemaIndex {
  name: string;
  columns: string[]; // Column names to include in the index
  unique?: boolean; // Whether the index should be unique
}

export interface SchemaDefinition {
  tableName: string;
  columns: SchemaColumn[];
  indexes?: SchemaIndex[];
  primaryKey?: string; // Name of primary key column
}

/**
 * Common schema definitions to ensure consistency
 */
export const schemaDefinitions: Record<string, SchemaDefinition> = {
  profiles: {
    tableName: 'profiles',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY' },
      { name: 'name', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'description', type: 'TEXT' },
      { name: 'config', type: 'TEXT' },
      { name: 'created_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'metadata', type: 'TEXT' },
      { name: 'path', type: 'TEXT' },
      { name: 'user_id', type: 'TEXT' },
      { name: 'session', type: 'TEXT' }
    ],
    indexes: [
      { name: 'idx_profiles_user_id', columns: ['user_id'] }
    ]
  },
  
  campaigns: {
    tableName: 'campaigns',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY' },
      { name: 'name', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'description', type: 'TEXT' },
      { name: 'status', type: 'TEXT', defaultValue: "'draft'" },
      { name: 'type', type: 'TEXT' },
      { name: 'settings', type: 'TEXT' },
      { name: 'targeting', type: 'TEXT' },
      { name: 'schedule', type: 'TEXT' },
      { name: 'targets', type: 'TEXT' },
      { name: 'profiles', type: 'TEXT' },
      { name: 'performance', type: 'TEXT' },
      { name: 'created_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'created_by', type: 'TEXT' },
      { name: 'tags', type: 'TEXT' },
      { name: 'priority', type: 'TEXT', defaultValue: "'medium'" }
    ],
    indexes: [
      { name: 'idx_campaigns_created_by', columns: ['created_by'] }
    ]
  },
  
  proxies: {
    tableName: 'proxies',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY' },
      { name: 'host', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'port', type: 'INTEGER', constraints: 'NOT NULL' },
      { name: 'protocol', type: 'TEXT', defaultValue: "'http'" },
      { name: 'username', type: 'TEXT' },
      { name: 'password', type: 'TEXT' },
      { name: 'country', type: 'TEXT' },
      { name: 'status', type: 'TEXT', defaultValue: "'active'" },
      { name: 'failure_count', type: 'INTEGER', defaultValue: '0' },
      { name: 'success_count', type: 'INTEGER', defaultValue: '0' },
      { name: 'average_response_time', type: 'REAL', defaultValue: '0' },
      { name: 'assigned_profiles', type: 'TEXT' },
      { name: 'created_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'geolocation', type: 'TEXT' },
      { name: 'ip', type: 'TEXT' },
      { name: 'is_assigned', type: 'BOOLEAN', defaultValue: '0' },
      { name: 'assigned_profile_id', type: 'TEXT' },
      { name: 'assigned_at', type: 'DATETIME' }
    ],
    indexes: [
      { name: 'idx_proxies_status', columns: ['status'] }
    ]
  },
  
  users: {
    tableName: 'users',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'TEXT', constraints: 'PRIMARY KEY' },
      { name: 'email', type: 'TEXT', constraints: 'NOT NULL UNIQUE' },
      { name: 'email_verified', type: 'BOOLEAN', defaultValue: '0' },
      { name: 'encrypted_password', type: 'TEXT' }, // Only if storing local passwords
      { name: 'first_name', type: 'TEXT' },
      { name: 'last_name', type: 'TEXT' },
      { name: 'full_name', type: 'TEXT' },
      { name: 'avatar_url', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'status', type: 'TEXT', defaultValue: "'active'" },
      { name: 'last_sign_in_at', type: 'DATETIME' },
      { name: 'confirmed_at', type: 'DATETIME' },
      { name: 'created_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'updated_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'metadata', type: 'TEXT' }, // Additional user metadata
      { name: 'tenant_id', type: 'TEXT' } // For multi-tenancy if needed
    ],
    indexes: [
      { name: 'idx_users_email', columns: ['email'] },
      { name: 'idx_users_status', columns: ['status'] },
      { name: 'idx_users_created_at', columns: ['created_at'] }
    ]
  },
  
  sync_queue: {
    tableName: 'sync_queue',
    primaryKey: 'id',
    columns: [
      { name: 'id', type: 'INTEGER', constraints: 'PRIMARY KEY AUTOINCREMENT' },
      { name: 'table_name', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'operation', type: 'TEXT', constraints: 'NOT NULL' }, // 'insert', 'update', 'delete'
      { name: 'record_id', type: 'TEXT' },
      { name: 'data', type: 'TEXT' },
      { name: 'timestamp', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'status', type: 'TEXT', defaultValue: "'pending'" }, // 'pending', 'synced', 'error'
      { name: 'retries', type: 'INTEGER', defaultValue: '0' },
      { name: 'error_message', type: 'TEXT' }
    ],
    indexes: [
      { name: 'idx_sync_queue_status', columns: ['status'] },
      { name: 'idx_sync_queue_timestamp', columns: ['timestamp'] }
    ]
  }
};

export type SchemaName = keyof typeof schemaDefinitions;