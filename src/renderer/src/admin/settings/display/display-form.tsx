import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

const displayFormSchema = z.object({
  sidebar_collapsed: z.boolean().default(false),
  show_welcome: z.boolean().default(true),
  density: z.string({
    required_error: 'Please select a display density.',
  }),
  animations: z.boolean().default(true),
  show_fingerprint_stats: z.boolean().default(true),
  show_detection_risk: z.boolean().default(true),
  show_automation_logs: z.boolean().default(true),
  real_time_monitoring: z.boolean().default(true),
})

type DisplayFormValues = z.infer<typeof displayFormSchema>

export const DisplayForm = () => {
  const { toast } = useToast()
  const { settings, updateDisplay, isLoading } = useSettings()

  const form = useForm<DisplayFormValues>({
    resolver: zodResolver(displayFormSchema),
    defaultValues: {
      sidebar_collapsed: settings.display.sidebar_collapsed,
      show_welcome: settings.display.show_welcome,
      density: settings.display.density,
      animations: settings.display.animations,
      show_fingerprint_stats: settings.display.show_fingerprint_stats,
      show_detection_risk: settings.display.show_detection_risk,
      show_automation_logs: settings.display.show_automation_logs,
      real_time_monitoring: settings.display.real_time_monitoring,
    },
    mode: 'onChange',
  })

  async function onSubmit(data: DisplayFormValues) {
    try {
      await updateDisplay({
        sidebar_collapsed: data.sidebar_collapsed,
        show_welcome: data.show_welcome,
        density: data.density as 'compact' | 'normal' | 'spacious',
        animations: data.animations,
        show_fingerprint_stats: data.show_fingerprint_stats,
        show_detection_risk: data.show_detection_risk,
        show_automation_logs: data.show_automation_logs,
        real_time_monitoring: data.real_time_monitoring,
      })

      toast({
        title: 'Display Settings Updated',
        description: 'Your display preferences have been saved.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Update Display Settings',
        description: 'There was an error updating your display settings.',
      })
    }
  }

  // Density options
  const densityOptions = [
    { value: 'compact', label: 'Compact' },
    { value: 'normal', label: 'Normal' },
    { value: 'spacious', label: 'Spacious' },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="density"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Interface Density</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select interface density" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {densityOptions.map((density) => (
                    <SelectItem key={density.value} value={density.value}>
                      {density.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Adjust the spacing and compactness of the interface.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormField
            control={form.control}
            name="animations"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Enable Animations
                  </FormLabel>
                  <FormDescription>
                    Enable smooth transitions and animations throughout the app
                  </FormDescription>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sidebar_collapsed"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Collapsed Sidebar
                  </FormLabel>
                  <FormDescription>
                    Show sidebar in collapsed mode by default
                  </FormDescription>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="show_welcome"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Show Welcome Message
                  </FormLabel>
                  <FormDescription>
                    Display welcome message on application start
                  </FormDescription>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-medium">Automation Display Options</h3>

          <FormField
            control={form.control}
            name="show_fingerprint_stats"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Show Fingerprint Statistics
                  </FormLabel>
                  <FormDescription>
                    Display browser fingerprint statistics and details
                  </FormDescription>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="show_detection_risk"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Show Detection Risk
                  </FormLabel>
                  <FormDescription>
                    Display detection risk indicators and scores
                  </FormDescription>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="show_automation_logs"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Show Automation Logs
                  </FormLabel>
                  <FormDescription>
                    Display detailed automation logs and activities
                  </FormDescription>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="real_time_monitoring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Real-time Monitoring
                  </FormLabel>
                  <FormDescription>
                    Enable real-time monitoring of automation activities
                  </FormDescription>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Update Display Settings'}
        </Button>
      </form>
    </Form>
  )
}