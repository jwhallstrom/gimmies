import React, { useState, useEffect } from 'react';
import useStore from '../state/store';

const ProfileManager: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { currentProfile, profiles, currentUser, updateProfile, setCurrentProfile } = useStore();
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editProfileName, setEditProfileName] = useState('');
  const [editHandicapIndex, setEditHandicapIndex] = useState('');

  // Filter profiles to only show current user's profiles
  const userProfiles = profiles.filter(p => p.userId === currentUser?.id);

  // Auto-populate edit fields when currentProfile changes
  useEffect(() => {
    if (currentProfile) {
      setEditProfileName(currentProfile.name || '');
      setEditFirstName(currentProfile.firstName || '');
      setEditLastName(currentProfile.lastName || '');
      setEditEmail(currentProfile.email || '');
      setEditHandicapIndex(currentProfile.handicapIndex?.toString() || '');
    }
  }, [currentProfile]);

  const handleUpdatePreference = (key: keyof NonNullable<typeof currentProfile>['preferences'], value: any) => {
    if (currentProfile) {
      updateProfile(currentProfile.id, {
        preferences: { ...currentProfile.preferences, [key]: value }
      });
    }
  };

  const handleSaveProfile = () => {
    if (currentProfile) {
      updateProfile(currentProfile.id, {
        name: editProfileName.trim() || currentProfile.name,
        firstName: editFirstName.trim() || undefined,
        lastName: editLastName.trim() || undefined,
        email: editEmail.trim() || undefined,
        handicapIndex: editHandicapIndex ? parseFloat(editHandicapIndex) : undefined
      });
      onClose?.(); // Close the modal after saving
    }
  };

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

  if (!currentProfile && userProfiles.length === 0) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">No Profile Found</h2>
        <p className="text-gray-600 mb-4">Please contact an administrator to create a profile for you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-profile-manager>
      {/* Profile Avatar and Basic Info */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="relative">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-lg overflow-hidden">
            {currentProfile?.avatar ? (
              <img src={currentProfile.avatar} alt={currentProfile.name} className="w-full h-full object-cover" />
            ) : (
              currentProfile?.name.charAt(0).toUpperCase()
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 bg-primary-600 text-white rounded-full p-1 cursor-pointer hover:bg-primary-700">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900">{currentProfile?.name}</h3>
          <p className="text-sm text-gray-600">{currentUser?.username}</p>
        </div>
      </div>

      {/* Edit Form */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Edit Profile Information</h4>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Profile Name</label>
              <input
                type="text"
                value={editProfileName}
                onChange={(e) => setEditProfileName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Your profile name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Handicap Index</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={editHandicapIndex}
                onChange={(e) => setEditHandicapIndex(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.0"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">First Name</label>
              <input
                type="text"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="First name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">Last Name</label>
              <input
                type="text"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Last name"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>
        </div>
      </div>

      {/* Preferences */}
      {currentProfile && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Preferences</h4>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="netScoring"
                checked={currentProfile.preferences.defaultNetScoring}
                onChange={(e) => handleUpdatePreference('defaultNetScoring', e.target.checked)}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="netScoring" className="text-sm text-gray-700">Default to net scoring</label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoAdvance"
                checked={currentProfile.preferences.autoAdvanceScores}
                onChange={(e) => handleUpdatePreference('autoAdvanceScores', e.target.checked)}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="autoAdvance" className="text-sm text-gray-700">Auto-advance to next hole</label>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showStrokes"
                checked={currentProfile.preferences.showHandicapStrokes}
                onChange={(e) => handleUpdatePreference('showHandicapStrokes', e.target.checked)}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="showStrokes" className="text-sm text-gray-700">Show handicap stroke indicators</label>
            </div>
          </div>
        </div>
      )}

      {/* Profile Switching */}
      {userProfiles.length > 1 && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Switch Profile</h4>
          <div className="space-y-2">
            {userProfiles.map(profile => (
              <button
                key={profile.id}
                onClick={() => setCurrentProfile(profile.id)}
                className={`w-full text-left p-3 rounded border ${
                  currentProfile?.id === profile.id
                    ? 'bg-primary-100 border-primary-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{profile.name}</div>
                    {profile.email && (
                      <div className="text-xs text-gray-600 truncate">{profile.email}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden buttons for header controls */}
      <button
        data-save
        onClick={handleSaveProfile}
        className="hidden"
      />
      <button
        data-reset
        onClick={() => {
          // Reset form to original values
          if (currentProfile) {
            setEditProfileName(currentProfile.name || '');
            setEditFirstName(currentProfile.firstName || '');
            setEditLastName(currentProfile.lastName || '');
            setEditEmail(currentProfile.email || '');
            setEditHandicapIndex(currentProfile.handicapIndex?.toString() || '');
          }
        }}
        className="hidden"
      />
    </div>
  );
};

export default ProfileManager;
