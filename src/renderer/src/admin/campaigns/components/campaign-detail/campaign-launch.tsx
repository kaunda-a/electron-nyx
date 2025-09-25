import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Play, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  X,
  Users,
  Database,
  Zap
} from 'lucide-react';
import { useCampaigns } from '../../context/campaigns-context';
import { Campaign } from '../../data/schema';

interface CampaignLaunchProps {
  campaign: Campaign;
  onClose: () => void;
  onLaunchComplete?: () => void;
}

export function CampaignLaunch({ campaign, onClose, onLaunchComplete }: CampaignLaunchProps) {
  const { launchCampaign, getCampaignProgress } = useCampaigns();
  const [launchOptions, setLaunchOptions] = useState({
    profileCount: 1,
    profileIds: [] as string[],
    useEnhanced: false,
    useBatch: false,
    useDatabaseStorage: false,
    customProfileIds: '',
    showBrowserWindows: true // Show browser windows by default
  });
  
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState<'idle' | 'launching' | 'running' | 'completed' | 'failed'>('idle');
  const [progressMessage, setProgressMessage] = useState('');
  const [progressDetails, setProgressDetails] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const handleLaunch = async () => {
    setIsLaunching(true);
    setProgressStatus('launching');
    setProgressMessage('Initializing campaign launch...');
    
    try {
      // Parse custom profile IDs if provided
      let profileIds = launchOptions.profileIds;
      if (launchOptions.customProfileIds.trim()) {
        profileIds = launchOptions.customProfileIds.split(',').map(id => id.trim()).filter(id => id);
      }
      
      const options = {
        profileCount: launchOptions.profileCount,
        profileIds: profileIds.length > 0 ? profileIds : undefined,
        useEnhanced: launchOptions.useEnhanced,
        useBatch: launchOptions.useBatch,
        useDatabaseStorage: launchOptions.useDatabaseStorage,
        options: {
          headless: false // Show browser windows
        }
      };
      
      const result = await launchCampaign(campaign.id, options);
      setLaunchResult(result);
      
      if (result.success) {
        setProgressStatus('running');
        setProgressMessage('Campaign launched successfully. Monitoring progress...');
        
        // Start polling for progress if we have a job ID
        if (result.data?.jobId) {
          startProgressPolling(result.data.jobId);
        } else {
          // For immediate launches, simulate progress
          simulateProgress();
        }
      } else {
        setProgressStatus('failed');
        setProgressMessage(result.message || 'Failed to launch campaign');
      }
    } catch (error: any) {
      setProgressStatus('failed');
      setProgressMessage(error.message || 'Failed to launch campaign');
    } finally {
      setIsLaunching(false);
    }
  };

  const startProgressPolling = (jobId: string) => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Start new polling interval
    const interval = setInterval(async () => {
      try {
        const progressData = await getCampaignProgress(campaign.id);
        updateProgressFromData(progressData);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      }
    }, 2000); // Poll every 2 seconds
    
    setPollingInterval(interval);
  };

  const simulateProgress = () => {
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Simulate progress updates
    let progressValue = 0;
    const interval = setInterval(() => {
      progressValue += 5;
      if (progressValue >= 100) {
        progressValue = 100;
        setProgressStatus('completed');
        setProgressMessage('Campaign completed successfully!');
        clearInterval(interval);
        if (onLaunchComplete) onLaunchComplete();
      }
      setProgress(progressValue);
    }, 500);
    
    setPollingInterval(interval);
  };

  const updateProgressFromData = (data: any) => {
    if (data.status === 'completed') {
      setProgressStatus('completed');
      setProgress(100);
      setProgressMessage('Campaign completed successfully!');
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (onLaunchComplete) onLaunchComplete();
    } else if (data.status === 'failed') {
      setProgressStatus('failed');
      setProgressMessage('Campaign failed to complete');
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    } else {
      setProgressStatus('running');
      setProgress(data.progress || 0);
      setProgressMessage(`Campaign is running... ${data.progress || 0}% complete`);
      setProgressDetails({
        totalProfiles: data.totalProfiles,
        completedProfiles: data.completedProfiles,
        failedProfiles: data.failedProfiles,
        estimatedCompletion: data.estimatedCompletion
      });
    }
  };

  const handleCancel = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    onClose();
  };

  const handleProfileCountChange = (value: string) => {
    const count = parseInt(value) || 1;
    setLaunchOptions(prev => ({
      ...prev,
      profileCount: Math.max(1, count)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold">Launch Campaign</h2>
            <p className="text-sm text-muted-foreground">{campaign.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {progressStatus === 'idle' || progressStatus === 'launching' ? (
            <Card>
              <CardHeader>
                <CardTitle>Launch Configuration</CardTitle>
                <CardDescription>Configure how this campaign will be launched</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="profileCount">Number of Profiles</Label>
                  <Input
                    id="profileCount"
                    type="number"
                    min="1"
                    value={launchOptions.profileCount}
                    onChange={(e) => handleProfileCountChange(e.target.value)}
                    disabled={isLaunching}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    How many browser profiles to use for this campaign
                  </p>
                </div>

                <div>
                  <Label>Custom Profile IDs (optional)</Label>
                  <Textarea
                    value={launchOptions.customProfileIds}
                    onChange={(e) => setLaunchOptions(prev => ({
                      ...prev,
                      customProfileIds: e.target.value
                    }))}
                    placeholder="Enter profile IDs separated by commas"
                    disabled={isLaunching}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Specific profile IDs to use (overrides profile count)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="flex items-center">
                        <Zap className="h-4 w-4 mr-2" />
                        Show Browser Windows
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Show visible browser windows instead of running in background
                      </p>
                    </div>
                    <Switch
                      checked={launchOptions.showBrowserWindows}
                      onCheckedChange={(checked) => setLaunchOptions(prev => ({
                        ...prev,
                        showBrowserWindows: checked
                      }))}
                      disabled={isLaunching}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Batch Processing
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Use batch processing for large campaigns
                      </p>
                    </div>
                    <Switch
                      checked={launchOptions.useBatch}
                      onCheckedChange={(checked) => setLaunchOptions(prev => ({
                        ...prev,
                        useBatch: checked
                      }))}
                      disabled={isLaunching}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="flex items-center">
                        <Database className="h-4 w-4 mr-2" />
                        Database Storage
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Use database storage instead of file-based
                      </p>
                    </div>
                    <Switch
                      checked={launchOptions.useDatabaseStorage}
                      onCheckedChange={(checked) => setLaunchOptions(prev => ({
                        ...prev,
                        useDatabaseStorage: checked
                      }))}
                      disabled={isLaunching}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={handleLaunch} 
                  disabled={isLaunching}
                >
                  {isLaunching ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Launch Campaign
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  {progressStatus === 'completed' ? 'Campaign Completed' : 
                   progressStatus === 'failed' ? 'Campaign Failed' : 'Campaign Running'}
                </CardTitle>
                <CardDescription>
                  {campaign.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    {progressStatus === 'completed' ? (
                      <CheckCircle className="h-16 w-16 text-green-500" />
                    ) : progressStatus === 'failed' ? (
                      <AlertCircle className="h-16 w-16 text-red-500" />
                    ) : (
                      <RefreshCw className="h-16 w-16 text-blue-500 animate-spin" />
                    )}
                  </div>
                  
                  <p className="text-lg font-medium mb-2">{progressMessage}</p>
                  
                  {(progressStatus === 'running' || progressStatus === 'completed') && (
                    <div className="space-y-2">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground">{progress}% complete</p>
                    </div>
                  )}
                </div>

                {progressDetails && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Total Profiles</div>
                      <div className="text-lg font-bold">{progressDetails.totalProfiles}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Completed</div>
                      <div className="text-lg font-bold text-green-600">{progressDetails.completedProfiles}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Failed</div>
                      <div className="text-lg font-bold text-red-600">{progressDetails.failedProfiles}</div>
                    </div>
                    <div className="border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Est. Completion</div>
                      <div className="text-lg font-bold">{progressDetails.estimatedCompletion}</div>
                    </div>
                  </div>
                )}

                {launchResult && launchResult.data && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">Launch Details</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Job ID:</span>
                        <span>{launchResult.data.jobId || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Workflow:</span>
                        <span>{launchResult.data.workflow || 'N/A'}</span>
                      </div>
                      {launchResult.data.totalProfiles && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Profiles:</span>
                          <span>{launchResult.data.totalProfiles}</span>
                        </div>
                      )}
                      {launchResult.data.estimatedDuration && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Est. Duration:</span>
                          <span>{launchResult.data.estimatedDuration}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={handleCancel}
                >
                  {progressStatus === 'completed' ? 'Close' : 'Cancel'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}