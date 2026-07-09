import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { InviteJoinFailure } from '../utils/inviteSession';
import {
  clearJoinFailure,
  clearPendingJoinTargets,
  stashPendingInviteTargets,
} from '../utils/inviteSession';
import { buildJoinInviteUrl } from '../utils/inviteLinks';

interface InviteJoinFailedPageProps {
  failure: InviteJoinFailure;
  onRetry: () => void;
}

const InviteJoinFailedPage: React.FC<InviteJoinFailedPageProps> = ({ failure, onRetry }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const shareCode = failure.shareCode?.toUpperCase();
  const inviteUrl = shareCode ? buildJoinInviteUrl(shareCode) : '';

  const handleCopyCode = async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleGoHome = () => {
    clearJoinFailure();
    clearPendingJoinTargets();
    navigate('/', { replace: true });
  };

  const handleRetry = () => {
    clearJoinFailure();
    stashPendingInviteTargets(failure.shareCode, failure.eventId);
    onRetry();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-2xl font-black text-white mb-2">Couldn&apos;t Join Yet</h1>
        {failure.eventName && (
          <p className="text-white/80 font-semibold mb-2">{failure.eventName}</p>
        )}
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          {failure.error || 'Something went wrong joining this game. You can try again or ask the organizer for help.'}
        </p>

        <div className="bg-white rounded-2xl shadow-2xl p-5 space-y-3 text-left">
          {shareCode && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Join code</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-black tracking-widest text-gray-900">{shareCode}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {inviteUrl && (
                <p className="text-[10px] text-gray-400 mt-2 break-all">{inviteUrl}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleRetry}
            className="w-full py-3.5 bg-gradient-to-r from-accent to-orange-500 text-white font-bold rounded-xl shadow-lg"
          >
            Try Again
          </button>

          <button
            type="button"
            onClick={handleGoHome}
            className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
          >
            Go to Home
          </button>
        </div>

        <p className="text-white/40 text-xs mt-6 leading-relaxed">
          Tip: If you just created an account, wait a moment and tap Try Again.
        </p>
      </div>
    </div>
  );
};

export default InviteJoinFailedPage;
