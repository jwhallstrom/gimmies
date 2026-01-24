import React, { useState, useEffect } from 'react';
import { signIn, signInWithRedirect, signUp, confirmSignUp, resetPassword, confirmResetPassword, signOut } from 'aws-amplify/auth';

// Check if Amplify is properly configured
const checkAmplifyConfigured = async (): Promise<boolean> => {
  try {
    const { Amplify } = await import('aws-amplify');
    const config = (Amplify as any).getConfig?.();
    return !!(config?.Auth?.Cognito?.userPoolId);
  } catch {
    return false;
  }
};

interface LoginPageProps {
  onSuccess?: () => void;
  onGuestMode?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'confirm' | 'reset';

export function LoginPage({ onSuccess, onGuestMode }: LoginPageProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [amplifyConfigured, setAmplifyConfigured] = useState<boolean | null>(null);

  // Check Amplify configuration on mount
  useEffect(() => {
    checkAmplifyConfigured().then(setAmplifyConfigured);
  }, []);

  const handleSocialSignIn = async (provider: 'Google' | 'Facebook' | 'Apple') => {
    try {
      setLoading(true);
      setError('');
      await signInWithRedirect({ provider });
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}`);
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Check if Amplify is configured first
    if (amplifyConfigured === false) {
      setError('Cloud auth is not available. Please use Guest Mode to continue.');
      setLoading(false);
      return;
    }

    try {
      const { isSignedIn } = await signIn({
        username: email,
        password,
      });

      if (isSignedIn) {
        setMessage('✅ Signed in successfully!');
        setTimeout(() => onSuccess?.(), 500);
      }
    } catch (err: any) {
      if (err.name === 'UserNotConfirmedException') {
        setMode('confirm');
        setError('Please confirm your email address');
      } else if (err.name === 'UserAlreadyAuthenticatedException' || err.message?.includes('already a signed in user')) {
        // User is already signed in, just proceed
        setMessage('✅ Already signed in!');
        setTimeout(() => onSuccess?.(), 500);
      } else {
        setError(err.message || 'Failed to sign in. Try Guest Mode if cloud auth is not set up.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Check if Amplify is configured first
    if (amplifyConfigured === false) {
      setError('Cloud auth is not available. Please use Guest Mode to continue.');
      setLoading(false);
      return;
    }

    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });

      setMessage('✅ Account created! Check your email for verification code.');
      setMode('confirm');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up. Try Guest Mode if cloud auth is not set up.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await confirmSignUp({
        username: email,
        confirmationCode,
      });

      setMessage('✅ Email confirmed! Signing you in...');
      
      // Sign out any existing session first, then sign in
      try {
        await signOut();
      } catch (signOutErr) {
        // Ignore sign out errors (user might not be signed in)
      }
      
      // Now sign in with fresh session
      const result = await signIn({ username: email, password });
      if (result.isSignedIn) {
        setTimeout(() => onSuccess?.(), 500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm code');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword({ username: email });
      setMessage('✅ Check your email for a reset code');
      setMode('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await confirmResetPassword({
        username: email,
        confirmationCode,
        newPassword: password,
      });

      setMessage('✅ Password reset successfully! Signing you in...');
      
      try {
        const result = await signIn({ username: email, password });
        if (result.isSignedIn) {
          setTimeout(() => onSuccess?.(), 500);
        }
      } catch (signInErr: any) {
        // If already signed in, just proceed
        if (signInErr.name === 'UserAlreadyAuthenticatedException' || signInErr.message?.includes('already a signed in user')) {
          setTimeout(() => onSuccess?.(), 500);
        } else {
          throw signInErr;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 relative p-4 pt-safe pb-safe pb-safe-base-0 pl-safe pr-safe"
      style={{
        backgroundImage: 'url(/File_000.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Very light overlay for better text readability */}
      <div className="absolute inset-0 bg-black/10"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/gimmies-logo.png" 
              alt="Gimmies Golf" 
              className="h-24 w-auto"
              style={{ filter: 'brightness(0)' }}
            />
          </div>
          <p className="text-white text-lg font-semibold drop-shadow-lg" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>Golf Scoring & Gambling</p>
        </div>

        {/* Main Card - Semi-transparent with backdrop blur */}
        <div className="bg-white/75 backdrop-blur-sm rounded-xl shadow-2xl p-8">
          {/* Local Mode Notice */}
          {amplifyConfigured === false && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              <strong>🏠 Local Mode:</strong> Cloud auth is not configured. Use <strong>Guest Mode</strong> below to continue, or set up AWS Amplify for cloud features.
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {message}
            </div>
          )}

          {/* Sign In Mode */}
          {mode === 'signin' && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Welcome Back!</h2>

              {/* Social Sign-In Buttons - Commented out until Google OAuth is configured */}
              {/* <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleSocialSignIn('Google')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  onClick={() => handleSocialSignIn('Apple')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </button>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or sign in with email</span>
                </div>
              </div> */}

              {/* Email Sign In Form */}
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              {/* Footer Links */}
              <div className="mt-6 text-center space-y-2">
                <button
                  onClick={() => setMode('forgot')}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  Forgot password?
                </button>
                <div className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    onClick={() => setMode('signup')}
                    className="text-green-600 font-semibold hover:text-green-700"
                  >
                    Sign up
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Sign Up Mode */}
          {mode === 'signup' && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create Account</h2>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="At least 8 characters"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 8 characters with uppercase, lowercase, and number
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={() => setMode('signin')}
                  className="text-green-600 font-semibold hover:text-green-700"
                >
                  Sign in
                </button>
              </div>
            </>
          )}

          {/* Confirmation Code Mode */}
          {mode === 'confirm' && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Confirm Email</h2>
              <p className="text-sm text-gray-600 mb-2">
                We sent a confirmation code to <strong>{email}</strong>
              </p>
              <p className="text-xs text-gray-500 mb-4">
                💡 <strong>Check your spam/junk folder</strong> if you don't see it in your inbox
              </p>

              <form onSubmit={handleConfirmSignUp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmation Code
                  </label>
                  <input
                    type="text"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl tracking-widest"
                    placeholder="123456"
                    maxLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : 'Confirm'}
                </button>
              </form>

              <div className="mt-4 text-center text-sm text-gray-600">
                <button
                  onClick={() => setMode('signin')}
                  className="text-green-600 hover:text-green-700"
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}

          {/* Forgot Password Mode */}
          {mode === 'forgot' && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Reset Password</h2>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Code'}
                </button>
              </form>

              <div className="mt-4 text-center text-sm text-gray-600">
                <button
                  onClick={() => setMode('signin')}
                  className="text-green-600 hover:text-green-700"
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}

          {/* Reset Password Mode */}
          {mode === 'reset' && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Set New Password</h2>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reset Code
                  </label>
                  <input
                    type="text"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="New password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Guest Mode - More Prominent */}
        <div className="mt-6 text-center relative z-10">
          <button
            onClick={() => onGuestMode?.()}
            className="w-full max-w-xs mx-auto text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 flex items-center justify-center gap-2 px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            <span>🚀</span>
            <span>Quick Start (Guest Mode)</span>
          </button>
          <p className="text-xs text-gray-600 mt-2 bg-white/60 backdrop-blur-sm px-3 py-1 rounded inline-block">
            No account needed • Your data stays on this device
          </p>
        </div>
      </div>
    </div>
  );
}
