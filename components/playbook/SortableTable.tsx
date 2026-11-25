'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Makes the markdown table inside it sortable.
 *
 * It wraps a plain table rather than replacing it: the table renders, reads and
 * is crawled exactly as it would without this, and sorting is added on top once
 * the script runs. With JavaScript off the reader gets the table in the order
 * the chapter wrote it, which is the order that made sense to the author.
 *
 * Sorting reads the DOM instead of taking data as props, because MDX strips
 * attribute expressions and a markdown table has nowhere to put them.
 */
export default function SortableTable({ children }: { children?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const table = host.current?.querySelector('table');
    const head = table?.querySelector<HTMLTableRowElement>('thead tr');
    const body = table?.querySelector('tbody');
    if (!table || !head || !body) return;

    const original = [...body.rows];
    // -1 means "the order the chapter wrote", which is a state worth being
    // able to get back to.
    let sortedColumn = -1;
    let ascending = true;

    const value = (row: HTMLTableRowElement, column: number) =>
      row.cells[column]?.textContent?.trim() ?? '';

    // A number if every cell in the column is one, once thousands separators,
    // currency symbols and percent signs are taken off.
    const numeric = (text: string) => {
      const cleaned = text.replace(/[,%$£€\s]/g, '');
      return cleaned !== '' && Number.isFinite(Number(cleaned)) ? Number(cleaned) : null;
    };

    const cleanup: (() => void)[] = [];

    [...head.cells].forEach((cell, column) => {
      const label = cell.textContent ?? '';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-label', `Sort by ${label}`);
      button.style.cssText =
        'all:unset;cursor:pointer;display:inline-flex;gap:.4em;align-items:center;min-height:32px';

      const onClick = () => {
        ascending = sortedColumn === column ? !ascending : true;
        sortedColumn = column;

        const rows = [...body.rows].sort((a, b) => {
          const left = value(a, column);
          const right = value(b, column);
          const leftNumber = numeric(left);
          const rightNumber = numeric(right);
          const result =
            leftNumber !== null && rightNumber !== null
              ? leftNumber - rightNumber
              : left.localeCompare(right);
          return ascending ? result : -result;
        });

        for (const row of rows) body.appendChild(row);

        [...head.cells].forEach((other, i) => {
          other.setAttribute(
            'aria-sort',
            i === column ? (ascending ? 'ascending' : 'descending') : 'none',
          );
        });
      };

      button.addEventListener('click', onClick);
      cleanup.push(() => button.removeEventListener('click', onClick));

      cell.textContent = '';
      cell.appendChild(button);
      cell.setAttribute('aria-sort', 'none');
    });

    return () => {
      for (const off of cleanup) off();
      // Put the rows back as the chapter wrote them, so a re-render does not
      // inherit a sort order from a previous mount.
      for (const row of original) body.appendChild(row);
    };
  }, []);

  return <div ref={host}>{children}</div>;
}
