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

const accountFormSchema = z.object({
  language: z.string({
    required_error: 'Please select a language.',
  }),
  timezone: z.string({
    required_error: 'Please select a timezone.',
  }),
  date_format: z.string({
    required_error: 'Please select a date format.',
  }),
  time_format: z.string({
    required_error: 'Please select a time format.',
  }),
})

type AccountFormValues = z.infer<typeof accountFormSchema>

export const AccountForm = () => {
  const { toast } = useToast()
  const { settings, updateAccount, isLoading } = useSettings()

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      language: settings.account.language,
      timezone: settings.account.timezone,
      date_format: settings.account.date_format,
      time_format: settings.account.time_format,
    },
    mode: 'onChange',
  })

  async function onSubmit(data: AccountFormValues) {
    try {
      await updateAccount({
        language: data.language,
        timezone: data.timezone,
        date_format: data.date_format,
        time_format: data.time_format,
      })

      toast({
        title: 'Account Settings Updated',
        description: 'Your account preferences have been saved.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Update Account Settings',
        description: 'There was an error updating your account settings.',
      })
    }
  }

  // Language options
  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ru', label: 'Russian' },
  ]

  // Timezone options (simplified)
  const timezones = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
    { value: 'Asia/Kolkata', label: 'Kolkata' },
  ]

  // Date format options
  const dateFormats = [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (09/04/2024)' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (04/09/2024)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-09-04)' },
    { value: 'DD MMM YYYY', label: 'DD MMM YYYY (04 Sep 2024)' },
  ]

  // Time format options
  const timeFormats = [
    { value: '12h', label: '12-hour (02:30 PM)' },
    { value: '24h', label: '24-hour (14:30)' },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Language</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your preferred language" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                This is the language used throughout the application.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your timezone" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Your timezone is used for displaying dates and times in your local context.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date_format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date Format</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your preferred date format" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {dateFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                This is how dates will be displayed throughout the application.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="time_format"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time Format</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your preferred time format" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {timeFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                This is how times will be displayed throughout the application.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Update Account Settings'}
        </Button>
      </form>
    </Form>
  )
}