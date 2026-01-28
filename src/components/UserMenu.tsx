import React, { useMemo, useState } from 'react';
import useStore from '../state/store';
import NotificationCenter from './NotificationCenter';
import SettingsPanel from './SettingsPanel';
import { useAuthMode } from '../hooks/useAuthMode';

const UserMenu: React.FC = () => {
  const { currentUser, currentProfile, events, wallet } = useStore();
  const { isGuest } = useAuthMode();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Calculate notification count (unread items)
  const notificationCount = useMemo(() => {
    if (!currentProfile) return 0;
    let count = 0;
    
    // Pending settlements
    const settlements = wallet?.settlements || [];
    count += settlements.filter((s: any) => s.status === 'pending').length;
    
    // Join requests for groups you own
    events?.filter(e => e.hubType === 'group' && e.ownerProfileId === currentProfile.id).forEach(group => {
      count += (group.joinRequests || []).filter((r: any) => r.status === 'pending').length;
    });
    
    // Active events with scores (you might have updates)
    events?.filter(e => !e.isCompleted && e.hubType !== 'group').forEach(event => {
      const hasActivity = event.scorecards?.some(sc => sc.scores?.length > 0);
      if (hasActivity) count++;
    });
    
    // Recent chat messages in groups
    events?.filter(e => e.hubType === 'group').forEach(group => {
      const recentMsgs = (group.chat || []).filter((m: any) => {
        if (m.profileId === currentProfile.id) return false;
        const msgTime = new Date(m.createdAt).getTime();
        const hourAgo = Date.now() - (60 * 60 * 1000);
        return msgTime > hourAgo;
      });
      if (recentMsgs.length > 0) count++;
    });
    
    return Math.min(count, 99);
  }, [currentProfile, events, wallet]);

  if (!currentUser || !currentProfile) return null;

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
        aria-label="Notifications"
        title="Notifications"
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

      {/* Settings Gear */}
      <button
        onClick={() => setShowSettings(true)}
        className="p-2 rounded-xl text-white/90 hover:bg-white/10 transition-colors"
        aria-label="Settings"
        title="Settings"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
