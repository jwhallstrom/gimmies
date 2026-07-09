import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  signUp,
  signIn,
  signOut,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';

interface GuestJoinPageProps {
  onSignIn?: () => void;
  onSuccess: () => void;
  eventId?: string;
  shareCode?: string;
}

type InviteMode = 'signup' | 'signin' | 'forgot' | 'reset';

const PASSWORD_HINT = 'At least 8 characters with uppercase, lowercase, and a number.';

function mapAuthError(err: any): string {
  const name = err?.name || '';
  const msg = err?.message || '';

  if (name === 'UsernameExistsException' || msg.includes('already exists')) {
    return 'That email is already registered. Sign in or reset your password below.';
  }
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
    return 'Incorrect email or password. Try again or reset your password.';
  }
  if (name === 'InvalidPasswordException' || msg.includes('Password')) {
    return `${msg || 'Password does not meet requirements.'} ${PASSWORD_HINT}`;
  }
  if (name === 'UserNotConfirmedException') {
    return 'Your account needs confirmation. Check your email for a code, or try signing in.';
  }
  return msg || 'Something went wrong. Please try again.';
}

/**
 * Unified invite landing: sign up, sign in, or reset password — then join the event.
 */
const GuestJoinPage: React.FC<GuestJoinPageProps> = ({
  onSignIn,
  onSuccess,
  eventId: propEventId,
  shareCode: propShareCode,
}) => {
  const { id: paramId, code: paramCode } = useParams();

  const targetEventId = propEventId || paramId;
  const targetShareCode = propShareCode || paramCode;

  const [mode, setMode] = useState<InviteMode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const stashPendingTargets = () => {
    if (targetShareCode) {
      try { sessionStorage.setItem('gimmies.pendingJoinCode.v1', targetShareCode); } catch {}
    }
    if (targetEventId) {
      try { sessionStorage.setItem('gimmies.pendingEventId.v1', targetEventId); } catch {}
    }
  };

  const finishAuth = async (trimmedEmail: string, trimmedPassword: string, trimmedName?: string) => {
    if (trimmedName) {
      try { sessionStorage.setItem('gimmies.pendingProfileName.v1', trimmedName); } catch {}
    }
    stashPendingTargets();

    try { await signOut(); } catch {}

    const result = await signIn({ username: trimmedEmail, password: trimmedPassword });
    if (result.isSignedIn) {
      onSuccess();
      return;
    }
    setError('Signed in but session did not start. Please try again.');
    setBusy(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || trimmedName.length < 2) {
      setError('Enter your name (at least 2 characters).');
      return;
    }
    if (!trimmedEmail) {
      setError('Enter your email.');
      return;
    }
    if (password.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }

    setBusy(true);

    try {
      await signUp({
        username: trimmedEmail,
        password,
        options: { userAttributes: { email: trimmedEmail } },
      });
      setMessage('Account created! Signing you in...');
      await finishAuth(trimmedEmail, password, trimmedName);
    } catch (err: any) {
      if (err?.name === 'UsernameExistsException' || err?.message?.includes('already exists')) {
        try {
          await finishAuth(trimmedEmail, password, trimmedName);
          return;
        } catch (signInErr: any) {
          if (signInErr?.name === 'UserAlreadyAuthenticatedException') {
            onSuccess();
            return;
          }
          setError(mapAuthError(signInErr));
          setMode('signin');
        }
      } else {
        setError(mapAuthError(err));
      }
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Enter your email.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    stashPendingTargets();

    try {
      try { await signOut(); } catch {}
      const result = await signIn({ username: trimmedEmail, password });
      if (result.isSignedIn) {
        onSuccess();
        return;
      }
      setError('Sign in did not complete. Please try again.');
    } catch (err: any) {
      if (err?.name === 'UserAlreadyAuthenticatedException') {
        onSuccess();
        return;
      }
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Enter your email.');
      return;
    }

    setBusy(true);
    stashPendingTargets();

    try {
      await resetPassword({ username: trimmedEmail });
      setMessage('Check your email for a reset code.');
      setMode('reset');
    } catch (err: any) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !resetCode || !password) {
      setError('Enter your email, reset code, and new password.');
      return;
    }

    setBusy(true);
    stashPendingTargets();

    try {
      await confirmResetPassword({
        username: trimmedEmail,
        confirmationCode: resetCode,
        newPassword: password,
      });
      setMessage('Password updated! Signing you in...');
      await finishAuth(trimmedEmail, password);
    } catch (err: any) {
      setError(mapAuthError(err));
      setBusy(false);
    }
  };

  const switchMode = (next: InviteMode) => {
    setMode(next);
    setError('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex flex-col">
      <div className="flex-shrink-0 pt-safe-top" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-5">
            <img src="/gimmies-logo.png" alt="Gimmies" className="h-9 mx-auto opacity-90" />
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-5 mb-5 text-center">
            <div className="text-3xl mb-2">⛳</div>
            <h1 className="text-xl font-black text-white mb-1">You&apos;ve Been Invited!</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              {mode === 'signup' && 'Create an account to join the game — no email verification needed.'}
              {mode === 'signin' && 'Sign in to join the game.'}
              {mode === 'forgot' && 'We\'ll email you a code to reset your password.'}
              {mode === 'reset' && 'Enter the code from your email and choose a new password.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-5">
            {mode !== 'forgot' && mode !== 'reset' && (
              <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  New account
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  Sign in
                </button>
              </div>
            )}

            {message && (
              <p className="text-sm text-green-600 font-medium text-center mb-3">{message}</p>
            )}
            {error && (
              <p className="text-sm text-red-500 font-medium text-center mb-3">{error}</p>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    placeholder="How you'll appear on the leaderboard"
                    autoFocus
                    maxLength={30}
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="Create a password"
                    minLength={8}
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">{PASSWORD_HINT}</p>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-gradient-to-r from-accent to-orange-500 text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 transition-all"
                >
                  {busy ? 'Setting you up...' : "Let's Play →"}
                </button>
              </form>
            )}

            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="your@email.com"
                    autoFocus
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="Your password"
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Forgot password?
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-gradient-to-r from-accent to-orange-500 text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 transition-all"
                >
                  {busy ? 'Signing in...' : 'Sign In & Join →'}
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="your@email.com"
                    autoFocus
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-primary-600 text-white font-bold text-base rounded-xl disabled:opacity-50"
                >
                  {busy ? 'Sending...' : 'Send Reset Code'}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back to sign in
                </button>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Reset Code
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => { setResetCode(e.target.value); setError(''); }}
                    placeholder="From your email"
                    autoFocus
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    placeholder="New password"
                    minLength={8}
                    className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">{PASSWORD_HINT}</p>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3.5 bg-primary-600 text-white font-bold text-base rounded-xl disabled:opacity-50"
                >
                  {busy ? 'Updating...' : 'Reset & Join →'}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  ← Back to sign in
                </button>
              </form>
            )}

            {error && (mode === 'signup' || mode === 'signin') && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                {mode === 'signup' && (
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-sm text-primary-600 font-semibold hover:text-primary-700"
                  >
                    Already have an account? Sign in
                  </button>
                )}
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm text-primary-600 font-semibold hover:text-primary-700"
                  >
                    Forgot your password?
                  </button>
                )}
              </div>
            )}
          </div>

          {onSignIn && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { stashPendingTargets(); onSignIn(); }}
                className="text-white/50 text-xs hover:text-white/70 underline"
              >
                Use the full login page instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestJoinPage;
