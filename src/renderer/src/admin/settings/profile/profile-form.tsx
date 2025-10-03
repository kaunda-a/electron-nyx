import { z } from 'zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSettings } from '../context/settings-context'

const profileFormSchema = z.object({
  name: z
    .string()
    .min(2, {
      message: 'Name must be at least 2 characters.',
    })
    .max(50, {
      message: 'Name must not be longer than 50 characters.',
    }),
  email: z
    .string({ required_error: 'Please enter an email to display.' })
    .email(),
  bio: z.string().max(500).min(0).optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  urls: z
    .array(
      z.object({
        value: z.string().url({ message: 'Please enter a valid URL.' }).optional(),
      })
    )
    .optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export default function ProfileForm() {
  const { toast } = useToast()
  const { settings, updateProfile, isLoading } = useSettings()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: settings.profile.name || '',
      email: settings.account?.email || settings.profile.email || '',
      bio: settings.profile.bio || '',
      avatar_url: settings.profile.avatar_url || '',
      urls: settings.profile.urls || [{ value: '' }],
    },
    mode: 'onChange',
  })

  const { fields, append, remove } = useFieldArray({
    name: 'urls',
    control: form.control,
  })

  async function onSubmit(data: ProfileFormValues) {
    try {
      await updateProfile({
        name: data.name,
        bio: data.bio,
        avatar_url: data.avatar_url,
        urls: data.urls?.filter(url => url.value && url.value.trim() !== '') || [],
      })

      toast({
        title: 'Profile Updated Successfully',
        description: 'Your profile information has been saved.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Update Profile',
        description: 'There was an error updating your profile information.',
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder='John Doe' {...field} />
              </FormControl>
              <FormDescription>
                This is your display name. For maximum privacy, we recommend using a pseudonym
                that cannot be linked to your real identity.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='email@example.com' {...field} />
              </FormControl>
              <FormDescription>
                Your email address for account notifications and recovery.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='avatar_url'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input placeholder='https://example.com/avatar.jpg' {...field} />
              </FormControl>
              <FormDescription>
                URL to your profile picture. Leave blank to use default avatar.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name='bio'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Tell us a little bit about yourself and your experience with Nyx'
                  className='resize-none'
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormDescription>
                A short bio that appears on your profile. Max 500 characters.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-4">
          <div>
            <FormLabel>Personal URLs</FormLabel>
            <FormDescription>
              Add links to your website, blog, or social media profiles.
            </FormDescription>
          </div>
          
          {fields.map((field, index) => (
            <FormField
              control={form.control}
              key={field.id}
              name={`urls.${index}.value`}
              render={({ field }) => (
                <FormItem className="flex flex-col sm:flex-row items-start gap-2 space-y-0">
                  <div className="flex-1">
                    <FormControl>
                      <Input 
                        placeholder={`https://example.com (URL ${index + 1})`} 
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => remove(index)}
                      className="mt-0"
                    >
                      Remove
                    </Button>
                  )}
                </FormItem>
              )}
            />
          ))}
          
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ value: '' })}
          >
            Add URL
          </Button>
        </div>
        
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update Profile'}
        </Button>
      </form>
    </Form>
  )
}