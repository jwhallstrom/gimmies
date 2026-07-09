import React from 'react';
import useStore from '../state/store';

type Props = {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Guest-mode gate: provides a consistent way to return to LoginPage.
 *
 * In this app, showing LoginPage requires `currentUser` to be null.
 * Clears Amplify session first so sign-in does not get stuck on stale tokens.
 */
export const SignInRequired: React.FC<Props> = ({
  title = '🔒 Sign in required',
  message = 'This feature requires an account so data can sync across devices and with other players.',
  actionLabel = 'Sign In',
  onAction,
}) => {
  const logout = useStore((s) => s.logout);

  const handleSignIn = async () => {
    onAction?.();
    try {
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
    } catch {
      // ignore — may not have an Amplify session
    }
    logout();
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-extrabold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-700 mb-4">{message}</p>
          <button
            onClick={() => { void handleSignIn(); }}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-extrabold text-white bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 transition-all shadow-md"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
