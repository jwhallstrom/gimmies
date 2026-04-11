import React from 'react';
import { useParams } from 'react-router-dom';

interface GuestJoinPageProps {
  onSignIn: () => void;
  eventId?: string;
  shareCode?: string;
}

/**
 * Landing page for unauthenticated users who tap an event invite link.
 *
 * The Amplify backend requires Cognito auth for ALL data queries, so we
 * cannot load event details here. Instead we show a friendly invite page
 * and funnel the user to a quick sign-up / sign-in. After auth, the main
 * App router will land them directly on the event.
 */
const GuestJoinPage: React.FC<GuestJoinPageProps> = ({ onSignIn, eventId: propEventId, shareCode: propShareCode }) => {
  const { id: paramId, code: paramCode } = useParams();

  const targetEventId = propEventId || paramId;
  const targetShareCode = propShareCode || paramCode;

  const handleSignIn = () => {
    // Stash the event/code so the app can auto-join after auth
    if (targetShareCode) {
      try { sessionStorage.setItem('gimmies.pendingJoinCode.v1', targetShareCode); } catch {}
    }
    if (targetEventId) {
      try { sessionStorage.setItem('gimmies.pendingEventId.v1', targetEventId); } catch {}
    }
    onSignIn();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex flex-col">
      <div className="flex-shrink-0 pt-safe-top" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-6">
            <img src="/gimmies-logo.png" alt="Gimmies" className="h-9 mx-auto opacity-90" />
          </div>

          {/* Invite card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 mb-5 text-center">
            <div className="text-4xl mb-3">⛳</div>
            <h1 className="text-xl font-black text-white mb-2">
              You've Been Invited to Play!
            </h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Your golf group is waiting. Sign in or create a free account to jump into the round.
            </p>
          </div>

          {/* Action card */}
          <div className="bg-white rounded-2xl shadow-2xl p-5">
            <div className="space-y-3">
              {/* Primary CTA — sign up */}
              <button
                onClick={handleSignIn}
                className="w-full py-3.5 bg-gradient-to-r from-accent to-orange-500 text-white font-bold text-base rounded-xl shadow-lg shadow-orange-500/30 transition-all hover:shadow-xl active:scale-[0.98]"
              >
                Create Free Account
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-xs text-gray-400 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              {/* Secondary — sign in */}
              <button
                onClick={handleSignIn}
                className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-200 transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>

            {/* What you get */}
            <div className="mt-5 pt-4 border-t border-gray-100 space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">What you'll get:</p>
              {[
                { emoji: '📊', text: 'Live leaderboard & scoring' },
                { emoji: '💰', text: 'Side games — Nassau, skins & more' },
                { emoji: '🏌️', text: 'Handicap tracking' },
                { emoji: '💬', text: 'Group chat with your crew' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2.5">
                  <span className="text-sm">{item.emoji}</span>
                  <span className="text-xs text-gray-600">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-white/40 text-xs">
              Free to use. Set up in 30 seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestJoinPage;
