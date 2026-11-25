import type { ReactNode } from 'react';
import s from './app.module.css';

/** A status's colour: running blue, done green, failed red, waiting on a person amber, otherwise grey. */
export type Tone = 'run' | 'ok' | 'bad' | 'warn' | 'idle';

/** A one-to-three word status, as a coloured chip. Its words come from the page's copy (a T or C inside). */
export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`${s.chip} ${s[`tone-${tone}`]}`}>{children}</span>;
}

const thisYear = () => new Date().getFullYear();

/** "4 Nov", or "4 Nov 2025" for another year. */
export function shortDay(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() === thisYear() ? {} : { year: 'numeric' }) }).format(d);
}

/** "4 Nov, 6:32 PM". */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  return `${shortDay(iso)}, ${time}`;
}

/**
 * A date (or date and time) in the viewer's time zone. A prerendered page (the previews) is built in
 * UTC, so the browser's text can differ from the server's: that difference is expected, not a bug.
 */
export function When({ iso, day }: { iso: string; day?: boolean }) {
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {day ? shortDay(iso) : shortWhen(iso)}
    </time>
  );
}
