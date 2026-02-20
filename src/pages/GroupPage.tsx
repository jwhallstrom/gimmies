/**
 * GroupPage - Chat-first social hub for groups.
 *
 * Fundamentally different from EventPage:
 * - No swipeable tabs. Chat IS the room.
 * - Member avatar strip always visible.
 * - Pinned event card above chat for the next upcoming / live event.
 * - Group info panel (members, events, settings) behind the header tap.
 * - Same header gradient/height as EventPage for visual rhythm.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { STATUS_TIERS } from '../state/types';
import type { GolferProfile } from '../state/types';
import { useEventSync } from '../hooks/useEventSync';
import ChatTab from '../components/tabs/ChatTab';
import GroupInfoPanel from '../components/group/GroupInfoPanel';
import GroupAvatar from '../components/group/GroupAvatar';
import PlayerCardModal from '../components/PlayerCardModal';
import type { PlayerCardData } from '../components/PlayerCardModal';
import { CreateEventWizard } from '../components/CreateEventWizard';

// ============================================================================
// Helpers
// ============================================================================

const LAST_READ_KEY = 'gimmies.chatLastRead.v1';
function markChatAsRead(groupId: string) {
  try {
    const current = JSON.parse(localStorage.getItem(LAST_READ_KEY) || '{}');
    current[groupId] = new Date().toISOString();
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(current));
  } catch { /* ignore */ }
}

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const countStrokesEntered = (event: any): number =>
  (event.scorecards || []).reduce(
    (total: number, sc: any) =>
      total + ((sc.scores || []).filter((s: any) => s?.strokes != null).length || 0),
    0
  );

// ============================================================================
// MemberAvatarStrip (inline)
// ============================================================================

const MemberAvatarStrip: React.FC<{
  golfers: any[];
  profiles: any[];
  currentProfileId?: string;
  ownerProfileId: string;
  onMemberTap: (memberId: string) => void;
  onOverflowTap: () => void;
}> = ({ golfers, profiles, currentProfileId, ownerProfileId, onMemberTap, onOverflowTap }) => {
  const MAX_VISIBLE = 12;
  const members = useMemo(() => {
    return golfers.map((eg: any) => {
      const profile = eg.profileId ? profiles.find((p: any) => p.id === eg.profileId) : null;
      return {
        id: eg.profileId || eg.customName,
        name: profile?.name || eg.displayName || eg.customName || '?',
        avatar: profile?.avatar,
        isOwner: eg.profileId === ownerProfileId,
        isCurrent: eg.profileId === currentProfileId,
      };
    });
  }, [golfers, profiles, currentProfileId, ownerProfileId]);

  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - MAX_VISIBLE;

  return (
    <div className="flex-shrink-0 bg-primary-900/40 border-b border-white/5">
      <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <style>{`.member-strip::-webkit-scrollbar { display: none; }`}</style>
        {visible.map((m) => (
          <button
            key={m.id}
            onClick={() => onMemberTap(m.id)}
            className="flex flex-col items-center gap-0.5 flex-shrink-0 group"
            title={m.name}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold overflow-hidden ring-2 ${
              m.isCurrent
                ? 'ring-green-400'
                : m.isOwner
                  ? 'ring-purple-400'
                  : 'ring-white/20'
            }`}>
              {m.avatar ? (
                <img src={m.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-500 to-slate-700 text-white flex items-center justify-center">
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-[9px] text-primary-200 font-medium truncate w-10 text-center leading-tight">
              {m.isCurrent ? 'You' : m.name.split(' ')[0]}
            </span>
          </button>
        ))}
        {overflow > 0 && (
          <button
            onClick={onOverflowTap}
            className="flex flex-col items-center gap-0.5 flex-shrink-0"
          >
            <div className="w-9 h-9 rounded-full bg-white/10 text-white/70 text-[11px] font-bold flex items-center justify-center ring-2 ring-white/10">
              +{overflow}
            </div>
            <span className="text-[9px] text-primary-300 font-medium">more</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// PinnedEventCard (inline)
// ============================================================================

const PinnedEventCard: React.FC<{
  event: any;
  isJoined: boolean;
  onOpen: () => void;
  onJoin: () => void;
  joining: boolean;
}> = ({ event, isJoined, onOpen, onJoin, joining }) => {
  const hasScores = countStrokesEntered(event) > 0;
  const playerCount = event.golfers?.length || 0;

  return (
    <div className="flex-shrink-0 px-3 py-2">
      <button
        onClick={onOpen}
        className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all active:scale-[0.99] ${
          hasScores
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm'
        }`}
      >
        {hasScores && <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />}
        {!hasScores && <span className="text-base flex-shrink-0">⛳</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 dark:text-white text-sm truncate">{event.name}</span>
            {hasScores && (
              <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-red-500 text-white rounded-full">LIVE</span>
            )}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDateShort(event.date)} · {playerCount} player{playerCount !== 1 ? 's' : ''}
          </div>
        </div>
        {!isJoined && (
          <button
            onClick={(e) => { e.stopPropagation(); onJoin(); }}
            disabled={joining}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-[11px] font-bold rounded-lg disabled:opacity-50 flex-shrink-0"
          >
            {joining ? '...' : 'Join'}
          </button>
        )}
        <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">Open →</span>
      </button>
    </div>
  );
};

// ============================================================================
// GroupPage
// ============================================================================

const GroupPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEventSync(id, 15000);

  const event = useStore((s) =>
    s.events.find((e) => e.id === id) ||
    s.completedEvents.find((e) => e.id === id)
  );
  const { currentProfile, profiles, joinEventByCode, generateShareCode, addToast } = useStore();

  // Mark group chat as read whenever the page is visible
  useEffect(() => {
    if (id) markChatAsRead(id);
  }, [id]);

  if (!event) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">Group not found</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-xl font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(currentProfile && event.ownerProfileId === currentProfile.id);
  const groupSettings = event.groupSettings || {
    visibility: 'private' as const,
    joinPolicy: 'open' as const,
    membersCanInvite: true,
    description: '',
    location: '',
  };
  const memberCount = event.golfers.length;

  // Build player card data for selected member
  const selectedPlayerCard: PlayerCardData | null = useMemo(() => {
    if (!selectedPlayerId) return null;
    const golfer = event.golfers.find((g: any) => (g.profileId || g.customName) === selectedPlayerId);
    if (!golfer) return null;
    const profile: GolferProfile | undefined = golfer.profileId
      ? profiles.find((p: GolferProfile) => p.id === golfer.profileId)
      : undefined;
    const verifiedStatus = profile?.verifiedStatus;
    const statusTier = verifiedStatus ? STATUS_TIERS[verifiedStatus.statusLevel] || STATUS_TIERS[0] : STATUS_TIERS[0];
    return {
      id: selectedPlayerId,
      name: profile?.name || golfer.displayName || golfer.customName || 'Unknown',
      avatar: profile?.avatar,
      hasProfile: !!golfer.profileId,
      profileId: golfer.profileId,
      handicap: profile?.handicapIndex,
      roundsPlayed: (profile?.individualRounds || []).length,
      homeCourse: profile?.preferences?.homeCourseName,
      statusTier,
      verifiedStatus: verifiedStatus ? {
        statusLevel: verifiedStatus.statusLevel,
        verifiedRounds: verifiedStatus.verifiedRounds,
        badges: verifiedStatus.badges,
      } : undefined,
    };
  }, [selectedPlayerId, event.golfers, profiles]);

  const handleMemberTap = useCallback((memberId: string) => {
    setSelectedPlayerId(memberId);
  }, []);

  // Child events — pick the best one to pin
  const activeChildEvents = useStore((s) => {
    const allEvents = [...(s.events || []), ...(s.completedEvents || [])];
    return allEvents
      .filter((e: any) => e.hubType !== 'group' && e.parentGroupId === id && !e.isCompleted)
      .sort((a: any, b: any) => {
        const aLive = countStrokesEntered(a) > 0;
        const bLive = countStrokesEntered(b) > 0;
        if (aLive !== bLive) return aLive ? -1 : 1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  });

  const pinnedEvent = activeChildEvents[0] || null;
  const isPinnedJoined = pinnedEvent && currentProfile
    ? pinnedEvent.golfers?.some((g: any) => g.profileId === currentProfile.id)
    : false;

  const handleJoinPinned = async () => {
    if (!pinnedEvent || joiningEventId) return;
    setJoiningEventId(pinnedEvent.id);
    try {
      const code = pinnedEvent.shareCode || (await generateShareCode(pinnedEvent.id));
      if (!code) throw new Error('Missing join code');
      const result = await joinEventByCode(code);
      if (!result.success) throw new Error(result.error || 'Failed to join');
      addToast('Joined event!', 'success');
      navigate(`/event/${pinnedEvent.id}`);
    } catch (e: any) {
      addToast(e?.message || 'Could not join event', 'error');
    } finally {
      setJoiningEventId(null);
    }
  };

  return (
    <div className="h-full min-h-0 -mx-4 -mt-4 flex flex-col">

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-3 py-2.5 shadow-lg sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Back */}
          <button
            onClick={() => navigate('/')}
            className="flex-shrink-0 p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Back to Home"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Group Avatar */}
          <button onClick={() => setShowInfoPanel(true)} className="flex-shrink-0">
            <GroupAvatar
              avatar={groupSettings.avatar}
              name={event.name}
              size="sm"
              className="ring-2 ring-white/20"
            />
          </button>

          {/* Name + Description (tap to open info) */}
          <button
            onClick={() => setShowInfoPanel(true)}
            className="flex-1 min-w-0 text-left"
          >
            <h1 className="text-sm font-bold text-white truncate leading-tight">{event.name}</h1>
            {groupSettings.description ? (
              <p className="text-[10px] text-primary-200 truncate leading-tight">{groupSettings.description}</p>
            ) : (
              <p className="text-[10px] text-primary-300 leading-tight">
                {memberCount} member{memberCount !== 1 ? 's' : ''}
                {activeChildEvents.length > 0 && ` · ${activeChildEvents.length} event${activeChildEvents.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </button>

          {/* Info / Settings */}
          <button
            onClick={() => setShowInfoPanel(true)}
            className="flex-shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Group info"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ===== MEMBER AVATAR STRIP ===== */}
      <MemberAvatarStrip
        golfers={event.golfers}
        profiles={profiles}
        currentProfileId={currentProfile?.id}
        ownerProfileId={event.ownerProfileId}
        onMemberTap={handleMemberTap}
        onOverflowTap={() => setShowInfoPanel(true)}
      />

      {/* ===== PINNED EVENT CARD ===== */}
      {pinnedEvent && (
        <PinnedEventCard
          event={pinnedEvent}
          isJoined={!!isPinnedJoined}
          onOpen={() => navigate(`/event/${pinnedEvent.id}`)}
          onJoin={handleJoinPinned}
          joining={joiningEventId === pinnedEvent.id}
        />
      )}

      {/* ===== EMPTY-STATE CTA (no upcoming events) ===== */}
      {!pinnedEvent && (
        <div className="flex-shrink-0 px-3 py-2">
          <button
            onClick={() => setShowCreateEvent(true)}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10 hover:bg-primary-100 dark:hover:bg-primary-900/20 transition-colors active:scale-[0.99]"
          >
            <span className="text-xl">📅</span>
            <div className="flex-1 text-left">
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">Schedule an event</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Get the crew on the course</p>
            </div>
            <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      )}

      {/* ===== CHAT (fills remaining space) ===== */}
      <div className="flex-1 min-h-0">
        <ChatTab
          eventId={event.id}
          isActive={true}
          hidePinnedBanners={true}
          noFooterPadding={true}
          onCreateEvent={() => setShowCreateEvent(true)}
        />
      </div>

      {/* ===== GROUP INFO PANEL ===== */}
      {showInfoPanel && (
        <GroupInfoPanel
          event={event}
          onClose={() => setShowInfoPanel(false)}
          onCreateEvent={() => { setShowInfoPanel(false); setShowCreateEvent(true); }}
        />
      )}

      {/* ===== CREATE EVENT WIZARD ===== */}
      <CreateEventWizard
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        parentGroupId={id}
        onCreated={(eventId) => {
          setShowCreateEvent(false);
          navigate(`/event/${eventId}`);
        }}
      />

      {/* ===== PLAYER CARD MODAL ===== */}
      {selectedPlayerCard && (
        <PlayerCardModal
          player={selectedPlayerCard}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
};

export default GroupPage;
