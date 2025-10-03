import { User, Session } from '@supabase/supabase-js';
import { EmailOtpType } from '@supabase/supabase-js';

/**
 * Authentication API response interface
 */
export interface AuthResponse {
  user: User | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  } | null;
  error?: string;
}

// No longer need these as we're using Google OAuth only:
// export interface SignInCredentials {
//   email: string;
//   password: string;
// }
//
// export interface SignUpCredentials {
//   email: string;
//   password: string;
//   metadata?: Record<string, any>;
// }
//
// export interface ResetPasswordRequest {
//   email: string;
// }
//
// export interface UpdatePasswordRequest {
//   password: string;
// }
//
// export interface VerifyOtpRequest {
//   email: string;
//   token: string;
//   type: EmailOtpType; // 'signup' | 'recovery' | 'email_change' | 'email'
// }

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  last_sign_in?: string;
  metadata?: Record<string, any>;
}