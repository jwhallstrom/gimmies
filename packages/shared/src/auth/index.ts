/**
 * Shared Auth Utilities
 * Amplify authentication setup shared across apps
 */

import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';

// Track initialization
let isConfigured = false;

/**
 * Configure Amplify with outputs
 * Call this once at app startup
 */
export function configureAmplify(amplifyOutputs: any): void {
  if (isConfigured) return;
  
  try {
    Amplify.configure(amplifyOutputs);
    isConfigured = true;
    console.log('✅ Amplify configured');
  } catch (error) {
    console.error('❌ Failed to configure Amplify:', error);
    throw error;
  }
}

/**
 * Get current authenticated user
 */
export async function getAuthenticatedUser() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get current auth session with tokens
 */
export async function getAuthSession() {
  try {
    const session = await fetchAuthSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  return user !== null;
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Get user ID from current session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?.userId || null;
}
