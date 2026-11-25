import { rich } from '@/lib/content/rich';
import { playbookPageContent } from '@/lib/content/playbookPage';
import type { Faq } from '@/lib/playbook/schema';
import styles from './blocks.module.css';

/**
 * The chapter's FAQs, from frontmatter.
 *
 * Real <details> elements, and the first one is open. Open matters: an answer
 * engine reads the DOM, and a closed <details> still contains its text, but a
 * reader landing from a search for that exact question should see the answer
 * without a click.
 */
export default function FAQ({ items }: { items: Faq[] }) {
  if (items.length === 0) return null;
  const { labels } = playbookPageContent;

  return (
    <section className={styles.faqs}>
      <h2 className={styles.faqsTitle} data-ck="labels.faqTitle">
        {rich(labels.faqTitle)}
      </h2>
      {items.map((faq, i) => (
        <details key={faq.q} className={styles.faq} open={i === 0}>
          <summary className={styles.faqQuestion}>{faq.q}</summary>
          <p className={styles.faqAnswer}>{faq.a}</p>
        </details>
      ))}
    </section>
  );
}
