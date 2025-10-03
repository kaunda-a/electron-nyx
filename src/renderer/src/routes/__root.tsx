
import { useEffect, useRef } from 'react'
import { createRootRouteWithContext, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth/store'
import { Toaster } from '@/components/ui/toaster'
import { supabase } from '@/lib/supabase'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useLoading } from '@/provider/loading-context'
import { initializeDatabaseSchemas } from '@/lib/database/InitializeSchemas'

// Add NotFound component
function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-lg">Page not found</p>
    </div>
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/') {
      throw redirect({
        to: '/admin',
      })
    }
  }
})

function RootComponent() {
  const { user, setUser, exchangeCodeForSession } = useAuthStore((state) => state.auth)
  const navigate = useNavigate()
  const { setIsLoading } = useLoading()
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (window.api) {
      const removeListener = window.api.on('oauth-callback', (event) => {
        if (event.code) {
          exchangeCodeForSession(event.code);
        } else if (event.error) {
          console.error('OAuth Error:', event.error);
        }
      });

      return () => {
        removeListener();
      };
    } else {
      console.error('window.api is not defined. Preload script may not be loaded correctly.');
    }
  }, [exchangeCodeForSession]);

  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true)
      try {
        // Initialize database schemas to ensure tables exist in both SQLite and Supabase
        await initializeDatabaseSchemas();
        
        // Load user session
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
      } finally {
        setIsLoading(false)
      }
    }

    initializeApp()

    // Set up periodic retry for database initialization in case IPC becomes available later
    const setupRetryMechanism = () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
      }
      
      // Check every 5 seconds if IPC is now available and retry database initialization
      retryTimerRef.current = setInterval(async () => {
        // Only retry if we haven't successfully initialized or if IPC is now available
        if (typeof window !== 'undefined' && (window as any).api) {
          try {
            await initializeDatabaseSchemas();
            console.log('Database schemas successfully initialized on retry');
            // Clear the timer once successful
            if (retryTimerRef.current) {
              clearInterval(retryTimerRef.current);
              retryTimerRef.current = null;
            }
          } catch (error) {
            // Continue retrying on error
            console.debug('Database initialization retry failed, will try again');
          }
        }
      }, 5000); // Check every 5 seconds
    };

    // Start the retry mechanism
    setupRetryMechanism();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)

        // Handle sign out event
        if (event === 'SIGNED_OUT') {
          navigate({ to: '/logout-success' })
        }
      }
    )

    return () => {
      subscription.unsubscribe();
      // Clean up retry timer
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    }
  }, [navigate, setUser, setIsLoading])

  return (
    <>
      <Outlet />
      <Toaster />
      {import.meta.env.MODE === 'development' && (
        <>
          <ReactQueryDevtools buttonPosition='bottom-left' />
          <TanStackRouterDevtools position='bottom-right' />
        </>
      )}
    </>
  )
}
