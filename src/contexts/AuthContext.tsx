import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import useStore from '../state/store';

interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  name?: string; // Full name from OAuth
  givenName?: string; // First name from OAuth
  familyName?: string; // Last name from OAuth
  picture?: string; // Profile photo from OAuth
  attributes?: Record<string, any>;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  needsProfileCompletion: boolean;
  signOut: () => Promise<void>;
  refetchUser: () => Promise<void>;
  completeProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const { profiles, currentUser: storeUser } = useStore();

  const fetchUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      // Extract user attributes (from OAuth providers)
      const userAttributes = (currentUser as any).signInUserSession?.idToken?.payload || {};
      
      const authUser: AuthUser = {
        userId: currentUser.userId,
        username: currentUser.username,
        email: userAttributes.email || (currentUser as any).signInDetails?.loginId,
        name: userAttributes.name, // Full name from OAuth
        givenName: userAttributes.given_name, // First name from OAuth
        familyName: userAttributes.family_name, // Last name from OAuth
        picture: userAttributes.picture, // Profile photo URL from OAuth
        attributes: currentUser.signInDetails,
      };
      
      setUser(authUser);

      // Check if profile exists for this user
      const hasProfile = profiles.some(p => p.userId === currentUser.userId);
      setNeedsProfileCompletion(!hasProfile);
      
    } catch (error) {
      setUser(null);
      setNeedsProfileCompletion(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();

    // Listen for auth events (sign in, sign out, etc.)
    const hubListenerCancelToken = Hub.listen('auth', async ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          await fetchUser();
          break;
        case 'signedOut':
          setUser(null);
          setNeedsProfileCompletion(false);
          break;
        case 'tokenRefresh':
          await fetchUser();
          break;
      }
    });

    return () => hubListenerCancelToken();
  }, [profiles]); // Re-check when profiles change

  const signOut = async () => {
    try {
      await amplifySignOut();
      setUser(null);
      setNeedsProfileCompletion(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const completeProfile = () => {
    setNeedsProfileCompletion(false);
  };

  const value = {
    user,
    loading,
    needsProfileCompletion,
    signOut,
    refetchUser: fetchUser,
    completeProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
