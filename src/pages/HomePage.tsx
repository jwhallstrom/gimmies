import React, { useState, useEffect } from 'react';
import useStore from '../state/store';
import { Link } from 'react-router-dom';
import ProfileManager from '../components/ProfileManager';
import EventSharing from '../components/EventSharing';
import { CreateEventWizard } from '../components/CreateEventWizard';

const HomePage: React.FC = () => {
  const { events, currentProfile, currentUser, users, profiles, joinEventByCode, switchUser, createUser, deleteEvent, loadEventsFromCloud } = useStore();
  const [activeTab, setActiveTab] = useState<'events' | 'profile' | 'join'>('events');
  const [joinCode, setJoinCode] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Load events from cloud when profile changes or component mounts
  useEffect(() => {
    if (currentProfile && !isLoadingEvents) {
      setIsLoadingEvents(true);
      loadEventsFromCloud().finally(() => {
        setIsLoadingEvents(false);
      });
    }
  }, [currentProfile?.id]); // Re-run when profile changes

  const handleJoinEvent = async () => {
    if (!joinCode.trim()) return;
    
    const result = await joinEventByCode(joinCode.trim().toUpperCase());
    if (result.success) {
      setJoinMessage('Successfully joined the event!');
      setJoinCode('');
      setActiveTab('events');
    } else {
      setJoinMessage(result.error || 'Invalid or expired share code.');
    }
    setTimeout(() => setJoinMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* User Management */}
      <div className="bg-white/90 backdrop-blur rounded-xl shadow-md p-4 border border-primary-900/5">
        <h2 className="text-lg font-semibold mb-3">User Management</h2>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Current User:</span>
            <select
              value={currentUser?.id || ''}
              onChange={(e) => switchUser(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.username})
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => {
              const username = prompt('Enter username:');
              if (username) {
                const displayName = prompt('Enter display name:', username);
                createUser(username, displayName || username);
              }
            }}
            className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700"
          >
            Add User
          </button>
        </div>

        {currentUser && (
          <div className="text-sm text-gray-600">
            <div>Username: {currentUser.username}</div>
            <div>Profiles: {profiles.filter(p => p.userId === currentUser.id).length}</div>
          </div>
        )}
      </div>
      {currentProfile && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
              {currentProfile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{currentProfile.name}</div>
              <div className="text-sm text-gray-600">Welcome back!</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'events' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Events
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'profile' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Profile
        </button>
        <button
          onClick={() => setActiveTab('join')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'join' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Join Event
        </button>
      </div>

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h1 className="text-xl font-semibold tracking-wide text-white drop-shadow-sm">Events</h1>
            <div className="flex gap-2 text-xs">
              <button 
                className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-3 py-1.5 rounded shadow active:scale-[0.97]" 
                onClick={() => setIsWizardOpen(true)}
                disabled={!currentProfile}
              >
                New
              </button>
              <button
                className="border border-primary-400 text-primary-50 px-3 py-1.5 rounded backdrop-blur bg-primary-700/30"
                onClick={() => {
                  const blob = new Blob([useStore.getState().exportData()], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'gimmies-export.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export
              </button>
              <label className="relative cursor-pointer px-3 py-1.5 rounded border border-primary-400 text-primary-50 backdrop-blur bg-primary-700/30">
                <span>Import</span>
                <input 
                  type="file" 
                  accept="application/json" 
                  className="hidden" 
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    try { 
                      useStore.getState().importData(JSON.parse(text)); 
                    } catch { 
                      alert('Invalid file'); 
                    }
                    e.target.value = '';
                  }} 
                />
              </label>
            </div>
          </div>
          
          {!currentProfile && (
            <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-3 rounded mb-4">
              Please create a profile first to manage events.
            </div>
          )}
          
          {isLoadingEvents && (
            <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded mb-4 flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading events from cloud...
            </div>
          )}
          
          <ul className="space-y-3">
            {events
              .filter(e => {
                // Only show events where current user is a golfer
                if (!currentProfile) return true; // Show all if no profile (shouldn't happen)
                return e.golfers.some(g => g.profileId === currentProfile.id);
              })
              .map(e => {
              const isOwner = currentProfile?.id === e.ownerProfileId;
              console.log(`Event ${e.name || 'Untitled'}: ownerProfileId=${e.ownerProfileId}, currentProfileId=${currentProfile?.id}, isOwner=${isOwner}`);
              return (
                <li key={e.id} className="bg-white/90 backdrop-blur rounded-xl shadow-md p-4 flex items-center justify-between border border-primary-900/5">
                  <div className="flex flex-col">
                    <div className="font-semibold text-sm text-primary-800">{e.name || 'Untitled Event'}</div>
                    <div className="text-[10px] uppercase tracking-wide text-primary-600/80 font-medium mt-0.5">
                      {e.date} • {e.golfers.length} players
                    </div>
                    {isOwner && (
                      <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded mt-1 w-fit">
                        Owner
                      </span>
                    )}
                    {!isOwner && e.ownerProfileId && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 w-fit">
                        Not Owner (ID: {e.ownerProfileId.slice(0, 4)}...)
                      </span>
                    )}
                    {!e.ownerProfileId && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded mt-1 w-fit">
                        No Owner Set
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/event/${e.id}`} 
                      className="text-xs font-semibold text-primary-700 bg-primary-100 hover:bg-primary-200 transition px-3 py-1 rounded-full shadow-inner"
                    >
                      Open
                    </Link>
                    {isOwner && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${e.name || 'Untitled Event'}"? This action cannot be undone and will be removed from the cloud.`)) {
                            deleteEvent(e.id);
                          }
                        }}
                        className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 transition px-3 py-1 rounded-full shadow-inner"
                        title="Delete Event"
                      >
                        Delete
                      </button>
                    )}
                    {!isOwner && (
                      <button
                        onClick={() => {
                          if (window.confirm('Do you want to claim ownership of this event?')) {
                            if (currentProfile) {
                              useStore.getState().updateEvent(e.id, { ownerProfileId: currentProfile.id });
                            }
                          }
                        }}
                        className="text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 transition px-3 py-1 rounded-full shadow-inner"
                        title="Claim Ownership"
                      >
                        Claim
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            
            {events.length === 0 && currentProfile && (
              <li className="text-center py-8 text-gray-500 list-none">
                <div className="text-lg mb-2">No events yet</div>
                <div className="text-sm">Create your first event to get started!</div>
              </li>
            )}
          </ul>
          
          <CreateEventWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && <ProfileManager />}

      {/* Join Event Tab */}
      {activeTab === 'join' && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Join an Event</h2>
            
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
              
              <div className="text-sm text-gray-600 text-center">
                Ask a friend for their event share code to join their game.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
