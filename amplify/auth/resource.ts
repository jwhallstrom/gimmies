import { defineAuth } from '@aws-amplify/backend';
import { preSignUp } from './pre-sign-up/resource';

/**
 * Multi-provider authentication configuration for Gimmies Golf
 * Supports: Email/Password, Google OAuth (when configured)
 *
 * Pre-sign-up trigger auto-confirms users so they never need to
 * leave the app to verify via email. Faster onboarding, zero friction.
 */
export const auth = defineAuth({
  loginWith: {
    // Email/Password authentication
    email: true,
    
    // Google OAuth — uncomment AFTER setting Amplify secrets (deploy fails without them):
    //   npx ampx sandbox secret set GOOGLE_CLIENT_ID
    //   npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
    // Amplify Console → Hosting → Backend → Secrets (production pipeline).
    // externalProviders: {
    //   google: {
    //     clientId: secret('GOOGLE_CLIENT_ID'),
    //     clientSecret: secret('GOOGLE_CLIENT_SECRET'),
    //     scopes: ['email', 'profile', 'openid'],
    //   },
    //   callbackUrls: [
    //     'http://localhost:5173/',
    //     'https://app.golfwithgimmies.com/',
    //     'https://play.golfwithgimmies.com/',
    //   ],
    //   logoutUrls: [
    //     'http://localhost:5173/',
    //     'https://app.golfwithgimmies.com/',
    //     'https://play.golfwithgimmies.com/',
    //   ],
    // },
  },

  triggers: {
    preSignUp,
  },
  
  // User attributes stored in Cognito
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
    // Custom attributes for golf app
    'custom:handicap': {
      dataType: 'Number',
      mutable: true,
    },
    'custom:home_course': {
      dataType: 'String',
      mutable: true,
    },
  },
  
  // Account recovery settings
  accountRecovery: 'EMAIL_ONLY',
});
