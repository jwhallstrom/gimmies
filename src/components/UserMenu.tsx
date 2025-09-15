import React, { useState } from 'react';
import useStore from '../state/store';
import ProfileManager from './ProfileManager';

const UserMenu: React.FC = () => {
  const { currentUser, currentProfile, updateProfile, logout } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileManager, setShowProfileManager] = useState(false);

  if (!currentUser || !currentProfile) return null;

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && currentProfile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        updateProfile(currentProfile.id, { avatar: imageData });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-white hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
      >
        <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
          {currentProfile.avatar ? (
            <img src={currentProfile.avatar} alt={currentProfile.name} className="w-full h-full object-cover" />
          ) : (
            currentProfile.name.charAt(0).toUpperCase()
          )}
        </div>
        <span className="text-sm font-medium text-gray-900">{currentProfile.name}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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

          <div className="p-4">
            <div className="text-xs text-gray-400 text-center mb-2">v0.1.0</div>
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
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
                  className="text-green-600 hover:text-green-700 p-2 rounded-lg"
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
