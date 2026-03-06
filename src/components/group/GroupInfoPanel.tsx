import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import type { Event, GolferProfile } from '../../state/types';
import { STATUS_TIERS } from '../../state/types';
import { getCourseById } from '../../data/cloudCourses';
import GroupAvatar from './GroupAvatar';
import PlayerCardModal from '../PlayerCardModal';
import type { PlayerCardData } from '../PlayerCardModal';

// ============================================================================
// Avatar presets
// ============================================================================

const AVATAR_PRESETS = [
  '⛳', '🏌️', '🏆', '🍺', '🦅', '🐦', '🎯', '🔥',
  '👑', '☠️', '🎲', '💰', '🌴', '⚡', '🤝', '🦈',
];

// ============================================================================
// Helpers
// ============================================================================

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const countStrokesEntered = (event: any): number =>
  (event.scorecards || []).reduce(
    (total: number, sc: any) =>
      total + ((sc.scores || []).filter((s: any) => s?.strokes != null).length || 0),
    0
  );

// ============================================================================
// Props
// ============================================================================

interface GroupInfoPanelProps {
  event: Event;
  onClose: () => void;
  onCreateEvent: () => void;
}

// ============================================================================
// GroupInfoPanel
// ============================================================================

const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({ event, onClose, onCreateEvent }) => {
  const navigate = useNavigate();
  const {
    currentProfile,
    profiles,
    updateEvent,
    removeGolferFromEvent,
    generateShareCode,
    joinEventByCode,
    deleteEvent,
    addToast,
  } = useStore();

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState(event.name);
  const [descValue, setDescValue] = useState(event.groupSettings?.description || '');
  const [showHistory, setShowHistory] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const isOwner = Boolean(currentProfile && event.ownerProfileId === currentProfile.id);
  const groupSettings = event.groupSettings || {
    visibility: 'private' as const,
    joinPolicy: 'open' as const,
    membersCanInvite: true,
    description: '',
    location: '',
  };

  // Build member data
  const members = useMemo(() => {
    return event.golfers.map((eg: any) => {
      const profile = eg.profileId ? profiles.find((p: GolferProfile) => p.id === eg.profileId) : null;
      return {
        id: eg.profileId || eg.customName || eg.displayName,
        name: profile?.name || eg.displayName || eg.customName || 'Unknown',
        avatar: profile?.avatar,
        hasProfile: !!eg.profileId,
        isOwner: eg.profileId === event.ownerProfileId,
        isCurrentUser: currentProfile?.id === eg.profileId,
        statusTier: profile?.verifiedStatus ? STATUS_TIERS[profile.verifiedStatus.statusLevel] : STATUS_TIERS[0],
      };
    });
  }, [event.golfers, profiles, currentProfile?.id, event.ownerProfileId]);

  // Build player card data for selected member
  const selectedPlayerCard: PlayerCardData | null = useMemo(() => {
    if (!selectedMemberId) return null;
    const golfer = event.golfers.find((g: any) => (g.profileId || g.customName || g.displayName) === selectedMemberId);
    if (!golfer) return null;
    const profile: GolferProfile | undefined = golfer.profileId
      ? profiles.find((p: GolferProfile) => p.id === golfer.profileId)
      : undefined;
    const verifiedStatus = profile?.verifiedStatus;
    const statusTier = verifiedStatus ? STATUS_TIERS[verifiedStatus.statusLevel] || STATUS_TIERS[0] : STATUS_TIERS[0];
    return {
      id: selectedMemberId,
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
  }, [selectedMemberId, event.golfers, profiles]);

  // Child events
  const { activeEvents, completedEvents } = useStore((s) => {
    const allEvents = [...(s.events || []), ...(s.completedEvents || [])];
    const groupEvents = allEvents.filter(
      (e: any) => e.hubType !== 'group' && e.parentGroupId === event.id
    );
    const active = groupEvents
      .filter((e: any) => !e.isCompleted)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const completed = groupEvents
      .filter((e: any) => e.isCompleted)
      .sort((a: any, b: any) =>
        new Date(b.completedAt || b.lastModified).getTime() - new Date(a.completedAt || a.lastModified).getTime()
      );
    return { activeEvents: active, completedEvents: completed };
  });

  const updateGroupSettings = (updates: any) => {
    const nextGroupSettings = { ...groupSettings, ...updates };
    const nextPatch: any = { groupSettings: nextGroupSettings };
    if ('visibility' in updates) {
      nextPatch.isPublic = nextGroupSettings.visibility === 'public';
    }
    updateEvent(event.id, nextPatch);
  };

  const handleSaveName = () => {
    if (nameValue.trim()) updateEvent(event.id, { name: nameValue.trim() } as any);
    setEditingName(false);
  };

  const handleSaveDesc = () => {
    updateGroupSettings({ description: descValue.trim() });
    setEditingDesc(false);
  };

  const handleAvatarSelect = (emoji: string) => {
    updateGroupSettings({ avatar: emoji });
    setShowAvatarPicker(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      addToast('Image must be under 500KB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateGroupSettings({ avatar: reader.result as string });
      setShowAvatarPicker(false);
    };
    reader.readAsDataURL(file);
  };

  const handleShareInvite = async () => {
    let code = event.shareCode;
    if (!code) {
      code = await generateShareCode(event.id);
    }
    const url = `${window.location.origin}/join/${code}`;
    const text = `Join "${event.name}" on Gimmies Golf! ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${event.name}`, text, url });
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(text);
      addToast('Invite copied!', 'success');
    }
  };

  const handleRemoveMember = (memberId: string, name: string) => {
    if (window.confirm(`Remove ${name} from this group?`)) {
      removeGolferFromEvent(event.id, memberId);
      addToast(`${name} removed`, 'success');
    }
  };

  const handleLeave = () => {
    if (!currentProfile) return;
    if (window.confirm(`Leave "${event.name}"? You can rejoin later if the group is open.`)) {
      onClose();
      navigate('/', { replace: true });
      removeGolferFromEvent(event.id, currentProfile.id);
      addToast('You left the group', 'success');
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${event.name}"? This cannot be undone. All chat and event history will be lost.`)) {
      onClose();
      navigate('/', { replace: true });
      deleteEvent(event.id);
      addToast('Group deleted', 'success');
    }
  };

  const handleJoinEvent = async (evt: any) => {
    if (joiningId) return;
    setJoiningId(evt.id);
    try {
      const code = evt.shareCode || (await generateShareCode(evt.id));
      if (!code) throw new Error('Missing join code');
      const result = await joinEventByCode(code);
      if (!result.success) throw new Error(result.error || 'Failed to join');
      addToast('Joined event!', 'success');
      onClose();
      navigate(`/event/${evt.id}`);
    } catch (e: any) {
      addToast(e?.message || 'Could not join event', 'error');
    } finally {
      setJoiningId(null);
    }
  };

  const isInEvent = (evt: any) =>
    currentProfile && evt.golfers?.some((g: any) => g.profileId === currentProfile.id);

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-0" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 flex-1 flex flex-col bg-white dark:bg-slate-900 animate-slide-up overflow-hidden pt-safe">
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-5 pt-4 pb-6">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-semibold">Back</span>
            </button>
            <span className="text-sm font-bold text-white/60 uppercase tracking-wider">Group Info</span>
            <div className="w-14" />
          </div>

          {/* Large avatar + name + description */}
          <div className="text-center">
            <button
              onClick={() => isOwner && setShowAvatarPicker(true)}
              className={`mx-auto mb-3 ${isOwner ? 'hover:opacity-80 transition-opacity' : ''}`}
              disabled={!isOwner}
            >
              <GroupAvatar
                avatar={groupSettings.avatar}
                name={event.name}
                size="lg"
                className="border-4 border-white/20 shadow-lg"
              />
              {isOwner && (
                <div className="relative -mt-6 ml-12 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              )}
            </button>

            {editingName ? (
              <div className="flex items-center justify-center gap-2 mb-1">
                <input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="bg-white/10 text-white text-lg font-bold text-center rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-white/30 w-60"
                />
              </div>
            ) : (
              <button
                onClick={() => isOwner && setEditingName(true)}
                className="block mx-auto"
                disabled={!isOwner}
              >
                <h2 className="text-xl font-bold text-white">{event.name}</h2>
              </button>
            )}

            {editingDesc ? (
              <div className="flex items-center justify-center gap-2 mt-1">
                <input
                  autoFocus
                  value={descValue}
                  onChange={(e) => setDescValue(e.target.value)}
                  onBlur={handleSaveDesc}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveDesc()}
                  placeholder="Add a group tagline..."
                  className="bg-white/10 text-primary-200 text-sm text-center rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-white/30 placeholder:text-white/30 w-64"
                />
              </div>
            ) : (
              <button
                onClick={() => isOwner && setEditingDesc(true)}
                className="block mx-auto mt-0.5"
                disabled={!isOwner}
              >
                <p className="text-sm text-primary-200">
                  {groupSettings.description || (isOwner ? 'Tap to add a tagline...' : '')}
                </p>
              </button>
            )}

            <p className="text-xs text-primary-300 mt-2">
              {members.length} member{members.length !== 1 ? 's' : ''} · Created{' '}
              {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-safe">
          <div className="px-4 py-5 space-y-6">

            {/* ---- MEMBERS ---- */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Members ({members.length})
                </h3>
                <button
                  onClick={handleShareInvite}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Invite
                </button>
              </div>

              <div className="space-y-1">
                {members.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer active:bg-gray-100 dark:active:bg-slate-700"
                  >
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-sm font-bold flex items-center justify-center rounded-full">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{m.name}</span>
                        {m.hasProfile && m.statusTier && (
                          <span className="text-sm" title={m.statusTier.name}>{m.statusTier.emoji}</span>
                        )}
                        {m.isOwner && (
                          <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[9px] font-bold rounded">ADMIN</span>
                        )}
                        {m.isCurrentUser && !m.isOwner && (
                          <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-bold rounded">YOU</span>
                        )}
                      </div>
                    </div>
                    {isOwner && !m.isCurrentUser ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.id, m.name); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    ) : (
                      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ---- EVENTS ---- */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Events ({activeEvents.length + completedEvents.length})
                </h3>
                <button
                  onClick={() => { onClose(); onCreateEvent(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Schedule Event
                </button>
              </div>

              {activeEvents.length === 0 && completedEvents.length === 0 && (
                <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-6 text-center">
                  <div className="text-3xl mb-2">📅</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No events yet. Schedule one for the crew!</p>
                </div>
              )}

              {activeEvents.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {activeEvents.map((evt: any) => {
                    const hasScores = countStrokesEntered(evt) > 0;
                    const courseName = evt.course?.courseId ? getCourseById(evt.course.courseId)?.name : null;
                    const joined = isInEvent(evt);
                    return (
                      <button
                        key={evt.id}
                        onClick={() => { onClose(); navigate(`/event/${evt.id}`); }}
                        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                          hasScores
                            ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                            : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        {hasScores && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white text-sm truncate">{evt.name}</span>
                            {hasScores && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full">LIVE</span>
                            )}
                            {joined && !hasScores && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 rounded-full">JOINED</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatDateShort(evt.date)}
                            {courseName && <> · {courseName}</>}
                            {' · '}{evt.golfers?.length || 0} player{(evt.golfers?.length || 0) !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {!joined && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleJoinEvent(evt); }}
                            disabled={joiningId === evt.id}
                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 flex-shrink-0"
                          >
                            {joiningId === evt.id ? '...' : 'Join'}
                          </button>
                        )}
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}

              {completedEvents.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 transition-colors"
                  >
                    <span>📜 History ({completedEvents.length})</span>
                    <svg className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showHistory && (
                    <div className="mt-1.5 space-y-1">
                      {completedEvents.slice(0, 10).map((evt: any) => (
                        <button
                          key={evt.id}
                          onClick={() => { onClose(); navigate(`/event/${evt.id}`); }}
                          className="w-full text-left flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">{evt.name}</span>
                            <div className="text-[10px] text-gray-500">{formatDateShort(evt.date)} · {evt.golfers?.length || 0} players</div>
                          </div>
                          <span className="text-[9px] font-bold text-gray-500 bg-gray-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">DONE</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ---- SETTINGS (Owner only) ---- */}
            {isOwner && (
              <section>
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Settings</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                  {/* Share Code */}
                  {event.shareCode && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">Join Code</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{event.shareCode}</div>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(event.shareCode || ''); addToast('Code copied!', 'success'); }}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  )}

                  {/* Members can invite toggle */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Public discovery</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Let other signed-in users find this group in Join</div>
                    </div>
                    <button
                      onClick={() => updateGroupSettings({ visibility: groupSettings.visibility === 'public' ? 'private' : 'public' })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        groupSettings.visibility === 'public' ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        groupSettings.visibility === 'public' ? 'translate-x-5' : ''
                      }`} />
                    </button>
                  </div>

                  {/* Members can invite toggle */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">Members can share invites</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Let everyone invite friends</div>
                    </div>
                    <button
                      onClick={() => updateGroupSettings({ membersCanInvite: !groupSettings.membersCanInvite })}
                      className={`relative w-11 h-6 rounded-full transition-colors ${
                        groupSettings.membersCanInvite ? 'bg-purple-600' : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        groupSettings.membersCanInvite ? 'translate-x-5' : ''
                      }`} />
                    </button>
                  </div>

                  {/* Location */}
                  <div className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">Location</div>
                    <input
                      value={groupSettings.location || ''}
                      onChange={(e) => updateGroupSettings({ location: e.target.value })}
                      placeholder="e.g., Chicago, IL"
                      className="w-full bg-gray-50 dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ---- ACTIONS ---- */}
            <section className="space-y-2 pb-8">
              <button
                onClick={handleShareInvite}
                className="w-full py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 rounded-xl text-sm font-semibold hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Invite Link
              </button>

              {currentProfile && !isOwner && event.golfers.some((g: any) => g.profileId === currentProfile.id) && (
                <button
                  onClick={handleLeave}
                  className="w-full py-3 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Leave Group
                </button>
              )}

              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="w-full py-3 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Group
                </button>
              )}
            </section>
          </div>
        </div>

        {/* Player Card Modal */}
        {selectedPlayerCard && (
          <PlayerCardModal
            player={selectedPlayerCard}
            onClose={() => setSelectedMemberId(null)}
          />
        )}

        {/* Avatar Picker Modal */}
        {showAvatarPicker && (
          <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowAvatarPicker(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 bg-purple-600 flex items-center justify-between">
                <h3 className="text-white font-bold">Group Avatar</h3>
                <button onClick={() => setShowAvatarPicker(false)} className="text-white/80 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Choose an icon</div>
                  <div className="grid grid-cols-8 gap-1.5">
                    {AVATAR_PRESETS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleAvatarSelect(emoji)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 active:scale-95 transition-all border-2 ${
                          groupSettings.avatar === emoji
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-transparent'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                  <span className="text-[10px] text-gray-400 font-semibold uppercase">or</span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
                </div>
                <label className="block w-full py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 text-center cursor-pointer transition-colors">
                  📷 Upload Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
                {groupSettings.avatar && (
                  <button
                    onClick={() => { updateGroupSettings({ avatar: undefined }); setShowAvatarPicker(false); }}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    Remove avatar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default GroupInfoPanel;
