import React from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitch } from '@/components/theme-switch';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { CampaignProvider } from './context/campaigns-context';
import { ProfileProvider } from '@/admin/profiles/context/profile-context';
import { Breadcrumbs } from '@/components/ui/breadcrumb';
import { CampaignsDashboard } from './components/campaigns-dashboard';

export default function CampaignsPage() {
  return (
    <ProfileProvider>
      <CampaignProvider>
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
                    title: 'Campaigns',
                    href: '/campaigns',
                  }
                ]}
              />
            </div>
            <CampaignsDashboard />
          </Main>
        </div>
      </CampaignProvider>
    </ProfileProvider>
  );
}

