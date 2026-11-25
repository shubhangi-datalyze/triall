import type { ComponentPropsWithoutRef } from 'react';
import styles from './Table.module.css';

/**
 * Chapter tables.
 *
 * A chapter writes a markdown table and remark-gfm turns it into real table
 * elements, which this maps onto the site's styling. Markdown rather than a
 * component taking `columns={...}`, because next-mdx-remote strips JS
 * expressions from MDX attributes; markdown has none to strip, and crawlers
 * and screen readers get true table structure either way.
 *
 * Cells wrap, so a table fits the column and is read in one go. The scroller
 * wrapper is only a safety net: if a table ever has more columns than a phone
 * can hold, it scrolls rather than pushing the page sideways, and it is
 * focusable so a keyboard user can scroll it. It carries no
 * role="region": a region with no accessible name is an accessibility failure,
 * and the markdown tables have no captions to name one with.
 */

function PlaybookTable({ children, ...rest }: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className={styles.scroller} tabIndex={0}>
      <table className={styles.table} {...rest}>
        {children}
      </table>
    </div>
  );
}

export const tableComponents = {
  table: PlaybookTable,
  th: (props: ComponentPropsWithoutRef<'th'>) => <th scope="col" {...props} />,
  caption: (props: ComponentPropsWithoutRef<'caption'>) => (
    <caption className={styles.caption} {...props} />
  ),
};
