import React, { useState } from 'react';
import useStore from '../state/store';

type Props = { eventId: string };

const EventSharing: React.FC<Props> = ({ eventId }) => {
  const { events, currentProfile, generateShareCode, joinEventByCode } = useStore();
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');

  const event = events.find(e => e.id === eventId);
  if (!event) return null;

  const isOwner = currentProfile?.id === event.ownerProfileId;

  const handleGenerateCode = () => {
    const code = generateShareCode(eventId);
    setMessage('Share code generated! Copy and send to friends.');
    setTimeout(() => setMessage(''), 3000);
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
