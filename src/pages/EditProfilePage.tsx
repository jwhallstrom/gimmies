import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentProfile, profiles, currentUser, createProfile, updateProfile, setCurrentProfile, exportProfile, importProfile, deleteProfile } = useStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileFirstName, setNewProfileFirstName] = useState('');
  const [newProfileLastName, setNewProfileLastName] = useState('');
  const [newProfileEmail, setNewProfileEmail] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editHandicapIndex, setEditHandicapIndex] = useState('');

  // Filter profiles to only show current user's profiles
  const userProfiles = profiles.filter(p => p.userId === currentUser?.id);

  const handleCreateProfile = () => {
    if (newProfileName.trim()) {
      // Generate full name from first and last name if provided
      const fullName = newProfileFirstName.trim() && newProfileLastName.trim()
        ? `${newProfileFirstName.trim()} ${newProfileLastName.trim()}`
        : newProfileName.trim();

      createProfile(fullName, newProfileEmail.trim() || undefined, {
        firstName: newProfileFirstName.trim() || undefined,
        lastName: newProfileLastName.trim() || undefined
      });
      setNewProfileName('');
      setNewProfileFirstName('');
      setNewProfileLastName('');
      setNewProfileEmail('');
      setIsCreating(false);
    }
  };

  const handleUpdatePreference = (key: keyof NonNullable<typeof currentProfile>['preferences'], value: any) => {
    if (currentProfile) {
      updateProfile(currentProfile.id, {
        preferences: { ...currentProfile.preferences, [key]: value }
      });
    }
  };

  const handleStartEdit = () => {
    if (currentProfile) {
      setEditName(currentProfile.name);
      setEditFirstName(currentProfile.firstName || '');
      setEditLastName(currentProfile.lastName || '');
      setEditEmail(currentProfile.email || '');
      setEditHandicapIndex(currentProfile.handicapIndex?.toString() || '');
      setEditingProfile(true);
    }
  };

  const handleSaveProfile = () => {
    if (currentProfile && editName.trim()) {
      // Generate full name from first and last name if provided
      const fullName = editFirstName.trim() && editLastName.trim()
        ? `${editFirstName.trim()} ${editLastName.trim()}`
        : editName.trim();

      updateProfile(currentProfile.id, {
        name: fullName,
        firstName: editFirstName.trim() || undefined,
        lastName: editLastName.trim() || undefined,
        email: editEmail.trim() || undefined,
        handicapIndex: editHandicapIndex ? parseFloat(editHandicapIndex) : undefined
      });
      setEditingProfile(false);
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
      <div className="min-h-screen bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 text-gray-900 p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h1 className="text-2xl font-bold text-center mb-6 text-gray-900">Welcome to Gimmies Golf!</h1>
            <p className="text-gray-600 mb-6 text-center">Create your profile to get started.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Name</label>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">First Name (optional)</label>
                <input
                  type="text"
                  value={newProfileFirstName}
                  onChange={(e) => setNewProfileFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Last Name (optional)</label>
                <input
                  type="text"
                  value={newProfileLastName}
                  onChange={(e) => setNewProfileLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                  placeholder="Last name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Email (optional)</label>
                <input
                  type="email"
                  value={newProfileEmail}
                  onChange={(e) => setNewProfileEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                  placeholder="your@email.com"
                />
              </div>
              <button
                onClick={handleCreateProfile}
                disabled={!newProfileName.trim()}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded font-medium disabled:opacity-50 hover:bg-primary-700"
              >
                Create Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 text-gray-900">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-gray-600 hover:text-gray-900 p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Edit Profile</h1>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Done
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 pb-24">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Current Profile */}
          {currentProfile && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Current Profile</h2>
                <button
                  onClick={editingProfile ? handleSaveProfile : handleStartEdit}
                  className={`px-4 py-2 rounded font-medium ${
                    editingProfile
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {editingProfile ? 'Save' : 'Edit'}
                </button>
              </div>

              {editingProfile ? (
                <div className="space-y-4">
                  {/* Profile Image Upload */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-xl overflow-hidden">
                        {currentProfile.avatar ? (
                          <img src={currentProfile.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          currentProfile.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="text-sm"
                          id="profile-image"
                        />
                        <label htmlFor="profile-image" className="text-xs text-gray-600 block mt-1">
                          Upload a profile picture (optional)
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Name Fields */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-900">First Name</label>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-900">Last Name</label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                        placeholder="Last name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-900">Email</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                        placeholder="your@email.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-900">Handicap Index</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        value={editHandicapIndex}
                        onChange={(e) => setEditHandicapIndex(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                        placeholder="Enter your handicap index"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={!editName.trim()}
                      className="flex-1 bg-green-600 text-white py-3 px-4 rounded font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingProfile(false)}
                      className="flex-1 bg-gray-600 text-white py-3 px-4 rounded font-medium hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-primary-50 rounded-lg p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {currentProfile.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{currentProfile.name}</h3>
                      {currentProfile.email && (
                        <p className="text-sm text-gray-600">{currentProfile.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-900">Rounds Played:</span>
                      <span className="ml-2 text-gray-700">{currentProfile.stats.roundsPlayed}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">Average Score:</span>
                      <span className="ml-2 text-gray-700">{currentProfile.stats.averageScore || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">Best Score:</span>
                      <span className="ml-2 text-gray-700">{currentProfile.stats.bestScore || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900">Handicap Index:</span>
                      <span className="ml-2 text-gray-700">{currentProfile.handicapIndex || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preferences */}
          {currentProfile && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">Theme</label>
                  <select
                    value={currentProfile.preferences.theme}
                    onChange={(e) => handleUpdatePreference('theme', e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="netScoring"
                      checked={currentProfile.preferences.defaultNetScoring}
                      onChange={(e) => handleUpdatePreference('defaultNetScoring', e.target.checked)}
                      className="w-5 h-5"
                    />
                    <label htmlFor="netScoring" className="text-sm text-gray-900">Default to net scoring</label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="autoAdvance"
                      checked={currentProfile.preferences.autoAdvanceScores}
                      onChange={(e) => handleUpdatePreference('autoAdvanceScores', e.target.checked)}
                      className="w-5 h-5"
                    />
                    <label htmlFor="autoAdvance" className="text-sm text-gray-900">Auto-advance to next hole</label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showStrokes"
                      checked={currentProfile.preferences.showHandicapStrokes}
                      onChange={(e) => handleUpdatePreference('showHandicapStrokes', e.target.checked)}
                      className="w-5 h-5"
                    />
                    <label htmlFor="showStrokes" className="text-sm text-gray-900">Show handicap stroke indicators</label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profile Switching */}
          {userProfiles.length > 1 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Switch Profile</h2>
              <div className="space-y-3">
                {userProfiles.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => setCurrentProfile(profile.id)}
                    className={`w-full text-left p-4 rounded border ${
                      currentProfile?.id === profile.id
                        ? 'bg-primary-100 border-primary-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{profile.name}</div>
                        {profile.email && (
                          <div className="text-sm text-gray-600">{profile.email}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Profile Export/Import */}
          {currentProfile && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Profile Backup</h2>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    const profileData = exportProfile(currentProfile.id);
                    const blob = new Blob([profileData], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${currentProfile.name}-profile.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded font-medium hover:bg-green-700"
                >
                  Export Profile
                </button>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900">Import Profile</label>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      const success = importProfile(text);
                      if (success) {
                        alert('Profile imported successfully!');
                      } else {
                        alert('Failed to import profile. Please check the file format.');
                      }
                      e.target.value = '';
                    }}
                    className="w-full text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Create New Profile */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              {isCreating ? 'Cancel' : '+ Create New Profile'}
            </button>

            {isCreating && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">First Name</label>
                    <input
                      type="text"
                      value={newProfileFirstName}
                      onChange={(e) => setNewProfileFirstName(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Last Name</label>
                    <input
                      type="text"
                      value={newProfileLastName}
                      onChange={(e) => setNewProfileLastName(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                      placeholder="Last name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Email (optional)</label>
                    <input
                      type="email"
                      value={newProfileEmail}
                      onChange={(e) => setNewProfileEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-gray-900 bg-white"
                      placeholder="your@email.com"
                    />
                  </div>
                  <button
                    onClick={handleCreateProfile}
                    disabled={!newProfileName.trim()}
                    className="w-full bg-primary-600 text-white py-3 px-4 rounded font-medium disabled:opacity-50 hover:bg-primary-700"
                  >
                    Create Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditProfilePage;
