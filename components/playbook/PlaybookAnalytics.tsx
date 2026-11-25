'use client';

import { useEffect, useRef } from 'react';
import { trackPlaybook, type PlaybookContext } from '@/lib/playbook/analytics';
import { useSignedIn } from '@/lib/playbook/use-signed-in';

/**
 * Fires the view event for a playbook page, and the scroll-depth events on a
 * chapter.
 *
 * Depth is reported once per threshold per page view, and only ever forwards -
 * scrolling up and down a chapter should not report 50% four times.
 *
 * It renders nothing. Everything it measures is measurable without it, so a
 * reader with analytics blocked loses no function at all.
 */

const DEPTHS = [25, 50, 75, 100] as const;

export default function PlaybookAnalytics({
  view,
  context,
  properties,
  trackScroll,
}: {
  view: 'playbook_hub_viewed' | 'chapter_viewed' | 'progress_page_viewed';
  context: PlaybookContext;
  properties?: Record<string, unknown>;
  trackScroll?: boolean;
}) {
  // Ref rather than state: the view event fires once per mount and nothing
  // should re-render because of it.
  const fired = useRef(false);
  const reached = useRef<Set<number>>(new Set());
  const signedIn = useSignedIn();

  useEffect(() => {
    // Wait for the cookie to be read, so signed_in is right on the very first
    // event of a page view rather than defaulting to false.
    if (fired.current || signedIn === null) return;
    fired.current = true;
    trackPlaybook(view, { ...context, signedIn }, properties);
    // The context object is rebuilt each render by the server component that
    // owns it, so it cannot be a dependency without firing on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(() => {
    if (!trackScroll) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const percent = Math.min(100, Math.round((window.scrollY / scrollable) * 100));

      for (const depth of DEPTHS) {
        if (percent >= depth && !reached.current.has(depth)) {
          reached.current.add(depth);
          trackPlaybook('chapter_scrolled', { ...context, signedIn: signedIn === true }, {
            ...properties,
            depth,
          });
        }
      }
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    measure();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackScroll, signedIn]);

  return null;
}
