import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

/**
 * Main backend configuration for Gimmies Golf
 * Defines all AWS resources (Cognito, AppSync, DynamoDB, etc.)
 */
export const backend = defineBackend({
  auth,
  data,
});
