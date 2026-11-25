'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackPlaybook } from '@/lib/playbook/analytics';
import { useSignedIn } from '@/lib/playbook/use-signed-in';
import {
  alreadyMerged,
  markMerged,
  readLocalChecklists,
  readLocalProgress,
  recordLocalProgress,
} from '@/lib/playbook/local-progress';

/**
 * Tracks how far through a chapter the reader is, and marks it read. It
 * renders nothing: there is no button, reading is what counts.
 *
 * A chapter counts as read at 85% scroll. 85% rather than 100% because the
 * last stretch of a chapter is the end card and the pager - a reader who has
 * reached those has read it, and almost nobody scrolls to the literal end.
 *
 * Signed out, everything goes to localStorage. Signed in, it also goes to the
 * account, debounced, so a scroll does not turn into a write per frame. The
 * local copy is written either way: it costs nothing and it means a reader who
 * signs out has not lost their place.
 *
 * It also performs the merge. The browser's stored progress can only be read
 * by the browser, so the fold into the account has to happen client-side, once,
 * the first time a session is present.
 */

const READ_AT = 0.85;
const SAVE_DEBOUNCE_MS = 4000;

export default function ProgressTracker({
  chapterSlug,
  part,
}: {
  chapterSlug: string;
  part: string;
}) {
  const signedIn = useSignedIn() === true;
  const [read, setRead] = useState(false);
  const furthest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (status: 'reading' | 'read', percent: number) => {
      recordLocalProgress(chapterSlug, status, percent);
      if (!signedIn) return;
      void fetch('/api/playbook/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chapterSlug, status, percent }),
        keepalive: true,
      }).catch(() => {
        // The local copy is already written; a failed sync is not worth
        // interrupting a reader over.
      });
    },
    [chapterSlug, signedIn],
  );

  // Merge the browser's copy into the account, once per browser.
  useEffect(() => {
    if (!signedIn || alreadyMerged()) return;
    const progress = readLocalProgress();
    const checklists = readLocalChecklists();
    if (Object.keys(progress).length === 0 && Object.keys(checklists).length === 0) {
      markMerged();
      return;
    }
    void fetch('/api/playbook/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ progress, checklists }),
    })
      .then((response) => {
        // Only mark it done on success, so a failed merge is retried on the
        // next chapter rather than silently dropping what the reader did.
        if (response.ok) markMerged();
      })
      .catch(() => {});
  }, [signedIn]);

  // Where the reader already was, so an opened chapter does not read as 0%.
  useEffect(() => {
    const existing = readLocalProgress()[chapterSlug];
    if (existing) {
      furthest.current = existing.percent;
      if (existing.status === 'read') setRead(true);
    }
  }, [chapterSlug]);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const ratio = window.scrollY / scrollable;
      const percent = Math.round(Math.min(1, ratio) * 100);
      if (percent <= furthest.current) return;
      furthest.current = percent;

      if (ratio >= READ_AT && !read) {
        setRead(true);
        save('read', percent);
        trackPlaybook('chapter_completed', { chapterSlug, part, signedIn }, { via: 'scroll' });
        return;
      }

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save('reading', furthest.current), SAVE_DEBOUNCE_MS);
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    // A reader who closes the tab mid-chapter should still keep their place.
    const onHide = () => {
      if (document.visibilityState === 'hidden' && furthest.current > 0 && !read) {
        save('reading', furthest.current);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onHide);
    measure();

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onHide);
      if (frame) window.cancelAnimationFrame(frame);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [read, save, chapterSlug, part, signedIn]);

  return null;
}
