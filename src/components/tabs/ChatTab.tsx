import React, { useRef, useEffect, useState } from 'react';
import useStore from '../../state/store';

interface ChatTabProps { eventId: string; }

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

const ChatTab: React.FC<ChatTabProps> = ({ eventId }) => {
  const event = useStore(s => 
    s.events.find(e => e.id === eventId) || 
    s.completedEvents.find(e => e.id === eventId)
  );
  const currentProfile = useStore(s => s.currentProfile);
  const addChatMessage = useStore(s => s.addChatMessage);
  const clearChat = useStore(s => s.clearChat);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const messages = event?.chat || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (!event) return <div className="text-sm text-red-600">Event not found.</div>;

  const handleSend = () => {
    if (!text.trim()) return;
    addChatMessage(eventId, text);
    setText('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] max-h-[650px] bg-white/90 backdrop-blur rounded-xl shadow-sm border border-primary-900/10">
      <div className="flex items-center justify-between px-4 py-2 border-b border-primary-900/10 bg-gradient-to-r from-primary-50 to-white rounded-t-xl">
        <h2 className="font-semibold text-primary-800 text-sm tracking-wide">Event Chat</h2>
        {messages.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear all chat messages for this event?')) {
                clearChat(eventId);
              }
            }}
            className="text-[10px] uppercase tracking-wide font-semibold text-primary-500 hover:text-primary-700"
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-[13px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-xs mt-8">No messages yet. Start the conversation!</div>
        )}
        {messages.map(m => {
          const sender = m.profileId ? useStore.getState().profiles.find(p => p.id === m.profileId) : undefined;
          const mine = m.profileId === currentProfile?.id;
          const isBot = m.profileId === 'gimmies-bot';
          
          if (isBot) {
            return (
              <div key={m.id} className="flex justify-center">
                <div className="max-w-[85%] rounded-lg px-3 py-2 shadow-sm border text-[12px] leading-snug bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-900">
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
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm border text-[12px] leading-snug ${mine ? 'bg-primary-600 text-white border-primary-700' : 'bg-primary-50 text-primary-900 border-primary-200'}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-semibold ${mine ? 'text-white' : 'text-primary-700'}`}>{sender?.name || 'Unknown'}</span>
                  <span className={`text-[10px] uppercase tracking-wide ${mine ? 'text-primary-200' : 'text-primary-500'}`}>{timeAgo(m.createdAt)}</span>
                </div>
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-primary-900/10 p-3 space-y-2 bg-white/70 rounded-b-xl">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={currentProfile ? 'Type a message (Enter to send, Shift+Enter for newline)' : 'Create a profile to chat'}
          disabled={!currentProfile}
          rows={2}
          className="w-full resize-none rounded-md border border-primary-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 px-3 py-2 text-sm bg-white/90 disabled:opacity-50"
        />
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-primary-500">{text.length}/2000</span>
          <button
            onClick={handleSend}
            disabled={!text.trim() || !currentProfile}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600 text-white px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide shadow-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
