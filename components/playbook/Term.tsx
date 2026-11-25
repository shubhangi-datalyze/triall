import { glossaryTerm } from '@/lib/content/playbookGlossary';
import { rich } from '@/lib/content/rich';
import styles from './blocks.module.css';

/**
 * An inline glossary term: dotted underline, definition in a popover.
 *
 * Built on the HTML popover attribute, so it opens, closes on Escape and
 * closes on an outside click with no JavaScript of ours. The definition is a
 * sibling in the DOM either way, which means a crawler and a screen reader
 * both read it whether or not the popover ever opens.
 *
 * An unknown id renders as plain text rather than throwing. A chapter should
 * not 500 because a term was renamed.
 */
export default function Term({ id, children }: { id: string; children?: React.ReactNode }) {
  const entry = glossaryTerm(id);
  if (!entry) return <>{children ?? id}</>;

  const popoverId = `glossary-${entry.id}`;

  return (
    <span className={styles.termWrap}>
      <button
        type="button"
        className={styles.term}
        popoverTarget={popoverId}
        aria-describedby={popoverId}
      >
        {children ?? entry.term}
      </button>
      <span popover="auto" id={popoverId} className={styles.termPopover} role="tooltip">
        <span className={styles.termName}>{entry.term}</span>
        <span className={styles.termDefinition}>{rich(entry.definition)}</span>
        <a href={`/playbook/glossary#${entry.id}`} className={styles.termLink}>
          Glossary
        </a>
      </span>
    </span>
  );
}
