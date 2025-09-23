import { createLazyFileRoute } from '@tanstack/react-router'
import SettingsProfile from '@/admin/settings/profile'

export const Route = createLazyFileRoute('/_authenticated/settings/')({
  component: SettingsProfile,
})
