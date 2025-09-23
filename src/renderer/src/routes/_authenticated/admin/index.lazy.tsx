import { createLazyFileRoute } from '@tanstack/react-router'
import Dashboard from '@/admin/dashboard'

export const Route = createLazyFileRoute('/_authenticated/admin/')({
  component: Dashboard,
})
