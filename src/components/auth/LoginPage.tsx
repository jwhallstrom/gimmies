import React, { useState, useEffect } from 'react';
import { signIn, signUp, confirmSignUp, resetPassword, confirmResetPassword, signOut } from 'aws-amplify/auth';
import { mapAuthError, PASSWORD_HINT } from '../../utils/authErrors';
import { signInWithOAuth } from '../../utils/oauthSignIn';
import { GoogleSignInButton, OAuthEmailDivider } from './GoogleSignInButton';

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
  hideGuestMode?: boolean;
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'confirm' | 'reset';

export function LoginPage({ onSuccess, onGuestMode, hideGuestMode }: LoginPageProps) {
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

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithOAuth('Google');
    } catch (err: unknown) {
      setError(mapAuthError(err) || 'Failed to sign in with Google');
      setLoading(false);
    }
  };

  const showGoogleSignIn = amplifyConfigured === true;

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
      const mapped = mapAuthError(err);
      if (err.name === 'UserNotConfirmedException') {
        setMode('confirm');
        setError('Please confirm your email address');
      } else if (err.name === 'UserAlreadyAuthenticatedException' || err.message?.includes('already a signed in user')) {
        setMessage('✅ Already signed in!');
        setTimeout(() => onSuccess?.(), 500);
      } else {
        setError(mapped || err.message || 'Failed to sign in. Try Guest Mode if cloud auth is not set up.');
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

      // Pre-sign-up Lambda auto-confirms — sign in immediately, no verification step
      setMessage('✅ Account created! Signing you in...');
      try { await signOut(); } catch {}
      const result = await signIn({ username: email, password });
      if (result.isSignedIn) {
        setTimeout(() => onSuccess?.(), 500);
      } else {
        setMessage('Account created. Please sign in.');
        setMode('signin');
      }
    } catch (err: any) {
      if (err?.name === 'UserAlreadyAuthenticatedException' || err?.message?.includes('already a signed in user')) {
        setTimeout(() => onSuccess?.(), 500);
      } else {
        setError(mapAuthError(err) || err.message || 'Failed to sign up. Try Guest Mode if cloud auth is not set up.');
      }
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 bg-[url('/File_000.jpeg')] bg-cover bg-center bg-no-repeat relative p-4 pt-safe pb-safe pb-safe-base-0 pl-safe pr-safe">
      {/* Very light overlay for better text readability */}
      <div className="absolute inset-0 bg-black/10"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/gimmies-logo.png" 
              alt="Gimmies Golf" 
              className="h-24 w-auto filter brightness-0"
            />
          </div>
          <p className="text-white text-lg font-semibold drop-shadow-[2px_2px_4px_rgba(0,0,0,0.8)]">Golf Scoring & Gambling</p>
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

              {showGoogleSignIn && (
                <>
                  <GoogleSignInButton onClick={handleGoogleSignIn} disabled={loading} />
                  <OAuthEmailDivider label="or sign in with email" />
                </>
              )}

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

              {showGoogleSignIn && (
                <>
                  <GoogleSignInButton
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    label="Sign up with Google"
                  />
                  <OAuthEmailDivider label="or sign up with email" />
                </>
              )}

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
                    {PASSWORD_HINT}
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

        {/* Guest Mode - hidden when user arrived from an invite link */}
        {!hideGuestMode && (
        <div className="mt-6 text-center relative z-10">
          <button
            onClick={() => onGuestMode?.()}
            className="w-full max-w-xs mx-auto text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 flex items-center justify-center gap-2 px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            <span>🚀</span>
            <span>Explore (Guest Mode)</span>
          </button>
          <p className="text-xs text-gray-600 mt-2 bg-white/60 backdrop-blur-sm px-3 py-1 rounded inline-block">
            No account needed • Sign in required to create/join games
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
