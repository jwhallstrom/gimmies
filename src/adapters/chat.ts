import { useMemo } from 'react';
import useStore from '../state/store';
import type { ChatMessage, Event, GolferProfile } from '../state/types';

/**
 * Event chat adapter (event-level chat).
 *
 * Backed by Zustand today; can be reimplemented against BE/services later.
 */
export function useEventChatAdapter(eventId: string) {
  const event = useStore(
    (s) => (s.events.find((e) => e.id === eventId) || s.completedEvents.find((e) => e.id === eventId)) as
      | Event
      | undefined
  );
  const currentProfile = useStore((s) => s.currentProfile) as GolferProfile | null;
  const profiles = useStore((s) => s.profiles) as GolferProfile[];

  const addChatMessage = useStore((s) => s.addChatMessage) as (eventId: string, text: string) => Promise<void>;
  const clearChat = useStore((s) => s.clearChat) as (eventId: string) => void;

  const messages: ChatMessage[] = event?.chat || [];

  const profilesById = useMemo(() => {
    const map = new Map<string, GolferProfile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  return {
    event,
    currentProfile,
    messages,
    profilesById,
    send: (text: string) => addChatMessage(eventId, text),
    clear: () => clearChat(eventId),
  };
}

