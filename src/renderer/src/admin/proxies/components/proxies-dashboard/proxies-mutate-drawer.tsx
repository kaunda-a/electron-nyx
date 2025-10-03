import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, Check, Upload, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Form,
  FormControl,
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ProxyConfig, CreateProxy, UpdateProxy } from '../../data/schema'

// Extended Proxy interface for UI needs
interface ExtendedProxy extends ProxyConfig {
  name?: string;
  type?: string | null;
  provider?: string | null;
  country?: string;
  location?: {
    country?: string;
  };
  auth?: {
    username?: string;
    password?: string;
  };
}

import { proxiesApi } from '../../api/proxies-api'
import { useProxies } from '../../context/proxies-context'
import { ProxyUrlParser } from './proxy-url-parser'
import { ProxyBulkInput } from './proxy-bulk-input'
import { validateProxy, ProxyValidationResult } from '../../utils/proxy-validator'
import { identifyProxy, getProxyTypeLabel, getProxyTypeColor } from '../../utils/proxy-identifier'
import { formatProxyServer, formatProxyUrl } from '../../utils/proxy-url-parser'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: ExtendedProxy | null
}

// Form schema for the UI
const formSchema = z.object({
  // Required fields
  host: z.string().min(1, 'Host is required.'),
  port: z.string().min(1, 'Port is required.'),
  protocol: z.enum(['http', 'https', 'socks4', 'socks5']),
  name: z.string().min(1, 'Name is required.'),

  // Optional fields
  username: z.string().optional(),
  password: z.string().optional(),
  country: z.string().optional(),
  type: z.string().optional(),
  provider: z.string().optional(),
})

type ProxyForm = z.infer<typeof formSchema>

export function ProxiesMutateDrawer({ open, onOpenChange, currentRow }: Props) {
  const { toast } = useToast()
  const { fetchProxies } = useProxies()
  const isUpdate = !!currentRow
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ProxyValidationResult | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null)

  const form = useForm<ProxyForm>({
    resolver: zodResolver(formSchema),
    defaultValues: currentRow ? {
      name: currentRow.name || `Proxy ${currentRow.host}:${currentRow.port}`,
      host: currentRow.host,
      port: currentRow.port.toString(),
      protocol: currentRow.protocol as any,
      username: currentRow.username || currentRow.auth?.username || '',
      password: currentRow.auth?.password || '',
      country: currentRow.country || currentRow.location?.country || '',
      type: currentRow.type === null ? '' : currentRow.type || '',
      provider: currentRow.provider === null ? '' : currentRow.provider || '',
    } : {
      protocol: 'http',
      name: `New Proxy ${new Date().toISOString().slice(0, 10)}`,
      host: '',
      port: '',
      username: '',
      password: '',
      country: '',
      type: '',
      provider: '',
    },
  })

  // Auto-identify proxy type when host changes
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      if (name === 'host' || name === 'username') {
        const host = form.getValues('host')
        const username = form.getValues('username')
        const port = parseInt(form.getValues('port') || '0')

        if (host) {
          const { type, provider } = identifyProxy(host, port, username)
          if (type !== 'unknown') {
            form.setValue('type', type)
          }
          if (provider) {
            form.setValue('provider', provider)
          }
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const onSubmit = async (values: ProxyForm) => {
    setIsSubmitting(true)
    try {
      // Check if proxy validation API is available before proceeding
      if (typeof window === 'undefined' || !window.api || !window.api.proxies || !window.api.proxies.validate) {
        toast({
          title: "Validation Service Unavailable",
          description: "Proxy validation service is not available. Please ensure the application is properly initialized.",
          variant: "destructive",
        });
        return;
      }

      // Auto-validate the proxy before saving
      setValidationResult(null);

      try {
        // Only validate if not already validated or if validation failed
        if (!validationResult || !validationResult.isValid) {
          toast({
            title: "Validating Proxy",
            description: "Testing proxy connectivity before saving...",
          });

          // Format the server string for validation
          const serverString = formatProxyServer(values.host, values.port);
          console.log('Validating proxy with formatted server string:', serverString);

          const result = await validateProxy(
            values.host,
            parseInt(values.port),
            values.protocol,
            values.username,
            values.password
          );

          setValidationResult(result);

          if (result.isValid) {
            toast({
              title: "Proxy Validated",
              description: `Proxy is working correctly. Response time: ${result.responseTime}ms`,
            });
          } else {
            // Still allow saving invalid proxies, but warn the user
            toast({
              title: "Proxy Validation Failed",
              description: result.error || "The proxy could not be validated. Saving anyway.",
              variant: "destructive",
            });
          }
        }
      } catch (validationError) {
        // Validation failed but we'll still allow saving the proxy
        toast({
          title: "Validation Error",
          description: "Could not validate proxy, but will save it anyway.",
          variant: "destructive",
        });
      }

      // Format the server string for the backend using our utility
      const serverString = formatProxyServer(values.host, values.port);

      // Prepare form data that matches the backend API expectations
      if (isUpdate && currentRow) {
        const updateData: UpdateProxy = {
          host: values.host,
          port: parseInt(values.port),
          protocol: values.protocol,
          // Only include optional fields if they have values
          ...(values.username ? { username: values.username } : {}),
          ...(values.password ? { password: values.password } : {})
        };

        // Log the formatted proxy URL for debugging
        console.log('Updating proxy with formatted URL:',
          formatProxyUrl(values.protocol, values.host, values.port, values.username, values.password, true)
        );

        await proxiesApi.update(currentRow.id, updateData);
      } else {
        const createData: CreateProxy = {
          host: values.host,
          port: parseInt(values.port),
          protocol: values.protocol,
          // Only include optional fields if they have values
          ...(values.username ? { username: values.username } : {}),
          ...(values.password ? { password: values.password } : {}),
          verify: true // Always verify new proxies
        };

        // Log the formatted proxy URL for debugging
        console.log('Creating proxy with formatted URL:',
          formatProxyUrl(values.protocol, values.host, values.port, values.username, values.password, true)
        );

        await proxiesApi.create(createData);
      }

      toast({
        title: `Proxy ${isUpdate ? 'Updated' : 'Created'}`,
        description: `Successfully ${isUpdate ? 'updated' : 'created'} proxy.`,
      })
      fetchProxies()
      onOpenChange(false)
    } catch (error) {
      toast({
        title: `Failed to ${isUpdate ? 'Update' : 'Create'} Proxy`,
        description: "An error occurred while saving the proxy.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>{isUpdate ? 'Edit' : 'Add'} Proxy</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? "Update your proxy settings here."
              : "Add a new proxy to your collection."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="manual" className="w-full mt-6 h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="url">URL Parser</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-2">
              <TabsContent value="url">
                <div className="space-y-4 py-4 h-full flex flex-col">
                  <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    <ProxyUrlParser
                      onParse={async (parsedData) => {
                        // Update form values with parsed data
                        form.setValue('protocol', parsedData.protocol);
                        form.setValue('host', parsedData.host);
                        form.setValue('port', parsedData.port);
                        if (parsedData.username) form.setValue('username', parsedData.username);
                        if (parsedData.password) form.setValue('password', parsedData.password);

                        // Identify proxy type
                        const { type, provider } = identifyProxy(
                          parsedData.host,
                          parseInt(parsedData.port),
                          parsedData.username
                        );
                        if (type !== 'unknown') form.setValue('type', type);
                        if (provider) form.setValue('provider', provider);

                        // Validate the parsed proxy
                        try {
                          // Check if proxy validation API is available before proceeding
                          if (typeof window === 'undefined' || !window.api || !window.api.proxies || !window.api.proxies.validate) {
                            toast({
                              title: "Validation Service Unavailable",
                              description: "Proxy validation service is not available. Please ensure the application is properly initialized.",
                              variant: "destructive",
                            });
                            return;
                          }

                          toast({
                            title: "Validating Parsed Proxy",
                            description: "Testing proxy connectivity...",
                          });

                          const result = await validateProxy(
                            parsedData.host,
                            parseInt(parsedData.port),
                            parsedData.protocol,
                            parsedData.username,
                            parsedData.password
                          );

                          if (result.isValid) {
                            toast({
                              title: "Proxy Validated",
                              description: `Proxy is working correctly. Response time: ${result.responseTime}ms`,
                            });
                          } else {
                            toast({
                              title: "Proxy Validation Failed",
                              description: result.error || "The proxy could not be validated.",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          toast({
                            title: "Validation Error",
                            description: "Could not validate proxy.",
                            variant: "destructive",
                          });
                        }

                        // Switch to manual tab to show the populated form
                        setTimeout(() => {
                          const manualTab = document.querySelector('[data-value="manual"]') as HTMLElement;
                          if (manualTab) manualTab.click();
                        }, 0);
                      }}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bulk">
                <div className="space-y-4 py-4 h-full flex flex-col">
                  <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                                          <ProxyBulkInput
                        onParse={async (parsedProxies) => {
                          if (parsedProxies.length > 0) {
                            try {
                              // Convert parsed proxies to CreateProxy format
                              const proxiesToCreate = parsedProxies.map(proxy => ({
                                host: proxy.host,
                                port: parseInt(proxy.port),
                                protocol: proxy.protocol || 'http',
                                username: proxy.username,
                                password: proxy.password
                              }));

                              // Create all proxies at once, even if it's just one
                              const response = await proxiesApi.createBatch(proxiesToCreate);
                              console.log('Batch create response:', response);
                              
                              // Handle different response structures
                              let imported = 0;
                              let errors = 0;
                              
                              if (response && typeof response === 'object') {
                                // The server returns {success, message, imported, errors, details}
                                if (typeof response.imported === 'number') {
                                  imported = response.imported;
                                }
                                
                                if (typeof response.errors === 'number') {
                                  errors = response.errors;
                                }
                              }
                              
                              toast({
                                title: 'Bulk Import Successful',
                                description: `Successfully created ${imported} proxies. ${errors} proxies failed to import.`,
                              });

                              // Refresh the proxy list
                              fetchProxies();

                              // Close the drawer
                              onOpenChange(false);
                            } catch (error) {
                              console.error('Bulk import error:', error);
                              console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                              toast({
                                title: 'Bulk Import Failed',
                                description: error instanceof Error ? error.message : 'Failed to create proxies in batch',
                                variant: 'destructive',
                              });
                            } finally {
                              // Reset submitting state
                              setIsSubmitting(false);
                            }
                          }
                        }}
                        onAddStart={() => {
                          // Set submitting state when add operation starts
                          setIsSubmitting(true);
                        }}
                        onCancel={() => {
                          // Switch to manual tab
                          setTimeout(() => {
                            const manualTab = document.querySelector('[data-value="manual"]') as HTMLElement;
                            if (manualTab) manualTab.click();
                          }, 0);
                        }}
                        isLoading={isSubmitting}
                      />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 h-full flex flex-col">
                    <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="My Proxy" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="protocol"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Protocol</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a protocol" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="http">HTTP</SelectItem>
                                <SelectItem value="https">HTTPS</SelectItem>
                                <SelectItem value="socks4">SOCKS4</SelectItem>
                                <SelectItem value="socks5">SOCKS5</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Host</FormLabel>
                            <FormControl>
                              <Input placeholder="proxy.example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input placeholder="8080" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password (Optional)</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="US" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Proxy Type & Provider (read-only) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Proxy Type</Label>
                          <div className="h-10 flex items-center">
                            {form.watch('type') ? (
                              <Badge variant="outline" className={getProxyTypeColor(form.watch('type') as any)}>
                                {getProxyTypeLabel(form.watch('type') as any)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Auto-detected</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Provider</Label>
                          <div className="h-10 flex items-center">
                            {form.watch('provider') ? (
                              <Badge variant="outline">
                                {form.watch('provider')}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Auto-detected</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Validation Button & Results */}
                      <div className="border rounded-md p-4">
                        <div className="flex justify-between items-center mb-4">
                          <Label className="text-sm font-medium">Proxy Validation</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!form.watch('host') || !form.watch('port') || isValidating}
                            onClick={async () => {
                              // Check if proxy validation API is available before proceeding
                              if (typeof window === 'undefined' || !window.api || !window.api.proxies || !window.api.proxies.validate) {
                                toast({
                                  title: "Validation Service Unavailable",
                                  description: "Proxy validation service is not available. Please ensure the application is properly initialized.",
                                  variant: "destructive",
                                });
                                return;
                              }

                              setIsValidating(true);
                              setValidationResult(null);
                              try {
                                const host = form.getValues('host');
                                const port = parseInt(form.getValues('port'));
                                const protocol = form.getValues('protocol');
                                const username = form.getValues('username');
                                const password = form.getValues('password');

                                // Format the server string for validation
                                const serverString = formatProxyServer(host, port.toString());
                                console.log('Validating proxy with formatted server string:', serverString);

                                const result = await validateProxy(
                                  host,
                                  port,
                                  protocol,
                                  username,
                                  password
                                );

                                setValidationResult(result);

                                if (result.isValid) {
                                  toast({
                                    title: 'Proxy Valid',
                                    description: `Proxy is working correctly. Response time: ${result.responseTime}ms`,
                                  });
                                } else {
                                  toast({
                                    title: 'Proxy Invalid',
                                    description: result.error || 'Proxy validation failed',
                                    variant: 'destructive',
                                  });
                                }
                              } catch (error) {
                                setValidationResult({
                                  isValid: false,
                                  error: error instanceof Error ? error.message : 'Unknown error',
                                });
                                toast({
                                  title: 'Validation Error',
                                  description: 'Failed to validate proxy',
                                  variant: 'destructive',
                                });
                              } finally {
                                setIsValidating(false);
                              }
                            }}
                          >
                            {isValidating ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Validating...
                              </>
                            ) : (
                              'Test Proxy'
                            )}
                          </Button>
                        </div>

                        {validationResult && (
                          <div className="text-sm">
                            {validationResult.isValid ? (
                              <div className="flex items-center text-green-600 dark:text-green-400">
                                <Check className="mr-2 h-4 w-4" />
                                <div>
                                  <p>Proxy is working correctly</p>
                                  <p className="text-xs text-muted-foreground">
                                    Response time: {validationResult.responseTime}ms
                                    {validationResult.ipDetected && ` • IP: ${validationResult.ipDetected}`}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center text-red-600 dark:text-red-400">
                                <AlertCircle className="mr-2 h-4 w-4" />
                                <div>
                                  <p>Proxy validation failed</p>
                                  <p className="text-xs text-muted-foreground">
                                    {validationResult.error || 'Unknown error'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <SheetFooter>
                      <SheetClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </SheetClose>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isUpdate ? 'Updating...' : 'Creating...'}
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                    </SheetFooter>
                  </form>
                </Form>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}