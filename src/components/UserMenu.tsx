import React, { useMemo, useState } from 'react';
import useStore from '../state/store';
import NotificationCenter from './NotificationCenter';
import SettingsPanel from './SettingsPanel';
import { useAuthMode } from '../hooks/useAuthMode';

const UserMenu: React.FC = () => {
  const { currentUser, currentProfile, events, settlements, notificationReadAt } = useStore();
  const { isGuest } = useAuthMode();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const loadEventsFromCloud = useStore((s: any) => s.loadEventsFromCloud) as () => Promise<void>;
  const isSyncing = useStore((s: any) => s.isLoadingEventsFromCloud) as boolean;
  const addToast = useStore((s: any) => s.addToast) as ((message: string, type?: 'success' | 'error' | 'warning', durationMs?: number) => void) | undefined;

  // Calculate notification count (unread items)
  const notificationCount = useMemo(() => {
    if (!currentProfile) return 0;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const readAt = notificationReadAt || {};

    const isRead = (id: string) => Boolean(readAt?.[id]);

    // Matches NotificationCenter semantics: when read, it should stop counting immediately.
    // "Dismissal" also hides stale items, but for the badge, read presence is enough.
    let count = 0;

    // Pending settlements (same id scheme as NotificationCenter)
    (settlements || []).forEach((s: any, idx: number) => {
      if (s.status !== 'pending') return;
      const id = `settle-${s.id || idx}`;
      if (!isRead(id)) count++;
    });

    // Upcoming events today (same id scheme as NotificationCenter)
    (events || [])
      .filter((e: any) => !e?.isCompleted && e?.hubType !== 'group')
      .forEach((event: any) => {
        const eventDate = new Date(event.date);
        const hoursUntil = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntil > 0 && hoursUntil < 24) {
          const id = `upcoming-${event.id}`;
          if (!isRead(id)) count++;
        }
      });

    // Lightweight "leaderboard position" alerts (same id scheme)
    (events || [])
      .filter((e: any) => !e?.isCompleted && e?.hubType !== 'group')
      .forEach((event: any) => {
        const hasScores = event.scorecards?.some((sc: any) => (sc.scores?.length || 0) > 0);
        if (!hasScores) return;
        const myScorecard = event.scorecards?.find((sc: any) => sc.golferId === currentProfile.id);
        const holesPlayed = myScorecard?.scores?.filter((s: any) => s?.strokes != null).length || 0;
        if (holesPlayed <= 0) return;

        const leaderboard = (event.scorecards || [])
          .map((sc: any) => {
            const scores = sc.scores || [];
            const gross = scores.reduce((sum: number, s: any) => sum + (s?.strokes || 0), 0);
            return { golferId: sc.golferId, gross, holes: scores.filter((s: any) => s?.strokes).length };
          })
          .filter((p: any) => p.holes > 0)
          .sort((a: any, b: any) => a.gross - b.gross);

        const myPosition = leaderboard?.findIndex((p: any) => p.golferId === currentProfile.id);
        if (myPosition >= 0 && myPosition < 3) {
          const id = `position-${event.id}`;
          if (!isRead(id)) count++;
        }
      });

    // Group chat activity (same id scheme as NotificationCenter)
    (events || [])
      .filter((e: any) => e?.hubType === 'group')
      .forEach((group: any) => {
        const recentMessages = (group.chat || [])
          .filter((m: any) => m.profileId !== currentProfile.id)
          .filter((m: any) => new Date(m.createdAt) > oneDayAgo)
          .slice(-1);
        if (recentMessages.length === 0) return;
        const latestMsg = recentMessages[recentMessages.length - 1];
        const id = `chat-${group.id}-${latestMsg.id || latestMsg.createdAt}`;
        if (!isRead(id)) count++;
      });

    // Group join requests (same id scheme as NotificationCenter)
    (events || [])
      .filter((e: any) => e?.hubType === 'group' && e?.ownerProfileId === currentProfile.id)
      .forEach((group: any) => {
        const pending = (group.joinRequests || []).filter((r: any) => r.status === 'pending');
        if (pending.length === 0) return;
        const id = `joinreq-${group.id}`;
        if (!isRead(id)) count++;
      });

    // Cap for badge display
    return Math.min(count, 99);
  }, [currentProfile, events, settlements, notificationReadAt]);

  if (!currentUser || !currentProfile) return null;

  const handleManualSync = async () => {
    if (isSyncing) return;
    try {
      await loadEventsFromCloud();
      addToast?.('Synced latest events and groups', 'success', 1800);
    } catch {
      addToast?.('Sync failed. Please try again.', 'error', 2200);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Profile Avatar - Opens Settings */}
      <button
        onClick={() => setShowSettings(true)}
        className="flex items-center gap-2 text-white hover:bg-white/10 rounded-xl px-2 py-1.5 transition-colors"
        aria-label="Open settings"
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white font-semibold text-sm overflow-hidden border border-white/20">
          {currentProfile.avatar ? (
            <img src={currentProfile.avatar} alt={currentProfile.name} className="w-full h-full object-cover" />
          ) : (
            currentProfile.name?.charAt(0)?.toUpperCase() || '?'
          )}
        </div>
        <span className="text-sm font-semibold text-white/95 max-w-[100px] truncate hidden sm:block">
          {currentProfile.name}
        </span>
        {isGuest && (
          <span className="text-[9px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded font-bold hidden sm:block">
            GUEST
          </span>
        )}
      </button>

      {/* Notifications Flag */}
      <button
        onClick={() => setShowNotifications(true)}
        className="relative p-2 rounded-xl text-white/90 hover:bg-white/10 transition-colors"
        aria-label="Activity feed"
        title="Activity feed"
      >
        {/* Golf flag icon */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 21V4" />
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 4l12 4-12 4" />
        </svg>
        {notificationCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-primary-900">
            {notificationCount}
          </span>
        )}
      </button>

      {/* Manual Sync */}
      <button
        onClick={handleManualSync}
        disabled={isSyncing}
        className="p-2 rounded-xl text-white/90 hover:bg-white/10 transition-colors"
        aria-label="Sync now"
        title={isSyncing ? 'Syncing...' : 'Sync now'}
      >
        <svg className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 20v-5h-5" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 9a8 8 0 00-14.5-4M4 15a8 8 0 0014.5 4" />
        </svg>
      </button>

      {/* Notification Center */}
      <NotificationCenter 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default UserMenu;
