'use client';

import { useEffect, useId, useState } from 'react';
import { readLocalChecklists, setLocalChecklistItem } from '@/lib/playbook/local-progress';
import { useSignedIn } from '@/lib/playbook/use-signed-in';
import styles from './blocks.module.css';

/**
 * A checklist a reader can tick, for the verification and audit chapters.
 *
 * Signed out, ticks live in localStorage under the one shared checklist key,
 * which is what makes them mergeable into an account later. Signed in, each
 * tick is also written to the account, so the list follows the reader between
 * devices.
 *
 * The boxes are real checkboxes in real labels, rendered on the server, so the
 * list reads and the items are in the DOM whether or not the script runs. Only
 * the remembering needs JavaScript.
 *
 * Storage access is wrapped in lib/playbook/local-progress: localStorage throws
 * in a private window and in browsers with site data blocked, and a checklist
 * is not worth an error boundary.
 */

export default function Checklist({
  id,
  items,
  title,
}: {
  id: string;
  /** Pipe-separated, because MDX strips attribute expressions. */
  items: string;
  title?: string;
}) {
  const entries = items
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

  const signedIn = useSignedIn();
  const [checked, setChecked] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const domId = useId();

  // Reading storage during render would make the server and client HTML
  // disagree, so it happens after mount and the boxes start unticked.
  useEffect(() => {
    if (signedIn === null) return;

    // The local copy renders first so the list is never blank, then the
    // account's copy replaces it: that is the one that follows a reader
    // between devices. Fetched rather than server-rendered, so the chapter
    // page stays static.
    setChecked(readLocalChecklists()[id] ?? []);
    setReady(true);

    if (!signedIn) return;
    let live = true;
    void fetch('/api/playbook/checklist')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { checklists?: Record<string, number[]> } | null) => {
        if (live && data?.checklists?.[id]) setChecked(data.checklists[id]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, signedIn]);

  const toggle = (index: number) => {
    const nowChecked = !checked.includes(index);
    setChecked(setLocalChecklistItem(id, index, nowChecked));

    if (signedIn !== true) return;
    void fetch('/api/playbook/checklist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ checklistId: id, itemIndex: index, checked: nowChecked }),
      keepalive: true,
    }).catch(() => {
      // The local copy is already written; a failed sync is not worth
      // interrupting a reader over.
    });
  };

  const done = checked.length;

  return (
    <section className={styles.checklist} aria-labelledby={`${domId}-title`}>
      <div className={styles.checklistHead}>
        <p className={styles.checklistTitle} id={`${domId}-title`}>
          {title ?? 'Checklist'}
        </p>
        {/* Announced politely so a screen-reader user hears the count change
            without it interrupting them mid-item. */}
        <p className={styles.checklistCount} aria-live="polite">
          {ready ? `${done} of ${entries.length}` : `${entries.length} items`}
        </p>
      </div>

      <ul className={styles.checklistItems}>
        {entries.map((item, index) => (
          <li key={item} className={styles.checklistItem}>
            <label className={styles.checklistLabel}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={checked.includes(index)}
                onChange={() => toggle(index)}
              />
              <span className={checked.includes(index) ? styles.checkedText : undefined}>
                {item}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
