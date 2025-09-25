import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useProfiles } from '../../context/profile-context'
import { profilesApi } from '../../api/profiles-api'
import { useToast } from '@/hooks/use-toast'

interface Props {
  open: boolean
}

export function ProfileDeleteDialog({ open }: Props) {
  const { setOpen, currentProfile } = useProfiles()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { mutate: deleteProfile, isPending } = useMutation({
    mutationFn: () => 
      profilesApi.delete(currentProfile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast({ title: 'Profile deleted successfully' })
      setOpen(null)
    },
    onError: () => {
      toast({ 
        title: 'Failed to delete profile',
        variant: 'destructive'
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={() => setOpen(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Profile</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          Are you sure you want to delete the profile {currentProfile?.name}? This action cannot be undone.
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(null)}>
            Cancel
          </Button>
          <Button 
            variant="destructive"
            onClick={() => deleteProfile()}
            disabled={isPending}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}