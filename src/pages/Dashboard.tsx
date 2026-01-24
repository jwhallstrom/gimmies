import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthMode } from '../hooks/useAuthMode';
import { CreateEventWizard } from '../components/CreateEventWizard';
import { CreateGroupWizard } from '../components/CreateGroupWizard';
import { useEventsAdapter, useWalletAdapter } from '../adapters';
import type { Event } from '../state/types';
import useStore from '../state/store';
import { fileToAvatarDataUrl } from '../utils/avatarImage';
import { getHole } from '../data/cloudCourses';

type SocialTab = 'groups' | 'events';

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const getEventLastMessage = (e: Event) => (e.chat && e.chat.length ? e.chat[e.chat.length - 1] : null);

const Dashboard: React.FC = () => {
  const {
    events,
    userEvents,
    currentProfile,
    currentUser,
    joinEventByCode,
    loadEventsFromCloud,
    profiles,
  } = useEventsAdapter();
  const { wallet, pendingSettlements } = useWalletAdapter();
  const { isGuest } = useAuthMode();

  const navigate = useNavigate();
  const updateProfile = useStore((s) => s.updateProfile);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showCreateGroupWizard, setShowCreateGroupWizard] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [socialTab, setSocialTab] = useState<SocialTab>('groups');

  // Keep cloud events fresh when landing on the dashboard.
  useEffect(() => {
    if (!currentProfile) return;
    loadEventsFromCloud().catch(() => {});
  }, [currentProfile?.id]);

  const lastRound = useMemo(() => {
    const rounds = currentProfile?.individualRounds || [];
    const sorted = [...rounds].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0] || null;
  }, [currentProfile?.id, currentProfile?.individualRounds]);

  // Separate groups (ongoing/permanent feel) from events (game sessions)
  // For now, treat completed events as "archived" and active/upcoming as both
  const { activeEvents, completedEvents } = useMemo(() => {
    const active: Event[] = [];
    const completed: Event[] = [];
    
    userEvents.forEach(e => {
      if (e.hubType === 'group') return; // groups are not playable events
      if (e.isCompleted) {
        completed.push(e);
      } else {
        active.push(e);
      }
    });
    
    // Sort by most recent activity
    active.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    completed.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    
    return { activeEvents: active, completedEvents: completed };
  }, [userEvents]);

  // For the "groups" view - all events sorted by chat activity
  const allGroupsSorted = useMemo(() => {
    return [...userEvents]
      .filter((e) => e.hubType === 'group')
      .sort((a, b) => {
      const aLastChat = a.chat?.length ? new Date(a.chat[a.chat.length - 1].createdAt).getTime() : 0;
      const bLastChat = b.chat?.length ? new Date(b.chat[b.chat.length - 1].createdAt).getTime() : 0;
      return bLastChat - aLastChat;
    });
  }, [userEvents]);

  const tickerEvent = useMemo(() => {
    const candidates = [...activeEvents];
    if (candidates.length) return candidates[0];
    const done = [...completedEvents];
    return done.length ? done[0] : null;
  }, [activeEvents, completedEvents]);

  type TickerItem = {
    id: string;
    type: 'leader' | 'player' | 'update' | 'info' | 'betting';
    highlight?: boolean;
    payload: {
      text: string;
      score?: number | null; // to-par
      thru?: number | null;
      isFinal?: boolean;
    };
  };

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

    // Rank w/ ties ("T3").
    const playerStrings = rows.slice(0, 10).map((r: any, idx: number) => {
      const betterCount = rows.slice(0, idx).filter((p: any) => typeof p.toPar === 'number' && typeof r.toPar === 'number' && p.toPar < r.toPar).length;
      const rank = betterCount + 1;
      const isTied = rows.filter((p: any) => typeof p.toPar === 'number' && typeof r.toPar === 'number' && p.toPar === r.toPar).length > 1;
      const rankLabel = `${isTied ? 'T' : ''}${rank}.`;
      const statusLabel = r.isFinal ? 'F' : `Thru ${r.thru || 0}`;
      const onHoleLabel = r.isFinal || (r.thru || 0) === 0 ? '' : ` (${r.onHole || 1})`;
      return {
        id: `p-${r.golferId}`,
        type: 'player' as const,
        payload: {
          text: `${rankLabel} ${r.name}`,
          score: typeof r.toPar === 'number' ? r.toPar : null,
          thru: r.thru,
          isFinal: !!r.isFinal,
        },
        // stash status in text tail (rendered separately)
        _status: `${statusLabel}${onHoleLabel}`,
      };
    });

    const leader = rows[0];
    const leaderStatus = leader
      ? (leader.isFinal ? 'F' : `Thru ${leader.thru || 0}`)
      : null;

    const items: TickerItem[] = [];

    // Tournament/Event name FIRST (biggest context cue)
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

    // Top players chunk (as many items as we need; rendered as ticker segments)
    playerStrings.forEach((p: any) => {
      items.push({
        id: p.id,
        type: 'player',
        payload: { ...p.payload, text: `${p.payload.text} ${p._status}` },
      });
    });

    // Live updates: recent bot messages (birdies/eagles/snowman etc) – short and punchy
    const now = Date.now();
    const updates = (event.chat || [])
      .filter((m: any) => (m?.senderName || '').toLowerCase().includes('gimmies bot'))
      .filter((m: any) => {
        const t = new Date(m.createdAt).getTime();
        return Number.isFinite(t) && now - t < 2 * 60 * 60 * 1000; // last 2h
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
    // Club-friendly: 30–50s cycle.
    const base = 30;
    const extra = Math.min(20, Math.max(0, tickerItems.length - 6) * 1.5);
    return Math.round(base + extra);
  }, [tickerItems.length]);

  const hasWalletAlerts =
    (wallet?.pendingToCollect || 0) > 0 ||
    (wallet?.pendingToPay || 0) > 0 ||
    (pendingSettlements.toCollect?.length || 0) + (pendingSettlements.toPay?.length || 0) > 0;

  if (!currentUser || !currentProfile) return null;

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO: Profile + Wallet
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        
        <div className="relative p-4">
          <div className="flex items-stretch gap-4">
            {/* Profile side - BIGGER avatar */}
            <div className="flex-1 min-w-0 flex items-center gap-4">
              <div className="relative flex-shrink-0 group">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 border-3 border-white dark:border-white/20 overflow-hidden flex items-center justify-center shadow-xl shadow-slate-300/50 dark:shadow-black/40 hover:shadow-2xl hover:scale-[1.03] transition-all duration-200 ring-2 ring-primary-100 dark:ring-primary-900/30"
                  aria-label="Change profile photo"
                  title="Change profile photo"
                >
                  {currentProfile.avatar ? (
                    <img src={currentProfile.avatar} alt={currentProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary-700 dark:text-primary-200 font-black text-3xl">
                      {currentProfile.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                {!currentProfile.avatar && (
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-accent to-orange-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-lg group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 5v14m7-7H5" />
                    </svg>
                  </span>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const avatar = await fileToAvatarDataUrl(file, { maxSize: 512, quality: 0.85 });
                      updateProfile(currentProfile.id, { avatar });
                    } finally {
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-black text-gray-900 dark:text-white truncate tracking-tight">{currentProfile.name}</div>
                <div className="text-sm text-gray-500 dark:text-slate-400 truncate mt-0.5">
                  {currentProfile.preferences?.homeCourseName ||
                  (currentProfile.preferences as any)?.homeCourse ||
                  'Tap to set home course'}
                </div>
              </div>
            </div>

            {/* Wallet card - slightly smaller to balance */}
            <Link
              to="/wallet"
              className="w-[38%] max-w-[160px] rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white p-3 shadow-lg shadow-primary-900/30 border border-white/10 relative hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
            >
              {hasWalletAlerts && (
                <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white/50 animate-pulse" />
              )}
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/60 font-bold">Wallet</div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="text-2xl font-black leading-none">
                  {wallet ? `${wallet.seasonNet >= 0 ? '+' : ''}$${Math.abs(wallet.seasonNet).toFixed(0)}` : '—'}
                </div>
                <div className="text-[10px] text-white/60 leading-tight text-right font-medium">
                  <div>To collect: ${wallet?.pendingToCollect?.toFixed(0) || '0'}</div>
                  <div>To pay: ${wallet?.pendingToPay?.toFixed(0) || '0'}</div>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-white/50 font-semibold">Tap for details</div>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          QUICK ACTIONS: 4 tiles with depth
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 gap-3">
        {/* Joined Events - Count + most recent */}
        <Link
          to="/events"
          className="group bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 min-h-[100px] flex flex-col justify-between hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800/50 transition-all duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">Joined Events</div>
            <div className="text-2xl font-black text-primary-600">{userEvents.length}</div>
          </div>
          {userEvents.length === 0 ? (
            <div className="text-sm font-bold text-gray-500">None yet</div>
          ) : (
            <div className="min-w-0">
              <div className="font-bold text-gray-900 dark:text-white truncate text-sm group-hover:text-primary-700 transition-colors">
                {activeEvents[0]?.name || userEvents[0]?.name || 'Event'}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {activeEvents[0]?.course?.teeName || userEvents[0]?.course?.teeName || formatDateShort(activeEvents[0]?.date || userEvents[0]?.date)}
              </div>
            </div>
          )}
        </Link>

        {/* Join / Create - Dual Action Tile */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 min-h-[100px] flex flex-col justify-between">
          <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">Join / Create</div>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => navigate('/join')}
              className="w-full py-1.5 px-3 bg-gradient-to-r from-accent to-orange-500 hover:from-orange-500 hover:to-accent rounded-lg text-white text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Join Game
            </button>
            <button
              onClick={() => setShowCreateWizard(true)}
              className="w-full py-1.5 px-3 bg-gradient-to-r from-accent to-orange-500 hover:from-orange-500 hover:to-accent rounded-lg text-white text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Create Event
            </button>
          </div>
        </div>

        {/* Handicap */}
        <div className="group bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 min-h-[100px] flex flex-col justify-between">
          <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">Handicap Index</div>
          <div className="flex items-end justify-between">
            <Link to="/handicap" className="text-3xl font-black text-gray-900 dark:text-white hover:text-primary-700 transition-colors">
              {typeof currentProfile.handicapIndex === 'number' ? currentProfile.handicapIndex.toFixed(1) : '—'}
            </Link>
            <Link
              to="/handicap/add-round"
              className="px-2.5 py-1 bg-gradient-to-r from-accent to-orange-500 hover:from-orange-500 hover:to-accent rounded-lg text-white text-[10px] font-bold shadow-sm hover:shadow-md transition-all"
            >
              Add Score
            </Link>
          </div>
        </div>

        {/* Last Round - Static display */}
        <Link
          to="/handicap"
          className="group bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-md shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 min-h-[100px] flex flex-col justify-between hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800/50 transition-all duration-200"
        >
          <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">Last Round</div>
          <div>
            <div className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-primary-700 transition-colors">
              {lastRound ? ((lastRound as any).grossScore || (lastRound as any).totalScore || '—') : '—'}
            </div>
            <div className="text-xs text-gray-500 font-medium">
              {lastRound ? formatDateShort((lastRound as any).date) : 'No rounds yet'}
            </div>
          </div>
        </Link>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          GROUPS & EVENTS: Tabbed section
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 overflow-hidden">
        {/* Tab Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => setSocialTab('groups')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                socialTab === 'groups'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              Groups
            </button>
            <button
              onClick={() => setSocialTab('events')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-1.5 ${
                socialTab === 'events'
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
              }`}
            >
              Events
              {activeEvents.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold bg-accent text-white rounded-full px-1">
                  {activeEvents.length}
                </span>
              )}
            </button>
          </div>
          <Link
            to="/events"
            className="text-xs font-bold text-primary-600 hover:text-primary-700"
          >
            View All →
          </Link>
        </div>

        {/* Tab Content */}
        <div className="p-3 space-y-2">
          {/* ═══ GROUPS TAB ═══ */}
          {socialTab === 'groups' && (
            <>
              {allGroupsSorted.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/50 dark:to-purple-800/50 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">No groups yet</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-4">Create a group to chat with your golf crew</div>
                  <button
                    onClick={() => setShowCreateGroupWizard(true)}
                    className="px-4 py-2 bg-gradient-to-r from-accent to-orange-500 rounded-xl text-sm font-bold text-white hover:from-orange-500 hover:to-accent transition-all shadow-md"
                  >
                    Create Group
                  </button>
                </div>
              ) : (
                allGroupsSorted.map((e) => {
                  const last = getEventLastMessage(e);
                  return (
                    <button
                      key={e.id}
                      onClick={() => navigate(`/event/${e.id}/chat`)}
                      className="w-full text-left rounded-2xl bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200/80 dark:border-white/5 p-4 relative overflow-hidden hover:shadow-md hover:border-purple-200 dark:hover:border-purple-800/50 transition-all duration-200 group"
                    >
                      {/* Purple accent for groups */}
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-purple-700 rounded-l-2xl" />
                      
                      <div className="flex items-start justify-between gap-3 pl-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded uppercase tracking-wider">Group</span>
                            <span className="font-black text-gray-900 dark:text-white truncate group-hover:text-purple-700 transition-colors">
                              {e.name || 'Untitled Group'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {e.golfers?.length || 0} members
                          </div>
                          {/* Last chat preview */}
                          <div className="mt-2 text-xs text-gray-600 dark:text-slate-300 truncate">
                            💬 {last ? clamp(`${last.senderName || 'Someone'}: ${last.text}`, 45) : 'No messages yet'}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-[10px] uppercase tracking-widest text-white font-bold bg-gradient-to-r from-purple-500 to-purple-700 px-3 py-1.5 rounded-full shadow-sm">
                            Chat
                          </span>
                          {last && (
                            <span className="text-[10px] text-gray-400 font-medium">{formatDateShort(last.createdAt)}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </>
          )}

          {/* ═══ EVENTS TAB ═══ */}
          {socialTab === 'events' && (
            <>
              {userEvents.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-800/50 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⛳</span>
                  </div>
                  <div className="font-bold text-gray-700 dark:text-slate-200 mb-1">No events yet</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 mb-4">Join or create an event to start playing</div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => setShowJoinModal(true)}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-gray-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      Join Event
                    </button>
                    <button
                      onClick={() => setShowCreateWizard(true)}
                      className="px-4 py-2 bg-gradient-to-r from-accent to-orange-500 rounded-xl text-sm font-bold text-white hover:from-orange-500 hover:to-accent transition-all shadow-md"
                    >
                      Create Event
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Active/Upcoming */}
                  {activeEvents.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase px-1">Active & Upcoming</div>
                      {activeEvents.map((e) => {
                        const last = getEventLastMessage(e);
                        const isToday = new Date(e.date).toDateString() === new Date().toDateString();
                        return (
                          <button
                            key={e.id}
                            onClick={() => navigate(`/event/${e.id}`)}
                            className="w-full text-left rounded-2xl bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200/80 dark:border-white/5 p-4 relative overflow-hidden hover:shadow-md hover:border-green-200 dark:hover:border-green-800/50 transition-all duration-200 group"
                          >
                            {/* Green accent for events */}
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-500 to-green-700 rounded-l-2xl" />
                            
                            <div className="flex items-start justify-between gap-3 pl-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                    isToday 
                                      ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300' 
                                      : 'text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300'
                                  }`}>
                                    {isToday ? '🔴 Live' : 'Event'}
                                  </span>
                                  <span className="font-black text-gray-900 dark:text-white truncate group-hover:text-green-700 transition-colors">
                                    {e.name || 'Untitled Event'}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                                  <span>{formatDateShort(e.date)}</span>
                                  {e.course?.teeName && (
                                    <>
                                      <span className="w-1 h-1 rounded-full bg-gray-300" />
                                      <span>{e.course.teeName}</span>
                                    </>
                                  )}
                                </div>
                                {last && (
                                  <div className="mt-2 text-xs text-gray-600 dark:text-slate-300 truncate">
                                    💬 {clamp(`${last.senderName || 'Someone'}: ${last.text}`, 40)}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className="text-xs font-bold text-gray-500">{e.golfers?.length || 0} players</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Completed */}
                  {completedEvents.length > 0 && (
                    <div className="space-y-2 mt-3">
                      <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase px-1">Completed</div>
                      {completedEvents.slice(0, 2).map((e) => (
                        <button
                          key={e.id}
                          onClick={() => navigate(`/event/${e.id}`)}
                          className="w-full text-left rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/5 p-3 relative overflow-hidden hover:shadow-sm transition-all duration-200 group opacity-70 hover:opacity-100"
                        >
                          <span className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300 dark:bg-slate-600 rounded-l-2xl" />
                          <div className="flex items-center justify-between gap-3 pl-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Done</span>
                                <span className="font-bold text-gray-700 dark:text-slate-300 truncate text-sm">
                                  {e.name || 'Untitled Event'}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-gray-400">{formatDateShort(e.date)}</span>
                          </div>
                        </button>
                      ))}
                      {completedEvents.length > 2 && (
                        <Link to="/events" className="block text-center text-xs font-bold text-primary-600 hover:text-primary-700 py-1">
                          +{completedEvents.length - 2} more completed
                        </Link>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          TICKER: Sticky above nav
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="fixed left-4 right-4 bottom-[5.25rem] z-30">
        <button
          onClick={() => tickerEvent ? navigate(`/event/${tickerEvent.id}`) : navigate('/events')}
          className="w-full gimmies-ticker rounded-xl bg-[#1561AE] border border-white/10 px-3 py-2.5 shadow-lg shadow-primary-900/25"
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

      {/* Create Event Wizard */}
      <CreateEventWizard isOpen={showCreateWizard} onClose={() => setShowCreateWizard(false)} />
      <CreateGroupWizard isOpen={showCreateGroupWizard} onClose={() => setShowCreateGroupWizard(false)} />
    </div>
  );
};

export default Dashboard;
