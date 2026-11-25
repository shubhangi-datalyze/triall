'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ACCESS_FORM_ID,
  ACCESS_REQUESTED_EVENT,
  hasAccessCookie,
  useHasAccess,
} from '@/lib/playbook/use-has-access';

/**
 * A chapter link from the hub or a part page that asks for an email first.
 *
 * The href is always the real chapter, so crawlers and "open in new tab" still
 * reach it - chapter pages are public. A click from a reader who has not given
 * an email is caught: on the hub it focuses the access form, elsewhere it goes
 * to the hub's form with the chapter remembered.
 */
export default function ChapterLink({
  slug,
  className,
  iconClassName,
  children,
}: {
  slug: string;
  className?: string;
  /** The trailing icon: a lock until the reader has given an email, then an arrow. */
  iconClassName?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const access = useHasAccess();

  const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (hasAccessCookie()) return;
    event.preventDefault();

    const form = document.getElementById(ACCESS_FORM_ID);
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.dispatchEvent(new CustomEvent(ACCESS_REQUESTED_EVENT, { detail: slug }));
    } else {
      router.push(`/playbook?chapter=${encodeURIComponent(slug)}#${ACCESS_FORM_ID}`);
    }
  };

  return (
    <Link href={`/playbook/${slug}`} className={className} onClick={onClick}>
      {children}
      <span className={iconClassName} aria-hidden="true">
        {access === false ? <LockIcon /> : <ArrowIcon />}
      </span>
    </Link>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
