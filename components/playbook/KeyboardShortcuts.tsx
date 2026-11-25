'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Reading shortcuts: j / k or the arrow keys move between chapters.
 *
 * Three rules keep them from getting in the way:
 *
 *   Never while typing. A reader writing an email address into the capture
 *   form must be able to press "j" without the page jumping.
 *
 *   Never with a modifier. Cmd-K, Ctrl-L and the browser's own find are not
 *   ours to take.
 *
 *   Never as the only way to do something. Every shortcut duplicates a control
 *   that is already on the page and reachable by tab.
 */

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return EDITABLE.has(target.tagName) || target.isContentEditable;
}

export default function KeyboardShortcuts({
  prevSlug,
  nextSlug,
}: {
  prevSlug?: string;
  nextSlug?: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      switch (event.key) {
        case 'j':
        case 'ArrowRight':
          if (nextSlug) {
            event.preventDefault();
            router.push(`/playbook/${nextSlug}`);
          }
          break;
        case 'k':
        case 'ArrowLeft':
          if (prevSlug) {
            event.preventDefault();
            router.push(`/playbook/${prevSlug}`);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, prevSlug, nextSlug]);

  return null;
}
