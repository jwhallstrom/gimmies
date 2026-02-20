import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { generateFunnyEventName } from '../utils/nameGenerator';
import { useAuthMode } from '../hooks/useAuthMode';
import { SignInRequired } from './SignInRequired';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (groupId: string) => void;
}

/**
 * Minimal group creator.
 * Groups are chat hubs (not playable rounds).
 */
export const CreateGroupWizard: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const navigate = useNavigate();
  const createEvent = useStore((s) => s.createEvent);
  const updateEvent = useStore((s) => s.updateEvent);
  const { isGuest } = useAuthMode();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const AVATAR_PRESETS = ['⛳', '🏌️', '🏆', '🍺', '🦅', '🐦', '🎯', '🔥', '👑', '☠️', '🎲', '💰'];

  useEffect(() => {
    if (!isOpen) return;
    setName(generateFunnyEventName());
    setDescription('');
    setAvatar('');
    setIsCreating(false);
  }, [isOpen]);

  if (!isOpen) return null;

  if (isGuest) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
          <div className="bg-purple-600 p-4 text-white flex justify-between items-center">
            <h2 className="text-lg font-bold">New Group</h2>
            <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5">
            <SignInRequired
              title="🔒 Sign in to create groups"
              message="Groups are shared chat hubs and require an account. Sign in to create or join groups."
              onAction={onClose}
            />
          </div>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const id = createEvent({ hubType: 'group' } as any);
      if (!id) throw new Error('Failed to create group');
      const groupSettings: any = {
        visibility: 'private',
        joinPolicy: 'open',
        membersCanInvite: true,
      };
      if (description.trim()) groupSettings.description = description.trim();
      if (avatar) groupSettings.avatar = avatar;
      await updateEvent(id, { name: name.trim(), groupSettings } as any);
      onClose();
      if (onCreated) {
        onCreated(id);
      } else {
        navigate(`/event/${id}`);
      }
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white text-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
        style={{ colorScheme: 'light' }}
      >
        <div className="bg-purple-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">New Group</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 text-gray-900">
          <div className="text-sm text-gray-600">
            A group is your golf crew's home base. Chat, schedule events, and talk trash.
          </div>

          {/* Avatar picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group icon</label>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatar(avatar === emoji ? '' : emoji)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl border-2 transition-all active:scale-95 ${
                    avatar === emoji
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g. Saturday Crew"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tagline <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white text-gray-900 placeholder:text-gray-400 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g. No mulligans. No mercy."
              maxLength={100}
            />
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end text-gray-900">
          <button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-60"
          >
            {isCreating ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};

