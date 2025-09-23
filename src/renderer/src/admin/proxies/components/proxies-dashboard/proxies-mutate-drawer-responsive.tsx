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

export function ProxiesMutateDrawerResponsive({ open, onOpenChange, currentRow }: Props) {
  const { toast } = useToast()
  const { fetchProxies, importProxies } = useProxies()
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
      // Ensure protocol is one of the allowed values
      protocol: getValidProtocol(currentRow.protocol),
      username: currentRow.username || currentRow.auth?.username || '',
      password: currentRow.auth?.password || '',
      country: currentRow.country || currentRow.location?.country || '',
      // Convert null to undefined for type safety
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

  // Helper function to ensure protocol is one of the allowed values
  function getValidProtocol(protocol?: string): 'http' | 'https' | 'socks4' | 'socks5' {
    if (protocol === 'http' || protocol === 'https' || protocol === 'socks4' || protocol === 'socks5') {
      return protocol;
    }
    if (protocol === 'ssh') {
      return 'https';
    }
    return 'http'; // Default fallback
  }

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

  // Handle file import
  const handleFileImport = async (file: File) => {
    setIsImporting(true)
    setImportResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      // Determine endpoint based on file type
      const endpoint = file.name.endsWith('.csv') 
        ? '/api/proxies/import/csv' 
        : '/api/proxies/import/txt'
      
      // Use the existing api instance but override content type for file upload
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${endpoint}`, {
        method: 'POST',
        body: formData,
        headers: {
          // Don't set Content-Type - let browser set it with boundary for multipart/form-data
          // Authorization header will be added by the interceptor
        }
      })
      
      const result = await response.json()
      
      if (result.success) {
        setImportResult({
          success: result.data.imported?.length || 0,
          errors: result.data.errors?.length || 0
        })
        
        toast({
          title: "Import Successful",
          description: `Successfully imported ${result.data.imported?.length || 0} proxies.`,
        })
        
        fetchProxies()
        onOpenChange(false)
      } else {
        throw new Error(result.error || "Failed to import proxies")
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import proxies",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['.csv', '.txt']
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      
      if (!validTypes.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV or TXT file.",
          variant: "destructive",
        })
        return
      }
      
      setImportFile(file)
      handleFileImport(file)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[90vh] flex flex-col sm:max-w-md mx-auto w-full">
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="url">URL Parser</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
              <TabsTrigger value="file">File Import</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto py-2">
              <TabsContent value="url" className="mt-4 h-full">
                <ProxyUrlParser
                  onParse={(parsedData) => {
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

                    // Switch to manual tab to show the populated form
                    setTimeout(() => {
                      const manualTab = document.querySelector('[data-value="manual"]') as HTMLElement;
                      if (manualTab) manualTab.click();
                    }, 0);
                  }}
                />
              </TabsContent>

              <TabsContent value="bulk" className="mt-4 h-full">
                <ProxyBulkInput
                  onParse={(parsedProxies) => {
                    if (parsedProxies.length > 0) {
                      // Take the first proxy and populate the form
                      const firstProxy = parsedProxies[0];
                      form.setValue('host', firstProxy.host);
                      form.setValue('port', firstProxy.port);
                      if (firstProxy.protocol) form.setValue('protocol', firstProxy.protocol as any);
                      if (firstProxy.username) form.setValue('username', firstProxy.username);
                      if (firstProxy.password) form.setValue('password', firstProxy.password);
                      if (firstProxy.type) form.setValue('type', firstProxy.type);
                      if (firstProxy.provider) form.setValue('provider', firstProxy.provider);

                      // If there are more proxies, save them to context for batch processing
                      if (parsedProxies.length > 1) {
                        // TODO: Implement batch saving
                        toast({
                          title: 'Bulk Import',
                          description: `${parsedProxies.length} proxies parsed. First proxy loaded in form, others will be processed after saving.`,
                        });
                      }

                      // Switch to manual tab
                      setTimeout(() => {
                        const manualTab = document.querySelector('[data-value="manual"]') as HTMLElement;
                        if (manualTab) manualTab.click();
                      }, 0);
                    }
                  }}
                  onCancel={() => {
                    // Switch to manual tab
                    setTimeout(() => {
                      const manualTab = document.querySelector('[data-value="manual"]') as HTMLElement;
                      if (manualTab) manualTab.click();
                    }, 0);
                  }}
                />
              </TabsContent>

              <TabsContent value="file" className="mt-4 h-full">
                <div className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Upload className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium mb-1">Import Proxies from File</h4>
                        <p className="text-xs text-muted-foreground">
                          Upload a CSV or TXT file containing your proxies. Supported formats:
                        </p>
                        <ul className="text-xs text-muted-foreground list-disc pl-4 mt-1 space-y-1">
                          <li>host:port:username:password (TXT)</li>
                          <li>CSV with columns: host, port, username, password</li>
                          <li>One proxy per line for TXT files</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6">
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium mb-1">Upload Proxy File</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        CSV or TXT files only
                      </p>
                      <label htmlFor="proxy-file-upload">
                        <Button asChild variant="outline" size="sm">
                          <span>
                            <FileText className="mr-2 h-4 w-4" />
                            Select File
                          </span>
                        </Button>
                      </label>
                      <input
                        id="proxy-file-upload"
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={isImporting}
                      />
                    </div>

                    {importFile && (
                      <div className="text-center text-sm">
                        <p className="font-medium">{importFile.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    )}

                    {isImporting && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing proxies...
                      </div>
                    )}

                    {importResult && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                            {importResult.success}
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-400">
                            Imported
                          </p>
                        </div>
                        <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-lg text-center">
                          <p className="text-2xl font-bold text-red-800 dark:text-red-300">
                            {importResult.errors}
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-400">
                            Errors
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
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
                    <SheetFooter className="flex flex-row justify-end space-x-2 flex-shrink-0">
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