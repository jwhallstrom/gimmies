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

type Props = { eventId: string };

const GolfersTab: React.FC<Props> = ({ eventId }) => {
  const event = useStore((s: any) =>
    s.events.find((e: any) => e.id === eventId) ||
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const { currentProfile, profiles, addGolferToEvent, updateEventGolfer, removeGolferFromEvent } = useStore();
  const { course: selectedCourse } = useCourse(event?.course?.courseId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [golferName, setGolferName] = useState('');
  const [customTeeName, setCustomTeeName] = useState('');
  const [customHandicap, setCustomHandicap] = useState('');
  const [guestGamePreference, setGuestGamePreference] = useState<'all' | 'skins' | 'none'>('all');
  const [editingGolferId, setEditingGolferId] = useState<string | null>(null);

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
      };
    });
  }, [event.golfers, profiles, currentProfile?.id, event.ownerProfileId]);

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
    if (window.confirm(`Remove ${name} from this event?`)) {
      removeGolferFromEvent(eventId, golferId);
    }
  };

  const handleUpdatePreference = (golferId: string, preference: 'all' | 'skins' | 'none') => {
    updateEventGolfer(eventId, golferId, { gamePreference: preference } as any);
    setEditingGolferId(null);
  };

  const preferenceLabels = {
    all: { label: 'All Games', color: 'bg-green-100 text-green-700 border-green-200' },
    skins: { label: 'Skins Only', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    none: { label: 'No Games', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  return (
    <div className="space-y-4">
      {/* Completed Banner */}
      {event.isCompleted && (
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
          <h2 className="text-lg font-bold text-gray-900">Golfers</h2>
          <p className="text-sm text-gray-500">{golferData.length} player{golferData.length !== 1 ? 's' : ''} in this event</p>
        </div>
        
        {!event.isCompleted && (
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!courseSelected || !teeSelected}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              courseSelected && teeSelected
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-200'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Golfer
          </button>
        )}
      </div>

      {/* Setup Prompt */}
      {(!courseSelected || !teeSelected) && !event.isCompleted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <div className="font-semibold text-amber-800">Setup Required</div>
              <p className="text-sm text-amber-700 mt-1">
                {!courseSelected 
                  ? 'Select a course in Settings before adding golfers.'
                  : 'Select a tee in Settings before adding golfers.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Golfer List */}
      {golferData.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-3">👥</div>
          <div className="font-semibold text-gray-700 mb-1">No golfers yet</div>
          <p className="text-sm text-gray-500">Add golfers to start the event</p>
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
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                  golfer.avatar 
                    ? '' 
                    : golfer.hasProfile 
                      ? 'bg-primary-100 text-primary-700' 
                      : 'bg-gray-200 text-gray-600'
                }`}>
                  {golfer.avatar ? (
                    <img src={golfer.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    golfer.name.charAt(0).toUpperCase()
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 truncate">{golfer.name}</span>
                    {golfer.isOwnerProfile && (
                      <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded">
                        HOST
                      </span>
                    )}
                    {golfer.isCurrentUser && !golfer.isOwnerProfile && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                    {golfer.handicap != null && (
                      <span>HCP: {typeof golfer.handicap === 'number' ? golfer.handicap.toFixed(1) : golfer.handicap}</span>
                    )}
                    {golfer.teeName && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{golfer.teeName}</span>
                    )}
                  </div>
                </div>
                
                {/* Game Preference */}
                {!event.isCompleted && (
                  <div className="relative">
                    {editingGolferId === golfer.id ? (
                      <div className="flex gap-1">
                        {(['all', 'skins', 'none'] as const).map(pref => (
                          <button
                            key={pref}
                            onClick={() => handleUpdatePreference(golfer.id, pref)}
                            className={`px-2 py-1 text-xs rounded-lg font-medium border ${
                              preferenceLabels[pref].color
                            }`}
                          >
                            {pref === 'all' ? '🎯' : pref === 'skins' ? '💰' : '📊'}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preference Legend */}
      {golferData.length > 0 && !event.isCompleted && (
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <div className="text-xs font-semibold text-gray-600 mb-2">Game Preferences</div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">All Games</span>
              <span>Nassau, Skins, etc.</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Skins Only</span>
              <span>Just skins</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">No Games</span>
              <span>Score only</span>
            </div>
          </div>
        </div>
      )}

      {/* Add Golfer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add Golfer</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Golfer Name *
                </label>
                <input
                  type="text"
                  value={golferName}
                  onChange={e => setGolferName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  autoFocus
                />
              </div>
              
              {/* Tee Selection */}
              {teesForCourse.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tee (optional override)
                  </label>
                  <select
                    value={customTeeName}
                    onChange={e => setCustomTeeName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Use event default ({event.course.teeName})</option>
                    {teesForCourse.map((tee: any) => (
                      <option key={tee.name} value={tee.name}>{tee.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Handicap */}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              {/* Game Preference */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Game Participation
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'skins', 'none'] as const).map(pref => (
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
                      {pref === 'all' ? '🎯 All' : pref === 'skins' ? '💰 Skins' : '📊 None'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={handleAddGolfer}
                disabled={!golferName.trim()}
                className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
                  golferName.trim()
                    ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Add Golfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GolfersTab;
