import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useSettings } from '../../context/settings-context'
import { licenseApi, paymentApi, useLicense, useResourceQuota, SubscriptionTier } from '@/lib/ipc/licenseApi'
import { useAuthStore } from '@/lib/auth/store'
import SubscriptionManager from '@/components/SubscriptionManager'
import { profilePaymentService } from '@/lib/payments'

const billingFormSchema = z.object({
  paymentMethod: z.string().min(1, 'Please select a payment method'),
  cardNumber: z.string().min(14, 'Please enter a valid card number'),
  expiryDate: z.string().min(5, 'Please enter a valid expiry date'),
  cvv: z.string().min(3, 'Please enter a valid CVV'),
})

type BillingFormValues = z.infer<typeof billingFormSchema>

export const BillingForm = () => {
  const { toast } = useToast()
  const { settings, updateAccount, isLoading } = useSettings()
  const { subscription, loading: subscriptionLoading } = useLicense()
  const { quota: profileQuota } = useResourceQuota('profiles')
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedTier, setSelectedTier] = useState(subscription?.tier || 'free')

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      paymentMethod: 'card',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
    },
    mode: 'onChange',
  })

  const [tiers, setTiers] = useState<Record<string, SubscriptionTier>>({});
  const [tiersLoading, setTiersLoading] = useState(true);

  // Fetch available subscription tiers
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const fetchedTiers = await licenseApi.getTiers();
        setTiers(fetchedTiers);
      } catch (error) {
        console.error('Failed to fetch subscription tiers:', error);
        // Set some default tiers as fallback
        setTiers({
          free: {
            name: 'Free',
            price: 0,
            maxProfiles: 5,
            maxCampaigns: 2,
            maxProxies: 3,
            maxConcurrentSessions: 1,
            features: ['Basic features', 'Limited support'],
            limitations: ['Profile limit', 'Campaign limit']
          },
          pro: {
            name: 'Pro',
            price: 19,
            maxProfiles: 50,
            maxCampaigns: 10,
            maxProxies: 20,
            maxConcurrentSessions: 5,
            features: ['Advanced features', 'Priority support', 'Increased quotas'],
            limitations: []
          },
          enterprise: {
            name: 'Enterprise',
            price: 49,
            maxProfiles: 200,
            maxCampaigns: 50,
            maxProxies: 100,
            maxConcurrentSessions: 20,
            features: ['All features', '24/7 support', 'Unlimited access', 'Custom quotas'],
            limitations: []
          }
        });
      } finally {
        setTiersLoading(false);
      }
    };

    fetchTiers();
  }, []);

  async function onSubmit(data: BillingFormValues) {
    try {
      setIsProcessing(true)
      // In a real implementation, you would process the payment method update
      toast({
        title: 'Payment Method Updated',
        description: 'Your payment method has been updated successfully.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Update Payment Method',
        description: 'There was an error updating your payment method.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUpgrade = async () => {
    if (!selectedTier || selectedTier === subscription?.tier) return;

    try {
      setIsProcessing(true);
      
      // Get user ID from auth context
      const user = useAuthStore.getState().auth.user;
      const userId = user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated. Please sign in to upgrade your subscription.');
      }
      
      await licenseApi.upgradeSubscription(selectedTier);
      toast({
        title: 'Subscription Updated',
        description: 'Your subscription has been upgraded successfully.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Upgrade Subscription',
        description: error instanceof Error ? error.message : 'There was an error upgrading your subscription.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePurchaseProfiles = async (quantity: number) => {
    try {
      setIsProcessing(true);
      // Calculate the price for the quantity
      const priceInfo = profilePaymentService.getPriceForQuantity(quantity);
      const totalPrice = priceInfo.price;
      
      // Get user ID from auth context
      const user = useAuthStore.getState().auth.user;
      const userId = user?.id;
      const userEmail = settings.account.email || user?.email;
      
      if (!userId) {
        throw new Error('User not authenticated. Please sign in to purchase profiles.');
      }
      
      // Use the payment API to create a checkout session
      let result;
      try {
        result = await paymentApi.createCheckoutSession({
          quantity,
          price: totalPrice,
          userId,
          userEmail: userEmail || "",
          productName: `${quantity} Profiles`,
          productDescription: `Purchase ${quantity} additional profiles for your automation needs`,
        });
      } catch (error) {
        throw new Error('Failed to create payment session. Please try again.');
      }
      
      // Extract session ID from response
      const { sessionId, checkoutUrl } = result;
      
      if (!sessionId) {
        throw new Error('No session ID returned from server');
      }
      
      if (!sessionId) {
        throw new Error('No session ID returned from server');
      }
      
      // Redirect to the checkout session using window.location to handle the redirect properly
      // This ensures we go to the external Stripe checkout page
      const stripeSuccessUrl = checkoutUrl || `http://localhost:5173/payment/success?session_id=${sessionId}`;
      
      // Instead of using Stripe JS redirectToCheckout, we'll redirect the window directly
      // since this is a checkout redirect to an external site
      window.location.href = stripeSuccessUrl;
    } catch (error) {
      console.error('Purchase profiles failed:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Purchase Profiles',
        description: error instanceof Error ? error.message : 'There was an error processing your purchase. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Check if subscription is near limit
  const isNearLimit = profileQuota && profileQuota.usagePercentage && profileQuota.usagePercentage > 80;
  const isAtLimit = profileQuota && profileQuota.currentCount >= (subscription?.tierInfo?.maxProfiles || 0) && (subscription?.tierInfo?.maxProfiles || 0) > 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Subscription Management Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Subscription Management</h3>
              <p className="text-sm text-muted-foreground">
                Manage your current subscription and upgrade when needed.
              </p>
            </div>
            {subscription && subscription.status === 'active' && (
              <div className="flex items-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isAtLimit ? 'bg-red-100 text-red-800' : 
                  isNearLimit ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-green-100 text-green-800'
                }`}>
                  {isAtLimit ? 'At Limit' : isNearLimit ? 'Near Limit' : 'Sufficient Quota'}
                </span>
              </div>
            )}
          </div>

          {subscriptionLoading ? (
            <div className="text-center py-6">Loading subscription information...</div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{subscription ? `${subscription.tierInfo.name} Plan` : 'No Subscription'}</CardTitle>
                <CardDescription>
                  {subscription 
                    ? `$${subscription.tierInfo.price}/month with ${subscription.tierInfo.maxProfiles} profiles`
                    : 'Upgrade to get more profiles and features'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          disabled={isProcessing}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="card">Credit/Debit Card</SelectItem>
                            <SelectItem value="paypal">PayPal</SelectItem>
                            <SelectItem value="crypto">Cryptocurrency</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {form.getValues('paymentMethod') === 'card' && (
                    <>
                      <FormField
                        control={form.control}
                        name="cardNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Card Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="1234 5678 9012 3456" 
                                {...field}
                                disabled={isProcessing}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="MM/YY" 
                                {...field}
                                disabled={isProcessing}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="cvv"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CVV</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123" 
                                {...field}
                                disabled={isProcessing}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                {/* Subscription Tier Selector */}
                <div className="mt-6">
                  <h4 className="text-md font-medium mb-2">Upgrade Plan</h4>
                  {tiersLoading ? (
                    <div className="text-center py-4">Loading subscription options...</div>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(tiers).map(([tierName, tier]) => (
                        <div key={tierName} className={`border rounded-lg p-4 flex-1 min-w-[200px] ${
                          selectedTier === tierName ? 'border-primary bg-primary/10' : 'border-border'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium">{tier.name}</h5>
                              <p className="text-2xl font-bold">${tier.price}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                            </div>
                            <input
                              type="radio"
                              name="tier"
                              value={tierName}
                              checked={selectedTier === tierName}
                              onChange={() => setSelectedTier(tierName)}
                              className="mt-2"
                              disabled={isProcessing}
                            />
                          </div>
                          <ul className="mt-2 space-y-1 text-sm">
                            <li>Profiles: {tier.maxProfiles === Infinity ? 'Unlimited' : tier.maxProfiles}</li>
                            <li>Campaigns: {tier.maxCampaigns}</li>
                            <li>Proxies: {tier.maxProxies}</li>
                            <li>Features: {tier.features.length}</li>
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button 
                    type="button" 
                    className="mt-4"
                    onClick={handleUpgrade}
                    disabled={isProcessing || selectedTier === subscription?.tier}
                  >
                    {isProcessing ? 'Processing...' : 'Upgrade Plan'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Profile Packages Section */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Purchase Additional Profiles</h3>
            <p className="text-sm text-muted-foreground">
              Buy additional profiles when your subscription limit is reached.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Packages</CardTitle>
              <CardDescription>
                Purchase additional profiles to extend your quota beyond your subscription limit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {profilePaymentService.getPackages().map((pkg, index) => (
                  <Card 
                    key={index} 
                    className={`hover:border-primary/50 transition-colors ${
                      index === 1 ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                  >
                    <CardHeader>
                      <CardTitle className="text-2xl">
                        ${pkg.price}
                        <span className="text-sm font-normal text-muted-foreground">/one-time</span>
                      </CardTitle>
                      <CardDescription>
                        {pkg.quantity} additional profiles
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center">
                          <span className="mr-2">✓</span> 
                          Add {pkg.quantity} profiles to your quota
                        </li>
                        <li className="flex items-center">
                          <span className="mr-2">✓</span> 
                          No subscription required
                        </li>
                        <li className="flex items-center">
                          <span className="mr-2">✓</span> 
                          Instant access after payment
                        </li>
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        className="w-full"
                        onClick={() => handlePurchaseProfiles(pkg.quantity)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? 'Processing...' : 'Buy Now'}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Subscription Details */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Current Quotas</h3>
            <p className="text-sm text-muted-foreground">
              Track your current usage against your subscription limits.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Subscription & Quota Status</CardTitle>
            </CardHeader>
            <CardContent>
              <SubscriptionManager />
            </CardContent>
          </Card>
        </div>

        <Button type="submit" disabled={isLoading || isProcessing}>
          {isLoading || isProcessing ? 'Saving...' : 'Update Payment Method'}
        </Button>
      </form>
    </Form>
  )
}