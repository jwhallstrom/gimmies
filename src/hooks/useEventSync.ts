/**
 * Hook to auto-refresh event from cloud
 * Use on event detail pages to keep data in sync
 */

import { useEffect, useRef } from 'react';
import useStore from '../state/store';

export function useEventSync(eventId: string | undefined, intervalMs: number = 15000) {
  const { refreshEventFromCloud } = useStore();
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    if (!eventId) return;

    console.log('🔄 useEventSync: Setting up auto-refresh for event:', eventId);

    // Delay initial refresh to allow any pending updates to complete
    // Increased to 10 seconds to give cloud sync more time
    const initialRefreshDelay = 10000; // 10 seconds (was 5)
    
    const initialRefreshTimeout = setTimeout(async () => {
      const now = Date.now();
      console.log('🔄 useEventSync: Initial refresh (delayed 10s)');
      lastRefreshRef.current = now;
      await refreshEventFromCloud(eventId);
    }, initialRefreshDelay);

    // Set up periodic refresh
    const interval = setInterval(async () => {
      const now = Date.now();
      console.log('🔄 useEventSync: Periodic refresh');
      lastRefreshRef.current = now;
      await refreshEventFromCloud(eventId);
    }, intervalMs);

    return () => {
      clearTimeout(initialRefreshTimeout);
      clearInterval(interval);
    };
  }, [eventId, intervalMs, refreshEventFromCloud]);
}
