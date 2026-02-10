/**
 * MessagesPanel - Bottom sheet for group chats
 * 
 * v3.0 - Added Discover Groups section
 * 
 * Shows:
 * - All groups user is a member of
 * - Unread message count per group
 * - Preview of latest message
 * - Tap to go directly to group chat
 * - Discover public groups to join
 */

import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import type { Event } from '../state/types';

// Store last read timestamps in localStorage
const LAST_READ_KEY = 'gimmies.chatLastRead.v1';

function getLastReadTimestamps(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_READ_KEY) || '{}');
  } catch {
    return {};
  }
}

function setLastReadTimestamp(groupId: string, timestamp: string) {
  try {
    const current = getLastReadTimestamps();
    current[groupId] = timestamp;
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function getUnreadCount(events: any[], currentProfileId: string | undefined): number {
  if (!currentProfileId) return 0;
  
  const lastReadMap = getLastReadTimestamps();
  let muteSettings: Record<string, string> = {};
  try { muteSettings = JSON.parse(localStorage.getItem('gimmies.chatMute.v1') || '{}'); } catch {}
  
  let total = 0;
  
  events.forEach((event) => {
    // Only count groups (not single events) that user is member of
    if (event.hubType !== 'group') return;
    if (!event.golfers?.some((g: any) => g.profileId === currentProfileId)) return;
    
    // Skip muted chats
    const mutedUntil = muteSettings[event.id];
    if (mutedUntil === 'forever' || (mutedUntil && new Date(mutedUntil).getTime() > Date.now())) return;
    
    const chat = event.chat || [];
    if (chat.length === 0) return;
    
    const lastRead = lastReadMap[event.id];
    if (!lastRead) {
      // Never read - count all messages not from self (exclude deleted)
      total += chat.filter((m: any) => m.profileId !== currentProfileId && !m.isDeleted).length;
    } else {
      // Count messages after lastRead that aren't from self (exclude deleted)
      total += chat.filter((m: any) => 
        m.createdAt > lastRead && m.profileId !== currentProfileId && !m.isDeleted
      ).length;
    }
  });
  
  return total;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MessagesPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const events = useStore((s: any) => s.events);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const joinEventByCode = useStore((s: any) => s.joinEventByCode);
  const generateShareCode = useStore((s: any) => s.generateShareCode);
  const addToast = useStore((s: any) => s.addToast);
  
  const [showDiscover, setShowDiscover] = useState(false);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [discoverSearch, setDiscoverSearch] = useState('');
  
  // Get all groups with chat activity
  const groupsWithChat = useMemo(() => {
    if (!currentProfile) return [];
    
    const lastReadMap = getLastReadTimestamps();
    
    return events
      .filter((e: any) => {
        // Only groups
        if (e.hubType !== 'group') return false;
        // User must be a member
        if (!e.golfers?.some((g: any) => g.profileId === currentProfile.id)) return false;
        return true;
      })
      .map((group: any) => {
        const chat = group.chat || [];
        const lastMessage = chat.length > 0 ? chat[chat.length - 1] : null;
        const lastRead = lastReadMap[group.id];
        
        // Count unread (messages after lastRead, not from self)
        let unreadCount = 0;
        if (chat.length > 0) {
          if (!lastRead) {
            unreadCount = chat.filter((m: any) => m.profileId !== currentProfile.id).length;
          } else {
            unreadCount = chat.filter((m: any) => 
              m.createdAt > lastRead && m.profileId !== currentProfile.id
            ).length;
          }
        }
        
        return {
          id: group.id,
          name: group.name || 'Unnamed Group',
          memberCount: group.golfers?.length || 0,
          lastMessage,
          unreadCount,
          lastActivity: lastMessage?.createdAt || group.lastModified || group.createdAt,
        };
      })
      // Sort by most recent activity
      .sort((a: any, b: any) => {
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      });
  }, [events, currentProfile?.id]);
  
  // Public groups available to join
  const publicGroups = useMemo(() => {
    if (!currentProfile) return [];
    
    return events.filter((e: Event) => {
      if (e.hubType !== 'group') return false;
      const settings = e.groupSettings;
      if (!settings || settings.visibility !== 'public') return false;
      // Exclude groups user is already in
      if (e.golfers?.some((g: any) => g.profileId === currentProfile.id)) return false;
      return true;
    });
  }, [events, currentProfile?.id]);

  // Filter public groups by search
  const filteredPublicGroups = useMemo(() => {
    if (!discoverSearch.trim()) return publicGroups;
    const q = discoverSearch.toLowerCase().trim();
    return publicGroups.filter((g: Event) => {
      const name = (g.name || '').toLowerCase();
      const location = (g.groupSettings?.location || '').toLowerCase();
      const description = (g.groupSettings?.description || '').toLowerCase();
      return name.includes(q) || location.includes(q) || description.includes(q);
    });
  }, [publicGroups, discoverSearch]);

  const handleOpenGroup = (groupId: string) => {
    // Mark as read
    setLastReadTimestamp(groupId, new Date().toISOString());
    onClose();
    navigate(`/event/${groupId}`);
  };

  const handleJoinGroup = async (group: Event) => {
    if (!currentProfile) {
      addToast?.('Please sign in to join groups', 'error');
      return;
    }

    setJoiningGroupId(group.id);
    try {
      let code = group.shareCode;
      if (!code) {
        code = await generateShareCode(group.id);
      }
      if (!code) throw new Error('Could not get join code');

      const result = await joinEventByCode(code);
      if (result?.success) {
        addToast?.(`Joined ${group.name}!`, 'success');
        setShowDiscover(false);
        onClose();
        navigate(`/event/${group.id}`);
      } else {
        throw new Error(result?.error || 'Failed to join');
      }
    } catch (e: any) {
      addToast?.(e?.message || 'Could not join group', 'error');
    } finally {
      setJoiningGroupId(null);
    }
  };
  
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
  
  if (!isOpen) return null;
  
  const totalUnread = groupsWithChat.reduce((sum: number, g: any) => sum + g.unreadCount, 0);
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      {/* Bottom Sheet Panel - slides up like FAB menu */}
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>
        
        {/* Header - Purple themed */}
        <div className="px-5 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Group Chats</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {groupsWithChat.length} group{groupsWithChat.length !== 1 ? 's' : ''}
                  {totalUnread > 0 && <span className="text-purple-600 font-medium"> · {totalUnread} unread</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tab toggle - Your Groups / Discover */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setShowDiscover(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition ${
                !showDiscover 
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Your Groups ({groupsWithChat.length})
            </button>
            <button
              onClick={() => setShowDiscover(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition ${
                showDiscover 
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Discover ({filteredPublicGroups.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!showDiscover ? (
            // Your Groups tab
            groupsWithChat.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">👥</span>
                </div>
                <div className="font-bold text-gray-800 dark:text-gray-200 text-lg mb-2">No group chats yet</div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Join or create a group to start chatting!
                </p>
                {publicGroups.length > 0 && (
                  <button
                    onClick={() => setShowDiscover(true)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition"
                  >
                    Discover Groups →
                  </button>
                )}
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {groupsWithChat.map((group: any) => (
                  <button
                    key={group.id}
                    onClick={() => handleOpenGroup(group.id)}
                    className="w-full flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors border border-purple-100 dark:border-purple-800"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center">
                        <span className="text-xl">👥</span>
                      </div>
                      {group.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                          <span className="text-[10px] font-bold text-white">
                            {group.unreadCount > 9 ? '9+' : group.unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold truncate ${group.unreadCount > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                          {group.name}
                        </span>
                        {group.lastMessage && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {formatTimeAgo(group.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      
                      {group.lastMessage ? (
                        <p className={`text-sm truncate mt-0.5 ${group.unreadCount > 0 ? 'text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
                          <span className="text-purple-500">{group.lastMessage.senderName?.split(' ')[0] || 'Someone'}:</span>{' '}
                          {group.lastMessage.text}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-0.5">No messages yet</p>
                      )}
                      
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )
          ) : (
            // Discover tab
            <div className="flex flex-col h-full">
              {/* Search bar */}
              <div className="px-4 py-2">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={discoverSearch}
                    onChange={(e) => setDiscoverSearch(e.target.value)}
                    placeholder="Search groups by name or location..."
                    className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
                  />
                  {discoverSearch && (
                    <button
                      onClick={() => setDiscoverSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              {filteredPublicGroups.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">🔍</span>
                </div>
                <div className="font-bold text-gray-800 dark:text-gray-200 text-lg mb-2">
                  {discoverSearch ? 'No groups found' : 'No public groups'}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {discoverSearch ? `Try a different search term` : 'Public groups will appear here when available'}
                </p>
              </div>
            ) : (
              <div className="px-4 py-2 space-y-2 overflow-y-auto">
                {filteredPublicGroups.map((group: Event) => {
                  const settings = group.groupSettings;
                  const memberCount = group.golfers?.length || 0;
                  return (
                    <div 
                      key={group.id}
                      className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800"
                    >
                      <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">👥</span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{group.name}</div>
                        {settings?.location && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            {settings.location}
                          </div>
                        )}
                        {settings?.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{settings.description}</p>
                        )}
                        <div className="text-[10px] text-gray-400 mt-1">
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleJoinGroup(group)}
                        disabled={joiningGroupId === group.id}
                        className="px-3 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-60 transition flex-shrink-0"
                      >
                        {joiningGroupId === group.id ? '...' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Helper to format time ago
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default MessagesPanel;
