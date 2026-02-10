import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventChatAdapter } from '../../adapters';
import type { ChatMessage } from '../../state/types';
import { CHAT_REACTIONS } from '../../state/types';
import { nanoid } from 'nanoid/non-secure';

interface ChatTabProps {
  eventId: string;
  onCreateEvent?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const timeAgo = (iso: string) => {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + 'm';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + 'h';
  const day = Math.floor(hr / 24);
  return day + 'd';
};

// Group consecutive messages from same sender (within 2 min) for cleaner look
const shouldShowAvatar = (messages: ChatMessage[], index: number): boolean => {
  if (index === messages.length - 1) return true;
  const current = messages[index];
  const next = messages[index + 1];
  if (current.profileId !== next.profileId) return true;
  const diff = new Date(next.createdAt).getTime() - new Date(current.createdAt).getTime();
  return diff > 2 * 60 * 1000;
};

const shouldShowName = (messages: ChatMessage[], index: number): boolean => {
  if (index === 0) return true;
  const current = messages[index];
  const prev = messages[index - 1];
  if (current.profileId !== prev.profileId) return true;
  const diff = new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return diff > 2 * 60 * 1000;
};

// ============================================================================
// Double-tap detection (works on mobile + desktop)
// Uses a mutable ref map to track per-message tap timestamps
// ============================================================================

const DOUBLE_TAP_DELAY = 300; // ms window for second tap

// ============================================================================
// Keyboard handling - visualViewport API for PWA/iOS
// ============================================================================

const useKeyboardHandler = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardHeight(Math.max(0, heightDiff));
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  // Only hide footer when a real virtual keyboard is visible (keyboardHeight > 0).
  // On desktop there's no virtual keyboard so footer stays visible.
  // Always clean up on unmount so the class never gets stuck.
  useEffect(() => {
    if (keyboardHeight > 0) {
      document.body.classList.add('chat-input-focused');
    } else {
      document.body.classList.remove('chat-input-focused');
    }
    return () => {
      document.body.classList.remove('chat-input-focused');
    };
  }, [keyboardHeight]);

  // Keep focus/blur for any future non-class-toggle needs
  const handleFocus = useCallback(() => { /* keyboard detection handles footer */ }, []);
  const handleBlur = useCallback(() => { /* keyboard detection handles footer */ }, []);

  return { keyboardHeight, handleFocus, handleBlur };
};

// ============================================================================
// Sub-Components
// ============================================================================

// Reaction picker popup
const ReactionPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => (
  <div className="absolute bottom-full mb-1 left-0 right-0 flex justify-center z-20">
    <div
      className="flex gap-1 bg-white rounded-full shadow-lg border border-gray-200 px-2 py-1.5 animate-scale-in"
      onClick={(e) => e.stopPropagation()}
    >
      {CHAT_REACTIONS.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose(); }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-110 transition-all text-lg"
        >
          {emoji}
        </button>
      ))}
    </div>
  </div>
);

// Reaction badges under a message
const ReactionBadges: React.FC<{
  reactions: Record<string, string[]>;
  currentProfileId?: string;
  onToggle: (emoji: string) => void;
}> = ({ reactions, currentProfileId, onToggle }) => {
  const entries = Object.entries(reactions).filter(([, ids]) => ids.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, ids]) => {
        const isMine = currentProfileId ? ids.includes(currentProfileId) : false;
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
              isMine
                ? 'bg-primary-100 border-primary-300 text-primary-700'
                : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span>{emoji}</span>
            <span className="font-semibold">{ids.length}</span>
          </button>
        );
      })}
    </div>
  );
};

// Poll message card
const PollCard: React.FC<{
  message: ChatMessage;
  currentProfileId?: string;
  onVote: (optionId: string) => void;
}> = ({ message, currentProfileId, onVote }) => {
  const options = message.pollOptions || [];
  const totalVotes = options.reduce((sum, o) => sum + (o.votes?.length || 0), 0);
  const myVoteOptionId = currentProfileId
    ? options.find(o => o.votes?.includes(currentProfileId))?.id
    : undefined;

  return (
    <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border border-primary-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-base">📊</span>
        <span className="font-bold text-gray-900 text-sm">{message.pollQuestion || 'Poll'}</span>
      </div>
      <div className="space-y-1.5">
        {options.map(opt => {
          const votes = opt.votes?.length || 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isMyVote = opt.id === myVoteOptionId;
          return (
            <button
              key={opt.id}
              onClick={() => onVote(opt.id)}
              disabled={message.pollClosed}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium relative overflow-hidden transition-all ${
                isMyVote
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-800 hover:border-primary-300'
              } ${message.pollClosed ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {/* Progress bar background */}
              {totalVotes > 0 && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all ${isMyVote ? 'bg-primary-700' : 'bg-primary-50'}`}
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span>{opt.text}</span>
                {totalVotes > 0 && (
                  <span className={`text-xs font-bold ${isMyVote ? 'text-primary-200' : 'text-gray-500'}`}>
                    {pct}% ({votes})
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-500 text-center">
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''} {message.pollClosed ? '· Closed' : '· Tap to vote'}
      </div>
    </div>
  );
};

// Invite code card (tappable)
const InviteCard: React.FC<{
  message: ChatMessage;
  onJoin?: () => void;
}> = ({ message }) => {
  const code = message.metadata?.shareCode;
  const navigate = useNavigate();
  if (!code) return <span className="whitespace-pre-wrap break-words">{message.text}</span>;

  return (
    <div className="bg-gradient-to-r from-accent/10 to-orange-50 rounded-xl border border-orange-200 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-bold text-orange-800">
        <span>🎫</span>
        <span>Join Code</span>
      </div>
      <div className="flex items-center justify-between">
        <code className="text-lg font-black tracking-widest text-gray-900">{code}</code>
        <button
          onClick={() => navigate(`/join/${code}`)}
          className="px-3 py-1.5 bg-accent hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Join
        </button>
      </div>
    </div>
  );
};

// Common emoji sets for golf chat
const EMOJI_FAVORITES = ['👍', '👏', '🔥', '😂', '🤣', '💪', '🍺', '🏌️', '⛳', '🎯', '🦅', '🐦', '🐊', '🏆', '💰', '🤝', '😎', '🫡', '💀', '🤦', '🙏', '☀️', '🌧️', '💨', '⚡'];

// Curated golf GIFs (static image URLs - lightweight, no API needed)
const GOLF_GIFS = [
  { label: 'Nice shot!', emoji: '🏌️‍♂️💨' },
  { label: 'Birdie!', emoji: '🐦🔥' },
  { label: 'Eagle!', emoji: '🦅⛳' },
  { label: 'Let\'s go!', emoji: '💪⛳' },
  { label: 'In the hole!', emoji: '⛳🎯' },
  { label: 'Fore!', emoji: '⚠️🏌️' },
  { label: 'Cold beer', emoji: '🍺😎' },
  { label: 'Ace!', emoji: '🕳️🏌️' },
  { label: 'Sandtrap', emoji: '🏖️😩' },
  { label: 'Water ball', emoji: '💧⚽' },
  { label: 'Mulligan', emoji: '🔄🙏' },
  { label: 'Winner', emoji: '🏆👑' },
];

// Emoji picker panel
const EmojiPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => (
  <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-2 animate-slide-up">
    <div className="flex items-center justify-between px-1 mb-1.5">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Emoji</span>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div className="grid grid-cols-8 gap-0.5">
      {EMOJI_FAVORITES.map(emoji => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-110 transition-all text-xl"
        >
          {emoji}
        </button>
      ))}
    </div>
  </div>
);

// Golf quick-send stickers (emoji combos that send as messages)
const GolfStickers: React.FC<{
  onSend: (text: string) => void;
  onClose: () => void;
}> = ({ onSend, onClose }) => (
  <div className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-2 animate-slide-up">
    <div className="flex items-center justify-between px-1 mb-1.5">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Golf Stickers</span>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div className="grid grid-cols-4 gap-1.5">
      {GOLF_GIFS.map(gif => (
        <button
          key={gif.label}
          onClick={() => { onSend(`${gif.emoji} ${gif.label}`); onClose(); }}
          className="flex flex-col items-center gap-0.5 p-2 rounded-xl bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 active:scale-95 transition-all"
        >
          <span className="text-2xl leading-none">{gif.emoji}</span>
          <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400 leading-tight text-center">{gif.label}</span>
        </button>
      ))}
    </div>
  </div>
);

// Quick action buttons above the input
const QuickActions: React.FC<{
  onShareCode: () => void;
  onCreatePoll: () => void;
  onShowEmoji: () => void;
  onShowStickers: () => void;
  hasShareCode: boolean;
}> = ({ onShareCode, onCreatePoll, onShowEmoji, onShowStickers, hasShareCode }) => (
  <div className="flex gap-1.5 px-2 py-1.5 overflow-x-auto">
    <button
      onClick={onShowEmoji}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap transition-colors"
    >
      <span>😀</span> Emoji
    </button>
    <button
      onClick={onShowStickers}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-full text-xs font-semibold text-green-700 dark:text-green-400 whitespace-nowrap transition-colors"
    >
      <span>🏌️</span> Stickers
    </button>
    <button
      onClick={onCreatePoll}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded-full text-xs font-semibold text-primary-700 dark:text-primary-400 whitespace-nowrap transition-colors"
    >
      <span>📊</span> Poll
    </button>
    {hasShareCode && (
      <button
        onClick={onShareCode}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-full text-xs font-semibold text-orange-700 dark:text-orange-400 whitespace-nowrap transition-colors"
      >
        <span>🎫</span> Share Code
      </button>
    )}
  </div>
);

// Poll creation mini-form
const PollCreator: React.FC<{
  onSubmit: (question: string, options: string[]) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, '']);
  };

  const updateOption = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== idx));
  };

  const canSubmit = question.trim() && options.filter(o => o.trim()).length >= 2;

  return (
    <div className="bg-primary-50 border-t border-primary-200 p-3 space-y-2 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-primary-800">📊 Create Poll</span>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <input
        type="text"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="What's the question? (e.g., Tee time?)"
        className="w-full px-3 py-2 text-sm rounded-lg border border-primary-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-300 bg-white"
        autoFocus
      />
      {options.map((opt, idx) => (
        <div key={idx} className="flex gap-2">
          <input
            type="text"
            value={opt}
            onChange={e => updateOption(idx, e.target.value)}
            placeholder={`Option ${idx + 1}`}
            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:border-primary-400 focus:ring-1 focus:ring-primary-300 bg-white"
          />
          {options.length > 2 && (
            <button onClick={() => removeOption(idx)} className="text-gray-400 hover:text-red-500 px-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        {options.length < 6 && (
          <button onClick={addOption} className="text-xs text-primary-600 font-semibold hover:text-primary-700">
            + Add option
          </button>
        )}
        <button
          onClick={() => { if (canSubmit) onSubmit(question, options.filter(o => o.trim())); }}
          disabled={!canSubmit}
          className="ml-auto px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Post Poll
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Main ChatTab Component
// ============================================================================

const ChatTab: React.FC<ChatTabProps> = ({ eventId, onCreateEvent }) => {
  const {
    event, currentProfile, messages, profilesById,
    send, toggleReaction, deleteMessage, votePoll,
    createPoll, shareJoinCode,
    isTyping, reportTyping,
    replyTo, setReplyTo,
    muted, toggleMute,
  } = useEventChatAdapter(eventId);

  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [activeReactionId, setActiveReactionId] = useState<string | null>(null);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [doubleTapPopId, setDoubleTapPopId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { keyboardHeight, handleFocus, handleBlur } = useKeyboardHandler();

  // Double-tap tracking: map of messageId -> last tap timestamp
  const lastTapRef = useRef<Map<string, number>>(new Map());
  const singleTapTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Double-tap = instant 👍, single tap = open reaction picker
  const handleBubbleTap = useCallback((messageId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current.get(messageId) || 0;
    const elapsed = now - lastTap;
    lastTapRef.current.set(messageId, now);

    // Clear any pending single-tap timer for this message
    const pendingTimer = singleTapTimerRef.current.get(messageId);
    if (pendingTimer) clearTimeout(pendingTimer);

    if (elapsed < DOUBLE_TAP_DELAY) {
      // Double tap! Instant 👍 reaction with pop animation
      toggleReaction(messageId, '👍');
      setActiveReactionId(null);
      setDoubleTapPopId(messageId);
      setTimeout(() => setDoubleTapPopId(null), 700);
    } else {
      // Wait to see if another tap follows before opening picker
      const timer = setTimeout(() => {
        setActiveReactionId(prev => prev === messageId ? null : messageId);
        singleTapTimerRef.current.delete(messageId);
      }, DOUBLE_TAP_DELAY);
      singleTapTimerRef.current.set(messageId, timer);
    }
  }, [toggleReaction]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      singleTapTimerRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // Filter out deleted messages
  const visibleMessages = useMemo(
    () => messages.filter(m => !m.isDeleted),
    [messages]
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  // Close reaction picker on outside tap
  useEffect(() => {
    if (!activeReactionId) return;
    const close = () => setActiveReactionId(null);
    const t = setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); };
  }, [activeReactionId]);

  // "Group chat only" mode
  if (!event) {
    return (
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200/80 p-6 text-center space-y-3">
        <div className="text-4xl">💬</div>
        <div className="font-bold text-gray-900">No messages yet</div>
        <p className="text-sm text-gray-500">Start chatting with your group!</p>
        {onCreateEvent && (
          <button onClick={onCreateEvent} className="mt-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold text-sm">
            + Create Event
          </button>
        )}
      </div>
    );
  }

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await send(trimmed, replyTo ? { replyTo: replyTo.id } : undefined);
    setText('');
    setReplyTo(null);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    reportTyping();
  };

  const handlePollSubmit = (question: string, options: string[]) => {
    createPoll(question, options);
    setShowPollCreator(false);
  };

  const hasShareCode = Boolean(event.shareCode);

  // Find the message being replied to
  const getReplyPreview = (replyToId: string): { name: string; text: string } | null => {
    const msg = visibleMessages.find(m => m.id === replyToId);
    if (!msg) return null;
    const sender = msg.profileId ? profilesById.get(msg.profileId) : undefined;
    const name = sender?.name || msg.senderName || 'Unknown';
    return { name, text: msg.text.slice(0, 80) };
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 bg-slate-50 dark:bg-slate-900 rounded-t-xl overflow-hidden -mx-4"
      style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
    >
      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1 scroll-smooth"
      >
        {/* Empty state */}
        {visibleMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-5xl mb-3">⛳</div>
            <div className="font-bold text-gray-700 dark:text-gray-300 text-base mb-1">The fairway is clear</div>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[250px]">
              Drop a message, share a join code, or start a tee time poll.
            </p>
          </div>
        )}

        {visibleMessages.map((m, idx) => {
          const sender = m.profileId ? profilesById.get(m.profileId) : undefined;
          const senderDisplayName = sender?.name || m.senderName || 'Unknown';
          const senderAvatar = sender?.avatar;
          const mine = m.profileId === currentProfile?.id;
          const isBot = m.profileId === 'gimmies-bot';
          const isPoll = m.type === 'poll';
          const isInvite = m.type === 'invite';
          const showAvatar = shouldShowAvatar(visibleMessages, idx);
          const showName = shouldShowName(visibleMessages, idx);
          const replyPreview = m.replyTo ? getReplyPreview(m.replyTo) : null;
          const isReactionTarget = activeReactionId === m.id;

          // System / Bot messages
          if (isBot) {
            return (
              <div key={m.id} className="flex justify-center my-2">
                <div className="max-w-[90%] rounded-xl px-3.5 py-2.5 shadow-sm border text-[13px] leading-snug bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-xs">🎯 Gimmies</span>
                    <span className="text-[10px] text-amber-500">{timeAgo(m.createdAt)}</span>
                  </div>
                  <div className="whitespace-pre-wrap break-words font-medium">{m.text}</div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className={`relative group ${mine ? 'flex flex-col items-end' : 'flex flex-col items-start'} ${showName ? 'mt-3' : 'mt-0.5'}`}
            >
              {/* Reply preview */}
              {replyPreview && (
                <div className={`flex items-center gap-1.5 text-[11px] mb-0.5 max-w-[75%] ${mine ? 'mr-10' : 'ml-10'}`}>
                  <div className="w-0.5 h-4 bg-primary-400 rounded-full flex-shrink-0" />
                  <span className="text-primary-600 dark:text-primary-400 font-semibold truncate">{replyPreview.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 truncate">{replyPreview.text}</span>
                </div>
              )}

              <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''} max-w-[85%]`}>
                {/* Avatar */}
                <div className="w-7 flex-shrink-0">
                  {showAvatar && !mine && (
                    senderAvatar ? (
                      <img src={senderAvatar} alt={senderDisplayName} className="w-7 h-7 rounded-full object-cover shadow-sm" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {senderDisplayName.charAt(0).toUpperCase()}
                      </span>
                    )
                  )}
                  {showAvatar && mine && (
                    currentProfile?.avatar ? (
                      <img src={currentProfile.avatar} alt="" className="w-7 h-7 rounded-full object-cover shadow-sm" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                        {senderDisplayName.charAt(0).toUpperCase()}
                      </span>
                    )
                  )}
                </div>

                {/* Message bubble */}
                <div className="relative">
                  {/* Reaction picker */}
                  {isReactionTarget && (
                    <ReactionPicker
                      onSelect={(emoji) => toggleReaction(m.id, emoji)}
                      onClose={() => setActiveReactionId(null)}
                    />
                  )}

                  {/* Name */}
                  {!mine && showName && (
                    <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5 ml-1">
                      {senderDisplayName}
                    </div>
                  )}

                  {/* Double-tap pop animation */}
                  {doubleTapPopId === m.id && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <span className="text-3xl animate-reaction-pop">👍</span>
                    </div>
                  )}

                  {/* Bubble content — double-tap for 👍, single tap for reaction picker */}
                  <div
                    onClick={() => handleBubbleTap(m.id)}
                    className={`rounded-2xl px-3 py-2 text-[13px] leading-snug cursor-pointer select-none transition-colors ${
                      mine
                        ? 'bg-primary-600 text-white rounded-br-md active:bg-primary-700'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-bl-md active:bg-gray-50 dark:active:bg-slate-700'
                    }`}
                  >
                    {/* Poll card */}
                    {isPoll && (
                      <div onClick={e => e.stopPropagation()}>
                        <PollCard message={m} currentProfileId={currentProfile?.id} onVote={(optId) => votePoll(m.id, optId)} />
                      </div>
                    )}

                    {/* Invite card */}
                    {isInvite && (
                      <div onClick={e => e.stopPropagation()}>
                        <InviteCard message={m} />
                      </div>
                    )}

                    {/* Regular text */}
                    {!isPoll && !isInvite && (
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    )}

                    <div className={`text-[10px] mt-1 ${mine ? 'text-primary-200' : 'text-gray-400 dark:text-gray-500'}`}>
                      {timeAgo(m.createdAt)}
                    </div>
                  </div>

                  {/* Reactions */}
                  <ReactionBadges
                    reactions={m.reactions || {}}
                    currentProfileId={currentProfile?.id}
                    onToggle={(emoji) => toggleReaction(m.id, emoji)}
                  />

                  {/* Quick actions on hover/tap (reply, delete) */}
                  <div className={`absolute top-0 ${mine ? 'right-full mr-1' : 'left-full ml-1'} hidden group-hover:flex gap-0.5`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyTo(m); inputRef.current?.focus(); }}
                      className="p-1 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-gray-200 dark:border-slate-600 text-gray-500 hover:text-primary-600 transition-colors"
                      title="Reply"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    {mine && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm('Delete this message?')) deleteMessage(m.id); }}
                        className="p-1 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-gray-200 dark:border-slate-600 text-gray-500 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 ml-9 mt-2">
            <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Poll Creator */}
      {showPollCreator && (
        <PollCreator
          onSubmit={handlePollSubmit}
          onCancel={() => setShowPollCreator(false)}
        />
      )}

      {/* Reply Preview Bar */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/30 border-t border-primary-200 dark:border-primary-800">
          <div className="w-1 h-8 bg-primary-500 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-primary-700 dark:text-primary-400">
              Replying to {profilesById.get(replyTo.profileId)?.name || replyTo.senderName || 'Unknown'}
            </div>
            <div className="text-[12px] text-gray-600 dark:text-gray-400 truncate">{replyTo.text}</div>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
        {/* Quick Actions Row */}
        <div className="flex items-center justify-between px-2 pt-1.5">
          <div className="flex gap-1">
            {/* Toggle quick actions */}
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className={`p-1.5 rounded-full transition-colors ${showQuickActions ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Mute notifications toggle - bell icon */}
            <button
              onClick={() => {
                if (muted) toggleMute('unmute');
                else setShowMuteMenu(!showMuteMenu);
              }}
              className={`p-1.5 rounded-full transition-colors ${muted ? 'text-red-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              title={muted ? 'Unmute notifications' : 'Mute notifications'}
            >
              {muted ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4l16 16" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
            </button>
            {text.length > 1500 && (
              <span className={`text-[10px] font-medium ${text.length > 1900 ? 'text-red-500' : 'text-gray-400'}`}>
                {text.length}/2000
              </span>
            )}
          </div>
        </div>

        {/* Mute dropdown */}
        {showMuteMenu && (
          <div className="mx-3 mb-1 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
            {(['1h', '8h', '24h', 'forever'] as const).map(dur => (
              <button
                key={dur}
                onClick={() => { toggleMute(dur); setShowMuteMenu(false); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors border-b border-gray-100 dark:border-slate-600 last:border-0"
              >
                {dur === '1h' ? '🔕 Mute 1 hour' : dur === '8h' ? '🔕 Mute 8 hours' : dur === '24h' ? '🔕 Mute 24 hours' : '🔕 Mute forever'}
              </button>
            ))}
          </div>
        )}

        {/* Expandable quick actions */}
        {showQuickActions && (
          <QuickActions
            onShareCode={() => { shareJoinCode(); setShowQuickActions(false); }}
            onCreatePoll={() => { setShowPollCreator(true); setShowQuickActions(false); }}
            onShowEmoji={() => { setShowEmojiPicker(true); setShowQuickActions(false); setShowStickers(false); }}
            onShowStickers={() => { setShowStickers(true); setShowQuickActions(false); setShowEmojiPicker(false); }}
            hasShareCode={hasShareCode}
          />
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(emoji) => {
              setText(prev => prev + emoji);
              inputRef.current?.focus();
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {/* Golf Stickers */}
        {showStickers && (
          <GolfStickers
            onSend={(stickerText) => { send(stickerText); }}
            onClose={() => setShowStickers(false)}
          />
        )}

        {/* Text input + send */}
        <div className="flex items-end gap-2 px-3 pb-2 pt-1">
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKey}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={currentProfile ? 'Message...' : 'Create a profile to chat'}
            disabled={!currentProfile}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-slate-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50"
            style={{ minHeight: '40px', maxHeight: '100px' }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || !currentProfile}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:hover:bg-primary-600 text-white p-2.5 rounded-xl shadow-sm flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
