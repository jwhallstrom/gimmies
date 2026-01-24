import useStore from '../state/store';
import type { Event, GolferProfile, Group } from '../state/types';

/**
 * Event groups adapter (event-level groups).
 *
 * Backed by Zustand today; can be reimplemented against BE/services later.
 */
export function useEventGroupsAdapter(eventId: string) {
  const event = useStore((s) => s.events.find((e) => e.id === eventId) as Event | undefined);
  const profiles = useStore((s) => s.profiles) as GolferProfile[];
  const currentProfile = useStore((s) => s.currentProfile) as GolferProfile | null;
  const setGroupTeeTime = useStore((s) => s.setGroupTeeTime) as (eventId: string, groupId: string, teeTime: string) => void;
  const assignGolferToGroup = useStore((s) => s.assignGolferToGroup) as (eventId: string, groupId: string, golferId: string) => void;
  const removeGolferFromEvent = useStore((s) => s.removeGolferFromEvent) as (eventId: string, golferId: string) => Promise<void>;
  const addGroup = useStore((s) => s.addGroup) as (eventId: string) => void;
  const removeGroup = useStore((s) => s.removeGroup) as (eventId: string, groupId: string) => void;

  const groups: Group[] = event?.groups || [];
  const golfers = event?.golfers || [];

  return {
    event,
    profiles,
    currentProfile,
    groups,
    golfers,
    setGroupTeeTime: (groupId: string, teeTime: string) => setGroupTeeTime(eventId, groupId, teeTime),
    assignGolferToGroup: (groupId: string, golferId: string) => assignGolferToGroup(eventId, groupId, golferId),
    removeGolferFromEvent: (golferId: string) => removeGolferFromEvent(eventId, golferId),
    addGroup: () => addGroup(eventId),
    removeGroup: (groupId: string) => removeGroup(eventId, groupId),
  };
}

