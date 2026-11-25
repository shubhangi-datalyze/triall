'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import a from '@/components/account/account.module.css';
import { t as reviewT } from '@/components/tracking-agent/review/copy';
import { rich } from '@/lib/content/rich';
import { auditPath } from '@/lib/tracking-agent/audit';
import type { GitHubClient } from '@/lib/tracking-agent/github/client';
import { runFirstAudit, type ActionItem, type RepoFacts } from '@/lib/tracking-agent/repos';
import { auditBusy } from '@/lib/tracking-agent/runs';
import { T, plain, text } from './shared';
import s from './app.module.css';

/**
 * The app's shared pieces from the old dashboard (removed 25 Nov 2026; Audits is the home now):
 * Needs you, starting an audit, and which repos can be audited.
 */

/** The items whose button starts a run on GitHub rather than going somewhere. */
const DISPATCH = new Set<ActionItem['kind']>(['runFirstAudit', 'firstAuditFailed']);

/** Red: something broke. Amber: waiting on the person. Blue: a setup step. */
const ITEM_TONE: Partial<Record<ActionItem['kind'], 'bad' | 'warn'>> = {
  couldntCheck: 'warn',
  firstAuditFailed: 'bad',
  runFailed: 'bad',
  paymentFailed: 'bad',
  analyticsKey: 'bad',
  needsPerson: 'bad',
  fixNeedsPerson: 'bad',
  approve: 'warn',
  heldBack: 'warn',
  fixHeldBack: 'warn',
  unfinished: 'warn',
  answerAudit: 'warn',
  mergePlan: 'warn',
};
const toneOf = (i: ActionItem) => ITEM_TONE[i.kind] ?? 'run';
const RANK = { bad: 0, warn: 1, run: 2 } as const;

const split = (full: string) => ({ owner: full.split('/')[0] ?? '', repo: full.split('/')[1] ?? '' });

/** Everything that needs the person, worst first, each with its button. Hidden when there's nothing. */
export function NeedsYou({ items, repos, gh, onReload, dispatch }: { items: ActionItem[]; repos: RepoFacts[]; gh: GitHubClient | null; onReload?: () => void; dispatch: AuditDispatch }) {
  // A first audit just started: its row goes until GitHub lists the run (it shows under Activity). If
  // that run then fails or is cancelled, the row comes back as firstAuditFailed.
  const inFlight = (name: string) => {
    const facts = repos.find((r) => r.fullName === name);
    return dispatch.sent[name]?.state === 'started' && Boolean(facts && dispatch.busy(facts));
  };
  const shown = items.filter((i) => !(DISPATCH.has(i.kind) && i.repo && inFlight(i.repo))).sort((x, y) => RANK[toneOf(x)] - RANK[toneOf(y)]);
  const note = dispatch.note('needs');
  if (!shown.length && !note) return null;

  const run = (item: ActionItem) => {
    const facts = repos.find((r) => r.fullName === item.repo);
    if (facts) void dispatch.start(facts, 'needs');
  };
  const busyFor = (item: ActionItem) => {
    const facts = repos.find((r) => r.fullName === item.repo);
    return Boolean(facts && dispatch.busy(facts));
  };

  return (
    <section className={s.section} style={{ marginTop: 0 }} aria-label={plain('actions.label')}>
      <div className={s.sectionHead}>
        <T k="actions.label" as="h2" className={s.sectionTitle} />
        <span className={s.faint}>{shown.length}</span>
      </div>
      {note ? <T k={note === 'failed' ? 'actions.dispatchFailed' : 'actions.started'} as="p" className={note === 'failed' ? a.error : a.note} /> : null}
      {shown.length ? (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <tbody>
              {shown.map((item) => (
                <NeedRow key={`${item.kind}:${item.repo ?? ''}:${item.pr ?? ''}`} item={item} repos={repos} gh={gh} busy={busyFor(item)} onRun={() => run(item)} onReload={onReload} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function NeedRow({ item, repos, gh, busy, onRun, onReload }: { item: ActionItem; repos: RepoFacts[]; gh: GitHubClient | null; busy: boolean; onRun: () => void; onReload?: () => void }) {
  const k = `actions.items.${item.kind}`;
  const vars = {
    pr: String(item.pr ?? ''),
    title: item.title ?? '',
    tool: toolName(repos.find((r) => r.fullName === item.repo)?.analytics?.tool),
    job: item.run ? reviewT(`runs.jobs.${item.run.job}`) : '',
    done: String(item.done ?? ''),
    total: String(item.total ?? ''),
    why: item.why ? `${item.why.charAt(0).toUpperCase()}${item.why.slice(1).replace(/[.\s]+$/, '')}.` : '',
  };
  // An unfinished build whose counts aren't known (a draft fix with no work list) says so without them.
  const textKey = item.kind === 'unfinished' && item.total === undefined ? `${k}.textNoCount` : item.kind === 'firstAuditFailed' && item.run?.state === 'cancelled' ? `${k}.textCancelled` : item.kind === 'firstAuditFailed' && item.run?.state === 'done' ? `${k}.textNoResult` : `${k}.text`;
  // The pink button is for what's broken or waiting on the person; a setup step's button stays quiet.
  const btn = `${a.button} ${toneOf(item) === 'run' ? '' : a.buttonPrimary} ${s.small}`;
  const quiet = `${a.button} ${s.small}`;
  // A failed fix is started again from the audit screen, so that's the way back; the log is beside it.
  // So is a failed audit: its screen publishes the results when the run kept them, else it's run again from Repos.
  const auditAt = item.repo && (item.kind === 'mergePlan' || (item.kind === 'runFailed' && (item.run?.job === 'fix' || item.run?.job === 'audit' || item.run?.job === 'publish'))) ? auditPath(split(item.repo)) : null;

  return (
    <tr>
      <td className={`${s.stripe} ${s[`stripe-${toneOf(item)}`]}`} aria-hidden="true" />
      <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
        {item.repo ?? ''}
      </td>
      <td className={s.main}>
        <T k={textKey} vars={vars} />
      </td>
      <td>
        <span className={s.cellActions}>
          {item.run && (item.kind === 'firstAuditFailed' || item.kind === 'runFailed') ? (
            <a href={item.run.url} target="_blank" rel="noreferrer" className={quiet} data-ck="actions.log">
              {rich(text('actions.log'))}
            </a>
          ) : null}
          {item.kind === 'couldntCheck' ? (
            onReload ? (
              <button type="button" className={quiet} onClick={onReload} data-ck={`${k}.button`}>
                {rich(text(`${k}.button`))}
              </button>
            ) : null
          ) : item.kind === 'runFailed' ? (
            auditAt ? (
              <Link href={auditAt} className={btn} data-ck={`${k}.audit`}>
                {rich(text(`${k}.audit`))}
              </Link>
            ) : null
          ) : DISPATCH.has(item.kind) ? (
            <button type="button" className={btn} onClick={onRun} disabled={!gh || busy} data-ck={`${k}.button`}>
              {rich(text(`${k}.button`, vars))}
            </button>
          ) : (
            <>
              {item.kind === 'mergePlan' && auditAt ? (
                <Link href={auditAt} className={quiet} data-ck={`${k}.audit`}>
                  {rich(text(`${k}.audit`))}
                </Link>
              ) : null}
              {item.external ? (
                <a href={item.href} target="_blank" rel="noreferrer" className={btn} data-ck={`${k}.button`}>
                  {rich(text(`${k}.button`, vars))}
                </a>
              ) : (
                <Link href={item.href!} className={btn} data-ck={`${k}.button`}>
                  {rich(text(`${k}.button`, vars))}
                </Link>
              )}
            </>
          )}
        </span>
      </td>
    </tr>
  );
}

type Sent = { state: 'busy' | 'started' | 'failed'; from: 'needs' | 'repos'; /** Runs created from this time on are this audit's. */ since?: string; /** GitHub never listed it: stop waiting. */ gaveUp?: boolean };
export type AuditDispatch = {
  sent: Record<string, Sent>;
  /** Whether GitHub took it. */
  start: (r: RepoFacts, from: Sent['from']) => Promise<boolean>;
  /** Sending, a run going, or started and not listed by GitHub yet: no second audit. */
  busy: (r: RepoFacts) => boolean;
  /** The note over a table: its last audit started or refused. */
  note: (from: Sent['from']) => 'started' | 'failed' | undefined;
  /** A started audit GitHub hasn't listed yet. */
  waiting: boolean;
};
/** How long a started audit counts as on its way when GitHub doesn't list it. */
const LIST_WAIT_MS = 3 * 60_000;

/** Starting audits from the dashboard: one state for Needs you and Repos, so one click is one audit. */
export function useAuditDispatch(gh: GitHubClient | null, onReload?: () => void): AuditDispatch {
  const [sent, setSent] = useState<Record<string, Sent>>({});
  const sending = useRef(new Set<string>());
  const start = useCallback(
    async (r: RepoFacts, from: Sent['from']) => {
      if (!gh || sending.current.has(r.fullName)) return false;
      sending.current.add(r.fullName);
      setSent((m) => ({ ...m, [r.fullName]: { state: 'busy', from } }));
      // A minute back: the run's time is GitHub's clock, not this browser's.
      const since = new Date(Date.now() - 60_000).toISOString();
      try {
        await runFirstAudit(gh, r);
        setSent((m) => ({ ...m, [r.fullName]: { state: 'started', from, since } }));
        // GitHub lists a dispatched run a few seconds after it's created.
        if (onReload) setTimeout(onReload, 5000);
        setTimeout(() => setSent((m) => (m[r.fullName]?.since === since ? { ...m, [r.fullName]: { ...m[r.fullName]!, gaveUp: true } } : m)), LIST_WAIT_MS);
        return true;
      } catch {
        setSent((m) => ({ ...m, [r.fullName]: { state: 'failed', from } }));
        return false;
      } finally {
        sending.current.delete(r.fullName);
      }
    },
    [gh, onReload],
  );
  return {
    sent,
    start,
    busy: (r) => auditBusy(r.runs, sent[r.fullName]),
    note: (from) => {
      const last = Object.values(sent).filter((d) => d.from === from && d.state !== 'busy').at(-1);
      return last?.state === 'busy' ? undefined : last?.state;
    },
    waiting: Object.values(sent).some((d) => d.state === 'busy' || (d.state === 'started' && !d.gaveUp)),
  };
}

/**
 * A repo can be audited from here once its first plan is merged. Before that, Needs you has the
 * first audit (or its pull request), and another audit would write the first plan again.
 */
export const canAudit = (r: RepoFacts) => r.configOnDefault && (r.workflow === 'v2' || r.workflow === 'outdated') && r.hasPlan;
export const canFirstAudit = (r: RepoFacts) => r.configOnDefault && r.workflow !== 'v1' && !r.hasPlan && !r.firstPlanPr;

const TOOLS: Record<string, string> = { mixpanel: 'Mixpanel', posthog: 'PostHog', amplitude: 'Amplitude' };
export const toolName = (tool?: string) => (tool ? TOOLS[tool] ?? tool : '');
