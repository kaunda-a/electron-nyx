import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
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
import { FingerprintDialog } from '@/admin/profiles/components/fingerprint-dialog';
import {
  MoreHorizontal,
  Play,
  Square,
  Edit,
  Trash,
  Copy,
  ExternalLink,
  Chrome,
  Monitor,
  Globe,
  Shield,
  Clock,
  User
} from 'lucide-react';
import { Profile } from '../api';

interface ProfilesGridProps {
  profiles: Profile[];
  activeProfiles: Record<string, {
    isRunning: boolean;
    hasProxy: boolean;
    launchTime?: Date;
  }>;
  onEdit: (profile: Profile) => void;
  onDelete: (id: string) => void;
  onLaunch: (id: string) => void;
  onClose: (id: string) => void;
}

export function ProfilesGrid({
  profiles,
  activeProfiles,
  onEdit,
  onDelete,
  onLaunch,
  onClose
}: ProfilesGridProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{id: string, name: string} | null>(null);

  const getBrowserIcon = (browser?: string) => {
    // Handle undefined or null browser
    if (!browser) return <Monitor className="h-4 w-4" />;
    
    switch (browser.toLowerCase()) {
      case 'chrome':
        return <Chrome className="h-4 w-4" />;
      case 'firefox':
        return <Monitor className="h-4 w-4" />;
      case 'safari':
        return <Globe className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (profileId: string) => {
    const isActive = activeProfiles[profileId]?.isRunning;
    if (isActive) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          Active
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
        Inactive
      </Badge>
    );
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => {
          const isActive = activeProfiles[profile.id]?.isRunning;
          const hasProxy = !!profile.config?.proxy;

          return (
            <Card key={profile.id} className="relative group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {getBrowserIcon(profile.config?.browser)}
                    <div>
                      <CardTitle className="text-base">{profile.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {profile.config?.os} • {profile.config?.browser}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isActive ? (
                        <DropdownMenuItem onClick={() => onClose(profile.id)}>
                          <Square className="mr-2 h-4 w-4" />
                          Close Browser
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => onLaunch(profile.id)}>
                          <Play className="mr-2 h-4 w-4" />
                          Launch Browser
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onEdit(profile)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(profile.id)}
                        className="text-destructive"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(profile.id)}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Proxy</span>
                  {hasProxy ? (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        <Shield className="h-3 w-3 mr-1" />
                        Assigned
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                      <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
                        <Shield className="h-3 w-3 mr-1" />
                        None
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Fingerprint Information */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fingerprint</span>
                  {profile.fingerprint?.currentFingerprintId ? (
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                      <User className="h-3 w-3 mr-1" />
                      Generated
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
                      <User className="h-3 w-3 mr-1" />
                      None
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm">{formatDate(profile.created_at)}</span>
                </div>
                
                {profile.fingerprint?.currentFingerprintId && (
                  <div className="flex justify-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-6 border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
                      onClick={() => {
                        setSelectedProfile({id: profile.id, name: profile.name});
                        setIsDialogOpen(true);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                )}

                {profile.updated_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Updated</span>
                    <span className="text-sm">{formatDate(profile.updated_at)}</span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-3">
                <div className="flex w-full space-x-2">
                  {isActive ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => onClose(profile.id)}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => onLaunch(profile.id)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Launch
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onEdit(profile)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>

              {isActive && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {selectedProfile && (
        <FingerprintDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen} 
          profileId={selectedProfile.id} 
          profileName={selectedProfile.name} 
        />
      )}
    </>
  );
}