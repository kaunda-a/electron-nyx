# Nyx Automation

Nyx Automation is an advanced desktop application built with Electron, React, and TypeScript for managing automated browser profiles and campaigns.

## Security Notice

**Important**: Never commit sensitive files like `.env` to version control. The `.env` file has been added to `.gitignore` to prevent accidental commits of API keys and secrets.

## Environment Variables Setup

To run this application locally, you need to create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Disable SSL certificate validation for local development
NODE_TLS_REJECT_UNAUTHORIZED=0

# Development mode
NODE_ENV=development

# Stripe Configuration (use fake values for development)
STRIPE_PUBLISHABLE_KEY=pk_test_fake_stripe_publishable_key_for_development
STRIPE_SECRET_KEY=sk_test_fake_stripe_secret_key_for_development
STRIPE_WEBHOOK_SECRET=whsec_fake_webhook_secret_for_development_testing
STRIPE_STARTER_PRICE_ID=price_fake_starter_monthly_for_testing
STRIPE_PROFESSIONAL_PRICE_ID=price_fake_professional_monthly_for_testing
STRIPE_ENTERPRISE_PRICE_ID=price_fake_enterprise_monthly_for_testing
```

## Development

1. Clone the repository
2. Create your `.env` file with the required variables
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`

## Building

To build the application for production:

```bash
npm run build
```

This will create distributable packages for your target platforms.