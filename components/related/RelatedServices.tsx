import Link from 'next/link';
import { siteContent } from '@/lib/content/site';
import type { RelatedLink } from '@/lib/related-services';
import styles from './RelatedServices.module.css';

/**
 * The service page (and sometimes a free tool) for what the reader has just
 * read, at the end of a blog post or playbook chapter. A contextual link from
 * the article tells search engines which service page the topic belongs to,
 * which a sitewide nav link can't.
 */
export default function RelatedServices({ links }: { links: RelatedLink[] }) {
  if (!links.length) return null;
  const { title, toolLabel } = siteContent.shared.relatedServices;

  return (
    <aside className={styles.box} aria-label={title}>
      <p className={styles.title} data-ck="shared.relatedServices.title">
        {title}
      </p>
      <ul className={styles.list}>
        {links.map((link) => (
          <li key={link.href}>
            {link.tool ? <span data-ck="shared.relatedServices.toolLabel">{toolLabel}: </span> : null}
            <Link href={link.href}>{link.label}</Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
