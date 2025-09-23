import React, { useState } from 'react';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ProfileCreateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProfile: (data: any) => Promise<void>;
}

export function ProfileCreateDrawer({ open, onOpenChange, onCreateProfile }: ProfileCreateDrawerProps) {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'newVisitor',
    os: 'Windows',
    browser: 'Chrome',
    autoAssignProxy: true,
    countryCode: 'US',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Prepare profile data according to the API schema
      const profileData = {
        name: formData.name,
        config: {
          os: formData.os,
          browser: formData.browser,
          countryCode: formData.countryCode,
          category: formData.category,
          autoAssignProxy: formData.autoAssignProxy,
          // We can add more fields here as needed
        }
      };
      
      // Create the profile
      await onCreateProfile(profileData);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'newVisitor',
        os: 'Windows',
        browser: 'Chrome',
        autoAssignProxy: true,
        countryCode: 'US',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Create New Profile</SheetTitle>
          <SheetDescription>
            Create a new browser profile with unique fingerprint and proxy settings
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-2">
              <div className="space-y-4 py-4 pr-2 -mr-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Profile Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter profile name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter profile description (optional)"
                    className="min-h-[100px]"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => handleSelectChange('category', value)}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newVisitor">New Visitor</SelectItem>
                        <SelectItem value="returningRegular">Returning Regular</SelectItem>
                        <SelectItem value="loyalUser">Loyal User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="countryCode">Country</Label>
                    <Select
                      value={formData.countryCode}
                      onValueChange={(value) => handleSelectChange('countryCode', value)}
                    >
                      <SelectTrigger id="countryCode">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="JP">Japan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="os">Operating System</Label>
                    <Select
                      value={formData.os}
                      onValueChange={(value) => handleSelectChange('os', value)}
                    >
                      <SelectTrigger id="os">
                        <SelectValue placeholder="Select OS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Windows">Windows</SelectItem>
                        <SelectItem value="macOS">macOS</SelectItem>
                        <SelectItem value="Linux">Linux</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="browser">Browser</Label>
                    <Select
                      value={formData.browser}
                      onValueChange={(value) => handleSelectChange('browser', value)}
                    >
                      <SelectTrigger id="browser">
                        <SelectValue placeholder="Select browser" />
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
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoAssignProxy"
                    name="autoAssignProxy"
                    checked={formData.autoAssignProxy}
                    onChange={(e) => setFormData(prev => ({ ...prev, autoAssignProxy: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="autoAssignProxy" className="cursor-pointer">Auto-assign proxy (recommended)</Label>
                </div>
              </div>
            </div>
            
            <SheetFooter className="flex-shrink-0">
              <SheetClose asChild>
                <Button variant="outline">Cancel</Button>
              </SheetClose>
              <Button type="submit" disabled={isSubmitting || !formData.name}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Profile'
                )}
              </Button>
            </SheetFooter>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}