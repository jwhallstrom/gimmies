import React, { useState, useEffect } from 'react';
import useStore from '../state/store';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { events, currentProfile, currentUser, profiles, joinEventByCode, deleteEvent, createProfile, cleanupDuplicateProfiles } = useStore();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Filter events to only show those the current user is participating in
  const userEvents = events.filter(event =>
    currentProfile && event.golfers.some(golfer => golfer.profileId === currentProfile.id)
  );

  console.log('User events count:', userEvents.length, 'Total events:', events.length);

  const handleJoinEvent = () => {
    if (!joinCode.trim()) return;

    const result = joinEventByCode(joinCode.trim().toUpperCase());
    if (result.success) {
      setJoinMessage('Successfully joined the event!');
      setJoinCode('');
      setShowJoinForm(false);
    } else {
      setJoinMessage(result.error || 'Invalid or expired share code.');
    }
    setTimeout(() => setJoinMessage(''), 3000);
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <button
            onClick={() => {
              const eventId = useStore.getState().createEvent();
              if (eventId) {
                navigate(`/event/${eventId}`);
              }
            }}
            disabled={!currentProfile}
            className={`w-full text-white p-4 rounded-xl shadow-md transition-shadow ${
              currentProfile 
                ? 'bg-gradient-to-r from-primary-500 to-primary-600 hover:shadow-lg' 
                : 'bg-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="text-lg font-semibold mb-1">New Event</div>
            <div className="text-sm opacity-90">Create a new golf event</div>
            {!currentProfile && (
              <div className="text-xs opacity-75 mt-1">Profile required</div>
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
          <div className="text-lg font-semibold mb-1">Join Event</div>
          <div className="text-sm opacity-75">Enter a share code</div>
        </button>

        <div className="bg-white/90 backdrop-blur text-primary-800 p-4 rounded-xl shadow-md border border-primary-900/5">
          <div className="text-lg font-semibold mb-1">Quick Stats</div>
          <div className="text-sm opacity-75">
            Avg Score: {currentProfile.stats.averageScore > 0 ? currentProfile.stats.averageScore.toFixed(1) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Join Event Modal */}
      {showJoinForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Join an Event</h2>
              <button
                onClick={() => setShowJoinForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

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
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
