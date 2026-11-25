import Image from 'next/image';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { headingId } from '@/lib/playbook/heading-id';
import { tableComponents } from './Table';
import {
  Callout,
  Compare,
  CompareSide,
  Formula,
  MetricTree,
  Stat,
  StatRow,
  Step,
  Steps,
} from './blocks';
import ChapterCTA from './ChapterCTA';
import Checklist from './Checklist';
import CodeBlock from './CodeBlock';
import HeadingLink from './HeadingLink';
import SortableTable from './SortableTable';
import { Tab, Tabs } from './Tabs';
import Term from './Term';
import blocks from './blocks.module.css';
import styles from './mdx.module.css';

/**
 * What MDX in a chapter is allowed to render.
 *
 * Almost everything here is a Server Component. A chapter's text is in the HTML
 * before any script runs, which is the point: an answer engine that does not
 * execute JavaScript still reads the whole chapter. The client components - the
 * checklist, the copy buttons and the sortable table - only ever add behaviour
 * to markup that already works without them.
 *
 * Props are strings, never expressions. next-mdx-remote strips `prop={...}`
 * from MDX, so a chapter writes `<Callout type="warning">` and never
 * `<Stat value={1000}>`. Components needing a list take a pipe-separated
 * string for the same reason.
 *
 * Headings carry ids derived by the same function the table of contents uses,
 * so the two agree without anything being passed between them.
 */

/** The text of a heading, for its anchor id. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

/**
 * H2s get an id and a copy-link; H3s and H4s get an id only. The link is a
 * client component that renders nothing until it can build an absolute URL.
 */
function Heading({ level, children }: { level: 2 | 3 | 4; children?: ReactNode }) {
  const Tag = `h${level}` as const;
  const id = headingId(textOf(children));

  if (level !== 2) {
    return (
      <Tag id={id} className={styles[`h${level}`]}>
        {children}
      </Tag>
    );
  }

  return (
    <div className={blocks.headingRow}>
      <h2 id={id} className={styles.h2}>
        {children}
      </h2>
      <HeadingLink id={id} label="Copy link" />
    </div>
  );
}

/** Internal links stay in the tab and prefetch; external ones do neither. */
function Anchor({ href = '', children, ...rest }: ComponentPropsWithoutRef<'a'>) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={styles.link}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={styles.link}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}

/**
 * Chapter images. Width and height come from the MDX, so the space is reserved
 * before the file loads and nothing shifts underneath the reader.
 */
function ChapterImage({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  /** Strings, because MDX attribute expressions are stripped; next/image
   *  accepts a numeric string and reserves the space just the same. */
  width: `${number}`;
  height: `${number}`;
}) {
  return (
    <figure className={styles.figure}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes="(max-width: 768px) 100vw, 720px"
        className={styles.image}
      />
    </figure>
  );
}

export const mdxComponents = {
  h2: (props: ComponentPropsWithoutRef<'h2'>) => <Heading level={2} {...props} />,
  h3: (props: ComponentPropsWithoutRef<'h3'>) => <Heading level={3} {...props} />,
  h4: (props: ComponentPropsWithoutRef<'h4'>) => <Heading level={4} {...props} />,
  a: Anchor,
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className={styles.p} {...props} />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className={styles.ul} {...props} />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol className={styles.ol} {...props} />,
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className={styles.li} {...props} />,
  blockquote: (props: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className={styles.quote} {...props} />
  ),
  // Markdown code fences become a CodeBlock, which wraps the <pre> markdown
  // already produced with a language label and a copy button.
  pre: CodeBlock,
  code: (props: ComponentPropsWithoutRef<'code'>) => <code className={styles.code} {...props} />,
  hr: () => <hr className={styles.hr} />,
  ...tableComponents,
  Image: ChapterImage,

  // The chapter component set.
  Callout,
  ChapterCTA,
  Checklist,
  Compare,
  CompareSide,
  Formula,
  MetricTree,
  SortableTable,
  Stat,
  StatRow,
  Step,
  Steps,
  Tab,
  Tabs,
  Term,
};
