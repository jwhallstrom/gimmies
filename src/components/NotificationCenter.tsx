/**
 * NotificationCenter - Your Golf Activity Feed
 * 
 * A smart, categorized notification center that surfaces what matters:
 * - Money: Winnings, settlements, payments
 * - Live: During-round updates, leaderboard changes
 * - Social: Group activity, new members, messages
 * - Personal: Handicap updates, personal bests, streaks
 * 
 * Inspired by: Venmo (money), Strava (activity), iMessage (social)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import type { Event } from '../state/types';
import { calculateEventPayouts } from '../games/payouts';
import { computeSkins } from '../games/skins';

// Notification types for categorization
type NotificationType = 'money' | 'live' | 'social' | 'personal' | 'system';
type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  icon: string;
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionPath?: string;
  eventId?: string;
  groupId?: string;
  amount?: number; // For money notifications (in cents)
  isPositive?: boolean; // For money (won vs owe)
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type FilterTab = 'all' | 'money' | 'activity' | 'social';

const NotificationCenter: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const {
    events,
    completedEvents,
    currentProfile,
    profiles,
    settlements,
    notificationReadAt,
    markNotificationRead,
    markNotificationsRead,
  } = useStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Generate notifications from app state
  // Only show notifications from recent activity (last 7 days for most, 24h for transient ones)
  const notifications = useMemo<Notification[]>(() => {
    const notifs: Notification[] = [];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const allEvents = [...(events || []), ...(completedEvents || [])];

    if (!currentProfile) return notifs;
    
    // Helper to check if notification was dismissed (marked read more than 24h ago)
    const wasDismissed = (id: string, timestamp: Date) => {
      const readAt = notificationReadAt?.[id];
      if (!readAt) return false;
      const readDate = new Date(readAt);
      // If marked read and the notification is older than when it was read, it's dismissed
      return readDate.getTime() > timestamp.getTime();
    };

    // === MONEY NOTIFICATIONS ===
    
    // Check wallet for pending settlements
    (settlements || []).forEach((s: any, idx: number) => {
      if (s.status !== 'pending') return; // Only show pending settlements
      
      const id = `settle-${s.id || idx}`;
      const timestamp = new Date(s.createdAt || now);
      
      // Skip if dismissed
      if (wasDismissed(id, timestamp)) return;
      
      const isOwed = s.toProfileId === currentProfile.id;
      const otherProfile = profiles.find(p => p.id === (isOwed ? s.fromProfileId : s.toProfileId));
      const otherName = otherProfile?.name || 'Someone';
      
      notifs.push({
        id,
        type: 'money',
        priority: 'high',
        icon: isOwed ? '💵' : '⚠️',
        title: isOwed ? `${otherName} owes you` : `You owe ${otherName}`,
        body: `$${Number(s.roundedAmount || 0).toFixed(0)} from ${s.eventName || 'recent games'}`,
        timestamp,
        read: Boolean(notificationReadAt?.[id]),
        actionLabel: isOwed ? 'Send reminder' : 'Settle up',
        actionPath: '/wallet',
        amount: Math.abs(Number(s.roundedAmount || 0)),
        isPositive: isOwed,
      });
    });

    // Recent winnings from completed events (only from last 7 days)
    completedEvents
      ?.filter((event: Event) => new Date(event.lastModified) > sevenDaysAgo)
      .slice(0, 3)
      .forEach((event: Event) => {
        const id = `win-${event.id}`;
        const timestamp = new Date(event.lastModified);
        
        // Skip if dismissed
        if (wasDismissed(id, timestamp)) return;
        
        const payouts = calculateEventPayouts(event as any, profiles);
        const myNet = payouts.totalByGolfer?.[currentProfile.id] ?? 0;
        if (myNet !== 0) {
          const isWin = myNet > 0;
          notifs.push({
            id,
            type: 'money',
            priority: 'normal',
            icon: isWin ? '💰' : '📉',
            title: isWin ? 'You won!' : 'Better luck next time',
            body: `${isWin ? '+' : ''}$${Math.abs(myNet).toFixed(0)} from ${event.name}`,
            timestamp,
            read: Boolean(notificationReadAt?.[id]),
            actionLabel: 'View details',
            actionPath: `/event/${event.id}/payout`,
            eventId: event.id,
            amount: Math.abs(myNet),
            isPositive: isWin,
          });
        }
      });

    // === LIVE/ACTIVITY NOTIFICATIONS ===
    
    // Active events with recent activity
    events?.filter((e: Event) => !e.isCompleted && e.hubType !== 'group').forEach((event: Event) => {
      const hasScores = event.scorecards?.some(sc => sc.scores?.length > 0);
      const myScorecard = event.scorecards?.find(sc => sc.golferId === currentProfile.id);
      const holesPlayed = myScorecard?.scores?.filter((s: any) => s?.strokes != null).length || 0;
      
      // Event starting soon
      const eventDate = new Date(event.date);
      const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntil > 0 && hoursUntil < 24) {
        const id = `upcoming-${event.id}`;
        notifs.push({
          id,
          type: 'live',
          priority: 'high',
          icon: '⛳',
          title: 'Tee time today',
          body: `${event.name} - ${event.golfers.length} players`,
          timestamp: eventDate,
          read: Boolean(notificationReadAt?.[id]),
          actionLabel: 'View event',
          actionPath: `/event/${event.id}`,
          eventId: event.id,
        });
      }

      // Leaderboard changes (if you're in an active round)
      if (hasScores && holesPlayed > 0) {
        // Find your position
        const leaderboard = event.scorecards
          ?.map((sc: any) => {
            const scores = sc.scores || [];
            const gross = scores.reduce((sum: number, s: any) => sum + (s?.strokes || 0), 0);
            return { golferId: sc.golferId, gross, holes: scores.filter((s: any) => s?.strokes).length };
          })
          .filter((p: any) => p.holes > 0)
          .sort((a: any, b: any) => a.gross - b.gross);
        
        const myPosition = leaderboard?.findIndex((p: any) => p.golferId === currentProfile.id);
        if (myPosition !== undefined && myPosition >= 0 && myPosition < 3) {
          const id = `position-${event.id}`;
          notifs.push({
            id,
            type: 'live',
            priority: 'normal',
            icon: myPosition === 0 ? '🥇' : myPosition === 1 ? '🥈' : '🥉',
            title: myPosition === 0 ? "You're leading!" : `You're in ${myPosition + 1}${myPosition === 1 ? 'nd' : 'rd'} place`,
            body: `${event.name} - Thru ${holesPlayed} holes`,
            timestamp: new Date(event.lastModified),
            read: Boolean(notificationReadAt?.[id]),
            actionLabel: 'View leaderboard',
            actionPath: `/event/${event.id}/scorecard`,
            eventId: event.id,
          });
        }
      }

      // Recent skins wins (derived from scorecards)
      const skinsCfg = event.games?.skins?.[0];
      if (skinsCfg) {
        const summary = computeSkins(event as any, skinsCfg as any, profiles);
        const holes = summary?.winningHolesByGolfer?.[currentProfile.id] || [];
        holes.slice(-2).forEach((hole: number) => {
          const id = `skin-${event.id}-${hole}`;
          notifs.push({
            id,
            type: 'money',
            priority: 'high',
            icon: '🎯',
            title: 'Skin won!',
            body: `You won the skin on hole ${hole}`,
            timestamp: new Date(event.lastModified),
            read: Boolean(notificationReadAt?.[id]),
            actionLabel: 'View skins',
            actionPath: `/event/${event.id}/payout`,
            eventId: event.id,
          });
        });
      }
    });

    // === SOCIAL NOTIFICATIONS ===
    
    // Groups with recent chat activity (only last 24h for chat)
    events?.filter((e: Event) => e.hubType === 'group').forEach((group: Event) => {
      // Only show chat notifications from last 24 hours
      const recentMessages = (group.chat || [])
        .filter((m: any) => m.profileId !== currentProfile.id)
        .filter((m: any) => new Date(m.createdAt) > oneDayAgo)
        .slice(-1); // Only latest message
      
      if (recentMessages.length > 0) {
        const latestMsg = recentMessages[recentMessages.length - 1];
        const id = `chat-${group.id}-${latestMsg.id || latestMsg.createdAt}`;
        const timestamp = new Date(latestMsg.createdAt);
        
        if (!wasDismissed(id, timestamp)) {
          const sender = profiles.find(p => p.id === latestMsg.profileId);
          notifs.push({
            id,
            type: 'social',
            priority: 'normal',
            icon: '💬',
            title: group.name || 'Group',
            body: `${sender?.name || latestMsg.senderName}: ${latestMsg.text?.substring(0, 50)}${(latestMsg.text?.length || 0) > 50 ? '...' : ''}`,
            timestamp,
            read: Boolean(notificationReadAt?.[id]),
            actionLabel: 'Reply',
            actionPath: `/event/${group.id}/chat`,
            groupId: group.id,
          });
        }
      }

      // Join requests (for group owners) - always show pending
      if (group.ownerProfileId === currentProfile.id && group.joinRequests?.length) {
        const pendingRequests = group.joinRequests.filter((r: any) => r.status === 'pending');
        if (pendingRequests.length > 0) {
          const id = `joinreq-${group.id}`;
          notifs.push({
            id,
            type: 'social',
            priority: 'high',
            icon: '🎫',
            title: `${pendingRequests.length} join request${pendingRequests.length > 1 ? 's' : ''}`,
            body: `${group.name} - Tap to review`,
            timestamp: new Date(pendingRequests[0].requestedAt),
            read: Boolean(notificationReadAt?.[id]),
            actionLabel: 'Review',
            actionPath: `/event/${group.id}/settings`,
            groupId: group.id,
          });
        }
      }
    });

    // === PERSONAL NOTIFICATIONS ===
    
    // Personal best check - only show if recent (last 7 days) and not dismissed
    const rounds = currentProfile.individualRounds || [];
    if (rounds.length > 0) {
      const recentRounds = rounds.filter((r: any) => new Date(r.date || r.datePlayed) > sevenDaysAgo);
      const bestRound = rounds.reduce((best: any, r: any) => 
        (!best || (r.adjustedGrossScore && r.adjustedGrossScore < best.adjustedGrossScore)) ? r : best
      , null);
      
      // Only show if the most recent round IS the personal best
      if (bestRound && recentRounds.length > 0 && recentRounds[0]?.id === bestRound.id) {
        const id = `pb-${bestRound.id}`;
        const timestamp = new Date(bestRound.date || bestRound.datePlayed);
        
        if (!wasDismissed(id, timestamp)) {
          notifs.push({
            id,
            type: 'personal',
            priority: 'high',
            icon: '🏆',
            title: 'Personal best!',
            body: `${bestRound.adjustedGrossScore || bestRound.grossScore} at ${bestRound.courseName || 'your round'}`,
            timestamp,
            read: Boolean(notificationReadAt?.[id]),
            actionLabel: 'View round',
            actionPath: `/handicap/round/${bestRound.id}`,
          });
        }
      }
    }

    // Sort by priority then timestamp
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return notifs.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [events, completedEvents, currentProfile, profiles, settlements, notificationReadAt]);

  // Filter notifications by tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'money') return notifications.filter(n => n.type === 'money');
    if (activeTab === 'activity') return notifications.filter(n => n.type === 'live' || n.type === 'personal');
    if (activeTab === 'social') return notifications.filter(n => n.type === 'social');
    return notifications;
  }, [notifications, activeTab]);

  // Counts for badges
  const counts = useMemo(() => ({
    all: notifications.filter(n => !n.read).length,
    money: notifications.filter(n => n.type === 'money' && !n.read).length,
    activity: notifications.filter(n => (n.type === 'live' || n.type === 'personal') && !n.read).length,
    social: notifications.filter(n => n.type === 'social' && !n.read).length,
  }), [notifications]);

  const handleNotificationClick = (notif: Notification) => {
    markNotificationRead?.(notif.id);
    if (notif.actionPath) {
      onClose();
      navigate(notif.actionPath);
    }
  };

  const markAllRead = () => {
    markNotificationsRead?.(notifications.map(n => n.id));
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-16 sm:pt-20"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden animate-slide-up mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-4 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>🔔</span>
              Activity Feed
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Filter Tabs */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1">
            {[
              { key: 'all', label: 'All', icon: '📋' },
              { key: 'money', label: 'Money', icon: '💰' },
              { key: 'activity', label: 'Activity', icon: '⛳' },
              { key: 'social', label: 'Social', icon: '👥' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as FilterTab)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all relative ${
                  activeTab === tab.key 
                    ? 'bg-white text-primary-700 shadow-sm' 
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
                {counts[tab.key as FilterTab] > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center ${
                    activeTab === tab.key ? 'bg-red-500 text-white' : 'bg-white text-primary-700'
                  }`}>
                    {counts[tab.key as FilterTab]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mark all read */}
        {counts.all > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <button 
              onClick={markAllRead}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Mark all as read
            </button>
          </div>
        )}

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">
                {activeTab === 'money' ? '💵' : activeTab === 'activity' ? '⛳' : activeTab === 'social' ? '👥' : '🔔'}
              </div>
              <div className="font-semibold text-gray-700 mb-1">All caught up!</div>
              <p className="text-sm text-gray-500">
                {activeTab === 'money' ? 'No money updates right now' :
                 activeTab === 'activity' ? 'No activity to show' :
                 activeTab === 'social' ? 'No social updates' :
                 'Nothing new to report'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors flex gap-3 ${
                    !notif.read ? 'bg-primary-50/50' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg ${
                    notif.type === 'money' && notif.isPositive ? 'bg-green-100' :
                    notif.type === 'money' && !notif.isPositive ? 'bg-amber-100' :
                    notif.type === 'live' ? 'bg-blue-100' :
                    notif.type === 'social' ? 'bg-purple-100' :
                    'bg-gray-100'
                  }`}>
                    {notif.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`font-semibold text-sm ${!notif.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notif.title}
                        {notif.amount && (
                          <span className={`ml-2 ${notif.isPositive ? 'text-green-600' : 'text-amber-600'}`}>
                            {notif.isPositive ? '+' : '-'}${(notif.amount / 100).toFixed(0)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatTime(notif.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{notif.body}</p>
                    {notif.actionLabel && (
                      <span className="inline-block mt-1.5 text-xs font-semibold text-primary-600">
                        {notif.actionLabel} →
                      </span>
                    )}
                  </div>
                  
                  {/* Unread dot */}
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { onClose(); navigate('/wallet'); }}
              className="py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 flex flex-col items-center gap-1"
            >
              <span>💵</span>
              <span>Wallet</span>
            </button>
            <button
              onClick={() => { onClose(); navigate('/events'); }}
              className="py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 flex flex-col items-center gap-1"
            >
              <span>📅</span>
              <span>Events</span>
            </button>
            <button
              onClick={() => { onClose(); navigate('/handicap'); }}
              className="py-2.5 px-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 flex flex-col items-center gap-1"
            >
              <span>📊</span>
              <span>Stats</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
