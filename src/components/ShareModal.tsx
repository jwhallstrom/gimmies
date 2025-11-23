import React, { useState } from 'react';
import useStore from '../state/store';
import { useAuthMode } from '../hooks/useAuthMode';

interface ShareModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ eventId, isOpen, onClose }) => {
  const { events, currentProfile, generateShareCode } = useStore();
  const { isGuest } = useAuthMode();
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const event = events.find(e => e.id === eventId);
  if (!event) return null;

  const isOwner = currentProfile?.id === event.ownerProfileId;
  const shareUrl = event.shareCode ? `${window.location.origin}/join/${event.shareCode}` : '';

  const handleGenerateCode = async () => {
    const code = await generateShareCode(eventId);
    if (code) {
      setMessage('Share code generated!');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Failed to generate code.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setMessage(`${type} copied!`);
    setTimeout(() => setMessage(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-primary-900 p-4 flex justify-between items-center">
          <h3 className="text-white font-semibold text-lg">Invite Players</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white" title="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isGuest ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">Sign in to share events and sync scores with friends.</p>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700"
              >
                Sign In
              </button>
            </div>
          ) : (
            <>
              {message && (
                <div className="bg-green-50 text-green-700 px-3 py-2 rounded text-sm text-center animate-fade-in">
                  {message}
                </div>
              )}

              {!event.shareCode ? (
                <div className="text-center space-y-4">
                  <p className="text-gray-600 text-sm">Generate a code to let others join this event.</p>
                  {isOwner ? (
                    <button
                      onClick={handleGenerateCode}
                      className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 shadow-sm"
                    >
                      Generate Invite Code
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Only the event owner can generate an invite code.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Event Code</p>
                    <div 
                      onClick={() => handleCopy(event.shareCode!, 'Code')}
                      className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors group"
                    >
                      <span className="text-3xl font-mono font-bold text-gray-800 tracking-widest group-hover:text-primary-700">
                        {event.shareCode}
                      </span>
                      <p className="text-xs text-gray-400 mt-1 group-hover:text-primary-600">Tap to copy</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Share Link</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        title="Share Link"
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none"
                      />
                      <button
                        onClick={() => handleCopy(shareUrl, 'Link')}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                     <button
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: `Join my Gimmies Golf event: ${event.name}`,
                              text: `Join my golf game! Use code: ${event.shareCode}`,
                              url: shareUrl
                            }).catch(console.error);
                          } else {
                            handleCopy(`${shareUrl}\nCode: ${event.shareCode}`, 'Invite');
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 shadow-sm"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        Share Invite
                      </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
