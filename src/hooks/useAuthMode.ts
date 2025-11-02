import { useState, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';

/**
 * Hook to determine if user is authenticated (cloud) or guest (local-only)
 * 
 * @returns Authentication state and feature flags
 */
export function useAuthMode() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        setIsAuthenticated(!!user);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, []);

  return {
    /** True if user is signed in with Amplify (has cloud account) */
    isAuthenticated,
    
    /** True if user is in guest/local-only mode */
    isGuest: !isAuthenticated,
    
    /** True if user can share events (requires cloud) */
    canShare: isAuthenticated,
    
    /** True if user can join events by code (requires cloud) */
    canJoinEvents: isAuthenticated,
    
    /** True if user's data syncs to cloud */
    canSync: isAuthenticated,
    
    /** True if user can use real-time chat (requires cloud) */
    canChat: isAuthenticated,
    
    /** True if still checking authentication status */
    isChecking,
  };
}
