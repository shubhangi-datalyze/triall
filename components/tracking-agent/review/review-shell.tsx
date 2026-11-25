'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { BrandMark } from '@/components/account/brand';
import a from '@/components/account/account.module.css';
import { useGitHubSession, signInErrorKey, startSignIn, reviewSignInScopes } from '@/lib/tracking-agent/github/session';
import { C, G, t } from './copy';
import s from './review.module.css';

/**
 * The review pages' own frame: they need a GitHub sign-in, not a Datalyze
 * account, so this is not the Firebase AccountShell. The top bar shows the
 * GitHub user and sign-out, and links to the Tracking Agent dashboard.
 * `embedded`: inside the paid app's sidebar (an owner), just the GitHub user.
 */
export function ReviewShell({ children, embedded }: { children: ReactNode; embedded?: boolean }) {
  const { session, signOut } = useGitHubSession();
  // Inside the paid app's sidebar: the GitHub account already shows on Setup, under Connections.
  if (embedded) return <div className={s.page}>{children}</div>;
  return (
    <div className={`${a.app} ${s.page}`}>
      <header className={a.topbar}>
        <div className={a.topbarInner}>
          <div className={a.brandRow}>
            <Link href="/tracking-agent/review" className={a.brand} aria-label={t('shell.home')}>
              <BrandMark className={a.brandMark} />
            </Link>
            <C k="shell.product" className={s.product} />
          </div>
          <div className={a.right}>
            <nav className={a.nav}>
              <Link href="/tracking-agent/review" className={a.navLink}>
                <C k="shell.inbox" />
              </Link>
              <Link href="/tracking-agent/audits" className={a.navLink}>
                <C k="shell.dashboard" />
              </Link>
            </nav>
            {session ? (
              <div className={s.who}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={session.avatarUrl} alt="" className={s.ghAvatar} referrerPolicy="no-referrer" />
                <span className={s.whoLogin} title={`${t('shell.signedInAs')} @${session.login}`}>
                  @{session.login}
                </span>
                <button type="button" className={a.button} onClick={signOut}>
                  <G k="signOut" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main className={a.main}>{children}</main>
    </div>
  );
}

/**
 * While the GitHub sign-in couldn't be checked (useGitHubSession `unknown`): says so, with Retry,
 * instead of a sign-in button for someone who may well be signed in.
 */
export function GitHubUnknownPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <section className={a.card}>
      <C k="shell.unknown.title" as="h2" className={a.cardTitle} />
      <C k="shell.unknown.body" as="p" className={a.cardBody} />
      <div className={a.cardActions}>
        <button type="button" className={a.button} onClick={onRetry}>
          <C k="shell.unknown.retry" />
        </button>
      </div>
    </section>
  );
}

/** Signed out: what the review screens are, the GitHub sign-in button and the privacy line. */
export function SignInPanel({ returnTo, needsScopes }: { returnTo: string; needsScopes?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'notConfigured' | 'startFailed' | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await startSignIn(reviewSignInScopes(), returnTo);
    } catch (e) {
      setBusy(false);
      setError(signInErrorKey(e) === 'signIn.notConfigured' ? 'notConfigured' : 'startFailed');
    }
  };
  return (
    <>
      <header className={a.pageHead}>
        <C k="signedOut.title" as="h1" className={a.pageTitle} />
        <C k="signedOut.intro" as="p" className={a.pageIntro} />
      </header>
      <section className={a.card}>
        <ul className={s.list}>
          <C k="signedOut.points.0" as="li" />
          <C k="signedOut.points.1" as="li" />
          <C k="signedOut.points.2" as="li" />
        </ul>
        {needsScopes ? <C k="signedOut.moreAccess" as="p" className={a.notice} /> : null}
        <div className={a.cardActions}>
          <button type="button" className={`${a.button} ${a.buttonPrimary}`} onClick={go} disabled={busy} aria-busy={busy}>
            {busy ? <G k="working" /> : <G k="button" />}
          </button>
        </div>
        <G k="privacy" as="p" className={a.note} />
        {error ? (
          <div role="alert">
            <G k={error} as="p" className={a.error} />
          </div>
        ) : null}
      </section>
    </>
  );
}
