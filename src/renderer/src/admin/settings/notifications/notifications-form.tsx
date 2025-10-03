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
import { useSettings } from '../context/settings-context'

const notificationsFormSchema = z.object({
  email: z.boolean().default(false),
  push: z.boolean().default(false),
  in_app: z.boolean().default(true),
  marketing: z.boolean().default(false),
  detection_alerts: z.boolean().default(true),
  automation_alerts: z.boolean().default(true),
  proxy_failure_alerts: z.boolean().default(true),
  fingerprint_change_alerts: z.boolean().default(true),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

export const NotificationsForm = () => {
  const { toast } = useToast()
  const { settings, updateNotifications, isLoading } = useSettings()

  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
      email: settings.notifications.email,
      push: settings.notifications.push,
      in_app: settings.notifications.in_app,
      marketing: settings.notifications.marketing,
      detection_alerts: settings.notifications.detection_alerts,
      automation_alerts: settings.notifications.automation_alerts,
      proxy_failure_alerts: settings.notifications.proxy_failure_alerts,
      fingerprint_change_alerts: settings.notifications.fingerprint_change_alerts,
    },
    mode: 'onChange',
  })

  async function onSubmit(data: NotificationsFormValues) {
    try {
      await updateNotifications(data)

      toast({
        title: 'Notification Settings Updated',
        description: 'Your notification preferences have been saved.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Update Notification Settings',
        description: 'There was an error updating your notification settings.',
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Email Notifications
                  </FormLabel>
                  <FormDescription>
                    Receive notifications via email
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
            name="push"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Push Notifications
                  </FormLabel>
                  <FormDescription>
                    Receive push notifications on your device
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
            name="in_app"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    In-App Notifications
                  </FormLabel>
                  <FormDescription>
                    Show notifications within the application
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
            name="marketing"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Marketing Communications
                  </FormLabel>
                  <FormDescription>
                    Receive emails about new features, events, and promotions
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

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-medium">Automation Alerts</h3>

            <FormField
              control={form.control}
              name="automation_alerts"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      General Automation Alerts
                    </FormLabel>
                    <FormDescription>
                      Receive alerts about automation activities and status
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
              name="detection_alerts"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Anti-Detection Alerts
                    </FormLabel>
                    <FormDescription>
                      Receive alerts when potential detection risks are identified
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
              name="proxy_failure_alerts"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Proxy Failure Alerts
                    </FormLabel>
                    <FormDescription>
                      Receive alerts when proxies fail or become unavailable
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
              name="fingerprint_change_alerts"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Fingerprint Change Alerts
                    </FormLabel>
                    <FormDescription>
                      Receive alerts when browser fingerprint properties change
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
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Update Notifications'}
        </Button>
      </form>
    </Form>
  )
}