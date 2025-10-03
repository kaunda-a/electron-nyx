import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettings } from '../context/settings-context'

const appearanceFormSchema = z.object({
  theme: z.string({
    required_error: 'Please select a theme.',
  }),
  font: z.string({
    required_error: 'Please select a font.',
  }),
})

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>

export const AppearanceForm = () => {
  const { toast } = useToast()
  const { settings, updateTheme, updateFont, isLoading } = useSettings()

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      theme: settings.theme || 'dark',
      font: settings.font || 'inter',
    },
    mode: 'onChange',
  })

  async function onSubmit(data: AppearanceFormValues) {
    try {
      // Update both theme and font
      await Promise.all([
        updateTheme(data.theme as 'light' | 'dark' | 'system'),
        updateFont(data.font)
      ])

      toast({
        title: 'Appearance Settings Updated',
        description: 'Your theme and font preferences have been saved.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Update Appearance Settings',
        description: 'There was an error updating your appearance settings.',
      })
    }
  }

  // Theme options
  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ]

  // Font options
  const fonts = [
    { value: 'inter', label: 'Inter (Default)' },
    { value: 'system', label: 'System Default' },
    { value: 'roboto', label: 'Roboto' },
    { value: 'open-sans', label: 'Open Sans' },
    { value: 'lato', label: 'Lato' },
    { value: 'raleway', label: 'Raleway' },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="theme"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Theme</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your preferred theme" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {themes.map((theme) => (
                    <SelectItem key={theme.value} value={theme.value}>
                      {theme.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Choose how the application looks to you. This affects colors, backgrounds, and more.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="font"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Font</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your preferred font" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {fonts.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select the font used throughout the application interface.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Update Appearance'}
        </Button>
      </form>
    </Form>
  )
}