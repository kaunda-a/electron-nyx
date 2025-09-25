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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Play,
  Square,
  Edit,
  Trash,
  Download,
  Globe,
  Monitor,
  Fingerprint,
  Settings,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Layers,
  RefreshCw,
  ExternalLink,
  Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Profile } from '../api';
import { useProfiles } from '../context/profile-context';
import { formatDistanceToNow, format } from 'date-fns';

import { ProxySelectionModal } from '../components/proxy-selection-modal';
import { ProfileEditModal } from '../components/profile-edit-modal';

export interface ProfileDetailsProps {
  profile: Profile;
}

export const ProfileDetails: React.FC<ProfileDetailsProps> = ({ profile }) => {
  const {
    launchProfile,
    closeBrowser,
    deleteProfile,
    activeProfiles,
    assignProxyToProfile,
    removeProxyFromProfile,
    proxies,
    getFingerprint,
    refetchProfiles,
    updateProfile
  } = useProfiles();

  const [activeTab, setActiveTab] = useState('overview');
  const [isLaunching, setIsLaunching] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [fingerprintData, setFingerprintData] = useState<any>(null);
  const [isProxyModalOpen, setIsProxyModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFingerprintDialogOpen, setIsFingerprintDialogOpen] = useState(false);

  const isActive = !!activeProfiles[profile.id]?.isRunning;
  const hasProxy = !!profile.config.proxy;
  const launchTime = activeProfiles[profile.id]?.launchTime;

  // Load fingerprint data when tab changes to fingerprint
  useEffect(() => {
    if (activeTab === 'fingerprint' && isActive && !fingerprintData) {
      loadFingerprint();
    }
  }, [activeTab, isActive]);

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format exact date
  const formatExactDate = (dateString?: string) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      return format(date, 'PPpp'); // Format: Apr 29, 2023, 1:30 PM
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format fingerprint data for display
  const formatFingerprintData = () => {
    if (!fingerprintData) return 'No fingerprint data available';
    
    try {
      // Create a copy of the fingerprint data to avoid modifying the original
      const displayData = { ...fingerprintData };
      
      // Remove any functions or complex objects that can't be serialized
      const cleanData = JSON.parse(JSON.stringify(displayData, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value === undefined) return '[undefined]';
        return value;
      }, 2));
      
      return JSON.stringify(cleanData, null, 2);
    } catch (error) {
      console.error('Error formatting fingerprint data:', error);
      return 'Error formatting fingerprint data';
    }
  };

  // Load fingerprint data
  const loadFingerprint = async () => {
    if (!isActive) return;

    setFingerprintLoading(true);
    try {
      const data = await getFingerprint(profile.id);
      setFingerprintData(data);
    } catch (error) {
      console.error('Failed to load fingerprint:', error);
    } finally {
      setFingerprintLoading(false);
    }
  };

  // Handle launch profile
  const handleLaunch = async (useProxy: boolean = true) => {
    setIsLaunching(true);
    try {
      await launchProfile(profile.id, { useProxy });
    } catch (error) {
      console.error('Failed to launch profile:', error);
    } finally {
      setIsLaunching(false);
    }
  };

  // Handle close browser
  const handleClose = async () => {
    setIsClosing(true);
    try {
      await closeBrowser(profile.id);
      // Clear fingerprint data when browser is closed
      setFingerprintData(null);
    } catch (error) {
      console.error('Failed to close browser:', error);
    } finally {
      setIsClosing(false);
    }
  };

  // Handle delete profile
  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete profile "${profile.name}"?`)) {
      try {
        await deleteProfile(profile.id);
      } catch (error) {
        console.error('Failed to delete profile:', error);
      }
    }
  };

  // Handle assign proxy
  const handleAssignProxy = async () => {
    setIsProxyModalOpen(true);
  };

  // Handle proxy assigned
  const handleProxyAssigned = async () => {
    // Refresh profiles to get updated data
    await refetchProfiles();
  };

  // Handle remove proxy
  const handleRemoveProxy = async () => {
    if (window.confirm('Are you sure you want to remove the proxy from this profile?')) {
      try {
        await removeProxyFromProfile(profile.id);
        // Refresh profiles to get updated data
        await refetchProfiles();
      } catch (error) {
        console.error('Failed to remove proxy:', error);
      }
    }
  };

  // Ref for 3D card effect
  const cardRef = useRef<HTMLDivElement>(null);

  // Add 3D card effect
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate rotation based on mouse position
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      // Add spotlight effect
      const spotlights = card.querySelectorAll('.spotlight');
      spotlights.forEach(spotlight => {
        spotlight.setAttribute('style', `--x: ${x}px; --y: ${y}px;`);
      });
    };

    const handleMouseLeave = () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
              {profile.name}
            </span>
          </CardTitle>
          <CardDescription>
            Created {formatDate(profile.created_at)}
          </CardDescription>
          <div className="flex space-x-1">
            {isActive && (
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-sm animate-pulse">
                <div className="mr-1 h-2 w-2 rounded-full bg-white"></div>
                Active
              </Badge>
            )}
            {hasProxy && (
              <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-sm">
                <Globe className="mr-1 h-3 w-3" />
                Proxy
              </Badge>
            )}
          </div>
        </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="mx-6 rounded-lg border border-gradient-to-r from-gray-700 to-gray-800">
          <TabsList className="grid grid-cols-3 bg-black/20 border-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Monitor className="mr-2 h-4 w-4" />
              {activeTab === 'overview' ? (
                <span className="text-blue-500">Overview</span>
              ) : (
                'Overview'
              )}
            </TabsTrigger>
            <TabsTrigger value="fingerprint" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Fingerprint className="mr-2 h-4 w-4" />
              {activeTab === 'fingerprint' ? (
                <NeonText variant="blue" intensity="low">Fingerprint</NeonText>
              ) : (
                'Fingerprint'
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Settings className="mr-2 h-4 w-4" />
              {activeTab === 'settings' ? (
                <NeonText variant="blue" intensity="low">Settings</NeonText>
              ) : (
                'Settings'
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <CardContent className="pt-6 flex-1 overflow-auto">
          <TabsContent value="overview" className="space-y-4 h-full">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 bg-background/50 p-3 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-primary/80">OS</p>
                <p className="text-sm capitalize">{profile.config.os || 'Auto'}</p>
              </div>
              <div className="space-y-1 bg-background/50 p-3 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-primary/80">Browser</p>
                <p className="text-sm capitalize">{profile.config.browser || 'Auto'}</p>
              </div>
              <div className="space-y-1 bg-background/50 p-3 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-primary/80">Category</p>
                <p className="text-sm capitalize">{profile.config.category || 'newVisitor'}</p>
              </div>
              <div className="space-y-1 bg-background/50 p-3 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-primary/80">Country</p>
                <p className="text-sm capitalize">{profile.config.countryCode || 'US'}</p>
              </div>
              <div className="space-y-1 bg-background/50 p-3 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-primary/80">Last Updated</p>
                <p className="text-sm">{formatDate(profile.updated_at)}</p>
              </div>
              <div className="space-y-1 bg-background/50 p-3 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-primary/80">Status</p>
                <div className="flex items-center">
                  {isActive ? (
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                      <p className="text-sm text-green-600">Running</p>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground mr-2"></div>
                      <p className="text-sm">Stopped</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {profile.metadata?.geographic && (
              <div className="mt-4 p-4 border border-green-500/20 rounded-lg bg-green-500/5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-16 h-16 bg-green-500/10 rounded-full blur-xl"></div>
                <h4 className="text-sm font-medium flex items-center text-green-600">
                  <Globe className="mr-2 h-4 w-4" />
                  Geographic Information
                </h4>
                <div className="mt-2 text-sm grid grid-cols-2 gap-1">
                  <p><span className="font-medium">Country:</span> {profile.metadata.geographic.countryName}</p>
                  <p><span className="font-medium">Timezone:</span> {profile.metadata.geographic.timezone}</p>
                  <p><span className="font-medium">Language:</span> {profile.metadata.geographic.language}</p>
                  <p><span className="font-medium">City:</span> {profile.metadata.geographic.city}</p>
                </div>
              </div>
            )}

            {hasProxy && (
              <div className="mt-4 p-4 border border-blue-500/20 rounded-lg bg-blue-500/5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-16 h-16 bg-blue-500/10 rounded-full blur-xl"></div>

                <h4 className="text-sm font-medium flex items-center text-blue-600">
                  <Globe className="mr-2 h-4 w-4" />
                  Proxy Configuration
                </h4>
                <div className="mt-2 text-sm">
                  <p><span className="font-medium">Server:</span> {profile.config.proxy?.server}</p>
                  {profile.config.proxy?.username && (
                    <p><span className="font-medium">Username:</span> {profile.config.proxy.username}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                  onClick={handleRemoveProxy}
                >
                  Remove Proxy
                </Button>
              </div>
            )}

            {!hasProxy && (
              <Button
                variant="outline"
                className="w-full mt-3 border-blue-500/30 text-blue-600 hover:bg-blue-500/10 relative overflow-hidden group"
                onClick={handleAssignProxy}
              >
                <Globe className="mr-2 h-4 w-4" />
                Assign Proxy
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-blue-500/10 to-transparent -translate-x-full group-hover:animate-pulse" />
              </Button>
            )}
            
            {profile.fingerprint?.currentFingerprintId && (
              <div className="mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full border-purple-500/30 text-purple-600 hover:bg-purple-500/10 relative overflow-hidden group"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Full Fingerprint
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-purple-500/10 to-transparent -translate-x-full group-hover:animate-pulse" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Fingerprint Details</AlertDialogTitle>
                      <AlertDialogDescription>
                        Full fingerprint data for profile: {profile.name}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[60vh]">
                        {formatFingerprintData()}
                      </pre>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Close</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(formatFingerprintData());
                          }}
                        >
                          Copy to Clipboard
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </TabsContent>

          <TabsContent value="fingerprint" className="space-y-4 h-full">
            {fingerprintLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl animate-pulse"></div>
                  <RefreshCw className="h-10 w-10 animate-spin text-primary relative" />
                </div>
                <p className="mt-4 text-muted-foreground">Loading fingerprint data...</p>
              </div>
            ) : !isActive ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Fingerprint className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  Launch the browser to view the actual fingerprint data
                </p>
                <Card className="mt-4 overflow-hidden bg-transparent border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                  <CardContent className="p-4">
                    <Button
                      variant="ghost"
                      onClick={() => handleLaunch(true)}
                      className="bg-transparent border-0 relative overflow-hidden group w-full"
                    >
                      <Play className="mr-2 h-4 w-4 text-blue-400" />
                      <span className="text-blue-500">Launch Browser</span>
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -translate-x-full group-hover:animate-pulse" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-primary/80">Browser</h4>
                  <div className="p-4 border border-border/30 rounded-lg bg-background/50 backdrop-blur-sm">
                    <p className="text-sm"><span className="font-medium">User Agent:</span> {fingerprintData?.navigator?.userAgent || profile.fingerprint?.navigator?.userAgent || 'Not available'}</p>
                    <p className="text-sm"><span className="font-medium">Platform:</span> {fingerprintData?.navigator?.platform || profile.fingerprint?.navigator?.platform || profile.config.os || 'Auto'}</p>
                    <p className="text-sm"><span className="font-medium">Language:</span> {fingerprintData?.navigator?.language || profile.fingerprint?.navigator?.language || profile.config.language || profile.config.locale || 'Auto'}</p>
                    <p className="text-sm"><span className="font-medium">Hardware Concurrency:</span> {fingerprintData?.navigator?.hardwareConcurrency || profile.fingerprint?.navigator?.hardwareConcurrency || 'Auto'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-primary/80">Screen</h4>
                  <div className="p-4 border border-border/30 rounded-lg bg-background/50 backdrop-blur-sm">
                    <p className="text-sm"><span className="font-medium">Resolution:</span> {
                      (fingerprintData?.screen?.width && fingerprintData?.screen?.height) ||
                      (profile.fingerprint?.screen?.width && profile.fingerprint?.screen?.height)
                        ? `${fingerprintData?.screen?.width || profile.fingerprint?.screen?.width} x ${fingerprintData?.screen?.height || profile.fingerprint?.screen?.height}`
                        : 'Auto'
                    }</p>
                    <p className="text-sm"><span className="font-medium">Color Depth:</span> {
                      fingerprintData?.screen?.colorDepth || profile.fingerprint?.screen?.colorDepth || 'Auto'
                    }</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-primary/80">Viewport</h4>
                  <div className="p-4 border border-border/30 rounded-lg bg-background/50 backdrop-blur-sm">
                    <p className="text-sm"><span className="font-medium">Size:</span> {
                      profile.config.viewport?.width && profile.config.viewport?.height
                        ? `${profile.config.viewport.width} x ${profile.config.viewport.height}`
                        : 'Auto'
                    }</p>
                    <p className="text-sm"><span className="font-medium">Timezone:</span> {profile.config.timezone || 'Auto'}</p>
                  </div>
                </div>

                {profile.fingerprint?.webgl && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-primary/80">WebGL</h4>
                    <div className="p-4 border border-border/30 rounded-lg bg-background/50 backdrop-blur-sm">
                      <p className="text-sm"><span className="font-medium">Vendor:</span> {profile.fingerprint.webgl.vendor || 'Auto'}</p>
                      <p className="text-sm"><span className="font-medium">Renderer:</span> {profile.fingerprint.webgl.renderer || 'Auto'}</p>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={loadFingerprint}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Fingerprint
                </Button>
                
                <AlertDialog open={isFingerprintDialogOpen} onOpenChange={setIsFingerprintDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 ml-2"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Full Fingerprint
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Fingerprint Details</AlertDialogTitle>
                      <AlertDialogDescription>
                        Full fingerprint data for profile: {profile.name}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-auto max-h-[60vh]">
                        {formatFingerprintData()}
                      </pre>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Close</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button 
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(formatFingerprintData());
                          }}
                        >
                          Copy to Clipboard
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 h-full">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-primary/80">Browser Settings</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg bg-background/50">
                  <p className="text-sm">Humanize</p>
                  <Badge className={profile.config.humanize
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0"
                    : "bg-muted text-muted-foreground"
                  }>
                    {profile.config.humanize ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg bg-background/50">
                  <p className="text-sm">Block WebRTC</p>
                  <Badge className={profile.config.block_webrtc
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0"
                    : "bg-muted text-muted-foreground"
                  }>
                    {profile.config.block_webrtc ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 border border-border/30 rounded-lg bg-background/50">
                  <p className="text-sm">GeoIP Spoofing</p>
                  <Badge className={profile.config.geoip
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0"
                    : "bg-muted text-muted-foreground"
                  }>
                    {profile.config.geoip ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-3 bg-gradient-to-r from-primary to-blue-600 border-0 shadow-md relative overflow-hidden group"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Settings
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-pulse" />
            </Button>
          </TabsContent>
        </CardContent>
      </Tabs>

      <CardFooter className="flex justify-between border-t border-border/40 bg-black/30 backdrop-blur-sm">
        <Card className="bg-transparent border border-gray-700/50 p-2 flex justify-between w-full">
          {isActive ? (
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isClosing}
              className="relative overflow-hidden group bg-black/30 border-gray-700"
            >
              {isClosing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Stopping...
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  <span className="text-red-500">Stop Browser</span>
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-red-500/10 to-transparent -translate-x-full group-hover:animate-pulse" />
                </>
              )}
            </Button>
          ) : (
            <div className="flex space-x-2">
              <div className="rounded-md border border-gradient-to-r from-gray-700 to-gray-800">
                <Button
                  onClick={() => handleLaunch(true)}
                  disabled={isLaunching}
                  className="bg-black/50 hover:bg-black/70 text-white border-0 relative overflow-hidden group"
                >
                  {isLaunching ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      <span className="text-blue-500">Launch with Proxy</span>
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-pulse" />
                    </>
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => handleLaunch(false)}
                disabled={isLaunching}
                className="relative overflow-hidden group bg-black/30 border-gray-700"
              >
                {isLaunching ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    Launch without Proxy
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full group-hover:animate-pulse" />
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="flex space-x-2">
            <Button variant="outline" size="icon" className="rounded-full bg-black/30 border-gray-700 hover:bg-black/50">
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={handleDelete}
              className="rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </CardFooter>
    </Card>
    <ProxySelectionModal 
      open={isProxyModalOpen}
      onOpenChange={setIsProxyModalOpen}
      profileId={profile.id}
      onProxyAssigned={handleProxyAssigned}
    />
    <ProfileEditModal
      open={isEditModalOpen}
      onOpenChange={setIsEditModalOpen}
      profile={profile}
      onUpdateProfile={updateProfile}
    />
    </>
  );
};
