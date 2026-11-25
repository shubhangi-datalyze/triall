import type { ReactNode } from 'react';
import { rich } from '@/lib/content/rich';
import styles from './blocks.module.css';

/**
 * The chapter component set: everything a chapter can reach for beyond prose.
 *
 * Every one of these is a Server Component and every one puts its text in the
 * DOM. Nothing here waits for hydration, nothing hides text behind a click, and
 * nothing needs JavaScript to be readable. The interactive pieces - copying a
 * heading link, sorting a table, a glossary popover - are separate client
 * components that enhance markup which already works without them.
 *
 * Props are strings, not expressions. next-mdx-remote strips `prop={...}` from
 * MDX, so `<Callout type="warning">` works and `<Callout type={x}>` would not.
 */

/* -------------------------------------------------------------------------- */
/* Callout                                                                     */
/* -------------------------------------------------------------------------- */

const CALLOUT_KINDS = ['note', 'warning', 'mistake', 'example'] as const;
type CalloutKind = (typeof CALLOUT_KINDS)[number];

const isCalloutKind = (value: string): value is CalloutKind =>
  (CALLOUT_KINDS as readonly string[]).includes(value);

/**
 * The "this is where people get it wrong" box.
 *
 * The kind is announced in text, not by colour alone: a reader who cannot see
 * the border still needs to know a warning is a warning.
 */
export function Callout({
  type = 'note',
  title,
  children,
}: {
  type?: string;
  title?: string;
  children?: ReactNode;
}) {
  const kind: CalloutKind = isCalloutKind(type) ? type : 'note';
  const label = CALLOUT_LABELS[kind];

  return (
    <aside className={`${styles.callout} ${styles[kind]}`} aria-label={title ?? label}>
      <p className={styles.calloutLabel}>{title ?? label}</p>
      <div className={styles.calloutBody}>{children}</div>
    </aside>
  );
}

const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: 'Note',
  warning: 'Watch out',
  mistake: 'Common mistake',
  example: 'Example',
};

/* -------------------------------------------------------------------------- */
/* StatRow                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Two to four figures with labels, for thresholds like 1,000 / 20,000
 * sign-ups. Written as `<Stat value="1,000" label="..." />` children so the
 * numbers stay in the markup and the component takes no arrays.
 */
export function StatRow({ children }: { children?: ReactNode }) {
  return <div className={styles.statRow}>{children}</div>;
}

export function Stat({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note?: string;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {note ? <span className={styles.statNote}>{note}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Numbered steps joined by a rule. A real <ol>, so the order survives without
 * CSS and a screen reader announces "3 of 5".
 */
export function Steps({ children }: { children?: ReactNode }) {
  return <ol className={styles.steps}>{children}</ol>;
}

export function Step({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <li className={styles.step}>
      {title ? <p className={styles.stepTitle}>{title}</p> : null}
      <div className={styles.stepBody}>{children}</div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Compare                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Right way / wrong way, side by side. Two columns on a wide screen, stacked on
 * a phone, and each side names itself in text rather than relying on position
 * or colour.
 */
export function Compare({
  a = 'What goes wrong',
  b = 'What to do instead',
  children,
}: {
  a?: string;
  b?: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.compare} data-a={a} data-b={b}>
      {children}
    </div>
  );
}

export function CompareSide({
  label,
  kind = 'bad',
  children,
}: {
  label: string;
  kind?: string;
  children?: ReactNode;
}) {
  return (
    <section className={kind === 'good' ? styles.compareGood : styles.compareBad}>
      <p className={styles.compareLabel}>{label}</p>
      <div>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Formula                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A metric definition as the four lines that settle an argument: what is
 * counted, what it is counted out of, the window, and what is excluded.
 *
 * A description list, because that is exactly what it is.
 */
export function Formula({
  name,
  counted,
  outOf,
  window: timeWindow,
  excludes,
}: {
  name?: string;
  counted: string;
  outOf: string;
  window: string;
  excludes?: string;
}) {
  const rows: [string, string][] = [
    ['Counted', counted],
    ['Out of', outOf],
    ['Window', timeWindow],
  ];
  if (excludes) rows.push(['Excludes', excludes]);

  return (
    <div className={styles.formula}>
      {name ? <p className={styles.formulaName}>{name}</p> : null}
      <dl className={styles.formulaList}>
        {rows.map(([term, value]) => (
          <div key={term} className={styles.formulaRow}>
            <dt className={styles.formulaTerm}>{term}</dt>
            <dd className={styles.formulaValue}>{rich(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MetricTree                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A north star with its branches, drawn as inline SVG from a pipe-separated
 * list. No chart library, and no client JavaScript.
 *
 * The same structure is repeated as a nested list for screen readers, because
 * an SVG of boxes and lines is not readable as a hierarchy. The SVG is hidden
 * from assistive technology and the list is hidden visually, so each audience
 * gets the version that works for it.
 */
export function MetricTree({
  root,
  branches,
  caption,
}: {
  root: string;
  /** Pipe-separated, e.g. "New users|Activation rate|Retention". */
  branches: string;
  caption?: string;
}) {
  const leaves = branches
    .split('|')
    .map((leaf) => leaf.trim())
    .filter(Boolean);

  // Geometry. The viewBox scales to the column, so these are drawing units,
  // not pixels, and the box widths are derived from the leaf count.
  const width = 720;
  const height = 210;
  const boxWidth = Math.min(180, Math.max(96, width / Math.max(leaves.length, 1) - 16));
  const gap = leaves.length > 1 ? (width - boxWidth) / (leaves.length - 1) : 0;
  const centre = width / 2;

  return (
    <div className={styles.tree}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.treeSvg}
        role="presentation"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x={centre - 110}
          y={8}
          width={220}
          height={48}
          rx={12}
          className={styles.treeRootBox}
        />
        <text x={centre} y={38} className={styles.treeRootText} textAnchor="middle">
          {root}
        </text>

        {leaves.map((leaf, i) => {
          const x = leaves.length > 1 ? i * gap : centre - boxWidth / 2;
          const boxCentre = x + boxWidth / 2;
          return (
            <g key={leaf}>
              <path
                d={`M ${centre} 56 V 96 H ${boxCentre} V 136`}
                className={styles.treeLine}
                fill="none"
              />
              <rect
                x={x}
                y={136}
                width={boxWidth}
                height={56}
                rx={10}
                className={styles.treeLeafBox}
              />
              <text
                x={boxCentre}
                y={168}
                className={styles.treeLeafText}
                textAnchor="middle"
              >
                {leaf}
              </text>
            </g>
          );
        })}
      </svg>

      {/* The same tree, for anything that cannot read the drawing. */}
      <div className={styles.visuallyHidden}>
        <ul>
          <li>
            {root}
            <ul>
              {leaves.map((leaf) => (
                <li key={leaf}>{leaf}</li>
              ))}
            </ul>
          </li>
        </ul>
      </div>

      {caption ? <p className={styles.treeCaption}>{caption}</p> : null}
    </div>
  );
}
