import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Play,
  Square,
  Calendar,
  Target,
  TrendingUp,
  AlertCircle,
  X,
  Edit,
  Copy,
  Trash2,
  Download,
  Loader2,
  Settings,
  Users,
  Plus,
  BarChart,
  Search,
  LayoutGrid,
  LayoutList,
  RefreshCw
} from 'lucide-react';
import { useCampaigns } from '../../context/campaigns-context';
import { Campaign } from '../../data/schema';
import { CampaignDetail } from '../campaign-detail';
import { AdvancedFilter } from './advanced-filter';
import { CampaignAnalytics } from '../campaign-analytics';
import { CampaignExportImport } from '../campaign-export-import';

export function CampaignsDashboard() {
  const { toast } = useToast();
  const {
    campaigns,
    isLoading,
    error,
    filters,
    setFilters,
    refetchCampaigns,
    deleteCampaign,
    updateCampaign,
    duplicateCampaign,
    bulkDeleteCampaigns,
    bulkUpdateCampaigns,
    clearCache,
    stats,
    createCampaign,
    exportCampaigns
  } = useCampaigns();

  // Form schema for campaign creation
  const formSchema = z.object({
    name: z.string().min(1, 'Campaign name is required'),
    description: z.string().optional(),
    type: z.enum(['traffic', 'revenue', 'testing']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    targets: z.object({
      urls: z.array(z.string().refine(url => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      }, 'Please enter valid URLs')).min(1, 'At least one target URL is required'),
      behavior: z.enum(['random', 'sequential', 'weighted']),
    }),
    settings: z.object({
      dailyVisitTarget: z.number().min(1, 'Daily visit target must be at least 1'),
      maxConcurrentSessions: z.number().min(1, 'Max concurrent sessions must be at least 1'),
      sessionDuration: z.object({
        min: z.number().min(1, 'Minimum session duration must be at least 1 second'),
        max: z.number()
      }).refine(data => data.max >= data.min, {
        message: 'Maximum session duration must be greater than or equal to minimum',
        path: ['max']
      }),
      clickRate: z.object({
        min: z.number().min(0, 'Minimum click rate must be at least 0'),
        max: z.number().max(100, 'Maximum click rate must be at most 100')
      }).refine(data => data.max >= data.min, {
        message: 'Maximum click rate must be greater than or equal to minimum',
        path: ['max']
      }),
      bounceRate: z.object({
        min: z.number().min(0, 'Minimum bounce rate must be at least 0'),
        max: z.number().max(100, 'Maximum bounce rate must be at most 100')
      }).refine(data => data.max >= data.min, {
        message: 'Maximum bounce rate must be greater than or equal to minimum',
        path: ['max']
      })
    }),
    targeting: z.object({
      countries: z.array(z.string().min(2, 'Country code must be at least 2 characters')).optional(),
      adNetworks: z.array(z.string().min(1, 'Ad network name is required')).optional(),
      adFormats: z.array(z.string().min(1, 'Ad format is required')).optional(),
      deviceTypes: z.array(z.string().min(1, 'Device type is required')).optional(),
      browsers: z.array(z.string().min(1, 'Browser is required')).optional(),
    }),
    schedule: z.object({
      enabled: z.boolean(),
      timezone: z.string(),
      dailySchedule: z.object({
        enabled: z.boolean(),
        startTime: z.string(),
        endTime: z.string(),
      }),
      weeklySchedule: z.object({
        enabled: z.boolean(),
        activeDays: z.array(z.number()),
      }),
      dateRange: z.object({
        enabled: z.boolean(),
        startDate: z.string().nullable(),
        endDate: z.string().nullable(),
      }),
    }),
    profiles: z.object({
      assignmentType: z.enum(['auto', 'manual', 'category']),
      assignedProfiles: z.array(z.string()),
      categoryDistribution: z.object({
        newVisitor: z.number().min(0).max(100),
        returningRegular: z.number().min(0).max(100),
        loyalUser: z.number().min(0).max(100),
      }),
      maxProfilesPerCampaign: z.number().min(0),
    })
  });

  type CampaignFormValues = z.infer<typeof formSchema>;

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'traffic',
      priority: 'medium',
      targets: {
        urls: ['https://example.com'],
        behavior: 'random',
      },
      settings: {
        dailyVisitTarget: 1000,
        maxConcurrentSessions: 10,
        sessionDuration: {
          min: 30,
          max: 300
        },
        clickRate: {
          min: 0.5,
          max: 3.0
        },
        bounceRate: {
          min: 20,
          max: 60
        }
      },
      targeting: {
        countries: ['US', 'GB', 'CA', 'AU'],
        adNetworks: ['adsense', 'monetag'],
        adFormats: ['display', 'responsive'],
        deviceTypes: ['desktop', 'mobile'],
        browsers: ['chrome', 'firefox', 'safari']
      },
      schedule: {
        enabled: false,
        timezone: 'UTC',
        dailySchedule: {
          enabled: false,
          startTime: '09:00',
          endTime: '17:00'
        },
        weeklySchedule: {
          enabled: false,
          activeDays: [1, 2, 3, 4, 5]
        },
        dateRange: {
          enabled: false,
          startDate: null,
          endDate: null
        }
      },
      profiles: {
        assignmentType: 'auto',
        assignedProfiles: [],
        categoryDistribution: {
          newVisitor: 40,
          returningRegular: 35,
          loyalUser: 25
        },
        maxProfilesPerCampaign: 0
      }
    }
  });

  const [view, setView] = useState<'grid' | 'table'>('table');
  const [activeTab, setActiveTab] = useState('campaigns');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createCampaignActiveTab, setCreateCampaignActiveTab] = useState('general');

  // Campaign statistics
  const campaignStats = {
    totalCampaigns: stats?.total || campaigns?.length || 0,
    activeCampaigns: stats?.active || campaigns?.filter(c => c.status === 'active')?.length || 0,
    completedCampaigns: campaigns?.filter(c => c.status === 'completed')?.length || 0,
    totalRevenue: stats?.totalRevenue || campaigns?.reduce((sum, c) => sum + (c.performance?.totalRevenue || 0), 0) || 0,
    totalVisits: stats?.totalVisits || campaigns?.reduce((sum, c) => sum + (c.performance?.totalVisits || 0), 0) || 0,
    avgCTR: campaigns?.length ? 
      campaigns.reduce((sum, c) => sum + (c.performance?.avgCTR || 0), 0) / campaigns.length : 0
  };

  // Filter campaigns based on current filters
  const filteredCampaigns = campaigns ? campaigns.filter(campaign => {
    // Search filter
    if (filters.search && !campaign.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }

    // Status filter
    if (filters.status && campaign.status !== filters.status) {
      return false;
    }
    
    // Type filter
    if (filters.type && campaign.type !== filters.type) {
      return false;
    }

    return true;
  }) : [];

  // Handle campaign delete
  const handleDeleteCampaign = (id: string) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      deleteCampaign(id);
    }
  };

  // Handle campaign duplicate
  const handleDuplicateCampaign = async (id: string) => {
    try {
      await duplicateCampaign(id);
    } catch (error) {
      console.error('Failed to duplicate campaign:', error);
      alert('Failed to duplicate campaign. Please try again.');
    }
  };

  // Handle bulk selection
  const toggleCampaignSelection = (id: string) => {
    setSelectedCampaignIds(prev => 
      prev.includes(id) 
        ? prev.filter(campaignId => campaignId !== id) 
        : [...prev, id]
    );
  };

  const selectAllCampaigns = () => {
    if (filteredCampaigns.length === selectedCampaignIds.length) {
      // Deselect all
      setSelectedCampaignIds([]);
    } else {
      // Select all
      setSelectedCampaignIds(filteredCampaigns.map(c => c.id));
    }
  };

  // Handle bulk operations
  const handleBulkDelete = async () => {
    if (selectedCampaignIds.length === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedCampaignIds.length} campaign(s)?`)) {
      try {
        await bulkDeleteCampaigns(selectedCampaignIds);
        setSelectedCampaignIds([]);
        await refetchCampaigns();
      } catch (error) {
        console.error('Failed to delete campaigns:', error);
      }
    }
  };

  const handleBulkPause = async () => {
    if (selectedCampaignIds.length === 0) return;
    
    try {
      await bulkUpdateCampaigns(selectedCampaignIds, { status: 'paused' });
      setSelectedCampaignIds([]);
      await refetchCampaigns();
    } catch (error) {
      console.error('Failed to pause campaigns:', error);
    }
  };

  const handleBulkActivate = async () => {
    if (selectedCampaignIds.length === 0) return;
    
    try {
      await bulkUpdateCampaigns(selectedCampaignIds, { status: 'active' });
      setSelectedCampaignIds([]);
      await refetchCampaigns();
    } catch (error) {
      console.error('Failed to activate campaigns:', error);
    }
  };

  // Update search filter
  const handleSearchChange = (value: string) => {
    setFilters({ ...filters, search: value });
  };

  // Update status filter
  const handleStatusFilterChange = (value: string) => {
    setFilters({ ...filters, status: value === 'all' ? undefined : value });
  };
  
  // Update type filter
  const handleTypeFilterChange = (value: string) => {
    setFilters({ ...filters, type: value === 'all' ? undefined : value });
  };

  // Get unique statuses from campaigns
  const getUniqueStatuses = () => {
    return campaigns ? [...new Set(campaigns.map(p => p.status))] : [];
  };
  
  // Get unique types from campaigns
  const getUniqueTypes = () => {
    return campaigns ? [...new Set(campaigns.map(p => p.type))] : [];
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Helper functions for managing array items in the form
  const addArrayItem = (parent: keyof Campaign, field: string, defaultValue: string = '') => {
    const parentValue = form.getValues(parent);
    const currentValues = parentValue && typeof parentValue === 'object' ? (parentValue as any)[field] || [] : [];
    form.setValue(`${parent}.${field}` as any, [...currentValues, defaultValue]);
  };

  const removeArrayItem = (parent: keyof Campaign, field: string, index: number) => {
    const parentValue = form.getValues(parent);
    const currentValues = parentValue && typeof parentValue === 'object' ? (parentValue as any)[field] || [] : [];
    const newValues = [...currentValues];
    newValues.splice(index, 1);
    form.setValue(`${parent}.${field}` as any, newValues);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Handle campaign create
  const handleCreateCampaign = async (values: CampaignFormValues) => {
    setIsSubmitting(true);
    try {
      // Prepare campaign data according to the API schema
      const campaignData = {
        name: values.name,
        description: values.description,
        type: values.type,
        priority: values.priority,
        status: 'draft' as const,
        targets: {
          urls: values.targets.urls.filter(url => url.trim() !== ''),
          behavior: values.targets.behavior,
          weights: {}
        },
        settings: values.settings,
        targeting: {
          countries: values.targeting.countries && values.targeting.countries.length > 0 
            ? values.targeting.countries 
            : ['US'],
          adNetworks: values.targeting.adNetworks && values.targeting.adNetworks.length > 0 
            ? values.targeting.adNetworks 
            : ['adsense'],
          adFormats: values.targeting.adFormats && values.targeting.adFormats.length > 0
            ? values.targeting.adFormats
            : ['display', 'responsive'],
          deviceTypes: values.targeting.deviceTypes && values.targeting.deviceTypes.length > 0
            ? values.targeting.deviceTypes
            : ['desktop', 'mobile'],
          browsers: values.targeting.browsers && values.targeting.browsers.length > 0
            ? values.targeting.browsers
            : ['chrome', 'firefox', 'safari']
        },
        schedule: values.schedule,
        profiles: values.profiles,
        createdBy: 'user'
      };

      await createCampaign(campaignData);
      
      toast({
        title: 'Campaign created',
        description: 'The campaign has been created successfully.',
      });
      
      setIsCreateModalOpen(false);
      form.reset();
      await refetchCampaigns();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      toast({
        title: 'Failed to create campaign',
        description: error instanceof Error ? error.message : 'An error occurred while creating the campaign.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input change for new campaign
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // This function is no longer used since we're using react-hook-form
  };

  // Handle select change for new campaign
  const handleSelectChange = (name: string, value: string) => {
    // This function is no longer used since we're using react-hook-form
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <div className="flex items-center space-x-2">
            <Button onClick={clearCache} variant="outline" size="sm">
              Clear Cache
            </Button>
            <Button onClick={() => exportCampaigns()} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="campaigns" className="flex items-center">
              <Target className="h-4 w-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center">
              <BarChart className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center">
              <TrendingUp className="h-4 w-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="export-import" className="flex items-center">
              <Download className="h-4 w-4 mr-2" />
              Export/Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-4 mt-4">
            <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  className="pl-8"
                  value={filters.search || ''}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2">
              <AdvancedFilter 
                filters={filters} 
                onFiltersChange={setFilters} 
              />
              
              <Select
                value={filters.status || 'all'}
                onValueChange={handleStatusFilterChange}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {getUniqueStatuses().map(status => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select
                value={filters.type || 'all'}
                onValueChange={handleTypeFilterChange}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {getUniqueTypes().map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
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
                  <CardTitle>Campaign List</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      {campaignStats.activeCampaigns} Active
                    </Badge>
                    <Badge variant="outline">
                      {campaignStats.totalCampaigns} Total
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  Manage your marketing campaigns and track their performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                    <p className="text-destructive mb-2">{error.message}</p>
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={refetchCampaigns}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                      <Button variant="outline" onClick={clearCache}>
                        Clear Cache
                      </Button>
                    </div>
                  </div>
                ) : campaigns && campaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Target className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
                    <p className="text-muted-foreground mb-6 text-center">
                      Get started by creating your first campaign to manage your marketing efforts.
                    </p>
                    <Button size="lg" onClick={() => setIsCreateModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Campaign
                    </Button>
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">No campaigns match your filters</p>
                    <Button variant="outline" onClick={() => setFilters({})}>
                      Clear Filters
                    </Button>
                  </div>
                ) : view === 'grid' ? (
                  <CampaignsGrid
                    campaigns={filteredCampaigns}
                    onDelete={handleDeleteCampaign}
                    onUpdate={updateCampaign}
                    onEdit={setSelectedCampaign}
                    onDuplicate={handleDuplicateCampaign}
                  />
                ) : (
                  <CampaignsTable
                    campaigns={filteredCampaigns}
                    onDelete={handleDeleteCampaign}
                    onUpdate={updateCampaign}
                    onEdit={setSelectedCampaign}
                    onDuplicate={handleDuplicateCampaign}
                    selectedCampaignIds={selectedCampaignIds}
                    onCampaignSelect={toggleCampaignSelection}
                    onSelectAll={selectAllCampaigns}
                    allSelected={filteredCampaigns.length > 0 && filteredCampaigns.length === selectedCampaignIds.length}
                  />
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredCampaigns.length} of {campaigns?.length || 0} campaigns
                </div>
                <Button variant="outline" size="sm" onClick={refetchCampaigns}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardFooter>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedCampaignIds.length > 0 && (
              <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-3 flex items-center space-x-3">
                <span className="text-sm font-medium">
                  {selectedCampaignIds.length} campaign(s) selected
                </span>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={handleBulkActivate}>
                    <Play className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkPause}>
                    <Square className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedCampaignIds([])}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(campaignStats.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all campaigns
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{campaignStats.totalVisits.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all campaigns
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Avg. CTR</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercentage(campaignStats.avgCTR)}</div>
                  <p className="text-xs text-muted-foreground">
                    Click-through rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{campaignStats.activeCampaigns}</div>
                  <p className="text-xs text-muted-foreground">
                    Of {campaignStats.totalCampaigns} total
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 mt-4">
            <CampaignAnalytics 
              campaigns={campaigns || []} 
              isLoading={isLoading}
              onRefresh={refetchCampaigns}
            />
          </TabsContent>

          <TabsContent value="performance" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>
                  Detailed performance metrics for your campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center py-8">
                  <p className="text-muted-foreground">Performance metrics coming soon...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="export-import" className="space-y-4 mt-4">
            <CampaignExportImport />
          </TabsContent>
        </Tabs>

        {/* Create Campaign Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-4xl mx-auto">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Set up a new marketing campaign with comprehensive targeting and scheduling options
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateCampaign)} className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto py-2">
                  <Tabs value={createCampaignActiveTab} onValueChange={setCreateCampaignActiveTab} className="flex-1">
                    <div className="border-b px-4">
                      <TabsList>
                        <TabsTrigger value="general" className="flex items-center">
                          <Settings className="h-4 w-4 mr-2" />
                          General
                        </TabsTrigger>
                        <TabsTrigger value="targeting" className="flex items-center">
                          <Target className="h-4 w-4 mr-2" />
                          Targeting
                        </TabsTrigger>
                        <TabsTrigger value="schedule" className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule
                        </TabsTrigger>
                        <TabsTrigger value="profiles" className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          Profiles
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="overflow-y-auto flex-1">
                      <TabsContent value="general" className="p-4 space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                            <CardDescription>Campaign name and description</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Campaign Name *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter campaign name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Enter campaign description" className="min-h-[80px]" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="traffic">Traffic</SelectItem>
                                        <SelectItem value="revenue">Revenue</SelectItem>
                                        <SelectItem value="testing">Testing</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="paused">Paused</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Priority</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select priority" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Target URLs</CardTitle>
                            <CardDescription>URLs that this campaign will target</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="targets.behavior"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Behavior</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="random">Random</SelectItem>
                                      <SelectItem value="sequential">Sequential</SelectItem>
                                      <SelectItem value="weighted">Weighted</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div>
                              <FormLabel>URLs</FormLabel>
                              <div className="space-y-2">
                                {form.watch('targets.urls').map((url, index) => (
                                  <div key={index} className="flex space-x-2">
                                    <FormField
                                      control={form.control}
                                      name={`targets.urls.${index}`}
                                      render={({ field }) => (
                                        <FormItem className="flex-1">
                                          <FormControl>
                                            <Input {...field} placeholder="https://example.com" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => removeArrayItem('targets', 'urls', index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => addArrayItem('targets', 'urls', '')}
                                >
                                  Add URL
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Settings</CardTitle>
                            <CardDescription>Campaign behavior settings</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="settings.dailyVisitTarget"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Daily Visit Target</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder="Enter daily visit target"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="settings.maxConcurrentSessions"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Max Concurrent Sessions</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder="Enter max concurrent sessions"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <FormLabel>Session Duration (seconds)</FormLabel>
                                <div className="grid grid-cols-2 gap-2">
                                  <FormField
                                    control={form.control}
                                    name="settings.sessionDuration.min"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel htmlFor="sessionMin" className="text-xs">Min</FormLabel>
                                        <FormControl>
                                          <Input
                                            id="sessionMin"
                                            type="number"
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="settings.sessionDuration.max"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel htmlFor="sessionMax" className="text-xs">Max</FormLabel>
                                        <FormControl>
                                          <Input
                                            id="sessionMax"
                                            type="number"
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>

                              <div>
                                <FormLabel>Click Rate (%)</FormLabel>
                                <div className="grid grid-cols-2 gap-2">
                                  <FormField
                                    control={form.control}
                                    name="settings.clickRate.min"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel htmlFor="clickMin" className="text-xs">Min</FormLabel>
                                        <FormControl>
                                          <Input
                                            id="clickMin"
                                            type="number"
                                            step="0.1"
                                            {...field}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  <FormField
                                    control={form.control}
                                    name="settings.clickRate.max"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel htmlFor="clickMax" className="text-xs">Max</FormLabel>
                                        <FormControl>
                                          <Input
                                            id="clickMax"
                                            type="number"
                                            step="0.1"
                                            {...field}
                                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </div>
                            </div>

                            <div>
                              <FormLabel>Bounce Rate (%)</FormLabel>
                              <div className="grid grid-cols-2 gap-2">
                                <FormField
                                  control={form.control}
                                  name="settings.bounceRate.min"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel htmlFor="bounceMin" className="text-xs">Min</FormLabel>
                                      <FormControl>
                                        <Input
                                          id="bounceMin"
                                          type="number"
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="settings.bounceRate.max"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel htmlFor="bounceMax" className="text-xs">Max</FormLabel>
                                      <FormControl>
                                        <Input
                                          id="bounceMax"
                                          type="number"
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="targeting" className="p-4 space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Geographic Targeting</CardTitle>
                            <CardDescription>Target specific countries and regions</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="targeting.countries"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Target Countries</FormLabel>
                                  <div className="space-y-2">
                                    {field.value.map((country, index) => (
                                      <div key={index} className="flex space-x-2">
                                        <FormControl className="flex-1">
                                          <Input
                                            value={country}
                                            onChange={(e) => {
                                              const newCountries = [...field.value];
                                              newCountries[index] = e.target.value;
                                              field.onChange(newCountries);
                                            }}
                                            placeholder="US"
                                          />
                                        </FormControl>
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          onClick={() => removeArrayItem('targeting', 'countries', index)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => addArrayItem('targeting', 'countries', '')}
                                    >
                                      Add Country
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle>Ad Network Targeting</CardTitle>
                            <CardDescription>Target specific ad networks</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="targeting.adNetworks"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Ad Networks</FormLabel>
                                  <div className="space-y-2">
                                    {field.value.map((network, index) => (
                                      <div key={index} className="flex space-x-2">
                                        <FormControl className="flex-1">
                                          <Input
                                            value={network}
                                            onChange={(e) => {
                                              const newNetworks = [...field.value];
                                              newNetworks[index] = e.target.value;
                                              field.onChange(newNetworks);
                                            }}
                                            placeholder="adsense"
                                          />
                                        </FormControl>
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          onClick={() => removeArrayItem('targeting', 'adNetworks', index)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => addArrayItem('targeting', 'adNetworks', '')}
                                    >
                                      Add Network
                                    </Button>
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div>
                              <FormLabel>Ad Formats</FormLabel>
                              <div className="space-y-2">
                                {form.watch('targeting.adFormats').map((format, index) => (
                                  <div key={index} className="flex space-x-2">
                                    <FormField
                                      control={form.control}
                                      name={`targeting.adFormats.${index}`}
                                      render={({ field }) => (
                                        <FormItem className="flex-1">
                                          <FormControl>
                                            <Input {...field} placeholder="display" />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => removeArrayItem('targeting', 'adFormats', index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => addArrayItem('targeting', 'adFormats', '')}
                                >
                                  Add Format
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <FormLabel>Device Types</FormLabel>
                                <div className="space-y-2">
                                  {form.watch('targeting.deviceTypes').map((device, index) => (
                                    <div key={index} className="flex space-x-2">
                                      <FormField
                                        control={form.control}
                                        name={`targeting.deviceTypes.${index}`}
                                        render={({ field }) => (
                                          <FormItem className="flex-1">
                                            <FormControl>
                                              <Input {...field} placeholder="desktop" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => removeArrayItem('targeting', 'deviceTypes', index)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => addArrayItem('targeting', 'deviceTypes', '')}
                                  >
                                    Add Device Type
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <FormLabel>Browsers</FormLabel>
                                <div className="space-y-2">
                                  {form.watch('targeting.browsers').map((browser, index) => (
                                    <div key={index} className="flex space-x-2">
                                      <FormField
                                        control={form.control}
                                        name={`targeting.browsers.${index}`}
                                        render={({ field }) => (
                                          <FormItem className="flex-1">
                                            <FormControl>
                                              <Input {...field} placeholder="chrome" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => removeArrayItem('targeting', 'browsers', index)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => addArrayItem('targeting', 'browsers', '')}
                                  >
                                    Add Browser
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="schedule" className="p-4 space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Scheduling</CardTitle>
                            <CardDescription>Control when this campaign runs</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="space-y-4">
                              <FormField
                                control={form.control}
                                name="schedule.enabled"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                      <FormLabel>Enable Scheduling</FormLabel>
                                      <div className="text-sm text-muted-foreground">
                                        Enable or disable campaign scheduling
                                      </div>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="schedule.timezone"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Timezone</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select timezone" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="UTC">UTC</SelectItem>
                                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                                        <SelectItem value="Europe/London">London</SelectItem>
                                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                                        <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <Accordion type="single" collapsible>
                              <AccordionItem value="daily">
                                <AccordionTrigger>Daily Schedule</AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-4 pt-2">
                                    <FormField
                                      control={form.control}
                                      name="schedule.dailySchedule.enabled"
                                      render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                          <div className="space-y-0.5">
                                            <FormLabel>Enable Daily Schedule</FormLabel>
                                            <div className="text-sm text-muted-foreground">
                                              Set specific start and end times each day
                                            </div>
                                          </div>
                                          <FormControl>
                                            <Switch
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />

                                    {form.watch('schedule.dailySchedule.enabled') && (
                                      <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                          control={form.control}
                                          name="schedule.dailySchedule.startTime"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>Start Time</FormLabel>
                                              <FormControl>
                                                <Input type="time" {...field} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />

                                        <FormField
                                          control={form.control}
                                          name="schedule.dailySchedule.endTime"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>End Time</FormLabel>
                                              <FormControl>
                                                <Input type="time" {...field} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>

                              <AccordionItem value="weekly">
                                <AccordionTrigger>Weekly Schedule</AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-4 pt-2">
                                    <FormField
                                      control={form.control}
                                      name="schedule.weeklySchedule.enabled"
                                      render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                          <div className="space-y-0.5">
                                            <FormLabel>Enable Weekly Schedule</FormLabel>
                                            <div className="text-sm text-muted-foreground">
                                              Select which days of the week the campaign runs
                                            </div>
                                          </div>
                                          <FormControl>
                                            <Switch
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />

                                    {form.watch('schedule.weeklySchedule.enabled') && (
                                      <div>
                                        <FormLabel>Select Active Days</FormLabel>
                                        <div className="grid grid-cols-7 gap-2 mt-2">
                                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                                            const dayValue = index === 0 ? 7 : index; // Convert Sunday to 7
                                            const isActive = form.watch('schedule.weeklySchedule.activeDays').includes(dayValue);
                                            
                                            return (
                                              <Button
                                                key={dayValue}
                                                type="button"
                                                variant={isActive ? "default" : "outline"}
                                                size="sm"
                                                className="h-10"
                                                onClick={() => {
                                                  const currentDays = form.getValues('schedule.weeklySchedule.activeDays');
                                                  if (isActive) {
                                                    form.setValue('schedule.weeklySchedule.activeDays', 
                                                      currentDays.filter(d => d !== dayValue));
                                                  } else {
                                                    form.setValue('schedule.weeklySchedule.activeDays', 
                                                      [...currentDays, dayValue].sort((a, b) => a - b));
                                                  }
                                                }}
                                              >
                                                {day}
                                              </Button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>

                              <AccordionItem value="date-range">
                                <AccordionTrigger>Date Range</AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-4 pt-2">
                                    <FormField
                                      control={form.control}
                                      name="schedule.dateRange.enabled"
                                      render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                          <div className="space-y-0.5">
                                            <FormLabel>Enable Date Range</FormLabel>
                                            <div className="text-sm text-muted-foreground">
                                              Set start and end dates for the campaign
                                            </div>
                                          </div>
                                          <FormControl>
                                            <Switch
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />

                                    {form.watch('schedule.dateRange.enabled') && (
                                      <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                          control={form.control}
                                          name="schedule.dateRange.startDate"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>Start Date</FormLabel>
                                              <FormControl>
                                                <Input 
                                                  type="date" 
                                                  {...field} 
                                                  value={field.value || ''}
                                                  onChange={(e) => field.onChange(e.target.value || null)}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />

                                        <FormField
                                          control={form.control}
                                          name="schedule.dateRange.endDate"
                                          render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>End Date</FormLabel>
                                              <FormControl>
                                                <Input 
                                                  type="date" 
                                                  {...field} 
                                                  value={field.value || ''}
                                                  onChange={(e) => field.onChange(e.target.value || null)}
                                                />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="profiles" className="p-4 space-y-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Profile Assignment</CardTitle>
                            <CardDescription>How profiles are assigned to this campaign</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField
                              control={form.control}
                              name="profiles.assignmentType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Assignment Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="auto">Automatic</SelectItem>
                                      <SelectItem value="manual">Manual</SelectItem>
                                      <SelectItem value="category">By Category</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {form.watch('profiles.assignmentType') === 'manual' && (
                              <div>
                                <FormLabel>Assigned Profiles</FormLabel>
                                <div className="space-y-2">
                                  {form.watch('profiles.assignedProfiles').map((profileId, index) => (
                                    <div key={index} className="flex space-x-2">
                                      <FormField
                                        control={form.control}
                                        name={`profiles.assignedProfiles.${index}`}
                                        render={({ field }) => (
                                          <FormItem className="flex-1">
                                            <FormControl>
                                              <Input {...field} placeholder="Profile ID" />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => removeArrayItem('profiles', 'assignedProfiles', index)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => addArrayItem('profiles', 'assignedProfiles', '')}
                                  >
                                    Add Profile
                                  </Button>
                                </div>
                              </div>
                            )}

                            {form.watch('profiles.assignmentType') === 'category' && (
                              <div>
                                <FormLabel>Category Distribution (%)</FormLabel>
                                <div className="space-y-2">
                                  <div className="flex items-center space-x-2">
                                    <FormLabel className="w-32">New Visitors</FormLabel>
                                    <FormField
                                      control={form.control}
                                      name="profiles.categoryDistribution.newVisitor"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min="0"
                                              max="100"
                                              {...field}
                                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <span>%</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <FormLabel className="w-32">Regular Visitors</FormLabel>
                                    <FormField
                                      control={form.control}
                                      name="profiles.categoryDistribution.returningRegular"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min="0"
                                              max="100"
                                              {...field}
                                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <span>%</span>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <FormLabel className="w-32">Loyal Users</FormLabel>
                                    <FormField
                                      control={form.control}
                                      name="profiles.categoryDistribution.loyalUser"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormControl>
                                            <Input
                                              type="number"
                                              min="0"
                                              max="100"
                                              {...field}
                                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <span>%</span>
                                  </div>
                                  <div className="flex items-center space-x-2 pt-2">
                                    <FormLabel className="w-32">Total</FormLabel>
                                    <div className="font-medium">
                                      {(form.watch('profiles.categoryDistribution.newVisitor') || 0) +
                                       (form.watch('profiles.categoryDistribution.returningRegular') || 0) +
                                       (form.watch('profiles.categoryDistribution.loyalUser') || 0)}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <FormField
                              control={form.control}
                              name="profiles.maxProfilesPerCampaign"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel htmlFor="maxProfiles">Max Profiles Per Campaign (0 = unlimited)</FormLabel>
                                  <FormControl>
                                    <Input
                                      id="maxProfiles"
                                      type="number"
                                      min="0"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
                
                <DialogFooter className="flex-shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Campaign'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Campaign Detail Modal */}
        {selectedCampaign && (
          <CampaignDetail 
            campaign={selectedCampaign} 
            onClose={() => setSelectedCampaign(null)}
          />
        )}
      </div>
    </>
  );
}

// Simple grid view component
function CampaignsGrid({ campaigns, onDelete, onUpdate, onEdit, onDuplicate }: { 
  campaigns: Campaign[]; 
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Campaign>) => void;
  onEdit: (campaign: Campaign) => void;
  onDuplicate: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {campaigns.map(campaign => (
        <Card key={campaign.id}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-lg">{campaign.name}</CardTitle>
              <Badge 
                variant={campaign.status === 'active' ? 'default' : 'secondary'}
                className={
                  campaign.status === 'active' ? 'bg-green-100 text-green-800' : 
                  campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
                  campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }
              >
                {campaign.status}
              </Badge>
            </div>
            <CardDescription className="line-clamp-2">
              {campaign.description || 'No description provided'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Type:</span>
                <span className="font-medium capitalize">{campaign.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Priority:</span>
                <span className="font-medium capitalize">{campaign.priority}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Target URLs:</span>
                <span className="font-medium">{campaign.targets?.urls?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Daily Target:</span>
                <span className="font-medium">{campaign.settings?.dailyVisitTarget?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Revenue:</span>
                <span className="font-medium">
                  {campaign.performance?.totalRevenue ? `${campaign.performance.totalRevenue.toLocaleString()}` : '$0'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Visits:</span>
                <span className="font-medium">
                  {campaign.performance?.totalVisits?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>CTR:</span>
                <span className="font-medium">
                  {campaign.performance?.avgCTR ? `${campaign.performance.avgCTR.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex space-x-2">
              {campaign.status === 'active' ? (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onUpdate(campaign.id, { status: 'paused' })}
                >
                  Stop
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onUpdate(campaign.id, { status: 'active' })}
                >
                  Start
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onEdit(campaign)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex space-x-1">
              <Button size="sm" variant="ghost" onClick={() => onDuplicate(campaign.id)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(campaign.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

// Simple table view component
function CampaignsTable({ 
  campaigns, 
  onDelete, 
  onUpdate, 
  onEdit, 
  onDuplicate,
  selectedCampaignIds,
  onCampaignSelect,
  onSelectAll,
  allSelected
}: { 
  campaigns: Campaign[]; 
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Campaign>) => void;
  onEdit: (campaign: Campaign) => void;
  onDuplicate: (id: string) => void;
  selectedCampaignIds: string[];
  onCampaignSelect: (id: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="text-left py-3 px-4">Name</th>
            <th className="text-left py-3 px-4">Status</th>
            <th className="text-left py-3 px-4">Type</th>
            <th className="text-left py-3 px-4">Priority</th>
            <th className="text-left py-3 px-4">Target URLs</th>
            <th className="text-left py-3 px-4">Daily Target</th>
            <th className="text-left py-3 px-4">Revenue</th>
            <th className="text-left py-3 px-4">Visits</th>
            <th className="text-left py-3 px-4">CTR</th>
            <th className="text-left py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map(campaign => (
            <tr key={campaign.id} className="border-b hover:bg-muted/50">
              <td className="py-3 px-4">
                <input
                  type="checkbox"
                  checked={selectedCampaignIds.includes(campaign.id)}
                  onChange={() => onCampaignSelect(campaign.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="py-3 px-4">
                <div>
                  <div className="font-medium">{campaign.name}</div>
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    {campaign.description || 'No description'}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <Badge 
                  variant={campaign.status === 'active' ? 'default' : 'secondary'}
                  className={
                    campaign.status === 'active' ? 'bg-green-100 text-green-800' : 
                    campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
                    campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }
                >
                  {campaign.status}
                </Badge>
              </td>
              <td className="py-3 px-4 capitalize">
                {campaign.type}
              </td>
              <td className="py-3 px-4 capitalize">
                {campaign.priority}
              </td>
              <td className="py-3 px-4">
                {campaign.targets?.urls?.length || 0}
              </td>
              <td className="py-3 px-4">
                {campaign.settings?.dailyVisitTarget?.toLocaleString() || 'N/A'}
              </td>
              <td className="py-3 px-4">
                {campaign.performance?.totalRevenue ? `${campaign.performance.totalRevenue.toLocaleString()}` : '$0'}
              </td>
              <td className="py-3 px-4">
                {campaign.performance?.totalVisits?.toLocaleString() || '0'}
              </td>
              <td className="py-3 px-4">
                {campaign.performance?.avgCTR ? `${campaign.performance.avgCTR.toFixed(2)}%` : 'N/A'}
              </td>
              <td className="py-3 px-4">
                <div className="flex space-x-2">
                  {campaign.status === 'active' ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onUpdate(campaign.id, { status: 'paused' })}
                    >
                      Stop
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => onUpdate(campaign.id, { status: 'active' })}
                    >
                      Start
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => onEdit(campaign)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDuplicate(campaign.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(campaign.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}