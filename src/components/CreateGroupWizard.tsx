import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { generateFunnyEventName } from '../utils/nameGenerator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Minimal group creator.
 * Groups are chat hubs (not playable rounds).
 */
export const CreateGroupWizard: React.FC<Props> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const createEvent = useStore((s) => s.createEvent);
  const updateEvent = useStore((s) => s.updateEvent);

  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(generateFunnyEventName());
    setIsCreating(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const id = createEvent({ hubType: 'group' } as any);
      if (!id) throw new Error('Failed to create group');
      await updateEvent(id, { name: name.trim() } as any);
      onClose();
      navigate(`/event/${id}/chat`);
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="bg-purple-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-lg font-bold">New Group</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div className="text-sm text-gray-600">
            A group is just a chat crew. You can create events from it later.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g. Saturday Crew"
              autoFocus
            />
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
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

