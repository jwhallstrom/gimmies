/**
 * SettingsPanel - Unified Settings Experience
 * 
 * A clean, organized settings panel inspired by iOS Settings:
 * - Profile hero with quick edit
 * - Organized sections with clear hierarchy
 * - Quick links to key app areas
 * - All preferences in one place
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { useAuthMode } from '../hooks/useAuthMode';
import { fileToAvatarDataUrl } from '../utils/avatarImage';
import { CourseSearch } from './CourseSearch';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { currentUser, currentProfile, updateProfile, logout, wallet, events } = useStore();
  const { isGuest } = useAuthMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit mode for profile
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandicap, setEditHandicap] = useState('');
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset edit fields when profile changes or panel opens
  useEffect(() => {
    if (currentProfile && isOpen) {
      setEditName(currentProfile.name || '');
      setEditHandicap(currentProfile.handicapIndex?.toString() || '');
    }
  }, [currentProfile?.id, isOpen]);

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
        
        // Save to cloud
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
      
      // Save to cloud
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
      
      setEditMode(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePreference = (key: string, value: any) => {
    if (currentProfile) {
      updateProfile(currentProfile.id, {
        preferences: { ...currentProfile.preferences, [key]: value }
      });
    }
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
  const roundCount = currentProfile?.stats?.roundsPlayed ?? 0;
  const netBalance = (wallet?.lifetimeNet ?? 0) / 100;
  const homeCourse = currentProfile?.preferences?.homeCourseName || 
    (currentProfile?.preferences as any)?.homeCourse || null;
  const profileName = currentProfile?.name || 'Golfer';
  const profileAvatar = currentProfile?.avatar || null;
  const handicapIndex = currentProfile?.handicapIndex;
  const username = currentUser?.username || '';

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="absolute right-0 top-0 bottom-0 w-full sm:max-w-md bg-gray-50 shadow-2xl flex flex-col overflow-hidden animate-slide-in-right z-[10000]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-primary-700 text-white px-4 py-4 flex items-center justify-between flex-shrink-0 pt-safe">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-safe relative bg-gray-50">
          {/* Profile Hero */}
          <div className="bg-white p-5 border-b border-gray-200 relative">
            {!editMode ? (
              <div className="flex items-center gap-4">
                {/* Avatar */}
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
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-900 truncate">{profileName}</h3>
                  <p className="text-sm text-gray-500 truncate">{username}</p>
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
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            ) : (
              /* Edit Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Edit Profile</h4>
                  <button
                    onClick={() => setEditMode(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Handicap Index</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editHandicap}
                      onChange={e => setEditHandicap(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
          <div className="bg-white px-4 py-3 border-b border-gray-200">
            <div className="grid grid-cols-4 gap-2 text-center">
              <button onClick={() => { onClose(); navigate('/handicap'); }} className="p-2 rounded-xl hover:bg-gray-50">
                <div className="text-lg font-bold text-gray-900">{roundCount}</div>
                <div className="text-[10px] text-gray-500 font-medium">Rounds</div>
              </button>
              <button onClick={() => { onClose(); navigate('/'); }} className="p-2 rounded-xl hover:bg-gray-50">
                <div className="text-lg font-bold text-gray-900">{groupCount}</div>
                <div className="text-[10px] text-gray-500 font-medium">Groups</div>
              </button>
              <button onClick={() => { onClose(); navigate('/events'); }} className="p-2 rounded-xl hover:bg-gray-50">
                <div className="text-lg font-bold text-gray-900">{eventCount}</div>
                <div className="text-[10px] text-gray-500 font-medium">Events</div>
              </button>
              <button onClick={() => { onClose(); navigate('/wallet'); }} className="p-2 rounded-xl hover:bg-gray-50">
                <div className={`text-lg font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(netBalance).toFixed(0)}
                </div>
                <div className="text-[10px] text-gray-500 font-medium">Net</div>
              </button>
            </div>
          </div>

          {/* Golf Settings */}
          <div className="mt-4">
            <div className="px-4 py-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Golf Settings</h3>
            </div>
            <div className="bg-white border-y border-gray-200 divide-y divide-gray-100">
              {/* Home Course */}
              <button
                onClick={() => setShowCourseSearch(true)}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">⛳</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Home Course</div>
                    <div className="text-xs text-gray-500">{homeCourse || 'Not set'}</div>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preferences</h3>
            </div>
            <div className="bg-white border-y border-gray-200 divide-y divide-gray-100">
              {/* Theme */}
              <div className="px-4 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🎨</span>
                    <span className="text-sm font-medium text-gray-900">Theme</span>
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
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  <span className="text-sm font-medium text-gray-900">Scoring</span>
                </div>
                
                <label className="flex items-center justify-between ml-9 cursor-pointer">
                  <span className="text-sm text-gray-700">Default to net scoring</span>
                  <input
                    type="checkbox"
                    checked={currentProfile.preferences?.defaultNetScoring || false}
                    onChange={e => handleUpdatePreference('defaultNetScoring', e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                </label>
                
                <label className="flex items-center justify-between ml-9 cursor-pointer">
                  <span className="text-sm text-gray-700">Auto-advance to next hole</span>
                  <input
                    type="checkbox"
                    checked={currentProfile.preferences?.autoAdvanceScores || false}
                    onChange={e => handleUpdatePreference('autoAdvanceScores', e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                </label>
                
                <label className="flex items-center justify-between ml-9 cursor-pointer">
                  <span className="text-sm text-gray-700">Show handicap strokes</span>
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
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account</h3>
            </div>
            <div className="bg-white border-y border-gray-200 divide-y divide-gray-100">
              {/* Email */}
              <div className="px-4 py-3.5 flex items-center gap-3">
                <span className="text-xl">📧</span>
                <div>
                  <div className="text-sm font-medium text-gray-900">Email</div>
                  <div className="text-xs text-gray-500">{currentUser?.username || 'Not set'}</div>
                </div>
              </div>

              {/* Tournaments */}
              <button
                onClick={() => { onClose(); navigate('/tournaments'); }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏆</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Tournaments</div>
                    <div className="text-xs text-gray-500">Manage & join tournaments</div>
                  </div>
                </div>
                <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">BETA</span>
              </button>
              
              {/* Club Dashboard */}
              <button
                onClick={() => { onClose(); navigate('/club'); }}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏌️</span>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">Club Dashboard</div>
                    <div className="text-xs text-gray-500">For courses & organizations</div>
                  </div>
                </div>
                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">NEW</span>
              </button>

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
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">About</h3>
            </div>
            <div className="bg-white border-y border-gray-200 divide-y divide-gray-100">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📱</span>
                  <span className="text-sm font-medium text-gray-900">Version</span>
                </div>
                <span className="text-sm text-gray-500">0.1.0</span>
              </div>
            </div>
            
            <p className="px-4 py-4 text-xs text-gray-400 text-center">
              Made with ⛳ for golfers who like to have fun
            </p>
          </div>
        </div>

        {/* Course Search Modal */}
        {showCourseSearch && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col">
            <div className="bg-primary-700 text-white px-4 py-4 flex items-center gap-3 pt-safe">
              <button
                onClick={() => setShowCourseSearch(false)}
                className="p-2 -ml-2 rounded-lg hover:bg-white/10"
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
      </div>
    </div>,
    document.body
  );
};

export default SettingsPanel;
