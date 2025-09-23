import { createLazyFileRoute } from '@tanstack/react-router'
import SettingsAccount from '@/admin/settings/account'

export const Route = createLazyFileRoute('/_authenticated/settings/account')({
  component: SettingsAccount,
})
