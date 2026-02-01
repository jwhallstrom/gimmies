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
import useStore from '../../state/store';
import { useCourse } from '../../hooks/useCourse';
import { STATUS_TIERS } from '../../state/types';
import StatusLevelsInfo from '../verified/StatusLevelsInfo';

type Props = { eventId: string };
type AddModalTab = 'invite' | 'manual';

const GolfersTab: React.FC<Props> = ({ eventId }) => {
  const event = useStore((s: any) =>
    s.events.find((e: any) => e.id === eventId) ||
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const { currentProfile, profiles, addGolferToEvent, updateEventGolfer, removeGolferFromEvent, generateShareCode, addToast } = useStore();
  const { course: selectedCourse } = useCourse(event?.course?.courseId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<AddModalTab>('invite');
  const [golferName, setGolferName] = useState('');
  const [customTeeName, setCustomTeeName] = useState('');
  const [customHandicap, setCustomHandicap] = useState('');
  const [guestGamePreference, setGuestGamePreference] = useState<'all' | 'nassau' | 'skins' | 'none'>('all');
  const [editingGolferId, setEditingGolferId] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showStatusLevels, setShowStatusLevels] = useState(false);

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

  const handleRemoveGolfer = (golferId: string, name: string) => {
    if (event.isCompleted) return;
    const confirmMsg = isGroupHub 
      ? `Remove ${name} from this group?` 
      : `Remove ${name} from this event?`;
    if (window.confirm(confirmMsg)) {
      removeGolferFromEvent(eventId, golferId);
    }
  };

  const handleLeaveEvent = (golferId: string) => {
    if (event.isCompleted) return;
    
    // Check if user has any scores entered
    const scorecard = event.scorecards?.find((sc: any) => sc.golferId === golferId);
    const hasScores = scorecard?.scores?.some((s: any) => s.strokes !== null);
    
    let confirmMsg = isGroupHub
      ? 'Are you sure you want to leave this group?'
      : 'Are you sure you want to leave this event?';
    
    if (hasScores) {
      confirmMsg = isGroupHub
        ? 'You have scores recorded in this group. Are you sure you want to leave? Your scores will be removed.'
        : 'You have scores recorded in this event. Are you sure you want to leave? Your scores will be removed.';
    }
    
    if (window.confirm(confirmMsg)) {
      removeGolferFromEvent(eventId, golferId);
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
    } else {
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
          <p className="text-sm text-gray-500 dark:text-gray-300">
            {golferData.length} {isGroupHub ? 'member' : 'player'}{golferData.length !== 1 ? 's' : ''} in this {isGroupHub ? 'group' : 'event'}
          </p>
        </div>
        
        {!event.isCompleted && (
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!isGroupHub && (!courseSelected || !teeSelected)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              isGroupHub || (courseSelected && teeSelected)
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-200'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {isGroupHub ? 'Add Member' : 'Add Golfer'}
          </button>
        )}
      </div>

      {/* Setup hint removed - course selection happens naturally in flow */}

      {/* Golfer/Member List */}
      {golferData.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <div className="font-semibold text-gray-700 mb-1">
            {isGroupHub ? 'No members yet' : 'No golfers yet'}
          </div>
          <p className="text-sm text-gray-500">
            {isGroupHub ? 'Add members to your group' : 'Add golfers to start the event'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {golferData.map((golfer: any) => (
            <div
              key={golfer.id}
              className={`bg-white rounded-xl border p-4 ${
                golfer.isCurrentUser ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200'
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
                    <span className="font-semibold text-gray-900 truncate">{golfer.name}</span>
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
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
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
                
                {/* Remove Button (owner only, not self) */}
                {isOwner && !golfer.isCurrentUser && !event.isCompleted && (
                  <button
                    onClick={() => handleRemoveGolfer(golfer.id, golfer.name)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {/* Leave Event Button (current user who is not owner) */}
                {golfer.isCurrentUser && !golfer.isOwnerProfile && !event.isCompleted && (
                  <button
                    onClick={() => handleLeaveEvent(golfer.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
                  >
                    Leave
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Game preferences legend removed - clutters UI */}

      {/* Add Golfer/Member Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-4 py-4 flex items-center justify-between flex-shrink-0 ${
              isGroupHub ? 'bg-purple-600' : 'bg-primary-700'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{isGroupHub ? '👥' : '⛳'}</span>
                <h3 className="text-lg font-bold text-white">
                  {isGroupHub ? 'Add Member' : 'Add Golfer'}
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

            {/* Tabs - Both groups and events get invite/manual */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              <button
                onClick={() => setAddModalTab('invite')}
                className={`flex-1 py-4 font-semibold transition-colors relative ${
                  isGroupHub ? 'text-sm' : 'text-2xl'
                } ${
                  addModalTab === 'invite' 
                    ? (isGroupHub ? 'text-purple-700' : 'text-primary-700') 
                    : 'text-gray-500'
                }`}
              >
                {isGroupHub ? '📲 Send Invite' : '📲'}
                {!isGroupHub && <span className="sr-only">Send Invite</span>}
                {addModalTab === 'invite' && (
                  <span className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full ${
                    isGroupHub ? 'bg-purple-600' : 'bg-primary-600'
                  }`} />
                )}
              </button>
              <button
                onClick={() => setAddModalTab('manual')}
                className={`flex-1 py-4 font-semibold transition-colors relative ${
                  isGroupHub ? 'text-sm' : 'text-2xl'
                } ${
                  addModalTab === 'manual' 
                    ? (isGroupHub ? 'text-purple-700' : 'text-primary-700') 
                    : 'text-gray-500'
                }`}
              >
                {isGroupHub ? '✏️ Add by Name' : '✏️'}
                {!isGroupHub && <span className="sr-only">Add by Name</span>}
                {addModalTab === 'manual' && (
                  <span className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full ${
                    isGroupHub ? 'bg-purple-600' : 'bg-primary-600'
                  }`} />
                )}
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              {/* INVITE TAB - Groups and Events */}
              {addModalTab === 'invite' && (
                <div className="p-5 space-y-5">
                  {/* Hero section */}
                  <div className="text-center py-2">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                      isGroupHub ? 'bg-purple-100' : 'bg-primary-100'
                    }`}>
                      <span className="text-3xl">📲</span>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">
                      {isGroupHub ? 'Invite friends to join' : 'Invite golfers to play'}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {isGroupHub 
                        ? "Send a link - they'll get the app and join your group"
                        : "Send a link - they'll get the app and join your event"
                      }
                    </p>
                  </div>

                  {/* Share Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleTextInvite}
                      disabled={isGeneratingCode}
                      className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl border border-green-200 transition-colors disabled:opacity-60"
                    >
                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <span className="text-sm font-bold text-green-700">Text Message</span>
                      <span className="text-[10px] text-green-600">Best for individuals</span>
                    </button>
                    
                    <button
                      onClick={handleShareInvite}
                      disabled={isGeneratingCode}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors disabled:opacity-60 ${
                        isGroupHub 
                          ? 'bg-purple-50 hover:bg-purple-100 border-purple-200'
                          : 'bg-primary-50 hover:bg-primary-100 border-primary-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        isGroupHub ? 'bg-purple-500' : 'bg-primary-500'
                      }`}>
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </div>
                      <span className={`text-sm font-bold ${isGroupHub ? 'text-purple-700' : 'text-primary-700'}`}>Share Link</span>
                      <span className={`text-[10px] ${isGroupHub ? 'text-purple-600' : 'text-primary-600'}`}>Any app or group chat</span>
                    </button>
                  </div>

                  {/* Or divider */}
                  {event.shareCode && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">OR SHARE MANUALLY</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>

                      {/* Code & Link */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Join Code</label>
                          <button
                            onClick={handleCopyCode}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors group"
                          >
                            <span className="text-2xl font-mono font-black tracking-[0.15em] text-gray-800 group-hover:text-purple-600">
                              {event.shareCode}
                            </span>
                            <span className="block text-[10px] text-gray-400 mt-1">Tap to copy</span>
                          </button>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Link</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={shareUrl}
                              readOnly
                              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600 font-mono truncate"
                            />
                            <button
                              onClick={handleCopyLink}
                              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* What they'll see */}
                  <div className={`bg-gradient-to-br to-white border rounded-xl p-4 ${
                    isGroupHub 
                      ? 'from-purple-50 border-purple-100'
                      : 'from-primary-50 border-primary-100'
                  }`}>
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                      isGroupHub ? 'text-purple-700' : 'text-primary-700'
                    }`}>What they'll receive</div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>📱 A link to download Gimmies (free)</p>
                      <p>🔗 Auto-join your {isGroupHub ? 'group' : 'event'} "{event.name}"</p>
                      {isGroupHub ? (
                        <p>💬 Access to group chat & events</p>
                      ) : (
                        <p>⛳ Ready to play when they arrive</p>
                      )}
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
                    {isGroupHub ? 'Add Member' : 'Add Golfer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== PLAYER CARD MODAL ========== */}
      {selectedPlayer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
        </div>
      )}

      {/* Status Levels Info Modal */}
      {showStatusLevels && (
        <StatusLevelsInfo 
          onClose={() => setShowStatusLevels(false)}
          currentLevel={selectedPlayer?.verifiedStatus?.statusLevel || currentProfile?.verifiedStatus?.statusLevel || 0}
        />
      )}
    </div>
  );
};

export default GolfersTab;
