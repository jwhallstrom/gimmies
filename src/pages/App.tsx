import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LoginPage } from '../components/auth/LoginPage';
import { ProfileCompletion } from '../components/auth/ProfileCompletion';
import Dashboard from './Dashboard';
import EventsPage from './EventsPage';
import AnalyticsPage from './AnalyticsPage';
import HandicapPage from './HandicapPage';
import AddScorePage from './AddScorePage';
import RoundDetailPage from './RoundDetailPage';
import EventPage from './EventPage';
import JoinEventPage from './JoinEventPage';
import { AuthDemoPage } from './AuthDemoPage';
import UserMenu from '../components/UserMenu';
import { ToastManager } from '../components/Toast';
import useStore from '../state/store';

const App: React.FC = () => {
  const { currentUser, currentProfile, events, switchUser, createUser } = useStore();
  const location = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [amplifyUser, setAmplifyUser] = useState<any>(null);

  // Check Amplify authentication state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { getCurrentUser, fetchUserAttributes } = await import('aws-amplify/auth');
        const { fetchCloudProfile } = await import('../utils/profileSync');
        const { loadIndividualRoundsFromCloud } = await import('../utils/roundSync');
        
        const user = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        
        setAmplifyUser(user);
        console.log('Amplify user found:', user, 'attributes:', attributes);
        
        // Auto-create local user if Amplify user exists but no local user
        if (user && !currentUser) {
          console.log('Creating local user from Amplify user...');
          const email = attributes.email || user.username;
          const displayName = attributes.name || attributes.email || user.username;
          createUser(email, displayName, true); // Skip automatic profile creation
          
          // Try to fetch existing cloud profile
          console.log('Fetching cloud profile for user:', user.userId);
          const cloudProfile = await fetchCloudProfile(user.userId);
          
          if (cloudProfile) {
            console.log('Found existing cloud profile, loading into store:', cloudProfile);
            
            // Also load IndividualRounds from cloud
            const cloudRounds = await loadIndividualRoundsFromCloud(cloudProfile.id);
            console.log('Loaded', cloudRounds.length, 'individual rounds from cloud');
            
            // Import the store's profiles array and add this profile
            const { profiles } = useStore.getState();
            const existingProfile = profiles.find(p => p.userId === user.userId);
            
            if (!existingProfile) {
              useStore.setState({ 
                profiles: [...profiles, { ...cloudProfile, individualRounds: cloudRounds } as any],
                currentProfile: { ...cloudProfile, individualRounds: cloudRounds } as any
              });
            }
          } else {
            console.log('No cloud profile found - user will need to complete profile');
          }
        }
      } catch (err) {
        console.log('No Amplify user signed in:', err);
        setAmplifyUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, [currentUser, createUser]);

  // Debug logging
  console.log('App render:', { 
    currentUser: currentUser?.id, 
    currentProfile: currentProfile?.id,
    amplifyUser: amplifyUser?.userId,
    location: location.pathname 
  });

  // Count user's events
  const userEventsCount = currentProfile ? events.filter(event =>
    event.golfers.some(golfer => golfer.profileId === currentProfile.id)
  ).length : 0;

  const handleLoginSuccess = () => {
    console.log('Login successful, checking auth again...');
    setIsCheckingAuth(true);
    // Re-check auth after successful login
    setTimeout(async () => {
      try {
        const { getCurrentUser, fetchUserAttributes } = await import('aws-amplify/auth');
        const { fetchCloudProfile } = await import('../utils/profileSync');
        const { loadIndividualRoundsFromCloud } = await import('../utils/roundSync');
        
        const user = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        
        setAmplifyUser(user);
        console.log('User after login:', user, attributes);
        
        // Create local user if needed
        if (user && !currentUser) {
          const email = attributes.email || user.username;
          const displayName = attributes.name || attributes.email || user.username;
          createUser(email, displayName, true); // Skip automatic profile creation
          
          // Try to fetch existing cloud profile
          const cloudProfile = await fetchCloudProfile(user.userId);
          
          if (cloudProfile) {
            console.log('Loading cloud profile after login:', cloudProfile);
            
            // Also load IndividualRounds from cloud
            const cloudRounds = await loadIndividualRoundsFromCloud(cloudProfile.id);
            console.log('Loaded', cloudRounds.length, 'individual rounds from cloud');
            
            const { profiles } = useStore.getState();
            useStore.setState({ 
              profiles: [...profiles, { ...cloudProfile, individualRounds: cloudRounds } as any],
              currentProfile: { ...cloudProfile, individualRounds: cloudRounds } as any
            });
          }
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!amplifyUser && !currentUser) {
    console.log('App: No user (Amplify or local), showing login');
    return (
      <LoginPage 
        onSuccess={handleLoginSuccess}
        onGuestMode={() => {
          console.log('Guest mode selected, creating local-only user');
          createUser('guest@local', 'Guest User', false); // Create local guest user
        }}
      />
    );
  }

  // If we have a user but no profile, show profile completion
  if (currentUser && !currentProfile) {
    console.log('App: User exists but no profile, showing profile completion');
    return (
      <ProfileCompletion
        userId={amplifyUser?.userId || currentUser.id} // Use Amplify userId, not local ID
        email={amplifyUser?.signInDetails?.loginId || currentUser.username}
        onComplete={() => {
          console.log('Profile completion finished');
          // Force a re-render to show the dashboard
          setIsCheckingAuth(true);
          setTimeout(() => setIsCheckingAuth(false), 100);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 text-gray-900">
      <header className="bg-primary-900/80 backdrop-blur text-white px-4 py-3 pt-safe flex items-center justify-between shadow-md sticky top-0 z-40">
        <Link to="/">
          <img src="/gimmies-logo.png" alt="Gimmies" className="h-12 w-auto" />
        </Link>
        <UserMenu />
      </header>
      <main className="flex-1 p-4 pb-24 pb-safe max-w-5xl w-full mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/handicap" element={<HandicapPage />} />
          <Route path="/handicap/add-round" element={<AddScorePage />} />
          <Route path="/handicap/round/:roundId" element={<RoundDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/event/:id/*" element={<EventPage />} />
          <Route path="/join/:code" element={<JoinEventPage />} />
          <Route path="/auth-demo" element={<AuthDemoPage />} />
        </Routes>
      </main>
      <footer className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-primary-900/20 flex items-center justify-between px-4 py-2 pb-safe z-40">
        <Link
          to="/"
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            location.pathname === '/' ? 'text-primary-600' : 'text-primary-800 hover:text-primary-600'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs">Home</span>
        </Link>

        <Link
          to="/events"
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors relative ${
            location.pathname === '/events' ? 'text-primary-600' : 'text-primary-800 hover:text-primary-600'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs">Events</span>
          {userEventsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {userEventsCount > 9 ? '9+' : userEventsCount}
            </span>
          )}
        </Link>

        <Link
          to="/handicap"
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            location.pathname === '/handicap' ? 'text-primary-600' : 'text-primary-800 hover:text-primary-600'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth={2}/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8M8 12a4 4 0 004-4m0 8a4 4 0 01-4-4" />
          </svg>
          <span className="text-xs">Handicap</span>
        </Link>

        <Link
          to="/analytics"
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            location.pathname === '/analytics' ? 'text-primary-600' : 'text-primary-800 hover:text-primary-600'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs">Analytics</span>
        </Link>
      </footer>
      <ToastManager />
    </div>
  );
};

export default App;
