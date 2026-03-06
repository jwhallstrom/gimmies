/**
 * Hook to keep an active event/group page in sync with cloud updates.
 * Uses realtime subscriptions while the page is open and one initial refresh
 * as a safety net on mount.
 */

import { useEffect } from 'react';
import useStore from '../state/store';
import type { ChatMessage, Event } from '../state/types';
import { subscribeToEventRealtime } from '../utils/eventSync';

function applyRealtimeEvent(eventId: string, incomingEvent: Event) {
  useStore.setState((state: any) => {
    const existing =
      state.events.find((event: Event) => event.id === eventId) ||
      state.completedEvents.find((event: Event) => event.id === eventId);

    const mergedEvent: Event = {
      ...(existing || {}),
      ...incomingEvent,
      // Event realtime snapshots do not carry chat; preserve the current thread.
      chat: existing?.chat || [],
    } as Event;

    const nextActive = state.events.filter((event: Event) => event.id !== eventId);
    const nextCompleted = state.completedEvents.filter((event: Event) => event.id !== eventId);

    if (mergedEvent.isCompleted) {
      return {
        events: nextActive,
        completedEvents: [...nextCompleted, mergedEvent],
      };
    }

    return {
      events: [...nextActive, mergedEvent],
      completedEvents: nextCompleted,
    };
  });
}

function applyRealtimeChat(eventId: string, messages: ChatMessage[]) {
  useStore.setState((state: any) => ({
    events: state.events.map((event: Event) =>
      event.id === eventId ? { ...event, chat: messages } : event
    ),
    completedEvents: state.completedEvents.map((event: Event) =>
      event.id === eventId ? { ...event, chat: messages } : event
    ),
  }));
}

export function useEventSync(eventId: string | undefined) {
  const refreshEventFromCloud = useStore((state: any) => state.refreshEventFromCloud) as (eventId: string) => Promise<boolean>;

  useEffect(() => {
    if (!eventId) return;

    console.log('[EventSync] Starting realtime sync for event:', eventId);
    void refreshEventFromCloud(eventId);

    const unsubscribe = subscribeToEventRealtime(eventId, {
      onEvent: (incomingEvent) => {
        applyRealtimeEvent(eventId, incomingEvent);
      },
      onChat: (messages) => {
        applyRealtimeChat(eventId, messages);
      },
      onError: (scope, error) => {
        console.error(`[EventSync] realtime ${scope} subscription failed for ${eventId}:`, error);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [eventId, refreshEventFromCloud]);
}
