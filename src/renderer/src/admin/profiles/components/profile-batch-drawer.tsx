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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, Loader2, Info } from 'lucide-react';
import { profilesApi } from '../api/profiles-api';

interface ProfileBatchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ProfileBatchDrawer({ open, onOpenChange, onImportComplete }: ProfileBatchDrawerProps) {
  const [count, setCount] = useState(10);
  const [prefix, setPrefix] = useState('Profile');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: number; errorMessages: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate random profile names
  const generateProfileName = (index: number) => {
    const adjectives = ['Quick', 'Smart', 'Fast', 'Secure', 'Elite', 'Pro', 'Premium', 'Advanced', 'Super', 'Ultra'];
    const nouns = ['Browser', 'Navigator', 'Surfer', 'Explorer', 'Agent', 'Runner', 'Crawler', 'Scout', 'Seeker', 'Hunter'];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    
    return `${prefix} ${randomAdjective} ${randomNoun} ${index + 1}`;
  };

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    setImportResult(null);

    try {
      let createdCount = 0;
      let errorCount = 0;
      const errorMessages: string[] = [];

      // Create profiles individually
      for (let i = 0; i < count; i++) {
        try {
          const profileName = generateProfileName(i);
          
          const profileData = {
            name: profileName,
            config: {
              autoAssignProxy: true,
              category: 'newVisitor',
              countryCode: 'US',
              os: 'Windows',
              browser: 'Chrome'
            }
          };
          
          await profilesApi.create(profileData);
          createdCount++;
        } catch (err) {
          errorCount++;
          const errorMessage = err instanceof Error ? err.message : String(err);
          errorMessages.push(`Profile ${i + 1}: ${errorMessage}`);
        }
      }

      setImportResult({
        created: createdCount,
        errors: errorCount,
        errorMessages
      });

      // If we created at least one profile, refresh the list
      if (createdCount > 0) {
        onImportComplete();
      }

      // Reset form if all profiles were created successfully
      if (errorCount === 0) {
        onOpenChange(false);
      }

    } catch (err) {
      setError('Failed to create profiles: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>Batch Create Profiles</SheetTitle>
          <SheetDescription>
            Create multiple browser profiles at once with random names.
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 p-4 rounded-lg border">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium mb-1">How it works</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>Enter the number of profiles you want to create</li>
                    <li>Optionally set a prefix for profile names</li>
                    <li>Profiles will be created with random names</li>
                    <li>Each profile will be automatically assigned an available proxy if one exists</li>
                    <li>Profiles without available proxies will not be created</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="count">Number of Profiles</Label>
                <Input
                  id="count"
                  type="number"
                  min="1"
                  max="1000"
                  value={count}
                  onChange={(e) => setCount(Math.min(1000, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a number between 1 and 1000
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prefix">Name Prefix (Optional)</Label>
                <Input
                  id="prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="Profile"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Example: "Shopping", "Social Media", "Research"
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {importResult && (
              <Alert variant={importResult.errors > 0 ? "destructive" : "default"}>
                <AlertTitle>
                  {importResult.errors > 0 ? (
                    <div className="flex items-center">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Import Completed with Issues
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Check className="h-4 w-4 mr-2" />
                      Import Successful
                    </div>
                  )}
                </AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      Created: <span className="font-medium">{importResult.created} profiles</span>
                      <br />
                      Errors: <span className="font-medium">{importResult.errors} profiles</span>
                    </p>
                    {importResult.errorMessages.length > 0 && (
                      <div className="mt-2">
                        <p className="font-medium">Error details:</p>
                        <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                          {importResult.errorMessages.slice(0, 3).map((msg, index) => (
                            <li key={index} className="text-muted-foreground">{msg}</li>
                          ))}
                          {importResult.errorMessages.length > 3 && (
                            <li className="text-muted-foreground">
                              ...and {importResult.errorMessages.length - 3} more errors
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <SheetFooter className="flex-shrink-0">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button
            onClick={handleImport}
            disabled={isImporting || count < 1}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating {count} Profiles...
              </>
            ) : (
              `Create ${count} Profiles`
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}