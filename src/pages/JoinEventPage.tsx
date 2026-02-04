import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getCourseById } from '../data/cloudCourses';
import useStore from '../state/store';
import type { Event } from '../state/types';

const PENDING_JOIN_KEY = 'gimmies.pendingJoinCode.v1';

function extractJoinCode(raw: string): string {
  const upper = String(raw || '').toUpperCase();
  const match = upper.match(/[A-Z0-9]{6}/);
  return match ? match[0] : '';
}

function isUpcoming(dateStr: string): boolean {
  if (!dateStr) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  // Some events store "YYYY-MM-DD"; Date() treats it as UTC in some browsers.
  // Treat invalid dates as "upcoming" so we don't hide things unexpectedly.
  if (Number.isNaN(d.getTime())) return true;
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8; // miles
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function getCourseMeta(courseId?: string | null): { name: string; location: string; coords?: { lat: number; lng: number } } {
  const c: any = getCourseById(courseId || undefined);
  const name = c?.name || (courseId || 'Course TBD');
  const location = c?.location || '';
  const lat = typeof c?.lat === 'number' ? c.lat : typeof c?.latitude === 'number' ? c.latitude : undefined;
  const lng = typeof c?.lng === 'number' ? c.lng : typeof c?.longitude === 'number' ? c.longitude : undefined;
  const coords = typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : undefined;
  return { name, location, coords };
}

const JoinEventPage: React.FC = () => {
  const { code: codeParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const joinEventByCode = useStore((s: any) => s.joinEventByCode);
  const addGolferToEvent = useStore((s: any) => s.addGolferToEvent);
  const generateShareCode = useStore((s: any) => s.generateShareCode);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const myEvents = useStore((s: any) => s.events);
  const addToast = useStore((s: any) => s.addToast);

  // Tab state: 'events' or 'groups'
  const initialTab = searchParams.get('tab') === 'groups' ? 'groups' : 'events';
  const [activeTab, setActiveTab] = useState<'events' | 'groups'>(initialTab);

  const [publicEvents, setPublicEvents] = useState<any[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  
  // Group-specific state
  const [groupQuery, setGroupQuery] = useState('');
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported'>('idle');
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [showCodeJoin, setShowCodeJoin] = useState<boolean>(!!codeParam);
  const [rawInput, setRawInput] = useState<string>(codeParam || '');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle');
  const [codeMessage, setCodeMessage] = useState<string>('');
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  const code = useMemo(() => extractJoinCode(rawInput), [rawInput]);
  const chars = Array.from({ length: 6 }).map((_, i) => code[i] || '');

  // Deep link: if we landed on /join/:code and don't have a profile yet, remember code for auto-join post-profile.
  useEffect(() => {
    if (!codeParam) return;
    const extracted = extractJoinCode(codeParam);
    if (!extracted) return;

    setShowCodeJoin(true);
    if (!currentProfile) {
      try {
        sessionStorage.setItem(PENDING_JOIN_KEY, extracted);
      } catch {
        // ignore
      }
      setCodeStatus('idle');
      setCodeMessage('One quick step: set up your profile, then we’ll join you automatically.');
    } else {
      setRawInput(extracted);
      setCodeMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam, currentProfile?.id]);

  // Load discoverable/public events (the common join flow).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') {
        setPublicEvents([]);
        setPublicError('Public games aren’t available in local-only mode.');
        return;
      }
      try {
        setLoadingPublic(true);
        setPublicError(null);
        const { loadPublicEventsFromCloud } = await import('../utils/eventSync');
        const list = await loadPublicEventsFromCloud();
        if (cancelled) return;
        setPublicEvents((list || []).filter((e: any) => !e.isCompleted && isUpcoming(e.date)));
      } catch {
        if (cancelled) return;
        setPublicError('Could not load games right now.');
      } finally {
        if (!cancelled) setLoadingPublic(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const homeCourseId = currentProfile?.preferences?.homeCourseId;
  const favoriteCourseIds: string[] = currentProfile?.preferences?.favoriteCourseIds || [];

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPublic = useMemo(() => {
    const base = (publicEvents || []).filter((e: any) => {
      if (!normalizedQuery) return true;
      const meta = getCourseMeta(e.course?.courseId);
      const text = `${e.name || ''} ${meta.name} ${meta.location} ${e.course?.teeName || ''} ${e.date || ''}`.toLowerCase();
      return text.includes(normalizedQuery);
    });

    // Default sort: soonest first
    return [...base].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [publicEvents, normalizedQuery, homeCourseId, favoriteCourseIds]);

  const homeCourseEvents = useMemo(() => {
    if (!homeCourseId) return [];
    return (publicEvents || [])
      .filter((e: any) => !e.isCompleted && isUpcoming(e.date))
      .filter((e: any) => e.course?.courseId && e.course.courseId === homeCourseId)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [publicEvents, homeCourseId]);

  const favoriteEvents = useMemo(() => {
    const favs = new Set((favoriteCourseIds || []).filter(Boolean));
    if (!favs.size) return [];
    return (publicEvents || [])
      .filter((e: any) => !e.isCompleted && isUpcoming(e.date))
      .filter((e: any) => {
        const cid = e.course?.courseId || '';
        if (!cid) return false;
        if (homeCourseId && cid === homeCourseId) return false;
        return favs.has(cid);
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [publicEvents, favoriteCourseIds, homeCourseId]);

  const nearbyEvents = useMemo(() => {
    if (!geoCoords) return [];
    const withDistance = (publicEvents || [])
      .filter((e: any) => !e.isCompleted && isUpcoming(e.date))
      .map((e: any) => {
        const meta = getCourseMeta(e.course?.courseId);
        if (!meta.coords) return null;
        return { e, miles: haversineMiles(geoCoords, meta.coords) };
      })
      .filter(Boolean) as Array<{ e: any; miles: number }>;

    return withDistance
      .sort((a, b) => a.miles - b.miles)
      .slice(0, 8)
      .map((x) => ({ ...x.e, __miles: x.miles }));
  }, [publicEvents, geoCoords]);

  const hasAnyCourseCoords = useMemo(() => {
    // If our course cache doesn't have coords, geolocation can't rank "nearby".
    // We still ask for location later, but we hide the CTA if no course has coords.
    const ids = new Set<string>();
    (publicEvents || []).forEach((e: any) => {
      if (e?.course?.courseId) ids.add(e.course.courseId);
    });
    for (const id of ids) {
      const meta = getCourseMeta(id);
      if (meta.coords) return true;
    }
    return false;
  }, [publicEvents]);

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ready');
      },
      () => {
        setGeoStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const handleJoinPublicEvent = async (eventId: string) => {
    if (!currentProfile) {
      navigate('/');
      return;
    }

    // If already joined locally, go straight in.
    const local = (myEvents || []).find((e: any) => e.id === eventId);
    if (local?.golfers?.some((g: any) => g.profileId === currentProfile.id)) {
      navigate(`/event/${eventId}`);
      return;
    }

    try {
      // Ensure the event exists locally before adding golfer (required by addGolferToEvent).
      if (!local && import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
        const { loadEventById } = await import('../utils/eventSync');
        const full = await loadEventById(eventId);
        if (full) {
          useStore.setState((s: any) => ({
            events: (s.events || []).some((e: any) => e.id === eventId) ? s.events : [...(s.events || []), full],
          }));
        }
      }

      await addGolferToEvent(eventId, currentProfile.id);
      addToast?.('Joined game!', 'success', 2500);
      navigate(`/event/${eventId}`);
    } catch {
      addToast?.('Could not join this game', 'error', 3500);
    }
  };

  const attemptJoinByCode = async () => {
    const normalized = extractJoinCode(rawInput);
    if (!normalized) {
      setCodeStatus('error');
      setCodeMessage('Enter the 6‑character code.');
      return;
    }

    if (!currentProfile) {
      try {
        sessionStorage.setItem(PENDING_JOIN_KEY, normalized);
      } catch {
        // ignore
      }
      setCodeStatus('error');
      setCodeMessage('First, create your profile. Then we’ll join you automatically.');
      navigate('/');
      return;
    }

    setCodeStatus('joining');
    setCodeMessage('Joining…');
    const result = await joinEventByCode(normalized);
    if (result?.success) {
      setCodeStatus('success');
      setCodeMessage('✓ Joined!');
      if (result?.eventId) setTimeout(() => navigate(`/event/${result.eventId}`), 250);
      return;
    }
    setCodeStatus('error');
    setCodeMessage(result?.error || 'That code didn’t work. Ask the organizer to double‑check it.');
  };

  const tryPasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRawInput(text);
      requestAnimationFrame(() => hiddenInputRef.current?.focus());
    } catch {
      // ignore
    }
  };

  // ===== GROUP DISCOVERY LOGIC =====
  
  // Get all public groups from local store
  const publicGroups = useMemo(() => {
    return (myEvents || []).filter((e: Event) => {
      if (e.hubType !== 'group') return false;
      const settings = e.groupSettings;
      if (!settings || settings.visibility !== 'public') return false;
      // Don't show groups user is already in
      if (currentProfile && e.golfers?.some((g: any) => g.profileId === currentProfile.id)) return false;
      return true;
    });
  }, [myEvents, currentProfile?.id]);

  // Filter groups by search
  const filteredGroups = useMemo(() => {
    if (!groupQuery.trim()) return publicGroups;
    const q = groupQuery.toLowerCase();
    return publicGroups.filter((g: Event) => {
      const name = (g.name || '').toLowerCase();
      const location = (g.groupSettings?.location || '').toLowerCase();
      const description = (g.groupSettings?.description || '').toLowerCase();
      return name.includes(q) || location.includes(q) || description.includes(q);
    });
  }, [publicGroups, groupQuery]);

  // Groups user is already a member of
  const myGroups = useMemo(() => {
    return (myEvents || []).filter((e: Event) => {
      if (e.hubType !== 'group') return false;
      return currentProfile && e.golfers?.some((g: any) => g.profileId === currentProfile.id);
    });
  }, [myEvents, currentProfile?.id]);

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
      if (!code) {
        throw new Error('Could not get join code');
      }

      const result = await joinEventByCode(code);
      if (result?.success) {
        addToast?.(`Joined ${group.name}!`, 'success');
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

  return (
    <div className="space-y-4">
      {/* Header with Back button */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">Join</div>
          <div className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">
            Find events or groups to join
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          Back
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'events'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          🎯 Events
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'groups'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          👥 Groups
        </button>
      </div>

      {/* EVENTS TAB */}
      {activeTab === 'events' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events (course or event name)"
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition"
              />
            </div>
          </div>

        <div className="p-4 space-y-3">
          {loadingPublic && (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-sm font-bold text-slate-700 dark:text-slate-200">
              Loading games…
            </div>
          )}

          {!loadingPublic && publicError && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-4 text-sm font-bold text-amber-900 dark:text-amber-200">
              {publicError}
            </div>
          )}

          {/* Empty state */}
          {!loadingPublic && !publicError && (normalizedQuery ? filteredPublic.length === 0 : (publicEvents || []).length === 0) && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-6 text-center">
              <div className="font-black text-gray-800 dark:text-white">No games found</div>
              <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Try search, or use a private code below.
              </div>
              <div className="mt-4 flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setShowCodeJoin(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-orange-500 text-white font-extrabold shadow-md"
                >
                  Enter Code
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/events?create=true')}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-extrabold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Create Game
                </button>
              </div>
            </div>
          )}

          {/* Search results (broad) */}
          {!loadingPublic && !publicError && normalizedQuery && filteredPublic.length > 0 && (
            <>
              <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase px-1">Search results</div>
              {filteredPublic.slice(0, 12).map((e: any) => {
                const meta = getCourseMeta(e.course?.courseId);
                const alreadyJoined = (e.golfers || []).some((g: any) => g.profileId === currentProfile?.id);
                return (
                  <div
                    key={e.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 dark:text-white truncate">{e.name || 'Golf Game'}</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {meta.name}{meta.location ? ` • ${meta.location}` : ''} • {e.date}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJoinPublicEvent(e.id)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition whitespace-nowrap"
                    >
                      {alreadyJoined ? 'Open' : 'Join'}
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* Default sections (no search query) */}
          {!loadingPublic && !publicError && !normalizedQuery && (publicEvents || []).length > 0 && (
            <>
              {/* HOME COURSE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">
                    Home course
                  </div>
                  {!homeCourseId && (
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                      Set home course in profile
                    </span>
                  )}
                </div>

                {homeCourseId && homeCourseEvents.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    No games at {getCourseMeta(homeCourseId).name} yet.
                  </div>
                ) : (
                  homeCourseEvents.slice(0, 4).map((e: any) => {
                    const meta = getCourseMeta(e.course?.courseId);
                    const alreadyJoined = (e.golfers || []).some((g: any) => g.profileId === currentProfile?.id);
                    return (
                      <div
                        key={e.id}
                        className="rounded-2xl bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200/80 dark:border-white/5 p-4 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-black text-gray-900 dark:text-white truncate">{e.name || 'Golf Game'}</div>
                          <div className="text-sm font-semibold text-gray-600 dark:text-slate-300 mt-0.5 truncate">
                            {meta.name}{e.course?.teeName ? ` • ${e.course.teeName}` : ''}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {e.date} • {(e.golfers || []).length} players
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoinPublicEvent(e.id)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-orange-500 text-white font-extrabold shadow-md whitespace-nowrap"
                        >
                          {alreadyJoined ? 'Open' : 'Join'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* FAVORITES */}
              <div className="space-y-2 mt-4">
                <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase px-1">Favorites</div>
                {favoriteCourseIds.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Add favorite courses to see games here.
                  </div>
                ) : favoriteEvents.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    No games at your favorites right now.
                  </div>
                ) : (
                  favoriteEvents.slice(0, 4).map((e: any) => {
                    const meta = getCourseMeta(e.course?.courseId);
                    const alreadyJoined = (e.golfers || []).some((g: any) => g.profileId === currentProfile?.id);
                    return (
                      <div
                        key={e.id}
                        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white truncate">{e.name || 'Golf Game'}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                            {meta.name} • {e.date}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoinPublicEvent(e.id)}
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition whitespace-nowrap"
                        >
                          {alreadyJoined ? 'Open' : 'Join'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* NEARBY (GEO) */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between px-1">
                  <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase">Nearby</div>
                  {geoStatus !== 'ready' && hasAnyCourseCoords && (
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="text-xs font-extrabold text-primary-700 dark:text-primary-300"
                    >
                      Use my location
                    </button>
                  )}
                </div>

                {!hasAnyCourseCoords ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Nearby games will appear once course locations include coordinates.
                  </div>
                ) : geoStatus === 'requesting' ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Getting your location…
                  </div>
                ) : geoStatus === 'denied' ? (
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-4 text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Location permission is off. Turn it on to see nearby games.
                  </div>
                ) : geoStatus === 'unsupported' ? (
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-4 text-sm font-semibold text-amber-900 dark:text-amber-200">
                    This device/browser doesn’t support location.
                  </div>
                ) : geoStatus === 'ready' && nearbyEvents.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    No nearby games found.
                  </div>
                ) : (
                  nearbyEvents.map((e: any) => {
                    const meta = getCourseMeta(e.course?.courseId);
                    const alreadyJoined = (e.golfers || []).some((g: any) => g.profileId === currentProfile?.id);
                    const miles = typeof e.__miles === 'number' ? e.__miles : null;
                    return (
                      <div
                        key={e.id}
                        className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white truncate">{e.name || 'Golf Game'}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                            {meta.name}
                            {miles != null ? ` • ${Math.round(miles)} mi` : ''} • {e.date}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoinPublicEvent(e.id)}
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition whitespace-nowrap"
                        >
                          {alreadyJoined ? 'Open' : 'Join'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* GROUPS TAB */}
      {activeTab === 'groups' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-white/5">
            <input
              value={groupQuery}
              onChange={(e) => setGroupQuery(e.target.value)}
              placeholder="Search groups by name or location..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition"
            />
          </div>

          <div className="p-4 space-y-3">
            {/* Your Groups */}
            {myGroups.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase px-1">Your Groups</div>
                {myGroups.slice(0, 3).map((group: Event) => {
                  const settings = group.groupSettings;
                  const memberCount = group.golfers?.length || 0;
                  return (
                    <button
                      key={group.id}
                      onClick={() => navigate(`/event/${group.id}`)}
                      className="w-full rounded-2xl bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900 border border-purple-200/50 dark:border-purple-800/30 p-3 flex items-center justify-between gap-3 text-left hover:border-purple-300 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">👥</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white truncate">{group.name}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                            {settings?.location ? ` • ${settings.location}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        MEMBER
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Public Groups */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold tracking-[0.15em] text-gray-400 uppercase px-1">
                {groupQuery ? 'Search Results' : 'Public Groups'}
              </div>
              
              {filteredGroups.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-6 text-center">
                  <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">👥</span>
                  </div>
                  {publicGroups.length === 0 ? (
                    <>
                      <div className="font-black text-gray-800 dark:text-white">No public groups yet</div>
                      <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                        Public groups will appear here, or use a code to join a private group.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-black text-gray-800 dark:text-white">No matches found</div>
                      <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                        Try a different search term
                      </div>
                    </>
                  )}
                </div>
              ) : (
                filteredGroups.map((group: Event) => {
                  const settings = group.groupSettings;
                  const isOpen = settings?.joinPolicy === 'open';
                  const memberCount = group.golfers?.length || 0;

                  return (
                    <div 
                      key={group.id}
                      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/5 p-4 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">👥</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white truncate">{group.name}</div>
                          {settings?.location && (
                            <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {settings.location}
                            </div>
                          )}
                          {settings?.description && (
                            <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 line-clamp-2">{settings.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-500 dark:text-slate-400">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isOpen 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {isOpen ? 'Open' : 'Request to Join'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleJoinGroup(group)}
                          disabled={joiningGroupId === group.id}
                          className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 disabled:opacity-60 transition-colors flex-shrink-0"
                        >
                          {joiningGroupId === group.id ? 'Joining...' : 'Join'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Private code section - works for both events and groups */}
      {/* Fringe case: invite-only code */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCodeJoin((v) => !v)}
          className="w-full px-4 py-4 flex items-center justify-between text-left"
        >
          <div>
            <div className="font-black text-gray-900 dark:text-white">Have a private code?</div>
            <div className="text-sm text-gray-600 dark:text-slate-400">Use this only if the organizer gave you a code.</div>
          </div>
          <div className="text-primary-700 dark:text-primary-300 font-black">{showCodeJoin ? '−' : '+'}</div>
        </button>

        {showCodeJoin && (
          <div className="px-4 pb-4">
            {codeMessage && (
              <div
                className={`mb-3 p-3 rounded-2xl text-sm font-bold ${
                  codeStatus === 'success'
                    ? 'bg-green-100 text-green-800'
                    : codeStatus === 'error'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-100 text-slate-700'
                }`}
              >
                {codeMessage}
              </div>
            )}

            <div
              className="relative"
              onClick={() => hiddenInputRef.current?.focus()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && hiddenInputRef.current?.focus()}
            >
              <input
                ref={hiddenInputRef}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && attemptJoinByCode()}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="absolute inset-0 opacity-0"
                aria-label="Join code"
              />

              <div className="grid grid-cols-6 gap-2">
                {chars.map((c, i) => (
                  <div
                    key={i}
                    className={`h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-black font-mono ${
                      codeStatus === 'error'
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800 text-gray-900 dark:text-white'
                    }`}
                  >
                    {c || <span className="text-gray-300 dark:text-slate-500">•</span>}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-slate-500 font-semibold text-center">
                You can paste a full link — we’ll pull out the code.
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={tryPasteFromClipboard}
                className="py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-extrabold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Paste
              </button>
              <button
                type="button"
                onClick={attemptJoinByCode}
                disabled={codeStatus === 'joining' || extractJoinCode(rawInput).length !== 6}
                className="py-3 rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 text-white font-extrabold shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:shadow-none transition"
              >
                {codeStatus === 'joining' ? 'Joining…' : 'Join with code'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinEventPage;
