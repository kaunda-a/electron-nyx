import { stripePaymentService } from './stripe';
import { toast } from '@/hooks/use-toast';

// Pricing configuration
export const PROFILE_PRICING = {
  // Base pricing tiers
  tiers: [
    { min: 1, max: 50, price: 0.80 },    // $0.80 per profile for 1-50 profiles
    { min: 51, max: 200, price: 0.70 },  // $0.70 per profile for 51-200 profiles
    { min: 201, max: 500, price: 0.60 }, // $0.60 per profile for 201-500 profiles
    { min: 501, max: 1000, price: 0.50 }, // $0.50 per profile for 501-1000 profiles
    { min: 1001, max: Infinity, price: 0.40 } // $0.40 per profile for 1001+ profiles
  ],
  
  // Special packages
  packages: [
    { name: 'Starter Pack', quantity: 50, price: 40.00, description: 'Perfect for getting started' },
    { name: 'Professional Pack', quantity: 200, price: 140.00, description: 'Great for regular use' },
    { name: 'Enterprise Pack', quantity: 500, price: 300.00, description: 'Ideal for heavy usage' }
  ]
};

// Calculate price for a given quantity
export const calculateProfilePrice = (quantity: number): number => {
  // Check if there's a package deal for this quantity
  const packageDeal = PROFILE_PRICING.packages.find(pkg => pkg.quantity === quantity);
  if (packageDeal) {
    return packageDeal.price;
  }
  
  // Calculate based on tiered pricing
  let totalPrice = 0;
  let remainingQuantity = quantity;
  
  for (const tier of PROFILE_PRICING.tiers) {
    if (remainingQuantity <= 0) break;
    
    const tierQuantity = Math.min(remainingQuantity, tier.max - tier.min + 1);
    totalPrice += tierQuantity * tier.price;
    remainingQuantity -= tierQuantity;
  }
  
  return parseFloat(totalPrice.toFixed(2));
};

// Get pricing information for display
export const getPricingInfo = (quantity: number) => {
  const price = calculateProfilePrice(quantity);
  const packageDeal = PROFILE_PRICING.packages.find(pkg => pkg.quantity === quantity);
  
  return {
    quantity,
    price,
    packageName: packageDeal?.name,
    packageDescription: packageDeal?.description,
    unitPrice: packageDeal ? price / quantity : PROFILE_PRICING.tiers.find(tier => 
      quantity >= tier.min && quantity <= tier.max
    )?.price || 0,
    savings: packageDeal ? ((PROFILE_PRICING.tiers[0].price * quantity) - price).toFixed(2) : '0.00'
  };
};

// Payment service for handling profile purchases
export const profilePaymentService = {
  /**
   * Purchase profiles using Stripe
   * @param quantity Number of profiles to purchase
   * @param userId User ID for tracking
   * @param userEmail User email for receipt
   */
  purchaseProfiles: async (
    quantity: number,
    userId: string,
    userEmail?: string
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> => {
    try {
      // Validate quantity
      if (quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      
      // Calculate price
      const price = calculateProfilePrice(quantity);
      
      // Create checkout session
      const session = await stripePaymentService.createCheckoutSession(
        quantity,
        price,
        userId,
        userEmail
      );
      
      if (!session) {
        throw new Error('Failed to create payment session');
      }
      
      // Redirect to checkout
      await stripePaymentService.redirectToCheckout(session.sessionId);
      
      return { 
        success: true, 
        sessionId: session.sessionId 
      };
    } catch (error) {
      console.error('Profile purchase failed:', error);
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: error instanceof Error ? error.message : 'Failed to process your purchase. Please try again.',
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Purchase failed' 
      };
    }
  },
  
  /**
   * Get available pricing packages
   */
  getPackages: () => {
    return PROFILE_PRICING.packages.map(pkg => ({
      ...pkg,
      info: getPricingInfo(pkg.quantity)
    }));
  },
  
  /**
   * Get tiered pricing information
   */
  getTiers: () => {
    return PROFILE_PRICING.tiers;
  },
  
  /**
   * Calculate price for custom quantity
   * @param quantity Number of profiles
   */
  getPriceForQuantity: (quantity: number) => {
    return getPricingInfo(quantity);
  },
  
  /**
   * Validate payment completion
   * @param sessionId Stripe session ID
   */
  validatePaymentCompletion: async (sessionId: string) => {
    try {
      const result = await stripePaymentService.validatePayment(sessionId);
      return result;
    } catch (error) {
      console.error('Payment validation failed:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Payment validation failed' 
      };
    }
  }
};