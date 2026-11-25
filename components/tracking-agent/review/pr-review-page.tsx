'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import a from '@/components/account/account.module.css';
import { auditPath } from '@/lib/tracking-agent/audit';
import { useMaybeAccount } from '@/components/account/account-shell';
import { hasScopes, REVIEW_SCOPES, useGitHubSession } from '@/lib/tracking-agent/github/session';
import { screenFromServer } from '@/lib/tracking-agent/screen-client';
import { fixKind, isOAuthRestricted, reviewPath, type PrRef } from '@/lib/tracking-agent/review/inbox';
import { continueBuild, loadReview, saveReview, startReview, type ReviewData } from '@/lib/tracking-agent/review/proposal';
import { active } from '@/lib/tracking-agent/runs';
import { C } from './copy';
import { RestrictedHelp } from './inbox-view';
import { ProposalScreen, type SaveFn } from './proposal-screen';
import { GitHubUnknownPanel, SignInPanel } from './review-shell';
import { useWhileGoing } from '../use-while-going';

/** How often the page reads GitHub again while a run for this pull request is going. */
const WHILE_RUNNING_MS = 15_000;
/** How long after Approve the page keeps reading GitHub for the build's run to show. */
const APPROVED_WAIT_MS = 3 * 60_000;

/** /tracking-agent/review/[owner]/[repo]/[pr]: the pull request's proposal, from its branch. */
export function PrReviewPage({ owner, repo, pr }: { owner: string; repo: string; pr: string }) {
  const ref: PrRef = { owner, repo, number: Number(pr) };
  const { session, client, ready, unknown, retry } = useGitHubSession();
  const router = useRouter();
  const [data, setData] = useState<ReviewData | null>(null);
  const [failure, setFailure] = useState<'restricted' | 'notFound' | 'failed' | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  /** When Approve went in here: until its build's run is listed, the page reads GitHub again and says it's approved. */
  const [approvedAt, setApprovedAt] = useState<number | null>(null);

  const auth = useMaybeAccount()?.authHeader;
  // Which PR is on screen: a poll that fails while it shows keeps it, rather than swapping in the error page.
  const shown = useRef<string | null>(null);
  const load = useCallback(async () => {
    if (!client) return;
    const key = `${owner}/${repo}#${ref.number}`;
    setFailure(null);
    setDetail(null);
    try {
      // Read on the server with the Datalyze App (one call); in the browser only when it can't be.
      const server = await screenFromServer<ReviewData>(auth, 'review', { owner, repo, pr: ref.number, login: session?.login });
      setData(server ? server.data : await loadReview(client, ref));
      shown.current = key;
    } catch (error) {
      if (shown.current === key) return;
      console.error('[datalyze review] loading the PR failed', error);
      setDetail(String((error as Error)?.message ?? error).slice(0, 300));
      setFailure(isOAuthRestricted(error) ? 'restricted' : (error as { status?: number }).status === 404 ? 'notFound' : 'failed');
    }
    // ref is rebuilt each render from the route params; these three identify it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, client, owner, repo, pr, session]);

  useEffect(() => {
    void load();
  }, [load]);

  // A run for this pull request is going (a review, or the build after Approve), or Approve just went in:
  // read again until it ends. The approval is the run's trigger, so it can take a moment to be listed.
  const justApproved = approvedAt !== null && Date.now() - approvedAt < APPROVED_WAIT_MS;
  const going = Boolean(data?.runs.some(active)) || justApproved;

  // An open audit fix is carried on from the audit screen, where its work list is: go there, as the inbox does.
  const kind = data ? fixKind(data.pull.head.ref) : null;
  const isOpen = data?.pull.state === 'open';
  const toAudit = kind === 'auditFix' && isOpen;
  useEffect(() => {
    if (toAudit) router.replace(auditPath({ owner, repo }));
  }, [toAudit, router, owner, repo]);
  useWhileGoing(going, load, WHILE_RUNNING_MS);

  const save: SaveFn = useCallback(
    async (decisions, approve) => {
      if (!client || !session || !data) return { ok: false, refusal: { code: 'error', message: 'not signed in' } };
      const res = await saveReview({ client, data, login: session.login, decisions, approve, readSha: data.proposal?.sha, read: data.proposal?.proposal });
      if (res.ok) {
        if (approve) setApprovedAt(Date.now());
        await load();
      }
      return res;
    },
    [client, session, data, load],
  );

  const reviewAgain = useCallback(async () => {
    if (!client || !data) return false;
    try {
      await startReview(client, data.repo, data.pull);
      setTimeout(() => void load(), 5000);
      return true;
    } catch {
      return false;
    }
  }, [client, data, load]);

  // Continue the build: the same polling as after Approve, until its run is listed and ends.
  const continueIt = useCallback(async () => {
    if (!client || !data) return false;
    try {
      await continueBuild(client, data.repo, data.pull);
      setApprovedAt(Date.now());
      setTimeout(() => void load(), 5000);
      return true;
    } catch {
      return false;
    }
  }, [client, data, load]);

  if (!ready) return unknown ? <GitHubUnknownPanel onRetry={retry} /> : <div className={a.skeleton} style={{ height: 240 }} aria-busy="true" />;
  if (!session || !hasScopes(session, REVIEW_SCOPES)) return <SignInPanel returnTo={reviewPath(ref)} needsScopes={Boolean(session)} />;
  if (failure) {
    return (
      <>
        <section className={a.card}>
          <C k={`pr.failures.${failure}`} as="p" className={a.cardBody} vars={{ pr: `${owner}/${repo}#${pr}` }} />
          {failure === 'failed' && detail ? (
            <p className={a.note}>
              <C k="pr.failures.detail" /> <code>{detail}</code>
            </p>
          ) : null}
          <div className={a.cardActions}>
            <button type="button" className={a.button} onClick={() => void load()}>
              <C k="inbox.reload" />
            </button>
          </div>
        </section>
        {failure === 'restricted' ? <RestrictedHelp restricted={[owner]} /> : null}
      </>
    );
  }
  if (!data || toAudit) return <div className={a.skeleton} style={{ height: 320 }} aria-busy="true" />;
  // A fix pull request has no proposal; a closed one with none never had a review to show.
  const noProposal = !data.proposal && !data.proposalErrors.length;
  if (kind || (!isOpen && noProposal)) {
    const ended = data.pull.merged_at ? 'merged' : isOpen ? null : 'closed';
    const vars = { pr: `${owner}/${repo}#${pr}` };
    return (
      <section className={a.card}>
        <C k={`pr.notReviewed.${kind ?? 'none'}`} as="p" className={a.cardBody} vars={vars} />
        {ended ? <C k={`pr.notReviewed.${ended}`} as="p" className={a.note} /> : null}
        <div className={a.cardActions}>
          {kind === 'auditFix' ? (
            <Link href={auditPath({ owner, repo })} className={`${a.button} ${a.buttonPrimary}`}>
              <C k="pr.notReviewed.openAudit" />
            </Link>
          ) : null}
          <a href={data.pull.html_url} target="_blank" rel="noopener noreferrer" className={a.button}>
            <C k="pr.notReviewed.github" /> ↗
          </a>
        </div>
      </section>
    );
  }
  // Approved here and its build now listed (or the wait is over): the screen goes by what GitHub says.
  const approvedHere = justApproved && !data.runs.some((r) => r.job === 'implement' && active(r));
  // A merged or closed pull request takes no new run: no Review again, no Continue.
  return <ProposalScreen data={data} onSave={save} onReviewAgain={isOpen ? reviewAgain : undefined} onContinue={isOpen ? continueIt : undefined} approved={approvedHere} />;
}
