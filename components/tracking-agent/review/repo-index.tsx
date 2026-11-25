'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import a from '@/components/account/account.module.css';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { GitHubCard, useLinkedRepos } from '@/components/tracking-agent/app/shared';
import { When } from '@/components/tracking-agent/app/ui';
import { mapLimit } from '@/lib/tracking-agent/review/inbox';
import { loadPlan, PLAN_PATH, planPath, VERIFY_PATH, verifyPath, type PlanData } from '@/lib/tracking-agent/verify';
import { C } from './copy';

type Kind = 'plan' | 'verify';
/** What a row shows: the repo's live events and its last verification, or that it couldn't be read. */
type Summary = { events: number; date: string | null; passed: number; problems: number } | 'failed';

export function summarise(plan: Pick<PlanData, 'events' | 'report'>): Exclude<Summary, 'failed'> {
  const live = plan.events.filter((e) => e.intent === 'live');
  return {
    events: live.length,
    date: plan.report?.run.date ?? null,
    passed: live.filter((e) => e.last?.status === 'passed').length,
    problems: live.filter((e) => e.last?.status === 'problem').length,
  };
}

/**
 * /tracking-agent/plan and /tracking-agent/verify: the linked repos as a table, as Audits shows them,
 * with each repo's events and last verification. One repo opens its screen straight away.
 */
export function RepoIndex({ kind }: { kind: Kind }) {
  const linked = useLinkedRepos({ proposals: false });
  const router = useRouter();
  const home = kind === 'plan' ? PLAN_PATH : VERIFY_PATH;
  const title = kind === 'plan' ? 'trackingPlan.title' : 'verify.title';
  const open = (fullName: string) => {
    const [owner = '', repo = ''] = fullName.split('/');
    return kind === 'plan' ? planPath({ owner, repo }) : verifyPath({ owner, repo });
  };
  const repos = linked.repos;
  const only = repos && !linked.loading && repos.length === 1 ? repos[0].fullName : null;

  useEffect(() => {
    if (only) router.replace(open(only));
    // open depends only on kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only, router]);

  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const key = repos && !linked.loading ? repos.map((r) => r.fullName).join(',') : '';
  useEffect(() => {
    const gh = linked.gh;
    if (!gh || !key || only) return;
    let live = true;
    void mapLimit(key.split(','), 3, async (fullName) => {
      const [owner = '', repo = ''] = fullName.split('/');
      const s: Summary = await loadPlan(gh, { owner, repo }).then(summarise, () => 'failed' as const);
      if (live) setSummaries((p) => ({ ...p, [fullName]: s }));
    });
    return () => {
      live = false;
    };
  }, [linked.gh, key, only]);

  if (linked.needsGitHub) return (<><C k={title} as="h1" className={a.pageTitle} /><GitHubCard returnTo={home} /></>);
  const p = kind === 'plan' ? 'trackingPlan.index' : 'verify.index';
  return (
    <>
      <C k={title} as="h1" className={a.pageTitle} />
      <C k={`${p}.intro`} as="p" className={a.note} />
      {repos === null || linked.loading || only ? <div className={a.skeleton} style={{ height: 120, marginTop: 16 }} aria-busy="true" /> : !repos.length ? (
        <C k="trackingPlan.noRepos" as="p" className={t2.emptyState} />
      ) : (
        <div className={t2.tableWrap} style={{ marginTop: 16 }}>
          <table className={t2.table}>
            <thead>
              <tr>
                <C k="verify.index.columns.repo" as="th" />
                {kind === 'plan' ? <C k="trackingPlan.index.events" as="th" className={t2.num} /> : null}
                <C k="verify.index.columns.last" as="th" />
                {kind === 'verify' ? (
                  <>
                    <C k="verify.index.columns.passed" as="th" className={t2.num} />
                    <C k="verify.index.columns.problems" as="th" className={t2.num} />
                  </>
                ) : null}
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {repos.map((r) => {
                const sum = summaries[r.fullName];
                const dash = <span className={t2.faint}>–</span>;
                const ready = sum && sum !== 'failed' ? sum : null;
                return (
                  <tr key={r.fullName}>
                    <td className={t2.mono} style={{ whiteSpace: 'nowrap' }}>{r.fullName}</td>
                    {kind === 'plan' ? <td className={t2.num}>{ready ? ready.events : dash}</td> : null}
                    <td>
                      {sum === 'failed' ? <C k="verify.index.unreadable" className={t2.faint} /> : !ready ? dash : ready.date ? <When iso={ready.date} day /> : <C k="verify.index.never" className={t2.faint} />}
                    </td>
                    {kind === 'verify' ? (
                      <>
                        <td className={t2.num}>{ready?.date ? ready.passed : dash}</td>
                        <td className={t2.num}>{ready?.date ? ready.problems : dash}</td>
                      </>
                    ) : null}
                    <td>
                      <span className={t2.cellActions}>
                        <Link href={open(r.fullName)} className={`${a.button} ${t2.small}`}><C k="verify.index.open" /></Link>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
