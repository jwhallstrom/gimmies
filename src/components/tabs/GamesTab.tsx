import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../../state/store';
// Skins preview (holes won) moved to OverviewTab.
import { nanoid } from 'nanoid/non-secure';
import { useNavigate } from 'react-router-dom';
import { calculateEventPayouts } from '../../games/payouts';
import { EventSettlement } from '../wallet';
import { DOT_DEFINITIONS, DEFAULT_DOTS } from '../../games/dots';
import type { DotCategory, BingoBangoBongoHoleResult, WolfHoleResult, DotsPlayerResult } from '../../state/types';
import { useKeyboardHandler } from '../../hooks/useKeyboardHandler';
import type { NassauPayoutSummary, NassauSegmentResult } from '../../games/nassau';
import type { SkinsSummary } from '../../games/skins';

type Props = { eventId: string; isTabActive?: boolean; autoOpenAddGame?: number };

const GAME_TYPES = [
  {
    id: 'nassau',
    name: 'Nassau',
    emoji: '🏌️',
    description: 'Three bets in one: Front 9, Back 9, and Total 18. Can be played individually or as teams. The classic golf bet.',
    hasNetOption: true,
    minPlayers: 2
  },
  {
    id: 'skins',
    name: 'Skins',
    emoji: '💰',
    description: 'Each hole is worth a "skin". The player with the lowest score on a hole wins the skin. Ties can push or carry.',
    hasNetOption: true,
    minPlayers: 2
  },
  {
    id: 'stableford',
    name: 'Stableford',
    emoji: '📊',
    description: 'Points per hole based on score vs par. Blow up a hole? Just pick up — no penalty beyond 0 points. Encourages aggressive play.',
    hasNetOption: true,
    minPlayers: 2
  },
  {
    id: 'ninePoint',
    name: '9-Point',
    emoji: '9️⃣',
    description: 'Perfect for threesomes. 9 points every hole: Low=5, Mid=3, High=1. Ties split evenly. Every hole matters.',
    hasNetOption: true,
    minPlayers: 3,
    maxPlayers: 3
  },
  {
    id: 'bingoBangoBongo',
    name: 'Bingo Bango Bongo',
    emoji: '🎯',
    description: '3 points per hole: First on green (Bingo), closest to pin when all on (Bango), first to hole out (Bongo). Great for mixed abilities.',
    hasNetOption: false,
    minPlayers: 2
  },
  {
    id: 'wolf',
    name: 'Wolf',
    emoji: '🐺',
    description: 'The drama king. Rotating wolf picks a partner or goes Lone Wolf (3x points). 4 players required. Maximum trash talk.',
    hasNetOption: false,
    minPlayers: 4,
    maxPlayers: 4
  },
  {
    id: 'dots',
    name: 'Dots / Junk',
    emoji: '⚡',
    description: 'Collection of small side bets: Birdies, Sandies, Chip-ins, 3-putts, and more. Perfect add-on that keeps everyone engaged.',
    hasNetOption: false,
    minPlayers: 2
  },
  {
    id: 'pinky',
    name: 'Pinky',
    emoji: '🤙',
    description: 'At the end of the round, each player declares how many "pinkys" they had. For each pinky, that player owes each other player the fee.',
    hasNetOption: false,
    minPlayers: 2
  },
  {
    id: 'greenie',
    name: 'Greenie',
    emoji: '🟢',
    description: 'Each player declares greenies (GIR on par 3s). For each greenie, ALL OTHER players owe that player the fee.',
    hasNetOption: false,
    minPlayers: 2
  }
];

const GamesTab: React.FC<Props> = ({ eventId, isTabActive = false, autoOpenAddGame }) => {
  const navigate = useNavigate();
  const event = useStore((s: any) => 
    s.events.find((e: any) => e.id === eventId) || 
    s.completedEvents.find((e: any) => e.id === eventId)
  );
  const profiles = useStore((s: any) => s.profiles);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const updateEvent = useStore((s: any) => s.updateEvent);
  
  // Sub-tab state: 'games' for configuration, 'payouts' for standings
  const [subTab, setSubTab] = useState<'games' | 'payouts'>('games');
  
  const [showAddGame, setShowAddGame] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);

  // Auto-open the Add Game modal when triggered from Game Control
  useEffect(() => {
    if (autoOpenAddGame && autoOpenAddGame > 0) setShowAddGame(true);
  }, [autoOpenAddGame]);
  const [expandedDescription, setExpandedDescription] = useState<string | null>(null);
  const [nassauSetupId, setNassauSetupId] = useState<string | null>(null);
  const [skinsSetupId, setSkinsSetupId] = useState<string | null>(null);
  const [pinkySetupId, setPinkySetupId] = useState<string | null>(null);
  const [greenieSetupId, setGreenieSetupId] = useState<string | null>(null);
  const [stablefordSetupId, setStablefordSetupId] = useState<string | null>(null);
  const [ninePointSetupId, setNinePointSetupId] = useState<string | null>(null);
  const [bbbSetupId, setBbbSetupId] = useState<string | null>(null);
  const [wolfSetupId, setWolfSetupId] = useState<string | null>(null);
  const [dotsSetupId, setDotsSetupId] = useState<string | null>(null);
  const [showSettlements, setShowSettlements] = useState(false);
  const [expandBalance, setExpandBalance] = useState(false);
  const { handleFocus, handleBlur } = useKeyboardHandler();
  
  const completeEvent = useStore((s) => s.completeEvent);
  const getEventSettlements = useStore((s) => s.getEventSettlements);

  if (!event) return null;
  
  // Check if current user is the event owner
  const isOwner = currentProfile && event.ownerProfileId === currentProfile.id;
  console.log('🎮 GamesTab: Is owner?', isOwner, 'Current profile:', currentProfile?.id, 'Owner:', event.ownerProfileId);
  
  // Helper function to get golfer data from EventGolfer
  const getGolferData = (eventGolfer: any) => {
    if (eventGolfer.profileId) {
      const profile = profiles.find((p: any) => p.id === eventGolfer.profileId);
      // Use displayName snapshot for cross-device compatibility
      const name = profile ? profile.name : (eventGolfer.displayName || 'Unknown');
      const handicapIndex = profile?.handicapIndex ?? eventGolfer.handicapSnapshot;
      return { id: eventGolfer.profileId, name, handicapIndex };
    } else if (eventGolfer.customName) {
      return { id: eventGolfer.customName, name: eventGolfer.customName, handicapIndex: null };
    } else if (eventGolfer.displayName) {
      // Fallback for snapshot-only golfers
      return { id: eventGolfer.displayName, name: eventGolfer.displayName, handicapIndex: eventGolfer.handicapSnapshot };
    }
    return null;
  };
  
  // Get all golfers with their data
  const allGolfers = event.golfers.map(getGolferData).filter(Boolean);
  const gameEligibleIds = (game: 'nassau' | 'skins' | 'pinky' | 'greenie') => {
    const ids = (event.golfers || [])
      .map((g: any) => g.profileId || g.customName || g.displayName)
      .filter((id: any) => !!id) as string[];
    return ids.filter((gid) => {
      const eg = (event.golfers || []).find((x: any) => (x.profileId || x.customName || x.displayName) === gid);
      const pref: 'all' | 'nassau' | 'skins' | 'none' = (eg?.gamePreference as any) || 'all';
      if (pref === 'none') return false;
      if (pref === 'skins') return game === 'skins';
      if (pref === 'nassau') return game === 'nassau';
      // 'all'
      return true;
    });
  };
  const addNassau = (net: boolean) => {
    // Use the default group (first group) for the Nassau game
    const defaultGroupId = event.groups.length > 0 ? event.groups[0].id : null;
    if (!defaultGroupId) {
      alert('Please create an event with golfers first before adding games.');
      return;
    }
    const id = nanoid(6);
    updateEvent(eventId, {
      games: {
        ...event.games,
        nassau: [
          ...event.games.nassau,
          { id, groupId: defaultGroupId, fee: 5, fees: { out: 5, in: 5, total: 5 }, net, participantGolferIds: gameEligibleIds('nassau') },
        ],
      },
    });
    setNassauSetupId(id);
  };
  const removeNassau = (id: string) => {
    useStore.getState().removeNassau(eventId, id);
  };
  const skinsArray: any[] = Array.isArray(event.games.skins) ? event.games.skins : (event.games.skins ? [event.games.skins] : []);
  const addSkins = (net: boolean) => {
    const id = nanoid(6);
    updateEvent(eventId, {
      games: {
        ...event.games,
        skins: [...skinsArray, { id, fee: 10, net, carryovers: false, participantGolferIds: gameEligibleIds('skins') }],
      },
    });
    setSkinsSetupId(id);
  };
  const removeSkins = (id: string) => {
    useStore.getState().removeSkins(eventId, id);
  };
  
  // Pinky game management
  const pinkyArray: any[] = Array.isArray(event.games.pinky) ? event.games.pinky : [];
  const addPinky = () => {
    const id = nanoid(6);
    updateEvent(eventId, { 
      games: { 
        nassau: event.games.nassau || [],
        skins: event.games.skins || [],
        pinky: [...pinkyArray, { id, fee: 1, participantGolferIds: gameEligibleIds('pinky') }],
        greenie: event.games.greenie || []
      } 
    });
    setPinkySetupId(id);
  };
  const removePinky = (id: string) => {
    useStore.getState().removePinky(eventId, id);
  };
  const setPinkyCount = (pinkyId: string, golferId: string, count: number) => {
    const currentResults = (event.pinkyResults && event.pinkyResults[pinkyId]) || [];
    const updatedResults = currentResults.filter((r: any) => r.golferId !== golferId);
    if (count > 0) {
      updatedResults.push({ golferId, count });
    }
    useStore.getState().setPinkyResults(eventId, pinkyId, updatedResults);
  };
  
  // Greenie game management
  const greenieArray: any[] = Array.isArray(event.games.greenie) ? event.games.greenie : [];
  const addGreenie = () => {
    const id = nanoid(6);
    updateEvent(eventId, { 
      games: { 
        nassau: event.games.nassau || [],
        skins: event.games.skins || [],
        pinky: event.games.pinky || [],
        greenie: [...greenieArray, { id, fee: 1, participantGolferIds: gameEligibleIds('greenie') }]
      } 
    });
    setGreenieSetupId(id);
  };
  const removeGreenie = (id: string) => {
    useStore.getState().removeGreenie(eventId, id);
  };
  const setGreenieCount = (greenieId: string, golferId: string, count: number) => {
    const currentResults = (event.greenieResults && event.greenieResults[greenieId]) || [];
    const updatedResults = currentResults.filter((r: any) => r.golferId !== golferId);
    if (count > 0) {
      updatedResults.push({ golferId, count });
    }
    useStore.getState().setGreenieResults(eventId, greenieId, updatedResults);
  };

  // ============================================================================
  // New game type arrays and management functions
  // ============================================================================
  const stablefordArray: any[] = Array.isArray(event.games.stableford) ? event.games.stableford : [];
  const ninePointArray: any[] = Array.isArray(event.games.ninePoint) ? event.games.ninePoint : [];
  const bbbArray: any[] = Array.isArray(event.games.bingoBangoBongo) ? event.games.bingoBangoBongo : [];
  const wolfArray: any[] = Array.isArray(event.games.wolf) ? event.games.wolf : [];
  const dotsArray: any[] = Array.isArray(event.games.dots) ? event.games.dots : [];

  const addStableford = (net: boolean) => {
    const id = nanoid(6);
    updateEvent(eventId, {
      games: { ...event.games, stableford: [...stablefordArray, { id, fee: 10, net, system: 'standard', participantGolferIds: gameEligibleIds('nassau') }] }
    });
    setStablefordSetupId(id);
  };

  const addNinePoint = (net: boolean) => {
    const id = nanoid(6);
    const eligible = gameEligibleIds('nassau').slice(0, 3);
    updateEvent(eventId, {
      games: { ...event.games, ninePoint: [...ninePointArray, { id, fee: 1, net, participantGolferIds: eligible, sweepEnabled: false }] }
    });
    setNinePointSetupId(id);
  };

  const addBingoBangoBongo = () => {
    const id = nanoid(6);
    updateEvent(eventId, {
      games: { ...event.games, bingoBangoBongo: [...bbbArray, { id, fee: 1, participantGolferIds: gameEligibleIds('nassau') }] }
    });
    setBbbSetupId(id);
  };

  const addWolf = () => {
    const id = nanoid(6);
    const eligible = gameEligibleIds('nassau').slice(0, 4);
    updateEvent(eventId, {
      games: { ...event.games, wolf: [...wolfArray, { id, fee: 1, participantGolferIds: eligible, wolfOrder: eligible, blindWolfEnabled: false }] }
    });
    setWolfSetupId(id);
  };

  const addDots = () => {
    const id = nanoid(6);
    updateEvent(eventId, {
      games: { ...event.games, dots: [...dotsArray, { id, fee: 1, participantGolferIds: gameEligibleIds('nassau'), activeDots: [...DEFAULT_DOTS] }] }
    });
    setDotsSetupId(id);
  };

  // Local UI state for bulk assignment modal
  const [bulkAssignState, setBulkAssignState] = React.useState<{ nassauId: string | null; selected: Set<string>; mode: 'assign' | 'roundRobin'; teamId?: string } | null>(null);

  const closeBulk = () => setBulkAssignState(null);

  const shuffle = (arr: any[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const getIndexValue = (g: any) => (g.handicapIndex ?? 18); // fallback mid handicap if missing

  const applyTeamsUpdate = (nassau: any, teams: any[]) => {
    updateEvent(eventId, { games: { ...event.games, nassau: event.games.nassau.map((x: any) => x.id === nassau.id ? { ...x, teams } : x) } });
  };

  const ensureTeams = (nassau: any, min: number = 2) => {
    let teams = nassau.teams || [];
    if (teams.length < min) {
      for (let i = teams.length; i < min; i++) {
        teams.push({ id: 'T' + (i + 1), name: 'Team ' + (i + 1), golferIds: [] });
      }
    }
    return teams;
  };

  const randomizeTeams = (nassau: any, golfers: any[]) => {
    // Use all eligible golfers — participantGolferIds may be stale
    const active = golfers;
    if (active.length < 2) return;
    const teams = ensureTeams(nassau, Math.min(4, Math.max(2, nassau.teams?.length || 2))); // keep existing count if present
    const shuffled = shuffle(active.map(g => g.id));
    const newTeams = teams.map((t: any) => ({ ...t, golferIds: [] }));
    shuffled.forEach((gid, i) => {
      newTeams[i % newTeams.length].golferIds.push(gid);
    });
    applyTeamsUpdate(nassau, newTeams);
  };

  const autoBalanceTeams = (nassau: any, golfers: any[]) => {
    const teams = ensureTeams(nassau, Math.min(4, Math.max(2, nassau.teams?.length || 2)));
    const sorted = [...golfers].sort((a, b) => getIndexValue(a) - getIndexValue(b));
    // Snake distribution for balance
    const newTeams = teams.map((t: any) => ({ ...t, golferIds: [] }));
    let direction = 1; let teamIdx = 0;
    sorted.forEach(g => {
      newTeams[teamIdx].golferIds.push(g.id);
      if (direction === 1) {
        if (teamIdx === newTeams.length - 1) { direction = -1; } else { teamIdx++; }
      } else {
        if (teamIdx === 0) { direction = 1; } else { teamIdx--; }
      }
    });
    applyTeamsUpdate(nassau, newTeams);
  };

  const commitBulkAssign = (nassau: any, groupGolfers: any[]) => {
    if (!bulkAssignState) return;
    const teams = ensureTeams(nassau);
    const selectedIds = Array.from(bulkAssignState.selected);
    let newTeams = teams.map((t: any) => ({ ...t, golferIds: t.golferIds.filter((gid: string) => !selectedIds.includes(gid)) }));
    if (bulkAssignState.mode === 'assign' && bulkAssignState.teamId) {
      newTeams = newTeams.map((t: any) => t.id === bulkAssignState.teamId ? { ...t, golferIds: [...t.golferIds, ...selectedIds] } : t);
    } else if (bulkAssignState.mode === 'roundRobin') {
      selectedIds.forEach((gid, i) => {
        newTeams[i % newTeams.length].golferIds.push(gid);
      });
    }
    applyTeamsUpdate(nassau, newTeams);
    closeBulk();
  };



  // Event status
  const eventStatus = event.status || (event.isCompleted ? 'completed' : 'setup');
  const isEventStarted = eventStatus === 'started';
  const isEventCompleted = eventStatus === 'completed' || event.isCompleted;
  const canEdit = isOwner && !isEventStarted && !isEventCompleted;
  // canModify: allows admin to remove games & manage participants even after event starts
  const canModify = isOwner && !isEventCompleted;

  // Must declare hasAnyGames before gamesReady uses it
  const hasAnyGames = event.games.nassau.length + skinsArray.length + pinkyArray.length + greenieArray.length + stablefordArray.length + ninePointArray.length + bbbArray.length + wolfArray.length + dotsArray.length > 0;

  // Check if games are ready to start — collect issues for admin
  const startIssues = useMemo(() => {
    const issues: string[] = [];
    if (!hasAnyGames) {
      issues.push('No games added yet');
      return issues;
    }
    const playerCount = allGolfers.length;
    // Check Nassau teams
    for (const n of event.games.nassau) {
      const teams = n.teams || [];
      const teamsWithPlayers = teams.filter((t: any) => (t.golferIds || []).length > 0);
      if (teams.length > 0 && teamsWithPlayers.length < 2) {
        issues.push('Nassau: Teams need to be picked');
      }
      if (playerCount < 2) {
        issues.push('Nassau: Needs at least 2 players');
      }
    }
    // Check participant count for special games (use game's own player list, not total event)
    ninePointArray.forEach((np: any, idx: number) => {
      const npCount = (np.participantGolferIds || []).length;
      if (npCount !== 3) {
        issues.push(`9-Point${ninePointArray.length > 1 ? ` #${idx + 1}` : ''}: Needs exactly 3 players (${npCount} selected)`);
      }
    });
    wolfArray.forEach((w: any, idx: number) => {
      const wCount = (w.participantGolferIds || []).length;
      if (wCount !== 4) {
        issues.push(`Wolf${wolfArray.length > 1 ? ` #${idx + 1}` : ''}: Needs exactly 4 players (${wCount} selected)`);
      }
    });
    // Generic min-2 check for other games
    const needsTwo = skinsArray.length + pinkyArray.length + greenieArray.length + stablefordArray.length + bbbArray.length + dotsArray.length;
    if (needsTwo > 0 && playerCount < 2) {
      issues.push(`Games require at least 2 players (${playerCount} in event)`);
    }
    return issues;
  }, [hasAnyGames, allGolfers.length, event.games.nassau, ninePointArray, wolfArray, skinsArray, pinkyArray, greenieArray, stablefordArray, bbbArray, dotsArray]);
  const gamesReady = startIssues.length === 0;

  // Suggest optimal team count based on player count
  const suggestedTeamCount = useMemo(() => {
    const pc = allGolfers.length;
    if (pc <= 4) return 2;
    if (pc <= 6) return 2;
    if (pc <= 8) return 2;    // 2 teams of 4
    if (pc <= 12) return 3;   // 3 teams of 4
    if (pc <= 16) return 4;   // 4 teams of 4
    if (pc <= 20) return 4;   // 4 teams of 5
    return 4;                  // cap at 4 teams — fewer is better
  }, [allGolfers.length]);

  // Determine which admin steps are available/done
  const hasNassauGames = event.games.nassau.length > 0;
  const nassauNeedsTeams = event.games.nassau.some((n: any) => {
    const teams = n.teams || [];
    const teamsWithPlayers = teams.filter((t: any) => (t.golferIds || []).length > 0);
    return teams.length === 0 || teamsWithPlayers.length < 2;
  });

  const handleStartEvent = () => {
    if (!gamesReady) {
      alert('Cannot start event:\n\n' + startIssues.map(i => '• ' + i).join('\n'));
      return;
    }
    if (window.confirm('Start the event? This will lock the games. You can unlock later if needed.')) {
      updateEvent(eventId, { status: 'started' });
    }
  };

  const handleUnlockEvent = () => {
    if (window.confirm('Unlock the event? This will allow changes to games. You\'ll need to restart when done.')) {
      updateEvent(eventId, { status: 'setup' });
    }
  };
  
  const handleCompleteEvent = () => {
    // First confirmation
    if (!window.confirm('Complete this event?\n\nThis will finalize all scores and calculate final payouts.')) {
      return;
    }
    
    // Second confirmation - make it very clear this is final
    if (!window.confirm('⚠️ FINAL CONFIRMATION ⚠️\n\nBy confirming, you certify that:\n\n• All scores have been reviewed and are correct\n• All payouts have been verified\n• This action CANNOT be undone\n\nProceed with finalizing this event?')) {
      return;
    }
    
    const success = completeEvent(eventId);
    if (success) {
      alert('✓ Event Completed!\n\nAll scores and payouts are now final.');
    }
  };
  
  // ========== PAYOUT CALCULATIONS ==========
  const myGolferId = currentProfile?.id;
  
  // Calculate payouts
  const payouts = useMemo(() => {
    if (!hasAnyGames) return { nassau: [], skins: [], pinky: [], greenie: [], stableford: [], ninePoint: [], bingoBangoBongo: [], wolf: [], dots: [], totals: {} } as any;
    return calculateEventPayouts(event, profiles);
  }, [event, profiles, hasAnyGames]);
  
  // My balance calculations - calculate from totalByGolfer
  const { myNet, myBuyin, myWinnings, buyinBreakdown } = useMemo(() => {
    if (!myGolferId || !payouts.totalByGolfer) return { myNet: null, myBuyin: 0, myWinnings: 0, buyinBreakdown: [] };
    
    // Calculate buy-in from all games this golfer is in
    let buyin = 0;
    const breakdown: { name: string; amount: number }[] = [];
    
    // All eligible event golfer IDs (used for all pot-based games)
    const allGolferIds = event.golfers.map((g: any) => g.profileId || g.customName);

    // Nassau buy-ins — include all eligible golfers, not stale participantGolferIds
    event.games.nassau.forEach((n: any, idx: number) => {
      if (allGolferIds.includes(myGolferId)) {
        const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
        const cost = (fees.out || 0) + (fees.in || 0) + (fees.total || 0);
        buyin += cost;
        breakdown.push({ name: event.games.nassau.length > 1 ? `Nassau ${idx + 1}` : 'Nassau', amount: cost });
      }
    });
    
    // Skins buy-ins
    skinsArray.forEach((s: any, idx: number) => {
      if (allGolferIds.includes(myGolferId)) {
        const cost = s.fee || 0;
        buyin += cost;
        breakdown.push({ name: skinsArray.length > 1 ? `Skins ${idx + 1}` : 'Skins', amount: cost });
      }
    });

    // Stableford buy-ins (pot-based like skins)
    stablefordArray.forEach((s: any, idx: number) => {
      if (allGolferIds.includes(myGolferId)) {
        const cost = s.fee || 0;
        buyin += cost;
        breakdown.push({ name: stablefordArray.length > 1 ? `Stableford ${idx + 1}` : 'Stableford', amount: cost });
      }
    });

    // Note: 9-Point, BBB, Wolf, Dots are peer-to-peer (no buy-in pot)
    
    const winnings = payouts.totalByGolfer[myGolferId] || 0;
    const net = winnings - buyin;
    
    return { myNet: net, myBuyin: buyin, myWinnings: winnings, buyinBreakdown: breakdown };
  }, [payouts.totalByGolfer, myGolferId, event.games.nassau, skinsArray, stablefordArray, event.golfers]);
  
  // Get settlements (what I owe / am owed)
  const allSettlements = useMemo(() => {
    return getEventSettlements ? getEventSettlements(eventId) : [];
  }, [eventId, getEventSettlements, payouts]);
  
  const mySettlements = useMemo(() => {
    if (!myGolferId) return [];
    return allSettlements.filter((s: any) => s.fromId === myGolferId || s.toId === myGolferId);
  }, [allSettlements, myGolferId]);
  
  // Check if all scores are complete
  const allScoresComplete = event.scorecards?.every((sc: any) => 
    sc.scores?.every((s: any) => s.strokes != null)
  );
  
  // Currency formatters
  const currency = (n: number) => '$' + n.toFixed(2);
  const signedCurrency = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + currency(Math.abs(n));

  const myNetValue = myNet ?? 0;

  // Helper to get golfer name
  const getGolferName = (golferId: string) => {
    const golfer = allGolfers.find((g: any) => g.id === golferId);
    return golfer?.name || golferId;
  };

  // ========== COMPUTED GAME STANDINGS ==========
  // Nassau standings computation
  const nassauStandings = useMemo(() => {
    if (!payouts.nassau.length) return null;
    return payouts.nassau.map((n: NassauPayoutSummary) => {
      const nassauConfig = event.games.nassau.find((cfg: any) => cfg.id === n.configId);
      const teams = nassauConfig?.teams || [];
      const isMatch = nassauConfig?.scoringType === 'match';
      
      // Build standings per segment with winner payout info
      const standings = n.segments.map((seg: NassauSegmentResult) => {
        const rows = Object.entries(seg.scores)
          .filter(([id, score]) => Number.isFinite(score))
          .map(([id, score]) => {
            const team = teams.find((t: any) => t.id === id);
            const isWinner = seg.winners.includes(id);
            const toPar = seg.toPar[id] || 0;
            return {
              id,
              name: team?.name || getGolferName(id),
              score: isMatch ? toPar : score, // For match play show holes won
              toPar,
              isWinner,
              isTeam: !!team
            };
          })
          .sort((a, b) => {
            if (isMatch) return (b.score as number) - (a.score as number); // Higher holes won = better
            return (a.score as number) - (b.score as number); // Lower strokes = better
          });
        
        // Calculate winner payouts for this segment
        const winnerCount = seg.winners.length;
        const payoutPerWinner = winnerCount > 0 ? seg.pot / winnerCount : 0;
        const winnerNames = seg.winners.map((id: string) => {
          const team = teams.find((t: any) => t.id === id);
          return team?.name || getGolferName(id);
        });
        const isSplit = winnerCount > 1;
        const hasWinner = winnerCount > 0;
        
        return { 
          segment: seg.segment, 
          rows, 
          pot: seg.pot, 
          isMatch,
          // Payout info
          winnerNames,
          winnerCount,
          payoutPerWinner,
          isSplit,
          hasWinner
        };
      });
      
      return {
        id: n.configId,
        fees: n.feesPerPlayer,
        pot: n.pot,
        isNet: nassauConfig?.net,
        isMatch,
        teams,
        standings
      };
    });
  }, [payouts.nassau, event.games.nassau]);

  // Skins standings computation  
  const skinsStandings = useMemo(() => {
    if (!payouts.skins.length) return null;
    return payouts.skins.filter(Boolean).map((s: SkinsSummary | null) => {
      if (!s) return null;
      const skinsConfig = skinsArray.find((cfg: any) => cfg.id === s.configId);
      
      // Group holes by winner
      const winners = Object.entries(s.winningHolesByGolfer)
        .filter(([_, holes]: [string, number[]]) => holes.length > 0)
        .map(([golferId, holes]: [string, number[]]) => ({
          name: getGolferName(golferId),
          holes,
          amount: s.winningsByGolfer[golferId] || 0
        }))
        .sort((a, b) => (b.holes as number[]).length - (a.holes as number[]).length);
      
      return {
        id: s.configId,
        fee: s.feePerPlayer,
        totalPot: s.totalPot,
        isNet: skinsConfig?.net,
        carryovers: skinsConfig?.carryovers,
        holeResults: s.holeResults,
        winners
      };
    }).filter(Boolean);
  }, [payouts.skins, skinsArray]);
  
  return (
    <div className="space-y-4">
      {/* Personal Summary - Always visible if games exist */}
      {hasAnyGames && myNet !== null && (
        <div className={`rounded-xl overflow-hidden ${myNetValue >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
          <div 
            className="px-4 py-3 flex items-center justify-between cursor-pointer"
            onClick={() => setExpandBalance(!expandBalance)}
          >
            <div className="text-white">
              <div className="text-xs font-medium opacity-90 flex items-center gap-1">
                YOUR BALANCE
                <svg className={`w-3 h-3 transition-transform ${expandBalance ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div className="text-2xl font-black">{signedCurrency(myNetValue)}</div>
            </div>
            <div className="text-right text-white text-xs opacity-90">
              <div>Buy-in: {currency(myBuyin)}</div>
              <div>Winnings: +{currency(myWinnings)}</div>
            </div>
          </div>
          
          {/* Expanded Breakdown */}
          {expandBalance && (
            <div className="px-4 pb-4 pt-0 border-t border-white/20">
              <div className="mt-3 text-xs font-bold text-white/90 uppercase tracking-wide">Buy-in Breakdown</div>
              <div className="mt-1 space-y-1">
                {buyinBreakdown.length > 0 ? (
                  buyinBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm text-white">
                      <span>{item.name}</span>
                      <span className="font-medium">{currency(item.amount)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-white/60 italic">No buy-ins</div>
                )}
                <div className="border-t border-white/20 mt-2 pt-1 flex justify-between text-sm font-bold text-white">
                  <span>Total</span>
                  <span>{currency(myBuyin)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Games State */}
      {!hasAnyGames && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
          {isOwner ? (
            <>
              <div className="text-3xl mb-2">💰</div>
              <div className="font-bold text-gray-900">Games & Payouts</div>
              <p className="text-sm text-gray-500 mt-2">
                This is where your side games and payouts live.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Tap the <span className="inline-block w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-5 align-middle">+</span> button to add Nassau, Skins, and more.
              </p>
            </>
          ) : (
            <>
              <div className="text-3xl mb-2">⛳</div>
              <div className="font-bold text-gray-900">Games & Payouts</div>
              <p className="text-sm text-gray-500 mt-2">
                Once the admin sets up side games, you'll see your matchups, standings, and payouts here.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Hang tight — the fun is coming!
              </p>
            </>
          )}
        </div>
      )}

      {/* ========== NASSAU PREVIEW CARDS (pre-start / no standings yet) ========== */}
      {(!nassauStandings || nassauStandings.length === 0) && event.games.nassau.map((n: any) => {
        const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
        const hasTeams = (n.teams || []).filter((t: any) => t.golferIds?.length > 0).length >= 2;
        const nassauPot = allGolfers.length * ((fees.out || 0) + (fees.in || 0) + (fees.total || 0));
        return (
          <div
            key={n.id}
            onClick={isOwner ? () => setNassauSetupId(n.id) : undefined}
            className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏌️</span>
                <div>
                  <div className="font-bold text-gray-900">Nassau</div>
                  <div className="text-xs text-gray-500">
                    ${fees.out}/${fees.in}/${fees.total} · {n.net ? 'Net' : 'Gross'} · {hasTeams ? 'Teams' : 'Individual'} · Total Pot: {currency(nassauPot)}
                  </div>
                </div>
              </div>
              {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
            </div>
          </div>
        );
      })}

      {/* ========== NASSAU LEADERBOARD ========== */}
      {nassauStandings && nassauStandings.length > 0 && nassauStandings.map((nassau: any) => {
        const frontSeg = nassau.standings.find((s: any) => s.segment === 'front');
        const backSeg = nassau.standings.find((s: any) => s.segment === 'back');
        const totalSeg = nassau.standings.find((s: any) => s.segment === 'total');
        
        const formatScore = (row: any) => {
          if (!row || !Number.isFinite(row.score)) return '—';
          if (nassau.isMatch) return `${row.score}`; // Holes won
          const toPar = row.toPar;
          if (toPar === 0) return 'E';
          return toPar > 0 ? `+${toPar}` : `${toPar}`;
        };
        
        return (
        <div key={nassau.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏌️</span>
              <div>
                <div className="font-bold text-gray-900">Nassau</div>
                <div className="text-[10px] text-gray-500">
                  {nassau.isNet ? 'Net' : 'Gross'}{nassau.isMatch && ' · Match Play'} · Total Pot: {currency(nassau.pot)}
                </div>
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => setNassauSetupId(nassau.id)}
                className="text-xs text-primary-600 font-bold"
              >
                {canEdit ? 'Edit' : 'View'}
              </button>
            )}
          </div>
          
          {/* Wheel Payouts - The money breakdown */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 border-b border-slate-200">
            {[
              { label: 'Front 9', seg: frontSeg, fee: nassau.fees.out },
              { label: 'Back 9', seg: backSeg, fee: nassau.fees.in },
              { label: 'Total', seg: totalSeg, fee: nassau.fees.total }
            ].map(({ label, seg, fee }) => (
              <div key={label} className="py-3 px-2 text-center">
                <div className="text-[10px] text-gray-500 font-bold uppercase">{label}</div>
                <div className="text-lg font-black text-gray-900">{currency(seg?.pot || 0)}</div>
                {seg?.hasWinner ? (
                  <div className={`text-[10px] mt-1 ${seg.isSplit ? 'text-amber-600' : 'text-green-600'} font-bold`}>
                    {seg.isSplit ? (
                      <>SPLIT: {seg.winnerNames.join(' & ')}</>
                    ) : (
                      <>{seg.winnerNames[0]} WINS</>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] mt-1 text-gray-400">In progress</div>
                )}
                {seg?.isSplit && seg.hasWinner && (
                  <div className="text-[9px] text-gray-500">{currency(seg.payoutPerWinner)} each</div>
                )}
              </div>
            ))}
          </div>
          
          {/* Team Standings Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-[10px] text-gray-600 uppercase">
                  <th className="text-left py-2 px-3 font-bold">Team</th>
                  <th className="text-center py-2 px-2 font-bold w-20">Front</th>
                  <th className="text-center py-2 px-2 font-bold w-20">Back</th>
                  <th className="text-center py-2 px-2 font-bold w-20">Total</th>
                </tr>
              </thead>
              <tbody>
                {nassau.teams.length > 0 ? nassau.teams.map((team: any) => {
                  const frontRow = frontSeg?.rows.find((r: any) => r.id === team.id);
                  const backRow = backSeg?.rows.find((r: any) => r.id === team.id);
                  const totalRow = totalSeg?.rows.find((r: any) => r.id === team.id);
                  
                  // Calculate team's total winnings from this Nassau
                  const teamWinnings = 
                    (frontRow?.isWinner ? (frontSeg?.payoutPerWinner || 0) : 0) +
                    (backRow?.isWinner ? (backSeg?.payoutPerWinner || 0) : 0) +
                    (totalRow?.isWinner ? (totalSeg?.payoutPerWinner || 0) : 0);
                  
                  return (
                    <tr key={team.id} className="border-t border-slate-100">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">{team.name}</div>
                            <div className="text-[10px] text-gray-500">
                              {team.golferIds.map((gid: string) => getGolferName(gid)).join(', ')}
                            </div>
                          </div>
                          {teamWinnings > 0 && (
                            <div className="text-green-600 font-bold text-sm">+{currency(teamWinnings)}</div>
                          )}
                        </div>
                      </td>
                      <td className={`text-center py-2.5 px-2 ${frontRow?.isWinner ? 'bg-green-50' : ''}`}>
                        <div className={`font-bold ${frontRow?.isWinner ? 'text-green-600' : 'text-gray-700'}`}>
                          {formatScore(frontRow)}
                        </div>
                        {frontRow?.isWinner && (
                          <div className="text-[9px] text-green-600 font-medium">
                            +{currency(frontSeg?.payoutPerWinner || 0)}
                          </div>
                        )}
                      </td>
                      <td className={`text-center py-2.5 px-2 ${backRow?.isWinner ? 'bg-green-50' : ''}`}>
                        <div className={`font-bold ${backRow?.isWinner ? 'text-green-600' : 'text-gray-700'}`}>
                          {formatScore(backRow)}
                        </div>
                        {backRow?.isWinner && (
                          <div className="text-[9px] text-green-600 font-medium">
                            +{currency(backSeg?.payoutPerWinner || 0)}
                          </div>
                        )}
                      </td>
                      <td className={`text-center py-2.5 px-2 ${totalRow?.isWinner ? 'bg-green-50' : ''}`}>
                        <div className={`font-bold ${totalRow?.isWinner ? 'text-green-600' : 'text-gray-700'}`}>
                          {formatScore(totalRow)}
                        </div>
                        {totalRow?.isWinner && (
                          <div className="text-[9px] text-green-600 font-medium">
                            +{currency(totalSeg?.payoutPerWinner || 0)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-500 text-sm">
                      No teams assigned yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        );
      })}

      {/* ========== SKINS PREVIEW CARDS (pre-start / no standings yet) ========== */}
      {(!skinsStandings || skinsStandings.length === 0) && skinsArray.map((s: any) => {
        const skinsPot = allGolfers.length * (s.fee || 0);
        return (
          <div
            key={s.id}
            onClick={isOwner ? () => setSkinsSetupId(s.id) : undefined}
            className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">💰</span>
                <div>
                  <div className="font-bold text-gray-900">Skins</div>
                  <div className="text-xs text-gray-500">
                    {s.net ? 'Net' : 'Gross'} · ${s.fee || 0} · Total Pot: {currency(skinsPot)}
                  </div>
                </div>
              </div>
              {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
            </div>
          </div>
        );
      })}

      {/* ========== SKINS LEADERBOARD ========== */}
      {skinsStandings && skinsStandings.length > 0 && skinsStandings.map((skins: any) => (
        <div key={skins.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <div>
                <div className="font-bold text-gray-900">Skins</div>
                <div className="text-[10px] text-gray-500">
                  {skins.isNet ? 'Net' : 'Gross'} · ${skins.fee} · Total Pot: {currency(skins.totalPot)}
                </div>
              </div>
            </div>
            {isOwner && (
              <button
                onClick={() => setSkinsSetupId(skins.id)}
                className="text-xs text-primary-600 font-bold"
              >
                {canEdit ? 'Edit' : 'View'}
              </button>
            )}
          </div>
          
          {/* Winners List */}
          {skins.winners.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {skins.winners.map((winner: any, idx: number) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{winner.name}</div>
                    <div className="text-xs text-gray-500">
                      Holes: {winner.holes.sort((a: number, b: number) => a - b).join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{currency(winner.amount)}</div>
                    <div className="text-[10px] text-gray-500">{winner.holes.length} skin{winner.holes.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-500 text-sm">
              No skins won yet
            </div>
          )}
          
          {/* Hole Grid - Visual representation */}
          {skins.holeResults.length > 0 && (
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
              <div className="text-[10px] text-gray-500 font-bold uppercase mb-2">Hole Results</div>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
                  const result = skins.holeResults.find((r: any) => r.hole === hole);
                  const hasWinner = result && result.winners.length === 1;
                  const isCarry = result?.carryIntoNext;
                  const winnerName = hasWinner ? getGolferName(result.winners[0]) : null;
                  
                  return (
                    <div
                      key={hole}
                      className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold ${
                        hasWinner 
                          ? 'bg-green-500 text-white' 
                          : isCarry 
                            ? 'bg-amber-200 text-amber-800'
                            : 'bg-slate-200 text-slate-500'
                      }`}
                      title={hasWinner ? `${winnerName} won` : isCarry ? 'Carried' : 'Push/No score'}
                    >
                      {hole}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> Won</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200"></span> Carried</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200"></span> Push</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Pinky & Greenie - Compact cards */}
      {pinkyArray.length > 0 && pinkyArray.map((p: any) => (
        <div
          key={p.id}
          onClick={isOwner ? () => setPinkySetupId(p.id) : undefined}
          className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">🤙</span>
              <div>
                <div className="font-bold text-gray-900">Pinky</div>
                <div className="text-xs text-gray-500">${p.fee} per pinky</div>
              </div>
            </div>
            {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
          </div>
        </div>
      ))}
      
      {greenieArray.length > 0 && greenieArray.map((g: any) => (
        <div
          key={g.id}
          onClick={isOwner ? () => setGreenieSetupId(g.id) : undefined}
          className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">🟢</span>
              <div>
                <div className="font-bold text-gray-900">Greenie</div>
                <div className="text-xs text-gray-500">${g.fee} per greenie</div>
              </div>
            </div>
            {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
          </div>
        </div>
      ))}

      {/* ========== STABLEFORD CARD ========== */}
      {stablefordArray.length > 0 && stablefordArray.map((cfg: any) => {
        const summary = payouts.stableford?.find((s: any) => s.configId === cfg.id);
        const topPlayer = summary ? Object.entries(summary.pointsByGolfer).sort((a: any, b: any) => b[1] - a[1])[0] : null;
        return (
          <div key={cfg.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div
              onClick={isOwner ? () => setStablefordSetupId(cfg.id) : undefined}
              className={`w-full p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="font-bold text-gray-900">Stableford</div>
                    <div className="text-xs text-gray-500">
                      {cfg.net ? 'Net' : 'Gross'} · {cfg.system === 'modified' ? 'Modified' : 'Standard'} · ${cfg.fee}/player
                    </div>
                  </div>
                </div>
                {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
              </div>
            </div>
            {summary && topPlayer && (
              <div className="px-4 pb-3 border-t border-slate-100 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Leader: <span className="font-bold text-gray-900">{getGolferName(topPlayer[0])}</span></span>
                  <span className="font-bold text-green-600">{topPlayer[1] as number} pts</span>
                </div>
                {myGolferId && summary.pointsByGolfer[myGolferId] !== undefined && (
                  <div className="text-[10px] text-gray-400 mt-0.5">You: {summary.pointsByGolfer[myGolferId]} pts</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ========== 9-POINT CARD ========== */}
      {ninePointArray.length > 0 && ninePointArray.map((cfg: any) => {
        const summary = payouts.ninePoint?.find((s: any) => s.configId === cfg.id);
        return (
          <div key={cfg.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div
              onClick={isOwner ? () => setNinePointSetupId(cfg.id) : undefined}
              className={`w-full p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">9️⃣</span>
                  <div>
                    <div className="font-bold text-gray-900">9-Point</div>
                    <div className="text-xs text-gray-500">
                      {cfg.net ? 'Net' : 'Gross'} · ${cfg.fee}/point · 3 players
                    </div>
                  </div>
                </div>
                {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
              </div>
            </div>
            {summary && (
              <div className="px-4 pb-3 border-t border-slate-100 pt-2 space-y-1">
                {Object.entries(summary.pointsByGolfer).sort((a: any, b: any) => b[1] - a[1]).map(([gid, pts]) => (
                  <div key={gid} className="flex items-center justify-between text-xs">
                    <span className={`${gid === myGolferId ? 'font-bold text-gray-900 bg-primary-100 px-1.5 py-0.5 rounded' : 'text-gray-600'}`}>{getGolferName(gid)}</span>
                    <span className="font-mono font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">{pts as number} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ========== BINGO BANGO BONGO CARD ========== */}
      {bbbArray.length > 0 && bbbArray.map((cfg: any) => {
        const summary = payouts.bingoBangoBongo?.find((s: any) => s.configId === cfg.id);
        return (
          <div
            key={cfg.id}
            onClick={isOwner ? () => setBbbSetupId(cfg.id) : undefined}
            className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">🎯</span>
                <div>
                  <div className="font-bold text-gray-900">Bingo Bango Bongo</div>
                  <div className="text-xs text-gray-500">${cfg.fee}/point · 3 pts/hole</div>
                </div>
              </div>
              {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
            </div>
            {summary && (
              <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-[10px] text-center">
                <div><span className="font-bold text-gray-700">Bingo</span></div>
                <div><span className="font-bold text-gray-700">Bango</span></div>
                <div><span className="font-bold text-gray-700">Bongo</span></div>
              </div>
            )}
          </div>
        );
      })}

      {/* ========== WOLF CARD ========== */}
      {wolfArray.length > 0 && wolfArray.map((cfg: any) => {
        const summary = payouts.wolf?.find((s: any) => s.configId === cfg.id);
        const holesPlayed = summary?.holeResults?.length || 0;
        return (
          <div key={cfg.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div
              onClick={isOwner ? () => setWolfSetupId(cfg.id) : undefined}
              className={`w-full p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🐺</span>
                  <div>
                    <div className="font-bold text-gray-900">Wolf</div>
                    <div className="text-xs text-gray-500">
                      ${cfg.fee}/point · {holesPlayed}/18 holes · 4 players
                    </div>
                  </div>
                </div>
                {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
              </div>
            </div>
            {summary && Object.keys(summary.pointsByGolfer).length > 0 && (
              <div className="px-4 pb-3 border-t border-slate-100 pt-2 space-y-1">
                {Object.entries(summary.pointsByGolfer).sort((a: any, b: any) => b[1] - a[1]).map(([gid, pts]) => (
                  <div key={gid} className="flex items-center justify-between text-xs">
                    <span className={`${gid === myGolferId ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{getGolferName(gid)}</span>
                    <span className={`font-mono font-bold ${(pts as number) > 0 ? 'text-green-600' : (pts as number) < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {(pts as number) > 0 ? '+' : ''}{pts as number}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ========== DOTS/JUNK CARD ========== */}
      {dotsArray.length > 0 && dotsArray.map((cfg: any) => {
        const summary = payouts.dots?.find((s: any) => s.configId === cfg.id);
        return (
          <div
            key={cfg.id}
            onClick={isOwner ? () => setDotsSetupId(cfg.id) : undefined}
            className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <div className="font-bold text-gray-900">Dots / Junk</div>
                  <div className="text-xs text-gray-500">${cfg.fee}/dot · {cfg.activeDots?.length || 0} categories active</div>
                </div>
              </div>
              {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
            </div>
            {summary && summary.playerResults.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                {summary.playerResults.sort((a: any, b: any) => b.totalDots - a.totalDots).slice(0, 3).map((r: any) => (
                  <div key={r.golferId} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{getGolferName(r.golferId)}</span>
                    <span className="font-mono font-bold">{r.totalDots} dots</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Admin Control Panel moved to Event Header Command Center */}

      {/* ========== OLD SUB-TAB CODE (hidden - keeping modals) ========== */}
      {false && (
      <>
      {/* Sub-tabs: Games / Payouts */}
      <div className="flex bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setSubTab('games')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
            subTab === 'games'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🎯 Games
        </button>
        <button
          onClick={() => setSubTab('payouts')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
            subTab === 'payouts'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          💰 Payouts
          {(isEventStarted || isEventCompleted) && myNet !== null && (
            <span className={`ml-2 text-xs ${myNetValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {signedCurrency(myNetValue)}
            </span>
          )}
        </button>
      </div>

      {/* ========== GAMES SUB-TAB ========== */}
      {subTab === 'games' && (
        <div className="space-y-3">
          {/* Status Banner - Compact */}
          {isEventCompleted && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-green-800">
              <span>✓</span>
              <span className="font-medium">Event Completed</span>
              <span className="text-xs text-green-600">· Games locked</span>
            </div>
          )}
          
          {isEventStarted && !isEventCompleted && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <span>🔒</span>
                <span className="font-medium">In Progress</span>
              </div>
              {isOwner && (
                <button
                  onClick={handleUnlockEvent}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900"
                >
                  Unlock
                </button>
              )}
            </div>
          )}

          {/* Games List - Compact Cards */}
          {!hasAnyGames ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className="text-3xl mb-2">💰</div>
              <div className="font-bold text-gray-900">Games & Payouts</div>
              <p className="text-sm text-gray-500 mt-1">
                {isOwner ? 'Use the Command Center to add games' : 'The admin hasn\'t set up games yet'}
              </p>
            </div>
          ) : (
            <>
              {/* Nassau Games */}
              {event.games.nassau.map((n: any, i: number) => {
                const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
                const hasTeams = (n.teams || []).filter((t: any) => t.golferIds?.length > 0).length >= 2;
                return (
                  <div
                    key={n.id}
                    onClick={isOwner ? () => setNassauSetupId(n.id) : undefined}
                    className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🏌️</span>
                        <div>
                          <div className="font-bold text-gray-900">Nassau</div>
                          <div className="text-xs text-gray-500">
                            ${fees.out}/${fees.in}/${fees.total} · {n.net ? 'Net' : 'Gross'} · {hasTeams ? 'Teams' : 'Individual'}
                          </div>
                        </div>
                      </div>
                      {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
                    </div>
                  </div>
                );
              })}

              {/* Skins Games */}
              {skinsArray.map((s: any, i: number) => {
                const skinsPot = allGolfers.length * (s.fee || 0);
                return (
                  <div
                    key={s.id}
                    onClick={isOwner ? () => setSkinsSetupId(s.id) : undefined}
                    className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">💰</span>
                        <div>
                          <div className="font-bold text-gray-900">Skins</div>
                          <div className="text-xs text-gray-500">
                            {s.net ? 'Net' : 'Gross'} · ${s.fee || 0} · Total Pot: {currency(skinsPot)}
                          </div>
                        </div>
                      </div>
                      {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
                    </div>
                  </div>
                );
              })}

              {/* Pinky Games */}
              {pinkyArray.map((p: any, i: number) => (
                <div
                  key={p.id}
                  onClick={isOwner ? () => setPinkySetupId(p.id) : undefined}
                  className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🤙</span>
                      <div>
                        <div className="font-bold text-gray-900">Pinky</div>
                        <div className="text-xs text-gray-500">${p.fee} per pinky</div>
                      </div>
                    </div>
                    {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
                  </div>
                </div>
              ))}

              {/* Greenie Games */}
              {greenieArray.map((g: any, i: number) => (
                <div
                  key={g.id}
                  onClick={isOwner ? () => setGreenieSetupId(g.id) : undefined}
                  className={`w-full bg-white rounded-xl border border-slate-200 p-4 text-left transition-colors ${isOwner ? 'cursor-pointer hover:border-slate-300' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🟢</span>
                      <div>
                        <div className="font-bold text-gray-900">Greenie</div>
                        <div className="text-xs text-gray-500">${g.fee} per greenie</div>
                      </div>
                    </div>
                    {isOwner && <span className="text-xs text-primary-600 font-bold">{canEdit ? 'Edit →' : 'View →'}</span>}
                  </div>
                </div>
              ))}

            </>
          )}
        </div>
      )}

      {/* ========== PAYOUTS SUB-TAB ========== */}
      {subTab === 'payouts' && (
        <div className="space-y-4">
          {/* Your Position Summary */}
          {myNet !== null && (
            <div className={`rounded-xl p-4 ${myNetValue >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Your Position</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500">Buy-in</div>
                  <div className="font-bold text-gray-900">{currency(myBuyin)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Winning</div>
                  <div className="font-bold text-green-600">{currency(myWinnings)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Net</div>
                  <div className={`font-black text-xl ${myNetValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {signedCurrency(myNetValue)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Not Started Message */}
          {!isEventStarted && !isEventCompleted && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <div className="text-3xl mb-2">⏳</div>
              <div className="font-bold text-gray-900">Event Not Started</div>
              <p className="text-sm text-gray-500 mt-1">
                Payouts will appear once the event begins
              </p>
            </div>
          )}

          {/* Skins Standings */}
          {(isEventStarted || isEventCompleted) && payouts.skins.length > 0 && payouts.skins.map((skinResult: any, idx: number) => {
            if (!skinResult) return null;
            const standings = Object.entries(skinResult.winningsByGolfer || {})
              .map(([id, amt]) => ({ id, amount: amt as number, holes: skinResult.winningHolesByGolfer?.[id] || [] }))
              .sort((a, b) => b.amount - a.amount);
            
            return (
              <div key={skinResult.configId || idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>💰</span>
                    <span className="font-bold text-gray-900">Skins Standings</span>
                  </div>
                  <span className="text-xs text-gray-500">Pot: {currency(skinResult.totalPot || 0)}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {standings.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500 text-sm">No skins won yet</div>
                  ) : (
                    standings.map((s, i) => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-gray-900">{getGolferName(s.id)}</div>
                          <div className="text-xs text-gray-500">
                            {s.holes.length > 0 ? `Holes: ${s.holes.join(', ')}` : 'No holes won'}
                          </div>
                        </div>
                        <div className={`font-bold ${s.amount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {s.amount > 0 ? `+${currency(s.amount)}` : currency(0)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Settlements */}
          {(isEventStarted || isEventCompleted) && allSettlements.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setShowSettlements(!showSettlements)}
                className="w-full px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span>💸</span>
                  <span className="font-bold text-gray-900">Settlements</span>
                  <span className="text-xs text-gray-500">({allSettlements.length})</span>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showSettlements ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSettlements && (
                <div className="p-4 space-y-2">
                  <EventSettlement eventId={eventId} />
                </div>
              )}
            </div>
          )}

          {/* Send Recap - After completion */}
          {isOwner && isEventCompleted && (
            <button
              onClick={() => {
                // TODO: Implement send recap notification
                alert('Recap notification sent to all players!');
              }}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700"
            >
              📤 Send Recap to Players
            </button>
          )}
        </div>
      )}
      </>
      )}

      {/* ========== ADMIN FAB ========== */}
      {isOwner && canModify && isTabActive && (
        <button
          onClick={() => setShowFabMenu(true)}
          className="fixed right-4 z-40 w-16 h-16 bg-gradient-to-br from-accent to-orange-600 rounded-full shadow-lg shadow-accent/40 flex items-center justify-center text-white text-3xl font-bold hover:scale-105 active:scale-95 transition-transform fab-position"
          title="Game actions"
          aria-label="Game actions"
        >
          <span className={`transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`}>+</span>
        </button>
      )}

      {/* FAB Action Sheet */}
      {showFabMenu && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center"
          onClick={() => setShowFabMenu(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md mx-4 mb-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-br from-slate-700 to-slate-800">
              <div className="text-white">
                <div className="text-xs font-medium opacity-80">Admin Actions</div>
                <div className="text-lg font-black">Games Setup</div>
              </div>
            </div>

            {/* Add Game */}
            <button
              onClick={() => { setShowFabMenu(false); setShowAddGame(true); }}
              className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md">
                <span className="text-xl">🎲</span>
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-gray-900">Add Game</div>
                <div className="text-xs text-gray-500">Nassau, Skins, Dots & more</div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Pick Teams — only if nassau exists */}
            {hasNassauGames && event.games.nassau.length === 1 && (
              <button
                onClick={() => {
                  setShowFabMenu(false);
                  const firstNassau = event.games.nassau[0];
                  if (firstNassau) navigate(`/event/${eventId}/games/nassau/${firstNassau.id}/teams`);
                }}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 active:bg-slate-100 transition border-b border-slate-100"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-md">
                  <span className="text-xl">👥</span>
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-gray-900">Pick Teams</div>
                  <div className="text-xs text-gray-500">
                    {nassauNeedsTeams
                      ? allGolfers.length > 1
                        ? `${allGolfers.length} players — suggest ${suggestedTeamCount} teams`
                        : 'Waiting for players to join'
                      : 'Teams assigned ✓'}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {/* Multiple Nassau games — list each for team picking */}
            {hasNassauGames && event.games.nassau.length > 1 && (
              <div className="border-b border-slate-100">
                <div className="px-4 pt-4 pb-2 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-md">
                    <span className="text-xl">👥</span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900">Pick Teams</div>
                    <div className="text-xs text-gray-500">{event.games.nassau.length} Nassau games</div>
                  </div>
                </div>
                <div className="px-4 pb-3 space-y-1.5">
                  {event.games.nassau.map((n: any, idx: number) => {
                    const teams = n.teams || [];
                    const filled = teams.filter((t: any) => (t.golferIds || []).length > 0);
                    const done = filled.length >= 2;
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          setShowFabMenu(false);
                          navigate(`/event/${eventId}/games/nassau/${n.id}/teams`);
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

            {/* Start Event */}
            {!isEventStarted && hasAnyGames && (
              <button
                onClick={() => { setShowFabMenu(false); handleStartEvent(); }}
                disabled={!gamesReady}
                className={`w-full p-4 flex items-center gap-4 transition border-b border-slate-100 ${
                  gamesReady ? 'hover:bg-green-50 active:bg-green-100' : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                  gamesReady
                    ? 'bg-gradient-to-br from-green-400 to-emerald-600'
                    : 'bg-gray-200'
                }`}>
                  <span className="text-xl">🚀</span>
                </div>
                <div className="text-left flex-1">
                  <div className={`font-bold ${gamesReady ? 'text-green-700' : 'text-gray-400'}`}>Start Event</div>
                  <div className="text-xs text-gray-500">
                    {gamesReady ? 'Lock games & begin play' : startIssues[0] || 'Complete setup first'}
                  </div>
                </div>
              </button>
            )}

            {/* Cancel */}
            <button
              onClick={() => setShowFabMenu(false)}
              className="w-full p-4 flex items-center justify-center hover:bg-slate-50 active:bg-slate-100 transition"
            >
              <span className="font-bold text-gray-500">Cancel</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* ========== MODALS (Keep existing) ========== */}
      
      {/* Add Game Modal — portaled to body so it sits above swipeable tabs */}
      {showAddGame && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowAddGame(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-gray-900">Add Game</span>
              <button onClick={() => setShowAddGame(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-2 space-y-1 max-h-[calc(90dvh-12rem)] overflow-y-auto">
              {GAME_TYPES.map((type) => {
                const playerCount = allGolfers.length;
                const needsMore = (type.minPlayers && playerCount < type.minPlayers) || (type.maxPlayers && playerCount > type.maxPlayers);
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      if (type.id === 'nassau') addNassau(false);
                      else if (type.id === 'skins') addSkins(false);
                      else if (type.id === 'pinky') addPinky();
                      else if (type.id === 'greenie') addGreenie();
                      else if (type.id === 'stableford') addStableford(false);
                      else if (type.id === 'ninePoint') addNinePoint(true);
                      else if (type.id === 'bingoBangoBongo') addBingoBangoBongo();
                      else if (type.id === 'wolf') addWolf();
                      else if (type.id === 'dots') addDots();
                      setShowAddGame(false);
                    }}
                    className="w-full px-4 py-3 text-left rounded-xl transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{type.emoji}</span>
                      <div>
                        <div className="font-bold text-gray-900">{type.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                        {needsMore && (
                          <div className="text-[10px] text-amber-600 mt-0.5 font-medium">
                            Needs {type.minPlayers === type.maxPlayers ? `exactly ${type.minPlayers}` : `${type.minPlayers}+`} players — you can add now, validate at start
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========== SETUP MODALS ========== */}
      
      {/* Legacy Add Game Button - Hidden but kept for reference */}
      {false && canEdit && (
        <div className="relative">
          <button
            onClick={() => setShowAddGame(!showAddGame)}
            className="w-full py-3 border-2 border-dashed border-primary-300 rounded-lg text-primary-600 font-medium hover:bg-primary-50 hover:border-primary-400 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Game
          </button>

          {showAddGame && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-20 overflow-hidden">
              <div className="p-2 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider px-2">Select Game Type</span>
                <button onClick={() => setShowAddGame(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Close menu">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {GAME_TYPES.map((type) => (
                  <div key={type.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">{type.name}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDescription(expandedDescription === type.id ? null : type.id);
                          }}
                          className="text-gray-400 hover:text-primary-600 transition-colors"
                          aria-label={expandedDescription === type.id ? "Hide description" : "Show description"}
                        >
                          <svg className={`w-4 h-4 transform transition-transform ${expandedDescription === type.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const defaultNet = Boolean(currentProfile?.preferences?.defaultNetScoring);
                            if (type.id === 'nassau') addNassau(defaultNet);
                            if (type.id === 'skins') addSkins(defaultNet);
                            if (type.id === 'pinky') addPinky();
                            if (type.id === 'greenie') addGreenie();
                            setShowAddGame(false);
                          }}
                          className="text-xs px-3 py-1 rounded bg-primary-600 text-white hover:bg-primary-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                    {expandedDescription === type.id && (
                      <div className="text-xs text-gray-600 mt-2 bg-blue-50 p-2 rounded border border-blue-100">
                        {type.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State - Hidden, now in sub-tabs */}
      {false && !hasAnyGames && (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-4xl mb-3">{isOwner ? '🎲' : '⛳'}</div>
          <h3 className="text-sm font-medium text-gray-900">
            {isOwner ? 'Add a Side Game' : 'No Games Yet'}
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
            {isOwner 
              ? 'Set up Nassau, Skins, or other bets to track during your round.'
              : 'The event admin hasn\'t set up any games yet. Check back later or just enjoy the round!'}
          </p>
          {isOwner && !isEventStarted && !isEventCompleted && (
            <button
              onClick={() => setShowAddGame(true)}
              className="mt-4 px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors"
            >
              + Add Game
            </button>
          )}
        </div>
      )}
      
      {/* Nassau inline cards - Hidden, now in sub-tabs */}
      {false && event.games.nassau.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2 flex items-center gap-2">
            <span className="w-1.5 h-4 bg-primary-600 rounded-full"></span>
            Nassau
          </h2>
          <div className="grid gap-3 max-w-lg">
            {event.games.nassau.map((n: any, i: number) => {
              const updateCfg = (patch: any) =>
                updateEvent(eventId, {
                  games: {
                    ...event.games,
                    nassau: event.games.nassau.map((x: any) => (x.id === n.id ? { ...x, ...patch } : x)),
                  },
                });

              const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
              const hasTeams = Boolean((n.teams || []).filter((t: any) => (t.golferIds || []).length > 0).length >= 2);

              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setNassauSetupId(n.id)}
                  className="text-left border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-extrabold text-gray-900">Nassau #{i + 1}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-bold">
                          {n.net ? 'Net' : 'Gross'}
                        </span>
                        {hasTeams ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">
                            Teams
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                            Individual
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Out <span className="font-bold text-slate-800">${fees.out}</span> · In{' '}
                        <span className="font-bold text-slate-800">${fees.in}</span> · Total{' '}
                        <span className="font-bold text-slate-800">${fees.total}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Tap to edit · Pick teams when you’re ready
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isEventStarted && !window.confirm('This event is in progress. Remove this Nassau game?')) return;
                        removeNassau(n.id);
                      }}
                      className="text-[11px] px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canModify}
                      title="Remove Nassau"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/event/${eventId}/games/nassau/${n.id}/teams`);
                      }}
                      className="text-xs font-extrabold px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canModify}
                    >
                      Pick teams
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateCfg({ net: !n.net });
                      }}
                      className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canEdit}
                      title="Toggle net/gross"
                    >
                      {n.net ? 'Switch to Gross' : 'Switch to Net'}
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Nassau Setup Modal (simple) */}
      {nassauSetupId && (() => {
        const n = event.games.nassau.find((x: any) => x.id === nassauSetupId);
        if (!n) return null;
        const fees = n.fees ?? { out: n.fee, in: n.fee, total: n.fee };
        const updateCfg = (patch: any) =>
          updateEvent(eventId, {
            games: { ...event.games, nassau: event.games.nassau.map((x: any) => (x.id === n.id ? { ...x, ...patch } : x)) },
          });
        const setFees = (next: { out: number; in: number; total: number }) => updateCfg({ fees: next });

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setNassauSetupId(null)}>
            <div className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Nassau setup</div>
                  <div className="font-extrabold text-gray-900">Set wagers</div>
                </div>
                <button
                  type="button"
                  onClick={() => setNassauSetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Gross vs Net</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: false })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        !n.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={!canEdit}
                    >
                      Gross
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: true })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        n.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={!canEdit}
                    >
                      Net
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-700 mb-2">Wagers (per player)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Out
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white text-gray-900 font-bold"
                        value={fees.out}
                        onFocus={(e) => { e.currentTarget.select(); handleFocus(); }}
                        onBlur={handleBlur}
                        onChange={(e) => setFees({ ...fees, out: Number(e.target.value) })}
                        disabled={!canEdit}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      In
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white text-gray-900 font-bold"
                        value={fees.in}
                        onFocus={(e) => { e.currentTarget.select(); handleFocus(); }}
                        onBlur={handleBlur}
                        onChange={(e) => setFees({ ...fees, in: Number(e.target.value) })}
                        disabled={!canEdit}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Total
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        className="mt-1 w-full border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white text-gray-900 font-bold"
                        value={fees.total}
                        onFocus={(e) => { e.currentTarget.select(); handleFocus(); }}
                        onBlur={handleBlur}
                        onChange={(e) => setFees({ ...fees, total: Number(e.target.value) })}
                        disabled={!canEdit}
                      />
                    </label>
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {[
                      { label: '5/5/5', fees: { out: 5, in: 5, total: 5 } },
                      { label: '5/5/10', fees: { out: 5, in: 5, total: 10 } },
                      { label: '10/10/10', fees: { out: 10, in: 10, total: 10 } },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setFees(p.fees)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        disabled={!canEdit}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-600">
                    Next: pick teams when your full group is ready. You can come back anytime.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNassauSetupId(null);
                      navigate(`/event/${eventId}/games/nassau/${n.id}/teams`);
                    }}
                    className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-extrabold"
                    disabled={!canModify}
                  >
                    Pick teams
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (isEventStarted && !window.confirm('This event is in progress. Remove this Nassau game?')) return;
                    removeNassau(n.id);
                    setNassauSetupId(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
                  disabled={!canModify}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setNassauSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Skins Setup Modal */}
      {skinsSetupId && (() => {
        const sk = skinsArray.find((x: any) => x.id === skinsSetupId);
        if (!sk) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, skins: skinsArray.map((s: any) => (s.id === sk.id ? { ...s, ...patch } : s)) } });

        const participantIds =
          sk.participantGolferIds && sk.participantGolferIds.length > 1 ? sk.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
        const inactiveGolfers = allGolfers.filter((g: any) => !participantIds.includes(g.id));
        const setList = (listIds: string[]) => {
          const normalized = listIds.length === allGolfers.length ? undefined : listIds;
          updateCfg({ participantGolferIds: normalized });
        };
        const toggleGolfer = (gid: string) => {
          if (participantIds.includes(gid)) {
            let next = participantIds.filter((id: string) => id !== gid);
            if (next.length < 2) next = allGolfers.map((g: any) => g.id);
            setList(next);
          } else {
            setList([...participantIds, gid]);
          }
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSkinsSetupId(null)}>
            <div className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Skins setup</div>
                  <div className="font-extrabold text-gray-900">Quick settings</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSkinsSetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Gross vs Net</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: false })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        !sk.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={!canEdit}
                    >
                      Gross
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCfg({ net: true })}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-extrabold border ${
                        sk.net ? 'bg-white border-primary-500 text-primary-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      disabled={!canEdit}
                    >
                      Net
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Wager</div>
                  <label className="text-xs text-slate-600">Fee per player</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={sk.fee}
                      onFocus={(e) => { e.currentTarget.select(); handleFocus(); }}
                      onBlur={handleBlur}
                      onChange={(e) => updateCfg({ fee: Number(e.target.value) })}
                      disabled={!canEdit}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900"
                    />
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!sk.carryovers}
                      onChange={(e) => updateCfg({ carryovers: e.target.checked })}
                      disabled={!canEdit}
                    />
                    Carryovers (ties carry)
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-700">Players</div>
                      <div className="text-[11px] text-slate-500">Tap names to include/exclude</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setList(allGolfers.map((g: any) => g.id))}
                      className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                      disabled={!canModify || activeGolfers.length === allGolfers.length}
                    >
                      All
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeGolfers.map((g: any) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGolfer(g.id)}
                        disabled={!canModify}
                        className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-primary-600 text-white border border-primary-600 disabled:opacity-50"
                      >
                        {g.name}
                      </button>
                    ))}
                    {inactiveGolfers.map((g: any) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGolfer(g.id)}
                        disabled={!canModify}
                        className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-primary-700 border border-primary-300 disabled:opacity-50"
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (isEventStarted && !window.confirm('This event is in progress. Remove this Skins game?')) return;
                    removeSkins(sk.id);
                    setSkinsSetupId(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
                  disabled={!canModify}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setSkinsSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Pinky Setup/Entry Modal */}
      {pinkySetupId && (() => {
        const cfg = pinkyArray.find((x: any) => x.id === pinkySetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, pinky: pinkyArray.map((p: any) => (p.id === cfg.id ? { ...p, ...patch } : p)) } });

        const participantIds =
          cfg.participantGolferIds && cfg.participantGolferIds.length > 1 ? cfg.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
        const inactiveGolfers = allGolfers.filter((g: any) => !participantIds.includes(g.id));
        const setList = (listIds: string[]) => {
          const normalized = listIds.length === allGolfers.length ? undefined : listIds;
          updateCfg({ participantGolferIds: normalized });
        };
        const toggleGolfer = (gid: string) => {
          if (participantIds.includes(gid)) {
            let next = participantIds.filter((id: string) => id !== gid);
            if (next.length < 2) next = allGolfers.map((g: any) => g.id);
            setList(next);
          } else {
            setList([...participantIds, gid]);
          }
        };

        const results = (event.pinkyResults && event.pinkyResults[cfg.id]) || [];
        const getCount = (gid: string) => results.find((r: any) => r.golferId === gid)?.count || 0;

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPinkySetupId(null)}>
            <div className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Pinky</div>
                  <div className="font-extrabold text-gray-900">Enter counts</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPinkySetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label className="text-xs text-slate-600">Fee per pinky</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={cfg.fee}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateCfg({ fee: Number(e.target.value) })}
                      disabled={!canEdit}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Counts</div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeGolfers.map((g: any) => (
                      <label key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <span className="text-xs font-bold text-slate-800 truncate" title={g.name}>
                          {g.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={getCount(g.id)}
                          onFocus={(e) => { e.currentTarget.select(); handleFocus(); }}
                          onBlur={handleBlur}
                          onChange={(e) => setPinkyCount(cfg.id, g.id, Number(e.target.value))}
                          disabled={!canModify}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-sm font-bold"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700 select-none">Players</summary>
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">Tap to include/exclude</div>
                      <button
                        type="button"
                        onClick={() => setList(allGolfers.map((g: any) => g.id))}
                        className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                        disabled={!canModify || activeGolfers.length === allGolfers.length}
                      >
                        All
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={!canModify}
                          className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-primary-600 text-white border border-primary-600 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                      {inactiveGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={!canModify}
                          className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-primary-700 border border-primary-300 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (isEventStarted && !window.confirm('This event is in progress. Remove this Pinky game?')) return;
                    removePinky(cfg.id);
                    setPinkySetupId(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
                  disabled={!canModify}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setPinkySetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Greenie Setup/Entry Modal */}
      {greenieSetupId && (() => {
        const cfg = greenieArray.find((x: any) => x.id === greenieSetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, greenie: greenieArray.map((g: any) => (g.id === cfg.id ? { ...g, ...patch } : g)) } });

        const participantIds =
          cfg.participantGolferIds && cfg.participantGolferIds.length > 1 ? cfg.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfers = allGolfers.filter((g: any) => participantIds.includes(g.id));
        const inactiveGolfers = allGolfers.filter((g: any) => !participantIds.includes(g.id));
        const setList = (listIds: string[]) => {
          const normalized = listIds.length === allGolfers.length ? undefined : listIds;
          updateCfg({ participantGolferIds: normalized });
        };
        const toggleGolfer = (gid: string) => {
          if (participantIds.includes(gid)) {
            let next = participantIds.filter((id: string) => id !== gid);
            if (next.length < 2) next = allGolfers.map((g: any) => g.id);
            setList(next);
          } else {
            setList([...participantIds, gid]);
          }
        };

        const results = (event.greenieResults && event.greenieResults[cfg.id]) || [];
        const getCount = (gid: string) => results.find((r: any) => r.golferId === gid)?.count || 0;

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setGreenieSetupId(null)}>
            <div className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Greenie</div>
                  <div className="font-extrabold text-gray-900">Enter counts</div>
                </div>
                <button
                  type="button"
                  onClick={() => setGreenieSetupId(null)}
                  className="p-2 rounded-full hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <label className="text-xs text-slate-600">Fee per greenie</label>
                  <div className="mt-1">
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={cfg.fee}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => updateCfg({ fee: Number(e.target.value) })}
                      disabled={!canEdit}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Counts</div>
                  <div className="grid grid-cols-2 gap-2">
                    {activeGolfers.map((g: any) => (
                      <label key={g.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <span className="text-xs font-bold text-slate-800 truncate" title={g.name}>
                          {g.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="4"
                          value={getCount(g.id)}
                          onFocus={(e) => { e.currentTarget.select(); handleFocus(); }}
                          onBlur={handleBlur}
                          onChange={(e) => setGreenieCount(cfg.id, g.id, Number(e.target.value))}
                          disabled={!canModify}
                          className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center text-sm font-bold"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700 select-none">Players</summary>
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-slate-500">Tap to include/exclude</div>
                      <button
                        type="button"
                        onClick={() => setList(allGolfers.map((g: any) => g.id))}
                        className="text-[11px] font-extrabold px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                        disabled={!canModify || activeGolfers.length === allGolfers.length}
                      >
                        All
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={!canModify}
                          className="text-xs font-extrabold px-3 py-1.5 rounded-full bg-primary-600 text-white border border-primary-600 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                      {inactiveGolfers.map((g: any) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGolfer(g.id)}
                          disabled={!canModify}
                          className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-primary-700 border border-primary-300 disabled:opacity-50"
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (isEventStarted && !window.confirm('This event is in progress. Remove this Greenie game?')) return;
                    removeGreenie(cfg.id);
                    setGreenieSetupId(null);
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50"
                  disabled={!canModify}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setGreenieSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
      
      {/* ========== STABLEFORD SETUP MODAL ========== */}
      {stablefordSetupId && (() => {
        const cfg = stablefordArray.find((x: any) => x.id === stablefordSetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, stableford: stablefordArray.map((s: any) => (s.id === cfg.id ? { ...s, ...patch } : s)) } });
        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setStablefordSetupId(null)}>
            <div className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Stableford</div>
                  <div className="font-extrabold text-gray-900">Setup</div>
                </div>
                <button onClick={() => setStablefordSetupId(null)} className="p-2 rounded-full hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                {/* Scoring type toggle */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs font-bold text-slate-700">Scoring</label>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => updateCfg({ net: false })} disabled={!canEdit}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${!cfg.net ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Gross</button>
                    <button onClick={() => updateCfg({ net: true })} disabled={!canEdit}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${cfg.net ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Net</button>
                  </div>
                </div>
                {/* System toggle */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs font-bold text-slate-700">Point System</label>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => updateCfg({ system: 'standard' })} disabled={!canEdit}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${(cfg.system || 'standard') === 'standard' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      Standard
                    </button>
                    <button onClick={() => updateCfg({ system: 'modified' })} disabled={!canEdit}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${cfg.system === 'modified' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      Modified
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500">
                    {(cfg.system || 'standard') === 'standard' 
                      ? 'Dbl Bogey+=0, Bogey=1, Par=2, Birdie=3, Eagle=4' 
                      : 'Dbl Bogey+=-3, Bogey=-1, Par=0, Birdie=+2, Eagle=+5'}
                  </div>
                </div>
                {/* Fee */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-600">Entry fee per player</label>
                  <input type="number" min="1" step="1" value={cfg.fee} onFocus={e => { e.currentTarget.select(); handleFocus(); }} onBlur={handleBlur}
                    onChange={e => updateCfg({ fee: Number(e.target.value) })} disabled={!canEdit}
                    className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900" />
                </div>
              </div>
              <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button onClick={() => { if (isEventStarted && !window.confirm('This event is in progress. Remove this Stableford game?')) return; useStore.getState().removeStableford(eventId, cfg.id); setStablefordSetupId(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50" disabled={!canModify}>Remove</button>
                <button onClick={() => setStablefordSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">Done</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========== 9-POINT SETUP MODAL ========== */}
      {ninePointSetupId && (() => {
        const cfg = ninePointArray.find((x: any) => x.id === ninePointSetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, ninePoint: ninePointArray.map((s: any) => (s.id === cfg.id ? { ...s, ...patch } : s)) } });
        const participantIds = cfg.participantGolferIds || [];
        const activeGolfers9 = allGolfers.filter((g: any) => participantIds.includes(g.id));
        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setNinePointSetupId(null)}>
            <div className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">9-Point</div>
                  <div className="font-extrabold text-gray-900">Setup (3 Players)</div>
                </div>
                <button onClick={() => setNinePointSetupId(null)} className="p-2 rounded-full hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs font-bold text-slate-700">Scoring</label>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => updateCfg({ net: false })} disabled={!canEdit}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold ${!cfg.net ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Gross</button>
                    <button onClick={() => updateCfg({ net: true })} disabled={!canEdit}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold ${cfg.net ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Net</button>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-600">$ per point</label>
                  <input type="number" min="0.25" step="0.25" value={cfg.fee} onFocus={e => { e.currentTarget.select(); handleFocus(); }} onBlur={handleBlur}
                    onChange={e => updateCfg({ fee: Number(e.target.value) })} disabled={!canEdit}
                    className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900" />
                  <div className="text-[10px] text-slate-400 mt-1">Max per hole: ${(cfg.fee * 9).toFixed(2)} · Max round: ${(cfg.fee * 162).toFixed(2)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cfg.sweepEnabled || false} onChange={e => updateCfg({ sweepEnabled: e.target.checked })} disabled={!canEdit}
                      className="rounded border-slate-300 text-primary-600" />
                    <span className="text-xs font-bold text-slate-700">Sweep variant</span>
                  </label>
                  <div className="text-[10px] text-slate-400 mt-1">Win by 2+ strokes = all 9 points</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Players (exactly 3)</div>
                  <div className="flex flex-wrap gap-2">
                    {allGolfers.map((g: any) => {
                      const isIn = participantIds.includes(g.id);
                      return (
                        <button key={g.id} disabled={!canEdit || (isIn && participantIds.length <= 3) || (!isIn && participantIds.length >= 3)}
                          onClick={() => {
                            if (isIn) updateCfg({ participantGolferIds: participantIds.filter((id: string) => id !== g.id) });
                            else updateCfg({ participantGolferIds: [...participantIds, g.id].slice(0, 3) });
                          }}
                          className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${isIn ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-primary-700 border-primary-300'}`}>
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                  {participantIds.length !== 3 && <div className="text-[10px] text-red-500 mt-1 font-medium">Select exactly 3 players</div>}
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-[10px] text-slate-500">
                  <div className="font-bold text-slate-700 text-xs mb-1">How 9-Point Works</div>
                  Every hole: Low=5, Mid=3, High=1. All tie=3-3-3. Two tie low=4-4-1. Two tie high=5-2-2.
                </div>
              </div>
              <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button onClick={() => { if (isEventStarted && !window.confirm('This event is in progress. Remove this 9-Point game?')) return; useStore.getState().removeNinePoint(eventId, cfg.id); setNinePointSetupId(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50" disabled={!canModify}>Remove</button>
                <button onClick={() => setNinePointSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">Done</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========== BINGO BANGO BONGO SETUP MODAL ========== */}
      {bbbSetupId && (() => {
        const cfg = bbbArray.find((x: any) => x.id === bbbSetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, bingoBangoBongo: bbbArray.map((s: any) => (s.id === cfg.id ? { ...s, ...patch } : s)) } });
        const results: BingoBangoBongoHoleResult[] = (event.bbbResults && event.bbbResults[cfg.id]) || [];
        const participantIds = cfg.participantGolferIds && cfg.participantGolferIds.length > 1 ? cfg.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfers3B = allGolfers.filter((g: any) => participantIds.includes(g.id));
        
        const getHoleResult = (hole: number) => results.find((r: any) => r.hole === hole) || { hole, bingo: undefined, bango: undefined, bongo: undefined };
        const updateHoleResult = (hole: number, field: 'bingo' | 'bango' | 'bongo', golferId: string | undefined) => {
          const existing = results.filter((r: any) => r.hole !== hole);
          const current = getHoleResult(hole);
          const updated = { ...current, [field]: golferId };
          existing.push(updated);
          useStore.getState().setBBBResults(eventId, cfg.id, existing);
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setBbbSetupId(null)}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Bingo Bango Bongo</div>
                  <div className="font-extrabold text-gray-900">${cfg.fee}/point · Enter Results</div>
                </div>
                <button onClick={() => setBbbSetupId(null)} className="p-2 rounded-full hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {/* Fee */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-600">$ per point</label>
                  <input type="number" min="0.25" step="0.25" value={cfg.fee} onFocus={e => e.currentTarget.select()}
                    onChange={e => updateCfg({ fee: Number(e.target.value) })} disabled={!canEdit}
                    className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900" />
                </div>
                {/* Legend */}
                <div className="bg-slate-50 rounded-xl p-2 text-[10px] text-slate-500 grid grid-cols-3 gap-1 text-center">
                  <div><span className="font-bold text-green-700">Bingo</span><br/>First on green</div>
                  <div><span className="font-bold text-blue-700">Bango</span><br/>Closest when all on</div>
                  <div><span className="font-bold text-purple-700">Bongo</span><br/>First to hole out</div>
                </div>
                {/* Per-hole entry */}
                {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
                  const hr = getHoleResult(hole);
                  return (
                    <div key={hole} className="rounded-lg border border-slate-200 p-2">
                      <div className="text-xs font-bold text-slate-700 mb-1">Hole {hole}</div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['bingo', 'bango', 'bongo'] as const).map(field => (
                          <select key={field} value={hr[field] || ''} disabled={!canEdit}
                            onChange={e => updateHoleResult(hole, field, e.target.value || undefined)}
                            className="text-[10px] border border-slate-200 rounded px-1 py-1 bg-white">
                            <option value="">-</option>
                            {activeGolfers3B.map((g: any) => <option key={g.id} value={g.id}>{g.name?.split(' ')[0]}</option>)}
                          </select>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <button onClick={() => { if (isEventStarted && !window.confirm('This event is in progress. Remove this Bingo Bango Bongo game?')) return; useStore.getState().removeBingoBangoBongo(eventId, cfg.id); setBbbSetupId(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50" disabled={!canModify}>Remove</button>
                <button onClick={() => setBbbSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">Done</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========== WOLF SETUP MODAL ========== */}
      {wolfSetupId && (() => {
        const cfg = wolfArray.find((x: any) => x.id === wolfSetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, wolf: wolfArray.map((s: any) => (s.id === cfg.id ? { ...s, ...patch } : s)) } });
        const wolfOrder = cfg.wolfOrder || cfg.participantGolferIds || [];
        const holeResults: WolfHoleResult[] = (event.wolfResults && event.wolfResults[cfg.id]) || [];
        const participantIds = cfg.participantGolferIds || [];
        const activeGolfersW = allGolfers.filter((g: any) => participantIds.includes(g.id));
        
        const getHoleResult = (hole: number) => holeResults.find((r: any) => r.hole === hole);
        const updateHoleResult = (hole: number, patch: Partial<WolfHoleResult>) => {
          const existing = holeResults.filter((r: any) => r.hole !== hole);
          const current = getHoleResult(hole) || { hole, wolfId: wolfOrder[(hole - 1) % 4], isLoneWolf: false, winner: 'wolf' as const, points: 1 };
          existing.push({ ...current, ...patch });
          useStore.getState().setWolfResults(eventId, cfg.id, existing);
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setWolfSetupId(null)}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Wolf</div>
                  <div className="font-extrabold text-gray-900">${cfg.fee}/point · 4 Players</div>
                </div>
                <button onClick={() => setWolfSetupId(null)} className="p-2 rounded-full hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {/* Fee */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-600">$ per point</label>
                  <input type="number" min="0.25" step="0.25" value={cfg.fee} onFocus={e => { e.currentTarget.select(); handleFocus(); }} onBlur={handleBlur}
                    onChange={e => updateCfg({ fee: Number(e.target.value) })} disabled={!canEdit}
                    className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900" />
                </div>
                {/* Wolf order */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Wolf Rotation Order</div>
                  <div className="space-y-1">
                    {wolfOrder.map((gid: string, idx: number) => (
                      <div key={gid} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-bold text-slate-700">#{idx + 1} {getGolferName(gid)}</span>
                        <div className="flex gap-1">
                          {idx > 0 && canEdit && (
                            <button onClick={() => { const o = [...wolfOrder]; [o[idx], o[idx-1]] = [o[idx-1], o[idx]]; updateCfg({ wolfOrder: o }); }}
                              className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded">Up</button>
                          )}
                          {idx < wolfOrder.length - 1 && canEdit && (
                            <button onClick={() => { const o = [...wolfOrder]; [o[idx], o[idx+1]] = [o[idx+1], o[idx]]; updateCfg({ wolfOrder: o }); }}
                              className="text-[10px] px-2 py-1 bg-white border border-slate-200 rounded">Dn</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Blind wolf toggle */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={cfg.blindWolfEnabled || false} onChange={e => updateCfg({ blindWolfEnabled: e.target.checked })} disabled={!canEdit}
                      className="rounded border-slate-300 text-primary-600" />
                    <span className="text-xs font-bold text-slate-700">Allow Blind Wolf</span>
                  </label>
                  <div className="text-[10px] text-slate-400 mt-1">Declare Lone Wolf before anyone tees off = 4x multiplier</div>
                </div>
                {/* Per-hole results */}
                <div className="text-xs font-bold text-slate-700">Hole Results</div>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
                  const hr = getHoleResult(hole);
                  const wolfThisHole = wolfOrder[(hole - 1) % 4];
                  const otherPlayers = participantIds.filter((p: string) => p !== wolfThisHole);
                  return (
                    <div key={hole} className="rounded-lg border border-slate-200 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-bold text-slate-700">Hole {hole}</div>
                        <div className="text-[10px] text-slate-500">Wolf: <span className="font-bold">{getGolferName(wolfThisHole)?.split(' ')[0]}</span></div>
                      </div>
                      {hr ? (
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`px-2 py-0.5 rounded-full font-bold ${hr.isLoneWolf ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {hr.isLoneWolf ? 'Lone Wolf' : `Partner: ${getGolferName(hr.partnerId || '')?.split(' ')[0]}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full font-bold ${hr.winner === 'wolf' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {hr.winner === 'wolf' ? 'Wolf wins' : 'Field wins'}
                          </span>
                        </div>
                      ) : canEdit ? (
                        <div className="flex gap-1 flex-wrap">
                          {otherPlayers.map((pid: string) => (
                            <button key={pid} onClick={() => updateHoleResult(hole, { wolfId: wolfThisHole, partnerId: pid, isLoneWolf: false, winner: 'wolf', points: 1 })}
                              className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold hover:bg-blue-100">
                              Pick {getGolferName(pid)?.split(' ')[0]}
                            </button>
                          ))}
                          <button onClick={() => updateHoleResult(hole, { wolfId: wolfThisHole, partnerId: undefined, isLoneWolf: true, winner: 'wolf', points: 3 })}
                            className="text-[10px] px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded font-bold hover:bg-purple-100">
                            Lone Wolf
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">Not played yet</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <button onClick={() => { if (isEventStarted && !window.confirm('This event is in progress. Remove this Wolf game?')) return; useStore.getState().removeWolf(eventId, cfg.id); setWolfSetupId(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50" disabled={!canModify}>Remove</button>
                <button onClick={() => setWolfSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">Done</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========== DOTS/JUNK SETUP MODAL ========== */}
      {dotsSetupId && (() => {
        const cfg = dotsArray.find((x: any) => x.id === dotsSetupId);
        if (!cfg) return null;
        const updateCfg = (patch: any) =>
          updateEvent(eventId, { games: { ...event.games, dots: dotsArray.map((s: any) => (s.id === cfg.id ? { ...s, ...patch } : s)) } });
        const participantIds = cfg.participantGolferIds && cfg.participantGolferIds.length > 1 ? cfg.participantGolferIds : allGolfers.map((g: any) => g.id);
        const activeGolfersD = allGolfers.filter((g: any) => participantIds.includes(g.id));
        const activeDots: DotCategory[] = cfg.activeDots || [...DEFAULT_DOTS];
        const dotResults: DotsPlayerResult[] = (event.dotsResults && event.dotsResults[cfg.id]) || [];
        
        const getPlayerDots = (gid: string) => dotResults.find((r: any) => r.golferId === gid);
        const updatePlayerDotCount = (gid: string, category: DotCategory, count: number) => {
          const existing = dotResults.filter((r: any) => r.golferId !== gid);
          const current = getPlayerDots(gid) || { golferId: gid, dots: {}, totalDots: 0 };
          const newDots = { ...current.dots, [category]: count };
          // Calculate total (positive for rewards, negative for penalties)
          let total = 0;
          Object.entries(newDots).forEach(([cat, cnt]) => {
            const def = DOT_DEFINITIONS[cat as DotCategory];
            total += def?.penalty ? -(cnt as number) : (cnt as number);
          });
          existing.push({ golferId: gid, dots: newDots, totalDots: total });
          useStore.getState().setDotsResults(eventId, cfg.id, existing);
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDotsSetupId(null)}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  <div className="text-xs font-bold tracking-[0.15em] text-slate-400 uppercase">Dots / Junk</div>
                  <div className="font-extrabold text-gray-900">${cfg.fee}/dot</div>
                </div>
                <button onClick={() => setDotsSetupId(null)} className="p-2 rounded-full hover:bg-slate-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {/* Fee */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs text-slate-600">$ per dot</label>
                  <input type="number" min="0.25" step="0.25" value={cfg.fee} onFocus={e => { e.currentTarget.select(); handleFocus(); }} onBlur={handleBlur}
                    onChange={e => updateCfg({ fee: Number(e.target.value) })} disabled={!canEdit}
                    className="w-full mt-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold bg-white text-gray-900" />
                </div>
                {/* Active dots toggle */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Active Categories</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.entries(DOT_DEFINITIONS) as [DotCategory, typeof DOT_DEFINITIONS[DotCategory]][]).map(([cat, def]) => {
                      const isActive = activeDots.includes(cat);
                      return (
                        <button key={cat} disabled={!canEdit}
                          onClick={() => {
                            const next = isActive ? activeDots.filter((c: DotCategory) => c !== cat) : [...activeDots, cat];
                            updateCfg({ activeDots: next });
                          }}
                          className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-colors ${
                            isActive 
                              ? def.penalty ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'
                              : 'bg-white text-slate-400 border-slate-200'
                          }`}>
                          {def.emoji} {def.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Per-player dot entry */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2">Player Dots</div>
                  {activeGolfersD.map((g: any) => {
                    const pd = getPlayerDots(g.id);
                    return (
                      <div key={g.id} className="mb-3 last:mb-0">
                        <div className="text-xs font-bold text-slate-800 mb-1">{g.name}</div>
                        <div className="grid grid-cols-3 gap-1">
                          {activeDots.map((cat: DotCategory) => {
                            const def = DOT_DEFINITIONS[cat];
                            const count = pd?.dots?.[cat] || 0;
                            return (
                              <div key={cat} className="flex items-center justify-between gap-1 rounded border border-slate-100 px-1.5 py-1">
                                <span className="text-[9px] text-slate-500 truncate">{def?.emoji} {def?.label}</span>
                                <input type="number" min="0" max="18" value={count}
                                  onFocus={e => { e.currentTarget.select(); handleFocus(); }}
                                  onBlur={handleBlur}
                                  onChange={e => updatePlayerDotCount(g.id, cat, Number(e.target.value))}
                                  disabled={!canEdit}
                                  className="w-10 text-center text-[10px] font-bold border border-slate-200 rounded px-1 py-0.5" />
                              </div>
                            );
                          })}
                        </div>
                        {pd && <div className="text-[10px] text-right text-slate-500 mt-0.5">Net: <span className="font-bold">{pd.totalDots}</span> dots</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <button onClick={() => { if (isEventStarted && !window.confirm('This event is in progress. Remove this Dots game?')) return; useStore.getState().removeDots(eventId, cfg.id); setDotsSetupId(null); }}
                  className="px-3 py-2 rounded-lg text-xs font-extrabold border border-red-200 bg-red-50 text-red-700 disabled:opacity-50" disabled={!canModify}>Remove</button>
                <button onClick={() => setDotsSetupId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-extrabold border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">Done</button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* ========== PAYOUTS & BALANCE SECTION (HIDDEN - replaced by inline wheel payouts) ========== */}
      {false && hasAnyGames && (
        <div className="mt-6 space-y-4">
          {/* Section Header - with background for contrast */}
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-slate-200 shadow-sm">
            <span className="text-lg">💰</span>
            <h3 className="font-bold text-gray-900">Payouts</h3>
            {isEventCompleted && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">FINAL</span>}
            {isEventStarted && !isEventCompleted && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">LIVE</span>}
            {!isEventStarted && !isEventCompleted && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">PREVIEW</span>}
          </div>
          
          {/* Live Skins Results */}
          {payouts.skins.length > 0 && (isEventStarted || isEventCompleted) && payouts.skins.map((skinResult: any, idx: number) => {
            if (!skinResult) return null;
            const skinsWon = Object.entries(skinResult.winningsByGolfer || {})
              .filter(([_, amt]) => (amt as number) > 0)
              .sort((a, b) => (b[1] as number) - (a[1] as number));
            
            return (
              <div key={skinResult.configId || idx} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💰</span>
                    <span className="font-bold text-gray-900">Skins Results</span>
                  </div>
                  <span className="text-xs text-gray-500">Pot: ${skinResult.totalPot?.toFixed(2)}</span>
                </div>
                
                {skinsWon.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-2">
                    No skins won yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {skinsWon.map(([golferId, amount]) => {
                      const golfer = allGolfers.find((g: any) => g.id === golferId);
                      const holesWon = skinResult.winningHolesByGolfer?.[golferId] || [];
                      return (
                        <div key={golferId} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{golfer?.name || golferId}</div>
                            <div className="text-xs text-gray-500">
                              Holes: {holesWon.join(', ') || 'None'}
                            </div>
                          </div>
                          <div className="font-bold text-green-600">+${(amount as number).toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Big Net Result - Completed events */}
          {isEventCompleted && myNet != null && (
            <div className={`rounded-2xl p-6 text-center ${myNetValue >= 0 ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white shadow-lg`}>
              <div className="text-sm opacity-80 font-medium mb-1">Your Final Result</div>
              <div className="text-5xl font-black">{signedCurrency(myNetValue)}</div>
              <div className="text-sm opacity-80 mt-2">Buy-in: {currency(myBuyin)}</div>
            </div>
          )}
          
          {/* Running balance - In progress events */}
          {isEventStarted && !isEventCompleted && myNet != null && (
            <div className={`rounded-xl overflow-hidden border ${myNetValue >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div 
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandBalance(!expandBalance)}
              >
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    Your Balance
                    <svg className={`w-3 h-3 transition-transform ${expandBalance ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className={`text-2xl font-black ${myNetValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {signedCurrency(myNetValue)}
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>Buy-in: {currency(myBuyin)}</div>
                  <div>Winnings: {signedCurrency(myWinnings)}</div>
                </div>
              </div>
              
              {/* Expanded Breakdown */}
              {expandBalance && (
                <div className={`px-4 pb-4 pt-0 border-t ${myNetValue >= 0 ? 'border-green-100' : 'border-red-100'}`}>
                  <div className="mt-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Buy-in Breakdown</div>
                  <div className="mt-1 space-y-1">
                    {buyinBreakdown.length > 0 ? (
                      buyinBreakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-gray-700">
                          <span>{item.name}</span>
                          <span className="font-medium">{currency(item.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-400 italic">No buy-ins</div>
                    )}
                    <div className="border-t border-gray-200/50 mt-2 pt-1 flex justify-between text-sm font-bold text-gray-900">
                      <span>Total</span>
                      <span>{currency(myBuyin)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* All Settlements - Show all for transparency */}
          {allSettlements.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowSettlements(!showSettlements)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">💸</span>
                  <span className="font-bold text-gray-900 text-sm">Settlements</span>
                  <span className="text-xs text-gray-500">({allSettlements.length})</span>
                </div>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showSettlements ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showSettlements && (
                <div className="px-4 pb-4 space-y-2">
                  <EventSettlement eventId={eventId} />
                </div>
              )}
            </div>
          )}
          
          {/* No settlements yet message */}
          {allSettlements.length === 0 && (isEventStarted || isEventCompleted) && (
            <div className="bg-white rounded-xl p-4 text-center text-gray-600 text-sm border border-slate-200">
              No settlements calculated yet. Complete all scores to see payouts.
            </div>
          )}
          
          {/* Complete Event button - Owner only */}
          {isOwner && isEventStarted && !isEventCompleted && (
            <button
              onClick={handleCompleteEvent}
              disabled={!allScoresComplete}
              className={`w-full py-4 rounded-xl font-bold text-base ${
                !allScoresComplete
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg hover:from-green-700 hover:to-green-800'
              }`}
            >
              {!allScoresComplete ? 'Complete All Scores First' : '✓ Complete Event'}
            </button>
          )}
        </div>
      )}
      
      {bulkAssignState && (() => {
        const nassau = event.games.nassau.find((nn: any) => nn.id === bulkAssignState.nassauId);
        if (!nassau) return null;
        // Use all event golfers — participantGolferIds may be stale after new players join
        const activeGolfers = allGolfers;
        const teams = nassau.teams || [];
        const allAssignedIds = new Set(teams.flatMap((t:any)=> t.golferIds));
        // Only show unassigned golfers to streamline repeated assignments
        const unassigned = activeGolfers.filter((gg:any)=> !allAssignedIds.has(gg.id));
        const toggleSelect = (id: string) => {
          setBulkAssignState(s => {
            if (!s) return s;
            const next = new Set(s.selected);
            if (next.has(id)) next.delete(id); else next.add(id);
            return { ...s, selected: next };
          });
        };
        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={closeBulk}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 flex flex-col gap-3 text-xs animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Bulk Assign Golfers</h3>
                <button onClick={closeBulk} className="text-[10px] px-2 py-0.5 rounded border">Close</button>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <label className="flex items-center gap-1"><input type="radio" name="bulkMode" checked={bulkAssignState.mode==='assign'} onChange={()=> setBulkAssignState(s=> s?{...s, mode:'assign'}:s)} disabled={!canEdit} /> Assign to Team</label>
                <label className="flex items-center gap-1"><input type="radio" name="bulkMode" checked={bulkAssignState.mode==='roundRobin'} onChange={()=> setBulkAssignState(s=> s?{...s, mode:'roundRobin'}:s)} disabled={!canEdit} /> Even Round-Robin</label>
                {bulkAssignState.mode==='assign' && (
                  <select className="border rounded px-1 py-0.5 disabled:opacity-50" aria-label="Select team to assign" value={bulkAssignState.teamId || ''} onChange={e => setBulkAssignState(s=> s?{...s, teamId: e.target.value || undefined}:s)} disabled={!canEdit}>
                    <option value="">Select team</option>
                    {teams.map((t: any)=> <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}
              </div>
              <div className="border rounded max-h-60 overflow-auto p-2 grid grid-cols-2 gap-1">
                {unassigned.length === 0 && (
                  <div className="col-span-2 text-[10px] text-gray-500">All golfers assigned to a team.</div>
                )}
                {unassigned.map((gg: any) => {
                  const sel = bulkAssignState.selected.has(gg.id);
                  return (
                    <label key={gg.id} className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${sel ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-primary-300 text-primary-700'} disabled:opacity-50 disabled:cursor-not-allowed ${!canEdit ? 'pointer-events-none' : ''}`}>
                      <input type="checkbox" className="hidden" checked={sel} onChange={()=> toggleSelect(gg.id)} disabled={!canEdit} />
                      <span className="truncate">{gg.name}</span>
                      {gg.handicapIndex != null && <span className="text-[9px] opacity-70">({gg.handicapIndex})</span>}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between items-center">
                <div className="text-[10px] text-gray-500">{bulkAssignState.selected.size} selected</div>
                <div className="flex gap-2">
                  <button disabled={bulkAssignState.selected.size===0 || (bulkAssignState.mode==='assign' && !bulkAssignState.teamId) || !canEdit} onClick={()=> commitBulkAssign(nassau, activeGolfers)} className="text-[10px] px-3 py-1 rounded bg-primary-600 text-white disabled:opacity-40">Apply</button>
                  <button onClick={closeBulk} className="text-[10px] px-3 py-1 rounded border">Cancel</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default GamesTab;

