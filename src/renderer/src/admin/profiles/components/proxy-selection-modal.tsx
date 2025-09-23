import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Globe, Server, Check, Wifi, MapPin, Timer } from 'lucide-react';
import { useProfiles } from '../context/profile-context';

interface ProxySelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  onProxyAssigned: () => void;
}

export function ProxySelectionModal({ open, onOpenChange, profileId, onProxyAssigned }: ProxySelectionModalProps) {
  const { proxies, assignProxyToProfile } = useProfiles();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProxy, setSelectedProxy] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [filteredProxies, setFilteredProxies] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'successRate' | 'responseTime' | 'country'>('successRate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort proxies based on search term and sorting options
  useEffect(() => {
    let filtered = proxies.filter(proxy => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        proxy.host.toLowerCase().includes(term) ||
        proxy.id.toLowerCase().includes(term) ||
        (proxy.geolocation?.country && proxy.geolocation.country.toLowerCase().includes(term)) ||
        (proxy.geolocation?.city && proxy.geolocation.city.toLowerCase().includes(term))
      );
    });

    // Sort proxies
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'successRate':
          const aSuccessRate = a.success_count > 0 ? 
            (a.success_count / (a.success_count + a.failure_count)) : 0;
          const bSuccessRate = b.success_count > 0 ? 
            (b.success_count / (b.success_count + b.failure_count)) : 0;
          aValue = aSuccessRate;
          bValue = bSuccessRate;
          break;
        case 'responseTime':
          aValue = a.average_response_time || 0;
          bValue = b.average_response_time || 0;
          break;
        case 'country':
          aValue = a.geolocation?.country || '';
          bValue = b.geolocation?.country || '';
          break;
        default:
          aValue = 0;
          bValue = 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredProxies(filtered);
  }, [proxies, searchTerm, sortBy, sortOrder]);

  // Handle proxy assignment
  const handleAssignProxy = async () => {
    if (!selectedProxy) return;
    
    setIsAssigning(true);
    try {
      await assignProxyToProfile(profileId, selectedProxy);
      onProxyAssigned();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to assign proxy:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  // Auto-assign proxy based on profile's country
  const handleAutoAssign = async () => {
    setIsAssigning(true);
    try {
      await assignProxyToProfile(profileId);
      onProxyAssigned();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to auto-assign proxy:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  // Format success rate as percentage
  const formatSuccessRate = (proxy: any) => {
    if (proxy.success_count + proxy.failure_count === 0) return 'N/A';
    const rate = (proxy.success_count / (proxy.success_count + proxy.failure_count)) * 100;
    return `${rate.toFixed(1)}%`;
  };

  // Get success rate color
  const getSuccessRateColor = (proxy: any) => {
    if (proxy.success_count + proxy.failure_count === 0) return 'text-muted-foreground';
    const rate = (proxy.success_count / (proxy.success_count + proxy.failure_count));
    if (rate >= 0.9) return 'text-green-600';
    if (rate >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col max-w-6xl">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Assign Proxy to Profile</DialogTitle>
          <DialogDescription>
            Select a proxy from the list below or auto-assign based on profile's country.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and controls section */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search proxies by host, country, or city..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="successRate">Success Rate</SelectItem>
                  <SelectItem value="responseTime">Response Time</SelectItem>
                  <SelectItem value="country">Country</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
            <Button onClick={handleAutoAssign} disabled={isAssigning}>
              {isAssigning ? 'Assigning...' : 'Auto-assign'}
            </Button>
          </div>

          {/* Proxies table */}
          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Host & Port</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Success Rate</TableHead>
                  <TableHead className="text-right">Response Time</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProxies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No proxies found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProxies.map((proxy) => {
                    const successRate = proxy.success_count > 0 ? 
                      (proxy.success_count / (proxy.success_count + proxy.failure_count)) : 0;
                    const isSuccessRateGood = successRate > 0.8;
                    
                    return (
                      <TableRow 
                        key={proxy.id} 
                        className={`cursor-pointer ${selectedProxy === proxy.id ? 'bg-muted' : ''}`}
                        onClick={() => setSelectedProxy(proxy.id)}
                      >
                        <TableCell>
                          {selectedProxy === proxy.id ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : null}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Server className="mr-2 h-4 w-4 text-muted-foreground" />
                            <div>
                              <div>{proxy.host}</div>
                              <div className="text-xs text-muted-foreground">{proxy.protocol}://{proxy.host}:{proxy.port}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                            <div>
                              <div>{proxy.geolocation?.city || 'N/A'}, {proxy.geolocation?.country || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground">
                                {proxy.geolocation?.region || ''}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={proxy.status === 'active' ? 'default' : 'secondary'}
                            className={proxy.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {proxy.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={getSuccessRateColor(proxy)}>
                            {formatSuccessRate(proxy)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {proxy.average_response_time > 0 ? (
                            <span className={proxy.average_response_time < 1000 ? 'text-green-600' : proxy.average_response_time < 3000 ? 'text-yellow-600' : 'text-red-600'}>
                              {proxy.average_response_time}ms
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {proxy.isAssigned ? (
                            <Badge variant="outline" className="bg-blue-100 text-blue-800">
                              {proxy.assigned_profiles?.length || 1}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              0
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Proxy statistics */}
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground">Total Proxies</div>
                <div className="text-2xl font-bold">{proxies.length}</div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground">Active Proxies</div>
                <div className="text-2xl font-bold">
                  {proxies.filter(p => p.status === 'active').length}
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground">High Quality</div>
                <div className="text-2xl font-bold">
                  {proxies.filter(p => {
                    if (p.success_count + p.failure_count === 0) return false;
                    const rate = p.success_count / (p.success_count + p.failure_count);
                    return rate >= 0.9;
                  }).length}
                </div>
              </div>
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground">Assigned Proxies</div>
                <div className="text-2xl font-bold">
                  {proxies.filter(p => p.isAssigned).length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssignProxy} 
            disabled={!selectedProxy || isAssigning}
          >
            {isAssigning ? 'Assigning...' : 'Assign Selected Proxy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}