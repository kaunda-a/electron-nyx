import { useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { toast } from '@/hooks/use-toast';
import { profilePaymentService } from '@/lib/payments';
import { createLazyFileRoute } from '@tanstack/react-router'

function PaymentSuccess() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/(payment)/success' });
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const validatePayment = async () => {
      try {
        setIsLoading(true);
        
        // Get session ID from URL search params
        const sessionId = search.session_id;
        
        if (!sessionId) {
          throw new Error('Missing payment session ID');
        }
        
        // Validate payment with backend
        const result = await profilePaymentService.validatePaymentCompletion(sessionId);
        
        if (result.success) {
          setPaymentStatus('success');
          setMessage(result.message || 'Payment processed successfully!');
          toast({
            title: 'Payment Successful',
            description: 'Your profiles have been added to your account.',
          });
        } else {
          throw new Error(result.message || 'Payment validation failed');
        }
      } catch (error) {
        console.error('Payment validation failed:', error);
        setPaymentStatus('failed');
        setMessage(error instanceof Error ? error.message : 'Payment validation failed. Please contact support.');
        toast({
          variant: 'destructive',
          title: 'Payment Validation Failed',
          description: error instanceof Error ? error.message : 'Failed to validate your payment. Please contact support.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    validatePayment();
  }, [search.session_id]);

  const handleContinue = () => {
    navigate({ to: '/' });
  };

  return (
    <div className="container flex h-svh flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {isLoading ? 'Validating Payment' : 
             paymentStatus === 'success' ? 'Payment Successful!' : 'Payment Validation Failed'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLoading ? 'Please wait while we validate your payment...' :
             paymentStatus === 'success' ? 'Thank you for your purchase!' : 
             'We encountered an issue validating your payment.'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Icons.spinner className="h-8 w-8 animate-spin" />
              <p>Processing your payment...</p>
            </div>
          ) : paymentStatus === 'success' ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-green-100 p-3">
                <Icons.check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-medium">Payment Confirmed</p>
              <p className="text-muted-foreground">{message}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="rounded-full bg-red-100 p-3">
                <Icons.alert className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-lg font-medium">Payment Validation Failed</p>
              <p className="text-muted-foreground">{message}</p>
            </div>
          )}
        </CardContent>
        
        {!isLoading && (
          <CardFooter className="flex justify-center">
            <Button onClick={handleContinue} className="w-full">
              Continue to Dashboard
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export const Route = createLazyFileRoute('/(payment)/success')({
  component: PaymentSuccess,
})