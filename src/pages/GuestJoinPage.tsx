import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { signUp, signIn } from 'aws-amplify/auth';

interface GuestJoinPageProps {
  onSignIn: () => void;
  onSuccess: () => void;
  eventId?: string;
  shareCode?: string;
}

/**
 * Streamlined sign-up for invited players.
 * Name + email + password → auto-confirmed (no email verification) → straight into the event.
 */
const GuestJoinPage: React.FC<GuestJoinPageProps> = ({ onSignIn, onSuccess, eventId: propEventId, shareCode: propShareCode }) => {
  const { id: paramId, code: paramCode } = useParams();

  const targetEventId = propEventId || paramId;
  const targetShareCode = propShareCode || paramCode;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const stashPendingTargets = () => {
    if (targetShareCode) {
      try { sessionStorage.setItem('gimmies.pendingJoinCode.v1', targetShareCode); } catch {}
    }
    if (targetEventId) {
      try { sessionStorage.setItem('gimmies.pendingEventId.v1', targetEventId); } catch {}
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      setError('Password must be at least 8 characters.');
      return;
    }

    setJoining(true);

    try {
      // Sign up — pre-sign-up Lambda auto-confirms, no email verification needed
      await signUp({
        username: trimmedEmail,
        password,
        options: {
          userAttributes: { email: trimmedEmail },
        },
      });

      // Stash name so ProfileCompletion can auto-populate and auto-submit
      try { sessionStorage.setItem('gimmies.pendingProfileName.v1', trimmedName); } catch {}
      stashPendingTargets();

      // Immediately sign in (account is already confirmed)
      const result = await signIn({ username: trimmedEmail, password });

      if (result.isSignedIn) {
        onSuccess();
      } else {
        setError('Sign-up succeeded but sign-in failed. Try signing in manually.');
        setJoining(false);
      }
    } catch (err: any) {
      const msg = err?.message || '';

      if (err?.name === 'UsernameExistsException' || msg.includes('already exists')) {
        // Account already exists — try signing in directly
        try {
          stashPendingTargets();
          try { sessionStorage.setItem('gimmies.pendingProfileName.v1', trimmedName); } catch {}

          const result = await signIn({ username: trimmedEmail, password });
          if (result.isSignedIn) {
            onSuccess();
            return;
          }
        } catch (signInErr: any) {
          if (signInErr?.name === 'UserAlreadyAuthenticatedException' || signInErr?.message?.includes('already a signed in user')) {
            onSuccess();
            return;
          }
          setError('That email is already registered. Check your password or sign in instead.');
        }
      } else if (msg.includes('Password') || msg.includes('password')) {
        setError(msg);
      } else {
        setError(msg || 'Something went wrong. Try again.');
      }

      setJoining(false);
    }
  };

  const handleSignInInstead = () => {
    stashPendingTargets();
    onSignIn();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex flex-col">
      <div className="flex-shrink-0 pt-safe-top" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-5">
            <img src="/gimmies-logo.png" alt="Gimmies" className="h-9 mx-auto opacity-90" />
          </div>

          {/* Invite card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-5 mb-5 text-center">
            <div className="text-3xl mb-2">⛳</div>
            <h1 className="text-xl font-black text-white mb-1">
              You've Been Invited!
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Quick sign-up — no email verification needed.
            </p>
          </div>

          {/* Sign-up form */}
          <form onSubmit={handleJoin} className="bg-white rounded-2xl shadow-2xl p-5">
            <div className="space-y-3">
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
                  className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-gray-400 transition-all"
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
                  className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-gray-400 transition-all"
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
                  placeholder="At least 8 characters"
                  minLength={8}
                  className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-gray-400 transition-all"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 font-medium text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full py-3.5 bg-gradient-to-r from-accent to-orange-500 text-white font-bold text-base rounded-xl shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:shadow-none transition-all hover:shadow-xl active:scale-[0.98]"
              >
                {joining ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Setting you up...
                  </span>
                ) : (
                  "Let's Play →"
                )}
              </button>

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                No verification email. You're in instantly.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Sign in for existing users */}
            <button
              type="button"
              onClick={handleSignInInstead}
              className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-200 transition-colors"
            >
              Already have an account? Sign in
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-white/40 text-xs">
              No commitment. No hassle. Just golf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestJoinPage;
