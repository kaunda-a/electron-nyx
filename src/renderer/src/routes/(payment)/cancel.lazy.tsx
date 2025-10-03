import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { createLazyFileRoute } from '@tanstack/react-router'

function PaymentCancelled() {
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate({ to: '/' });
  };

  return (
    <div className="container flex h-svh flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Payment Cancelled</CardTitle>
          <CardDescription className="text-center">
            Your payment was cancelled. No charges were made to your account.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-yellow-100 p-3">
              <Icons.x className="h-8 w-8 text-yellow-600" />
            </div>
            <p className="text-lg font-medium">Payment Cancelled</p>
            <p className="text-muted-foreground">
              You can complete your purchase at any time by returning to the profiles section.
            </p>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-center">
          <Button onClick={handleContinue} className="w-full">
            Continue to Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export const Route = createLazyFileRoute('/(payment)/cancel')({
  component: PaymentCancelled,
})