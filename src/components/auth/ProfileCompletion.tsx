import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../state/store';

interface ProfileCompletionProps {
  userId: string;
  email?: string;
  suggestedName?: string; // Full name from OAuth
  firstName?: string; // First name from OAuth (Google, Facebook)
  lastName?: string; // Last name from OAuth
  photoUrl?: string; // Profile photo from OAuth
  onComplete: () => void;
}

export function ProfileCompletion({ 
  userId, 
  email, 
  suggestedName, 
  firstName: oauthFirstName,
  lastName: oauthLastName,
  photoUrl,
  onComplete 
}: ProfileCompletionProps) {
  const { createProfile } = useStore();
  const navigate = useNavigate();
  
  // Pre-fill with OAuth data
  const [profileName, setProfileName] = useState(suggestedName || '');
  const [firstName, setFirstName] = useState(oauthFirstName || '');
  const [lastName, setLastName] = useState(oauthLastName || '');
  const [handicapIndex, setHandicapIndex] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if form is pre-filled from OAuth
  const isPreFilled = Boolean(suggestedName || (oauthFirstName && oauthLastName));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate - profile name is required
      if (!profileName.trim()) {
        setError('Profile name is required');
        setLoading(false);
        return;
      }

      // Create profile with all available data
      createProfile(profileName.trim(), email, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });

      // Update handicap if provided
      const { profiles, updateProfile } = useStore.getState();
      const newProfile = profiles[profiles.length - 1];
      
      if (newProfile && handicapIndex) {
        updateProfile(newProfile.id, {
          handicapIndex: parseFloat(handicapIndex)
        });
      }
      
      // CRITICAL: Update the profile's userId to match the Amplify user ID (not local Zustand ID)
      if (newProfile && userId) {
        updateProfile(newProfile.id, {
          userId: userId // Use the Amplify userId passed in props
        });
      }

      // Save profile to cloud
      console.log('Saving profile to cloud...');
      try {
        const { saveCloudProfile } = await import('../../utils/profileSync');
        const { profiles } = useStore.getState();
        const profileToSave = profiles[profiles.length - 1];
        
        console.log('Profile to save:', profileToSave);
        console.log('Amplify userId:', userId);
        
        if (profileToSave) {
          const success = await saveCloudProfile(profileToSave);
          if (success) {
            console.log('✅ Profile saved to cloud successfully!');
          } else {
            console.error('❌ Failed to save profile to cloud!');
            // Show error to user but continue
            setError('Warning: Profile saved locally but not synced to cloud. You may need to re-enter it next time.');
          }
        } else {
          console.error('❌ No profile found to save!');
          setError('Warning: Profile creation may have failed. Please try again.');
        }
      } catch (syncError) {
        console.error('❌ Cloud sync error:', syncError);
        setError('Warning: Profile saved locally but not synced to cloud.');
        // Continue anyway - offline mode
      }

      // Complete
      setTimeout(() => {
        onComplete();
        navigate('/');
      }, 100);
    } catch (err: any) {
      console.error('Profile creation error:', err);
      setError(err.message || 'Failed to create profile');
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900 relative pt-safe pb-safe pl-safe pr-safe"
      style={{
        backgroundImage: 'url(/File_000.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Light overlay */}
      <div className="absolute inset-0 bg-black/10"></div>
      
      <div className="bg-white/75 backdrop-blur-sm rounded-xl shadow-2xl p-8 w-full max-w-md mx-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">⛳</div>
          {isPreFilled ? (
            <>
              <h1 className="text-2xl font-bold text-primary-800 mb-2">Almost Done!</h1>
              <p className="text-sm text-gray-600">
                Complete your golf profile to get started
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-primary-800 mb-2">Complete Your Profile</h1>
              <p className="text-sm text-gray-600">
                Just one more step to start tracking your golf games!
              </p>
            </>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* Profile Name - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profile Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., Tiger, Phil, or Tiger Woods"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              This is how you'll appear on scoreboards
            </p>
          </div>

          {/* First & Last Name - Optional */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Smith"
              />
            </div>
          </div>

          {/* Handicap Index - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Handicap Index
            </label>
            <input
              type="number"
              step="0.1"
              value={handicapIndex}
              onChange={(e) => setHandicapIndex(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., 12.5"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional - you can add this later
            </p>
          </div>

          {/* Email Display (if available from OAuth) */}
          {email && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email {isPreFilled && <span className="text-green-600">✓</span>}
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">
                From your Google account
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading 
              ? 'Creating Profile...' 
              : isPreFilled 
                ? 'Looks Good! Start Playing ⛳' 
                : 'Start Playing Golf! ⛳'
            }
          </button>
        </form>

        {/* Helper Text */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>You can update your profile anytime from Settings</p>
        </div>
      </div>
    </div>
  );
}
