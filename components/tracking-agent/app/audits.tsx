'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import a from '@/components/account/account.module.css';
import { useAccount } from '@/components/account/account-shell';
import { rich } from '@/lib/content/rich';
import { AUDITS_PATH, auditPath, readConfig } from '@/lib/tracking-agent/audit';
import type { GitHubClient } from '@/lib/tracking-agent/github/client';
import { loadAuditRows, type AuditRow, type RowPr } from '@/lib/tracking-agent/history';
import { mapLimit } from '@/lib/tracking-agent/review/inbox';
import { actionItems, isStale, paymentFailed, SETUP_PAGE, type ActionItem, type RepoFacts } from '@/lib/tracking-agent/repos';
import { active } from '@/lib/tracking-agent/runs';
import { canAudit, canFirstAudit, NeedsYou, useAuditDispatch, type AuditDispatch } from './dashboard';
import { useWhileGoing } from '../use-while-going';
import { Chip, When, type Tone } from './ui';
import { ConnectForChanges, GitHubCard, PageHead, T, UnreadNotice, text, useLinkedRepos } from './shared';
import s from './app.module.css';

/**
 * /tracking-agent/audits, the app's home (25 Nov 2026; it replaces the dashboard): Start a new audit
 * (or "an audit is running", with a link to it), then every audit in one table: when, whether it
 * finished, its pull requests and whether it's complete. Above them, only what needs the person and
 * isn't an audit's or a pull request's own: setup, keys, payment. Those have their own pages.
 */
export function AuditsPage() {
  const { account } = useAccount();
  const linked = useLinkedRepos();
  const dispatch = useAuditDispatch(linked.gh, linked.reload);
  useWhileGoing(dispatch.waiting || Boolean(linked.repos?.some((r) => r.runs.some(active))), linked.refresh);
  if (linked.needsGitHub) {
    return (
      <>
        <PageHead title="audits.title" />
        <GitHubCard returnTo={AUDITS_PATH} />
      </>
    );
  }
  const repos = linked.repos;
  const items = repos ? actionItems({ repos, paymentFailed: paymentFailed(account) }).filter((i) => ELSEWHERE_NOT.has(i.kind)) : [];
  return (
    <>
      <PageHead title="audits.title" />
      <ConnectForChanges linked={linked} returnTo={AUDITS_PATH} />
      {linked.error ? (
        <div className={a.card}>
          <T k="dashboard.error" as="p" className={a.cardBody} />
          <div className={a.cardActions}>
            <button type="button" className={a.button} onClick={linked.reload} data-ck="dashboard.reload">
              {rich(text('dashboard.reload'))}
            </button>
          </div>
        </div>
      ) : !repos || (linked.loading && !repos.length) ? (
        <div aria-busy="true">
          <T k="dashboard.loading" as="p" className={a.note} />
          <div className={a.skeleton} style={{ height: 56, marginTop: 12 }} />
        </div>
      ) : !repos.length && !linked.unread && !linked.unseen && !linked.waiting ? (
        <div className={s.emptyState}>
          <T k="dashboard.noRepos" />
          <Link href={SETUP_PAGE} className={`${a.button} ${a.buttonPrimary}`} data-ck="dashboard.addRepo">
            {rich(text('dashboard.addRepo'))}
          </Link>
        </div>
      ) : (
        <AuditsBody repos={repos} gh={linked.gh} done={!linked.loading} items={items} dispatch={dispatch} unread={linked.unread && !linked.loading ? linked.unread : 0} unseen={linked.unseen} onReload={linked.reload} />
      )}
    </>
  );
}

/** What's left on this page of Needs you: setup, the workflow, keys, payment and runs that aren't an audit's. */
const ELSEWHERE_NOT = new Set<ActionItem['kind']>(['mergeSetup', 'setupNotMerged', 'updateWorkflow', 'refreshWorkflow', 'goLive', 'runFailed', 'analyticsKey', 'couldntCheck', 'paymentFailed']);

function AuditsBody({ repos, gh, done, items, dispatch, unread, unseen = 0, onReload }: { repos: RepoFacts[]; gh: GitHubClient | null; done: boolean; items: ActionItem[]; dispatch: AuditDispatch; unread: number; unseen?: number; onReload: () => void }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Read again when a repo's audit or audit runs change: the runs' states are in the key.
  const key = done ? repos.map((r) => `${r.fullName}@${r.latestAudit?.generatedAt ?? ''}:${r.runs.filter((x) => x.job === 'audit').map((x) => `${x.id}${x.state}`).join('.')}`).join(',') : '';

  useEffect(() => {
    if (!gh || !key) return;
    let live = true;
    setFailed(false);
    // Each repo's registry is in its config, which says where its audit.json is.
    const audited = repos.filter((r) => r.configOnDefault && !isStale(r, 'config'));
    mapLimit(audited, 3, (r) => {
      const [owner = '', repo = ''] = r.fullName.split('/');
      return loadAuditRows(gh, { owner, repo }, readConfig(r.config).registry, r.runs);
    })
      .then((lists) => live && setRows(lists.flat().sort((x, y) => Date.parse(y.at) - Date.parse(x.at))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // The key stands for the repos, their latest audits and their audit runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh, key]);

  return (
    <>
      {unseen ? <T k={unseen === 1 ? 'dashboard.unseenOne' : 'dashboard.unseen'} vars={{ n: String(unseen) }} as="p" className={a.note} /> : null}
      {unread ? <UnreadNotice n={unread} onRetry={onReload} /> : null}
      {items.length ? <NeedsYou items={items} repos={repos} gh={gh} onReload={onReload} dispatch={dispatch} /> : null}
      <StartAudits repos={repos} gh={gh} rows={rows} dispatch={dispatch} />
      <section className={s.section}>
        {!gh ? (
          <T k="audits.table.needsGitHub" as="p" className={a.note} />
        ) : failed ? (
          <T k="audits.table.error" as="p" className={a.error} />
        ) : !rows ? (
          <div aria-busy="true">
            <T k="audits.table.loading" as="p" className={a.note} />
          </div>
        ) : !rows.length ? (
          <T k="audits.table.empty" as="p" className={s.faint} />
        ) : (
          <AuditTable rows={rows} manyRepos={repos.length > 1} />
        )}
      </section>
    </>
  );
}

/**
 * Start a new audit, one line per repo that can be audited. An audit going: no button, a link to it.
 * The newest audit not complete: a new one replaces it and its answers, so that's asked first.
 */
function StartAudits({ repos, gh, rows, dispatch }: { repos: RepoFacts[]; gh: GitHubClient | null; rows: AuditRow[] | null; dispatch: AuditDispatch }) {
  const router = useRouter();
  const [asking, setAsking] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const lines = repos.filter((r) => !isStale(r, 'config') && (canAudit(r) || canFirstAudit(r) || dispatch.busy(r)));
  if (!lines.length) return null;
  const go = async (r: RepoFacts) => {
    setAsking(null);
    setRefused(null);
    const [owner = '', repo = ''] = r.fullName.split('/');
    if (await dispatch.start(r, 'repos')) router.push(`${auditPath({ owner, repo })}?started=1`);
    else setRefused(r.fullName);
  };
  return (
    <section className={s.section}>
      {lines.map((r) => {
        const [owner = '', repo = ''] = r.fullName.split('/');
        const sending = dispatch.sent[r.fullName]?.state === 'busy';
        // Its newest audit isn't complete: starting another replaces it.
        const open = Boolean(rows?.some((x) => x.repo === r.fullName && x.kind === 'audit' && x.latest && x.status === 'open'));
        return (
          <div key={r.id} className={a.card} style={{ marginBottom: 12 }}>
            {dispatch.busy(r) && !sending ? (
              <div className={s.sectionHead} style={{ marginBottom: 0 }}>
                <span>
                  <Chip tone="run">
                    <T k="audits.table.results.running" />
                  </Chip>{' '}
                  <T k="audits.start.running" vars={{ repo: r.fullName }} />
                </span>
                <Link href={auditPath({ owner, repo })} className={`${a.button} ${a.buttonPrimary} ${s.small}`} data-ck="audits.start.view">
                  {rich(text('audits.start.view'))}
                </Link>
              </div>
            ) : asking === r.fullName ? (
              <div className={s.sectionHead} style={{ marginBottom: 0 }}>
                <T k="audits.start.confirm" vars={{ repo: r.fullName }} />
                <span className={s.cellActions}>
                  <button type="button" className={`${a.button} ${s.small}`} onClick={() => setAsking(null)} data-ck="audits.start.cancel">
                    {rich(text('audits.start.cancel'))}
                  </button>
                  <button type="button" className={`${a.button} ${a.buttonPrimary} ${s.small}`} onClick={() => void go(r)} data-ck="audits.start.confirmYes">
                    {rich(text('audits.start.confirmYes'))}
                  </button>
                </span>
              </div>
            ) : (
              <div className={s.sectionHead} style={{ marginBottom: 0 }}>
                <span className={s.mono}>{r.fullName}</span>
                <button type="button" className={`${a.button} ${a.buttonPrimary} ${s.small}`} disabled={!gh || sending} onClick={() => (open ? setAsking(r.fullName) : void go(r))} data-ck={sending ? 'audits.start.starting' : 'audits.start.button'}>
                  {rich(text(sending ? 'audits.start.starting' : 'audits.start.button'))}
                </button>
              </div>
            )}
            {refused === r.fullName ? <T k="audits.start.failed" as="p" className={a.error} /> : null}
          </div>
        );
      })}
    </section>
  );
}

const RESULT_TONE: Record<AuditRow['kind'], Tone> = { audit: 'ok', running: 'run', failed: 'bad' };
const STATUS_TONE: Record<'complete' | 'open' | 'replaced', Tone> = { complete: 'ok', open: 'warn', replaced: 'idle' };

function PrLink({ pr, k }: { pr: RowPr; k: 'pr' | 'planPr' }) {
  return (
    <a href={pr.url} target="_blank" rel="noreferrer" className={s.link}>
      {rich(text(`audits.table.${k}`, { n: String(pr.number) }))} <span className={s.faint}>{rich(text(`audits.table.prStates.${pr.state}`))}</span>
    </a>
  );
}

/** Every audit, newest first: one row each, and one for an audit run going or failed. */
function AuditTable({ rows, manyRepos }: { rows: AuditRow[]; manyRepos: boolean }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <T k="audits.table.columns.when" as="th" />
            {manyRepos ? <T k="audits.table.columns.repo" as="th" /> : null}
            <T k="audits.table.columns.result" as="th" />
            <T k="audits.table.columns.findings" as="th" className={s.num} />
            <T k="audits.table.columns.prs" as="th" />
            <T k="audits.table.columns.status" as="th" />
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const [owner = '', repo = ''] = r.repo.split('/');
            const page = auditPath({ owner, repo });
            return (
              <tr key={`${r.repo}@${r.kind}@${r.at}`}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <When iso={r.at} />
                </td>
                {manyRepos ? <td className={s.mono}>{r.repo}</td> : null}
                <td>
                  <Chip tone={RESULT_TONE[r.kind]}>
                    <T k={`audits.table.results.${r.kind}`} />
                  </Chip>
                </td>
                <td className={s.num}>{r.kind === 'audit' ? r.findings : <span className={s.faint}>–</span>}</td>
                <td>
                  {r.kind === 'audit' && (r.planPr || r.fixPr) ? (
                    <span style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap' }}>
                      {[r.planPr && <PrLink key="plan" pr={r.planPr} k="planPr" />, r.fixPr && <PrLink key="fix" pr={r.fixPr} k="pr" />].filter(Boolean).map((x, i) => (
                        <Fragment key={i}>{x}</Fragment>
                      ))}
                    </span>
                  ) : (
                    <span className={s.faint}>–</span>
                  )}
                </td>
                <td>
                  {r.kind === 'audit' ? (
                    <Chip tone={STATUS_TONE[r.status]}>
                      <T k={`audits.table.statuses.${r.status}`} />
                    </Chip>
                  ) : (
                    <span className={s.faint}>–</span>
                  )}
                </td>
                <td>
                  <span className={s.cellActions}>
                    {r.kind === 'failed' ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className={`${a.button} ${s.small}`} data-ck="audits.table.log">
                        {rich(text('audits.table.log'))}
                      </a>
                    ) : (
                      <Link href={r.kind === 'audit' && !r.latest ? `${page}?at=${r.commit}` : page} className={`${a.button} ${s.small}`} data-ck="audits.table.open">
                        {rich(text('audits.table.open'))}
                      </Link>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The Audits page from fixtures, for the /admin preview: Needs you, and a table with a row per state. */
export function AuditsPreview({ repos, items }: { repos: RepoFacts[]; items: ActionItem[] }) {
  const dispatch = useAuditDispatch(null);
  const pr = (number: number, state: RowPr['state']): RowPr => ({ number, url: '#', state });
  const rows: AuditRow[] = [
    { kind: 'running', repo: 'acme/shop', at: '2026-11-24T09:00:00Z', url: '#' },
    { kind: 'failed', repo: 'acme/shop', at: '2026-11-22T09:00:00Z', url: '#' },
    { kind: 'audit', repo: 'acme/shop', at: '2026-11-20T09:00:00Z', commit: 'c3', health: 82, findings: 6, latest: true, fixPr: pr(415, 'open'), planPr: null, status: 'open' },
    { kind: 'audit', repo: 'acme/shop', at: '2026-11-10T09:00:00Z', commit: 'c2', health: 74, findings: 9, latest: false, fixPr: null, planPr: null, status: 'replaced' },
    { kind: 'audit', repo: 'acme/shop', at: '2026-11-01T09:00:00Z', commit: 'c1', health: 61, findings: 12, latest: false, fixPr: pr(402, 'merged'), planPr: pr(399, 'merged'), status: 'complete' },
  ];
  return (
    <>
      <PageHead title="audits.title" />
      <NeedsYou items={items.filter((i) => ELSEWHERE_NOT.has(i.kind))} repos={repos} gh={null} dispatch={dispatch} />
      <StartAudits repos={repos.slice(0, 1)} gh={null} rows={rows} dispatch={dispatch} />
      <AuditTable rows={rows} manyRepos={false} />
    </>
  );
}
