/**
 * TournamentSettingsTab - Organizer-only tournament settings
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../../state/store';
import { CourseSearch } from '../../CourseSearch';
import { useCourses } from '../../../hooks/useCourses';
import type { TournamentFormat, TournamentVisibility, TournamentStatus } from '../../../state/types';

interface Props {
  tournamentId: string;
}

const formatLabels: Record<TournamentFormat, string> = {
  stroke: 'Stroke Play',
  stableford: 'Stableford',
  scramble: 'Scramble',
  best_ball: 'Best Ball',
  match_play: 'Match Play',
  skins: 'Skins',
};

const TournamentSettingsTab: React.FC<Props> = ({ tournamentId }) => {
  const navigate = useNavigate();
  const tournament = useStore(s => s.tournaments.find(t => t.id === tournamentId));
  const { updateTournament, deleteTournament, cancelTournament, completeTournament } = useStore();
  const { courses } = useCourses();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCourseSearch, setShowCourseSearch] = useState(false);
  
  if (!tournament) return null;
  
  const selectedCourse = tournament.courseId ? courses.find(c => c.courseId === tournament.courseId) : null;
  const tees = selectedCourse?.tees || [];
  
  const canEdit = tournament.status === 'draft' || tournament.status === 'registration_open';
  
  const handleNameChange = (name: string) => {
    updateTournament(tournamentId, { name });
  };
  
  const handleDescriptionChange = (description: string) => {
    updateTournament(tournamentId, { description });
  };
  
  const handleRulesChange = (rules: string) => {
    updateTournament(tournamentId, { rules });
  };
  
  const handleMaxPlayersChange = (maxPlayers: number) => {
    updateTournament(tournamentId, { maxPlayers });
  };
  
  const handleEntryFeeChange = (fee: string) => {
    const cents = Math.round(parseFloat(fee || '0') * 100);
    updateTournament(tournamentId, { entryFeeCents: cents });
  };
  
  const handleFormatChange = (format: TournamentFormat) => {
    updateTournament(tournamentId, { format });
  };
  
  const handleVisibilityChange = (visibility: TournamentVisibility) => {
    updateTournament(tournamentId, { visibility });
  };
  
  const handleCourseSelect = (courseId: string, courseName: string) => {
    updateTournament(tournamentId, { courseId, courseName });
    setShowCourseSearch(false);
  };
  
  const handleTeeSelect = (teeName: string) => {
    // Update tee name in rounds data
    const updatedRoundsData = tournament.roundsData.map(r => ({ ...r, teeName }));
    updateTournament(tournamentId, { roundsData: updatedRoundsData });
  };
  
  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel this tournament? Registered players will be notified.')) {
      cancelTournament(tournamentId);
    }
  };
  
  const handleComplete = () => {
    if (confirm('Mark this tournament as complete? This will finalize all standings.')) {
      completeTournament(tournamentId);
    }
  };
  
  const handleDelete = () => {
    deleteTournament(tournamentId);
    navigate('/tournaments');
  };
  
  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {tournament.status === 'cancelled' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          This tournament has been cancelled.
        </div>
      )}
      
      {tournament.status === 'completed' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-700">
          This tournament is complete. Settings are locked.
        </div>
      )}
      
      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Basic Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tournament Name</label>
          <input
            type="text"
            value={tournament.name}
            onChange={e => handleNameChange(e.target.value)}
            disabled={!canEdit}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={tournament.description || ''}
            onChange={e => handleDescriptionChange(e.target.value)}
            disabled={!canEdit}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 resize-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rules / Notes</label>
          <textarea
            value={tournament.rules || ''}
            onChange={e => handleRulesChange(e.target.value)}
            disabled={!canEdit}
            rows={3}
            placeholder="Add any special rules or notes for participants..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 resize-none"
          />
        </div>
      </div>
      
      {/* Course & Format */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Course & Format</h3>
        
        {/* Course Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
          {showCourseSearch ? (
            <div className="space-y-2">
              <CourseSearch
                selectedCourseId={tournament.courseId || ''}
                onSelect={handleCourseSelect}
              />
              <button
                onClick={() => setShowCourseSearch(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => canEdit && setShowCourseSearch(true)}
              disabled={!canEdit}
              className="w-full text-left px-3 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {tournament.courseName || 'Select a course...'}
            </button>
          )}
        </div>
        
        {/* Tee Selection */}
        {tournament.courseId && tees.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tee</label>
            <div className="grid grid-cols-2 gap-2">
              {tees.map((tee: any) => (
                <button
                  key={tee.name}
                  onClick={() => canEdit && handleTeeSelect(tee.name)}
                  disabled={!canEdit}
                  className={`p-2 rounded-lg border text-left text-sm transition-colors ${
                    tournament.roundsData[0]?.teeName === tee.name
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="font-medium">{tee.name}</div>
                  <div className="text-xs text-gray-500">
                    {tee.courseRating || tee.rating}/{tee.slopeRating || tee.slope}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
          <select
            value={tournament.format}
            onChange={e => handleFormatChange(e.target.value as TournamentFormat)}
            disabled={!canEdit}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
          >
            {Object.entries(formatLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Registration Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Registration</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Players</label>
            <input
              type="number"
              value={tournament.maxPlayers}
              onChange={e => handleMaxPlayersChange(parseInt(e.target.value, 10) || 72)}
              disabled={!canEdit}
              min="4"
              max="200"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entry Fee ($)</label>
            <input
              type="number"
              value={(tournament.entryFeeCents / 100).toFixed(0)}
              onChange={e => handleEntryFeeChange(e.target.value)}
              disabled={!canEdit}
              min="0"
              step="5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
          <select
            value={tournament.visibility}
            onChange={e => handleVisibilityChange(e.target.value as TournamentVisibility)}
            disabled={!canEdit}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100"
          >
            <option value="public">Public - Anyone can find and join</option>
            <option value="private">Private - Invite only, hidden from discover</option>
            <option value="invite_only">Invite with Code - Requires passcode</option>
          </select>
        </div>
        
        {tournament.visibility === 'invite_only' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passcode</label>
            <input
              type="text"
              value={tournament.passcode || ''}
              onChange={e => updateTournament(tournamentId, { passcode: e.target.value.toUpperCase() })}
              disabled={!canEdit}
              placeholder="e.g. SPRING2026"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 uppercase"
            />
          </div>
        )}
      </div>
      
      {/* Status Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Tournament Status</h3>
        
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-600">Current Status:</span>
          <span className={`text-sm font-semibold px-2 py-0.5 rounded ${
            tournament.status === 'draft' ? 'bg-gray-100 text-gray-700' :
            tournament.status === 'registration_open' ? 'bg-green-100 text-green-700' :
            tournament.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
            tournament.status === 'completed' ? 'bg-gray-100 text-gray-600' :
            'bg-red-100 text-red-700'
          }`}>
            {tournament.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        
        <div className="space-y-2">
          {tournament.status === 'in_progress' && (
            <button
              onClick={handleComplete}
              className="w-full py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Complete Tournament
            </button>
          )}
          
          {(tournament.status === 'registration_open' || tournament.status === 'in_progress') && (
            <button
              onClick={handleCancel}
              className="w-full py-2 bg-orange-100 text-orange-700 font-semibold rounded-lg hover:bg-orange-200 transition-colors"
            >
              Cancel Tournament
            </button>
          )}
        </div>
      </div>
      
      {/* Danger Zone */}
      <div className="bg-red-50 rounded-xl border border-red-200 p-4 space-y-4">
        <h3 className="font-semibold text-red-800">Danger Zone</h3>
        <p className="text-sm text-red-600">
          Deleting a tournament is permanent and cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          Delete Tournament
        </button>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Tournament?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete "{tournament.name}" and all associated data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-gray-700 font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentSettingsTab;
