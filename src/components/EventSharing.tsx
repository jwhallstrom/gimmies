import React, { useState } from 'react';
import useStore from '../state/store';
import { useAuthMode } from '../hooks/useAuthMode';

type Props = { eventId: string };

const EventSharing: React.FC<Props> = ({ eventId }) => {
  const { events, currentProfile, generateShareCode, joinEventByCode } = useStore();
  const { isAuthenticated, isGuest } = useAuthMode();
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');

  const event = events.find(e => e.id === eventId);
  if (!event) return null;

  const isOwner = currentProfile?.id === event.ownerProfileId;

  // Show upgrade prompt for guest users
  if (isGuest) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <svg className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-bold text-gray-900 mb-2">
              🔒 Sign In to Share Events!
            </h4>
            <p className="text-gray-700 mb-4">
              Event sharing and collaboration features require a cloud account to sync data across devices and with other players.
            </p>
            <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
              <p className="font-semibold text-gray-800 mb-2">With a free account, you can:</p>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>✅ Share events with friends via code or link</li>
                <li>✅ Join events created by others</li>
                <li>✅ Real-time score updates across devices</li>
                <li>✅ Event chat and collaboration</li>
                <li>✅ Backup your data to the cloud</li>
                <li>✅ Access from any device</li>
              </ul>
            </div>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all shadow-lg"
            >
              Sign In or Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleGenerateCode = async () => {
    const code = await generateShareCode(eventId);
    if (code) {
      setMessage('Share code generated! Copy and send to friends.');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Failed to generate share code. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const shareUrl = event.shareCode ? `${window.location.origin}/join/${event.shareCode}` : '';

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-3 rounded ${message.includes('Successfully') ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
          {message}
        </div>
      )}

      {/* Owner Controls */}
      {isOwner && (
        <div>
          <h4 className="text-sm font-semibold mb-3 text-gray-800">Share Your Event</h4>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleGenerateCode}
                className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
                disabled={!!event.shareCode}
              >
                {event.shareCode ? 'Share Code Generated' : 'Generate Share Code'}
              </button>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={event.isPublic}
                  onChange={(e) => useStore.getState().updateEvent(eventId, { isPublic: e.target.checked })}
                />
                <span className="text-sm text-gray-700">Allow anyone to join</span>
              </label>
            </div>
            
            {event.shareCode && (
              <div className="bg-gray-50 p-4 rounded">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-medium text-gray-800">Share Code:</span>
                  <code className="bg-white border border-gray-400 px-3 py-1 rounded font-mono text-lg">{event.shareCode}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(event.shareCode!);
                      setMessage('Code copied to clipboard!');
                      setTimeout(() => setMessage(''), 2000);
                    }}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Copy
                  </button>
                </div>
                {shareUrl && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-medium text-gray-800">Share Link:</span>
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 bg-white border border-gray-400 px-3 py-1 rounded text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setMessage('Link copied to clipboard!');
                        setTimeout(() => setMessage(''), 2000);
                      }}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Copy Link
                    </button>
                  </div>
                )}
                <div className="text-sm text-gray-700">
                  Share either the 6-digit code or the link with friends to let them join your event.
                  <br />
                  <span className="text-gray-600">Note: Share codes only work within the same browser. To share across devices, export your event data first.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EventSharing;
