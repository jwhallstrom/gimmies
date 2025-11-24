import React, { useState, useEffect } from 'react';
import useStore from '../state/store';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthMode } from '../hooks/useAuthMode';
import { CreateEventWizard } from '../components/CreateEventWizard';

const Dashboard: React.FC = () => {
  const { events, currentProfile, currentUser, profiles, joinEventByCode, deleteEvent, createProfile, cleanupDuplicateProfiles, loadEventsFromCloud } = useStore();
  const { isGuest, isAuthenticated } = useAuthMode();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Filter events to only show those the current user is participating in
  const userEvents = events.filter(event =>
    currentProfile && event.golfers.some(golfer => golfer.profileId === currentProfile.id)
  );

  console.log('User events count:', userEvents.length, 'Total events:', events.length);

  const handleJoinEvent = async () => {
    if (!joinCode.trim()) return;

    const codeToJoin = joinCode.trim().toUpperCase();
    console.log('📱 Dashboard: Attempting to join event with code:', codeToJoin);
    
    const result = await joinEventByCode(codeToJoin);
    
    if (result.success) {
      console.log('✅ Dashboard: Successfully joined event:', result.eventId);
      setJoinMessage('Successfully joined the event!');
      setJoinCode('');
      setShowJoinForm(false);
      
      // Navigate directly using the eventId returned from joinEventByCode
      if (result.eventId) {
        console.log('🚀 Dashboard: Navigating to event:', result.eventId);
        setTimeout(() => {
          navigate(`/event/${result.eventId}`);
        }, 500); // Small delay to let success message show
      } else {
        // Fallback: Find the event we just joined
        console.log('⚠️ Dashboard: No eventId returned, searching locally');
        setTimeout(() => {
          const joinedEvent = events.find(e => e.shareCode === codeToJoin);
          if (joinedEvent) {
            console.log('🚀 Dashboard: Found event locally:', joinedEvent.id);
            navigate(`/event/${joinedEvent.id}`);
          } else {
            console.error('❌ Dashboard: Could not find joined event');
          }
        }, 500);
      }
    } else {
      console.error('❌ Dashboard: Failed to join event:', result.error);
      setJoinMessage(result.error || 'Invalid or expired share code.');
      setTimeout(() => setJoinMessage(''), 3000);
    }
  };

  const handleCreateProfile = () => {
    if (newProfileName.trim()) {
      createProfile(newProfileName.trim());
      setShowProfileSetup(false);
      setNewProfileName('');
    }
  };

  // Handle profile setup for new users - ensure only one profile per user
  useEffect(() => {
    console.log('Dashboard useEffect triggered:', {
      currentUser: currentUser?.id,
      currentProfile: currentProfile?.id,
      isCreatingProfile,
      profilesCount: profiles.length
    });

    if (currentUser && !currentProfile && !isCreatingProfile) {
      const userProfiles = profiles.filter(p => p.userId === currentUser.id);
      console.log('Profile setup check:', { 
        currentUser: currentUser.id, 
        currentProfile: (currentProfile as any)?.id || null, 
        userProfilesCount: userProfiles.length,
        isCreatingProfile 
      });
      
      if (userProfiles.length === 0) {
        // No profiles exist for this user, create one
        console.log('Creating new profile for user:', currentUser.displayName);
        setIsCreatingProfile(true);
        createProfile(currentUser.displayName);
        
        // Reset the flag after state updates
        setTimeout(() => {
          console.log('Resetting isCreatingProfile flag');
          setIsCreatingProfile(false);
        }, 500); // Increased timeout
      } else if (userProfiles.length === 1 && !currentProfile) {
        // User has exactly one profile but it's not set as current
        console.log('Setting existing profile as current:', userProfiles[0].id);
        useStore.getState().setCurrentProfile(userProfiles[0].id);
      } else if (userProfiles.length > 1) {
        console.log('User has multiple profiles, showing cleanup option');
      }
    }
  }, [currentUser?.id, currentProfile?.id, profiles.length, isCreatingProfile]);

  // Fallback: If we're stuck in loading state too long, force reset
  useEffect(() => {
    if (currentUser && !currentProfile && isCreatingProfile) {
      const timer = setTimeout(() => {
        console.log('Fallback: Resetting isCreatingProfile flag due to timeout');
        setIsCreatingProfile(false);
      }, 3000); // 3 second fallback
      
      return () => clearTimeout(timer);
    }
  }, [currentUser, currentProfile, isCreatingProfile]);

  // If user exists but no profile, show loading while creating
  if (currentUser && !currentProfile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your profile...</p>
          <p className="text-xs text-gray-500 mt-2">If this takes too long, try refreshing the page</p>
          <div className="mt-4 space-y-2">
            <button 
              onClick={() => window.location.reload()} 
              className="block w-full px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
            >
              Refresh Page
            </button>
            <button 
              onClick={() => {
                console.log('Manual profile creation triggered');
                setIsCreatingProfile(true);
                createProfile(currentUser.displayName);
                setTimeout(() => setIsCreatingProfile(false), 500);
              }} 
              className="block w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Create Profile Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  // TEMPORARY: Force profile creation if we're somehow in this state
  if (currentUser && !currentProfile) {
    console.log('ERROR: Reached dashboard without profile, forcing creation');
    createProfile(currentUser.displayName);
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-red-600">Profile creation failed, retrying...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null; // This shouldn't happen if auth is working
  }

  // Safety check - if we somehow got here without a profile, force creation
  if (!currentProfile) {
    console.log('ERROR: No currentProfile in main render, forcing creation');
    createProfile(currentUser.displayName);
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-red-600">Profile missing, creating...</p>
        </div>
      </div>
    );
  }

  console.log('Dashboard rendering with:', {
    currentUser: currentUser?.id,
    currentProfile: currentProfile?.id,
    profilesCount: profiles.length
  });

  // Force re-render when currentProfile changes
  useEffect(() => {
    console.log('currentProfile changed:', currentProfile?.id);
  }, [currentProfile?.id]);

  // Load events from cloud when profile is available
  useEffect(() => {
    if (currentProfile && !isLoadingEvents) {
      console.log('📥 Dashboard: Loading events from cloud for profile:', currentProfile.id);
      setIsLoadingEvents(true);
      loadEventsFromCloud().finally(() => {
        console.log('✅ Dashboard: Finished loading events from cloud');
        setIsLoadingEvents(false);
      });
    }
  }, [currentProfile?.id]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-6 border border-primary-900/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-800">Welcome back, {currentProfile.name}!</h1>
            <p className="text-gray-600 mt-1">Ready for another round?</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Rounds</div>
            <div className="text-2xl font-bold text-primary-600">{currentProfile.stats.roundsPlayed}</div>
            {profiles.filter(p => p.userId === currentUser.id).length > 1 && (
              <button
                onClick={() => {
                  if (window.confirm('This will remove duplicate profiles. Continue?')) {
                    cleanupDuplicateProfiles();
                  }
                }}
                className="text-xs text-red-600 hover:text-red-700 mt-1 block"
              >
                Clean Duplicates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <button
            onClick={() => setShowCreateWizard(true)}
            disabled={!currentProfile}
            className={`w-full text-white p-4 rounded-xl shadow-md transition-shadow ${
              currentProfile 
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-lg' 
                : 'bg-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="text-lg font-semibold mb-1 text-center">New Event</div>
            <div className="text-sm opacity-90 text-center">Create a new golf event</div>
            {!currentProfile && (
              <div className="text-xs opacity-75 mt-1 text-center">Profile required</div>
            )}
          </button>
          {!currentProfile && (
            <div className="mt-2 text-center">
              <button
                onClick={() => {
                  console.log('Manual profile creation from dashboard, currentUser:', currentUser);
                  if (currentUser) {
                    createProfile(currentUser.displayName);
                  }
                }}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
              >
                Create Profile Manually
              </button>
              <div className="text-xs text-gray-500 mt-1">
                Debug: currentProfile = {currentProfile ? 'exists' : 'null'}, 
                profiles count = {profiles.length}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowJoinForm(true)}
          className="bg-white/90 backdrop-blur text-primary-800 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-primary-900/5"
        >
          <div className="flex items-center gap-2 justify-center">
            <div className="text-lg font-semibold mb-1">Join Event</div>
            {isGuest && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">🔒</span>}
          </div>
          <div className="text-sm opacity-75 text-center">{isGuest ? 'Sign in to join events' : 'Enter a share code'}</div>
        </button>

        <button
          onClick={() => navigate('/handicap/add-round')}
          disabled={!currentProfile}
          className={`w-full text-primary-800 p-4 rounded-xl shadow-md transition-shadow border border-primary-900/5 ${
            currentProfile 
              ? 'bg-white/90 backdrop-blur hover:shadow-lg' 
              : 'bg-gray-200 cursor-not-allowed opacity-50'
          }`}
        >
          <div className="text-lg font-semibold mb-1 text-center">Add New Round</div>
          <div className="text-sm opacity-75 text-center">{currentProfile ? 'Track your handicap' : 'Profile required'}</div>
        </button>

        <div className="bg-white/90 backdrop-blur text-primary-800 p-4 rounded-xl shadow-md border border-primary-900/5">
          <div className="text-lg font-semibold mb-1 text-center">Quick Stats</div>
          <div className="text-sm opacity-75 text-center">
            Avg Score: {currentProfile.stats.averageScore > 0 ? currentProfile.stats.averageScore.toFixed(1) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Join Event Modal */}
      {showJoinForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{isGuest ? '🔒 Sign In Required' : 'Join an Event'}</h2>
              <button
                onClick={() => setShowJoinForm(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Guest Mode Upgrade Prompt */}
            {isGuest ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-4">
                    <svg className="w-10 h-10 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">Join Events from Friends!</h3>
                      <p className="text-sm text-gray-700 mb-3">
                        Joining events requires a cloud account to sync data across devices and collaborate with other players in real-time.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
                    <p className="font-semibold text-gray-800 text-sm mb-2">With a free account:</p>
                    <ul className="space-y-1 text-xs text-gray-700">
                      <li>✅ Join events via 6-digit codes</li>
                      <li>✅ Share your events with friends</li>
                      <li>✅ Real-time score updates</li>
                      <li>✅ Event chat & collaboration</li>
                      <li>✅ Access from any device</li>
                    </ul>
                  </div>
                  
                  <button
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all shadow-md"
                  >
                    Sign In or Create Free Account
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  Your guest data will be safe - you can keep using the app locally anytime.
                </p>
              </div>
            ) : (
              // Authenticated user - show join form
              <>
                {joinMessage && (
                  <div className={`mb-4 p-3 rounded ${
                    joinMessage.includes('Successfully')
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {joinMessage}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Share Code</label>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Enter 6-character code"
                      className="w-full border rounded px-3 py-2 text-center text-lg font-mono uppercase"
                      maxLength={6}
                    />
                  </div>

                  <button
                    onClick={handleJoinEvent}
                    disabled={!joinCode.trim() || joinCode.length !== 6}
                    className="w-full bg-primary-600 text-white py-2 px-4 rounded disabled:opacity-50 hover:bg-primary-700"
                  >
                    Join Event
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Event Wizard */}
      <CreateEventWizard 
        isOpen={showCreateWizard} 
        onClose={() => setShowCreateWizard(false)} 
      />

    </div>
  );
};

export default Dashboard;
