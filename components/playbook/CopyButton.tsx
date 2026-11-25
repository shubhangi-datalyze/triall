'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './blocks.module.css';

/**
 * Copy-to-clipboard, used by code blocks and by the link on each H2.
 *
 * It renders nothing on the server and nothing before hydration: a button that
 * cannot work yet is worse than no button. Everything it copies is already on
 * the page, so a reader without JavaScript loses a convenience, not content.
 */
export default function CopyButton({
  value,
  label,
  copiedLabel = 'Copied',
  className,
}: {
  /** The text to copy. For a heading link, an absolute URL. */
  value: string;
  label: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReady(typeof navigator !== 'undefined' && Boolean(navigator.clipboard));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!ready) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright. Saying nothing is better
      // than an alert the reader did not ask for.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`${styles.copyButton} ${className ?? ''}`}
      aria-label={copied ? copiedLabel : label}
    >
      <span aria-hidden="true">{copied ? copiedLabel : label}</span>
    </button>
  );
}
