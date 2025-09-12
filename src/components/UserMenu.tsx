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

      {/* Profile Manager Modal */}
      {showProfileManager && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-8"
             onClick={(e) => {
               // Close modal when clicking on backdrop
               if (e.target === e.currentTarget) {
                 setShowProfileManager(false);
               }
             }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto max-h-[85vh] overflow-y-auto relative">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>
              <button
                onClick={() => setShowProfileManager(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <ProfileManager onClose={() => setShowProfileManager(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
