'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { identifiedVisitorId, rememberVisitor } from '@/lib/mixpanel';
import { trackPlaybook } from '@/lib/playbook/analytics';
import { readVisitorId } from '@/lib/visitor-id-client';
import {
  ACCESS_FORM_ID,
  ACCESS_GRANTED_EVENT,
  ACCESS_REQUESTED_EVENT,
  useHasAccess,
} from '@/lib/playbook/use-has-access';
import styles from './capture.module.css';

/**
 * The hub's gate: one email field and an "Access course" button.
 *
 * No link to go and click - on submit the reader goes straight to a chapter:
 * the one they tried to open, or chapter one. A reader who has already given
 * an email sees a button into the course instead of the form.
 *
 * A gated chapter link elsewhere on the page asks for this form with
 * ACCESS_REQUESTED_EVENT; a gated link on another page sends the reader here
 * with ?chapter=<slug>. Either way the form remembers which chapter to open.
 */

export type AccessCopy = {
  placeholder: string;
  submitLabel: string;
  startLabel: string;
  gatePrefix: string;
  error: string;
};

export default function AccessForm({
  copy,
  firstChapter,
  chapters,
}: {
  copy: AccessCopy;
  firstChapter: string;
  /** Slug to title, so a chapter asked for by URL can be named and validated. */
  chapters: Record<string, string>;
}) {
  const access = useHasAccess();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const renderedAt = useRef(Date.now());
  const fieldId = useId();

  useEffect(() => {
    const focusFor = (slug: string | null) => {
      if (slug && chapters[slug]) setTarget(slug);
      input.current?.focus({ preventScroll: true });
    };

    const fromUrl = new URLSearchParams(window.location.search).get('chapter');
    if (fromUrl) focusFor(fromUrl);

    const requested = (event: Event) => focusFor((event as CustomEvent<string>).detail);
    window.addEventListener(ACCESS_REQUESTED_EVENT, requested);
    return () => window.removeEventListener(ACCESS_REQUESTED_EVENT, requested);
  }, [chapters]);

  useEffect(() => {
    if (access === false) trackPlaybook('cta_viewed', { signedIn: false }, { placement: 'hub' });
  }, [access]);

  const destination = `/playbook/${target ?? firstChapter}`;

  if (access === null) return <div className={styles.accessSlot} id={ACCESS_FORM_ID} />;

  if (access) {
    return (
      <div className={styles.accessSlot} id={ACCESS_FORM_ID}>
        <Link className={styles.submit} href={destination}>
          {copy.startLabel}
        </Link>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setMessage('');
    const readerEmail = email.trim().toLowerCase();
    trackPlaybook('cta_submitted', { signedIn: false }, { placement: 'hub', email: readerEmail });

    try {
      const response = await fetch('/api/playbook/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          company: honeypot.current?.value ?? '',
          renderedAt: renderedAt.current,
          utm: utmFromUrl(),
          mixpanelId: identifiedVisitorId(),
        }),
      });

      if (response.ok) {
        rememberVisitor({ visitorId: readVisitorId(await response.json().catch(() => null)), email: readerEmail, source: 'playbook_access' });
        trackPlaybook('course_accessed', { signedIn: false }, {
          placement: 'hub',
          email: readerEmail,
          target_chapter: target ?? firstChapter,
        });
        window.dispatchEvent(new Event(ACCESS_GRANTED_EVENT));
        window.location.assign(destination);
        return;
      }

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? copy.error);
      setState('error');
    } catch {
      setMessage(copy.error);
      setState('error');
    }
  };

  return (
    <div className={styles.accessSlot} id={ACCESS_FORM_ID}>
      {target ? (
        <p className={styles.gateNotice} role="status">
          {copy.gatePrefix} <strong>{chapters[target]}</strong>
        </p>
      ) : null}
      <form className={styles.accessForm} onSubmit={submit} noValidate>
        <label className={styles.srOnly} htmlFor={fieldId}>
          {copy.placeholder}
        </label>
        <input
          ref={input}
          id={fieldId}
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder={copy.placeholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={state === 'sending'}
        />

        {/* Hidden from sight and from assistive technology, and never tabbed to. */}
        <input
          ref={honeypot}
          className={styles.honeypot}
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <button className={styles.submit} type="submit" disabled={state === 'sending'}>
          {copy.submitLabel}
        </button>

        {state === 'error' ? (
          <p className={styles.error} role="alert">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/** Whatever UTM parameters brought the reader here, if any. */
function utmFromUrl(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ['source', 'medium', 'campaign', 'content', 'term']) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value;
  }
  return utm;
}
