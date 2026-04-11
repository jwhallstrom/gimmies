/**
 * Per-event sync guard that prevents realtime subscription echoes
 * from overwriting optimistic local updates while a save is in flight.
 *
 * Usage:
 *   const guard = getEventSyncGuard(eventId);
 *   guard.markSaving();        // before cloud save starts
 *   guard.markSaved();         // after cloud save completes (starts cooldown)
 *   guard.isSaving()           // true while save is in progress
 *   guard.isInCooldown()       // true during post-save echo window
 */

const COOLDOWN_MS = 3000;

interface SyncGuard {
  saving: boolean;
  cooldownUntil: number;
}

const guards = new Map<string, SyncGuard>();

function ensureGuard(eventId: string): SyncGuard {
  let guard = guards.get(eventId);
  if (!guard) {
    guard = { saving: false, cooldownUntil: 0 };
    guards.set(eventId, guard);
  }
  return guard;
}

export function getEventSyncGuard(eventId: string) {
  const guard = ensureGuard(eventId);

  return {
    markSaving() {
      guard.saving = true;
    },
    markSaved() {
      guard.saving = false;
      guard.cooldownUntil = Date.now() + COOLDOWN_MS;
    },
    markFailed() {
      guard.saving = false;
      // No cooldown on failure — accept realtime updates immediately
    },
    isSaving() {
      return guard.saving;
    },
    isInCooldown() {
      return Date.now() < guard.cooldownUntil;
    },
  };
}

export function clearEventSyncGuard(eventId: string) {
  guards.delete(eventId);
}
