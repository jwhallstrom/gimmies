import React, { useState, useEffect, useRef } from 'react';
import useStore from '../state/store';
import { useAuthMode } from '../hooks/useAuthMode';
import { buildJoinInviteUrl } from '../utils/inviteLinks';

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
  const autoGenTriggered = useRef(false);

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

  // AUTO-GENERATE share code when modal opens (grandma-simple: no extra button)
  useEffect(() => {
    if (!isOpen || autoGenTriggered.current) return;
    const event = events.find(e => e.id === eventId);
    if (!event || event.shareCode || isGuest || !currentProfile) return;
    // Only auto-generate if the user is allowed (owner or group member)
    const isGroupHub = event.hubType === 'group';
    const isOwner = currentProfile?.id === event.ownerProfileId;
    const isMember = event.golfers.some(g => g.profileId === currentProfile?.id);
    if (!isOwner && !isGroupHub && !isMember) return;
    
    autoGenTriggered.current = true;
    setIsGenerating(true);
    generateShareCode(eventId).finally(() => setIsGenerating(false));
  }, [isOpen, eventId, events, currentProfile, isGuest, generateShareCode]);

  // Reset auto-gen flag when modal closes
  useEffect(() => {
    if (!isOpen) autoGenTriggered.current = false;
  }, [isOpen]);

  if (!isOpen) return null;

  const event = events.find(e => e.id === eventId);
  if (!event) return null;

  const isGroupHub = event.hubType === 'group';
  const isPublic = !!event.isPublic;
  const shareUrl = buildJoinInviteUrl(event.shareCode);

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
    
    const smsUrl = `sms:?body=${encodeURIComponent(text)}`;
    window.open(smsUrl, '_self');
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" 
      onClick={onClose}
    >
      <div 
        className="bg-white text-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up"
        style={{ colorScheme: 'light' }}
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
          ) : isGenerating ? (
            /* Loading state while auto-generating code */
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-3"></div>
              <p className="text-sm text-gray-500">Creating invite link...</p>
            </div>
          ) : (
            <>
              {/* Status Message */}
              {message && (
                <div className="bg-green-50 text-green-700 px-4 py-2.5 rounded-xl text-sm text-center font-medium animate-fade-in">
                  {message}
                </div>
              )}

              {event.shareCode ? (
                /* Has share code - show sharing options immediately */
                <div className="space-y-5">
                  {/* Big CTA buttons - grandma friendly */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Text Message - #1 action for grandma */}
                    <button
                      onClick={handleTextMessage}
                      className="flex flex-col items-center gap-2 p-5 bg-green-50 hover:bg-green-100 rounded-2xl border-2 border-green-200 transition-colors"
                    >
                      <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <span className="text-sm font-bold text-green-700">Send Text</span>
                    </button>
                    
                    {/* Share Sheet */}
                    <button
                      onClick={handleNativeShare}
                      className={`flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-colors ${
                        isGroupHub 
                          ? 'bg-purple-50 hover:bg-purple-100 border-purple-200' 
                          : 'bg-primary-50 hover:bg-primary-100 border-primary-200'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-md ${
                        isGroupHub ? 'bg-purple-500' : 'bg-primary-600'
                      }`}>
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </div>
                      <span className={`text-sm font-bold ${isGroupHub ? 'text-purple-700' : 'text-primary-700'}`}>
                        Share Link
                      </span>
                    </button>
                  </div>

                  {/* Copy link - one tap */}
                  <button
                    onClick={() => handleCopy(shareUrl, 'Link')}
                    className="w-full flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center group-hover:bg-primary-100">
                      <svg className="w-4 h-4 text-gray-600 group-hover:text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-semibold text-gray-600">Tap to copy link</p>
                      <p className="text-xs text-gray-400 font-mono truncate">{shareUrl}</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>

                  {/* Join Code - only for private events and groups */}
                  {(!isPublic || isGroupHub) && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Or share the code</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      <button
                        onClick={() => handleCopy(event.shareCode!, 'Code')}
                        className="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-3 hover:border-primary-400 hover:bg-primary-50 transition-all group"
                      >
                        <span className="text-2xl font-mono font-black text-gray-800 tracking-[0.2em] group-hover:text-primary-700">
                          {event.shareCode}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5 group-hover:text-primary-600">Tap to copy</p>
                      </button>
                    </>
                  )}

                  {/* How it works for grandma */}
                  <div className={`p-3 rounded-xl text-xs ${
                    isGroupHub ? 'bg-purple-50 text-purple-700' : 'bg-primary-50 text-primary-700'
                  }`}>
                    <p className="font-semibold mb-1">How it works:</p>
                    {isPublic ? (
                      <p>Send the link. They tap it. They're in. No code needed.</p>
                    ) : (
                      <p>Send the link or code. They tap the link (or enter the code) and they're in.</p>
                    )}
                  </div>
                </div>
              ) : (
                /* Fallback: code generation failed or not allowed */
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500">Could not create invite link. Try again later.</p>
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
