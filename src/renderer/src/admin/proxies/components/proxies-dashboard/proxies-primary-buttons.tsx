import { IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useProxies } from '../../context/proxies-context'

export default function ProxiesPrimaryButtons() {
  const { setOpen } = useProxies()
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add Proxy</span> <IconPlus size={18} />
      </Button>
    </div>
  )
}
