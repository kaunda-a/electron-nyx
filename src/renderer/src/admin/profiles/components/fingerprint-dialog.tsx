import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface FingerprintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
}

export function FingerprintDialog({ open, onOpenChange, profileId, profileName }: FingerprintDialogProps) {
  const [fingerprintData, setFingerprintData] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && profileId) {
      loadFingerprintData();
    }
  }, [open, profileId]);

  const loadFingerprintData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Import the profiles API client
      const { profilesApi } = await import('@/admin/profiles/api/profiles-api');
      
      // Use the API client to get fingerprint data
      const data = await profilesApi.getFingerprint(profileId);
      
      // Set fingerprint data
      setFingerprintData(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err.message || 'Failed to load fingerprint data');
      toast({
        title: 'Error',
        description: `Failed to load fingerprint data: ${err.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Fingerprint Data for {profileName}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-destructive p-4 bg-destructive/10 rounded-md">
                {error}
              </div>
            ) : (
              <div className="max-h-96 overflow-auto whitespace-pre-wrap break-words bg-muted p-4 rounded-md text-sm font-mono">
                {fingerprintData}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}