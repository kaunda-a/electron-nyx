import React from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  IconDotsVertical, 
  IconTrash, 
  IconEdit, 
  IconCopy, 
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconWorld,
  IconShieldCheck,
  IconClock,
  IconServer
} from '@tabler/icons-react';

interface ProxiesGridProps {
  proxies: any[];
  onEdit: (proxy: any) => void;
  onDelete: (id: string) => void;
}

export function ProxiesGrid({ proxies, onEdit, onDelete }: ProxiesGridProps) {
  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      default:
        return '';
    }
  };
  
  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <IconCheck className="h-4 w-4 text-green-500" />;
      case 'inactive':
        return <IconX className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <IconAlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };
  
  // Get proxy type icon
  const getProxyTypeIcon = (type: string) => {
    // Handle undefined or null type
    if (!type) return <IconWorld className="h-4 w-4 text-gray-500" />;
    
    // Make sure type is a string before calling toLowerCase
    const typeStr = String(type);
    switch (typeStr.toLowerCase()) {
      case 'http':
        return <IconWorld className="h-4 w-4 text-blue-500" />;
      case 'https':
        return <IconWorld className="h-4 w-4 text-green-500" />;
      case 'socks5':
        return <IconShieldCheck className="h-4 w-4 text-purple-500" />;
      case 'socks4':
        return <IconServer className="h-4 w-4 text-orange-500" />;
      default:
        return <IconWorld className="h-4 w-4 text-gray-500" />;
    }
  };
  
  // Format last checked time
  const formatLastChecked = (timestamp: string) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffMins / 1440);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {proxies.map((proxy) => {
        // Skip undefined or null proxies
        if (!proxy) return null;
        
        // Skip proxies without an ID
        if (!proxy.id) return null;
        
        return (
          <Card key={proxy.id} className="overflow-hidden">
            <CardHeader className="p-4">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base flex items-center">
                  {getProxyTypeIcon(proxy.protocol || 'unknown')}
                  <span className="ml-2">{proxy.protocol?.toUpperCase() || 'UNKNOWN'}</span>
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`capitalize ${getStatusBadgeVariant(proxy.status || 'unknown')}`}
                >
                  {proxy.status || 'unknown'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-4">
                <div className="flex justify-center items-center py-4">
                  <div className="bg-muted rounded-full p-6">
                    <IconServer className="h-12 w-12 text-muted-foreground" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">IP Address:</span>
                    <span className="font-medium">{proxy.host || 'Unknown'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Port:</span>
                    <span className="font-medium">{proxy.port || 'Unknown'}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Country:</span>
                    <div className="flex items-center">
                      <span className="font-medium">{proxy.geolocation?.country || proxy.country || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-4 flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(`${proxy.host || 'unknown'}:${proxy.port || 'unknown'}`)}
              >
                <IconCopy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <IconDotsVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onEdit(proxy)}>
                    <IconEdit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${proxy.host || 'unknown'}:${proxy.port || 'unknown'}`)}>
                    <IconCopy className="h-4 w-4 mr-2" />
                    Copy
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => proxy.id && onDelete(proxy.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <IconTrash className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}