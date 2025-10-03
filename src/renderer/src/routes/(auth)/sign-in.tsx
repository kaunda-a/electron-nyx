import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import SignIn from '@/auth/sign-in'

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: search.redirect as string | undefined,
    }
  },
  beforeLoad: async () => {
    // Check if user is already authenticated
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user) {
      // If user is already authenticated, redirect to dashboard
      throw redirect({
        to: '/'
      })
    }
  },
  component: SignIn,
})
