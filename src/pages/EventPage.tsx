/**
 * EventPage - Instagram-style swipeable Event Hub
 * 
 * Key features:
 * - Horizontal swipe navigation between pages (scroll-snap)
 * - Dot indicators showing current page
 * - Tab order: Chat → Leaderboard → Games → Golfers → Settings
 * - Message composer only visible on Chat page
 * - Mobile-first with smooth native feel
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { useEventSync } from '../hooks/useEventSync';
import { getGuestSession } from '../utils/guestSession';
import SetupTab from '../components/tabs/SetupTab';
import ScoreHubTab from '../components/tabs/ScoreHubTab';
import GolfersTab from '../components/tabs/GolfersTab';
import GamesTab from '../components/tabs/GamesTab';
import ChatTab from '../components/tabs/ChatTab';
import GroupEventsTab from '../components/tabs/GroupEventsTab';
import EventNotifications from '../components/EventNotifications';
import { CreateEventWizard } from '../components/CreateEventWizard';
import { getCourseById } from '../data/cloudCourses';
import { LeaderboardIcon } from '../components/icons/LeaderboardIcon';
import { formatLocalDate } from '../utils/dateUtils';
import { getChatTargetId, getChatUnreadCount, markChatAsRead } from '../utils/chatUnread';

const formatDateShort = (iso: string) =>
  formatLocalDate(iso, { month: 'short', day: 'numeric' });

const EventPage: React.FC = () => {
  const { id } = useParams();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [eventOverlay, setEventOverlay] = useState<null | 'games' | 'golfers' | 'settings' | 'chat'>(null);
  const [gamesSubTab, setGamesSubTab] = useState<'games' | 'payouts'>('games');
  const [showEventsDropdown, setShowEventsDropdown] = useState(false);
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  const [ccGuestName, setCcGuestName] = useState('');
  const [ccAddingGuest, setCcAddingGuest] = useState(false);
  const [showPlayerGuide, setShowPlayerGuide] = useState(false);
  const [triggerAddGame, setTriggerAddGame] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [chatReadVersion, setChatReadVersion] = useState(0);

  // First-time help modals
  const [showEventHelp, setShowEventHelp] = useState(() => {
    try { return localStorage.getItem('gimmies_event_help_dismissed') !== 'true'; } catch { return true; }
  });
  const dismissEventHelp = (permanent: boolean) => {
    setShowEventHelp(false);
    if (permanent) { try { localStorage.setItem('gimmies_event_help_dismissed', 'true'); } catch {} }
  };
  const navigate = useNavigate();
  
  // Keep the active event page on realtime cloud sync while it is open.
  useEventSync(id);
  
  const rawEvent = useStore(s => 
    s.events.find(e => e.id === id) || 
    s.completedEvents.find(e => e.id === id)
  );
  const parentGroup = useStore((s) =>
    rawEvent?.parentGroupId
      ? (s.events.find((e: any) => e.id === rawEvent.parentGroupId) as any | undefined)
      : undefined
  );
  const { deleteEvent, currentProfile, joinEventByCode, generateShareCode, addToast } = useStore();
  
  if (!rawEvent) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <div className="text-lg font-semibold text-gray-700">Event not found</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-xl font-medium"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const event = {
    ...rawEvent,
    golfers: Array.isArray(rawEvent.golfers) ? rawEvent.golfers : [],
    groups: Array.isArray(rawEvent.groups) ? rawEvent.groups : [],
    scorecards: Array.isArray(rawEvent.scorecards) ? rawEvent.scorecards : [],
    games: {
      ...(rawEvent.games || {}),
      nassau: Array.isArray(rawEvent.games?.nassau) ? rawEvent.games.nassau : [],
      skins: Array.isArray(rawEvent.games?.skins) ? rawEvent.games.skins : [],
      pinky: Array.isArray(rawEvent.games?.pinky) ? rawEvent.games.pinky : [],
      greenie: Array.isArray(rawEvent.games?.greenie) ? rawEvent.games.greenie : [],
      stableford: Array.isArray(rawEvent.games?.stableford) ? rawEvent.games.stableford : [],
      ninePoint: Array.isArray(rawEvent.games?.ninePoint) ? rawEvent.games.ninePoint : [],
      bingoBangoBongo: Array.isArray(rawEvent.games?.bingoBangoBongo) ? rawEvent.games.bingoBangoBongo : [],
      wolf: Array.isArray(rawEvent.games?.wolf) ? rawEvent.games.wolf : [],
      dots: Array.isArray(rawEvent.games?.dots) ? rawEvent.games.dots : [],
    },
  };

  const isGroupHub = event.hubType === 'group';
  const useLeaderboardHub = !isGroupHub;
  const isOwner = Boolean(currentProfile && event.ownerProfileId === currentProfile.id);
  const courseName = event.course.courseId ? getCourseById(event.course.courseId)?.name : null;

  const chatUnread = useMemo(() => {
    if (!currentProfile || isGroupHub) return 0;
    const chatTargetId = getChatTargetId(event);
    const messages = event.parentGroupId
      ? (parentGroup?.chat || [])
      : (event.chat || []);
    return getChatUnreadCount(messages, chatTargetId, currentProfile.id);
  }, [currentProfile?.id, isGroupHub, event.chat, event.parentGroupId, event.id, parentGroup?.chat, chatReadVersion]);
  
  // Parent group context (Phase 4) — for child events within groups
  // Get child events for this group (both active and completed)
  const { activeChildEvents, completedChildEvents } = useStore((s) => {
    if (!isGroupHub) return { activeChildEvents: [], completedChildEvents: [] };
    
    const allEvents = [...(s.events || []), ...(s.completedEvents || [])];
    const groupEvents = allEvents.filter((e: any) => e.hubType !== 'group' && e.parentGroupId === id);
    
    const active = groupEvents
      .filter((e: any) => !e.isCompleted)
      .sort((a: any, b: any) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    
    const completed = groupEvents
      .filter((e: any) => e.isCompleted)
      .sort((a: any, b: any) => new Date(b.completedAt || b.lastModified).getTime() - new Date(a.completedAt || a.lastModified).getTime());
    
    return { activeChildEvents: active, completedChildEvents: completed };
  });
  
  // For backward compatibility
  const childEvents = activeChildEvents;
  
  // State for showing history
  const [showHistory, setShowHistory] = useState(false);
  
  // Separate into events user has joined vs not joined
  const { joinedEvents, unjoinedEvents } = useMemo(() => {
    const joined: typeof childEvents = [];
    const unjoined: typeof childEvents = [];
    
    childEvents.forEach((e: any) => {
      const isInEvent = currentProfile && e.golfers?.some((g: any) => g.profileId === currentProfile.id);
      if (isInEvent) {
        joined.push(e);
      } else {
        unjoined.push(e);
      }
    });
    
    return { joinedEvents: joined, unjoinedEvents: unjoined };
  }, [childEvents, currentProfile?.id]);
  
  // Header badges / counts
  const stats = useMemo(() => {
    const golferCount = event.golfers.length;
    return { golferCount };
  }, [event.golfers.length]);

  // Swipeable page refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Define tabs based on hub type
  // Events: Leaderboard first (primary view), Chat one swipe away
  // Groups: Chat first (primary view)
  const tabs = isGroupHub
    ? [
        { id: 'chat', label: 'Chat', icon: '💬' },
        { id: 'events', label: 'Events', icon: '🎯', badge: activeChildEvents.length || undefined },
        { id: 'golfers', label: 'Members', icon: '👥', badge: stats.golferCount },
        ...(isOwner ? [
          { id: 'settings', label: 'Settings', icon: '⚙️' },
        ] : []),
      ]
    : [
        { id: 'scorecard', label: 'Leaderboard', icon: <LeaderboardIcon className="w-5 h-5" /> },
        { id: 'games', label: 'Games', icon: '💰' },
        { id: 'golfers', label: 'Golfers', icon: '👥', badge: stats.golferCount },
        { id: 'chat', label: 'Chat', icon: '💬', badge: chatUnread > 0 ? chatUnread : undefined },
        ...(isOwner ? [
          { id: 'alerts', label: 'Alerts', icon: '🔔', isModal: true },
          { id: 'settings', label: 'Settings', icon: '⚙️' },
        ] : []),
      ];
  
  // Filter out modal-only tabs for swipeable pages
  const swipeableTabs = tabs.filter(t => !(t as any).isModal);
  
  // Handle scroll to update active page index
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const pageWidth = container.clientWidth;
    const newIndex = Math.round(scrollLeft / pageWidth);
    if (newIndex !== activePageIndex && newIndex >= 0 && newIndex < swipeableTabs.length) {
      setActivePageIndex(newIndex);
    }
  }, [activePageIndex, swipeableTabs.length]);
  
  // Scroll to page when tab is clicked
  const scrollToPage = useCallback((index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const pageWidth = container.clientWidth;
    container.scrollTo({ left: index * pageWidth, behavior: 'smooth' });
    setActivePageIndex(index);
  }, []);

  const openEventPanel = useCallback((panel: 'games' | 'golfers' | 'settings' | 'chat') => {
    setShowMenu(false);
    if (panel === 'games') setGamesSubTab('games');
    setEventOverlay(panel);
  }, []);

  const openGamesPanel = useCallback((subTab: 'games' | 'payouts' = 'games') => {
    setGamesSubTab(subTab);
    setShowMenu(false);
    setEventOverlay('games');
  }, []);

  const goToEventSection = useCallback(
    (section: 'scorecard' | 'games' | 'golfers' | 'chat', closeModal?: () => void) => {
      closeModal?.();
      if (useLeaderboardHub) {
        if (section === 'scorecard') setEventOverlay(null);
        else openEventPanel(section);
      } else {
        const idx = swipeableTabs.findIndex((t) => t.id === section);
        if (idx >= 0) scrollToPage(idx);
      }
    },
    [useLeaderboardHub, openEventPanel, scrollToPage, swipeableTabs]
  );

  const handleDelete = () => {
    if (window.confirm(`Delete "${event.name}"? This cannot be undone.`)) {
      // Navigate first to avoid blank screen, then delete
      navigate('/', { replace: true });
      deleteEvent(id!);
    }
  };

  // Determine if on chat page (for showing composer)
  // Chat is index 0 for groups, index 3 for events (after Leaderboard, Games, Golfers)
  const chatSwipeIndex = isGroupHub ? 0 : swipeableTabs.findIndex(t => t.id === 'chat');
  const gamesSwipeIndex = swipeableTabs.findIndex(t => t.id === 'games');
  const isChatPage = activePageIndex === chatSwipeIndex;
  
  // Mark group chat as read when viewing chat tab.
  // For group hubs, mark this group's chat. For child events of a group,
  // mark the parent group's chat (since Phase 2 unified chat routing means
  // child events display the parent group's conversation).
  useEffect(() => {
    if (isChatPage) {
      const targetId = event.parentGroupId || event.id;
      markChatAsRead(targetId);
      setChatReadVersion((v) => v + 1);
    }
  }, [isGroupHub, isChatPage, event?.id, event?.parentGroupId]);

  useEffect(() => {
    if (eventOverlay === 'chat') {
      const targetId = getChatTargetId(event);
      markChatAsRead(targetId);
      setChatReadVersion((v) => v + 1);
    }
  }, [eventOverlay, event?.id, event?.parentGroupId]);

  
  
  // Inline join handler for group event banners
  const handleInlineJoin = async (evt: any) => {
    if (joiningEventId) return;
    setJoiningEventId(evt.id);
    try {
      const code = evt.shareCode || (await generateShareCode(evt.id));
      if (!code) throw new Error('Missing join code');
      const result = await joinEventByCode(code);
      if (!result.success) throw new Error(result.error || 'Failed to join');
      addToast('Joined event!', 'success');
      navigate(`/event/${evt.id}`);
    } catch (e: any) {
      addToast(e?.message || 'Could not join event', 'error');
    } finally {
      setJoiningEventId(null);
    }
  };

  // ========== COMMAND CENTER STATE (Admin only, non-group events) ==========
  const updateEvent = useStore((s: any) => s.updateEvent);
  const completeEvent = useStore((s) => s.completeEvent);
  const addGolferToEvent = useStore((s: any) => s.addGolferToEvent);
  
  const ccData = useMemo(() => {
    if (isGroupHub || !isOwner || !event) return null;
    
    const nassauArray = event.games?.nassau || [];
    const skinsArray = Array.isArray(event.games?.skins) ? event.games.skins : [];
    const pinkyArray = Array.isArray(event.games?.pinky) ? event.games.pinky : [];
    const greenieArray = Array.isArray(event.games?.greenie) ? event.games.greenie : [];
    const stablefordArray = Array.isArray(event.games?.stableford) ? event.games.stableford : [];
    const ninePointArray = Array.isArray(event.games?.ninePoint) ? event.games.ninePoint : [];
    const bbbArray = Array.isArray(event.games?.bingoBangoBongo) ? event.games.bingoBangoBongo : [];
    const wolfArray = Array.isArray(event.games?.wolf) ? event.games.wolf : [];
    const dotsArray = Array.isArray(event.games?.dots) ? event.games.dots : [];
    
    const totalGames = nassauArray.length + skinsArray.length + pinkyArray.length + greenieArray.length + stablefordArray.length + ninePointArray.length + bbbArray.length + wolfArray.length + dotsArray.length;
    
    const eventStatus = event.status || (event.isCompleted ? 'completed' : 'setup');
    const isStarted = eventStatus === 'started';
    const isCompleted = eventStatus === 'completed' || event.isCompleted;
    const playerCount = event.golfers?.length || 0;
    
    // Nassau teams check
    const hasNassau = nassauArray.length > 0;
    const nassauTeamsDone = nassauArray.every((n: any) => {
      const teams = n.teams || [];
      const filled = teams.filter((t: any) => (t.golferIds || []).length > 0);
      return filled.length >= 2;
    });
    
    // Start issues — validate each game's own participant list, not total event count
    const issues: string[] = [];
    if (totalGames === 0) issues.push('No games added yet');
    if (hasNassau && !nassauTeamsDone) issues.push('Nassau teams need to be picked');
    if (hasNassau && playerCount < 2) issues.push('Nassau needs at least 2 players');
    ninePointArray.forEach((np: any, idx: number) => {
      const npCount = (np.participantGolferIds || []).length;
      if (npCount !== 3) issues.push(`9-Point${ninePointArray.length > 1 ? ` #${idx + 1}` : ''}: Needs exactly 3 players (${npCount} selected)`);
    });
    wolfArray.forEach((w: any, idx: number) => {
      const wCount = (w.participantGolferIds || []).length;
      if (wCount !== 4) issues.push(`Wolf${wolfArray.length > 1 ? ` #${idx + 1}` : ''}: Needs exactly 4 players (${wCount} selected)`);
    });
    const needsTwo = skinsArray.length + pinkyArray.length + greenieArray.length + stablefordArray.length + bbbArray.length + dotsArray.length;
    if (needsTwo > 0 && playerCount < 2) issues.push(`Games need at least 2 players (${playerCount} in event)`);
    
    const canStart = issues.length === 0;
    const allScoresComplete = event.scorecards?.every((sc: any) =>
      sc.scores?.every((s: any) => s.strokes != null)
    );
    
    // Suggested team count
    const suggestedTeams = playerCount <= 8 ? 2 : playerCount <= 12 ? 3 : 4;
    
    // Which step is current: Players(0) → Games(1) → Teams(2) → Start(3) → Play(4) → Done(5)
    let currentStep = 0;
    if (isCompleted) currentStep = 5;
    else if (isStarted) currentStep = 4;
    else if (canStart) currentStep = 3;
    else if (totalGames > 0 && hasNassau && !nassauTeamsDone) currentStep = 2;
    else if (totalGames > 0) currentStep = 3;
    else if (playerCount > 0) currentStep = 1;
    
    return {
      totalGames, isStarted, isCompleted, playerCount, hasNassau, nassauTeamsDone,
      issues, canStart, allScoresComplete, suggestedTeams, currentStep,
      nassauArray, firstNassauId: nassauArray[0]?.id,
      allowSharedScoreEntry: event.settings?.allowSharedScoreEntry !== false,
      guestCount: (event.golfers || []).filter((g: any) => !g.profileId).length,
    };
  }, [event, isGroupHub, isOwner]);

  const handleCCStartEvent = () => {
    if (!ccData?.canStart) {
      alert('Cannot start event:\n\n' + (ccData?.issues || []).map((i: string) => '• ' + i).join('\n'));
      return;
    }
    if (window.confirm('Start the event? This will lock the games. You can unlock later if needed.')) {
      updateEvent(id!, { status: 'started' });
      setShowCommandCenter(false);
    }
  };

  const handleCCCompleteEvent = () => {
    // Detailed confirmation — money and handicaps are at stake
    const confirmed = window.confirm(
      'Complete this event?\n\n' +
      '⚠️ This action cannot be undone.\n\n' +
      '• All scores will be finalized\n' +
      '• Payouts will be locked and calculated\n' +
      '• Round data will be saved to handicap history\n' +
      '• The event moves to completed/history\n\n' +
      'Are you sure you want to proceed?'
    );
    if (!confirmed) return;

    const success = completeEvent(id!);
    if (success) {
      // Prompt to send round recap immediately after completing
      const sendRecap = window.confirm(
        '✅ Event Completed!\n\n' +
        'All scores and payouts are now final.\n\n' +
        'Would you like to send a Round Recap to all players now?\n' +
        '(Results, standings, and payouts)'
      );
      if (sendRecap) {
        alert('Round recap sent to all players! 📤');
      }
    }
    setShowCommandCenter(false);
  };

  const handleCCUnlock = () => {
    if (window.confirm('Unlock the event? This will allow changes to games.')) {
      updateEvent(id!, { status: 'setup' });
    }
  };

  // Event banners now live inside ChatTab (Phase 3C) — this var kept for old events dropdown compat
  const bannerEvents: any[] = [];

  // Icon-only tabs (no labels): saves space and removes sideways scrolling.
  const tabPillClass =
    'flex items-center justify-center w-10 h-10 rounded-xl font-semibold text-[11px] transition-all flex-shrink-0';
  const tabBarClass = 'flex gap-1.5 px-3 pb-1 -mx-3 justify-center';

  return (
    <div className={`h-full min-h-0 -mx-4 -mt-4 flex flex-col ${useLeaderboardHub ? 'bg-slate-100 dark:bg-slate-950' : ''}`}>
      {useLeaderboardHub ? (
        <div className="sticky top-0 z-30 flex-shrink-0 px-3 py-2 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            {parentGroup && (
              <button
                onClick={() => navigate(`/event/${parentGroup.id}`)}
                className="flex-shrink-0 p-1.5 -ml-0.5 rounded-lg text-slate-500 hover:bg-slate-200/80 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                aria-label="Back to group"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
                {event.name || 'Untitled Event'}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                {parentGroup && (
                  <>
                    <span className="truncate max-w-[100px]">{parentGroup.name}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                  </>
                )}
                {courseName && (
                  <>
                    <span className="truncate max-w-[120px]">{courseName}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                  </>
                )}
                <span className="flex-shrink-0 whitespace-nowrap">
                  {formatLocalDate(event.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                {event.isCompleted && (
                  <span className="px-1 py-0.5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 rounded text-[9px] font-bold flex-shrink-0">
                    DONE
                  </span>
                )}
                {event.shareCode && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(event.shareCode || '');
                      addToast('Join code copied!', 'success');
                    }}
                    className="px-1 py-0.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-mono text-[10px] font-bold tracking-wider flex-shrink-0"
                    title="Copy join code"
                  >
                    {event.shareCode}
                  </button>
                )}
              </div>
            </div>
            {ccData ? (
              <button
                onClick={() => setShowCommandCenter(true)}
                className={`relative flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center text-base transition-colors active:scale-95 ${
                  ccData.isCompleted
                    ? 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/80 dark:border-green-800 dark:text-green-400'
                    : ccData.isStarted
                      ? 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/80 dark:border-orange-800 dark:text-orange-400'
                      : 'border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200'
                }`}
                title="Game control"
                aria-label="Game control"
              >
                🎛️
                {ccData.isStarted && !ccData.isCompleted && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-slate-900" />
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowPlayerGuide(true)}
                className="flex-shrink-0 w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 flex items-center justify-center text-base active:scale-95"
                title="Game control"
                aria-label="Game control"
              >
                🎛️
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMenu((v) => !v)}
              className="relative flex-shrink-0 w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
              aria-label="Event menu"
              title="More"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {(chatUnread > 0 || stats.golferCount > 0) && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-extrabold leading-none flex items-center justify-center bg-orange-500 text-white">
                  {chatUnread > 0 ? (chatUnread > 9 ? '9+' : chatUnread) : '·'}
                </span>
              )}
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Header - Compact & Sticky (group hubs) */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-3 py-2 shadow-lg sticky top-0 z-30 flex-shrink-0">
        {/* Event Info Row */}
        <div className="flex items-center gap-2">
          {/* Back button — child events navigate back to parent group */}
          {parentGroup && (
            <button
              onClick={() => navigate(`/event/${parentGroup.id}`)}
              className="flex-shrink-0 p-1.5 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Back to group"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate leading-tight">
              {event.name || 'Untitled Event'}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-primary-200">
              {/* Breadcrumb: show parent group name for child events */}
              {parentGroup && (
                <>
                  <span className="truncate max-w-[120px] text-primary-300">{parentGroup.name}</span>
                  <span className="text-primary-400">·</span>
                </>
              )}
              {courseName && <span className="truncate max-w-[120px]">{courseName}</span>}
              {courseName && <span className="text-primary-400">•</span>}
              <span className="flex-shrink-0">
                {formatLocalDate(event.date, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {event.isCompleted && (
                <span className="px-1 py-0.5 bg-green-500/20 text-green-300 rounded text-[8px] font-bold flex-shrink-0">
                  DONE
                </span>
              )}
              {event.shareCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(event.shareCode || '');
                    addToast('Join code copied!', 'success');
                  }}
                  className="px-1.5 py-0.5 bg-white/10 hover:bg-white/15 text-white rounded text-[8px] font-bold tracking-[0.18em] flex-shrink-0"
                  title="Copy join code"
                >
                  {event.shareCode}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation — events: hub menu; groups: swipe tabs */}
        <div className="flex items-center pb-1 relative">
          {ccData && !isGroupHub ? (
            <button
              onClick={() => setShowCommandCenter(true)}
              className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg transition-all active:scale-95 flex-shrink-0 ${
                ccData.isCompleted
                  ? 'bg-green-500 text-white'
                  : ccData.isStarted
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                    : 'bg-gradient-to-r from-accent to-orange-500 text-white'
              }`}
            >
              <span className="text-base leading-none">🎛️</span>
              {ccData.isStarted && !ccData.isCompleted && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-primary-800 animate-pulse-subtle" />
              )}
            </button>
          ) : !isGroupHub ? (
            <button
              onClick={() => setShowPlayerGuide(true)}
              className="relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg transition-all active:scale-95 flex-shrink-0 bg-gradient-to-r from-accent to-orange-500 text-white"
            >
              <span className="text-base leading-none">🎛️</span>
            </button>
          ) : (
            <div className="w-0" />
          )}

          {useLeaderboardHub ? (
            <div className="flex-1 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Event menu"
                title="More"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {(chatUnread > 0 || stats.golferCount > 0) && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-extrabold leading-none flex items-center justify-center bg-orange-500 text-white">
                    {chatUnread > 0 ? (chatUnread > 9 ? '9+' : chatUnread) : '·'}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex-1 flex gap-1.5 justify-center">
          {tabs.map((tab, index) => {
            // Find the swipeable index for this tab (or -1 if modal-only)
            const swipeIndex = swipeableTabs.findIndex(t => t.id === tab.id);
            const isActive = swipeIndex === activePageIndex;
            const badge = tab.badge as number | undefined;
            
            // Alerts tab opens modal
            if (tab.id === 'alerts') {
              return (
                <button
                  key={tab.id}
                  onClick={() => setShowNotifications(true)}
                  aria-label={tab.label}
                  title={tab.label}
                  className={`relative ${tabPillClass} bg-white/10 text-white/85 hover:bg-white/20 hover:text-white`}
                >
                  <span className="text-base leading-none" aria-hidden="true">{tab.icon}</span>
                </button>
              );
            }
            
            // Events tab (groups) opens dropdown
            if (tab.id === 'events') {
              return (
                <button
                  key={tab.id}
                  onClick={() => setShowEventsDropdown(!showEventsDropdown)}
                  aria-label={tab.label}
                  title={tab.label}
                  className={`relative ${tabPillClass} ${
                    showEventsDropdown
                      ? 'bg-white text-primary-800 shadow-sm'
                      : badge && badge > 0
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden="true">{tab.icon}</span>
                  {typeof badge === 'number' && badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-extrabold leading-none flex items-center justify-center bg-white/30 text-white">
                      {badge}
                    </span>
                  )}
                </button>
              );
            }
            
            // Regular swipeable tab
            return (
              <button
                key={tab.id}
                onClick={() => scrollToPage(swipeIndex)}
                aria-label={tab.label}
                title={tab.label}
                className={`relative ${tabPillClass} ${
                  isActive
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'bg-white/10 text-white/85 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span className="text-base leading-none" aria-hidden="true">{tab.icon}</span>
                {typeof badge === 'number' && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-extrabold leading-none flex items-center justify-center ${
                    isActive ? 'bg-primary-100 text-primary-800' : 'bg-white/20 text-white'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
            </div>
          )}
        </div>

        {!useLeaderboardHub && (
        <div className="flex justify-center gap-1.5 pb-2">
          {swipeableTabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => scrollToPage(index)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === activePageIndex
                  ? 'bg-white w-3'
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to ${tab.label}`}
            />
          ))}
        </div>
        )}
      </div>
      </>
      )}

      {/* Event hub menu (live rounds) */}
      {useLeaderboardHub && showMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowMenu(false)} />
          <div className="fixed right-3 top-12 z-50 w-56">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-1 overflow-hidden">
              <button
                type="button"
                onClick={() => openEventPanel('games')}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
              >
                <span className="text-lg">💰</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">Games & Payouts</div>
                  <div className="text-[10px] text-gray-500">Side games, matchups, totals</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => openEventPanel('golfers')}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-gray-100"
              >
                <span className="text-lg">👥</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">Golfers</div>
                  <div className="text-[10px] text-gray-500">{stats.golferCount} in this event</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => openEventPanel('chat')}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-gray-100"
              >
                <span className="text-lg">💬</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900">Full Chat</div>
                  <div className="text-[10px] text-gray-500">Group thread & photos</div>
                </div>
                {chatUnread > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {chatUnread > 9 ? '9+' : chatUnread}
                  </span>
                )}
              </button>
              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowNotifications(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-gray-100"
                  >
                    <span className="text-lg">🔔</span>
                    <div className="text-sm font-bold text-gray-900">Alerts</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEventPanel('settings')}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-t border-gray-100"
                  >
                    <span className="text-lg">⚙️</span>
                    <div className="text-sm font-bold text-gray-900">Settings</div>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Guest banner */}
      {getGuestSession() && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-600 font-semibold">Playing as Guest</span>
            <span className="text-amber-500/60">·</span>
            <span className="text-amber-600/70 text-xs">Stats won't be saved</span>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-full transition-colors"
          >
            Sign Up
          </button>
        </div>
      )}
      
      {/* Events Dropdown Modal - Groups only */}
      {isGroupHub && showEventsDropdown && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowEventsDropdown(false)} />
          <div className="fixed left-4 right-4 top-28 z-50 max-w-sm mx-auto">
            <div className="bg-white rounded-xl shadow-xl border border-gray-200 py-2 max-h-80 overflow-y-auto">
              {childEvents.length === 0 ? (
                <div className="px-4 py-3 text-center">
                  <div className="text-2xl mb-2">📅</div>
                  <div className="text-sm font-semibold text-gray-700">No events yet</div>
                  <p className="text-xs text-gray-500 mt-1">Create an event for this group</p>
                  <button
                    onClick={() => {
                      setShowEventsDropdown(false);
                      setShowCreateEvent(true);
                    }}
                    className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
                  >
                    + Create Event
                  </button>
                </div>
              ) : (
                <>
                  {/* Joined events */}
                  {joinedEvents.length > 0 && (
                    <div className="px-3 py-1">
                      <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Your Events</div>
                      {joinedEvents.map((evt: any) => (
                        <button
                          key={evt.id}
                          onClick={() => {
                            setShowEventsDropdown(false);
                            navigate(`/event/${evt.id}`);
                          }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-green-50 transition-colors text-left mb-1"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm truncate">{evt.name || 'Event'}</div>
                            <div className="text-[10px] text-gray-500">
                              {evt.date ? formatDateShort(evt.date) : ''} • {evt.golfers?.length || 0} players
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">
                            JOINED
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Unjoined events */}
                  {unjoinedEvents.length > 0 && (
                    <div className={`px-3 py-1 ${joinedEvents.length > 0 ? 'border-t border-gray-100' : ''}`}>
                      <div className="text-[10px] font-bold text-primary-600 uppercase tracking-wider mb-1 mt-1">Available to Join</div>
                      {unjoinedEvents.map((evt: any) => (
                        <div key={evt.id} className="mb-2 last:mb-0">
                          <div className="px-3 py-2 rounded-lg bg-gray-50">
                            <div className="font-semibold text-gray-900 text-sm">{evt.name || 'Event'}</div>
                            <div className="text-[10px] text-gray-500 mb-2">
                              {evt.date ? formatDateShort(evt.date) : ''}{evt.course?.teeName ? ` • ${evt.course.teeName}` : ''}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    const code = evt.shareCode || (await generateShareCode(evt.id));
                                    if (!code) throw new Error('Missing join code');
                                    const result = await joinEventByCode(code);
                                    if (!result.success) throw new Error(result.error || 'Failed to join');
                                    addToast('Joined event', 'success');
                                    setShowEventsDropdown(false);
                                    navigate(`/event/${evt.id}`);
                                  } catch (e: any) {
                                    addToast(e?.message || 'Could not join event', 'error');
                                  }
                                }}
                                className="flex-1 bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-lg text-xs font-bold"
                              >
                                Join
                              </button>
                              <button
                                onClick={() => {
                                  setShowEventsDropdown(false);
                                  navigate(`/event/${evt.id}`);
                                }}
                                className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-bold text-gray-700"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* History toggle */}
                  {completedChildEvents.length > 0 && (
                    <div className="px-3 py-2 border-t border-gray-100">
                      <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-600 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span>📜</span>
                          <span>History ({completedChildEvents.length})</span>
                        </span>
                        <svg className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showHistory && (
                        <div className="mt-2 space-y-1">
                          {completedChildEvents.slice(0, 10).map((evt: any) => (
                            <button
                              key={evt.id}
                              onClick={() => {
                                setShowEventsDropdown(false);
                                navigate(`/event/${evt.id}`);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-gray-700 text-sm truncate">{evt.name || 'Event'}</div>
                                <div className="text-[10px] text-gray-500">
                                  {evt.date ? formatDateShort(evt.date) : ''} • {evt.golfers?.length || 0} players
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                ✓ DONE
                              </span>
                            </button>
                          ))}
                          {completedChildEvents.length > 10 && (
                            <div className="text-[10px] text-gray-500 text-center py-1">
                              +{completedChildEvents.length - 10} more events
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Create new event button */}
                  <div className="px-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => {
                        setShowEventsDropdown(false);
                        setShowCreateEvent(true);
                      }}
                      className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      + New Event
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Group event banners moved into ChatTab (Phase 3C) and Events into GroupEventsTab (Phase 3B) */}
      {false && (
        <div></div>
      )}

      {useLeaderboardHub ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="pb-28">
            <ScoreHubTab
              eventId={event.id}
              isTabActive
              chatUnread={chatUnread}
              onOpenFullChat={() => openEventPanel('chat')}
              onOpenGamesTab={(subTab = 'games') => openGamesPanel(subTab)}
              onChatRead={() => setChatReadVersion((v) => v + 1)}
            />
          </div>
        </div>
      ) : (
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden snap-x snap-mandatory flex"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Hide scrollbar */}
        <style>{`.snap-x::-webkit-scrollbar { display: none; }`}</style>
        
        {swipeableTabs.map((tab) => (
          <div 
            key={tab.id}
            className="w-full flex-shrink-0 snap-center overflow-y-auto"
            style={{ minWidth: '100%' }}
          >
            <div className={tab.id === 'chat' ? 'h-full' : 'px-4 py-2 pb-32'}>
              {tab.id === 'chat' && <ChatTab eventId={event.id} isActive={isChatPage} />}
              {tab.id === 'events' && <GroupEventsTab eventId={event.id} />}
              {tab.id === 'scorecard' && (
                <ScoreHubTab
                  eventId={event.id}
                  isTabActive={swipeableTabs[activePageIndex]?.id === 'scorecard'}
                  chatUnread={chatUnread}
                  onOpenFullChat={() => {
                    if (chatSwipeIndex >= 0) scrollToPage(chatSwipeIndex);
                  }}
                  onOpenGamesTab={(subTab = 'games') => {
                    setGamesSubTab(subTab);
                    if (gamesSwipeIndex >= 0) scrollToPage(gamesSwipeIndex);
                  }}
                  onChatRead={() => setChatReadVersion((v) => v + 1)}
                />
              )}
              {tab.id === 'games' && (
                <GamesTab
                  eventId={event.id}
                  isTabActive={swipeableTabs[activePageIndex]?.id === 'games'}
                  autoOpenAddGame={triggerAddGame}
                  initialSubTab={gamesSubTab}
                />
              )}
              {tab.id === 'golfers' && <GolfersTab eventId={event.id} isTabActive={swipeableTabs[activePageIndex]?.id === 'golfers'} />}
              {tab.id === 'settings' && (isOwner ? <SetupTab eventId={event.id} /> : <AccessDenied />)}
            </div>
          </div>
        ))}
      </div>
      )}
      
      {/* Modals */}
      
      {showNotifications && (
        <EventNotifications
          event={event}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {useLeaderboardHub && eventOverlay && createPortal(
        <div
          className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px] flex flex-col justify-end sm:justify-center sm:p-4"
          onClick={() => setEventOverlay(null)}
        >
          <div
            className="bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-lg mx-auto max-h-[min(92vh,800px)] flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
              <div className="font-bold text-sm text-gray-900">
                {eventOverlay === 'games' && 'Games & Payouts'}
                {eventOverlay === 'golfers' && 'Golfers'}
                {eventOverlay === 'chat' && 'Event Chat'}
                {eventOverlay === 'settings' && 'Event Settings'}
              </div>
              <button
                type="button"
                onClick={() => setEventOverlay(null)}
                className="p-2 rounded-full hover:bg-slate-200 text-gray-500"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {eventOverlay === 'games' && (
                <GamesTab
                  eventId={event.id}
                  isTabActive
                  autoOpenAddGame={triggerAddGame}
                  initialSubTab={gamesSubTab}
                />
              )}
              {eventOverlay === 'golfers' && <GolfersTab eventId={event.id} isTabActive />}
              {eventOverlay === 'chat' && (
                <div className="h-[min(72vh,640px)] flex flex-col">
                  <ChatTab eventId={event.id} isActive embedded />
                </div>
              )}
              {eventOverlay === 'settings' && (isOwner ? <SetupTab eventId={event.id} /> : <AccessDenied />)}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========== PLAYER GAME GUIDE MODAL ========== */}
      {showPlayerGuide && !isGroupHub && createPortal(
        <div
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowPlayerGuide(false)}
        >
          <div
            className="bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-5 pt-5 pb-4 ${
              event.isCompleted
                ? 'bg-gradient-to-br from-green-600 to-emerald-700'
                : event.status === 'started'
                  ? 'bg-gradient-to-br from-primary-600 to-primary-800'
                  : 'bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.15em] text-white/60 uppercase">Game Control</div>
                  <div className="text-lg font-extrabold text-white">{event.name || 'Event'}</div>
                </div>
                <button onClick={() => setShowPlayerGuide(false)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${
                  event.isCompleted
                    ? 'bg-white/20 text-white'
                    : event.status === 'started'
                      ? 'bg-red-500/30 text-red-200'
                      : 'bg-amber-400/20 text-amber-200'
                }`}>
                  {event.status === 'started' && !event.isCompleted && (
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse mr-1 align-middle" />
                  )}
                  {event.isCompleted ? 'COMPLETE' : event.status === 'started' ? 'LIVE' : 'SETTING UP'}
                </div>
                <span className="text-white/50 text-xs">
                  {(event.golfers?.length || 0)} player{(event.golfers?.length || 0) !== 1 ? 's' : ''}
                  {(() => {
                    const gameCount = (event.games?.nassau?.length || 0) + (Array.isArray(event.games?.skins) ? event.games.skins.length : 0) +
                      (Array.isArray(event.games?.pinky) ? event.games.pinky.length : 0) + (Array.isArray(event.games?.greenie) ? event.games.greenie.length : 0) +
                      (Array.isArray(event.games?.stableford) ? event.games.stableford.length : 0) + (Array.isArray(event.games?.ninePoint) ? event.games.ninePoint.length : 0) +
                      (Array.isArray(event.games?.bingoBangoBongo) ? event.games.bingoBangoBongo.length : 0) + (Array.isArray(event.games?.wolf) ? event.games.wolf.length : 0) +
                      (Array.isArray(event.games?.dots) ? event.games.dots.length : 0);
                    return gameCount > 0 ? ` · ${gameCount} game${gameCount !== 1 ? 's' : ''}` : '';
                  })()}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="divide-y divide-slate-100 max-h-[55vh] overflow-y-auto">

              {/* Pre-start: Setting up */}
              {event.status !== 'started' && !event.isCompleted && (
                <div className="p-4">
                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-2xl">⏳</span>
                    <div>
                      <div className="font-bold text-amber-800">Event is being set up</div>
                      <div className="text-xs text-amber-600">The admin is configuring games and teams. You'll be notified when the round starts.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Enter Scores — only when live */}
              {event.status === 'started' && !event.isCompleted && (
                <button
                  onClick={() => goToEventSection('scorecard', () => setShowPlayerGuide(false))}
                  className="w-full p-4 flex items-center gap-4 hover:bg-green-50 active:bg-green-100 transition text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-green-500 flex items-center justify-center text-lg shadow-sm">
                    <span className="text-white">✏️</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-green-700">Enter Scores</div>
                    <div className="text-xs text-gray-500">Tap the + button on the leaderboard to enter your scores hole-by-hole</div>
                  </div>
                  <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Leaderboard */}
              <button
                onClick={() => goToEventSection('scorecard', () => setShowPlayerGuide(false))}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center text-lg shadow-sm">
                  <span className="text-white">📊</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-gray-900">Leaderboard</div>
                  <div className="text-xs text-gray-500">
                    {event.isCompleted ? 'View final standings and positions' : event.status === 'started' ? 'Live standings — see where you rank' : 'Standings will appear when the round starts'}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Games & Payouts */}
              <button
                onClick={() => goToEventSection('games', () => setShowPlayerGuide(false))}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-lg shadow-sm">
                  <span className="text-white">💰</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-gray-900">Games & Payouts</div>
                  <div className="text-xs text-gray-500">
                    {event.isCompleted ? 'Final payouts — who owes what' : event.status === 'started' ? 'Your side games, matchups & running totals' : 'Games will show here once the admin sets them up'}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Chat */}
              <button
                onClick={() => goToEventSection('chat', () => setShowPlayerGuide(false))}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center text-lg shadow-sm">
                  <span className="text-white">💬</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-gray-900">Chat</div>
                  <div className="text-xs text-gray-500">Talk trash, share photos & coordinate with the group</div>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* My Team — show if nassau teams exist */}
              {event.games?.nassau?.some((n: any) => n.teams?.length >= 2) && (
                <div className="p-4">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Team</div>
                  {event.games.nassau.map((n: any, nIdx: number) => {
                    const myTeam = (n.teams || []).find((t: any) => (t.golferIds || []).includes(currentProfile?.id));
                    if (!myTeam) return null;
                    const teammates = (myTeam.golferIds || [])
                      .filter((gid: string) => gid !== currentProfile?.id)
                      .map((gid: string) => {
                        const eg = event.golfers?.find((g: any) => (g.profileId || g.customName) === gid);
                        return eg?.displayName || eg?.customName || gid;
                      });
                    return (
                      <div key={n.id} className="flex items-center gap-2 bg-primary-50 rounded-xl px-3 py-2 border border-primary-100">
                        <span className="text-lg">👥</span>
                        <div>
                          <div className="font-bold text-primary-800 text-sm">{myTeam.name || `Team ${nIdx + 1}`}</div>
                          <div className="text-[10px] text-primary-600">
                            {teammates.length > 0 ? `with ${teammates.join(', ')}` : 'Just you so far'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <button onClick={() => setShowPlayerGuide(false)} className="w-full py-2.5 text-center text-sm font-bold text-gray-500 hover:text-gray-700 transition">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========== FIRST-TIME EVENT HELP MODAL (compact) ========== */}
      {showEventHelp && !isGroupHub && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={() => dismissEventHelp(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[75vh] flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — compact */}
            <div className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 px-4 pt-5 pb-4 rounded-t-2xl text-center flex-shrink-0">
              <button
                onClick={() => dismissEventHelp(false)}
                className="absolute top-2.5 right-2.5 p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-3xl mb-1">⛳</div>
              <h2 className="text-lg font-bold text-white">
                {isOwner ? 'You\'re the Admin!' : 'Welcome to the Event!'}
              </h2>
              <p className="text-primary-100 text-xs">
                {isOwner ? 'Here\'s how to run your event' : 'Here\'s what you can do'}
              </p>
            </div>

            {/* Content — scrollable */}
            <div className="px-4 py-3 space-y-2 overflow-y-auto flex-1 min-h-0">
              {isOwner ? (
                <>
                  <button
                    onClick={() => { dismissEventHelp(false); setShowCommandCenter(true); }}
                    className="w-full flex items-center gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200 hover:bg-orange-100 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-orange-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🎛️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">Game Control</div>
                      <p className="text-xs text-gray-500">Pick games, teams, start & complete — all here.</p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">💰</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">Games Tab</div>
                      <p className="text-xs text-gray-500">Standings, payouts & the orange + to add games.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">📋</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">The Flow</div>
                      <p className="text-xs text-gray-500">Games → Teams → Start → Play → Complete → Recap.</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100 text-left">
                    <div className="w-9 h-9 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🏌️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">Enter Scores</div>
                      <p className="text-xs text-gray-500">Tap the orange + on the Leaderboard tab.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">📊</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">Leaderboard</div>
                      <p className="text-xs text-gray-500">Live standings updated as scores come in.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">💰</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">Games & Payouts</div>
                      <p className="text-xs text-gray-500">Side games, matchups & who owes what.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">💬</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-gray-900">Chat</div>
                      <p className="text-xs text-gray-500">Trash talk, photos & coordination.</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer — always visible (sticky) */}
            <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-1.5 flex-shrink-0">
              <button
                onClick={() => {
                  dismissEventHelp(false);
                  if (isOwner) setShowCommandCenter(true);
                }}
                className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 ${
                  isOwner
                    ? 'bg-gradient-to-r from-accent to-orange-600 text-white hover:opacity-90'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {isOwner ? (
                  <><span>🎛️</span> Open Game Control</>
                ) : (
                  <><span>👍</span> Got It — Let's Play!</>
                )}
              </button>
              <button
                onClick={() => dismissEventHelp(true)}
                className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1.5"
              >
                Don't show this again
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create Event Wizard - opens inline within the group (no redirect to home) */}
      {isGroupHub && (
        <CreateEventWizard
          isOpen={showCreateEvent}
          onClose={() => setShowCreateEvent(false)}
          parentGroupId={id}
          onCreated={(eventId) => {
            setShowCreateEvent(false);
            navigate(`/event/${eventId}`);
          }}
        />
      )}

      {/* ========== ADMIN GAME CONTROL MODAL ========== */}
      {showCommandCenter && ccData && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowCommandCenter(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Bold gradient */}
            <div className={`px-5 pt-5 pb-4 ${
              ccData.isCompleted
                ? 'bg-gradient-to-br from-green-600 to-emerald-700'
                : ccData.isStarted
                  ? 'bg-gradient-to-br from-green-600 to-green-800'
                  : 'bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.2em] text-white/60 uppercase">Admin Game Control</div>
                  <div className="text-xl font-black text-white mt-0.5">{event.name || 'Event'}</div>
                </div>
                <button
                  onClick={() => setShowCommandCenter(false)}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1.5 ${
                  ccData.isCompleted
                    ? 'bg-white/20 text-white'
                    : ccData.isStarted
                      ? 'bg-red-500/30 text-red-200'
                      : 'bg-amber-400/20 text-amber-200'
                }`}>
                  {ccData.isStarted && !ccData.isCompleted && (
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  )}
                  {ccData.isCompleted ? 'COMPLETED' : ccData.isStarted ? 'LIVE' : 'SETTING UP'}
                </div>
                <div className="text-[11px] text-white/50 font-medium">
                  {ccData.playerCount} player{ccData.playerCount !== 1 ? 's' : ''} · {ccData.totalGames} game{ccData.totalGames !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex gap-1">
                {['Players', 'Games', 'Teams', 'Start', 'Play', 'Done'].map((label, i) => (
                  <div key={label} className="flex-1">
                    <div className={`h-1.5 rounded-full transition-all ${
                      i <= ccData.currentStep ? 'bg-white' : 'bg-white/15'
                    }`} />
                    <div className={`text-[8px] mt-1 text-center font-bold ${
                      i <= ccData.currentStep ? 'text-white' : 'text-white/25'
                    }`}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">

              {/* Step 0: Players / Guests */}
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                    ccData.playerCount > 0 ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {ccData.playerCount > 0 ? '✓' : '👤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-gray-900">Players</div>
                    <div className="text-xs text-gray-500">
                      {ccData.playerCount} player{ccData.playerCount !== 1 ? 's' : ''}
                      {ccData.guestCount > 0 ? ` · ${ccData.guestCount} guest${ccData.guestCount !== 1 ? 's' : ''}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCommandCenter(false);
                      openEventPanel('golfers');
                    }}
                    className="text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-2 rounded-lg"
                  >
                    Full roster
                  </button>
                </div>

                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = ccGuestName.trim();
                    if (!name || ccAddingGuest || event.isCompleted) return;
                    setCcAddingGuest(true);
                    try {
                      await addGolferToEvent(event.id, name, event.course?.teeName || undefined, null);
                      setCcGuestName('');
                      addToast(`Added guest ${name}`, 'success', 2000);
                    } catch {
                      addToast('Could not add guest', 'error');
                    } finally {
                      setCcAddingGuest(false);
                    }
                  }}
                >
                  <input
                    type="text"
                    value={ccGuestName}
                    onChange={(e) => setCcGuestName(e.target.value)}
                    placeholder="Add guest name…"
                    disabled={!!event.isCompleted || ccAddingGuest}
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                  />
                  <button
                    type="submit"
                    disabled={!ccGuestName.trim() || ccAddingGuest || !!event.isCompleted}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {ccAddingGuest ? '…' : 'Add'}
                  </button>
                </form>

                {ccData.hasNassau && ccData.playerCount > 1 && !ccData.nassauTeamsDone && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCommandCenter(false);
                      if (ccData.firstNassauId) navigate(`/event/${id}/games/nassau/${ccData.firstNassauId}/teams`);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100 text-left"
                  >
                    <div>
                      <div className="text-sm font-bold text-amber-900">Assign to teams →</div>
                      <div className="text-[11px] text-amber-700">Guests & players still need Nassau teams</div>
                    </div>
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Shared score entry toggle */}
              <div className="px-4 py-3 flex items-center justify-between gap-3 bg-slate-50/80">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">Shared score entry</div>
                  <div className="text-[11px] text-gray-500">
                    {ccData.allowSharedScoreEntry
                      ? 'Anyone in the event can enter anyone’s scores'
                      : 'Players can only enter their own, team, or guest scores'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ccData.allowSharedScoreEntry}
                  onClick={() => {
                    updateEvent(event.id, {
                      settings: {
                        ...(event.settings || {}),
                        allowSharedScoreEntry: !ccData.allowSharedScoreEntry,
                      },
                    });
                  }}
                  className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                    ccData.allowSharedScoreEntry ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      ccData.allowSharedScoreEntry ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Step 1: Pick Games */}
              <button
                onClick={() => {
                  setShowCommandCenter(false);
                  goToEventSection('games');
                  setTriggerAddGame((prev) => prev + 1);
                }}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition text-left"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                  ccData.totalGames > 0 ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {ccData.totalGames > 0 ? '✓' : '🎲'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-gray-900">Pick Games</div>
                  <div className="text-xs text-gray-500">
                    {ccData.totalGames > 0
                      ? `${ccData.totalGames} game(s) selected`
                      : 'Choose Nassau, Skins, and more'}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Step 2: Pick Teams (only if nassau) */}
              {ccData.hasNassau && (
                <div>
                  {ccData.nassauArray.length === 1 ? (
                    /* Single Nassau — go directly */
                    <button
                      onClick={() => {
                        setShowCommandCenter(false);
                        if (ccData.firstNassauId) navigate(`/event/${id}/games/nassau/${ccData.firstNassauId}/teams`);
                      }}
                      className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition text-left"
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                        ccData.nassauTeamsDone ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {ccData.nassauTeamsDone ? '✓' : '👥'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-gray-900">Pick Teams</div>
                        <div className="text-xs text-gray-500">
                          {ccData.nassauTeamsDone
                            ? 'Teams assigned'
                            : ccData.playerCount > 1
                              ? `${ccData.playerCount} players — suggest ${ccData.suggestedTeams} teams`
                              : 'Waiting for players to join'}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    /* Multiple Nassaus — show each one */
                    <div>
                      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                          ccData.nassauTeamsDone ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {ccData.nassauTeamsDone ? '✓' : '👥'}
                        </div>
                        <div>
                          <div className="font-extrabold text-gray-900">Pick Teams</div>
                          <div className="text-xs text-gray-500">{ccData.nassauArray.length} Nassau games — pick teams for each</div>
                        </div>
                      </div>
                      <div className="px-4 pb-3 space-y-1.5">
                        {ccData.nassauArray.map((n: any, idx: number) => {
                          const teams = n.teams || [];
                          const filled = teams.filter((t: any) => (t.golferIds || []).length > 0);
                          const done = filled.length >= 2;
                          return (
                            <button
                              key={n.id}
                              onClick={() => {
                                setShowCommandCenter(false);
                                navigate(`/event/${id}/games/nassau/${n.id}/teams`);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition text-left"
                            >
                              <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${done ? 'bg-green-500 text-white' : 'bg-slate-300 text-white'}`}>
                                {done ? '✓' : idx + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gray-900">Nassau {idx + 1}</div>
                                <div className="text-[10px] text-gray-500">
                                  {done ? `${filled.length} teams set` : `${teams.length || 0} teams — needs assignment`}
                                </div>
                              </div>
                              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Start Event */}
              {!ccData.isStarted && !ccData.isCompleted && (
                <button
                  onClick={handleCCStartEvent}
                  disabled={!ccData.canStart}
                  className={`w-full p-4 flex items-center gap-4 transition text-left ${
                    ccData.canStart ? 'hover:bg-green-50 active:bg-green-100' : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                    ccData.canStart ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    🚀
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-extrabold ${ccData.canStart ? 'text-green-700' : 'text-gray-400'}`}>Start Event</div>
                    <div className="text-xs text-gray-500">
                      {ccData.canStart ? 'Lock games & begin play' : ccData.issues[0] || 'Complete setup first'}
                    </div>
                  </div>
                </button>
              )}

              {/* Unlock Games (when started) */}
              {ccData.isStarted && !ccData.isCompleted && (
                <button
                  onClick={() => { handleCCUnlock(); }}
                  className="w-full p-4 flex items-center gap-4 hover:bg-amber-50 active:bg-amber-100 transition text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-lg shadow-sm">
                    <span className="text-white">🔓</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-amber-700">Unlock Games</div>
                    <div className="text-xs text-gray-500">Pause round to edit games or teams</div>
                  </div>
                </button>
              )}

              {/* Complete Game (when started) */}
              {ccData.isStarted && !ccData.isCompleted && (
                <button
                  onClick={handleCCCompleteEvent}
                  disabled={!ccData.allScoresComplete}
                  className={`w-full p-4 flex items-center gap-4 transition text-left ${
                    ccData.allScoresComplete ? 'hover:bg-green-50 active:bg-green-100' : 'opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ${
                    ccData.allScoresComplete ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {ccData.allScoresComplete ? '🏁' : '⏳'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-extrabold ${ccData.allScoresComplete ? 'text-green-700' : 'text-gray-400'}`}>Complete Game</div>
                    <div className="text-xs text-gray-500">
                      {ccData.allScoresComplete ? 'Finalize all scores & lock payouts' : 'Waiting for all scores to be entered...'}
                    </div>
                  </div>
                </button>
              )}

              {/* Round Recap (after completion) */}
              {ccData.isCompleted && (
                <button
                  onClick={() => {
                    alert('Round recap sent to all players!');
                    setShowCommandCenter(false);
                  }}
                  className="w-full p-4 flex items-center gap-4 hover:bg-blue-50 active:bg-blue-100 transition text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-500 flex items-center justify-center text-lg shadow-sm">
                    <span className="text-white">📤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-blue-700">Round Recap</div>
                    <div className="text-xs text-gray-500">Send results & payouts to all players</div>
                  </div>
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setShowCommandCenter(false)}
                className="w-full py-2.5 text-center text-sm font-bold text-gray-500 hover:text-gray-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Access denied component
const AccessDenied: React.FC = () => (
  <div className="text-center py-12">
    <div className="text-4xl mb-3">🔒</div>
    <p className="text-gray-600">Only the event owner can access this</p>
  </div>
);

export default EventPage;
