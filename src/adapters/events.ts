import useStore from '../state/store';
import type { Event, GolferProfile, User } from '../state/types';

export interface JoinEventResult {
  success: boolean;
  error?: string;
  eventId?: string;
}

/**
 * Events adapter.
 *
 * Today this is backed by the Zustand store.
 * Tomorrow it can be swapped to a service/hooks layer without touching UI components.
 */
export function useEventsAdapter() {
  const events = useStore((s) => s.events) as Event[];
  const currentProfile = useStore((s) => s.currentProfile) as GolferProfile | null;
  const currentUser = useStore((s) => s.currentUser) as User | null;
  const profiles = useStore((s) => s.profiles) as GolferProfile[];

  const setCurrentProfile = useStore((s) => s.setCurrentProfile) as (profileId: string) => void;
  const joinEventByCode = useStore((s) => s.joinEventByCode) as (code: string) => Promise<JoinEventResult>;
  const deleteEvent = useStore((s) => s.deleteEvent) as (eventId: string) => Promise<void>;
  const createProfile = useStore((s) => s.createProfile) as (name: string) => void;
  const cleanupDuplicateProfiles = useStore((s) => s.cleanupDuplicateProfiles) as () => void;
  const loadEventsFromCloud = useStore((s) => s.loadEventsFromCloud) as () => Promise<void>;

  const userEvents: Event[] = currentProfile
    ? events.filter((event) => event.golfers.some((g) => g.profileId === currentProfile.id))
    : [];

  return {
    // state
    events,
    userEvents,
    currentUser,
    currentProfile,
    profiles,

    // actions
    setCurrentProfile,
    joinEventByCode,
    deleteEvent,
    createProfile,
    cleanupDuplicateProfiles,
    loadEventsFromCloud,
  };
}

