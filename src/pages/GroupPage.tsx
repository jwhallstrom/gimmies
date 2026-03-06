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
import type { GolferProfile } from '../state/types';
import { useEventSync } from '../hooks/useEventSync';
import { getEffectiveVerifiedStatus, getStatusDisplay } from '../utils/verifiedStatus';
import ChatTab from '../components/tabs/ChatTab';
import GroupInfoPanel from '../components/group/GroupInfoPanel';
import GroupAvatar from '../components/group/GroupAvatar';
import { getCourseById } from '../data/cloudCourses';
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
// Helpers — relative time
// ============================================================================

const getRelativeTime = (iso: string): { label: string; urgency: 'live' | 'today' | 'soon' | 'future' } => {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return { label: 'Today', urgency: 'today' };
  if (diffDays === 1) return { label: 'Tomorrow', urgency: 'soon' };
  if (diffDays <= 7) return { label: `In ${diffDays} days`, urgency: 'future' };
  return { label: formatDateShort(iso), urgency: 'future' };
};

// ============================================================================
// MiniAvatarStack — overlapping player avatars
// ============================================================================

const MiniAvatarStack: React.FC<{
  golfers: any[];
  profiles: any[];
  max?: number;
}> = ({ golfers, profiles, max = 4 }) => {
  const visible = golfers.slice(0, max);
  const overflow = golfers.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((g: any, i: number) => {
        const profile = g.profileId ? profiles.find((p: any) => p.id === g.profileId) : null;
        return (
          <div
            key={g.profileId || g.customName || i}
            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 overflow-hidden flex-shrink-0"
            style={{ zIndex: max - i }}
          >
            {profile?.avatar ? (
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-400 to-slate-600 text-white text-[8px] font-bold flex items-center justify-center">
                {(profile?.name || g.displayName || g.customName || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 bg-gray-200 dark:bg-slate-600 text-[8px] font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0"
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EventsHub — replaces the old single PinnedEventCard
// ============================================================================

const EventsHub: React.FC<{
  activeEvents: any[];
  completedEvents: any[];
  profiles: any[];
  currentProfileId?: string;
  joiningId: string | null;
  onJoin: (evt: any) => void;
  onOpen: (eventId: string) => void;
  onSchedule: () => void;
}> = ({ activeEvents, completedEvents, profiles, currentProfileId, joiningId, onJoin, onOpen, onSchedule }) => {
  const [showRecent, setShowRecent] = useState(false);
  const recentCompleted = completedEvents.slice(0, 3);
  const hasAny = activeEvents.length > 0 || recentCompleted.length > 0;

  // Empty state — no events ever
  if (!hasAny) {
    return (
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="bg-gradient-to-br from-primary-50 to-green-50 dark:from-primary-900/20 dark:to-green-900/20 rounded-xl border border-primary-200/60 dark:border-primary-800/40 p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">📅</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">No tee times yet</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Groups come alive when you schedule rounds together. Pick a course, set a date, and the crew gets notified.
              </p>
            </div>
          </div>
          <button
            onClick={onSchedule}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-colors active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Schedule First Event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0">
      {/* Upcoming events */}
      {activeEvents.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          {/* Section header */}
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Upcoming Events
            </h3>
            <button
              onClick={onSchedule}
              className="flex items-center gap-1 text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Schedule
            </button>
          </div>

          {/* Event cards — horizontal scroll if multiple */}
          <div className={activeEvents.length > 1 ? 'flex gap-2.5 overflow-x-auto pb-1' : ''} style={activeEvents.length > 1 ? { scrollbarWidth: 'none' } : undefined}>
            {activeEvents.map((evt: any) => {
              const hasScores = countStrokesEntered(evt) > 0;
              const playerCount = evt.golfers?.length || 0;
              const isJoined = evt.golfers?.some((g: any) => g.profileId === currentProfileId);
              const courseName = evt.course?.courseId ? getCourseById(evt.course.courseId)?.name : null;
              const { label: timeLabel, urgency } = hasScores
                ? { label: 'Live Now', urgency: 'live' as const }
                : getRelativeTime(evt.date);

              return (
                <button
                  key={evt.id}
                  onClick={() => onOpen(evt.id)}
                  className={`${activeEvents.length > 1 ? 'min-w-[260px] flex-shrink-0' : 'w-full'} text-left rounded-xl border transition-all active:scale-[0.98] overflow-hidden ${
                    urgency === 'live'
                      ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/60'
                      : urgency === 'today'
                        ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800/60'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  {/* Time badge strip */}
                  <div className={`px-3.5 py-1.5 flex items-center justify-between ${
                    urgency === 'live'
                      ? 'bg-red-500/10 dark:bg-red-500/10'
                      : urgency === 'today'
                        ? 'bg-green-500/10 dark:bg-green-500/10'
                        : 'bg-gray-50 dark:bg-slate-700/50'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {urgency === 'live' && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                      {urgency === 'today' && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide ${
                        urgency === 'live' ? 'text-red-600 dark:text-red-400'
                          : urgency === 'today' ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {timeLabel}
                      </span>
                    </div>
                    {!isJoined && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onJoin(evt); }}
                        disabled={joiningId === evt.id}
                        className="px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white text-[10px] font-bold rounded-md disabled:opacity-50 transition-colors"
                      >
                        {joiningId === evt.id ? '...' : 'Join'}
                      </button>
                    )}
                    {isJoined && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-bold rounded-md">
                        JOINED
                      </span>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900 dark:text-white text-sm truncate">{evt.name}</span>
                    </div>
                    {courseName && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mb-2">
                        ⛳ {courseName}
                      </p>
                    )}
                    {!courseName && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                        {formatDateShort(evt.date)}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <MiniAvatarStack golfers={evt.golfers || []} profiles={profiles} />
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {playerCount} player{playerCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming is empty but completed exist — show schedule CTA */}
      {activeEvents.length === 0 && recentCompleted.length > 0 && (
        <div className="px-3 pt-2 pb-1">
          <button
            onClick={onSchedule}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10 hover:bg-primary-100 dark:hover:bg-primary-900/20 transition-colors active:scale-[0.99]"
          >
            <span className="text-base">📅</span>
            <div className="flex-1 text-left">
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">Schedule next round</span>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Keep the momentum going</p>
            </div>
            <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>
      )}

      {/* Recent Rounds — collapsible */}
      {recentCompleted.length > 0 && (
        <div className="px-3 pt-1 pb-1">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="w-full flex items-center justify-between py-1"
          >
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Recent Rounds ({recentCompleted.length})
            </h3>
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showRecent ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showRecent && (
            <div className="space-y-1 mt-1">
              {recentCompleted.map((evt: any) => {
                const courseName = evt.course?.courseId ? getCourseById(evt.course.courseId)?.name : null;
                const playerCount = evt.golfers?.length || 0;
                return (
                  <button
                    key={evt.id}
                    onClick={() => onOpen(evt.id)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="text-sm flex-shrink-0">🏁</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate block">{evt.name}</span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {courseName || formatDateShort(evt.date)} · {playerCount} player{playerCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <svg className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
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

  useEventSync(id);

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
    const verifiedStatus = getEffectiveVerifiedStatus(profile);
    const statusTier = getStatusDisplay(profile).tier;
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
      verifiedStatus: {
        statusLevel: verifiedStatus.statusLevel,
        verifiedRounds: verifiedStatus.verifiedRounds,
        badges: verifiedStatus.badges,
      },
    };
  }, [selectedPlayerId, event.golfers, profiles]);

  const handleMemberTap = useCallback((memberId: string) => {
    setSelectedPlayerId(memberId);
  }, []);

  // Active child events (live first, then soonest)
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

  // Completed child events (most recent first)
  const completedChildEvents = useStore((s) => {
    const allEvents = [...(s.events || []), ...(s.completedEvents || [])];
    return allEvents
      .filter((e: any) => e.hubType !== 'group' && e.parentGroupId === id && e.isCompleted)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  const handleJoinEvent = async (evt: any) => {
    if (!evt || joiningEventId) return;
    setJoiningEventId(evt.id);
    try {
      const code = evt.shareCode || (await generateShareCode(evt.id));
      if (!code) throw new Error('Missing join code');
      const result = await joinEventByCode(code);
      if (!result.success) throw new Error(result.error || 'Failed to join');
      addToast('Joined event!', 'success');
      navigate(`/event/${evt.id}`);
    } catch (e: any) {
      addToast(e?.message || 'Could not join event', 'error');
    } finally {
      setJoiningEventId(null);
    }
  };

  return (
    <div className="h-full min-h-0 -mx-4 flex flex-col">

      {/* ===== HEADER ===== */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-3 py-2.5 pt-safe shadow-lg sticky top-0 z-30 flex-shrink-0">
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

      {/* ===== EVENTS HUB ===== */}
      <EventsHub
        activeEvents={activeChildEvents}
        completedEvents={completedChildEvents}
        profiles={profiles}
        currentProfileId={currentProfile?.id}
        joiningId={joiningEventId}
        onJoin={handleJoinEvent}
        onOpen={(eventId) => navigate(`/event/${eventId}`)}
        onSchedule={() => setShowCreateEvent(true)}
      />

      {/* ===== CHAT (fills remaining space) ===== */}
      <div className="flex-1 min-h-0">
        <ChatTab
          eventId={event.id}
          isActive={true}
          hidePinnedBanners={true}
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
