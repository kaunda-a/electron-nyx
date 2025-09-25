import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Upload,
  RefreshCw,
  Copy,
  Layers,
  Settings,
  Check,
  Loader2
} from 'lucide-react';
import { useProfiles } from '../context/profile-context';
import { ProfileCreate } from '../api';

interface ProfileActionsResponsiveProps {
  onRefresh: () => void;
  onImport: () => void;
  onCreate: () => void;
  loading?: boolean;
}

export function ProfileActionsResponsive({ 
  onRefresh, 
  onImport, 
  onCreate, 
  loading = false 
}: ProfileActionsResponsiveProps) {
  const { profiles, createProfile } = useProfiles();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [newProfile, setNewProfile] = useState({
    name: '',
    description: '',
    category: 'newVisitor',
    config: {
      os: 'Windows',
      browser: 'Chrome',
      autoAssignProxy: true,
      countryCode: 'US',
    }
  });

  // Helper function to construct the proxy server string
  const constructProxyServer = (protocol: string, host: string, port: string | number) => {
    return `${protocol}://${host}:${port}`;
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProfile(prev => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setNewProfile(prev => ({ ...prev, [name]: value }));
  };

  // Handle config changes
  const handleConfigChange = (name: string, value: any) => {
    setNewProfile(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [name]: value
      }
    }));
  };

  // Handle proxy protocol change
  const handleProxyProtocolChange = (value: string) => {
    if (newProfile.config?.proxy) {
      const updatedProxy = {
        ...newProfile.config.proxy,
        protocol: value
      };
      handleConfigChange('proxy', updatedProxy);
    }
  };

  // Handle proxy host change
  const handleProxyHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (newProfile.config?.proxy) {
      const updatedProxy = {
        ...newProfile.config.proxy,
        host: e.target.value
      };
      handleConfigChange('proxy', updatedProxy);
    }
  };

  // Handle proxy port change
  const handleProxyPortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (newProfile.config?.proxy) {
      const updatedProxy = {
        ...newProfile.config.proxy,
        port: parseInt(e.target.value) || 0
      };
      handleConfigChange('proxy', updatedProxy);
    }
  };

  // Handle proxy username change
  const handleProxyUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (newProfile.config?.proxy) {
      const updatedProxy = {
        ...newProfile.config.proxy,
        username: e.target.value
      };
      handleConfigChange('proxy', updatedProxy);
    }
  };

  // Handle proxy password change
  const handleProxyPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (newProfile.config?.proxy) {
      const updatedProxy = {
        ...newProfile.config.proxy,
        password: e.target.value
      };
      handleConfigChange('proxy', updatedProxy);
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      // Prepare profile data
      const profileData = {
        name: newProfile.name,
        description: newProfile.description,
        category: newProfile.category,
        config: {
          os: newProfile.config?.os,
          browser: newProfile.config?.browser,
          autoAssignProxy: newProfile.config?.autoAssignProxy,
          countryCode: newProfile.config?.countryCode,
        }
      };
      
      // Create the profile
      await createProfile(profileData);
      
      // Reset form
      setNewProfile({
        name: '',
        description: '',
        category: 'newVisitor',
        config: {
          os: 'Windows',
          browser: 'Chrome',
          autoAssignProxy: true,
          countryCode: 'US',
        }
      });
      
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create profile:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle import profile
  const handleImportProfile = async () => {
    // Implementation would go here
    console.log('Import profile functionality would go here');
    setIsImportDialogOpen(false);
  };

  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogTrigger asChild>
          <GradientBorder
            variant="green"
            animate={true}
            intensity="low"
            borderWidth="thin"
            className="rounded-md"
          >
            <Button variant="outline" size="sm" className="bg-transparent border-0">
              <Upload className="mr-2 h-4 w-4 text-green-400" />
              <NeonText variant="green" intensity="low">
                Import
              </NeonText>
            </Button>
          </GradientBorder>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md mx-auto">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Import Profile</DialogTitle>
            <DialogDescription>
              Import a profile from a JSON file.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1 -mr-1">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file">Profile File</Label>
                <Input id="file" type="file" accept=".json" />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportProfile}>
              Import Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* We'll use Tailwind's built-in animation classes instead of custom keyframes */}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Profile
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md mx-auto">
          <DialogHeader className="flex-shrink-0 sticky top-0 z-10 bg-background pb-4">
            <DialogTitle>Create New Profile</DialogTitle>
            <DialogDescription>
              Create a new browser profile with unique fingerprint and proxy settings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1 -mr-1">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Profile Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="My Profile"
                  value={newProfile.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="os">Operating System</Label>
                  <Select
                    value={newProfile.config?.os}
                    onValueChange={(value) => handleSelectChange('os', value)}
                  >
                    <SelectTrigger id="os">
                      <SelectValue placeholder="Select OS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Windows">Windows</SelectItem>
                      <SelectItem value="macOS">macOS</SelectItem>
                      <SelectItem value="Linux">Linux</SelectItem>
                      <SelectItem value="Android">Android</SelectItem>
                      <SelectItem value="iOS">iOS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="browser">Browser</Label>
                  <Select
                    value={newProfile.config?.browser}
                    onValueChange={(value) => handleSelectChange('browser', value)}
                  >
                    <SelectTrigger id="browser">
                      <SelectValue placeholder="Select Browser" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Chrome">Chrome</SelectItem>
                      <SelectItem value="Firefox">Firefox</SelectItem>
                      <SelectItem value="Safari">Safari</SelectItem>
                      <SelectItem value="Edge">Edge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Proxy Selection */}
              <div className="space-y-2">
                <Label htmlFor="proxy">Proxy Configuration</Label>
                <Select
                  value={newProfile.config?.proxy ? 'custom' : 'none'}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      handleConfigChange('proxy', null);
                    } else if (value === 'custom') {
                      // If no proxy is set, initialize with empty values
                      if (!newProfile.config?.proxy) {
                        // Initialize with empty values
                        const protocol = 'http'; // HTTP supports authentication
                        const host = '';
                        const port = '8080'; // Default HTTP proxy port

                        handleConfigChange('proxy', {
                          // UI fields
                          protocol,
                          host,
                          port: parseInt(port),

                          // Server fields (what actually gets sent)
                          server: constructProxyServer(protocol, host, port),
                          username: '',
                          password: ''
                        });
                      }
                    }
                  }}
                >
                  <SelectTrigger id="proxy">
                    <SelectValue placeholder="Select Proxy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Proxy</SelectItem>
                    <SelectItem value="custom">Custom Proxy</SelectItem>
                  </SelectContent>
                </Select>

                {newProfile.config?.proxy && (
                  <div className="space-y-4 mt-2 p-3 border rounded-md">
                    {/* Protocol Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="proxy-protocol">Protocol</Label>
                      <Select
                        value={newProfile.config.proxy.protocol || 'http'}
                        onValueChange={handleProxyProtocolChange}
                      >
                        <SelectTrigger id="proxy-protocol">
                          <SelectValue placeholder="Select Protocol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="http">HTTP (Standard - Auth Supported)</SelectItem>
                          <SelectItem value="https">HTTPS (Secure - Auth Supported)</SelectItem>
                          <SelectItem value="socks4">SOCKS4 (Proxy - No Auth)</SelectItem>
                          <SelectItem value="socks5">SOCKS5 (Proxy - No Auth Support)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Host and Port */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="proxy-host">Host</Label>
                        <Input
                          id="proxy-host"
                          placeholder="proxy.example.com (no protocol)"
                          value={newProfile.config.proxy.host || ''}
                          onChange={handleProxyHostChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="proxy-port">Port</Label>
                        <Input
                          id="proxy-port"
                          placeholder="8080"
                          value={newProfile.config.proxy.port?.toString() || ''}
                          onChange={handleProxyPortChange}
                        />
                      </div>
                    </div>

                    {/* Authentication */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="proxy-username">Username</Label>
                        <Input
                          id="proxy-username"
                          placeholder="Username"
                          value={newProfile.config.proxy.username || ''}
                          onChange={handleProxyUsernameChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="proxy-password">Password</Label>
                        <Input
                          id="proxy-password"
                          type="password"
                          placeholder="••••••••"
                          value={newProfile.config.proxy.password || ''}
                          onChange={handleProxyPasswordChange}
                        />
                      </div>
                    </div>

                    {/* Authentication Warning */}
                    {newProfile.config?.proxy?.protocol === 'socks5' &&
                     (newProfile.config?.proxy?.username || newProfile.config?.proxy?.password) && (
                      <div className="mt-2 p-2 border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-400">
                        <strong>Warning:</strong> SOCKS5 proxies do not support authentication in this browser.
                        Please use HTTP or HTTPS protocol if you need to use username and password, or use a SOCKS5 proxy that doesn't require authentication.
                      </div>
                    )}

                    {/* Proxy Help Text */}
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p className="mb-1">
                        <strong>Note:</strong> If you're experiencing connection issues, try:
                      </p>
                      <ul className="list-disc pl-4 mt-1 space-y-1">
                        <li>Using HTTP or HTTPS protocol if you need authentication</li>
                        <li>Verifying the host and port are correct</li>
                        <li>Checking your proxy credentials (not supported with SOCKS5)</li>
                        <li>Ensuring the proxy server is online and accessible</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Advanced Settings</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="humanize"
                      checked={newProfile.config?.humanize}
                      onChange={(e) => handleConfigChange('humanize', e.target.checked)}
                    />
                    <Label htmlFor="humanize" className="cursor-pointer">Humanize</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="block_webrtc"
                      checked={newProfile.config?.block_webrtc}
                      onChange={(e) => handleConfigChange('block_webrtc', e.target.checked)}
                    />
                    <Label htmlFor="block_webrtc" className="cursor-pointer">Block WebRTC</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="geoip"
                      checked={newProfile.config?.geoip}
                      onChange={(e) => handleConfigChange('geoip', e.target.checked)}
                    />
                    <Label htmlFor="geoip" className="cursor-pointer">GeoIP Spoofing</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 sticky bottom-0 bg-background pt-4">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || !newProfile.name}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Profile'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}