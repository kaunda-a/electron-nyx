import React, { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
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
  Check
} from 'lucide-react';
import { useProfiles } from '../context/profile-context';
import { ProfileCreate, Profile, ProfileUpdate } from '../api';
import { GradientBorder } from '../components/ui/gradient-border';
import { NeonText } from '../components/ui/neon-text';
import { GlassCard } from '../components/ui/glass-card';

interface ProfileActionsProps {
  onRefresh: () => void;
  onImport: () => void;
  onCreate: () => void;
  loading?: boolean;
}

export const ProfileActions: React.FC<ProfileActionsProps> = ({ 
  onRefresh, 
  onImport, 
  onCreate, 
  loading = false 
}) => {
  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </Button>

      <Dialog>
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
            <Button variant="outline" onClick={() => {}}>
              Cancel
            </Button>
            <Button onClick={onImport}>
              Import Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Profile
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-md mx-auto">
          <DialogHeader className="flex-shrink-0 sticky top-0 z-10 bg-background pb-4">
            <DialogTitle>Create New Profile</DialogTitle>
            <DialogDescription>
              Create a new browser profile with custom settings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1 -mr-1">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Profile Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="My Profile"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="os">Operating System</Label>
                  <Select>
                    <SelectTrigger id="os">
                      <SelectValue placeholder="Select OS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="windows">Windows</SelectItem>
                      <SelectItem value="macos">macOS</SelectItem>
                      <SelectItem value="linux">Linux</SelectItem>
                      <SelectItem value="android">Android</SelectItem>
                      <SelectItem value="ios">iOS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="browser">Browser</Label>
                  <Select>
                    <SelectTrigger id="browser">
                      <SelectValue placeholder="Select Browser" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chrome">Chrome</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                      <SelectItem value="safari">Safari</SelectItem>
                      <SelectItem value="edge">Edge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoAssignProxy"
                  name="autoAssignProxy"
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="autoAssignProxy" className="cursor-pointer">Auto-assign proxy</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 sticky bottom-0 bg-background pt-4">
            <Button variant="outline" onClick={() => {}}>
              Cancel
            </Button>
            <Button onClick={onCreate}>
              Create Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};