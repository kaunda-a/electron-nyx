import { createLazyFileRoute } from '@tanstack/react-router'
import SettingsDisplay from '@/admin/settings/display'

export const Route = createLazyFileRoute('/_authenticated/settings/display')({
  component: SettingsDisplay,
})
