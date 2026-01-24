import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import ProfileManager from './ProfileManager';
import { useAuthMode } from '../hooks/useAuthMode';
import { fileToAvatarDataUrl } from '../utils/avatarImage';

const UserMenu: React.FC = () => {
  const { currentUser, currentProfile, updateProfile, logout } = useStore();
  const { isGuest, isAuthenticated } = useAuthMode();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);
  const navigate = useNavigate();

  const hasNotifications = useStore((s) => {
    if (!s.currentProfile) return false;
    const pid = s.currentProfile.id;
    return s.events.some((e) => e.golfers.some((g) => g.profileId === pid) && (e.chat?.length || 0) > 0);
  });

  if (!currentUser || !currentProfile) return null;

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && currentProfile) {
      (async () => {
        try {
          const avatar = await fileToAvatarDataUrl(file, { maxSize: 512, quality: 0.85 });
          updateProfile(currentProfile.id, { avatar });
        } finally {
          // Allow selecting the same file twice
          event.currentTarget.value = '';
        }
      })();
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Profile (name) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-white hover:bg-white/10 rounded-xl px-2 py-2 transition-colors"
        aria-label="Open profile menu"
      >
        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white font-semibold text-sm overflow-hidden border border-white/10">
          {currentProfile.avatar ? (
            <img src={currentProfile.avatar} alt={currentProfile.name} className="w-full h-full object-cover" />
          ) : (
            currentProfile.name.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-sm font-semibold text-white/95 max-w-[120px] truncate">
          {currentProfile.name}
        </span>
        {isGuest && (
          <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold tracking-wide">
            GUEST
          </span>
        )}
      </button>

      {/* Notifications (golf flag) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate('/events');
        }}
        className="relative p-2 rounded-xl text-white/95 hover:bg-white/10 transition-colors"
        aria-label="Notifications"
        title="Notifications"
      >
        {/* golf flag icon */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 22V3" />
          <path
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 4c3-2 6 2 9 0s6-2 6 0v9c0 2-3 0-6 0s-6 2-9 0"
          />
        </svg>
        {hasNotifications && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-primary-900" />
        )}
      </button>

      {/* Settings (ellipsis) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-xl text-white/95 hover:bg-white/10 transition-colors"
        aria-label="Settings"
        title="Settings"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden">
                {currentProfile.avatar ? (
                  <img src={currentProfile.avatar} alt={currentProfile.name} className="w-full h-full object-cover" />
                ) : (
                  currentProfile.name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{currentProfile.name}</div>
                <div className="text-sm text-gray-500">{currentUser.username}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                <div>Handicap: {currentProfile.handicapIndex || 'Not set'}</div>
                <div>Rounds: {currentProfile.stats.roundsPlayed}</div>
              </div>

              {/* Change photo (settings entry point) */}
              <label className="block w-full">
                <span className="block text-[11px] font-semibold tracking-widest text-gray-500 uppercase mb-2">Profile photo</span>
                <span className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg text-sm font-semibold bg-gray-50 hover:bg-gray-100 border border-gray-200 cursor-pointer">
                  Change photo
                </span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>

              {/* Theme toggle */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase mb-2">Theme</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'auto'] as const).map((t) => {
                    const active = (currentProfile.preferences?.theme || 'auto') === t;
                    return (
                      <button
                        key={t}
                        onClick={() =>
                          updateProfile(currentProfile.id, {
                            preferences: { ...(currentProfile.preferences as any), theme: t },
                          })
                        }
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                          active
                            ? 'bg-primary-600 text-white border-primary-700'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Auto'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowProfileManager(true);
                  setIsOpen(false);
                }}
                className="w-full text-left text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Tournaments (Prototype) */}
          <div className="px-4 py-3 border-b border-gray-200">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/tournaments');
              }}
              className="w-full flex items-center gap-3 text-left text-sm text-gray-700 hover:text-primary-600 font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <div>
                <div className="font-semibold">Tournaments</div>
                <div className="text-xs text-gray-500">Manage & join tournaments</div>
              </div>
              <span className="ml-auto text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">BETA</span>
            </button>
          </div>

          <div className="p-4">
            <div className="text-xs text-gray-400 text-center mb-2">v0.1.0</div>
            <button
              onClick={async () => {
                try {
                  // Sign out from Amplify
                  const { signOut } = await import('aws-amplify/auth');
                  await signOut();
                } catch (err) {
                  console.log('Amplify sign out error (may not be signed in):', err);
                }
                
                // Clear local store
                logout();
                setIsOpen(false);
                
                // Force page reload to reset app state
                window.location.href = '/';
              }}
              className="w-full text-left text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Profile Manager - Must be above header (z-40) and footer (z-40) */}
      {showProfileManager && (
        <div className="fullscreen-overlay bg-white flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0 pt-safe">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-gray-900">Edit Profile</h1>
              <div className="flex items-center gap-2">
                {/* Save Button */}
                <button
                  onClick={() => {
                    // Trigger save from ProfileManager
                    const profileManager = document.querySelector('[data-profile-manager]');
                    if (profileManager) {
                      const saveButton = profileManager.querySelector('button[data-save]') as HTMLButtonElement;
                      saveButton?.click();
                    }
                    setShowProfileManager(false);
                  }}
                  className="text-primary-600 hover:text-primary-700 p-2 rounded-lg"
                  title="Save Changes"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                
                {/* Reset Button */}
                <button
                  onClick={() => {
                    // Trigger reset from ProfileManager
                    const profileManager = document.querySelector('[data-profile-manager]');
                    if (profileManager) {
                      const resetButton = profileManager.querySelector('button[data-reset]') as HTMLButtonElement;
                      resetButton?.click();
                    }
                  }}
                  className="text-orange-600 hover:text-orange-700 p-2 rounded-lg"
                  title="Reset Form"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                
                {/* Close Button */}
                <button
                  onClick={() => setShowProfileManager(false)}
                  className="text-gray-600 hover:text-gray-900 p-2 rounded-lg"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 pb-safe" style={{ minHeight: '0' }}>
            <div className="max-w-md mx-auto">
              <ProfileManager onClose={() => setShowProfileManager(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
