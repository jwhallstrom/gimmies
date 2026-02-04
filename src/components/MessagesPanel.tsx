/**
 * MessagesPanel - Quick access to group chats from header
 * 
 * Shows:
 * - All groups user is a member of
 * - Unread message count per group
 * - Preview of latest message
 * - Tap to go directly to group chat
 */

import React, { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';

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
  let total = 0;
  
  events.forEach((event) => {
    // Only count groups (not single events) that user is member of
    if (event.hubType !== 'group') return;
    if (!event.golfers?.some((g: any) => g.profileId === currentProfileId)) return;
    
    const chat = event.chat || [];
    if (chat.length === 0) return;
    
    const lastRead = lastReadMap[event.id];
    if (!lastRead) {
      // Never read - count all messages not from self
      total += chat.filter((m: any) => m.profileId !== currentProfileId).length;
    } else {
      // Count messages after lastRead that aren't from self
      total += chat.filter((m: any) => 
        m.createdAt > lastRead && m.profileId !== currentProfileId
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
  
  const handleOpenGroup = (groupId: string) => {
    // Mark as read
    setLastReadTimestamp(groupId, new Date().toISOString());
    onClose();
    navigate(`/event/${groupId}`);
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
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-end pt-14"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Panel */}
      <div 
        className="relative w-full max-w-sm mx-2 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-slide-down max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">💬</span>
            <span className="font-bold">Messages</span>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Group list */}
        <div className="flex-1 overflow-y-auto">
          {groupsWithChat.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">👥</span>
              </div>
              <div className="font-semibold text-gray-700 dark:text-gray-300">No group chats yet</div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Join or create a group to start chatting with your golf buddies!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {groupsWithChat.map((group: any) => (
                <button
                  key={group.id}
                  onClick={() => handleOpenGroup(group.id)}
                  className="w-full p-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition text-left"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                      <span className="text-xl">👥</span>
                    </div>
                    {group.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">
                          {group.unreadCount > 9 ? '9+' : group.unreadCount}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
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
                      <p className={`text-sm truncate mt-0.5 ${group.unreadCount > 0 ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        <span className="text-gray-400">{group.lastMessage.senderName?.split(' ')[0] || 'Someone'}:</span>{' '}
                        {group.lastMessage.text}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 mt-0.5">No messages yet</p>
                    )}
                    
                    <div className="text-[10px] text-gray-400 mt-1">
                      {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer tip */}
        {groupsWithChat.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              Tap a group to open chat
            </p>
          </div>
        )}
      </div>
    </div>
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
