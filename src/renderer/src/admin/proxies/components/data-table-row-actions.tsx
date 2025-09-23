import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Row } from '@tanstack/react-table'
import {
  IconEdit,
  IconTrash,
  IconRotate,
  IconTestPipe,
  IconCopy,
  IconRefresh
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProxies } from '../context/proxies-context'
import { ProxyConfig } from '../data/schema'

interface DataTableRowActionsProps {
  row: Row<ProxyConfig>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { setOpen, setCurrentRow, testProxy, rotateProxy } = useProxies()

  const handleCopyAddress = () => {
    const { host, port } = row.original
    navigator.clipboard.writeText(`${host}:${port}`)
  }

  return (
    <div className="flex items-center gap-1">
      {/* Quick test button */}
      <Button
        variant='ghost'
        size="icon"
        className='flex h-8 w-8 p-0 hover:bg-muted'
        onClick={() => testProxy(row.original.id)}
        title="Test Proxy"
        disabled={row.original.status === 'rotating'}
      >
        <IconRefresh className='h-4 w-4' />
        <span className='sr-only'>Test proxy</span>
      </Button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='flex h-8 w-8 p-0 data-[state=open]:bg-muted'
          >
            <DotsHorizontalIcon className='h-4 w-4' />
            <span className='sr-only'>Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-[160px]'>
          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(row.original)
              setOpen('edit')
            }}
          >
            Edit
            <DropdownMenuShortcut>
              <IconEdit size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleCopyAddress}>
            Copy Address
            <DropdownMenuShortcut>
              <IconCopy size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => testProxy(row.original.id)}
            disabled={row.original.status === 'rotating'}
          >
            Test Proxy
            <DropdownMenuShortcut>
              <IconTestPipe size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          {row.original.rotation?.enabled && (
            <DropdownMenuItem
              onClick={() => rotateProxy(row.original.id)}
              disabled={row.original.status === 'rotating'}
            >
              Rotate Now
              <DropdownMenuShortcut>
                <IconRotate size={16} />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              setCurrentRow(row.original)
              setOpen('delete')
            }}
            className='text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950'
          >
            Delete
            <DropdownMenuShortcut>
              <IconTrash size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
