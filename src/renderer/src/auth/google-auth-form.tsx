import { Button } from '@/components/ui/button';
import { Chrome } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';

export function GoogleAuthForm() {
  const signInWithGoogle = useAuthStore((state) => state.auth.signInWithGoogle);
  const isLoading = useAuthStore((state) => state.auth.isLoading);
  const error = useAuthStore((state) => state.auth.error);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google sign in error:', err);
    }
  };

  return (
    <div className="grid gap-4">
      {error && (
        <div className="text-sm text-destructive text-center">
          {error}
        </div>
      )}
      <Button
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <span>Signing in...</span>
        ) : (
          <>
            <Chrome className="mr-2 h-4 w-4" />
            Sign in with Google
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        You will be redirected to Google to sign in securely
      </p>
    </div>
  );
}