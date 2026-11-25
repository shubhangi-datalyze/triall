'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useHasAccess } from '@/lib/playbook/use-has-access';

/**
 * Renders its children only for a reader we do not have an email for: not
 * signed in, and never gave an email on the hub or in a chapter.
 *
 * Every email ask on a chapter sits inside one of these, so once a reader has
 * given their address there is no email box anywhere. The moment one form is
 * submitted, the others on the page disappear too (useHasAccess listens for
 * ACCESS_GRANTED_EVENT). The form that was submitted stays, so its success
 * message is not yanked away mid-read.
 *
 * It renders nothing until the cookies have been read, so a known reader never
 * sees an ask flash before it vanishes. Chapter pages stay static because of
 * it: nothing here is decided on the server.
 */

const SentContext = createContext<(() => void) | null>(null);

/** Called by a form inside the gate when it has been submitted. */
export function useMarkSent(): (() => void) | null {
  return useContext(SentContext);
}

export default function EmailGate({ children }: { children: ReactNode }) {
  const access = useHasAccess();
  const [sent, setSent] = useState(false);

  if (access !== false && !sent) return null;
  return <SentContext.Provider value={() => setSent(true)}>{children}</SentContext.Provider>;
}
