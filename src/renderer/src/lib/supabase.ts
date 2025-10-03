import { createClient } from '@supabase/supabase-js'
import { useLoading } from '@/provider/loading-context'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disable for desktop apps to prevent conflicts with custom protocol
    flowType: 'pkce',  // Enable PKCE flow for secure OAuth in desktop apps
    storage: globalThis.localStorage, // Use localStorage for session persistence in desktop app
    storageKey: 'sb-nyx-auth-token' // Custom storage key for desktop app
  }
})

export const useAuth = () => {
  const { setIsLoading } = useLoading()

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      return data
    } finally {
      setIsLoading(false)
    }
  }
  
  // ... other auth methods
}
