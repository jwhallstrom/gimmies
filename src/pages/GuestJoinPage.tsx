import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCourseById } from '../data/cloudCourses';
import { createGuestSession, addEventToGuestSession } from '../utils/guestSession';
import { formatLocalDate } from '../utils/dateUtils';
import useStore from '../state/store';

interface GuestJoinPageProps {
  onSignIn: () => void;
  eventId?: string;
  shareCode?: string;
}

const GAME_META: Record<string, { emoji: string; label: string }> = {
  nassau: { emoji: '🏌️', label: 'Nassau' },
  skins: { emoji: '💰', label: 'Skins' },
  stableford: { emoji: '📊', label: 'Stableford' },
  pinky: { emoji: '🤙', label: 'Pinky' },
  greenie: { emoji: '🟢', label: 'Greenie' },
  ninePoint: { emoji: '9️⃣', label: '9-Point' },
  bingoBangoBongo: { emoji: '🎯', label: 'Bingo Bango Bongo' },
  wolf: { emoji: '🐺', label: 'Wolf' },
  dots: { emoji: '⚫', label: 'Dots' },
};

const GuestJoinPage: React.FC<GuestJoinPageProps> = ({ onSignIn, eventId: propEventId, shareCode: propShareCode }) => {
  const { id: paramId, code: paramCode } = useParams();
  const navigate = useNavigate();

  const targetEventId = propEventId || paramId;
  const targetShareCode = propShareCode || paramCode;

  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState('');
  const [handicap, setHandicap] = useState('');
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const addGolferToEvent = useStore((s: any) => s.addGolferToEvent);
  const updateEventGolfer = useStore((s: any) => s.updateEventGolfer);
  const createUser = useStore((s: any) => s.createUser);
  const addToast = useStore((s: any) => s.addToast);

  useEffect(() => {
    let cancelled = false;
    const loadEvent = async () => {
      setLoading(true);
      try {
        if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') {
          setError('Cloud sync required for guest join.');
          setLoading(false);
          return;
        }

        if (targetEventId) {
          const { loadEventById } = await import('../utils/eventSync');
          const event = await loadEventById(targetEventId);
          if (!cancelled && event) {
            setEventData(event);
            useStore.setState((s: any) => ({
              events: (s.events || []).some((e: any) => e.id === event.id)
                ? s.events
                : [...(s.events || []), event],
            }));
          } else if (!cancelled) {
            setError('Event not found.');
          }
        } else if (targetShareCode) {
          const { loadPublicEventsFromCloud } = await import('../utils/eventSync');
          const events = await loadPublicEventsFromCloud();
          const match = events?.find((e: any) => e.shareCode?.toUpperCase() === targetShareCode.toUpperCase());
          if (!cancelled && match) {
            setEventData(match);
          } else if (!cancelled) {
            setError('Event not found with that code.');
          }
        } else {
          setError('No event specified.');
        }
      } catch {
        if (!cancelled) setError('Could not load event details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadEvent();
    return () => { cancelled = true; };
  }, [targetEventId, targetShareCode]);

  const activeGames = useMemo(() => {
    if (!eventData?.games) return [];
    const games: { key: string; label: string; emoji: string; fee: string }[] = [];
    const g = eventData.games;

    const addIfPresent = (key: string, configs: any[]) => {
      if (!Array.isArray(configs) || configs.length === 0) return;
      const meta = GAME_META[key];
      if (!meta) return;
      const fee = configs[0]?.fee || configs[0]?.fees?.out;
      games.push({
        key,
        label: meta.label,
        emoji: meta.emoji,
        fee: fee ? `$${fee}` : '',
      });
    };

    addIfPresent('nassau', g.nassau);
    addIfPresent('skins', g.skins);
    addIfPresent('stableford', g.stableford);
    addIfPresent('pinky', g.pinky);
    addIfPresent('greenie', g.greenie);
    addIfPresent('ninePoint', g.ninePoint);
    addIfPresent('bingoBangoBongo', g.bingoBangoBongo);
    addIfPresent('wolf', g.wolf);
    addIfPresent('dots', g.dots);
    return games;
  }, [eventData?.games]);

  // Default: all games selected
  useEffect(() => {
    if (activeGames.length > 0 && selectedGames.size === 0) {
      setSelectedGames(new Set(activeGames.map(g => g.key)));
    }
  }, [activeGames]);

  const toggleGame = (key: string) => {
    setSelectedGames(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleGuestJoin = async () => {
    const name = guestName.trim();
    if (!name) {
      setError('Enter a name so others know who you are.');
      return;
    }
    if (name.length < 2) {
      setError('Name should be at least 2 characters.');
      return;
    }

    setJoining(true);
    setError('');

    try {
      const session = createGuestSession(name);
      createUser(`guest_${session.guestId}@guest.local`, name, false);

      const state = useStore.getState();
      const guestProfile = state.currentProfile;
      if (!guestProfile) {
        setError('Could not create guest session. Try again.');
        setJoining(false);
        return;
      }

      const evtId = eventData?.id || targetEventId;
      if (!evtId) {
        setError('No event to join.');
        setJoining(false);
        return;
      }

      let joinedEventId = evtId;

      if (import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true' && eventData?.shareCode) {
        const { joinHubByShareCodeInCloud, loadEventById } = await import('../utils/eventSync');
        const result = await joinHubByShareCodeInCloud(
          eventData.shareCode,
          guestProfile.id,
          name
        );
        if (result?.success && result.eventId) {
          joinedEventId = result.eventId;
          const fullEvent = await loadEventById(result.eventId);
          if (fullEvent) {
            useStore.setState((s: any) => ({
              events: (s.events || []).map((e: any) => e.id === fullEvent.id ? fullEvent : e)
                .concat((s.events || []).some((e: any) => e.id === fullEvent.id) ? [] : [fullEvent]),
            }));
          }
        }
      } else {
        await addGolferToEvent(evtId, guestProfile.id);
      }

      // Apply handicap if provided
      const hcpValue = parseFloat(handicap);
      if (!isNaN(hcpValue) && hcpValue >= 0 && hcpValue <= 54) {
        await updateEventGolfer(joinedEventId, guestProfile.id, {
          handicapOverride: hcpValue,
          handicapSnapshot: hcpValue,
        });
      }

      // Apply game preference
      if (activeGames.length > 0) {
        if (selectedGames.size === 0) {
          await updateEventGolfer(joinedEventId, guestProfile.id, { gamePreference: 'none' as const });
        } else if (selectedGames.size === activeGames.length) {
          await updateEventGolfer(joinedEventId, guestProfile.id, { gamePreference: 'all' as const });
        } else {
          const optIn: Record<string, boolean> = {};
          activeGames.forEach(g => { optIn[g.key] = selectedGames.has(g.key); });
          await updateEventGolfer(joinedEventId, guestProfile.id, { gamePreference: 'all' as const, gameOptIn: optIn });
        }
      }

      addEventToGuestSession(joinedEventId);
      addToast?.("You're in! Let's play.", 'success', 2500);
      navigate(`/event/${joinedEventId}`, { replace: true });
    } catch {
      setError('Could not join. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const courseName = eventData?.course?.courseId
    ? getCourseById(eventData.course.courseId)?.name || 'Golf Course'
    : 'Golf Course';

  const playerCount = eventData?.golfers?.length || 0;
  const eventDate = eventData?.date
    ? formatLocalDate(eventData.date, { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/70 text-sm">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error && !eventData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 px-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⛳</div>
          <h1 className="text-xl font-bold text-white mb-2">Hmm, can't find that event</h1>
          <p className="text-white/60 text-sm mb-6">{error}</p>
          <button
            onClick={onSignIn}
            className="px-6 py-3 bg-white text-primary-900 font-bold rounded-xl shadow-lg hover:bg-gray-50 transition"
          >
            Sign In Instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex flex-col">
      <div className="flex-shrink-0 pt-safe-top" />

      <div className="flex-1 flex flex-col items-center px-6 py-6 overflow-y-auto">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-5">
            <img src="/gimmies-logo.png" alt="Gimmies" className="h-9 mx-auto opacity-90" />
          </div>

          {/* Event card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-4 mb-5">
            <div className="text-center">
              <div className="text-2xl mb-1">⛳</div>
              <h1 className="text-lg font-black text-white mb-1">
                {eventData?.name || 'Golf Game'}
              </h1>
              <div className="text-white/70 text-xs space-y-0.5">
                {courseName !== 'Golf Course' && (
                  <div className="flex items-center justify-center gap-1">
                    <span>📍</span> {courseName}
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {eventDate && <span>📅 {eventDate}</span>}
                  {playerCount > 0 && <span>👥 {playerCount} in</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Join form */}
          <div className="bg-white rounded-2xl shadow-2xl p-5">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Jump In</h2>
              <p className="text-xs text-gray-500 mt-1">
                No account needed. Set up your round and you're in.
              </p>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setError(''); }}
                  placeholder="Name on the leaderboard"
                  autoFocus
                  maxLength={30}
                  className="w-full px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-gray-400 transition-all"
                />
              </div>

              {/* Handicap */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Handicap Index</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={handicap}
                    onChange={(e) => setHandicap(e.target.value)}
                    placeholder="e.g. 15.2"
                    min="0"
                    max="54"
                    step="0.1"
                    className="flex-1 px-4 py-3 text-base rounded-xl border-2 border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 placeholder:text-gray-400 transition-all"
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0 w-16 text-center leading-tight">
                    Optional<br />0–54
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  Used for net scoring. The admin can also set this for you.
                </p>
              </div>

              {/* Games */}
              {activeGames.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Games You're In</label>
                  <div className="space-y-1.5">
                    {activeGames.map(game => {
                      const isSelected = selectedGames.has(game.key);
                      return (
                        <button
                          key={game.key}
                          type="button"
                          onClick={() => toggleGame(game.key)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? 'border-primary-400 bg-primary-50'
                              : 'border-gray-200 bg-gray-50 opacity-60'
                          }`}
                        >
                          <span className="text-lg flex-shrink-0">{game.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                              {game.label}
                            </div>
                            {game.fee && (
                              <div className={`text-xs ${isSelected ? 'text-primary-600' : 'text-gray-400'}`}>
                                {game.fee}/player
                              </div>
                            )}
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Uncheck any game you don't want to bet on.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500 font-medium text-center">{error}</p>
              )}

              <button
                onClick={handleGuestJoin}
                disabled={joining || !guestName.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-accent to-orange-500 text-white font-bold text-base rounded-xl shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:shadow-none transition-all hover:shadow-xl active:scale-[0.98]"
              >
                {joining ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    Joining...
                  </span>
                ) : (
                  "Let's Play →"
                )}
              </button>

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                Create an account later to save stats and track your handicap.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-200"></div>
            </div>

            {/* Sign in */}
            <button
              onClick={onSignIn}
              className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold text-sm rounded-xl hover:bg-gray-200 transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>

          <div className="mt-4 text-center">
            <p className="text-white/40 text-xs">
              No commitment. No hassle. Just golf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestJoinPage;
