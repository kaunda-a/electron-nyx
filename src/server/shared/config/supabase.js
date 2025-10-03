const { createClient } = require('@supabase/supabase-js');

class SupabaseConfig {
    constructor() {
        this.supabase = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            return this.supabase;
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
        }

        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
        this.isInitialized = true;

        return this.supabase;
    }

    getClient() {
        if (!this.isInitialized) {
            throw new Error('Supabase not initialized. Call initialize() first.');
        }
        return this.supabase;
    }

    async getAuthUser(token) {
        if (!this.supabase) {
            await this.initialize();
        }
        
        const { data, error } = await this.supabase.auth.getUser(token);
        
        if (error) {
            throw new Error(`Failed to get user: ${error.message}`);
        }
        
        return data.user;
    }
}

module.exports = new SupabaseConfig();