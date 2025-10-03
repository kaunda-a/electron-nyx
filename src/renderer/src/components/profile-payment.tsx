import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { profilePaymentService, PROFILE_PRICING } from '@/lib/payments';

interface ProfilePaymentProps {
  userId: string;
  userEmail?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ProfilePayment({ userId, userEmail, onSuccess, onCancel }: ProfilePaymentProps) {
  const [selectedPackage, setSelectedPackage] = useState<string>('custom');
  const [customQuantity, setCustomQuantity] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Calculate price based on selection
  const calculatePrice = () => {
    if (selectedPackage === 'custom') {
      return profilePaymentService.getPriceForQuantity(customQuantity);
    } else {
      const pkg = PROFILE_PRICING.packages.find(p => p.name === selectedPackage);
      return pkg ? profilePaymentService.getPriceForQuantity(pkg.quantity) : null;
    }
  };
  
  const pricingInfo = calculatePrice();
  
  const handlePurchase = async () => {
    if (!userId) {
      toast({
        variant: 'destructive',
        title: 'Authentication Required',
        description: 'Please sign in to make a purchase.',
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const quantity = selectedPackage === 'custom' 
        ? customQuantity 
        : PROFILE_PRICING.packages.find(p => p.name === selectedPackage)?.quantity || customQuantity;
      
      const result = await profilePaymentService.purchaseProfiles(
        quantity,
        userId,
        userEmail
      );
      
      if (result.success) {
        toast({
          title: 'Purchase Initiated',
          description: 'Redirecting to secure payment page...',
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: error instanceof Error ? error.message : 'Failed to process your purchase. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Purchase Profiles</CardTitle>
        <CardDescription>
          Select a package or enter a custom quantity to purchase additional profiles.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <RadioGroup 
          value={selectedPackage} 
          onValueChange={setSelectedPackage}
          className="space-y-4"
        >
          {PROFILE_PRICING.packages.map((pkg) => {
            const pkgInfo = profilePaymentService.getPriceForQuantity(pkg.quantity);
            return (
              <div key={pkg.name} className="flex items-center space-x-2">
                <RadioGroupItem value={pkg.name} id={pkg.name} />
                <Label htmlFor={pkg.name} className="flex-1 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{pkg.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {pkg.quantity} profiles - {pkg.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${pkgInfo?.price.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">
                        ${(pkgInfo?.price / pkg.quantity).toFixed(2)}/profile
                      </div>
                    </div>
                  </div>
                </Label>
              </div>
            );
          })}
          
          <Separator />
          
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="custom" />
            <Label htmlFor="custom" className="cursor-pointer">
              <div className="flex justify-between items-center w-full">
                <div>
                  <div className="font-medium">Custom Quantity</div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Label htmlFor="quantity" className="text-sm">Profiles:</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max="10000"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24"
                      disabled={selectedPackage !== 'custom'}
                    />
                  </div>
                </div>
                {selectedPackage === 'custom' && pricingInfo && (
                  <div className="text-right">
                    <div className="font-medium">${pricingInfo.price.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      ${(pricingInfo.price / customQuantity).toFixed(2)}/profile
                    </div>
                  </div>
                )}
              </div>
            </Label>
          </div>
        </RadioGroup>
        
        {pricingInfo && (
          <div className="bg-muted rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Order Summary</div>
                <div className="text-sm text-muted-foreground">
                  {selectedPackage === 'custom' 
                    ? `${customQuantity} profiles` 
                    : `${PROFILE_PRICING.packages.find(p => p.name === selectedPackage)?.quantity} profiles`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-lg">${pricingInfo.price.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">
                  ${(pricingInfo.price / (selectedPackage === 'custom' ? customQuantity : 
                    PROFILE_PRICING.packages.find(p => p.name === selectedPackage)?.quantity || 1)).toFixed(2)}/profile
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </Button>
        <Button 
          onClick={handlePurchase} 
          disabled={isProcessing || !userId}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isProcessing ? 'Processing...' : 'Proceed to Payment'}
        </Button>
      </CardFooter>
    </Card>
  );
}