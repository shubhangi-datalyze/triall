'use client';

import { useEffect, useState } from 'react';
import CaptureForm, { type CaptureCopy } from './CaptureForm';
import EmailGate from './EmailGate';
import { useHasAccess } from '@/lib/playbook/use-has-access';
import styles from './capture.module.css';

/**
 * The bar that appears once a reader is 60% through a chapter.
 *
 * Rules it follows, because the brief is right that these matter more than the
 * conversion rate: it never covers the text (it is fixed to the bottom edge and
 * the article has padding under it), it can always be dismissed, and a dismiss
 * is remembered for thirty days rather than for the page view.
 *
 * It is fixed rather than sticky so it takes no space in the flow and cannot
 * shift the article when it appears.
 *
 * There is also a softer prompt once somebody has read a second chapter, which
 * is a different thing and is why the chapter count is tracked here too.
 */

const DISMISS_KEY = 'playbook:sticky-dismissed';
const CHAPTERS_KEY = 'playbook:chapters-seen';
const DISMISS_DAYS = 30;
const APPEAR_AT = 0.6;

function dismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

/** Records this chapter and returns how many distinct ones have been opened. */
function rememberChapter(slug: string): number {
  try {
    const raw = window.localStorage.getItem(CHAPTERS_KEY);
    const seen: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!seen.includes(slug)) {
      seen.push(slug);
      window.localStorage.setItem(CHAPTERS_KEY, JSON.stringify(seen.slice(-60)));
    }
    return seen.length;
  } catch {
    return 1;
  }
}

export default function StickyCapture({
  copy,
  label,
  secondChapterLabel,
  dismissLabel,
  sourceSlug,
  part,
}: {
  copy: CaptureCopy;
  label: string;
  /** Shown instead, once this is the reader's second chapter or later. */
  secondChapterLabel: string;
  dismissLabel: string;
  sourceSlug: string;
  part?: string;
}) {
  const access = useHasAccess();
  const [visible, setVisible] = useState(false);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    // null means not known yet; wait rather than flash the bar at a reader
    // we already have an email for.
    if (access !== false) return;
    setReturning(rememberChapter(sourceSlug) >= 2);
    if (dismissedRecently()) return;

    let frame = 0;
    const check = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      if (window.scrollY / scrollable >= APPEAR_AT) {
        setVisible(true);
        window.removeEventListener('scroll', onScroll);
      }
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(check);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [access, sourceSlug]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
      );
    } catch {
      // Not remembering the dismissal is a nuisance, not a failure.
    }
  };

  return (
    <EmailGate>
      <aside className={styles.sticky}>
        <p className={styles.stickyLabel}>{returning ? secondChapterLabel : label}</p>
        <div className={styles.stickyForm}>
          <CaptureForm
            copy={copy}
            sourceSlug={sourceSlug}
            compact
            placement={returning ? 'second_chapter' : 'sticky'}
            context={{ chapterSlug: sourceSlug, part, signedIn: false }}
          />
        </div>
        <button type="button" className={styles.dismiss} onClick={dismiss}>
          {dismissLabel}
        </button>
      </aside>
    </EmailGate>
  );
}
