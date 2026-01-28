/**
 * Dashboard - Redesigned with Tournament-quality UX
 * 
 * Key improvements:
 * - Cleaner visual hierarchy
 * - Focused action areas
 * - Better card layouts
 * - Mobile-first with large tap targets
 * - Less clutter, more focus
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthMode } from '../hooks/useAuthMode';
import { CreateEventWizard } from '../components/CreateEventWizard';
import { CreateGroupWizard } from '../components/CreateGroupWizard';
import { DiscoverGroupsModal } from '../components/DiscoverGroupsModal';
import { useEventsAdapter, useWalletAdapter } from '../adapters';
import type { Event } from '../state/types';
import useStore from '../state/store';
import { getHole } from '../data/cloudCourses';

type Tab = 'events' | 'groups';

const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

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

const Dashboard: React.FC = () => {
  const {
    events,
    userEvents,
    currentProfile,
    loadEventsFromCloud,
    profiles,
  } = useEventsAdapter();
  const { wallet } = useWalletAdapter();
  const { isGuest } = useAuthMode();
  const navigate = useNavigate();

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showCreateGroupWizard, setShowCreateGroupWizard] = useState(false);
  const [showDiscoverGroups, setShowDiscoverGroups] = useState(false);
  const [tab, setTab] = useState<Tab>('events');
  
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

  // Load events on mount
  useEffect(() => {
    if (!currentProfile) return;
    loadEventsFromCloud().catch(() => {});
  }, [currentProfile?.id]);

  // Separate active events from groups
  const { activeEvents, completedEvents, groups } = useMemo(() => {
    const active: Event[] = [];
    const completed: Event[] = [];
    const groupList: Event[] = [];
    
    userEvents.forEach(e => {
      if (e.hubType === 'group') {
        groupList.push(e);
      } else if (e.isCompleted) {
        completed.push(e);
      } else {
        active.push(e);
      }
    });
    
    // Sort by recent activity
    active.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    completed.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    groupList.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    
    return { activeEvents: active, completedEvents: completed, groups: groupList };
  }, [userEvents]);

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
        _status: `${statusLabel}${onHoleLabel}`,
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
    <div className="space-y-5 pb-32">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 -mx-4 -mt-6 px-4 pt-8 pb-6 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <Link to="/profile" className="block">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold text-white border-2 border-white/30">
                {currentProfile.avatar ? (
                  <img src={currentProfile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  currentProfile.name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">
                {currentProfile.name || 'Golfer'}
              </h1>
              <p className="text-primary-200 text-sm">
                {homeCourse ? `⛳ ${homeCourse}` : 'Tap profile to set home course'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats - Only Handicap and Wallet */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/handicap" className="bg-white/10 hover:bg-white/15 rounded-xl p-3 text-center transition-colors">
            <div className="text-2xl font-bold text-white">
              {stats.handicap != null ? stats.handicap.toFixed(1) : '—'}
            </div>
            <div className="text-[10px] text-primary-200 font-medium uppercase tracking-wide">Handicap</div>
          </Link>
          <Link to="/wallet" className="bg-white/10 hover:bg-white/15 rounded-xl p-3 text-center transition-colors">
            <div className="text-2xl font-bold text-white">
              ${(stats.netBalance / 100).toFixed(0)}
            </div>
            <div className="text-[10px] text-primary-200 font-medium uppercase tracking-wide">Wallet</div>
          </Link>
        </div>
      </header>

      {/* Getting Started - Onboarding Modal */}
      {showOnboarding && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => dismissOnboarding(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 px-6 pt-8 pb-6 rounded-t-3xl text-center">
              <button
                onClick={() => dismissOnboarding(false)}
                className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-5xl mb-3">⛳</div>
              <h2 className="text-2xl font-bold text-white mb-1">Welcome to Gimmies!</h2>
              <p className="text-primary-100 text-sm">Your golf crew's command center</p>
            </div>
            
            {/* Feature highlights */}
            <div className="px-5 py-5 space-y-3">
              {/* Groups */}
              <button 
                className="w-full flex items-start gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors text-left"
                onClick={() => { setTab('groups'); dismissOnboarding(false); }}
              >
                <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900">Create a Group</div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Your golf crew's home base. Chat, share photos, and schedule tee times together.
                  </p>
                </div>
                <span className="text-purple-400 self-center text-lg">→</span>
              </button>

              {/* Events */}
              <button 
                className="w-full flex items-start gap-3 p-4 bg-primary-50 rounded-xl border border-primary-100 hover:bg-primary-100 transition-colors text-left"
                onClick={() => { setShowCreateWizard(true); dismissOnboarding(false); }}
              >
                <div className="w-12 h-12 rounded-full bg-primary-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⛳</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900">Create an Event</div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Score a round, run Nassau/skins, track bets, and see the live leaderboard.
                  </p>
                </div>
                <span className="text-primary-400 self-center text-lg">→</span>
              </button>

              {/* Handicap */}
              <button 
                className="w-full flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors text-left"
                onClick={() => { navigate('/handicap'); dismissOnboarding(false); }}
              >
                <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900">Track Your Handicap</div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Add rounds manually or score through events. We calculate your index automatically.
                  </p>
                </div>
                <span className="text-amber-500 self-center text-lg">→</span>
              </button>
            </div>

            {/* Quick start CTA */}
            <div className="px-5 pb-6 pt-2 border-t border-gray-100">
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCreateGroupWizard(true); dismissOnboarding(false); }}
                  className="flex-1 py-3.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <span>👥</span> Start a Group
                </button>
                <button
                  onClick={() => { navigate('/join'); dismissOnboarding(false); }}
                  className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🎫</span> Join with Code
                </button>
              </div>
              
              {/* Don't show again */}
              <button
                onClick={() => dismissOnboarding(true)}
                className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
              >
                Don't show this again
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Actions - Compact Buttons */}
      <section className="flex gap-3">
        <button
          onClick={() => setShowCreateWizard(true)}
          className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl py-3 px-4 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <span>⛳</span>
          <span>Create Event</span>
        </button>
        
        <button
          onClick={() => navigate('/join')}
          className="flex-1 bg-white rounded-xl py-3 px-4 border border-gray-200 font-bold text-sm text-gray-900 shadow-sm hover:shadow-md hover:border-primary-300 transition-all flex items-center justify-center gap-2"
        >
          <span>🎫</span>
          <span>Join Event</span>
        </button>
      </section>

      {/* Events & Groups */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('events')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
              tab === 'events' ? 'text-primary-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Events
            {activeEvents.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary-100 text-primary-700 rounded-full">
                {activeEvents.length}
              </span>
            )}
            {tab === 'events' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setTab('groups')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
              tab === 'groups' ? 'text-primary-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Groups
            {groups.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-full">
                {groups.length}
              </span>
            )}
            {tab === 'groups' && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          {tab === 'events' && (
            <>
              {activeEvents.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-4xl mb-3">⛳</div>
                  <div className="font-semibold text-gray-700 mb-1">No active events</div>
                  <p className="text-sm text-gray-500 mb-4">Create or join an event to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeEvents.slice(0, 5).map(event => (
                    <EventCard key={event.id} event={event} profiles={profiles} />
                  ))}
                  
                  {activeEvents.length > 5 && (
                    <Link 
                      to="/events" 
                      className="block text-center py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      View all {activeEvents.length} events →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'groups' && (
            <>
              {groups.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-4xl mb-3">👥</div>
                  <div className="font-semibold text-gray-700 mb-1">No groups yet</div>
                  <p className="text-sm text-gray-500 mb-4">Create a group or find one to join</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <button
                      onClick={() => setShowCreateGroupWizard(true)}
                      className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors"
                    >
                      Create Group
                    </button>
                    <button
                      onClick={() => setShowDiscoverGroups(true)}
                      className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                      🔍 Find Groups
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {groups.map(group => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCreateGroupWizard(true)}
                      className="flex-1 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-purple-300 hover:text-purple-600 transition-colors"
                    >
                      + Create Group
                    </button>
                    <button
                      onClick={() => setShowDiscoverGroups(true)}
                      className="py-3 px-4 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      🔍 Find
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Score Ticker - Fixed at bottom */}
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

      <DiscoverGroupsModal
        isOpen={showDiscoverGroups}
        onClose={() => setShowDiscoverGroups(false)}
      />
    </div>
  );
};

// Event Card Component
const EventCard: React.FC<{ event: Event; profiles: any[] }> = ({ event, profiles }) => {
  const navigate = useNavigate();
  
  const golferCount = event.golfers.length;
  const scoringCount = event.scorecards.filter(sc => sc.scores.length > 0).length;
  
  return (
    <button
      onClick={() => navigate(`/event/${event.id}`)}
      className="w-full text-left bg-gray-50 hover:bg-primary-50 rounded-xl p-4 border border-gray-200 hover:border-primary-300 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 group-hover:text-primary-700 truncate transition-colors">
            {event.name || 'Untitled Event'}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{formatDateShort(event.date)}</span>
            <span>•</span>
            <span>{golferCount} golfer{golferCount !== 1 ? 's' : ''}</span>
            {scoringCount > 0 && (
              <>
                <span>•</span>
                <span className="text-green-600">{scoringCount} scoring</span>
              </>
            )}
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  
  return (
    <button
      onClick={() => navigate(`/event/${group.id}/chat`)}
      className="w-full text-left bg-purple-50 hover:bg-purple-100 rounded-xl p-4 border border-purple-200 hover:border-purple-300 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-900 group-hover:text-purple-700 truncate transition-colors">
            {group.name || 'Untitled Group'}
          </div>
          <div className="text-sm text-gray-500 mt-1 truncate">
            {lastMessage ? `${lastMessage.senderName}: ${lastMessage.text}` : `${group.golfers.length} members`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 text-[10px] font-bold bg-purple-200 text-purple-700 rounded-full">
            CHAT
          </span>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
};

export default Dashboard;
