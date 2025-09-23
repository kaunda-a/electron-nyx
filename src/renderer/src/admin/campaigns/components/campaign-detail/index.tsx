import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
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
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Calendar, 
  Clock, 
  Globe, 
  Target, 
  Settings, 
  Users, 
  BarChart3, 
  Play, 
  Pause, 
  Square,
  Copy,
  Trash2,
  Save,
  X,
  Edit,
  Loader2,
  CheckCircle,
  AlertCircle,
  Check
} from 'lucide-react';
import { Campaign } from '../../data/schema';
import { useCampaigns } from '../../context/campaigns-context';
import { CampaignLaunch } from './campaign-launch';
import { CampaignScheduling } from '../campaign-scheduling';

interface CampaignDetailProps {
  campaign: Campaign;
  onClose: () => void;
  onLaunch?: (campaignId: string) => void;
}

export function CampaignDetail({ campaign, onClose, onLaunch }: CampaignDetailProps) {
  const { toast } = useToast();
  const { 
    updateCampaign, 
    deleteCampaign,
    getCampaignProfiles,
    validateCampaignProfiles
  } = useCampaigns();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [campaignProfiles, setCampaignProfiles] = useState<any[]>([]);
  const [profileValidation, setProfileValidation] = useState<{ valid: boolean; message: string } | null>(null);

  // Form schema for campaign editing
  const formSchema = z.object({
    name: z.string().min(1, 'Campaign name is required'),
    description: z.string().optional(),
    status: z.enum(['draft', 'active', 'paused', 'completed']),
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
      name: campaign.name || '',
      description: campaign.description || '',
      status: campaign.status || 'draft',
      type: campaign.type || 'traffic',
      priority: campaign.priority || 'medium',
      targets: {
        urls: campaign.targets?.urls || ['https://example.com'],
        behavior: campaign.targets?.behavior || 'random',
      },
      settings: {
        dailyVisitTarget: campaign.settings?.dailyVisitTarget || 1000,
        maxConcurrentSessions: campaign.settings?.maxConcurrentSessions || 10,
        sessionDuration: {
          min: campaign.settings?.sessionDuration?.min || 30,
          max: campaign.settings?.sessionDuration?.max || 300
        },
        clickRate: {
          min: campaign.settings?.clickRate?.min || 0.5,
          max: campaign.settings?.clickRate?.max || 3.0
        },
        bounceRate: {
          min: campaign.settings?.bounceRate?.min || 20,
          max: campaign.settings?.bounceRate?.max || 60
        }
      },
      targeting: {
        countries: campaign.targeting?.countries || ['US'],
        adNetworks: campaign.targeting?.adNetworks || ['adsense'],
        adFormats: campaign.targeting?.adFormats || ['display', 'responsive'],
        deviceTypes: campaign.targeting?.deviceTypes || ['desktop', 'mobile'],
        browsers: campaign.targeting?.browsers || ['chrome', 'firefox', 'safari']
      },
      schedule: {
        enabled: campaign.schedule?.enabled || false,
        timezone: campaign.schedule?.timezone || 'UTC',
        dailySchedule: {
          enabled: campaign.schedule?.dailySchedule?.enabled || false,
          startTime: campaign.schedule?.dailySchedule?.startTime || '09:00',
          endTime: campaign.schedule?.dailySchedule?.endTime || '17:00'
        },
        weeklySchedule: {
          enabled: campaign.schedule?.weeklySchedule?.enabled || false,
          activeDays: campaign.schedule?.weeklySchedule?.activeDays || [1, 2, 3, 4, 5]
        },
        dateRange: {
          enabled: campaign.schedule?.dateRange?.enabled || false,
          startDate: campaign.schedule?.dateRange?.startDate || null,
          endDate: campaign.schedule?.dateRange?.endDate || null
        }
      },
      profiles: {
        assignmentType: campaign.profiles?.assignmentType || 'auto',
        assignedProfiles: campaign.profiles?.assignedProfiles || [],
        categoryDistribution: {
          newVisitor: campaign.profiles?.categoryDistribution?.newVisitor || 40,
          returningRegular: campaign.profiles?.categoryDistribution?.returningRegular || 35,
          loyalUser: campaign.profiles?.categoryDistribution?.loyalUser || 25
        },
        maxProfilesPerCampaign: campaign.profiles?.maxProfilesPerCampaign || 0
      }
    }
  });

  // Fetch campaign profiles and validate them when campaign changes
  useEffect(() => {
    const fetchCampaignProfiles = async () => {
      try {
        // Get profiles used by this campaign that have assigned proxies
        const profiles = await getCampaignProfiles(campaign.id);
        setCampaignProfiles(profiles);
        
        // Validate profiles for anti-detection system
        const validation = await validateCampaignProfiles(campaign.id);
        setProfileValidation(validation);
      } catch (error) {
        console.error('Failed to fetch campaign profiles:', error);
        toast({
          title: 'Failed to load profiles',
          description: 'Could not load profiles for this campaign.',
          variant: 'destructive'
        });
      }
    };
    
    fetchCampaignProfiles();
  }, [campaign.id, getCampaignProfiles, validateCampaignProfiles, toast]);

  // Helper functions for managing array items in the form
  const addArrayItem = (parent: string, field: string, defaultValue: string = '') => {
    const currentValues = form.getValues(parent)[field] || [];
    form.setValue(`${parent}.${field}`, [...currentValues, defaultValue]);
  };

  const removeArrayItem = (parent: string, field: string, index: number) => {
    const currentValues = form.getValues(parent)[field] || [];
    const newValues = [...currentValues];
    newValues.splice(index, 1);
    form.setValue(`${parent}.${field}`, newValues);
  };

  // Handle campaign save
  const handleSave = async (values: CampaignFormValues) => {
    setIsSaving(true);
    try {
      // Prepare campaign data according to the API schema
      const campaignData = {
        name: values.name,
        description: values.description,
        status: values.status,
        type: values.type,
        priority: values.priority,
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
        profiles: values.profiles
      };

      await updateCampaign(campaign.id, campaignData);
      
      toast({
        title: 'Campaign updated',
        description: 'The campaign has been updated successfully.',
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to save campaign:', error);
      toast({
        title: 'Failed to update campaign',
        description: error instanceof Error ? error.message : 'An error occurred while updating the campaign.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle campaign delete
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      try {
        await deleteCampaign(campaign.id);
        toast({
          title: 'Campaign deleted',
          description: 'The campaign has been deleted successfully.',
        });
        onClose();
      } catch (error) {
        console.error('Failed to delete campaign:', error);
        toast({
          title: 'Failed to delete campaign',
          description: error instanceof Error ? error.message : 'An error occurred while deleting the campaign.',
          variant: 'destructive',
        });
      }
    }
  };

  // Handle launch click
  const handleLaunchClick = () => {
    if (onLaunch) {
      onLaunch(campaign.id);
    } else {
      setIsLaunchModalOpen(true);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-4xl mx-auto">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{campaign.name}</DialogTitle>
              <div className="flex items-center space-x-2 mt-1">
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
                <Badge variant="outline">{campaign.type}</Badge>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleLaunchClick}
                disabled={campaign.status !== 'active'}
              >
                <Play className="h-4 w-4 mr-2" />
                Launch
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
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
                    <TabsTrigger value="performance" className="flex items-center">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Performance
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
                        <div>
                          <FormLabel>Behavior</FormLabel>
                          <FormField
                            control={form.control}
                            name="targets.behavior"
                            render={({ field }) => (
                              <FormItem>
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
                        </div>

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
                        <CampaignScheduling 
                          schedule={form.watch('schedule')}
                          onChange={(schedule) => form.setValue('schedule', schedule)}
                        />
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

                    {/* Campaign Profiles Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Campaign Profiles</CardTitle>
                        <CardDescription>Profiles used by this campaign for anti-detection</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Profile Validation Status */}
                        {profileValidation && (
                          <div className={`p-4 rounded-lg ${profileValidation.valid ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                            <div className="flex items-center">
                              {profileValidation.valid ? (
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                              )}
                              <span className={profileValidation.valid ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}>
                                {profileValidation.message}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Profiles List */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-medium">Profiles with Assigned Proxies ({campaignProfiles.length})</h3>
                          </div>
                          
                          {campaignProfiles.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No profiles with assigned proxies found for this campaign.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {campaignProfiles.map((profile) => (
                                <div key={profile.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <div className="font-medium text-sm">{profile.name || `Profile ${profile.id.substring(0, 8)}`}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {profile.config?.category || 'Unknown'} • {profile.config?.os || 'Unknown OS'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                      <Check className="h-3 w-3 mr-1" />
                                      Proxy Assigned
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="performance" className="p-4 space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Performance Metrics</CardTitle>
                        <CardDescription>Campaign performance data</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">Total Visits</div>
                            <div className="text-2xl font-bold">
                              {campaign.performance?.totalVisits?.toLocaleString() || '0'}
                            </div>
                          </div>
                          <div className="border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">Total Revenue</div>
                            <div className="text-2xl font-bold">
                              ${(campaign.performance?.totalRevenue || 0).toLocaleString()}
                            </div>
                          </div>
                          <div className="border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">Avg. Session Duration</div>
                            <div className="text-2xl font-bold">
                              {(campaign.performance?.avgSessionDuration || 0)}s
                            </div>
                          </div>
                          <div className="border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">Avg. CTR</div>
                            <div className="text-2xl font-bold">
                              {(campaign.performance?.avgCTR || 0).toFixed(2)}%
                            </div>
                          </div>
                          <div className="border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">Total Clicks</div>
                            <div className="text-2xl font-bold">
                              {campaign.performance?.totalClicks?.toLocaleString() || '0'}
                            </div>
                          </div>
                          <div className="border rounded-lg p-4">
                            <div className="text-sm text-muted-foreground">Error Rate</div>
                            <div className="text-2xl font-bold">
                              {(campaign.performance?.errorRate || 0).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Additional Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(campaign.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Updated</span>
                            <span>{new Date(campaign.updatedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Created By</span>
                            <span>{campaign.createdBy}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </div>

            <div className="border-t p-4 flex justify-between">
              <div className="space-x-2">
                <Button variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
              <div className="space-x-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={form.handleSubmit(handleSave)} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>

        {/* Campaign Launch Modal */}
        {isLaunchModalOpen && (
          <CampaignLaunch 
            campaign={campaign} 
            onClose={() => setIsLaunchModalOpen(false)}
            onLaunchComplete={() => {
              setIsLaunchModalOpen(false);
              // Refresh campaign data after launch
              // This would typically be handled by the parent component
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}