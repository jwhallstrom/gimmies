/**
 * SettingsPanel - Unified Settings Experience
 * 
 * A clean, organized settings panel inspired by iOS Settings:
 * - Profile hero with quick edit
 * - Organized sections with clear hierarchy
 * - Quick links to key app areas
 * - All preferences in one place
 */

import packageJson from '../../package.json';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { useAuthMode } from '../hooks/useAuthMode';
import { fileToAvatarDataUrl } from '../utils/avatarImage';
import { getStatusDisplay } from '../utils/verifiedStatus';
import { CourseSearch } from './CourseSearch';
import { StatusBadge, StatusProgress } from './verified';
import StatusLevelsInfo from './verified/StatusLevelsInfo';
import { isCourseIssueAdminEmail } from '../utils/adminAccess';
import { useOptionalAuth } from '../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const currentUser = useStore((s) => s.currentUser);
  const currentProfile = useStore((s) => s.currentProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const logout = useStore((s) => s.logout);
  const getProfileWallet = useStore((s) => s.getProfileWallet);
  const events = useStore((s) => s.events);
  const recomputeVerifiedStatuses = useStore((s) => s.recomputeVerifiedStatuses);
  const { isGuest } = useAuthMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit mode for profile
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandicap, setEditHandicap] = useState('');
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showStatusLevels, setShowStatusLevels] = useState(false);

  // Reset edit fields when profile changes or panel opens
  useEffect(() => {
    if (currentProfile && isOpen) {
      setEditName(currentProfile.name || '');
      setEditHandicap(currentProfile.handicapIndex?.toString() || '');
      recomputeVerifiedStatuses();
    }
  }, [currentProfile?.id, isOpen, recomputeVerifiedStatuses]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editMode) {
          setEditMode(false);
        } else if (showCourseSearch) {
          setShowCourseSearch(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, editMode, showCourseSearch, onClose]);

  if (!isOpen || !currentProfile) return null;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && currentProfile) {
      try {
        const avatar = await fileToAvatarDataUrl(file, { maxSize: 512, quality: 0.85 });
        updateProfile(currentProfile.id, { avatar });
        
        // Save to cloud (signed-in only)
        if (!isGuest) {
          try {
            const { saveCloudProfile } = await import('../utils/profileSync');
            const { profiles } = useStore.getState();
            const updatedProfile = profiles.find(p => p.id === currentProfile.id);
            if (updatedProfile) {
              await saveCloudProfile({ ...updatedProfile, avatar });
            }
          } catch (e) {
            console.error('Failed to save avatar to cloud:', e);
          }
        }
      } finally {
        event.currentTarget.value = '';
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!currentProfile) return;
    setIsSaving(true);
    
    try {
      updateProfile(currentProfile.id, {
        name: editName.trim() || currentProfile.name,
        handicapIndex: editHandicap ? parseFloat(editHandicap) : undefined,
      });
      
      // Save to cloud (signed-in only)
      if (!isGuest) {
        try {
          const { saveCloudProfile } = await import('../utils/profileSync');
          const { profiles } = useStore.getState();
          const updatedProfile = profiles.find(p => p.id === currentProfile.id);
          if (updatedProfile) {
            await saveCloudProfile(updatedProfile);
          }
        } catch (e) {
          console.error('Failed to save profile to cloud:', e);
        }
      }
      
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePreference = (key: string, value: any) => {
    if (!currentProfile) return;
    updateProfile(currentProfile.id, {
      preferences: { ...currentProfile.preferences, [key]: value },
    });

    // Best-effort cloud save (signed-in only)
    if (isGuest) return;
    void (async () => {
      try {
        const { saveCloudProfile } = await import('../utils/profileSync');
        const { profiles } = useStore.getState();
        const updatedProfile = profiles.find((p) => p.id === currentProfile.id);
        if (updatedProfile) {
          await saveCloudProfile(updatedProfile as any);
        }
      } catch (e) {
        console.error('Failed to save preferences to cloud:', e);
      }
    })();
  };

  const handleSetHomeCourse = (courseId: string, courseName: string) => {
    if (currentProfile) {
      updateProfile(currentProfile.id, {
        preferences: {
          ...currentProfile.preferences,
          homeCourseId: courseId,
          homeCourseName: courseName,
        }
      });
      setShowCourseSearch(false);
      // Sync home course change to cloud (signed-in only)
      if (isGuest) return;
      void (async () => {
        try {
          const { saveCloudProfile } = await import('../utils/profileSync');
          const { profiles } = useStore.getState();
          const updatedProfile = profiles.find((p) => p.id === currentProfile.id);
          if (updatedProfile) {
            await saveCloudProfile(updatedProfile as any);
          }
        } catch (e) {
          console.error('Failed to sync home course to cloud:', e);
        }
      })();
    }
  };

  const handleSignOut = async () => {
    try {
      const { signOut } = await import('aws-amplify/auth');
      await signOut();
    } catch (err) {
      console.log('Sign out error:', err);
    }
    logout();
    onClose();
    window.location.href = '/';
  };

  // Quick stats - with defensive checks
  const groupCount = (events || []).filter(e => e?.hubType === 'group').length;
  const eventCount = (events || []).filter(e => e?.hubType !== 'group' && !e?.isCompleted).length;
  const roundCount = currentProfile?.individualRounds?.length ?? currentProfile?.stats?.roundsPlayed ?? 0;
  const walletSummary = currentProfile ? getProfileWallet(currentProfile.id) : null;
  const netBalance = walletSummary?.lifetimeNet ?? 0;
  const auth = useOptionalAuth();
  const authUser = auth?.user;
  const homeCourse = currentProfile?.preferences?.homeCourseName || 
    (currentProfile?.preferences as any)?.homeCourse || null;
  const profileName = currentProfile?.name || 'Golfer';
  const profileAvatar = currentProfile?.avatar || null;
  const handicapIndex = currentProfile?.handicapIndex;
  const username = currentUser?.username || '';
  const canReviewCourseIssues = isCourseIssueAdminEmail(
    authUser?.email || currentProfile?.email || currentUser?.username || ''
  );

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="absolute right-0 top-0 bottom-0 w-full sm:max-w-md bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 shadow-2xl flex flex-col overflow-hidden animate-slide-in-right z-[10000]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary-700 text-white px-4 py-4 flex items-center justify-between flex-shrink-0 pt-safe">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close settings"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isGuest && (
          <div className="px-4 pt-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <div className="text-sm font-extrabold text-amber-900 dark:text-amber-200">Guest Mode</div>
              <div className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                Creating/joining games is disabled until you sign in.
              </div>
              <button
                onClick={() => {
                  // Return to LoginPage by clearing the local guest user.
                  logout();
                  onClose();
                }}
                className="mt-3 w-full bg-primary-700 hover:bg-primary-800 text-white py-2.5 rounded-xl font-extrabold"
              >
                Sign In / Create Account
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-safe relative bg-gray-50 dark:bg-slate-900">
          {/* Profile Hero */}
          <div className="bg-white dark:bg-slate-900 p-5 border-b border-gray-200 dark:border-slate-800 relative">
            {!editMode ? (
              <div className="flex items-center gap-4">
                {/* Avatar - Tap to change */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group"
                >
                  <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden border-4 border-white shadow-lg">
                    {profileAvatar ? (
                      <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      profileName.charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* Camera badge - always visible on mobile */}
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary-600 border-2 border-white flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  {/* Hover overlay for desktop */}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-xs font-medium">Change</span>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-label="Upload profile photo"
                  title="Upload profile photo"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100 truncate">{profileName}</h3>
                    <StatusBadge profile={currentProfile} size="sm" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{username}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-semibold text-primary-600">
                      {handicapIndex != null ? `${handicapIndex.toFixed(1)} HCP` : 'No handicap'}
                    </span>
                    {isGuest && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">
                        GUEST
                      </span>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => setEditMode(true)}
                  className="p-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  aria-label="Edit profile"
                  title="Edit profile"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Edit Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-slate-100">Edit Profile</h4>
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
                
                {/* Avatar in Edit Mode */}
                <div className="flex justify-center">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative"
                  >
                     <div className="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center text-white text-3xl font-bold overflow-hidden border-4 border-gray-200 dark:border-slate-700 shadow-lg">
                      {profileAvatar ? (
                        <img src={profileAvatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        profileName.charAt(0).toUpperCase()
                      )}
                    </div>
                    {/* Camera badge */}
                    <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary-600 border-2 border-white flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </button>
                </div>
                <p className="text-center text-xs text-gray-500 dark:text-slate-400">Tap photo to change</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                       className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-base bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                     <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Handicap Index</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editHandicap}
                      onChange={e => setEditHandicap(e.target.value)}
                       className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl text-base bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="0.0"
                    />
                  </div>
                </div>
                
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-slate-900 px-4 py-3 border-b border-gray-200 dark:border-slate-800">
            <div className="grid grid-cols-4 gap-2 text-center">
              <button onClick={() => { onClose(); navigate('/handicap'); }} className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">
                <div className="text-lg font-bold text-gray-900 dark:text-slate-100">{roundCount}</div>
                <div className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Rounds</div>
              </button>
              <button onClick={() => { onClose(); navigate('/'); }} className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">
                <div className="text-lg font-bold text-gray-900 dark:text-slate-100">{groupCount}</div>
                <div className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Groups</div>
              </button>
              <button onClick={() => { onClose(); navigate('/events'); }} className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">
                <div className="text-lg font-bold text-gray-900 dark:text-slate-100">{eventCount}</div>
                <div className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Events</div>
              </button>
              <button onClick={() => { onClose(); navigate('/wallet'); }} className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800">
                <div className={`text-lg font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(netBalance).toFixed(0)}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Net</div>
              </button>
            </div>
          </div>

          {/* Verified Status */}
          <div className="mt-4 px-4">
            <StatusProgress 
              profile={currentProfile} 
              showTierInfo={true}
              onShowAllLevels={() => setShowStatusLevels(true)}
            />
          </div>

          {/* Golf Settings */}
          <div className="mt-4">
            <div className="px-4 py-2">
               <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Golf Settings</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 border-y border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
              {/* Home Course */}
              <button
                onClick={() => setShowCourseSearch(true)}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">⛳</span>
                  <div className="text-left">
                     <div className="text-sm font-medium text-gray-900 dark:text-slate-100">Home Course</div>
                     <div className="text-xs text-gray-500 dark:text-slate-400">{homeCourse || 'Not set'}</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Handicap Rounds */}
              <button
                onClick={() => { onClose(); navigate('/handicap'); }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Handicap & Rounds</div>
                    <div className="text-xs text-gray-500">{roundCount} rounds tracked</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Wallet */}
              <button
                onClick={() => { onClose(); navigate('/wallet'); }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">💵</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Wallet & Settlements</div>
                    <div className="text-xs text-gray-500">Track your golf bets</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Analytics */}
              <button
                onClick={() => { onClose(); navigate('/analytics'); }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📈</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Analytics & Stats</div>
                    <div className="text-xs text-gray-500">Your golf performance</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div className="mt-4">
            <div className="px-4 py-2">
               <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Preferences</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 border-y border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
              {/* Theme */}
              <div className="px-4 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🎨</span>
                     <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Theme</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 ml-9">
                  {(['light', 'dark', 'auto'] as const).map(theme => {
                    const isActive = (currentProfile.preferences?.theme || 'auto') === theme;
                    return (
                      <button
                        key={theme}
                        onClick={() => handleUpdatePreference('theme', theme)}
                        className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          isActive 
                            ? 'bg-primary-600 text-white' 
                             : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {theme === 'light' ? '☀️ Light' : theme === 'dark' ? '🌙 Dark' : '🔄 Auto'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scoring Preferences */}
              <div className="px-4 py-3.5 space-y-3">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">⚙️</span>
                   <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Scoring</span>
                </div>
                
                <label className="flex items-center justify-between ml-9 cursor-pointer">
                   <span className="text-sm text-gray-700 dark:text-slate-300">Default to net scoring</span>
                  <input
                    type="checkbox"
                    checked={currentProfile.preferences?.defaultNetScoring || false}
                    onChange={e => handleUpdatePreference('defaultNetScoring', e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                </label>
                
                <label className="flex items-center justify-between ml-9 cursor-pointer">
                   <span className="text-sm text-gray-700 dark:text-slate-300">Auto-advance to next hole</span>
                  <input
                    type="checkbox"
                    checked={currentProfile.preferences?.autoAdvanceScores || false}
                    onChange={e => handleUpdatePreference('autoAdvanceScores', e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                </label>
                
                <label className="flex items-center justify-between ml-9 cursor-pointer">
                   <span className="text-sm text-gray-700 dark:text-slate-300">Show handicap strokes</span>
                  <input
                    type="checkbox"
                    checked={currentProfile.preferences?.showHandicapStrokes || false}
                    onChange={e => handleUpdatePreference('showHandicapStrokes', e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="mt-4">
            <div className="px-4 py-2">
               <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Account</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 border-y border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
              {/* Email */}
              <div className="px-4 py-3.5 flex items-center gap-3">
                <span className="text-xl">📧</span>
                <div>
                  <div className="text-sm font-medium text-gray-900">Email</div>
                  <div className="text-xs text-gray-500">{currentUser?.username || 'Not set'}</div>
                </div>
              </div>

              {/* Tournaments */}
              <a
                href="https://play.golfwithgimmies.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onClose()}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏆</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Tournaments</div>
                    <div className="text-xs text-gray-500">Manage & join tournaments</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">BETA</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </div>
              </a>
              
              {/* Club Dashboard */}
              <a
                href="https://club.golfwithgimmies.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onClose()}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏌️</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Club Dashboard</div>
                    <div className="text-xs text-gray-500">For courses & organizations</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">BETA</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </div>
              </a>

              {canReviewCourseIssues && (
                <button
                  onClick={() => { onClose(); navigate('/admin/course-issues'); }}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🗂️</span>
                    <div className="text-left">
                      <div className="text-sm font-medium text-gray-900 dark:text-slate-100">Course Issue Inbox</div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">Review scorecard photos and mark fixes complete</div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-red-50 transition-colors"
              >
                <span className="text-xl">🚪</span>
                <span className="text-sm font-medium text-red-600">Sign Out</span>
              </button>
            </div>
          </div>

          {/* About */}
          <div className="mt-4 mb-8">
            <div className="px-4 py-2">
               <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">About</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 border-y border-gray-200 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📱</span>
                 <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Version</span>
                </div>
                 <span className="text-sm text-gray-500 dark:text-slate-400">{packageJson.version}</span>
              </div>
            </div>
            
            <p className="px-4 py-4 text-xs text-gray-400 dark:text-slate-500 text-center">
              Made with ⛳ for golfers who like to have fun
            </p>
          </div>
        </div>

        {/* Course Search Modal */}
        {showCourseSearch && (
          <div className="absolute inset-0 bg-white dark:bg-slate-900 z-10 flex flex-col">
            <div className="bg-primary-700 text-white px-4 py-4 flex items-center gap-3 pt-safe">
              <button
                onClick={() => setShowCourseSearch(false)}
                className="p-2 -ml-2 rounded-lg hover:bg-white/10"
                aria-label="Back"
                title="Back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-lg font-bold">Set Home Course</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CourseSearch
                selectedCourseId={currentProfile.preferences?.homeCourseId || ''}
                onSelect={handleSetHomeCourse}
              />
            </div>
          </div>
        )}

        {/* Status Levels Info Modal */}
      {showStatusLevels && (
        <StatusLevelsInfo 
          onClose={() => setShowStatusLevels(false)}
          currentLevel={getStatusDisplay(currentProfile).tier.level}
        />
      )}
      </div>
    </div>,
    document.body
  );
};

export default SettingsPanel;
