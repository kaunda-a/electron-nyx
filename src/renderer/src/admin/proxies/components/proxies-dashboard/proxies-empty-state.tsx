import { PlusCircle, ServerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProxies } from '../../context/proxies-context'

export function ProxiesEmptyState() {
  const { setOpen } = useProxies()

  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted">
        <ServerOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="mt-6 text-xl font-semibold">No Proxies Found</h3>
      <p className="mb-6 mt-3 text-sm text-muted-foreground max-w-md">
        You haven't added any proxies to your collection yet. Add your first proxy to get started with proxy management.
      </p>
      <Button size="lg" onClick={() => setOpen('add')}>
        <PlusCircle className="mr-2 h-5 w-5" />
        Add Your First Proxy
      </Button>
    </div>
  )
}
