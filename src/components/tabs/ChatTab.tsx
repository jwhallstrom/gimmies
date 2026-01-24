import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventChatAdapter, useEventGroupsAdapter } from '../../adapters';
import useStore from '../../state/store';

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

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const ChatTab: React.FC<ChatTabProps> = ({ eventId, onCreateEvent }) => {
  const navigate = useNavigate();
  const { event, currentProfile, messages, profilesById, send, clear } = useEventChatAdapter(eventId);
  const { groups, setGroupTeeTime } = useEventGroupsAdapter(eventId);
  const [text, setText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const group = groups[0];
  const teeTimeLabel = group?.teeTime ? group.teeTime : 'Not set';

  const inviteSummary = useMemo(() => {
    if (!event) return '';
    const when = event.date ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
    const tee = event.course?.teeName ? ` • ${event.course.teeName}` : '';
    return `${event.name || 'Event'} • ${when}${tee}`;
  }, [event?.id, event?.name, event?.date, event?.course?.teeName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // "Group chat only" mode: no event loaded (e.g. group exists but no event yet).
  if (!event) {
    return (
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200/80 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors flex-shrink-0"
            title="Back"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded uppercase tracking-wider inline-block">
              Group chat only
            </div>
            <div className="font-black text-gray-900 text-sm mt-1">No event yet</div>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          This group doesn’t have an event attached yet. Create one to unlock golfers, games, scorecard, and payouts.
        </div>

        <button
          onClick={() => {
            if (onCreateEvent) onCreateEvent();
            else navigate('/events?create=true&returnTo=chat');
          }}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-extrabold shadow-sm"
        >
          + Create event
        </button>
      </div>
    );
  }

  const isGroupHub = event.hubType === 'group';
  const childEvent = useStore((s) => {
    const candidates = (s.events || [])
      .filter((e: any) => e.hubType !== 'group' && e.parentGroupId === eventId && !e.isCompleted)
      .sort((a: any, b: any) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    return candidates[0] || null;
  });
  const joinEventByCode = useStore((s) => s.joinEventByCode);
  const generateShareCode = useStore((s) => s.generateShareCode);
  const addToast = useStore((s) => s.addToast);

  const hasAnyGames =
    ((event.games?.nassau?.length ?? 0) +
      (event.games?.skins?.length ?? 0) +
      (event.games?.pinky?.length ?? 0) +
      (event.games?.greenie?.length ?? 0)) > 0;

  const isOwner = Boolean(currentProfile && event.ownerProfileId === currentProfile.id);

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
    <div className="flex flex-col h-[calc(100dvh-250px)] max-h-[560px] bg-white/90 backdrop-blur rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors flex-shrink-0"
            title="Back to Home"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isGroupHub ? (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Group
                </span>
              ) : (
                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  Event
                </span>
              )}
              <h2 className="font-black text-gray-900 text-sm truncate">{event?.name || (isGroupHub ? 'Group' : 'Event')}</h2>
            </div>
            <div className="text-[11px] text-gray-500">
              {event?.golfers?.length || 0} {isGroupHub ? 'members' : 'players'}
            </div>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
            title="Options"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          
          {showOptions && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                <button
                  onClick={() => {
                    setShowOptions(false);
                    navigate(`/event/${eventId}/settings`);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <span>⚙️</span> Event Settings
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setShowOptions(false);
                      if (window.confirm('Clear all chat messages?')) {
                        clear();
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <span>🗑️</span> Clear Chat
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Members list - Always show */}
      <div className="px-3 pt-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">Members</div>
            <div className="text-xs text-gray-500">
              {event?.golfers?.length || 0} {isGroupHub ? 'members' : 'players'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {event?.golfers?.map((g, idx) => {
              const profile = g.profileId ? profilesById.get(g.profileId) : undefined;
              const displayName = g.displayName || g.customName || profile?.name || 'Player';
              const avatar = profile?.avatar;
              const isAdmin = (g.profileId && g.profileId === event.ownerProfileId) || idx === 0;
              const isGuest = Boolean(g.customName && !g.profileId);
              
              return (
                <div
                  key={g.profileId || g.customName || idx}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs shadow-sm"
                >
                  {avatar ? (
                    <img src={avatar} alt={displayName} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="font-semibold text-gray-700">{displayName}</span>
                  {isGuest && <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">Guest</span>}
                  {isAdmin && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Admin</span>}
                </div>
              );
            }) || (
              <div className="text-xs text-gray-400">No members yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Next steps (admin-first, low friction) */}
      {isOwner && !isGroupHub && (
        <div className="px-3 pt-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase mb-2">Next steps</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate(`/event/${eventId}/golfers`)}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-lg text-xs font-extrabold"
              >
                + Add golfers (guests allowed)
              </button>
              <button
                onClick={() => navigate(`/event/${eventId}/games`)}
                className="w-full bg-white hover:bg-slate-50 text-primary-800 px-3 py-2 rounded-lg text-xs font-extrabold border border-primary-200"
              >
                Set up games
              </button>
              {!hasAnyGames && (
                <div className="text-xs text-slate-500">
                  Tip: once games are added, payouts + leaderboard unlock.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group hub: Create event first, then show "Next event" join card */}
      {isGroupHub && !childEvent && (
        <div className="px-3 pt-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">Group</div>
            <div className="font-extrabold text-slate-900">No event yet</div>
            <div className="text-xs text-slate-600 mt-1">
              Create an event when you’re ready. Then everyone can join from here.
            </div>
            <button
              onClick={() => navigate(`/events?create=true&returnTo=group&groupId=${encodeURIComponent(eventId)}`)}
              className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-extrabold shadow-sm"
            >
              + Create event
            </button>
          </div>
        </div>
      )}

      {isGroupHub && childEvent && (
        <div className="px-3 pt-2">
          <div className="rounded-xl border border-primary-900/10 bg-gradient-to-r from-primary-900 to-primary-800 text-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-widest text-white/70 font-semibold">Next event</div>
                <div className="font-extrabold text-white truncate">{childEvent.name || 'Event'}</div>
                <div className="text-xs text-white/80 mt-0.5">
                  {childEvent.date ? formatDateShort(childEvent.date) : ''}{childEvent.course?.teeName ? ` • ${childEvent.course.teeName}` : ''}
                </div>
              </div>
              <button
                onClick={() => navigate(`/event/${childEvent.id}`)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/20 border border-white/10"
                title="Open event"
              >
                Open
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const alreadyIn = Boolean(currentProfile && childEvent.golfers?.some((g: any) => g.profileId === currentProfile.id));
                    if (alreadyIn) {
                      navigate(`/event/${childEvent.id}`);
                      return;
                    }
                    const code = childEvent.shareCode || (await generateShareCode(childEvent.id));
                    if (!code) throw new Error('Missing join code');
                    const result = await joinEventByCode(code);
                    if (!result.success) throw new Error(result.error || 'Failed to join');
                    addToast('Joined event', 'success');
                    navigate(`/event/${childEvent.id}`);
                  } catch (e: any) {
                    addToast(e?.message || 'Could not join event', 'error');
                  }
                }}
                className="flex-1 bg-white text-primary-900 hover:bg-white/90 px-3 py-2 rounded-lg text-xs font-extrabold"
              >
                Join event
              </button>
              <button
                onClick={async () => {
                  const time = window.prompt('Set tee time (HH:MM)', group?.teeTime || '');
                  if (!group) return;
                  if (time == null) return;
                  const trimmed = time.trim();
                  if (!trimmed) return;
                  setGroupTeeTime(group.id, trimmed);
                }}
                className="flex-1 bg-white/10 hover:bg-white/15 px-3 py-2 rounded-lg text-xs font-extrabold border border-white/10"
              >
                Tee time
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-[13px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-xs mt-8">No messages yet. Start the conversation!</div>
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
                <div className="max-w-[85%] rounded-xl px-3 py-2 shadow-sm border text-[12px] leading-snug bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-900">
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
                  <img src={senderAvatar} alt={senderDisplayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0 shadow-sm" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {senderDisplayName.charAt(0).toUpperCase()}
                  </span>
                )
              )}
              
              <div className={`max-w-[70%] rounded-2xl px-3 py-2 shadow-sm text-[12px] leading-snug ${mine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-gray-900 rounded-bl-md'}`}>
                {!mine && (
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-primary-700 text-[11px]">{senderDisplayName}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                <div className={`text-[10px] mt-1 ${mine ? 'text-primary-200' : 'text-gray-400'}`}>{timeAgo(m.createdAt)}</div>
              </div>
              
              {/* Avatar for self (right side) */}
              {mine && (
                currentProfile?.avatar ? (
                  <img src={currentProfile.avatar} alt={senderDisplayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0 shadow-sm" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
                    {senderDisplayName.charAt(0).toUpperCase()}
                  </span>
                )
              )}
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
