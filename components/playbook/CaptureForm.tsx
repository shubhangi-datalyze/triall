'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { identifiedVisitorId, rememberVisitor } from '@/lib/mixpanel';
import { trackPlaybook, type PlaybookContext } from '@/lib/playbook/analytics';
import { readVisitorId } from '@/lib/visitor-id-client';
import { ACCESS_GRANTED_EVENT } from '@/lib/playbook/use-has-access';
import { useSignedIn } from '@/lib/playbook/use-signed-in';
import { useMarkSent } from './EmailGate';
import styles from './capture.module.css';

/**
 * The email form. One field, and nothing else.
 *
 * It never blocks reading: it lives inline in the page, never in a modal, and
 * a failed or slow submit leaves the chapter exactly where it was. On success
 * it swaps itself for a line of text rather than navigating away, because the
 * reader was in the middle of a chapter.
 *
 * Two anti-bot measures, neither of which costs the reader anything. The
 * honeypot field is hidden from sight and from screen readers, and a human
 * never fills it in. The render timestamp lets the endpoint reject a submit
 * that happened faster than a person could type.
 */

export type CaptureCopy = {
  placeholder: string;
  submitLabel: string;
  success: string;
  error: string;
  privacy: string;
};

export default function CaptureForm({
  copy,
  sourceSlug,
  compact,
  placement = 'inline',
  context,
}: {
  copy: CaptureCopy;
  /** The chapter this signup came from, so we can see what earns readers. */
  sourceSlug?: string;
  compact?: boolean;
  /** Which of the four asks this is, for the analytics. */
  placement?: string;
  context?: PlaybookContext;
}) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const honeypot = useRef<HTMLInputElement>(null);
  const renderedAt = useRef(Date.now());
  const fieldId = useId();
  const form = useRef<HTMLFormElement>(null);
  const seen = useRef(false);
  const signedIn = useSignedIn() === true;
  const markSent = useMarkSent();

  // cta_viewed means the ask was actually on screen, not merely on the page.
  // A form below the fold that nobody scrolled to did not get its chance.
  useEffect(() => {
    if (!context || !form.current) return;
    const node = form.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!seen.current && entries.some((entry) => entry.isIntersecting)) {
          seen.current = true;
          trackPlaybook('cta_viewed', { ...context, signedIn }, { placement });
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement]);

  if (state === 'sent') {
    return (
      <p className={styles.success} role="status">
        {copy.success}
      </p>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setMessage('');
    const readerEmail = email.trim().toLowerCase();
    if (context) trackPlaybook('cta_submitted', { ...context, signedIn }, { placement, email: readerEmail });

    try {
      const response = await fetch('/api/playbook/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          sourceSlug,
          placement,
          company: honeypot.current?.value ?? '',
          renderedAt: renderedAt.current,
          utm: utmFromUrl(),
          mixpanelId: identifiedVisitorId(),
        }),
      });

      if (response.ok) {
        rememberVisitor({ visitorId: readVisitorId(await response.json().catch(() => null)), email: readerEmail, source: 'playbook_signup' });
        // The request was accepted, which is when the link is queued. Whether
        // the mail provider then delivered it is not something the browser can
        // know; docs/playbook-tracking-plan.md says so.
        if (context) trackPlaybook('magic_link_sent', { ...context, signedIn }, { placement, email: readerEmail });
        setState('sent');
        // We have their email now: this form keeps its success line, and every
        // other ask on the page goes away (see EmailGate).
        markSent?.();
        window.dispatchEvent(new Event(ACCESS_GRANTED_EVENT));
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
    <form
      ref={form}
      className={compact ? styles.formCompact : styles.form}
      onSubmit={submit}
      noValidate
    >
      <label className={styles.srOnly} htmlFor={fieldId}>
        {copy.placeholder}
      </label>
      <input
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
      ) : (
        <p className={styles.privacy}>{copy.privacy}</p>
      )}
    </form>
  );
}

/** Whatever UTM parameters brought the reader here, if any. */
function utmFromUrl(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const key of ['source', 'medium', 'campaign', 'content', 'term']) {
    const value = params.get(`utm_${key}`);
    if (value) utm[key] = value;
  }
  return utm;
}
