import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutGrid,
  LayoutList,
  Search,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Trash,
  Edit,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Shield,
  Clock,
  Server,
  BarChart,
  Plus,
  Activity,
  ExternalLink,
  RotateCw
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useProxies } from '../../context/proxies-context';
import { ProxyConfig } from '../../data/schema';
import ProxiesTable from './proxies-table';
import { ProxiesGrid } from './proxies-grid';
import { ProxiesMutateDrawer } from './proxies-mutate-drawer';
import { columns } from './proxies-columns';

import { ProxyValidator } from './proxy-validator';

export function ProxiesDashboard() {
  const { proxies, loading, error, fetchProxies, deleteProxy } = useProxies();
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [activeTab, setActiveTab] = useState('proxies');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [selectedProxy, setSelectedProxy] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  // Extended proxy interface for UI
  interface ExtendedProxy extends ProxyConfig {
    type?: string;
    country?: string;
  }

  // Sample proxy stats
  const proxyStats = {
    totalProxies: proxies?.length || 0,
    activeProxies: proxies?.filter(p => p.status === 'active')?.length || 0,
    averageSpeed: 120, // ms
    successRate: 92.5, // percentage
    countries: proxies ? [...new Set(proxies.map(p => p.geolocation?.country).filter(Boolean))].length : 0,
    types: 3, // Hardcoded for now (HTTP, SOCKS4, SOCKS5)
  };

  // Fetch proxies on component mount
  useEffect(() => {
    fetchProxies();
  }, [fetchProxies]);

  // Filter proxies based on search query and filters
  const filteredProxies = proxies ? proxies.filter(proxy => {
    // Search filter
    if (searchQuery && !proxy.host.includes(searchQuery) &&
        !proxy.port.toString().includes(searchQuery) &&
        !proxy.geolocation?.country?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'all' && proxy.protocol !== typeFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && proxy.status !== statusFilter) {
      return false;
    }

    // Country filter
    if (countryFilter !== 'all' && proxy.geolocation?.country !== countryFilter) {
      return false;
    }

    return true;
  }) : [];

  // Handle proxy edit
  const handleEditProxy = (proxy: any) => {
    setSelectedProxy(proxy);
    setShowEditDrawer(true);
  };

  // Handle proxy delete
  const handleDeleteProxy = (id: string) => {
    if (window.confirm('Are you sure you want to delete this proxy?')) {
      deleteProxy(id);
    }
  };

  // Get unique countries from proxies
  const getUniqueCountries = () => {
    return proxies ? [...new Set(proxies.map(p => p.geolocation?.country).filter(Boolean))] : [];
  };

  // Get unique types from proxies (protocols)
  const getUniqueTypes = () => {
    return proxies ? [...new Set(proxies.map(p => p.protocol))] : [];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Proxies</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setShowCreateDrawer(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Proxy
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="proxies" className="flex items-center">
            <Server className="h-4 w-4 mr-2" />
            Proxies
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center">
            <BarChart className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="validator" className="flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Validator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proxies" className="space-y-4 mt-4">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search proxies..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {getUniqueTypes().map(type => (
                    <SelectItem key={type} value={type}>{type.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={countryFilter}
                onValueChange={setCountryFilter}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {getUniqueCountries().map(country => (
                    <SelectItem key={country} value={country}>{country}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-1 rounded-md border p-1">
                <Button
                  variant={view === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('grid')}
                  className="h-8 w-8 p-0"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('table')}
                  className="h-8 w-8 p-0"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Proxy List</CardTitle>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                    {proxyStats.activeProxies} Active
                  </Badge>
                  <Badge variant="outline">
                    {proxyStats.totalProxies} Total
                  </Badge>
                </div>
              </div>
              <CardDescription>
                Manage your proxies for enhanced privacy and anti-detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-destructive mb-2">{error.message}</p>
                  <Button variant="outline" onClick={fetchProxies}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : filteredProxies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Server className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No proxies found</p>
                  <Button onClick={() => setShowCreateDrawer(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Proxy
                  </Button>
                </div>
              ) : view === 'grid' ? (
                <ProxiesGrid
                  proxies={filteredProxies}
                  onEdit={handleEditProxy}
                  onDelete={handleDeleteProxy}
                />
              ) : (
                <ProxiesTable
                  columns={columns}
                  data={filteredProxies}
                />
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filteredProxies.length} of {proxies?.length || 0} proxies
              </div>
              <Button variant="outline" size="sm" onClick={fetchProxies}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardFooter>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Proxy Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>HTTP</span>
                    <span className="font-medium">{proxies?.filter(p => p.protocol === 'http')?.length || 0}</span>
                  </div>
                  <Progress value={proxies?.length ? (proxies?.filter(p => p.protocol === 'http')?.length || 0) / proxies.length * 100 : 0} className="h-1" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>SOCKS5</span>
                    <span className="font-medium">{proxies?.filter(p => p.protocol === 'socks5')?.length || 0}</span>
                  </div>
                  <Progress value={proxies?.length ? (proxies?.filter(p => p.protocol === 'socks5')?.length || 0) / proxies.length * 100 : 0} className="h-1" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span>SOCKS4</span>
                    <span className="font-medium">{proxies?.filter(p => p.protocol === 'socks4')?.length || 0}</span>
                  </div>
                  <Progress value={proxies?.length ? (proxies?.filter(p => p.protocol === 'socks4')?.length || 0) / proxies.length * 100 : 0} className="h-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Average Speed</span>
                    <span className="text-sm font-medium">{proxyStats.averageSpeed} ms</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>Success Rate</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        {proxyStats.successRate}%
                      </Badge>
                    </div>
                    <Progress value={proxyStats.successRate} className="h-1" />
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm">Countries</span>
                    <span className="text-sm font-medium">{proxyStats.countries}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-sm">Active</span>
                    </div>
                    <span className="text-sm font-medium">{proxies?.filter(p => p.status === 'active')?.length || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
                      <span className="text-sm">Inactive</span>
                    </div>
                    <span className="text-sm font-medium">{proxies?.filter(p => p.status === 'inactive')?.length || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                      <span className="text-sm">Error</span>
                    </div>
                    <span className="text-sm font-medium">{proxies?.filter(p => p.status === 'error')?.length || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4 mt-4">

        </TabsContent>

        <TabsContent value="validator" className="space-y-4 mt-4">
          <ProxyValidator />
        </TabsContent>
      </Tabs>

      {/* Create Proxy Drawer */}
      <ProxiesMutateDrawer
        open={showCreateDrawer}
        onOpenChange={setShowCreateDrawer}

      />

      {/* Edit Proxy Drawer */}
      <ProxiesMutateDrawer
        open={showEditDrawer}
        onOpenChange={setShowEditDrawer}

      />
    </div>
  );
}
