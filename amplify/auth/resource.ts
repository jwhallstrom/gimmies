import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Multi-provider authentication configuration for Gimmies Golf
 * Supports: Email/Password, Google OAuth (when configured)
 */
export const auth = defineAuth({
  loginWith: {
    // Email/Password authentication
    email: true,
    
    // Google OAuth configuration - disabled temporarily (secret corruption issue)
    // externalProviders: {
    //   google: {
    //     clientId: secret('GOOGLE_CLIENT_ID'),
    //     clientSecret: secret('GOOGLE_CLIENT_SECRET'),
    //     scopes: ['email', 'profile', 'openid'],
    //   },
    //   callbackUrls: [
    //     'http://localhost:5173/',
    //     'https://gimmies-golf.s3-website-us-east-1.amazonaws.com/',
    //   ],
    //   logoutUrls: [
    //     'http://localhost:5173/',
    //     'https://gimmies-golf.s3-website-us-east-1.amazonaws.com/',
    //   ],
    // },
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
