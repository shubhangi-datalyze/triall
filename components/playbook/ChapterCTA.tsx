import { rich } from '@/lib/content/rich';
import { playbookPageContent } from '@/lib/content/playbookPage';
import CaptureForm from './CaptureForm';
import EmailGate from './EmailGate';
import styles from './blocks.module.css';

/**
 * The email ask, in two shapes: the "get this as a PDF" box under the chapter
 * header, and the card at the end of the chapter where intent is highest.
 *
 * Neither covers the text and neither interrupts reading. A reader we already
 * have an email for sees nothing at all - asking somebody to sign up twice is
 * the fastest way to make the ask feel like noise.
 *
 * The copy comes from content/playbook.json, so the wording is editable in
 * /admin without touching this file.
 */
export default function ChapterCTA({
  variant = 'pdf',
  sourceSlug,
  part,
}: {
  variant?: string;
  sourceSlug?: string;
  part?: string;
}) {
  const { chapterCta, capture } = playbookPageContent;
  const end = variant === 'end';

  return (
    <EmailGate>
      <aside className={end ? styles.ctaEnd : styles.ctaPdf}>
        <p
          className={styles.ctaTitle}
          data-ck={end ? 'chapterCta.endTitle' : 'chapterCta.pdfTitle'}
        >
          {rich(end ? chapterCta.endTitle : chapterCta.pdfTitle)}
        </p>
        <p
          className={styles.ctaIntro}
          data-ck={end ? 'chapterCta.endIntro' : 'chapterCta.pdfIntro'}
        >
          {rich(end ? chapterCta.endIntro : chapterCta.pdfIntro)}
        </p>
        <CaptureForm
          copy={{
            placeholder: capture.placeholder,
            submitLabel: end ? capture.submitLabel : chapterCta.pdfSubmitLabel,
            success: end ? capture.success : chapterCta.pdfSuccess,
            error: capture.error,
            privacy: capture.privacy,
          }}
          sourceSlug={sourceSlug}
          compact={!end}
          placement={end ? 'chapter_end' : 'chapter_pdf'}
          context={{ chapterSlug: sourceSlug, part, signedIn: false }}
        />
      </aside>
    </EmailGate>
  );
}
