/**
 * Amplify Data Client
 * Shared client generation for all apps
 */

import { generateClient } from 'aws-amplify/data';

// Cached client instance
let cachedClient: ReturnType<typeof generateClient<any>> | null = null;

/**
 * Get or create Amplify data client
 * Checks VITE_ENABLE_CLOUD_SYNC env var
 */
export function getAmplifyClient<T = any>(): ReturnType<typeof generateClient<T>> | null {
  // Check if cloud sync is enabled
  if (typeof import.meta !== 'undefined') {
    // @ts-ignore - Vite env
    if (import.meta.env?.VITE_ENABLE_CLOUD_SYNC !== 'true') {
      return null;
    }
  }
  
  if (cachedClient) {
    return cachedClient as ReturnType<typeof generateClient<T>>;
  }
  
  try {
    cachedClient = generateClient<T>();
    return cachedClient as ReturnType<typeof generateClient<T>>;
  } catch (error) {
    console.warn('❌ Amplify client unavailable (local/offline mode)', error);
    return null;
  }
}

/**
 * Clear cached client (useful for testing or logout)
 */
export function clearAmplifyClient(): void {
  cachedClient = null;
}
