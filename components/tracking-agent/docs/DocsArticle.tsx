import { Fragment } from 'react';
import Link from 'next/link';
import CopyButton from '@/components/playbook/CopyButton';
import HeadingLink from '@/components/playbook/HeadingLink';
import blocks from '@/components/playbook/blocks.module.css';
import mdx from '@/components/playbook/mdx.module.css';
import table from '@/components/playbook/Table.module.css';
import playbook from '@/app/playbook/playbook.module.css';
import { rich, stripRich } from '@/lib/content/rich';
import {
  DOCS_HOME_PAGE_ID,
  DOCS_PAGES,
  DOCS_ROOT,
  docsShared,
  type DocsBlock,
  type DocsPage,
} from '@/lib/content/tracking-agent-docs';
import { displayDate } from '@/lib/display-date';
import { headingId } from '@/lib/playbook/heading-id';
import { inter } from '@/lib/reading-font';
import article from '@/components/product-article/ProductArticle.module.css';
import styles from './DocsArticle.module.css';

/**
 * One Tracking Agent docs page, on the playbook's reading surface: the docs
 * list beside the article (below it on phones), then the header with the
 * answer under the H1, byline and Updated date, sections, FAQs, and previous /
 * next. Every data-ck key is a path into the page's own content file; text
 * from another docs file (sidebar labels, shared labels, the home's index)
 * carries data-ck-page so /admin says where it's edited.
 */
export default function DocsArticle({ page, updated }: { page: DocsPage; updated: string }) {
  const { header, sections, faqs } = page.content;
  const at = DOCS_PAGES.findIndex((p) => p.path === page.path);
  const previous = at > 0 ? DOCS_PAGES[at - 1] : undefined;
  const next = at < DOCS_PAGES.length - 1 ? DOCS_PAGES[at + 1] : undefined;

  return (
    <div className="page-shell">
      <div className={`container ${inter.variable} ${playbook.reading}`} data-reading-surface>
        <div className={styles.layout}>
          <nav className={styles.nav} aria-label={stripRich(docsShared.navLabel)}>
            <Link href={DOCS_ROOT} className={styles.navTitle} data-ck="shared.navTitle" data-ck-page={DOCS_HOME_PAGE_ID}>
              {rich(docsShared.navTitle)}
            </Link>
            <ol className={styles.navList}>
              {DOCS_PAGES.map((p) => (
                <li key={p.path}>
                  <Link
                    href={p.path}
                    className={styles.navLink}
                    aria-current={p.path === page.path ? 'page' : undefined}
                    data-ck="nav.label"
                    data-ck-page={p.pageId}
                  >
                    {rich(p.content.nav.label)}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <article className={`${playbook.article} ${article.prose} ${styles.prose}`}>
            <p className={playbook.eyebrow} data-ck="header.eyebrow">
              {rich(header.eyebrow)}
            </p>
            <h1 className={playbook.title} data-ck="header.title">
              {rich(header.title)}
            </h1>
            <p className={playbook.summary} data-ck="header.intro">
              {rich(header.intro)}
            </p>
            <div className={playbook.meta}>
              <span data-ck="header.byline">{rich(header.byline)}</span>
              <span>
                <span data-ck="header.updatedLabel">{rich(header.updatedLabel)}</span>{' '}
                <time dateTime={updated}>{displayDate(updated)}</time>
              </span>
            </div>
            <hr className={playbook.headerRule} />

            {sections.map((section, s) => {
              const id = headingId(stripRich(section.heading));
              return (
                <Fragment key={s}>
                  <div className={`${blocks.headingRow} ${styles.headingRow}`}>
                    <h2 id={id} className={mdx.h2} data-ck={`sections.${s}.heading`}>
                      {rich(section.heading)}
                    </h2>
                    <HeadingLink id={id} label={stripRich(docsShared.copyLink)} />
                  </div>
                  {section.blocks.map((block, b) => (
                    <Block key={b} block={block} ck={`sections.${s}.blocks.${b}`} />
                  ))}
                </Fragment>
              );
            })}

            <section className={blocks.faqs}>
              <h2 className={blocks.faqsTitle} data-ck="faqs.title">
                {rich(faqs.title)}
              </h2>
              {faqs.items.map((faq, i) => (
                <details key={i} className={blocks.faq} open={i === 0}>
                  <summary className={blocks.faqQuestion} data-ck={`faqs.items.${i}.q`}>
                    {rich(faq.q)}
                  </summary>
                  <p className={blocks.faqAnswer} data-ck={`faqs.items.${i}.a`}>
                    {rich(faq.a)}
                  </p>
                </details>
              ))}
            </section>

            <nav className={playbook.pager} aria-label={stripRich(docsShared.pagerLabel)}>
              {previous ? <PagerLink page={previous} label={docsShared.previous} labelKey="shared.previous" /> : <span />}
              {next ? <PagerLink page={next} label={docsShared.next} labelKey="shared.next" isNext /> : null}
            </nav>
          </article>
        </div>
      </div>
    </div>
  );
}

function PagerLink({ page, label, labelKey, isNext }: { page: DocsPage; label: string; labelKey: string; isNext?: boolean }) {
  return (
    <Link href={page.path} className={`${playbook.pagerCard} ${isNext ? playbook.pagerNext : ''}`}>
      <span className={playbook.pagerLabel} data-ck={labelKey} data-ck-page={DOCS_HOME_PAGE_ID}>
        {rich(label)}
      </span>
      <span className={playbook.pagerTitle} data-ck="nav.label" data-ck-page={page.pageId}>
        {rich(page.content.nav.label)}
      </span>
    </Link>
  );
}

function Table({ columns, rows, ck }: { columns: string[]; rows: { cells: string[] }[]; ck: string }) {
  return (
    <div className={table.scroller} tabIndex={0}>
      <table className={table.table}>
        <thead>
          <tr>
            {columns.map((column, i) => (
              <th key={i} scope="col" data-ck={`${ck}.columns.${i}`}>
                {rich(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.cells.map((cell, c) => (
                <td key={c} data-ck={`${ck}.rows.${r}.cells.${c}`}>
                  {rich(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block, ck }: { block: DocsBlock; ck: string }) {
  if ('paragraph' in block) {
    return (
      <p className={mdx.p} data-ck={`${ck}.paragraph`}>
        {rich(block.paragraph)}
      </p>
    );
  }
  if ('subheading' in block) {
    return (
      <h3 id={headingId(stripRich(block.subheading))} className={mdx.h3} data-ck={`${ck}.subheading`}>
        {rich(block.subheading)}
      </h3>
    );
  }
  if ('list' in block || 'steps' in block) {
    const items = 'list' in block ? block.list : block.steps;
    const key = 'list' in block ? 'list' : 'steps';
    const List = 'list' in block ? 'ul' : 'ol';
    return (
      <List className={'list' in block ? mdx.ul : mdx.ol}>
        {items.map((item, i) => (
          <li key={i} className={mdx.li} data-ck={`${ck}.${key}.${i}`}>
            {rich(item)}
          </li>
        ))}
      </List>
    );
  }
  if ('table' in block) {
    return <Table columns={block.table.columns} rows={block.table.rows} ck={`${ck}.table`} />;
  }
  if ('code' in block) {
    return (
      <div className={blocks.codeWrap}>
        <div className={blocks.codeBar}>
          <span className={blocks.codeLang} data-ck={`${ck}.code.language`}>
            {block.code.language}
          </span>
          <CopyButton value={block.code.text} label={stripRich(docsShared.copyCode)} copiedLabel={stripRich(docsShared.copied)} />
        </div>
        <pre className={blocks.codePre}>
          <code data-ck={`${ck}.code.text`}>{block.code.text}</code>
        </pre>
      </div>
    );
  }
  if ('callout' in block) {
    return (
      <aside className={`${blocks.callout} ${blocks.note}`}>
        <p className={blocks.calloutLabel} data-ck={`${ck}.callout.label`}>
          {rich(block.callout.label)}
        </p>
        <p className={mdx.p} data-ck={`${ck}.callout.text`}>
          {rich(block.callout.text)}
        </p>
      </aside>
    );
  }
  if ('flow' in block) {
    return (
      <ol className={styles.flow}>
        {block.flow.map((box, i) => (
          <li key={i} className={styles.flowBox}>
            <span className={styles.flowTitle} data-ck={`${ck}.flow.${i}.title`}>
              {rich(box.title)}
            </span>
            <span className={styles.flowText} data-ck={`${ck}.flow.${i}.text`}>
              {rich(box.text)}
            </span>
          </li>
        ))}
      </ol>
    );
  }
  // The docs home's index: one row per page, from each page's own nav copy.
  const pages = DOCS_PAGES.slice(1);
  return (
    <div className={table.scroller} tabIndex={0}>
      <table className={table.table}>
        <thead>
          <tr>
            {block.index.columns.map((column, i) => (
              <th key={i} scope="col" data-ck={`${ck}.index.columns.${i}`}>
                {rich(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.path}>
              <td>
                <Link href={p.path} data-ck="nav.label" data-ck-page={p.pageId}>
                  {rich(p.content.nav.label)}
                </Link>
              </td>
              <td data-ck="nav.summary" data-ck-page={p.pageId}>
                {rich(p.content.nav.summary)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
