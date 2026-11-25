'use client';

import { useEffect, useRef } from 'react';

/** How often a page reads again while something on it is going (a run, a dispatch GitHub hasn't listed yet). */
export const WHILE_GOING_MS = 15_000;

/**
 * Calls `load` every `ms` while `going`. Skips the ticks while the tab is hidden, and loads once as soon
 * as it's shown again, so a run that ended meanwhile shows at once. Stops when nothing is going.
 */
export function useWhileGoing(going: boolean, load: () => unknown, ms = WHILE_GOING_MS) {
  const latest = useRef(load);
  useEffect(() => {
    latest.current = load;
  }, [load]);
  useEffect(() => {
    if (!going) return;
    const tick = () => {
      if (document.visibilityState === 'visible') void latest.current();
    };
    const id = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [going, ms]);
}
