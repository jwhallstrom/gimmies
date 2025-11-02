import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';

// Check if cloud mode is enabled
const CLOUD_MODE_ENABLED = import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true';

const LoginPage: React.FC = () => {
  const { users, currentUser, switchUser, createUser } = useStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'cloud' | 'guest'>('cloud');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSocialSignIn = async (provider: 'Google' | 'Facebook' | 'Apple') => {
    if (!CLOUD_MODE_ENABLED) {
      setError('Cloud sync not enabled. Set VITE_ENABLE_CLOUD_SYNC=true in .env.local and configure AWS Amplify.');
      return;
    }
    
    try {
      setLoading(true);
      // Dynamically import Amplify auth only when needed
      const { signInWithRedirect } = await import('aws-amplify/auth');
      await signInWithRedirect({ provider });
    } catch (err: any) {
      console.error('Social sign-in error:', err);
      setError(err.message || `Failed to sign in with ${provider}. Make sure AWS Amplify is configured.`);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!CLOUD_MODE_ENABLED) {
      setError('Cloud sync not enabled. Set VITE_ENABLE_CLOUD_SYNC=true in .env.local');
      setLoading(false);
      return;
    }

    try {
      const { signIn, signUp } = await import('aws-amplify/auth');
      
      if (isLogin) {
        // Sign in with email/password
        const { isSignedIn } = await signIn({
          username: email,
          password,
        });

        if (isSignedIn) {
          navigate('/');
        }
      } else {
        // Sign up with email/password
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
        setShowConfirmation(true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { confirmSignUp, signIn } = await import('aws-amplify/auth');
      
      await confirmSignUp({
        username: email,
        confirmationCode,
      });

      setMessage('✅ Email confirmed! Signing you in...');
      
      // Auto sign-in after confirmation
      const result = await signIn({ username: email, password });
      
      if (result.isSignedIn) {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm code');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const existingUser = users.find(u => 
      u.username.toLowerCase() === name.toLowerCase() || 
      u.displayName.toLowerCase() === name.toLowerCase()
    );
    
    if (existingUser) {
      // Login as existing guest user
      switchUser(existingUser.id);
      navigate('/');
    } else {
      // Create new guest user
      const cleanName = name.trim();
      createUser(cleanName, cleanName);
      navigate('/');
    }
  };

  // If user is already logged in, don't show login page
  if (currentUser) {
    return null;
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 relative"
      style={{
        backgroundImage: 'url(/File_000.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Very light overlay for better text readability */}
      <div className="absolute inset-0 bg-black/10"></div>
      
      <div className="bg-white/75 backdrop-blur-sm rounded-xl shadow-2xl p-8 w-full max-w-md mx-4 relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src="/gimmies-logo.png" 
              alt="Gimmies Golf" 
              className="h-24 w-auto"
              style={{ filter: 'brightness(0)' }}
            />
          </div>
          <p className="text-gray-600 text-lg">Golf Scoring & Gambling</p>
        </div>

        {/* Mode Toggle: Cloud vs Guest */}
        <div className="flex gap-2 bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setMode('cloud')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'cloud' ? 'bg-green-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Full Account
          </button>
          <button
            onClick={() => setMode('guest')}
            className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${
              mode === 'guest' ? 'bg-gray-600 text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👤 Guest
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {message}
          </div>
        )}

        {/* Cloud Mode */}
        {mode === 'cloud' && (
          <>
            {/* Show Confirmation Screen if needed */}
            {showConfirmation ? (
              <>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Confirm Email</h2>
                <p className="text-sm text-gray-600 mb-2">
                  We sent a confirmation code to <strong>{email}</strong>
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  💡 Check your <strong>spam/junk folder</strong> if you don't see it in your inbox
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest"
                      placeholder="123456"
                      maxLength={6}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-2.5 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? 'Confirming...' : 'Confirm Email'}
                  </button>
                </form>

                <div className="mt-4 text-center text-sm text-gray-600">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="text-green-600 hover:text-green-700"
                  >
                    ← Back to sign up
                  </button>
                </div>
              </>
            ) : (
              <>
            {/* Login/Signup Toggle */}
            <div className="flex gap-1 bg-gray-50 rounded-lg p-1 mb-4">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isLogin ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !isLogin ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Social Sign-In Options */}
            {CLOUD_MODE_ENABLED && (
              <div className="space-y-3 mb-4">
                <button
                  type="button"
                  onClick={() => handleSocialSignIn('Google')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-gray-700">Continue with Google</span>
                </button>
              </div>
            )}

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white/75 text-gray-500">or use email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="you@example.com"
                  required
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                {!isLogin && (
                  <p className="mt-1 text-xs text-gray-500">
                    At least 8 characters with uppercase, lowercase, and number
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-2.5 px-4 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? (isLogin ? 'Signing In...' : 'Creating Account...') : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            {isLogin && (
              <div className="mt-4 text-center">
                <button className="text-sm text-green-600 hover:text-green-700">
                  Forgot password?
                </button>
              </div>
            )}
              </>
            )}
          </>
        )}

        {/* Guest Mode */}
        {mode === 'guest' && (
          <>
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              <p className="font-medium text-gray-700 mb-1">🏌️ Guest Mode (Local Only)</p>
              <p>Play locally on this device. Limited functionality - no cloud sync or multiplayer features.</p>
            </div>

            <form onSubmit={handleGuestMode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  placeholder="Enter your name"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gray-600 text-white py-2.5 px-4 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors font-medium"
              >
                Continue as Guest
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
