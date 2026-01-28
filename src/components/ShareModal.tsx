import React, { useState, useEffect } from 'react';
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
  const [isGenerating, setIsGenerating] = useState(false);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const event = events.find(e => e.id === eventId);
  if (!event) return null;

  const isGroupHub = event.hubType === 'group';
  const isOwner = currentProfile?.id === event.ownerProfileId;
  const shareUrl = event.shareCode ? `${window.location.origin}/join/${event.shareCode}` : '';
  
  // For groups, all members can share. For events, anyone in the event can share.
  const canShare = isGroupHub || isOwner || event.golfers.some(g => g.profileId === currentProfile?.id);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const code = await generateShareCode(eventId);
      if (code) {
        setMessage('Invite code created!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to generate code.');
        setTimeout(() => setMessage(''), 3000);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setMessage(`${type} copied!`);
    setTimeout(() => setMessage(''), 2000);
  };

  const handleNativeShare = () => {
    const title = isGroupHub 
      ? `Join my Gimmies group: ${event.name}`
      : `Join my Gimmies Golf event: ${event.name}`;
    const text = isGroupHub
      ? `Join my golf group "${event.name}"! Use code: ${event.shareCode}`
      : `Join my golf game "${event.name}"! Use code: ${event.shareCode}`;

    if (navigator.share) {
      navigator.share({ title, text, url: shareUrl }).catch(console.error);
    } else {
      handleCopy(`${text}\n${shareUrl}`, 'Invite');
    }
  };

  const handleTextMessage = () => {
    const text = isGroupHub
      ? `Join my golf group "${event.name}" on Gimmies! ${shareUrl}`
      : `Join my golf event "${event.name}" on Gimmies! ${shareUrl}`;
    
    // Use SMS URI scheme
    const smsUrl = `sms:?body=${encodeURIComponent(text)}`;
    window.open(smsUrl, '_self');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 flex justify-between items-center ${isGroupHub ? 'bg-purple-600' : 'bg-primary-900'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{isGroupHub ? '👥' : '⛳'}</span>
            <h3 className="text-white font-bold text-lg">
              {isGroupHub ? 'Invite Members' : 'Invite Players'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {isGuest ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-600">Sign in to invite friends and sync across devices.</p>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
              >
                Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Status Message */}
              {message && (
                <div className="bg-green-50 text-green-700 px-4 py-2.5 rounded-xl text-sm text-center font-medium animate-fade-in">
                  ✓ {message}
                </div>
              )}

              {/* No share code yet */}
              {!event.shareCode ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">Create an invite link</p>
                    <p className="text-sm text-gray-500">
                      {isGroupHub 
                        ? 'Generate a link so friends can join your group'
                        : 'Generate a link so golfers can join this event'}
                    </p>
                  </div>
                  {(isOwner || isGroupHub) ? (
                    <button
                      onClick={handleGenerateCode}
                      disabled={isGenerating}
                      className={`w-full py-3.5 rounded-xl font-bold text-white transition-all ${
                        isGroupHub 
                          ? 'bg-purple-600 hover:bg-purple-700' 
                          : 'bg-primary-600 hover:bg-primary-700'
                      } disabled:opacity-60 shadow-lg`}
                    >
                      {isGenerating ? 'Creating...' : 'Create Invite Link'}
                    </button>
                  ) : (
                    <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-xl">
                      Only the {isGroupHub ? 'group admin' : 'event owner'} can create an invite link.
                    </p>
                  )}
                </div>
              ) : (
                /* Has share code - show sharing options */
                <div className="space-y-5">
                  {/* Quick Share Actions */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Share</p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Text Message */}
                      <button
                        onClick={handleTextMessage}
                        className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-colors"
                      >
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <span className="text-sm font-semibold text-green-700">Text</span>
                      </button>
                      
                      {/* Share Sheet */}
                      <button
                        onClick={handleNativeShare}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                          isGroupHub 
                            ? 'bg-purple-50 hover:bg-purple-100 border-purple-200' 
                            : 'bg-primary-50 hover:bg-primary-100 border-primary-200'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isGroupHub ? 'bg-purple-500' : 'bg-primary-600'
                        }`}>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </div>
                        <span className={`text-sm font-semibold ${isGroupHub ? 'text-purple-700' : 'text-primary-700'}`}>
                          Share
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Join Code */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Join Code</p>
                    <button
                      onClick={() => handleCopy(event.shareCode!, 'Code')}
                      className="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-primary-400 hover:bg-primary-50 transition-all group"
                    >
                      <span className="text-3xl font-mono font-black text-gray-800 tracking-[0.2em] group-hover:text-primary-700">
                        {event.shareCode}
                      </span>
                      <p className="text-xs text-gray-400 mt-1 group-hover:text-primary-600">Tap to copy</p>
                    </button>
                  </div>

                  {/* Share Link */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Link</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 font-mono truncate"
                      />
                      <button
                        onClick={() => handleCopy(shareUrl, 'Link')}
                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Tip */}
                  <div className={`p-3 rounded-xl text-xs ${
                    isGroupHub ? 'bg-purple-50 text-purple-700' : 'bg-primary-50 text-primary-700'
                  }`}>
                    <span className="font-semibold">Tip:</span> Anyone with the code or link can join. 
                    {isGroupHub && ' All members can share this invite.'}
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
