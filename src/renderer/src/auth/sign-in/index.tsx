import { Card } from '@/components/ui/card';
import { Link } from '@tanstack/react-router';
import AuthLayout from '../auth-layout';
import { GoogleAuthForm } from '../google-auth-form';

export default function SignIn() {
  return (
    <AuthLayout>
      <Card className='p-6'>
        <div className='flex flex-col space-y-2 text-left'>
          <h1 className='text-2xl font-semibold tracking-tight'>Welcome</h1>
          <p className='text-sm text-muted-foreground'>
            Sign in with your Google account to continue
          </p>
        </div>
        <GoogleAuthForm />
        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Link 
            to="/sign-up" 
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </div>
        <p className='mt-4 px-8 text-center text-sm text-muted-foreground'>
          By signing in, you agree to our{' '}
          <a
            href='/terms'
            className='underline underline-offset-4 hover:text-primary'
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href='/privacy'
            className='underline underline-offset-4 hover:text-primary'
          >
            Privacy Policy
          </a>
          .
        </p>
      </Card>
    </AuthLayout>
  );
}