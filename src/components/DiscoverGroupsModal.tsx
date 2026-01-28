/**
 * DiscoverGroupsModal - Browse and search for public groups
 * 
 * Features:
 * - Search by name/location
 * - Browse public groups
 * - Request to join (for request-only groups)
 * - Direct join (for open groups)
 */

import React, { useState, useMemo, useEffect } from 'react';
import useStore from '../state/store';
import type { Event } from '../state/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscoverGroupsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { events, currentProfile, joinEventByCode, generateShareCode, addToast } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Get all public groups
  const publicGroups = useMemo(() => {
    return events.filter((e: Event) => {
      if (e.hubType !== 'group') return false;
      const settings = e.groupSettings;
      // Default to private if no settings
      if (!settings || settings.visibility !== 'public') return false;
      // Don't show groups user is already in
      if (currentProfile && e.golfers.some((g: any) => g.profileId === currentProfile.id)) return false;
      return true;
    });
  }, [events, currentProfile?.id]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return publicGroups;
    const q = searchQuery.toLowerCase();
    return publicGroups.filter((g: Event) => {
      const name = (g.name || '').toLowerCase();
      const location = (g.groupSettings?.location || '').toLowerCase();
      const description = (g.groupSettings?.description || '').toLowerCase();
      return name.includes(q) || location.includes(q) || description.includes(q);
    });
  }, [publicGroups, searchQuery]);

  const handleJoin = async (group: Event) => {
    if (!currentProfile) {
      addToast('Please sign in to join groups', 'error');
      return;
    }

    setJoiningId(group.id);
    try {
      // Generate share code if needed
      let code = group.shareCode;
      if (!code) {
        code = await generateShareCode(group.id);
      }
      if (!code) {
        throw new Error('Could not get join code');
      }

      const result = await joinEventByCode(code);
      if (result.success) {
        addToast(`Joined ${group.name}!`, 'success');
        onClose();
      } else {
        throw new Error(result.error || 'Failed to join');
      }
    } catch (e: any) {
      addToast(e?.message || 'Could not join group', 'error');
    } finally {
      setJoiningId(null);
    }
  };

  const handleRequestJoin = async (group: Event) => {
    if (!currentProfile) {
      addToast('Please sign in to request access', 'error');
      return;
    }

    setRequestingId(group.id);
    try {
      // Add join request to the group
      const existingRequests = group.joinRequests || [];
      const alreadyRequested = existingRequests.some(
        (r: any) => r.profileId === currentProfile.id && r.status === 'pending'
      );

      if (alreadyRequested) {
        addToast('You already have a pending request', 'info');
        return;
      }

      const newRequest = {
        id: `req_${Date.now()}`,
        profileId: currentProfile.id,
        profileName: currentProfile.name,
        profileAvatar: currentProfile.avatar,
        requestedAt: new Date().toISOString(),
        status: 'pending' as const,
      };

      await useStore.getState().updateEvent(group.id, {
        joinRequests: [...existingRequests, newRequest],
      } as any);

      addToast('Request sent! The admin will review it.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Could not send request', 'error');
    } finally {
      setRequestingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white text-gray-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up"
        style={{ colorScheme: 'light' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-purple-600 p-4 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <h3 className="text-white font-bold text-lg">Find Groups</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or location..."
              className="w-full bg-white text-gray-900 placeholder:text-gray-400 pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👥</span>
              </div>
              {publicGroups.length === 0 ? (
                <>
                  <div className="font-semibold text-gray-700 mb-1">No public groups yet</div>
                  <p className="text-sm text-gray-500">
                    Public groups will appear here. Create one and set it to Public!
                  </p>
                </>
              ) : (
                <>
                  <div className="font-semibold text-gray-700 mb-1">No matches found</div>
                  <p className="text-sm text-gray-500">
                    Try a different search term
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group: Event) => {
                const settings = group.groupSettings;
                const isOpen = settings?.joinPolicy === 'open';
                const isRequest = settings?.joinPolicy === 'request';
                const memberCount = group.golfers?.length || 0;

                return (
                  <div 
                    key={group.id}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">👥</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{group.name}</div>
                        {settings?.location && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {settings.location}
                          </div>
                        )}
                        {settings?.description && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{settings.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-500">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            isOpen 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isOpen ? 'Open' : isRequest ? 'Request to Join' : 'Invite Only'}
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex-shrink-0">
                        {isOpen ? (
                          <button
                            onClick={() => handleJoin(group)}
                            disabled={joiningId === group.id}
                            className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-60 transition-colors"
                          >
                            {joiningId === group.id ? 'Joining...' : 'Join'}
                          </button>
                        ) : isRequest ? (
                          <button
                            onClick={() => handleRequestJoin(group)}
                            disabled={requestingId === group.id}
                            className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 disabled:opacity-60 transition-colors"
                          >
                            {requestingId === group.id ? 'Sending...' : 'Request'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Invite only</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer tip */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            💡 Have an invite code? Use <strong>Join Event</strong> on the home screen.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DiscoverGroupsModal;
