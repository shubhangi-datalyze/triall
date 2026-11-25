'use client';

import { trackPlaybook } from '@/lib/playbook/analytics';

/**
 * A download link that reports what was taken.
 *
 * The PDF and the templates are counted separately, because they answer
 * different questions: the PDF is "did the book itself travel", a template is
 * "did somebody go and do the work".
 */
export default function DownloadLink({
  id,
  label,
  description,
  signedIn,
  className,
  labelClassName,
  noteClassName,
}: {
  id: string;
  label: string;
  description: string;
  signedIn: boolean;
  className?: string;
  labelClassName?: string;
  noteClassName?: string;
}) {
  const event = id.includes('pdf') ? 'pdf_downloaded' : 'template_downloaded';

  return (
    <a
      className={className}
      href={`/api/playbook/download/${id}`}
      onClick={() => trackPlaybook(event, { signedIn }, { download_id: id })}
    >
      <span className={labelClassName}>{label}</span>
      <span className={noteClassName}>{description}</span>
    </a>
  );
}
