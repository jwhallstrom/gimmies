/**
 * Hook to keep an active event/group page in sync with cloud updates.
 * Uses realtime subscriptions while the page is open and one initial refresh
 * as a safety net on mount.
 *
 * Protections against the "score vanish" race condition:
 * 1. In-flight save guard — skip realtime overwrites while a local save is uploading
 * 2. Per-hole scorecard merge — never wholesale-replace scorecards; merge hole-by-hole
 * 3. Cooldown after save — ignore echoes for a short window after our own save lands
 */

import { useEffect } from 'react';
import useStore from '../state/store';
import type { ChatMessage, Event, PlayerScorecard } from '../state/types';
import { subscribeToEventRealtime } from '../utils/eventSync';
import { getEventSyncGuard } from '../utils/eventSyncGuard';

/**
 * Merge two scorecard arrays hole-by-hole.
 * For each golfer, pick the richer score: prefer non-null over null,
 * and if both are non-null, prefer local (optimistic) during save windows.
 */
function mergeScorecards(
  localCards: PlayerScorecard[],
  cloudCards: PlayerScorecard[],
  preferLocal: boolean
): PlayerScorecard[] {
  const cloudMap = new Map<string, PlayerScorecard>();
  for (const sc of cloudCards) cloudMap.set(sc.golferId, sc);

  const localMap = new Map<string, PlayerScorecard>();
  for (const sc of localCards) localMap.set(sc.golferId, sc);

  const mergedIds = new Set([...localMap.keys(), ...cloudMap.keys()]);
  const result: PlayerScorecard[] = [];

  for (const golferId of mergedIds) {
    const local = localMap.get(golferId);
    const cloud = cloudMap.get(golferId);

    if (!cloud) {
      if (local) result.push(local);
      continue;
    }
    if (!local) {
      result.push(cloud);
      continue;
    }

    const mergedScores = local.scores.map((localScore) => {
      const cloudScore = cloud.scores.find((s) => s.hole === localScore.hole);
      if (!cloudScore) return localScore;

      if (localScore.strokes != null && cloudScore.strokes == null) {
        return localScore;
      }
      if (localScore.strokes == null && cloudScore.strokes != null) {
        return cloudScore;
      }
      // Both non-null or both null — prefer local during active saves, cloud otherwise
      return preferLocal ? localScore : cloudScore;
    });

    // Include any cloud holes not present locally (e.g. 9-hole vs 18-hole mismatch)
    for (const cloudScore of cloud.scores) {
      if (!mergedScores.find((s) => s.hole === cloudScore.hole)) {
        mergedScores.push(cloudScore);
      }
    }

    result.push({ ...local, scores: mergedScores });
  }

  return result;
}

function applyRealtimeEvent(eventId: string, incomingEvent: Event) {
  const guard = getEventSyncGuard(eventId);

  // Hard guard: if a save is literally in flight, skip entirely.
  // The save callback will push the authoritative state when it completes.
  if (guard.isSaving()) {
    console.log('[EventSync] Skipping realtime update — save in flight for', eventId);
    return;
  }

  // Soft guard: if we just finished a save, the subscription echo is stale.
  if (guard.isInCooldown()) {
    console.log('[EventSync] Skipping realtime echo — cooldown active for', eventId);
    return;
  }

  useStore.setState((state: any) => {
    const existing =
      state.events.find((event: Event) => event.id === eventId) ||
      state.completedEvents.find((event: Event) => event.id === eventId);

    if (!existing) {
      // Brand new event — just accept as-is
      const fresh = { ...incomingEvent, chat: [] } as Event;
      return { events: [...state.events, fresh] };
    }

    // Smart merge: preserve local chat, merge scorecards per-hole
    const mergedScorecards = mergeScorecards(
      existing.scorecards || [],
      incomingEvent.scorecards || [],
      false // prefer cloud data when no save is active
    );

    const mergedEvent: Event = {
      ...existing,
      ...incomingEvent,
      scorecards: mergedScorecards,
      chat: existing.chat || [],
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
        try {
          applyRealtimeEvent(eventId, incomingEvent);
        } catch (err) {
          console.error('[EventSync] Error applying realtime event update:', err);
        }
      },
      onChat: (messages) => {
        try {
          applyRealtimeChat(eventId, messages);
        } catch (err) {
          console.error('[EventSync] Error applying realtime chat update:', err);
        }
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
