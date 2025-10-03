import { SchemaDefinition, SchemaName, schemaDefinitions } from './SchemaDefinition';

/**
 * Schema Manager that handles table creation for both SQLite and Supabase
 */
export class SchemaManager {
  /**
   * Convert SQLite schema definition to PostgreSQL-compatible schema
   */
  private convertSchemaForPostgreSQL(schema: SchemaDefinition): SchemaDefinition {
    const pgSchema = { ...schema };

    // Convert types and constraints for PostgreSQL
    pgSchema.columns = schema.columns.map(col => {
      let pgType = this.convertSQLiteTypeToPostgreSQL(col.type);
      const pgConstraints = col.constraints ? this.convertSQLiteConstraintsToPostgreSQL(col.constraints) : undefined;
      
      return {
        ...col,
        type: pgType,
        constraints: pgConstraints,
        defaultValue: this.convertSQLiteDefaultValue(col.defaultValue)
      };
    });

    return pgSchema;
  }

  /**
   * Convert SQLite data types to PostgreSQL equivalents
   */
  private convertSQLiteTypeToPostgreSQL(sqliteType: string): string {
    const typeMap: Record<string, string> = {
      'INTEGER': 'INTEGER',
      'TEXT': 'TEXT',
      'REAL': 'REAL',
      'BLOB': 'BYTEA',
      'BOOLEAN': 'BOOLEAN',
      'DATETIME': 'TIMESTAMPTZ',
      'TIMESTAMP': 'TIMESTAMPTZ'
    };

    // Handle special cases like "INTEGER PRIMARY KEY AUTOINCREMENT"
    if (sqliteType.includes('INTEGER') && sqliteType.includes('AUTOINCREMENT')) {
      return 'SERIAL';
    }

    return typeMap[sqliteType.toUpperCase()] || sqliteType;
  }

  /**
   * Convert SQLite constraints to PostgreSQL equivalents
   */
  private convertSQLiteConstraintsToPostgreSQL(constraints: string): string {
    return constraints
      .replace(/AUTOINCREMENT/g, '') // SERIAL handles auto-increment in PostgreSQL
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim();
  }

  /**
   * Convert SQLite default values to PostgreSQL equivalents
   */
  private convertSQLiteDefaultValue(defaultValue?: string): string | undefined {
    if (!defaultValue) return defaultValue;
    
    // Convert CURRENT_TIMESTAMP to PostgreSQL equivalent
    if (defaultValue === 'CURRENT_TIMESTAMP') {
      return 'CURRENT_TIMESTAMP';
    }
    
    // Handle string literals
    if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
      return defaultValue;
    }
    
    return defaultValue;
  }

  /**
   * Generate SQL CREATE TABLE statement for SQLite
   */
  public generateSQLiteCreateTableSQL(schema: SchemaDefinition): string {
    const columns = schema.columns.map(col => {
      let colDef = `${col.name} ${col.type}`;
      if (col.constraints) {
        colDef += ` ${col.constraints}`;
      }
      if (col.defaultValue) {
        colDef += ` DEFAULT ${col.defaultValue}`;
      }
      return colDef;
    }).join(', ');
    
    const sql = `CREATE TABLE IF NOT EXISTS ${schema.tableName} (${columns})`;
    return sql;
  }

  /**
   * Generate SQL CREATE TABLE statement for PostgreSQL (Supabase)
   */
  public generatePostgreSQLCreateTableSQL(schema: SchemaDefinition): string {
    const pgSchema = this.convertSchemaForPostgreSQL(schema);
    
    const columns = pgSchema.columns.map(col => {
      let colDef = `${col.name} ${col.type}`;
      if (col.constraints) {
        colDef += ` ${col.constraints}`;
      }
      if (col.defaultValue) {
        colDef += ` DEFAULT ${col.defaultValue}`;
      }
      return colDef;
    }).join(', ');
    
    const sql = `CREATE TABLE IF NOT EXISTS ${pgSchema.tableName} (${columns})`;
    return sql;
  }

  /**
   * Generate CREATE INDEX statements
   */
  public generateCreateIndexSQLs(schema: SchemaDefinition): string[] {
    if (!schema.indexes) return [];
    
    return schema.indexes.map(index => {
      const unique = index.unique ? 'UNIQUE ' : '';
      const columns = index.columns.join(', ');
      const indexName = `${schema.tableName}_${index.name}_idx`;
      
      return `CREATE INDEX IF NOT EXISTS ${indexName} ON ${schema.tableName} (${columns})`;
    });
  }

  /**
   * Get all schema definitions
   */
  public getAllSchemaDefinitions(): Record<string, SchemaDefinition> {
    return schemaDefinitions;
  }

  /**
   * Get a specific schema definition
   */
  public getSchemaDefinition(name: SchemaName): SchemaDefinition {
    return schemaDefinitions[name];
  }
}