'use client';

import Link from 'next/link';
import { rememberCallIntent } from '@/lib/playbook/analytics';
import { useSignedIn } from '@/lib/playbook/use-signed-in';

/**
 * A link out of the playbook towards booking a call.
 *
 * It leaves a marker in session storage so the booking confirmation page can
 * attribute the booking back to the playbook, and to the chapter it started
 * from, its part and whether the reader was signed in. Without it, a booking
 * that began in a chapter is indistinguishable from one that began on the homepage.
 */
export default function CallLink({
  href,
  chapterSlug,
  part,
  className,
  children,
}: {
  href: string;
  chapterSlug?: string;
  part?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const signedIn = useSignedIn();
  return (
    <Link href={href} className={className} onClick={() => rememberCallIntent(chapterSlug, part, signedIn === true)}>
      {children}
    </Link>
  );
}
