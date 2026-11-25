import CallLink from './CallLink';
import { rich } from '@/lib/content/rich';
import { playbookPageContent } from '@/lib/content/playbookPage';
import styles from './blocks.module.css';

/**
 * The book-a-call box, about 60% of the way through a chapter.
 *
 * The headline is the chapter's own `ctaLine` frontmatter ("Need help creating
 * a tracking plan?"), so the ask is about the problem the reader is in the
 * middle of, not a generic "talk to us". It shows to everyone, signed in or
 * not: it asks for a conversation, not an email.
 */
export default function ContactCTA({ line, chapterSlug, part }: { line: string; chapterSlug: string; part: string }) {
  const { chapterCta } = playbookPageContent;

  return (
    <aside className={styles.ctaContact}>
      <div>
        <p className={styles.ctaTitle}>{line}</p>
        <p className={styles.ctaIntro} data-ck="chapterCta.contactIntro">
          {rich(chapterCta.contactIntro)}
        </p>
      </div>
      <CallLink href="/contact" chapterSlug={chapterSlug} part={part} className="btn-primary">
        <span data-ck="chapterCta.contactButton">{rich(chapterCta.contactButton)}</span>
      </CallLink>
    </aside>
  );
}
