import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

/**
 * Tool-by-tool variants: Mixpanel vs PostHog vs Amplitude.
 *
 * Built out of radio inputs and CSS, with no JavaScript at all. That is not
 * cleverness for its own sake - it is the only version where every panel's text
 * is in the DOM for a crawler, the panels are all readable with scripts off,
 * and arrow-key navigation works because a radio group already does that.
 *
 * Each Tabs needs a unique `name`, which groups its radios. MDX cannot generate
 * one (attribute expressions are stripped), so the chapter supplies it.
 */
export function Tabs({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className={styles.tabs} role="group" data-tabs={name}>
      {children}
    </div>
  );
}

/**
 * One tab. `selected` marks the one that opens; without it the first tab in the
 * group wins by document order, because nothing is checked and the CSS falls
 * back to showing every panel - which is also what happens when CSS fails,
 * and is the right failure.
 */
export function Tab({
  name,
  id,
  label,
  selected,
  children,
}: {
  name: string;
  id: string;
  label: string;
  /** Any value marks this tab as the open one. */
  selected?: string;
  children?: ReactNode;
}) {
  const inputId = `${name}-${id}`;
  return (
    <div className={styles.tab}>
      <input
        type="radio"
        name={name}
        id={inputId}
        className={styles.radio}
        defaultChecked={selected !== undefined}
      />
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.panel}>{children}</div>
    </div>
  );
}
