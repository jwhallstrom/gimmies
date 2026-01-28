import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCourseById } from '../data/cloudCourses';
import useStore from '../state/store';

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
  const navigate = useNavigate();

  const joinEventByCode = useStore((s: any) => s.joinEventByCode);
  const addGolferToEvent = useStore((s: any) => s.addGolferToEvent);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const myEvents = useStore((s: any) => s.events);
  const addToast = useStore((s: any) => s.addToast);

  const [publicEvents, setPublicEvents] = useState<any[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
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

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">Join a Game</div>
          <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
            Home course first, then favorites — plus nearby and search.
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

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-200/80 dark:border-white/10 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all games (course or game name)"
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
