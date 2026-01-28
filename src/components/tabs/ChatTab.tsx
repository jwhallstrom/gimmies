import React, { useRef, useEffect, useState } from 'react';
import { useEventChatAdapter } from '../../adapters';

interface ChatTabProps { 
  eventId: string;
  onCreateEvent?: () => void;
}

// Simple relative time helper
const timeAgo = (iso: string) => {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec + 's';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h';
  const day = Math.floor(hr / 24);
  return day + 'd';
};

const ChatTab: React.FC<ChatTabProps> = ({ eventId, onCreateEvent }) => {
  const { event, currentProfile, messages, profilesById, send } = useEventChatAdapter(eventId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // "Group chat only" mode: no event loaded (e.g. group exists but no event yet).
  if (!event) {
    return (
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200/80 p-6 text-center space-y-3">
        <div className="text-4xl">💬</div>
        <div className="font-bold text-gray-900">No messages yet</div>
        <p className="text-sm text-gray-500">
          Start chatting with your group!
        </p>
        {onCreateEvent && (
          <button
            onClick={onCreateEvent}
            className="mt-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
          >
            + Create Event
          </button>
        )}
      </div>
    );
  }

  const handleSend = async () => {
    if (!text.trim()) return;
    await send(text);
    setText('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-280px)] min-h-[300px] max-h-[500px] bg-white/95 backdrop-blur rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200/80 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-[13px] scroll-smooth">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-8">No messages yet. Start the conversation!</div>
        )}
        {messages.map(m => {
          const sender = m.profileId ? profilesById.get(m.profileId) : undefined;
          const senderDisplayName = sender?.name || m.senderName || 'Unknown';
          const senderAvatar = sender?.avatar;
          const mine = m.profileId === currentProfile?.id;
          const isBot = m.profileId === 'gimmies-bot';
          
          if (isBot) {
            return (
              <div key={m.id} className="flex justify-center">
                <div className="max-w-[85%] rounded-xl px-3 py-2 shadow-sm border text-[13px] leading-snug bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-900">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-amber-700">🎯 Gimmies Alert</span>
                    <span className="text-[10px] uppercase tracking-wide text-amber-600">{timeAgo(m.createdAt)}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words font-medium">{m.text}</div>
                </div>
              </div>
            );
          }
          
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
              {/* Avatar for others (left side) */}
              {!mine && (
                senderAvatar ? (
                  <img src={senderAvatar} alt={senderDisplayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-sm" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {senderDisplayName.charAt(0).toUpperCase()}
                  </span>
                )
              )}
              
              <div className={`max-w-[70%] rounded-2xl px-3 py-2 shadow-sm text-[13px] leading-snug ${mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-gray-900 rounded-bl-md'}`}>
                {!mine && (
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-primary-700 text-xs">{senderDisplayName}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                <div className={`text-[10px] mt-1 ${mine ? 'text-primary-200' : 'text-gray-500'}`}>{timeAgo(m.createdAt)}</div>
              </div>
              
              {/* Avatar for self (right side) */}
              {mine && (
                currentProfile?.avatar ? (
                  <img src={currentProfile.avatar} alt={senderDisplayName} className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-sm" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {senderDisplayName.charAt(0).toUpperCase()}
                  </span>
                )
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {/* Input area - sticky at bottom with better mobile handling */}
      <div className="border-t border-gray-200 p-3 bg-white rounded-b-xl flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={currentProfile ? 'Type a message...' : 'Create a profile to chat'}
            disabled={!currentProfile}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 px-4 py-2.5 text-base bg-gray-50 text-gray-900 placeholder-gray-500 disabled:opacity-50"
            style={{ minHeight: '44px', maxHeight: '100px' }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || !currentProfile}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600 text-white p-3 rounded-xl shadow-sm flex-shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-xs text-gray-500">{text.length}/2000</span>
          <span className="text-[10px] text-gray-400">Enter to send</span>
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
