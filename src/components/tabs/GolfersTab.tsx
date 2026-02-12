/**
 * GolfersTab - Redesigned with Tournament-quality UX
 * 
 * Key improvements:
 * - Clean card-based golfer list
 * - Better visual hierarchy
 * - Inline preference editing (events only)
 * - Big add button with clear flow
 * - Mobile-first design
 * - Supports both Groups (members) and Events (golfers)
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';
import { useCourse } from '../../hooks/useCourse';
import { STATUS_TIERS } from '../../state/types';
import StatusLevelsInfo from '../verified/StatusLevelsInfo';
import { useKeyboardHandler } from '../../hooks/useKeyboardHandler';

type Props = { eventId: string; isTabActive?: boolean };
type AddModalTab = 'invite' | 'manual';

const GolfersTab: React.FC<Props> = ({ eventId, isTabActive = true }) => {
  const navigate = useNavigate();
  const event = useStore((s: any) =>
    s.events.find((e: any) => e.id === eventId) ||
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const { currentProfile, profiles, addGolferToEvent, updateEventGolfer, removeGolferFromEvent, generateShareCode, addToast } = useStore();
  const { course: selectedCourse } = useCourse(event?.course?.courseId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<AddModalTab>('invite');
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [golferName, setGolferName] = useState('');
  const [customTeeName, setCustomTeeName] = useState('');
  const [customHandicap, setCustomHandicap] = useState('');
  const [guestGamePreference, setGuestGamePreference] = useState<'all' | 'nassau' | 'skins' | 'none'>('all');
  const [editingGolferId, setEditingGolferId] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showStatusLevels, setShowStatusLevels] = useState(false);
  const { handleFocus, handleBlur } = useKeyboardHandler();

  if (!event) return null;

  const isGroupHub = event.hubType === 'group';
  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;
  const courseSelected = !!event.course?.courseId;
  const teeSelected = !!event.course?.teeName;
  const teesForCourse = selectedCourse?.tees || [];
  
  // Groups can always add members, Events need course/tee setup
  const canAddGolfer = isGroupHub ? golferName.trim() : (courseSelected && teeSelected && golferName.trim());

  // Build golfer display data
  const golferData = useMemo(() => {
    return event.golfers.map((eg: any) => {
      const golferId = eg.profileId || eg.customName || eg.displayName;
      const profile = eg.profileId ? profiles.find((p: any) => p.id === eg.profileId) : null;
      const name = profile?.name || eg.displayName || eg.customName || 'Unknown';
      const handicap = eg.handicapOverride ?? eg.handicapSnapshot ?? profile?.handicapIndex;
      const teeName = eg.teeName || event.course.teeName;
      const gamePreference = eg.gamePreference || 'all';
      const isCurrentUser = currentProfile?.id === eg.profileId;
      
      // Extended profile data for player card
      const verifiedStatus = profile?.verifiedStatus;
      const statusTier = verifiedStatus ? STATUS_TIERS[verifiedStatus.statusLevel] || STATUS_TIERS[0] : STATUS_TIERS[0];
      const individualRounds = profile?.individualRounds || [];
      const homeCourse = profile?.preferences?.homeCourseName;
      
      return {
        id: golferId,
        name,
        handicap,
        teeName,
        gamePreference,
        isCurrentUser,
        isOwnerProfile: eg.profileId === event.ownerProfileId,
        hasProfile: !!eg.profileId,
        avatar: profile?.avatar,
        // Extended data
        profile,
        verifiedStatus,
        statusTier,
        roundsPlayed: individualRounds.length,
        homeCourse,
      };
    });
  }, [event.golfers, profiles, currentProfile?.id, event.ownerProfileId]);
  
  // Get selected player data for the modal
  const selectedPlayer = selectedPlayerId ? golferData.find((g: any) => g.id === selectedPlayerId) : null;

  const handleAddGolfer = async () => {
    if (!canAddGolfer || event.isCompleted) return;
    
    const name = golferName.trim();
    
    if (isGroupHub) {
      // Groups: just add member by name, no tee/handicap/game preference needed
      await addGolferToEvent(eventId, name, undefined, null);
    } else {
      // Events: include tee, handicap, and game preference
      const teeName = customTeeName || undefined;
      const handicapOverride = customHandicap ? parseFloat(customHandicap) : null;
      await addGolferToEvent(eventId, name, teeName, handicapOverride);
      await updateEventGolfer(eventId, name, { gamePreference: guestGamePreference } as any);
    }

    setGolferName('');
    setCustomTeeName('');
    setCustomHandicap('');
    setGuestGamePreference('all');
    setShowAddModal(false);
  };

  // Determine if a golfer has active game participation (in any game config)
  const golferHasActiveGames = (golferId: string) => {
    const games = event.games || {};
    const allGameArrays = [
      ...(games.nassau || []),
      ...(games.skins || []),
      ...(games.pinky || []),
      ...(games.greenie || []),
      ...(games.stableford || []),
      ...(games.ninePoint || []),
      ...(games.bingoBangoBongo || []),
      ...(games.wolf || []),
      ...(games.dots || []),
    ];
    return allGameArrays.some((g: any) =>
      g.participantGolferIds?.includes(golferId) ||
      (g.teams || []).some((t: any) => t.golferIds?.includes(golferId))
    );
  };

  const isEventStarted = event.status === 'started' || event.scorecards?.some((sc: any) => sc.scores?.some((s: any) => s.strokes != null));
  const isEventCompleted = event.isCompleted;

  // Rules for removing/leaving:
  // 1. Completed events: no one leaves (historical record)
  // 2. Not started: anyone can leave freely; admin can remove anyone
  // 3. Started + no active games: user can leave freely; admin can remove
  // 4. Started + active games: only admin can remove (user sees "ask admin")
  const canUserLeaveSelf = () => {
    if (isEventCompleted) return { allowed: false, reason: 'Event is completed — records are locked.' };
    if (!isEventStarted) return { allowed: true, reason: '' };
    const myId = currentProfile?.id;
    if (myId && golferHasActiveGames(myId)) {
      return { allowed: false, reason: 'You have active games. Ask the admin to remove you.' };
    }
    return { allowed: true, reason: '' };
  };

  const canAdminRemove = (golferId: string) => {
    if (isEventCompleted) return { allowed: false, reason: 'Event is completed — records are locked.' };
    return { allowed: true, reason: '' };
  };

  const handleRemoveGolfer = (golferId: string, name: string) => {
    const check = canAdminRemove(golferId);
    if (!check.allowed) {
      addToast(check.reason, 'error');
      return;
    }

    let confirmMsg = isGroupHub
      ? `Remove ${name} from this group?`
      : `Remove ${name} from this event?`;

    if (isEventStarted && golferHasActiveGames(golferId)) {
      confirmMsg += '\n\nThis player has active games — their scores and game data will be removed.';
    }

    if (window.confirm(confirmMsg)) {
      removeGolferFromEvent(eventId, golferId);
      addToast(`${name} removed`, 'success');
    }
  };

  const handleLeave = () => {
    if (!currentProfile) return;

    if (isGroupHub) {
      if (window.confirm(`Leave "${event.name || 'this group'}"? You can rejoin later if the group is open.`)) {
        navigate('/', { replace: true });
        removeGolferFromEvent(eventId, currentProfile.id);
        addToast('You left the group', 'success');
      }
      return;
    }

    const check = canUserLeaveSelf();
    if (!check.allowed) {
      addToast(check.reason, 'error');
      return;
    }

    let msg = `Leave "${event.name || 'this event'}"?`;
    if (isEventStarted) {
      msg += '\n\nThe event has started — your scores will be removed.';
    }

    if (window.confirm(msg)) {
      navigate('/', { replace: true });
      removeGolferFromEvent(eventId, currentProfile.id);
      addToast('You left the event', 'success');
    }
  };

  const handleUpdatePreference = (golferId: string, preference: 'all' | 'nassau' | 'skins' | 'none') => {
    updateEventGolfer(eventId, golferId, { gamePreference: preference } as any);
    setEditingGolferId(null);
  };

  // Generate share URL for invites
  const shareUrl = event.shareCode ? `${window.location.origin}/join/${event.shareCode}` : '';
  
  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    try {
      await generateShareCode(eventId);
      addToast('Invite link created!', 'success');
    } catch (e) {
      addToast('Could not create invite link', 'error');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Craft compelling invite messages
  const isPublicEvent = !!event.isPublic;

  const getInviteMessage = () => {
    const groupName = event.name || 'our golf group';
    const senderName = currentProfile?.name || 'A friend';
    
    if (isGroupHub) {
      return {
        title: `Join ${groupName} on Gimmies Golf`,
        text: `Hey! ${senderName} invited you to join "${groupName}" on Gimmies Golf 🏌️

Gimmies is a free app to:
⛳ Track scores & handicap
💰 Manage Nassau, skins & side bets
👥 Chat with your golf crew
📊 See live leaderboards

Join here: ${shareUrl}

Or use code: ${event.shareCode}`,
        shortText: `${senderName} invited you to "${groupName}" on Gimmies Golf! Join: ${shareUrl}`
      };
    } else if (isPublicEvent) {
      // Public event: just share the link, no code emphasis
      return {
        title: `Join ${event.name || 'my golf event'}`,
        text: `Hey! ${senderName} invited you to "${event.name}" on Gimmies Golf ⛳

Tap the link to join — no code needed!

Join: ${shareUrl}`,
        shortText: `Join my golf event "${event.name}": ${shareUrl}`
      };
    } else {
      // Private event: include the code
      return {
        title: `Join ${event.name || 'my golf event'}`,
        text: `Hey! Join me for golf - "${event.name}"

Track scores, run games, and see the leaderboard live.

Join: ${shareUrl}
Code: ${event.shareCode}`,
        shortText: `Join my golf event "${event.name}": ${shareUrl}`
      };
    }
  };

  const handleTextInvite = async () => {
    if (!event.shareCode) {
      await handleGenerateCode();
    }
    const msg = getInviteMessage();
    const smsUrl = `sms:?body=${encodeURIComponent(msg.text)}`;
    window.open(smsUrl, '_self');
  };

  const handleShareInvite = async () => {
    if (!event.shareCode) {
      await handleGenerateCode();
    }
    const msg = getInviteMessage();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: msg.title,
          text: msg.shortText,
          url: shareUrl,
        });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(msg.text);
      addToast('Invite copied to clipboard!', 'success');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    addToast('Link copied!', 'success');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(event.shareCode || '');
    addToast('Code copied!', 'success');
  };

  const preferenceLabels = {
    all: { label: 'All Games', color: 'bg-green-100 text-green-700 border-green-200' },
    nassau: { label: 'Nassau Only', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    skins: { label: 'Skins Only', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    none: { label: 'No Games', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  return (
    <div className="space-y-4">
      {/* Completed Banner - Events only */}
      {!isGroupHub && event.isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <div className="text-2xl">✓</div>
          <div>
            <div className="font-semibold text-green-800">Event Completed</div>
            <div className="text-sm text-green-600">Golfer list is locked</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{isGroupHub ? 'Members' : 'Golfers'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {golferData.length} {isGroupHub ? 'member' : 'player'}{golferData.length !== 1 ? 's' : ''} in this {isGroupHub ? 'group' : 'event'}
          </p>
        </div>
        
        {/* Groups keep an inline add button (no FAB for groups) */}
        {isGroupHub && !event.isCompleted && (
          <button
            onClick={() => { setAddModalTab('invite'); setShowAddModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-purple-600 text-white hover:bg-purple-700 shadow-md shadow-purple-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Member
          </button>
        )}
      </div>

      {/* Setup hint removed - course selection happens naturally in flow */}

      {/* Golfer/Member List */}
      {golferData.length === 0 ? (
        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <div className="font-semibold text-gray-700 dark:text-gray-200 mb-1">
            {isGroupHub ? 'No members yet' : 'No golfers yet'}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isGroupHub ? 'Add members to your group' : 'Add golfers to start the event'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {golferData.map((golfer: any) => (
            <div
              key={golfer.id}
              className={`bg-white dark:bg-slate-800 rounded-xl border p-4 ${
                golfer.isCurrentUser ? 'border-primary-300 bg-primary-50/30 dark:bg-primary-900/20' : 'border-gray-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar - Clickable to open player card */}
                <button
                  onClick={() => setSelectedPlayerId(golfer.id)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-transform hover:scale-105 ${
                    golfer.avatar 
                      ? '' 
                      : golfer.hasProfile 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {golfer.avatar ? (
                    <img src={golfer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    golfer.name.charAt(0).toUpperCase()
                  )}
                </button>
                
                {/* Info - Clickable to open player card */}
                <button 
                  onClick={() => setSelectedPlayerId(golfer.id)}
                  className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white truncate">{golfer.name}</span>
                    {/* Status badge */}
                    {golfer.hasProfile && golfer.statusTier && (
                      <span className="text-sm" title={golfer.statusTier.name}>
                        {golfer.statusTier.emoji}
                      </span>
                    )}
                    {golfer.isOwnerProfile && (
                      <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded">
                        {isGroupHub ? 'ADMIN' : 'HOST'}
                      </span>
                    )}
                    {golfer.isCurrentUser && !golfer.isOwnerProfile && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  {/* Show handicap/tee only for events */}
                  {!isGroupHub && (
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {golfer.handicap != null && (
                        <span>HCP: {typeof golfer.handicap === 'number' ? golfer.handicap.toFixed(1) : golfer.handicap}</span>
                      )}
                      {golfer.teeName && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{golfer.teeName}</span>
                      )}
                    </div>
                  )}
                </button>
                
                {/* Game Preference - Events only */}
                {!isGroupHub && !event.isCompleted && (
                  <div className="relative">
                    {editingGolferId === golfer.id ? (
                      <div className="flex gap-1">
                        {(['all', 'nassau', 'skins', 'none'] as const).map(pref => (
                          <button
                            key={pref}
                            onClick={() => handleUpdatePreference(golfer.id, pref)}
                            className={`px-2 py-1 text-xs rounded-lg font-medium border ${
                              preferenceLabels[pref].color
                            }`}
                          >
                            {pref === 'all' ? '🎯' : pref === 'nassau' ? '🏆' : pref === 'skins' ? '💰' : '📊'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingGolferId(golfer.id)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium border ${
                          preferenceLabels[golfer.gamePreference as keyof typeof preferenceLabels]?.color || preferenceLabels.all.color
                        }`}
                      >
                        {preferenceLabels[golfer.gamePreference as keyof typeof preferenceLabels]?.label || 'All Games'}
                      </button>
                    )}
                  </div>
                )}
                
                {/* Remove Button (owner only, not self, not completed) */}
                {isOwner && !golfer.isCurrentUser && !isEventCompleted && (
                  <button
                    onClick={() => handleRemoveGolfer(golfer.id, golfer.name)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title={`Remove ${golfer.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leave Event / Group */}
      {currentProfile && !isOwner && (() => {
        const isMember = event.golfers.some((g: any) => g.profileId === currentProfile.id);
        if (!isMember) return null;

        if (isGroupHub) {
          // Groups: always allow leaving
          return (
            <div className="mt-6 border-t border-gray-200 dark:border-slate-700 pt-4">
              <button
                onClick={handleLeave}
                className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Leave Group
              </button>
            </div>
          );
        }

        // Events: conditional leave
        const check = canUserLeaveSelf();
        return (
          <div className="mt-6 border-t border-gray-200 dark:border-slate-700 pt-4">
            <button
              onClick={handleLeave}
              disabled={!check.allowed}
              className={`w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                check.allowed
                  ? 'bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Leave Event
            </button>
            {!check.allowed && check.reason && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">{check.reason}</p>
            )}
          </div>
        );
      })()}

      {/* Add Golfer/Member Modal */}
      {showAddModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-4 py-4 flex items-center justify-between flex-shrink-0 ${
              addModalTab === 'invite'
                ? isGroupHub ? 'bg-purple-600' : 'bg-primary-700'
                : 'bg-amber-500'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{addModalTab === 'invite' ? (isGroupHub ? '👥' : '📲') : '👤'}</span>
                <h3 className="text-lg font-bold text-white">
                  {addModalTab === 'invite'
                    ? isGroupHub ? 'Invite to Group' : 'Invite a Golfer'
                    : isGroupHub ? 'Add Member' : 'Add a Guest'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              {/* INVITE TAB - Works for both groups AND events */}
              {addModalTab === 'invite' && (
                <div className="p-5 space-y-5">
                  {/* Hero section */}
                  <div className="text-center py-2">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                      isGroupHub ? 'bg-purple-100' : 'bg-primary-100'
                    }`}>
                      <span className="text-3xl">{isPublicEvent && !isGroupHub ? '🔗' : '📲'}</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">
                      {isGroupHub 
                        ? 'Invite friends to join' 
                        : isPublicEvent 
                          ? 'Share this event' 
                          : 'Invite golfers to play'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {isGroupHub 
                        ? 'Send a link — they tap it and join your group'
                        : isPublicEvent
                          ? 'Anyone with the link can join — no code needed'
                          : 'Send a link or code — they tap it and join your game'}
                    </p>
                  </div>

                  {/* Share Buttons - Big & grandma-friendly */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleTextInvite}
                      disabled={isGeneratingCode}
                      className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl border-2 border-green-200 transition-colors disabled:opacity-60"
                    >
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <span className="text-sm font-bold text-green-700">Send Text</span>
                      <span className="text-[10px] text-green-600">iMessage / SMS</span>
                    </button>
                    
                    <button
                      onClick={handleShareInvite}
                      disabled={isGeneratingCode}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors disabled:opacity-60 ${
                        isGroupHub 
                          ? 'bg-purple-50 hover:bg-purple-100 border-purple-200' 
                          : 'bg-primary-50 hover:bg-primary-100 border-primary-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow ${
                        isGroupHub ? 'bg-purple-500' : 'bg-primary-600'
                      }`}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </div>
                      <span className={`text-sm font-bold ${isGroupHub ? 'text-purple-700' : 'text-primary-700'}`}>Share Link</span>
                      <span className={`text-[10px] ${isGroupHub ? 'text-purple-600' : 'text-primary-600'}`}>Any app or chat</span>
                    </button>
                  </div>

                  {/* Or divider + code — only for private events and groups */}
                  {event.shareCode && (!isPublicEvent || isGroupHub) && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Or share code</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      <div className="space-y-3">
                        <button
                          onClick={handleCopyCode}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors group"
                        >
                          <span className={`text-2xl font-mono font-black tracking-[0.15em] text-gray-800 ${
                            isGroupHub ? 'group-hover:text-purple-600' : 'group-hover:text-primary-600'
                          }`}>
                            {event.shareCode}
                          </span>
                          <span className="block text-[10px] text-gray-400 mt-1">Tap to copy</span>
                        </button>
                        
                        <button
                          onClick={handleCopyLink}
                          className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-100 transition-colors group"
                        >
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span className="text-sm text-gray-500 font-mono truncate flex-1 text-left">{shareUrl}</span>
                          <span className="text-xs text-gray-400 font-semibold flex-shrink-0">Copy</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* What they'll see */}
                  <div className={`border rounded-xl p-4 ${
                    isGroupHub 
                      ? 'bg-gradient-to-br from-purple-50 to-white border-purple-100' 
                      : 'bg-gradient-to-br from-primary-50 to-white border-primary-100'
                  }`}>
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                      isGroupHub ? 'text-purple-700' : 'text-primary-700'
                    }`}>How it works for them</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>1. They get a link via text or share</p>
                      <p>2. They tap the link</p>
                      <p>3. They're in your {isGroupHub ? 'group' : 'game'} — done!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* MANUAL TAB */}
              {addModalTab === 'manual' && (
                <div className="p-4 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {isGroupHub ? 'Member Name *' : 'Golfer Name *'}
                    </label>
                    <input
                      type="text"
                      value={golferName}
                      onChange={e => setGolferName(e.target.value)}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="Enter name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      autoFocus={!isGroupHub || addModalTab === 'manual'}
                    />
                  </div>
                  
                  {/* Tee Selection - Events only */}
                  {!isGroupHub && teesForCourse.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tee (optional override)
                      </label>
                      <select
                        value={customTeeName}
                        onChange={e => setCustomTeeName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="">Use event default ({event.course?.teeName})</option>
                        {teesForCourse.map((tee: any) => (
                          <option key={tee.name} value={tee.name}>{tee.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* Handicap - Events only */}
                  {!isGroupHub && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Handicap Index (optional)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={customHandicap}
                        onChange={e => setCustomHandicap(e.target.value)}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="e.g., 15.2"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  )}
                  
                  {/* Game Preference - Events only */}
                  {!isGroupHub && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Game Participation
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['all', 'nassau', 'skins', 'none'] as const).map(pref => (
                          <button
                            key={pref}
                            type="button"
                            onClick={() => setGuestGamePreference(pref)}
                            className={`py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                              guestGamePreference === pref
                                ? 'border-primary-600 bg-primary-50 text-primary-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {pref === 'all' ? '🎯 All' : pref === 'nassau' ? '🏆 Nassau' : pref === 'skins' ? '💰 Skins' : '📊 None'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add button in content for manual tab */}
                  <button
                    onClick={handleAddGolfer}
                    disabled={!golferName.trim()}
                    className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
                      golferName.trim()
                        ? isGroupHub 
                          ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
                          : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isGroupHub ? 'Add Member' : 'Add Guest'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========== PLAYER CARD MODAL ========== */}
      {selectedPlayer && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedPlayerId(null)}
        >
          <div 
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header with gradient */}
            <div className={`px-6 pt-6 pb-8 text-center relative ${selectedPlayer.statusTier?.badgeColor || 'bg-gray-500'}`}>
              {/* Close button */}
              <button
                onClick={() => setSelectedPlayerId(null)}
                className="absolute top-3 right-3 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Avatar */}
              <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold text-white border-4 border-white/30 mb-3">
                {selectedPlayer.avatar ? (
                  <img src={selectedPlayer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  selectedPlayer.name.charAt(0).toUpperCase()
                )}
              </div>
              
              {/* Name & Status */}
              <h3 className="text-xl font-bold text-white">{selectedPlayer.name}</h3>
              {selectedPlayer.hasProfile && selectedPlayer.statusTier && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg">{selectedPlayer.statusTier.emoji}</span>
                  <span className="text-white/90 text-sm font-medium">{selectedPlayer.statusTier.name}</span>
                </div>
              )}
            </div>
            
            {/* Stats Grid */}
            <div className="px-6 py-4">
              {selectedPlayer.hasProfile ? (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center bg-slate-50 rounded-xl py-3">
                      <div className="text-xl font-black text-gray-900">
                        {selectedPlayer.handicap != null ? selectedPlayer.handicap.toFixed(1) : '—'}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium uppercase">Handicap</div>
                    </div>
                    <div className="text-center bg-slate-50 rounded-xl py-3">
                      <div className="text-xl font-black text-gray-900">
                        {selectedPlayer.roundsPlayed || 0}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium uppercase">Rounds</div>
                    </div>
                    <div className="text-center bg-slate-50 rounded-xl py-3">
                      <div className="text-xl font-black text-gray-900">
                        {selectedPlayer.verifiedStatus?.verifiedRounds || 0}
                      </div>
                      <div className="text-[10px] text-gray-500 font-medium uppercase">Verified</div>
                    </div>
                  </div>
                  
                  {/* Home Course */}
                  {selectedPlayer.homeCourse && (
                    <div className="bg-slate-50 rounded-xl px-4 py-3 mb-4">
                      <div className="text-[10px] text-gray-500 font-medium uppercase mb-1">Home Course</div>
                      <div className="font-semibold text-gray-900">{selectedPlayer.homeCourse}</div>
                    </div>
                  )}
                  
                  {/* Status Progress */}
                  {selectedPlayer.statusTier && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600 uppercase">Status Progress</span>
                        <span className="text-xs text-gray-500">
                          {selectedPlayer.verifiedStatus?.verifiedRounds || 0} / {selectedPlayer.statusTier.maxRounds || '∞'} rounds
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${selectedPlayer.statusTier.badgeColor}`}
                          style={{ 
                            width: `${Math.min(100, ((selectedPlayer.verifiedStatus?.verifiedRounds || 0) / (selectedPlayer.statusTier.maxRounds || 100)) * 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{selectedPlayer.statusTier.description}</p>
                      
                      {/* How Status Works Link */}
                      <button
                        onClick={() => setShowStatusLevels(true)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        How do status levels work?
                      </button>
                    </div>
                  )}
                  
                  {/* Badges */}
                  {selectedPlayer.verifiedStatus?.badges && selectedPlayer.verifiedStatus.badges.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-gray-600 uppercase mb-2">Badges</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedPlayer.verifiedStatus.badges.map((badge: string) => (
                          <span key={badge} className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                            🏅 {badge.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">👤</div>
                  <div className="font-medium text-gray-700">Guest Player</div>
                  <p className="text-sm text-gray-500 mt-1">
                    This player hasn't created a Gimmies profile yet
                  </p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setSelectedPlayerId(null)}
                className="w-full py-3 bg-slate-100 text-gray-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Status Levels Info Modal */}
      {showStatusLevels && (
        <StatusLevelsInfo 
          onClose={() => setShowStatusLevels(false)}
          currentLevel={selectedPlayer?.verifiedStatus?.statusLevel || currentProfile?.verifiedStatus?.statusLevel || 0}
        />
      )}

      {/* ========== FAB + Action Sheet (Events only, Members tab only) ========== */}
      {!event.isCompleted && !isGroupHub && isTabActive && (
        <>
          {/* FAB Button - matches app-wide standard (w-16 h-16 + fab-position) */}
          <button
            onClick={() => setShowFabMenu(true)}
            className="fixed right-4 z-40 w-16 h-16 bg-gradient-to-br from-accent to-orange-600 rounded-full shadow-lg shadow-accent/40 flex items-center justify-center text-white text-3xl font-bold hover:scale-105 active:scale-95 transition-transform fab-position"
            aria-label="Add player"
          >
            <span className={`transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`}>+</span>
          </button>

          {/* Bottom-up Action Sheet */}
          {showFabMenu && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
              onClick={() => setShowFabMenu(false)}
            >
              <div
                className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl animate-slide-up pb-safe"
                onClick={e => e.stopPropagation()}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>

                <div className="px-5 pb-6 space-y-3">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white text-center mb-4">
                    {isGroupHub ? 'Add to Group' : 'Add to Event'}
                  </h3>

                  {/* Option 1: Invite a Golfer */}
                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      setAddModalTab('invite');
                      setShowAddModal(true);
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 border-2 border-primary-200 dark:border-primary-800 rounded-xl transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 shadow-md">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-gray-900 dark:text-white text-sm">
                        {isGroupHub ? 'Invite to Group' : 'Invite a Golfer'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Send a link or code — they join with the app
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Option 2: Add a Guest */}
                  <button
                    onClick={() => {
                      setShowFabMenu(false);
                      setAddModalTab('manual');
                      setShowAddModal(true);
                    }}
                    disabled={!isGroupHub && (!courseSelected || !teeSelected)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors ${
                      isGroupHub || (courseSelected && teeSelected)
                        ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800'
                        : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
                      isGroupHub || (courseSelected && teeSelected)
                        ? 'bg-amber-500'
                        : 'bg-gray-400'
                    }`}>
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-gray-900 dark:text-white text-sm">
                        {isGroupHub ? 'Add Member by Name' : 'Add a Guest'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {isGroupHub
                          ? 'Add someone manually by name'
                          : (!courseSelected || !teeSelected)
                            ? 'Set up course & tee first'
                            : 'Playing but not on the app — add by name'}
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={() => setShowFabMenu(false)}
                    className="w-full py-3 text-gray-500 dark:text-gray-400 text-sm font-semibold hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
};

export default GolfersTab;
