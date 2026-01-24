/**
 * TournamentChat - Message board / announcements for tournaments
 * 
 * Features:
 * - Announcements from admins (always visible)
 * - Optional participant chat (admin can enable/disable)
 * - Real-time feel with optimistic updates
 * - Admin controls for moderation
 * 
 * Chat Modes:
 * - 'announcements_only': Only admins can post (default for most tournaments)
 * - 'open': All participants can post
 * - 'disabled': No chat at all
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Tournament } from '../../state/types';

export interface ChatMessage {
  id: string;
  tournamentId: string;
  authorId: string;
  authorName: string;
  authorRole: 'organizer' | 'participant';
  content: string;
  type: 'announcement' | 'message';
  timestamp: string;
  isPinned?: boolean;
  isDeleted?: boolean;
}

export type ChatMode = 'announcements_only' | 'open' | 'disabled';

interface Props {
  tournament: Tournament;
  currentUserId: string;
  currentUserName: string;
  isOrganizer: boolean;
  messages: ChatMessage[];
  chatMode: ChatMode;
  onSendMessage: (content: string, type: 'announcement' | 'message') => void;
  onDeleteMessage?: (messageId: string) => void;
  onPinMessage?: (messageId: string, pinned: boolean) => void;
  onChangeChatMode?: (mode: ChatMode) => void;
}

const TournamentChat: React.FC<Props> = ({
  tournament,
  currentUserId,
  currentUserName,
  isOrganizer,
  messages,
  chatMode,
  onSendMessage,
  onDeleteMessage,
  onPinMessage,
  onChangeChatMode,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);
  
  const handleSend = () => {
    if (!newMessage.trim()) return;
    
    onSendMessage(
      newMessage.trim(),
      isOrganizer && isAnnouncement ? 'announcement' : 'message'
    );
    setNewMessage('');
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  // Filter visible messages (non-deleted, or show deleted to organizers)
  const visibleMessages = messages.filter(m => !m.isDeleted || isOrganizer);
  
  // Separate pinned and regular messages
  const pinnedMessages = visibleMessages.filter(m => m.isPinned);
  const regularMessages = visibleMessages.filter(m => !m.isPinned);
  
  const canPost = isOrganizer || chatMode === 'open';
  
  if (chatMode === 'disabled') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-3">💬</div>
          <p>Chat is disabled for this tournament.</p>
          {isOrganizer && (
            <button
              onClick={() => onChangeChatMode?.('announcements_only')}
              className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Enable announcements
            </button>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '500px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="font-semibold text-gray-900">
            {chatMode === 'announcements_only' ? 'Announcements' : 'Discussion'}
          </h3>
          <p className="text-xs text-gray-500">
            {chatMode === 'announcements_only' 
              ? 'Updates from the organizer'
              : `${tournament.registrations.length} participants`}
          </p>
        </div>
        
        {isOrganizer && (
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            
            {showSettings && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg py-2 z-10">
                <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Chat Mode</div>
                {[
                  { id: 'announcements_only' as ChatMode, label: 'Announcements Only', desc: 'Only you can post' },
                  { id: 'open' as ChatMode, label: 'Open Discussion', desc: 'Everyone can chat' },
                  { id: 'disabled' as ChatMode, label: 'Disabled', desc: 'No messages' },
                ].map(option => (
                  <button
                    key={option.id}
                    onClick={() => {
                      onChangeChatMode?.(option.id);
                      setShowSettings(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                      chatMode === option.id ? 'bg-primary-50' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">{option.label}</div>
                      <div className="text-xs text-gray-500">{option.desc}</div>
                    </div>
                    {chatMode === option.id && (
                      <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Pinned Messages */}
        {pinnedMessages.map(msg => (
          <div key={msg.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center flex-shrink-0">
                📌
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{msg.authorName}</span>
                  <span className="text-xs text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">Pinned</span>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{msg.content}</p>
                <div className="text-xs text-gray-500 mt-1">{formatTime(msg.timestamp)}</div>
              </div>
              
              {isOrganizer && (
                <button
                  onClick={() => onPinMessage?.(msg.id, false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  title="Unpin"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
        
        {/* Regular Messages */}
        {regularMessages.map(msg => (
          <div 
            key={msg.id} 
            className={`flex items-start gap-3 ${msg.isDeleted ? 'opacity-50' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.authorRole === 'organizer' 
                ? 'bg-primary-100 text-primary-600'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {msg.authorRole === 'organizer' ? '🎯' : msg.authorName.charAt(0).toUpperCase()}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{msg.authorName}</span>
                {msg.authorRole === 'organizer' && (
                  <span className="text-xs text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">Organizer</span>
                )}
                {msg.type === 'announcement' && (
                  <span className="text-xs text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">📢 Announcement</span>
                )}
              </div>
              
              {msg.isDeleted ? (
                <p className="text-gray-400 italic">Message deleted</p>
              ) : (
                <p className="text-gray-800 whitespace-pre-wrap">{msg.content}</p>
              )}
              
              <div className="text-xs text-gray-500 mt-1">{formatTime(msg.timestamp)}</div>
            </div>
            
            {/* Admin Actions */}
            {isOrganizer && !msg.isDeleted && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onPinMessage?.(msg.id, true)}
                  className="p-1 text-gray-400 hover:text-yellow-600"
                  title="Pin message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDeleteMessage?.(msg.id)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Delete message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
        
        {visibleMessages.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">💬</div>
            <p>No messages yet.</p>
            {isOrganizer && (
              <p className="text-sm mt-1">Post an announcement to get started!</p>
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      {canPost && (
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          {/* Announcement Toggle (Organizer only) */}
          {isOrganizer && (
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setIsAnnouncement(!isAnnouncement)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  isAnnouncement
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📢
                {isAnnouncement ? 'Announcement ON' : 'Regular message'}
              </button>
              {isAnnouncement && (
                <span className="text-xs text-gray-500">This will be highlighted for all participants</span>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isAnnouncement ? 'Type an announcement...' : 'Type a message...'}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                newMessage.trim()
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {!canPost && chatMode === 'announcements_only' && (
        <div className="p-3 border-t border-gray-100 text-center text-sm text-gray-500 flex-shrink-0">
          Only the organizer can post announcements
        </div>
      )}
    </div>
  );
};

export default TournamentChat;
