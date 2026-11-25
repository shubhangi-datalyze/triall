'use client';

import { useEffect, useState } from 'react';
import styles from './blocks.module.css';

/**
 * The bar across the very top of the viewport showing how far through the
 * chapter the reader is.
 *
 * Fixed to the viewport and out of the document flow, so it cannot shift the
 * page: it occupies no space at any width, and the article does not move when
 * it appears.
 *
 * Purely decorative - the same information is in the scrollbar - so it is
 * hidden from assistive technology rather than announced on every scroll, and
 * it disappears entirely for a reader who has asked for reduced motion.
 */
export default function ReadingProgress() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setPercent(scrollable <= 0 ? 0 : Math.min(100, (window.scrollY / scrollable) * 100));
    };

    // Coalesce to one update per frame: scroll fires far more often than the
    // bar can usefully move.
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={styles.progressTrack} aria-hidden="true">
      <div className={styles.progressBar} style={{ transform: `scaleX(${percent / 100})` }} />
    </div>
  );
}
