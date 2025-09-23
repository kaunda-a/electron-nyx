import * as React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import LongText from '@/components/long-text'
import { IconGlobe, IconRotate, IconServer, IconDeviceMobile } from '@tabler/icons-react'
import { DataTableColumnHeader } from '../data-table-column-header'
import { DataTableRowActions } from '../data-table-row-actions'
import { ProxyConfig } from '../../data/schema'

// Extended Proxy interface for UI needs
interface Proxy extends ProxyConfig {
  name?: string;
  type?: string | null;
  provider?: string | null;
  country?: string;
  location?: {
    country?: string;
    city?: string;
  };
  performance?: {
    speed: number;
    uptime: number;
  };
  last_check?: string;
  success_rate?: number;
}

// Define ProxyProtocol and ProxyStatus types
type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5'
type ProxyStatus = 'active' | 'inactive' | 'unknown' | 'error' | 'rotating'
import { getProxyTypeColor, getProxyTypeLabel, ProxyType } from '../../utils/proxy-identifier'

const protocolIcons: Record<ProxyProtocol, React.ReactNode> = {
  http: <IconServer size={16} className="text-blue-500" />,
  https: <IconServer size={16} className="text-green-500" />,
  socks4: <IconServer size={16} className="text-orange-500" />,
  socks5: <IconServer size={16} className="text-purple-500" />
}

// Additional protocol icons (not in the ProxyProtocol type)
const additionalProtocolIcons: Record<string, React.ReactNode> = {
  ssh: <IconServer size={16} className="text-red-500" />
}

const statusColors: Record<ProxyStatus, string> = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  inactive: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  unknown: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-500 border-red-500/20',
  rotating: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
}

// Proxy type icons
const proxyTypeIcons: Record<ProxyType, React.ReactNode> = {
  datacenter: <IconServer size={16} className="text-blue-500" />,
  residential: <IconGlobe size={16} className="text-green-500" />,
  mobile: <IconDeviceMobile size={16} className="text-purple-500" />,
  unknown: <IconServer size={16} className="text-gray-500" />,
};

export const columns: ColumnDef<Proxy>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
            ? 'indeterminate'
            : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    meta: {
      className: cn(
        'sticky md:table-cell left-0 z-10 rounded-tl',
        'bg-background transition-colors duration-200 group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted'
      ),
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => {
      const name = row.getValue('name')
      const { host, port } = row.original

      if (!name && host && port) {
        // If name is not available, use host:port as fallback
        return <LongText className='max-w-36'>{`${host}:${port}`}</LongText>
      } else if (!name) {
        return <>-</>
      }

      return <LongText className='max-w-36'>{String(name)}</LongText>
    },
    meta: {
      className: cn(
        'drop-shadow-[0_1px_2px_rgb(0_0_0_/_0.1)] dark:drop-shadow-[0_1px_2px_rgb(255_255_255_/_0.1)] lg:drop-shadow-none',
        'bg-background transition-colors duration-200 group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
        'sticky left-6 md:table-cell'
      ),
    },
    enableHiding: false,
  },
  {
    accessorKey: 'protocol',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Protocol' />
    ),
    cell: ({ row }) => {
      const protocol = row.getValue('protocol') as string

      // Handle standard protocols
      if (protocol && protocolIcons[protocol as ProxyProtocol]) {
        return (
          <div className="flex items-center gap-2">
            {protocolIcons[protocol as ProxyProtocol]}
            <span className="uppercase">{protocol}</span>
          </div>
        )
      }

      // Handle additional protocols
      if (protocol && additionalProtocolIcons[protocol]) {
        return (
          <div className="flex items-center gap-2">
            {additionalProtocolIcons[protocol]}
            <span className="uppercase">{protocol}</span>
          </div>
        )
      }

      // Fallback for unknown protocols
      return <span className="text-muted-foreground">Unknown</span>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Address' />
    ),
    cell: ({ row }) => {
      const { host, port } = row.original
      if (!host || !port) return <span className="text-muted-foreground">Not specified</span>
      return <div className='font-mono'>{`${host}:${port}`}</div>
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as ProxyStatus
      const { success_rate = 0, last_check } = row.original

      if (!status || !statusColors[status]) return '-'

      // Show validation status with success rate if available
      return (
        <div className="flex flex-col gap-1">
          <Badge variant='outline' className={cn('capitalize', statusColors[status])}>
            {status === 'rotating' && <IconRotate size={14} className="mr-1 animate-spin" />}
            {status}
          </Badge>
          {status === 'unknown' && (
            <span className="text-xs text-muted-foreground">
              Not tested yet
            </span>
          )}
          {typeof success_rate === 'number' && success_rate > 0 && (
            <div className="flex items-center">
              <div className="h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    success_rate > 0.7 ? "bg-green-500" :
                    success_rate > 0.4 ? "bg-yellow-500" :
                    "bg-red-500"
                  )}
                  style={{ width: `${Math.max(success_rate * 100, 5)}%` }}
                />
              </div>
              <span className="ml-2 text-xs text-muted-foreground">
                {Math.round(success_rate * 100)}%
              </span>
            </div>
          )}
          {last_check && (
            <span className="text-xs text-muted-foreground">
              Last checked: {new Date(last_check).toLocaleString()}
            </span>
          )}
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    cell: ({ row }) => {
      const { type, provider } = row.original
      const proxyType = type as ProxyType || 'unknown'

      return (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className={getProxyTypeColor(proxyType)}>
            {proxyTypeIcons[proxyType]}
            <span className="ml-1">{getProxyTypeLabel(proxyType)}</span>
          </Badge>
          {provider && (
            <span className="text-xs text-muted-foreground">{provider}</span>
          )}
        </div>
      )
    },
  },
  {
    id: 'location',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Location' />
    ),
    cell: ({ row }) => {
      const { location, geolocation, country } = row.original

      // Try to get location from different sources
      if (location?.country) {
        return (
          <div className="flex items-center gap-2">
            <IconGlobe size={16} className="text-muted-foreground" />
            <span>{`${location.city ? `${location.city}, ` : ''}${location.country}`}</span>
          </div>
        )
      } else if (geolocation?.country) {
        return (
          <div className="flex items-center gap-2">
            <IconGlobe size={16} className="text-muted-foreground" />
            <span>{`${geolocation.city ? `${geolocation.city}, ` : ''}${geolocation.country}`}</span>
          </div>
        )
      } else if (country) {
        return (
          <div className="flex items-center gap-2">
            <IconGlobe size={16} className="text-muted-foreground" />
            <span>{country}</span>
          </div>
        )
      }

      return <span className="text-muted-foreground">Unknown location</span>
    },
  },
  {
    id: 'performance',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Performance' />
    ),
    cell: ({ row }) => {
      const { performance, success_rate, average_response_time } = row.original

      if (performance) {
        return (
          <div className="flex flex-col">
            <span>{`${performance.speed}ms`}</span>
            <span className="text-xs text-muted-foreground">{`${performance.uptime}% uptime`}</span>
          </div>
        )
      } else if (typeof success_rate === 'number' || typeof average_response_time === 'number') {
        return (
          <div className="flex flex-col">
            {typeof average_response_time === 'number' && average_response_time > 0 && <span>{`${Math.round(average_response_time)}ms`}</span>}
            {typeof success_rate === 'number' && success_rate > 0 && <span className="text-xs text-muted-foreground">{`${Math.round(success_rate * 100)}% success`}</span>}
          </div>
        )
      }

      return <span className="text-muted-foreground">Not tested</span>
    },
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
