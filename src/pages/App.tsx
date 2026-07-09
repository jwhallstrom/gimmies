import React, { useEffect, useState, Suspense, lazy, useMemo, useRef } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LoginPage } from '../components/auth/LoginPage';
import { ProfileCompletion } from '../components/auth/ProfileCompletion';
import Dashboard from './Dashboard'; // Keep eager - it's the landing page
import UserMenu from '../components/UserMenu';
import { ToastManager } from '../components/Toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { LevelUpModal } from '../components/verified';
import { MessagesPanel, getUnreadCount } from '../components/MessagesPanel';
import useStore from '../state/store';
import {
  readJoinFailure,
  readPendingJoinTargets,
  saveJoinFailure,
  stashPendingInviteTargets,
  hasPendingInviteTarget,
  clearPendingJoinTargets,
} from '../utils/inviteSession';

// Lazy load secondary routes for code splitting
const EventsPage = lazy(() => import('./EventsPage'));
const AnalyticsPage = lazy(() => import('./AnalyticsPage'));
const HandicapPage = lazy(() => import('./HandicapPage'));
const AddScorePage = lazy(() => import('./AddScorePage'));
const RoundDetailPage = lazy(() => import('./RoundDetailPage'));
const EventPage = lazy(() => import('./EventPage'));
const GroupPage = lazy(() => import('./GroupPage'));
const JoinEventPage = lazy(() => import('./JoinEventPage'));
const GuestJoinPage = lazy(() => import('./GuestJoinPage'));
const InviteJoinFailedPage = lazy(() => import('./InviteJoinFailedPage'));
const CourseIssueAdminPage = lazy(() => import('./CourseIssueAdminPage'));
const WalletPage = lazy(() => import('./WalletPage'));
const AuthDemoPage = lazy(() => import('./AuthDemoPage').then(m => ({ default: m.AuthDemoPage })));

// Tournament pages (prototype feature)
const TournamentPage = lazy(() => import('./TournamentPage'));

// External app redirects
const ExternalRedirect: React.FC<{ url: string; label: string }> = ({ url, label }) => {
  React.useEffect(() => { window.location.href = url; }, [url]);
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
      <div className="text-lg">Redirecting to {label}...</div>
      <a href={url} className="text-green-400 underline">Click here if not redirected</a>
    </div>
  );
};

// Nassau Teams page (sub-route of event)
const NassauTeamsPage = lazy(() => import('./NassauTeamsPage'));
const NassauTeamsRoute: React.FC = () => {
  const { id } = useParams();
  if (!id) return null;
  return <NassauTeamsPage eventId={id} />;
};

/**
 * Route hub: renders GroupPage for groups, EventPage for events.
 * Keeps the /event/:id URL scheme for both (backward-compatible links).
 */
const EventOrGroupRouter: React.FC = () => {
  const { id } = useParams();
  const hubType = useStore((s) => {
    const evt = s.events.find((e: any) => e.id === id) || s.completedEvents.find((e: any) => e.id === id);
    return evt?.hubType;
  });
  if (hubType === 'group') return <GroupPage />;
  return <EventPage />;
};

const App: React.FC = () => {
  const { currentUser, currentProfile, events, createUser, joinEventByCode, joinEventById, addToast, pendingLevelUp, clearPendingLevelUp } = useStore();
  const loadEventsFromCloud = useStore((s) => s.loadEventsFromCloud);
  const logout = useStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [amplifyUser, setAmplifyUser] = useState<any>(null);
  const [pendingJoinHandled, setPendingJoinHandled] = useState(false);
  const [clearingGuestForInvite, setClearingGuestForInvite] = useState(false);
  const [showMessagesPanel, setShowMessagesPanel] = useState(false);
  const isCloudSyncInFlight = useRef(false);
  const lastCloudSyncAt = useRef(0);
  const isEventRoute = location.pathname.startsWith('/event/');

  const eventMatch = location.pathname.match(/^\/event\/([^/]+)/);
  const joinMatch = location.pathname.match(/^\/join\/([^/]+)/);
  const isInviteRoute = !!(eventMatch || joinMatch);
  const isJoinFailedRoute = location.pathname === '/invite/join-failed';
  
  // Calculate unread message count for header badge
  const unreadMessageCount = useMemo(() => {
    return getUnreadCount(events, currentProfile?.id);
  }, [events, currentProfile?.id]);

  const normalizeCloudRounds = (cloudRounds: any[]) => {
    const rounds = Array.isArray(cloudRounds) ? cloudRounds : [];
    const byKey = new Map<string, any>();
    for (const r of rounds) {
      const key =
        (r?.eventId && `event:${r.eventId}:${r.profileId || ''}`) ||
        (r?.completedRoundId && `completed:${r.completedRoundId}`) ||
        `manual:${r?.date || ''}:${r?.courseId || ''}:${r?.teeName || ''}:${r?.grossScore || ''}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, r);
        continue;
      }
      const existingTs = new Date(existing.createdAt || existing.date || 0).getTime();
      const currentTs = new Date(r.createdAt || r.date || 0).getTime();
      if (currentTs > existingTs) byKey.set(key, r);
    }
    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()
    );
  };

  const syncAmplifyUserToStore = (user: any, attributes: Partial<Record<string, string>>) => {
    const canonicalUser = {
      id: String(user.userId),
      username: attributes.email || user.username || user.userId,
      displayName: attributes.name || attributes.email || user.username || user.userId,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    } as any;

    useStore.setState((state: any) => {
      const remainingUsers = Array.isArray(state.users)
        ? state.users.filter((u: any) => String(u?.id) !== canonicalUser.id)
        : [];

      return {
        users: [canonicalUser, ...remainingUsers],
        currentUser: canonicalUser,
      };
    });
  };

  const upsertCloudProfileToStore = (cloudProfile: any, cloudRounds: any[]) => {
    const normalizedRounds = normalizeCloudRounds(cloudRounds);
    const incoming = { ...cloudProfile, individualRounds: normalizedRounds } as any;
    const state = useStore.getState();
    const existing = state.profiles.find((p: any) => p.userId === cloudProfile.userId || p.id === cloudProfile.id);
    const nextProfiles = existing
      ? state.profiles.map((p: any) =>
          (p.userId === cloudProfile.userId || p.id === cloudProfile.id)
            ? { ...p, ...incoming, individualRounds: normalizedRounds }
            : p
        )
      : [...state.profiles, incoming];

    useStore.setState({
      profiles: nextProfiles as any,
      currentProfile: incoming as any,
    });

    setTimeout(() => {
      try {
        useStore.getState().calculateAndUpdateHandicap(incoming.id);
      } catch (e) {
        console.error('Failed to recalculate handicap from cloud profile:', e);
      }
    }, 0);
  };

  const clearMismatchedLocalSession = () => {
    useStore.setState({
      users: [],
      currentUser: null,
      events: [],
      completedEvents: [],
      completedRounds: [],
      currentProfile: null,
      profiles: [],
      lastEventsCloudSyncAt: null,
      lastEventsCloudSyncCount: 0,
    } as any);
  };

  // Guest Mode blocks real invite joins — clear local guest session on invite URLs.
  useEffect(() => {
    if (isCheckingAuth || amplifyUser || !isInviteRoute || !currentUser) return;

    let cancelled = false;
    setClearingGuestForInvite(true);

    (async () => {
      try {
        const { signOut } = await import('aws-amplify/auth');
        await signOut();
      } catch {
        // ignore
      }
      if (!cancelled) {
        logout();
        setClearingGuestForInvite(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isCheckingAuth, amplifyUser, isInviteRoute, currentUser?.id, logout]);

  const readInviteEventName = (): string | undefined => {
    try {
      return sessionStorage.getItem('gimmies.pendingInviteEventName.v1') || undefined;
    } catch {
      return undefined;
    }
  };

  const handleJoinRetry = () => {
    setPendingJoinHandled(false);
    const { code, eventId } = readPendingJoinTargets();
    if (currentProfile) {
      navigate('/', { replace: true });
      return;
    }
    if (code) {
      navigate(`/join/${code}`, { replace: true });
    } else if (eventId) {
      navigate(`/event/${eventId}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  // If someone opens a join/event link before auth, we stash the target in sessionStorage.
  // Once a profile exists, auto-join via code or public event ID.
  useEffect(() => {
    if (!currentProfile || pendingJoinHandled) return;

    let code: string | null = null;
    let directEventId: string | null = null;
    try {
      code = sessionStorage.getItem('gimmies.pendingJoinCode.v1');
      directEventId = sessionStorage.getItem('gimmies.pendingEventId.v1');
    } catch {
      // ignore
    }

    if (!code && !directEventId) return;
    setPendingJoinHandled(true);

    (async () => {
      try {
        const eventName = readInviteEventName();

        if (code) {
          const result = await joinEventByCode(String(code).toUpperCase());
          if (result?.success && result?.eventId) {
            try { sessionStorage.removeItem('gimmies.pendingInviteEventName.v1'); } catch {}
            clearPendingJoinTargets();
            addToast?.('Joined event!', 'success', 2500);
            navigate(`/event/${result.eventId}`);
          } else {
            saveJoinFailure({
              shareCode: code,
              eventId: directEventId || undefined,
              error: result?.error || 'Could not join event',
              eventName,
            });
            navigate('/invite/join-failed', { replace: true });
          }
          return;
        }

        if (directEventId) {
          const result = await joinEventById(directEventId);
          if (result?.success && result?.eventId) {
            try { sessionStorage.removeItem('gimmies.pendingInviteEventName.v1'); } catch {}
            clearPendingJoinTargets();
            addToast?.('Joined event!', 'success', 2500);
            navigate(`/event/${result.eventId}`, { replace: true });
          } else {
            saveJoinFailure({
              eventId: directEventId,
              error: result?.error || 'Could not join event',
              eventName,
            });
            navigate('/invite/join-failed', { replace: true });
          }
        }
      } catch {
        const { code, eventId } = readPendingJoinTargets();
        saveJoinFailure({
          shareCode: code || undefined,
          eventId: eventId || undefined,
          error: 'Could not join event',
          eventName: readInviteEventName(),
        });
        navigate('/invite/join-failed', { replace: true });
      }
    })();
  }, [currentProfile?.id, pendingJoinHandled, joinEventByCode, joinEventById, addToast, navigate]);

  // Theme (Light/Dark/Auto) driven by profile preference.
  useEffect(() => {
    const theme = currentProfile?.preferences?.theme || 'auto';
    const root = document.documentElement;
    const apply = (mode: 'light' | 'dark') => {
      if (mode === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    };

    if (theme === 'dark') {
      apply('dark');
      return;
    }

    if (theme === 'light') {
      apply('light');
      return;
    }

    // auto
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handle = () => apply(mq?.matches ? 'dark' : 'light');
    handle();

    // Support older Safari
    try {
      mq?.addEventListener?.('change', handle);
      return () => mq?.removeEventListener?.('change', handle);
    } catch {
      mq?.addListener?.(handle);
      return () => mq?.removeListener?.(handle);
    }
  }, [currentProfile?.preferences?.theme]);

  // Check Amplify authentication state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if Amplify is actually configured before trying auth
        const { Amplify } = await import('aws-amplify');
        const config = (Amplify as any).getConfig?.();
        const hasUserPool = !!(config?.Auth?.Cognito?.userPoolId);

        if (!hasUserPool) {
          // No Amplify backend configured -- skip cloud auth entirely
          console.log('[Auth] Amplify not configured, running in local/offline mode');
          setAmplifyUser(null);
          setIsCheckingAuth(false);
          return;
        }

        const { getCurrentUser, fetchUserAttributes } = await import('aws-amplify/auth');
        const { fetchCloudProfile } = await import('../utils/profileSync');
        const { loadIndividualRoundsFromCloud } = await import('../utils/roundSync');
        
        const user = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        
        setAmplifyUser(user);
        console.log('Amplify user found:', user, 'attributes:', attributes);

        syncAmplifyUserToStore(user, attributes);

        // Always rehydrate the cloud profile for the signed-in user.
        // Persisted local state can be stale or mismatched across browser/PWA sessions.
        console.log('Fetching cloud profile for user:', user.userId);
        const cloudProfile = await fetchCloudProfile(user.userId);

        if (cloudProfile) {
          console.log('Found existing cloud profile, loading into store:', cloudProfile);

          // Also load IndividualRounds from cloud
          const cloudRounds = await loadIndividualRoundsFromCloud(cloudProfile.id);
          console.log('Loaded', cloudRounds.length, 'individual rounds from cloud');

          upsertCloudProfileToStore(cloudProfile, cloudRounds);
        } else {
          console.log('No cloud profile found - user will need to complete profile');
        }

        const state = useStore.getState();
        if (state.currentProfile?.userId && state.currentProfile.userId !== user.userId) {
          console.warn('Clearing mismatched local profile for signed-in user', {
            amplifyUserId: user.userId,
            currentProfileId: state.currentProfile.id,
            currentProfileUserId: state.currentProfile.userId,
          });
          clearMismatchedLocalSession();
        }
      } catch (err) {
        console.log('No Amplify user signed in:', err);
        setAmplifyUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, []);

  // Canonical cloud sync loop:
  // Keep background lists converged after auth changes, focus changes, and reconnects.
  // Active event/group pages maintain their own realtime subscriptions.
  useEffect(() => {
    if (!currentProfile?.id || !amplifyUser?.userId) return;

    const MIN_GAP_MS = 5000;
    const PERIODIC_MS = isEventRoute ? 180000 : 120000;

    const syncFromCloud = async (reason: string) => {
      if (isCloudSyncInFlight.current) return;
      const now = Date.now();
      if (now - lastCloudSyncAt.current < MIN_GAP_MS) return;
      isCloudSyncInFlight.current = true;
      try {
        await loadEventsFromCloud();
        lastCloudSyncAt.current = Date.now();
      } catch (err) {
        console.error(`[CloudSync] ${reason} failed:`, err);
      } finally {
        isCloudSyncInFlight.current = false;
      }
    };

    // Initial and route-change sync
    void syncFromCloud(`route:${location.pathname}`);

    const onFocus = () => { void syncFromCloud('window-focus'); };
    const onOnline = () => { void syncFromCloud('network-online'); };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncFromCloud('visibility-visible');
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    const periodic = window.setInterval(() => {
      void syncFromCloud('periodic');
    }, PERIODIC_MS);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(periodic);
    };
  }, [currentProfile?.id, amplifyUser?.userId, isEventRoute, location.pathname, loadEventsFromCloud]);


  const handleLoginSuccess = () => {
    console.log('Login successful, checking auth again...');
    setIsCheckingAuth(true);
    // Re-check auth after successful login
    setTimeout(async () => {
      try {
        // Check if Amplify is actually configured
        const { Amplify } = await import('aws-amplify');
        const config = (Amplify as any).getConfig?.();
        const hasUserPool = !!(config?.Auth?.Cognito?.userPoolId);

        if (!hasUserPool) {
          console.log('[Auth] Amplify not configured, skipping cloud auth after login');
          setIsCheckingAuth(false);
          return;
        }

        const { getCurrentUser, fetchUserAttributes } = await import('aws-amplify/auth');
        const { fetchCloudProfile } = await import('../utils/profileSync');
        const { loadIndividualRoundsFromCloud } = await import('../utils/roundSync');
        
        const user = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        
        setAmplifyUser(user);
        console.log('User after login:', user, attributes);

        syncAmplifyUserToStore(user, attributes);

        const cloudProfile = await fetchCloudProfile(user.userId);

        if (cloudProfile) {
          console.log('Loading cloud profile after login:', cloudProfile);

          // Also load IndividualRounds from cloud
          const cloudRounds = await loadIndividualRoundsFromCloud(cloudProfile.id);
          console.log('Loaded', cloudRounds.length, 'individual rounds from cloud');

          upsertCloudProfileToStore(cloudProfile, cloudRounds);
        }

        const state = useStore.getState();
        if (state.currentProfile?.userId && state.currentProfile.userId !== user.userId) {
          console.warn('Clearing mismatched local profile after login', {
            amplifyUserId: user.userId,
            currentProfileId: state.currentProfile.id,
            currentProfileUserId: state.currentProfile.userId,
          });
          clearMismatchedLocalSession();
        }
      } catch (err) {
        console.error('Failed to get user after login:', err);
      } finally {
        setIsCheckingAuth(false);
      }
    }, 100);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isJoinFailedRoute) {
    const failure = readJoinFailure();
    if (failure) {
      return (
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
          </div>
        }>
          <InviteJoinFailedPage failure={failure} onRetry={handleJoinRetry} />
        </Suspense>
      );
    }
  }

  if (!amplifyUser && isInviteRoute) {
    if (clearingGuestForInvite) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      );
    }

    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        </div>
      }>
        <GuestJoinPage
          eventId={eventMatch?.[1]}
          shareCode={joinMatch?.[1]}
          onSignIn={() => {
            stashPendingInviteTargets(joinMatch?.[1], eventMatch?.[1]);
            navigate('/', { replace: true });
          }}
          onSuccess={handleLoginSuccess}
        />
      </Suspense>
    );
  }

  if (!amplifyUser && !currentUser) {
    console.log('App: No user (Amplify or local), showing login');

    return (
      <LoginPage 
        onSuccess={handleLoginSuccess}
        hideGuestMode={hasPendingInviteTarget()}
        onGuestMode={() => {
          console.log('Guest mode selected, creating local-only user');
          createUser('guest@local', 'Guest User', false);
        }}
      />
    );
  }

  // If we have a user but no profile, show profile completion
  if (currentUser && !currentProfile) {
    console.log('App: User exists but no profile, showing profile completion');

    // If the user came through the invite flow, their name is stashed
    let pendingName: string | undefined;
    try { pendingName = sessionStorage.getItem('gimmies.pendingProfileName.v1') || undefined; } catch {}

    return (
      <ProfileCompletion
        userId={amplifyUser?.userId || currentUser.id}
        email={amplifyUser?.signInDetails?.loginId || currentUser.username}
        suggestedName={pendingName}
        autoSubmit={!!pendingName}
        onComplete={() => {
          try { sessionStorage.removeItem('gimmies.pendingProfileName.v1'); } catch {}
          console.log('Profile completion finished');
          setIsCheckingAuth(true);
          setTimeout(() => setIsCheckingAuth(false), 100);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 text-gray-900 dark:text-slate-100">
      {/* Header — only visible on the Home screen to maximise real estate elsewhere */}
      {location.pathname === '/' && (
        <header className="flex-shrink-0 bg-primary-900/85 backdrop-blur text-white px-4 py-3 flex items-center justify-between shadow-md z-40 border-b border-white/10">
          <Link to="/">
            <img src="/gimmies-logo.png" alt="Gimmies" className="h-10 w-auto" />
          </Link>
          
          <div className="flex items-center gap-2">
            <UserMenu />
          </div>
        </header>
      )}
      
      {/* Messages Panel */}
      <MessagesPanel 
        isOpen={showMessagesPanel} 
        onClose={() => setShowMessagesPanel(false)} 
      />
      {/* Main content area */}
      <main className="flex-1 min-h-0 overflow-hidden relative w-full">
        <div
          className={`absolute inset-0 ${isEventRoute ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          <div
            className={
              isEventRoute
                ? 'px-4 pt-4 h-full max-w-5xl w-full mx-auto'
                : 'px-4 pt-4 content-with-footer max-w-5xl w-full mx-auto'
            }
          >
            <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/handicap" element={<HandicapPage />} />
                <Route path="/handicap/add-round" element={<AddScorePage />} />
                <Route path="/handicap/round/:roundId" element={<RoundDetailPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/wallet/*" element={<WalletPage />} />
                <Route path="/event/:id/games/nassau/:nassauId/teams" element={<NassauTeamsRoute />} />
                <Route path="/event/:id/*" element={<EventOrGroupRouter />} />
                <Route path="/join" element={<JoinEventPage />} />
                <Route path="/join/:code" element={<JoinEventPage />} />
                <Route path="/admin/course-issues" element={<CourseIssueAdminPage />} />
                <Route path="/auth-demo" element={<AuthDemoPage />} />
                
                {/* Tournament & Club - redirect to standalone apps */}
                <Route path="/tournaments" element={<ExternalRedirect url="https://play.golfwithgimmies.com" label="Gimmies Tournaments" />} />
                <Route path="/tournament/:id/*" element={<TournamentPage />} />
                
                <Route path="/club" element={<ExternalRedirect url="https://club.golfwithgimmies.com" label="Gimmies Club" />} />
                <Route path="/club/*" element={<ExternalRedirect url="https://club.golfwithgimmies.com" label="Gimmies Club" />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </main>
      {/* Footer nav — h-[68px] with pb-safe-bottom and -mb-4 pushes 16px into
          home indicator zone (iOS). Ticker/FAB use --footer-total-height. */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#09243F] border-t border-gray-200 dark:border-white/10 h-[68px] pb-safe-bottom -mb-4 flex items-start justify-around px-2 pt-1">
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[52px] py-1.5 rounded-xl transition-all ${
            location.pathname === '/' 
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' 
              : 'text-gray-500 dark:text-gray-400 active:bg-gray-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        <button
          onClick={() => setShowMessagesPanel(true)}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[52px] py-1.5 rounded-xl transition-all relative ${
            showMessagesPanel 
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' 
              : 'text-gray-500 dark:text-gray-400 active:bg-gray-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-[10px] font-medium">Chat</span>
          {unreadMessageCount > 0 && (
            <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold">
              {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
            </span>
          )}
        </button>

        <Link
          to="/handicap"
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[52px] py-1.5 rounded-xl transition-all ${
            location.pathname === '/handicap' 
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' 
              : 'text-gray-500 dark:text-gray-400 active:bg-gray-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2}/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8M8 12a4 4 0 004-4m0 8a4 4 0 01-4-4" />
          </svg>
          <span className="text-[10px] font-medium">Handicap</span>
        </Link>

        <Link
          to="/wallet"
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[52px] py-1.5 rounded-xl transition-all ${
            location.pathname.startsWith('/wallet') 
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' 
              : 'text-gray-500 dark:text-gray-400 active:bg-gray-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <span className="text-[10px] font-medium">Wallet</span>
        </Link>

        <Link
          to="/analytics"
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[52px] py-1.5 rounded-xl transition-all ${
            location.pathname === '/analytics' 
              ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' 
              : 'text-gray-500 dark:text-gray-400 active:bg-gray-100'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-[10px] font-medium">Stats</span>
        </Link>
      </footer>
      <ToastManager />
      
      {/* Level Up Modal - shown when user reaches a new verified status tier */}
      {pendingLevelUp && (
        <LevelUpModal
          isOpen={true}
          onClose={clearPendingLevelUp}
          oldTier={pendingLevelUp.oldTier}
          newTier={pendingLevelUp.newTier}
          verifiedRounds={pendingLevelUp.verifiedRounds}
        />
      )}
    </div>
  );
};

export default App;
