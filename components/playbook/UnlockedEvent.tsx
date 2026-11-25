'use client';

import { useEffect, useRef } from 'react';
import { trackPlaybook } from '@/lib/playbook/analytics';

/**
 * Fires playbook_unlocked.
 *
 * The unlock itself is a redirect from a route handler, where no script of
 * ours runs, so the event fires on the page the reader lands on instead. The
 * route adds ?unlocked=1 to say this hop was a fresh sign-in rather than a
 * reader simply visiting their dashboard.
 */
export default function UnlockedEvent() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackPlaybook('playbook_unlocked', { signedIn: true });
  }, []);

  return null;
}
