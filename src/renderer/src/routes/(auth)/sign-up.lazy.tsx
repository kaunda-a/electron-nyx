import { createLazyFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import SignUp from '@/auth/sign-up'

export const Route = createLazyFileRoute('/(auth)/sign-up')({
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
  component: SignUp,
})
