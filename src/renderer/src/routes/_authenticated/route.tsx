
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { SearchProvider } from '@/provider/search-context'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import SkipToMain from '@/components/skip-to-main'
import { supabase } from '@/lib/supabase'
import Cookies from 'js-cookie'
import { useAuthStore } from '@/lib/auth/store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    // Check if user is authenticated by getting current session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.user) {
      // If no user is authenticated, redirect to sign in
      throw redirect({
        to: '/sign-in',
        search: { 
          redirect: window.location.pathname + window.location.search 
        }
      })
    }
  },
  component: RouteComponent,
  
})

function RouteComponent() {
  const defaultOpen = Cookies.get('sidebar:state') !== 'false'
  return (
    <SearchProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <SkipToMain />
        <AppSidebar />
        <div
          id='content'
          className={cn(
            'ml-auto w-full max-w-full',
            'peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)]',
            'peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]',
            'transition-[width] duration-200 ease-linear',
            'flex h-svh flex-col',
            'group-data-[scroll-locked=1]/body:h-full',
            'group-data-[scroll-locked=1]/body:has-[main.fixed-main]:h-svh'
          )}
        >
          <Outlet />
        </div>
      </SidebarProvider>
    </SearchProvider>
  )
}
  
