import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Breadcrumbs } from '@/components/ui/breadcrumb'
import { Main as DashboardMain } from './components/main'
import { DashboardProvider } from './context'

export default function Dashboard() {
  return (
    <DashboardProvider>
      <div className="flex min-h-screen flex-col">
        <Header>
          <div className="ml-auto flex items-center space-x-4">
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>
        <Main>
          <div className="flex items-center">
            <Breadcrumbs
              items={[
                {
                  title: 'Dashboard',
                  href: '/dashboard',
                }
              ]}
            />
          </div>
          <DashboardMain />
        </Main>
      </div>
    </DashboardProvider>
  )
}