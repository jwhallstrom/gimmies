/**
 * Dashboard - Grandma-Proof UX
 * 
 * Key improvements:
 * - ONE FAB button for all actions (Join, Create, etc.)
 * - Clear event sections: Live, Upcoming, Recent
 * - Large tap targets, minimal clutter
 * - Status badges for quick scanning
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthMode } from '../hooks/useAuthMode';
import { CreateEventWizard } from '../components/CreateEventWizard';
import { CreateGroupWizard } from '../components/CreateGroupWizard';
import SettingsPanel from '../components/SettingsPanel';
import { SignInRequired } from '../components/SignInRequired';
import { useEventsAdapter, useWalletAdapter } from '../adapters';
import type { Event } from '../state/types';
import useStore from '../state/store';
import { getHole } from '../data/cloudCourses';
import { hasPendingInviteTarget } from '../utils/inviteSession';

const parseEventDate = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
};

const formatDateShort = (iso: string) =>
  parseEventDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// Count actual strokes entered (not just array slots)
const countStrokesEntered = (event: Event): number => {
  return event.scorecards.reduce((total, sc) => {
    return total + (sc.scores?.filter((s: any) => s?.strokes != null).length || 0);
  }, 0);
};

const isPastDueEvent = (event: Event): boolean => {
  if (event.isCompleted) return false;
  const eventDate = parseEventDate(event.date);
  const today = new Date();
  const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return eventDay < todayDay;
};

// Check if an event is "live" (has scores being entered but not completed)
const isEventLive = (event: Event): boolean => {
  if (event.isCompleted) return false;
  return countStrokesEntered(event) > 0;
};

// Check if an event is "upcoming" (no scores entered yet)
const isEventUpcoming = (event: Event): boolean => {
  if (event.isCompleted) return false;
  return countStrokesEntered(event) === 0;
};

type TickerItem = {
  id: string;
  type: 'leader' | 'player' | 'update' | 'info' | 'betting';
  highlight?: boolean;
  payload: {
    text: string;
    score?: number | null;
    thru?: number | null;
    isFinal?: boolean;
  };
};

const ONBOARDING_DISMISSED_KEY = 'gimmies_onboarding_dismissed';
const SECTION_ORDER_KEY = 'gimmies_home_section_order';
const DEFAULT_ITEMS_LIMIT = 5; // Show this many items before "Show more"

type SectionId = 'live' | 'upcoming' | 'groups' | 'history';

const DEFAULT_SECTION_ORDER: SectionId[] = ['live', 'upcoming', 'groups', 'history'];

function getSavedSectionOrder(): SectionId[] {
  try {
    const saved = localStorage.getItem(SECTION_ORDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate it contains all sections
      if (Array.isArray(parsed) && parsed.length === 4 && 
          DEFAULT_SECTION_ORDER.every(s => parsed.includes(s))) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_SECTION_ORDER;
}

function saveSectionOrder(order: SectionId[]) {
  try {
    localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(order));
  } catch {}
}

const Dashboard: React.FC = () => {
  const {
    events,
    userEvents,
    currentProfile,
    loadEventsFromCloud,
    profiles,
    lastEventsCloudSyncAt,
    lastEventsCloudSyncCount,
  } = useEventsAdapter();
  const { wallet } = useWalletAdapter();
  const { isGuest } = useAuthMode();
  const navigate = useNavigate();
  const addToast = useStore((s: any) => s.addToast);
  const logout = useStore((s: any) => s.logout);

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showCreateGroupWizard, setShowCreateGroupWizard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [isRefreshingInvites, setIsRefreshingInvites] = useState(false);
  const [lastManualRefreshAt, setLastManualRefreshAt] = useState<string | null>(null);
  
  // Section order - persisted to localStorage
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(getSavedSectionOrder);
  const [isReorderMode, setIsReorderMode] = useState(false);
  
  // Long-press to activate reorder mode
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const LONG_PRESS_MS = 500;
  const AUTO_EXIT_MS = 6000;

  const resetAutoExit = useCallback(() => {
    if (autoExitTimer.current) clearTimeout(autoExitTimer.current);
    autoExitTimer.current = setTimeout(() => setIsReorderMode(false), AUTO_EXIT_MS);
  }, []);

  const startLongPress = useCallback(() => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setIsReorderMode(true);
      resetAutoExit();
    }, LONG_PRESS_MS);
  }, [resetAutoExit]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (autoExitTimer.current) clearTimeout(autoExitTimer.current);
    };
  }, []);
  
  // Accordion states - LIVE, UPCOMING, GROUPS expanded by default; HISTORY collapsed
  const [showLive, setShowLive] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  
  // "Show all" states for sections with many items
  const [showAllLive, setShowAllLive] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  
  // Move section up/down (works on all platforms including iOS)
  const moveSection = (sectionId: SectionId, direction: 'up' | 'down') => {
    const newOrder = [...sectionOrder];
    const idx = newOrder.indexOf(sectionId);
    if (direction === 'up' && idx > 0) {
      [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    } else if (direction === 'down' && idx < newOrder.length - 1) {
      [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
    }
    setSectionOrder(newOrder);
    saveSectionOrder(newOrder);
    resetAutoExit(); // Reset auto-exit timer on each move
  };
  
  // Prevent multiple wizards from opening simultaneously
  const openEventWizard = () => {
    if (isGuest) {
      addToast?.('Sign in to create events', 'error', 2500);
      return;
    }
    setShowCreateGroupWizard(false);
    setShowCreateWizard(true);
  };
  
  const openGroupWizard = () => {
    if (isGuest) {
      addToast?.('Sign in to create groups', 'error', 2500);
      return;
    }
    setShowCreateWizard(false);
    setShowCreateGroupWizard(true);
  };
  
  // Onboarding state - check localStorage
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const dismissOnboarding = (permanent: boolean) => {
    setShowOnboarding(false);
    if (permanent) {
      try {
        localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
      } catch {
        // localStorage not available
      }
    }
  };

  // Load + silently refresh events (invite links, other devices)
  useEffect(() => {
    if (!currentProfile || isGuest) return;

    const silentSync = () => {
      loadEventsFromCloud().catch(() => {});
    };

    silentSync();

    const onVisible = () => {
      if (document.visibilityState === 'visible') silentSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentProfile?.id, isGuest, loadEventsFromCloud]);

  const refreshInvites = useCallback(async () => {
    if (isGuest) {
      addToast?.('Sign in to sync invites', 'error', 2500);
      return;
    }

    setIsRefreshingInvites(true);
    try {
      const result = await loadEventsFromCloud();
      setLastManualRefreshAt(result.syncedAt);
      addToast?.(`Synced ${result.totalCount} events & groups`, 'success', 2500);
    } catch {
      addToast?.('Could not refresh invites', 'error', 3000);
    } finally {
      setIsRefreshingInvites(false);
    }
  }, [addToast, isGuest, loadEventsFromCloud]);

  const showInviteSyncHint =
    !isGuest &&
    (hasPendingInviteTarget() || !lastEventsCloudSyncAt);

  // Separate events into categories: live, upcoming, completed, groups
  const { liveEvents, upcomingEvents, completedEvents, groups, activeEvents } = useMemo(() => {
    const live: Event[] = [];
    const upcoming: Event[] = [];
    const completed: Event[] = [];
    const groupList: Event[] = [];
    
    userEvents.forEach(e => {
      if (e.hubType === 'group') {
        groupList.push(e);
      } else if (e.isCompleted) {
        completed.push(e);
      } else if (isEventLive(e)) {
        live.push(e);
      } else {
        upcoming.push(e);
      }
    });
    
    // Sort by date/activity
    live.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    upcoming.sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime()); // Soonest first
    completed.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    groupList.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    
    // activeEvents = all non-completed for backward compat
    const active = [...live, ...upcoming];
    
    return { 
      liveEvents: live, 
      upcomingEvents: upcoming, 
      completedEvents: completed, 
      groups: groupList, 
      activeEvents: active,
    };
  }, [userEvents]);


  // Which sections are visible (for up/down arrow boundary checks)
  const visibleSections = useMemo(() => 
    sectionOrder.filter(sid => {
      if (sid === 'live') return liveEvents.length > 0;
      if (sid === 'upcoming') return upcomingEvents.length > 0;
      if (sid === 'groups') return groups.length > 0;
      if (sid === 'history') return completedEvents.length > 0;
      return true;
    }),
    [sectionOrder, liveEvents.length, upcomingEvents.length, groups.length, completedEvents.length]
  );

  // Quick stats
  const stats = useMemo(() => {
    const handicap = currentProfile?.handicapIndex;
    const lastRound = (currentProfile?.individualRounds || [])[0];
    const netBalance = (wallet?.lifetimeNet ?? 0);
    
    return { handicap, lastRound, netBalance };
  }, [currentProfile, wallet]);

  // Ticker event (most recent active or completed event)
  const tickerEvent = useMemo(() => {
    const candidates = [...activeEvents];
    if (candidates.length) return candidates[0];
    const done = [...completedEvents];
    return done.length ? done[0] : null;
  }, [activeEvents, completedEvents]);

  // Generate ticker items from event data
  const tickerItems = useMemo<TickerItem[]>(() => {
    if (!tickerEvent) return [];

    const event = tickerEvent;
    const courseId = event.course?.courseId;
    const teeName = event.course?.teeName;

    const resolveGolferName = (golferId: string) => {
      const eventGolfer = (event.golfers || []).find((g: any) => g.profileId === golferId || g.customName === golferId);
      const profile = eventGolfer?.profileId ? (profiles || []).find((p: any) => p.id === eventGolfer.profileId) : null;
      return profile ? profile.name : (eventGolfer?.displayName || eventGolfer?.customName || golferId || 'Unknown');
    };

    const scorecards = event.scorecards || [];
    const holesCount = scorecards[0]?.scores?.length || 18;

    const rows = scorecards.map((sc: any) => {
      const scores = Array.isArray(sc?.scores) ? sc.scores : [];
      const completed = scores.filter((s: any) => s?.strokes != null).length;
      const onHole = completed >= holesCount ? null : Math.min(completed + 1, holesCount);

      const gross = scores.reduce((sum: number, s: any) => sum + (typeof s?.strokes === 'number' ? s.strokes : 0), 0);
      const parSoFar = scores.reduce((sum: number, s: any) => {
        if (s?.strokes == null) return sum;
        const holeNo = Number(s.hole);
        const hole = courseId ? getHole(courseId, holeNo, teeName) : undefined;
        const par = typeof hole?.par === 'number' ? hole.par : 4;
        return sum + par;
      }, 0);

      const toPar = completed === 0 ? 0 : (courseId ? gross - parSoFar : null);
      const name = resolveGolferName(sc.golferId);
      const isFinal = completed >= holesCount;

      return { golferId: sc.golferId, name, toPar, thru: completed, onHole, isFinal };
    });

    // Sort by score, then progress.
    rows.sort((a: any, b: any) => {
      if (typeof a.toPar === 'number' && typeof b.toPar === 'number' && a.toPar !== b.toPar) return a.toPar - b.toPar;
      if ((b.thru || 0) !== (a.thru || 0)) return (b.thru || 0) - (a.thru || 0);
      return a.name.localeCompare(b.name);
    });

    // Rank w/ ties
    const playerStrings = rows.slice(0, 10).map((r: any, idx: number) => {
      const betterCount = rows.slice(0, idx).filter((p: any) => typeof p.toPar === 'number' && typeof r.toPar === 'number' && p.toPar < r.toPar).length;
      const rank = betterCount + 1;
      const isTied = rows.filter((p: any) => typeof p.toPar === 'number' && typeof r.toPar === 'number' && p.toPar === r.toPar).length > 1;
      const rankLabel = `${isTied ? 'T' : ''}${rank}.`;
      const statusLabel = r.isFinal ? 'F' : `Thru ${r.thru || 0}`;
      return {
        id: `p-${r.golferId}`,
        type: 'player' as const,
        payload: {
          text: `${rankLabel} ${r.name}`,
          score: typeof r.toPar === 'number' ? r.toPar : null,
          thru: r.thru,
          isFinal: !!r.isFinal,
        },
        _status: statusLabel,
      };
    });

    const leader = rows[0];
    const leaderStatus = leader
      ? (leader.isFinal ? 'F' : `Thru ${leader.thru || 0}`)
      : null;

    const items: TickerItem[] = [];

    // Event name first
    items.push({
      id: 'event-name',
      type: 'info',
      highlight: true,
      payload: { text: (event.name || 'Event').trim() || 'Event' },
    });

    if (leader) {
      items.push({
        id: 'leader',
        type: 'leader',
        highlight: true,
        payload: {
          text: `LEADER: ${leader.name}`,
          score: typeof leader.toPar === 'number' ? leader.toPar : null,
          thru: leader.thru,
          isFinal: !!leader.isFinal,
        },
      });
      if (leaderStatus) {
        items.push({
          id: 'leader-status',
          type: 'info',
          payload: { text: leaderStatus },
        });
      }
    }

    // Top players
    playerStrings.forEach((p: any) => {
      items.push({
        id: p.id,
        type: 'player',
        payload: { ...p.payload, text: `${p.payload.text} ${p._status}` },
      });
    });

    // Live updates from bot messages
    const now = Date.now();
    const updates = (event.chat || [])
      .filter((m: any) => (m?.senderName || '').toLowerCase().includes('gimmies bot'))
      .filter((m: any) => {
        const t = new Date(m.createdAt).getTime();
        return Number.isFinite(t) && now - t < 2 * 60 * 60 * 1000;
      })
      .slice(-2)
      .reverse();

    updates.forEach((m: any, idx: number) => {
      items.push({
        id: `u-${idx}`,
        type: 'update',
        highlight: true,
        payload: { text: m.text || 'Update' },
      });
    });

    return items;
  }, [tickerEvent?.id, tickerEvent?.lastModified, profiles]);

  const tickerDurationSeconds = useMemo(() => {
    const base = 30;
    const extra = Math.min(20, Math.max(0, tickerItems.length - 6) * 1.5);
    return Math.round(base + extra);
  }, [tickerItems.length]);

  // Home course from profile
  const homeCourse = currentProfile?.preferences?.homeCourseName ||
    (currentProfile?.preferences as any)?.homeCourse ||
    null;

  if (!currentProfile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⛳</div>
          <div className="text-lg font-semibold text-gray-700">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-32">
      {isGuest && (
        <SignInRequired
          title="You're in Guest Mode"
          message="Browse the app, but creating/joining games is locked until you sign in so everything stays cloud-synced."
          actionLabel="Sign In / Create Account"
          onAction={() => {
            setShowCreateWizard(false);
            setShowCreateGroupWizard(false);
            setShowSettings(false);
            logout();
          }}
        />
      )}
      {/* Compact Header - Avatar + Name + Quick Stats in one row */}
      <header className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 -mx-4 -mt-4 px-4 pt-4 pb-3 shadow-lg">
        <div className="flex items-center gap-3">
          {/* Avatar - Opens Settings */}
          <button 
            onClick={() => setShowSettings(true)}
            className="flex-shrink-0"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold text-white border-2 border-white/30 hover:bg-white/30 transition-colors">
              {currentProfile.avatar ? (
                <img src={currentProfile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                currentProfile.name?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
          </button>
          
          {/* Name + Course */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">
              {currentProfile.name || 'Golfer'}
            </h1>
            <p className="text-primary-200 text-xs truncate">
              {homeCourse ? `⛳ ${homeCourse}` : 'Tap avatar for settings'}
            </p>
          </div>
          
          {/* Compact Stats - Handicap & Wallet */}
          <div className="flex gap-2 flex-shrink-0">
            <Link 
              to="/handicap" 
              className="bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 text-center transition-colors min-w-[60px]"
            >
              <div className="text-lg font-bold text-white leading-tight">
                {stats.handicap != null ? stats.handicap.toFixed(1) : '—'}
              </div>
              <div className="text-[9px] text-primary-200 font-medium uppercase tracking-wide">HCP</div>
            </Link>
            <Link 
              to="/wallet" 
              className="bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 text-center transition-colors min-w-[60px]"
            >
              <div className="text-lg font-bold text-white leading-tight">
                ${(stats.netBalance / 100).toFixed(0)}
              </div>
              <div className="text-[9px] text-primary-200 font-medium uppercase tracking-wide">Wallet</div>
            </Link>
          </div>
        </div>
      </header>

      {/* Getting Started - Onboarding Modal (compact for small screens) */}
      {showOnboarding && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => dismissOnboarding(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[75vh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header — compact */}
            <div className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 px-4 pt-5 pb-4 rounded-t-2xl text-center flex-shrink-0">
              <button
                onClick={() => dismissOnboarding(false)}
                className="absolute top-2.5 right-2.5 p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-3xl mb-1">⛳</div>
              <h2 className="text-lg font-bold text-white">Welcome to Gimmies!</h2>
              <p className="text-primary-100 text-xs">Your golf crew's command center</p>
            </div>
            
            {/* Feature highlights — scrollable */}
            <div className="px-4 py-3 space-y-2 overflow-y-auto flex-1 min-h-0">
              <button 
                className="w-full flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors text-left"
                onClick={() => { setShowGroups(true); dismissOnboarding(false); }}
              >
                <div className="w-9 h-9 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">👥</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900">Create a Group</div>
                  <p className="text-xs text-gray-500">Chat, schedule tee times, manage your crew.</p>
                </div>
                <span className="text-purple-400 text-sm">→</span>
              </button>

              <button 
                className="w-full flex items-center gap-3 p-3 bg-primary-50 rounded-xl border border-primary-100 hover:bg-primary-100 transition-colors text-left"
                onClick={(e) => { e.stopPropagation(); openEventWizard(); dismissOnboarding(false); }}
              >
                <div className="w-9 h-9 rounded-full bg-primary-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">⛳</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900">Create an Event</div>
                  <p className="text-xs text-gray-500">Score rounds, run side games, live leaderboard.</p>
                </div>
                <span className="text-primary-400 text-sm">→</span>
              </button>

              <button 
                className="w-full flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors text-left"
                onClick={() => { navigate('/handicap'); dismissOnboarding(false); }}
              >
                <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">📊</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900">Track Your Handicap</div>
                  <p className="text-xs text-gray-500">Add rounds, auto-calculated index.</p>
                </div>
                <span className="text-amber-500 text-sm">→</span>
              </button>
            </div>

            {/* Footer — always visible (sticky) */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); openGroupWizard(); dismissOnboarding(false); }}
                  className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-1.5 shadow-md"
                >
                  <span>👥</span> Start a Group
                </button>
                <button
                  onClick={() => {
                    if (isGuest) {
                      addToast?.('Sign in to join events', 'error', 2500);
                      dismissOnboarding(false);
                      return;
                    }
                    navigate('/join');
                    dismissOnboarding(false);
                  }}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>🎫</span> Join with Code
                </button>
              </div>
              
              <button
                onClick={() => dismissOnboarding(true)}
                className="w-full mt-2.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1.5"
              >
                Don't show this again
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showInviteSyncHint && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900/60">
          <span className="text-slate-600 dark:text-slate-300">
            {hasPendingInviteTarget()
              ? 'Finishing an invite? Refresh to pull in your game.'
              : 'Missing something from a text link?'}
          </span>
          <button
            type="button"
            onClick={refreshInvites}
            disabled={isRefreshingInvites}
            className="flex-shrink-0 font-semibold text-sky-700 hover:text-sky-800 disabled:opacity-60 dark:text-sky-300"
          >
            {isRefreshingInvites ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
      )}

      {/* Unified Content - Draggable Accordions */}
      <section key={lastEventsCloudSyncAt || 'home'} className="space-y-3">
        {/* Empty state - show if no events AND no groups */}
        {liveEvents.length === 0 && upcomingEvents.length === 0 && completedEvents.length === 0 && groups.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-12 text-center">
            <div className="text-5xl mb-4">⛳</div>
            <div className="font-bold text-gray-800 text-lg mb-2">Welcome to Gimmies!</div>
            <p className="text-gray-500 mb-2 px-4">
              Tap the <span className="inline-flex items-center justify-center w-8 h-8 bg-accent rounded-full text-white font-bold text-lg align-middle mx-1">+</span> to create an event or group
            </p>
          </div>
        )}

        {/* Render sections in user-defined order */}
        {sectionOrder.map(sectionId => {
          // Determine if section should show based on data
          const sectionConfig: Record<SectionId, { 
            show: boolean; 
            isExpanded: boolean; 
            setExpanded: (v: boolean) => void;
            showAll: boolean;
            setShowAll: (v: boolean) => void;
            icon: React.ReactNode;
            label: string;
            count: number;
            gradient: string;
            badgeBg: string;
            labelColor: string;
            items: Event[];
            renderItem: (item: Event) => React.ReactNode;
          }> = {
            live: {
              show: liveEvents.length > 0,
              isExpanded: showLive,
              setExpanded: setShowLive,
              showAll: showAllLive,
              setShowAll: setShowAllLive,
              icon: <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>,
              label: 'Live',
              count: liveEvents.length,
              gradient: 'from-red-50 to-white hover:from-red-100',
              badgeBg: 'bg-red-100',
              labelColor: 'text-gray-800',
              items: liveEvents,
              renderItem: (event) => (
                <EventCard key={event.id} event={event} profiles={profiles} currentProfileId={currentProfile?.id} status="live" />
              ),
            },
            upcoming: {
              show: upcomingEvents.length > 0,
              isExpanded: showUpcoming,
              setExpanded: setShowUpcoming,
              showAll: showAllUpcoming,
              setShowAll: setShowAllUpcoming,
              icon: <span className="text-base">📅</span>,
              label: 'Upcoming',
              count: upcomingEvents.length,
              gradient: 'from-primary-50 to-white hover:from-primary-100',
              badgeBg: 'bg-primary-100',
              labelColor: 'text-gray-800',
              items: upcomingEvents,
              renderItem: (event) => (
                <EventCard key={event.id} event={event} profiles={profiles} currentProfileId={currentProfile?.id} status="upcoming" />
              ),
            },
            groups: {
              show: groups.length > 0,
              isExpanded: showGroups,
              setExpanded: setShowGroups,
              showAll: showAllGroups,
              setShowAll: setShowAllGroups,
              icon: <span className="text-base">👥</span>,
              label: 'Groups',
              count: groups.length,
              gradient: 'from-purple-50 to-white hover:from-purple-100',
              badgeBg: 'bg-purple-100',
              labelColor: 'text-gray-800',
              items: groups,
              renderItem: (group) => (
                <GroupCard key={group.id} group={group} />
              ),
            },
            history: {
              show: completedEvents.length > 0,
              isExpanded: showHistory,
              setExpanded: setShowHistory,
              showAll: showAllHistory,
              setShowAll: setShowAllHistory,
              icon: <span className="text-base">📜</span>,
              label: 'History',
              count: completedEvents.length,
              gradient: 'from-gray-50 to-white hover:from-gray-100',
              badgeBg: 'bg-gray-100',
              labelColor: 'text-gray-600',
              items: completedEvents,
              renderItem: (event) => (
                <EventCard key={event.id} event={event} profiles={profiles} currentProfileId={currentProfile?.id} status="completed" />
              ),
            },
          };
          
          const config = sectionConfig[sectionId];
          if (!config.show) return null;
          
          const sectionIdx = visibleSections.indexOf(sectionId);
          const isFirst = sectionIdx === 0;
          const isLast = sectionIdx === visibleSections.length - 1;
          
          // Determine which items to show (limited or all)
          const hasMoreItems = config.items.length > DEFAULT_ITEMS_LIMIT;
          const itemsToShow = config.showAll ? config.items : config.items.slice(0, DEFAULT_ITEMS_LIMIT);
          const hiddenCount = config.items.length - DEFAULT_ITEMS_LIMIT;
          
          return (
            <div
              key={sectionId}
              className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-200 ${
                isReorderMode ? 'border-dashed border-primary-300' : 'border-gray-200'
              }`}
            >
              <div className={`flex items-center bg-gradient-to-r ${config.gradient} transition-colors`}>
                {/* Reorder Arrows - only visible in edit mode */}
                {isReorderMode && (
                  <div className="flex flex-col pl-1.5 -mr-1">
                    <button
                      onClick={() => moveSection(sectionId, 'up')}
                      disabled={isFirst}
                      className={`p-0.5 rounded transition-colors ${isFirst ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700 active:bg-white/40'}`}
                      aria-label="Move section up"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveSection(sectionId, 'down')}
                      disabled={isLast}
                      className={`p-0.5 rounded transition-colors ${isLast ? 'text-gray-300' : 'text-gray-500 hover:text-gray-700 active:bg-white/40'}`}
                      aria-label="Move section down"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {/* Accordion Header - long-press to reorder, tap to expand/collapse */}
                <button
                  onClick={() => {
                    // If long-press just activated reorder, don't also toggle accordion
                    if (longPressTriggered.current) {
                      longPressTriggered.current = false;
                      return;
                    }
                    if (isReorderMode) {
                      setIsReorderMode(false);
                      if (autoExitTimer.current) clearTimeout(autoExitTimer.current);
                    } else {
                      config.setExpanded(!config.isExpanded);
                    }
                  }}
                  onTouchStart={(e) => {
                    if (!isReorderMode) startLongPress();
                  }}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onMouseDown={() => {
                    if (!isReorderMode) startLongPress();
                  }}
                  onMouseUp={cancelLongPress}
                  onMouseLeave={cancelLongPress}
                  className={`flex-1 flex items-center gap-2 pr-4 py-3 select-none ${isReorderMode ? 'pl-1' : 'pl-3'}`}
                >
                  {config.icon}
                  <h3 className={`font-bold ${config.labelColor} text-sm uppercase tracking-wide`}>{config.label}</h3>
                  <span className={`text-xs text-gray-500 ${config.badgeBg} px-2 py-0.5 rounded-full font-medium`}>{config.count}</span>
                  {isReorderMode ? (
                    <span className="ml-auto text-[10px] font-bold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                      DONE
                    </span>
                  ) : (
                    <svg 
                      className={`w-4 h-4 text-gray-400 ml-auto transition-transform duration-200 ${config.isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Content */}
              {config.isExpanded && config.items.length > 0 && (
                <div className="px-3 pb-3 space-y-1.5">
                  {itemsToShow.map(item => config.renderItem(item))}
                  
                  {/* Show more/less button */}
                  {hasMoreItems && !config.showAll && (
                    <button
                      onClick={() => config.setShowAll(true)}
                      className="w-full py-2.5 text-sm font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors border border-primary-200"
                    >
                      Show {hiddenCount} more {config.label.toLowerCase()} →
                    </button>
                  )}
                  {hasMoreItems && config.showAll && (
                    <button
                      onClick={() => config.setShowAll(false)}
                      className="w-full py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      ← Show less
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Score Ticker - Fixed at bottom, full width on mobile, anchored flush to footer */}
      <div className="fixed left-0 right-0 sm:left-4 sm:right-4 ticker-above-footer z-30 px-0 sm:px-0">
        <button
          onClick={() => tickerEvent ? navigate(`/event/${tickerEvent.id}`) : navigate('/events')}
          className="w-full gimmies-ticker rounded-none sm:rounded-xl bg-[#1561AE] border-t sm:border border-white/10 px-4 py-2.5 shadow-none sm:shadow-lg sm:shadow-primary-900/25"
          aria-label="Activity ticker"
          style={{ ['--gimmies-ticker-duration' as any]: `${tickerDurationSeconds}s` }}
        >
          <div className="gimmies-ticker__inner text-[11px] font-black text-white">
            <span className="gimmies-ticker__track">
              {tickerEvent ? (
                <>
                  {(tickerItems.length ? [...tickerItems, ...tickerItems] : []).map((item, idx) => {
                    const score = item.payload.score;
                    const scoreText =
                      typeof score === 'number'
                        ? (score === 0 ? 'E' : `${score > 0 ? '+' : ''}${score}`)
                        : '';

                    const scoreClass =
                      typeof score === 'number'
                        ? (score < 0 ? 'text-red-500' : score === 0 ? 'text-white' : 'text-slate-200')
                        : 'text-white';

                    const isHighlight = !!item.highlight || item.type === 'leader' || item.type === 'update' || item.type === 'betting';
                    const itemClass = isHighlight ? 'text-orange-300' : 'text-white';

                    return (
                      <span key={`${item.id}-${idx}`} className="inline-flex items-center">
                        <span className={itemClass}>
                          {item.payload.text}
                          {scoreText ? (
                            <>
                              {' '}
                              <span className={scoreClass}>{scoreText}</span>
                            </>
                          ) : null}
                        </span>
                        <span className="mx-2 text-white/40">•</span>
                      </span>
                    );
                  })}
                </>
              ) : (
                <>
                  <span className="text-orange-400">GIMMIES</span> • Create or join an event to get started •{' '}
                  <span className="text-orange-400">GIMMIES</span> • Create or join an event to get started •{' '}
                </>
              )}
            </span>
          </div>
        </button>
      </div>

      {/* FAB - The ONE button to rule them all */}
      <button
        onClick={() => setShowFabMenu(true)}
        className="fixed right-4 z-40 w-16 h-16 bg-gradient-to-br from-accent to-orange-600 rounded-full shadow-lg shadow-accent/40 flex items-center justify-center text-white text-3xl font-bold hover:scale-105 active:scale-95 transition-transform fab-position"
        aria-label="Quick actions"
      >
        <span className={`transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`}>+</span>
      </button>

      {/* FAB Action Sheet */}
      {showFabMenu && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowFabMenu(false)}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>
            
            {/* Header */}
            <div className="px-5 pb-3 text-center">
              <h2 className="text-lg font-bold text-gray-900">What would you like to do?</h2>
            </div>
            
            {/* Action buttons */}
            <div className="px-4 pb-4 space-y-2">
              {/* Join Event or Group - Most prominent (grandma's #1) */}
              <button
                onClick={() => {
                  if (isGuest) {
                    addToast?.('Sign in to join events', 'error', 2500);
                    setShowFabMenu(false);
                    return;
                  }
                  setShowFabMenu(false);
                  navigate('/join');
                }}
                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-accent to-orange-500 rounded-2xl text-white hover:from-orange-500 hover:to-accent transition-all shadow-md"
              >
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                  🎫
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-lg">Join Event or Group</div>
                  <div className="text-orange-100 text-sm">Someone invited you? Enter their code</div>
                </div>
                <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Create Event */}
              <button
                onClick={() => { setShowFabMenu(false); openEventWizard(); }}
                className="w-full flex items-center gap-4 p-4 bg-primary-50 rounded-2xl hover:bg-primary-100 transition-colors border border-primary-200"
              >
                <div className="w-14 h-14 rounded-xl bg-primary-200 flex items-center justify-center text-2xl flex-shrink-0">
                  ⛳
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-gray-900">Create Event</div>
                  <div className="text-gray-500 text-sm">Start a round with your crew</div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Create Group */}
              <button
                onClick={() => { setShowFabMenu(false); openGroupWizard(); }}
                className="w-full flex items-center gap-4 p-4 bg-purple-50 rounded-2xl hover:bg-purple-100 transition-colors border border-purple-200"
              >
                <div className="w-14 h-14 rounded-xl bg-purple-200 flex items-center justify-center text-2xl flex-shrink-0">
                  👥
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-gray-900">Create Group</div>
                  <div className="text-gray-500 text-sm">Gather your golf crew</div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Add Score */}
              <button
                onClick={() => { setShowFabMenu(false); navigate('/handicap'); }}
                className="w-full flex items-center gap-4 p-4 bg-amber-50 rounded-2xl hover:bg-amber-100 transition-colors border border-amber-200"
              >
                <div className="w-14 h-14 rounded-xl bg-amber-200 flex items-center justify-center text-2xl flex-shrink-0">
                  📝
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-gray-900">Add a Score</div>
                  <div className="text-gray-500 text-sm">Log a round for your handicap</div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Cancel button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowFabMenu(false)}
                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modals */}
      <CreateEventWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onCreated={(eventId) => {
          setShowCreateWizard(false);
          navigate(`/event/${eventId}`);
        }}
      />

      <CreateGroupWizard
        isOpen={showCreateGroupWizard}
        onClose={() => setShowCreateGroupWizard(false)}
        onCreated={(groupId) => {
          setShowCreateGroupWizard(false);
          navigate(`/event/${groupId}/chat`);
        }}
      />

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

// Event Card Component - clean text-based design
const EventCard: React.FC<{ event: Event; profiles: any[]; currentProfileId?: string; status?: 'live' | 'upcoming' | 'completed' }> = ({ event, profiles, currentProfileId, status }) => {
  const navigate = useNavigate();
  
  const golferCount = event.golfers.length;
  const courseId = event.course?.courseId;
  const teeName = event.course?.teeName;
  const showPastDue = status === 'upcoming' && currentProfileId === event.ownerProfileId && isPastDueEvent(event);
  
  // Calculate leaderboard with positions, scores, and thru
  const leaderboard = useMemo(() => {
    const rows = event.scorecards.map(sc => {
      const scores = Array.isArray(sc?.scores) ? sc.scores : [];
      const holesCompleted = scores.filter((s: any) => s?.strokes != null).length;
      
      // Calculate gross and par
      const gross = scores.reduce((sum: number, s: any) => sum + (typeof s?.strokes === 'number' ? s.strokes : 0), 0);
      const parSoFar = scores.reduce((sum: number, s: any) => {
        if (s?.strokes == null) return sum;
        const holeNo = Number(s.hole);
        const hole = courseId ? getHole(courseId, holeNo, teeName) : undefined;
        const par = typeof hole?.par === 'number' ? hole.par : 4;
        return sum + par;
      }, 0);
      
      const toPar = holesCompleted === 0 ? null : (courseId ? gross - parSoFar : null);
      const isFinal = holesCompleted >= 18;
      
      // Get golfer name
      const eventGolfer = (event.golfers || []).find((g: any) => g.profileId === sc.golferId || g.customName === sc.golferId);
      const profile = eventGolfer?.profileId ? (profiles || []).find((p: any) => p.id === eventGolfer.profileId) : null;
      const name = profile?.name || eventGolfer?.displayName || eventGolfer?.customName || 'Unknown';
      
      return { golferId: sc.golferId, name, toPar, thru: holesCompleted, isFinal };
    });
    
    // Sort by score (lowest first), then by progress
    rows.sort((a, b) => {
      if (typeof a.toPar === 'number' && typeof b.toPar === 'number' && a.toPar !== b.toPar) return a.toPar - b.toPar;
      if ((b.thru || 0) !== (a.thru || 0)) return (b.thru || 0) - (a.thru || 0);
      return a.name.localeCompare(b.name);
    });
    
    // Add positions with ties
    return rows.map((row, idx) => {
      const betterCount = rows.slice(0, idx).filter(r => typeof r.toPar === 'number' && typeof row.toPar === 'number' && r.toPar < row.toPar).length;
      const position = betterCount + 1;
      const isTied = rows.filter(r => typeof r.toPar === 'number' && typeof row.toPar === 'number' && r.toPar === row.toPar).length > 1;
      return { ...row, position, isTied };
    });
  }, [event.scorecards, event.golfers, profiles, courseId, teeName]);
  
  const leader = leaderboard[0];
  
  // Format score to par
  const formatToPar = (score: number | null) => {
    if (score === null) return '';
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
  };
  
  // Format position with tie indicator
  const formatPosition = (pos: number, isTied: boolean) => {
    return isTied ? `T${pos}` : `${pos}`;
  };
  
  // Format thru status
  const formatThru = (thru: number, isFinal: boolean) => {
    if (isFinal || thru >= 18) return 'F';
    return `Thru ${thru}`;
  };
  
  // Style variations based on status
  const cardStyles = {
    live: 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500 border-y border-r border-red-200',
    upcoming: 'bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-300',
    completed: 'bg-gray-50 hover:bg-gray-100 border border-gray-200',
  };
  
  const style = status ? cardStyles[status] : cardStyles.upcoming;
  
  return (
    <button
      onClick={() => navigate(`/event/${event.id}`)}
      className={`w-full text-left rounded-lg p-2.5 transition-all group ${style}`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-900 truncate text-sm">
              {event.name || 'Untitled Event'}
            </span>
            {status === 'live' && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full uppercase">
                Live
              </span>
            )}
            {showPastDue && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded-full uppercase">
                Past Due
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
            <span>{formatDateShort(event.date)}</span>
            <span className="text-gray-300">•</span>
            <span>{golferCount} golfer{golferCount !== 1 ? 's' : ''}</span>
            {status === 'live' && leader && leader.thru > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-red-600 font-medium">
                  {formatThru(leader.thru, leader.isFinal)} {formatToPar(leader.toPar)}
                </span>
              </>
            )}
          </div>
        </div>
        
        <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
};

// Group Card Component
const GroupCard: React.FC<{ group: Event }> = ({ group }) => {
  const navigate = useNavigate();
  
  const lastMessage = group.chat?.length ? group.chat[group.chat.length - 1] : null;
  const avatar = group.groupSettings?.avatar;
  
  return (
    <button
      onClick={() => navigate(`/event/${group.id}`)}
      className="w-full text-left bg-purple-50 hover:bg-purple-100 rounded-lg p-2.5 border border-purple-200 hover:border-purple-300 transition-all group"
    >
      <div className="flex items-center gap-2.5">
        {/* Group Avatar */}
        <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden">
          {avatar && (avatar.startsWith('data:') || avatar.startsWith('http')) ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : avatar ? (
            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-lg">
              {avatar}
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-sm font-bold flex items-center justify-center">
              {(group.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 group-hover:text-purple-700 truncate transition-colors text-sm">
            {group.name || 'Untitled Group'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {lastMessage ? `${lastMessage.senderName}: ${lastMessage.text}` : `${group.golfers.length} members`}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-200 text-purple-700 rounded-full">
            {group.golfers.length}
          </span>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
};

export default Dashboard;
