import { createLazyFileRoute } from '@tanstack/react-router'
import SettingsBilling from '@/admin/settings/billing'

export const Route = createLazyFileRoute('/_authenticated/settings/billing')({
  component: SettingsBilling,
})