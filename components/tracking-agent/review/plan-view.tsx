'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import a from '@/components/account/account.module.css';
import { Chip, When, type Tone } from '@/components/tracking-agent/app/ui';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { useMaybeAccount } from '@/components/account/account-shell';
import { hasScopes, REVIEW_SCOPES, useGitHubSession } from '@/lib/tracking-agent/github/session';
import { screenFromServer } from '@/lib/tracking-agent/screen-client';
import { isOAuthRestricted } from '@/lib/tracking-agent/review/inbox';
import { filterPlan, loadPlan, PLAN_PATH, planPath, verifyPath, type PlanData, type PlanProperty, type Verified } from '@/lib/tracking-agent/verify';
import { firesAtText } from '@/tracking-agent/src/rules/fires-at';
import type { Status } from '@/tracking-agent/src/verify/check';
import { C, t } from './copy';
import { RestrictedHelp } from './inbox-view';
import { GitHubUnknownPanel, SignInPanel } from './review-shell';
import { ScreenHead } from './screen';
import x from './audit.module.css';
import s from './review.module.css';

/** A verification status as the screens show it: its copy key and tone. */
export const STATUS_KEY: Record<Status, string> = { passed: 'passed', problem: 'problem', couldnt_reach: 'couldntReach', waiting_on_person: 'waitingOnPerson', not_checked: 'notChecked' };
export const STATUS_TONE: Record<Status, Tone> = { passed: 'ok', problem: 'bad', couldnt_reach: 'warn', waiting_on_person: 'warn', not_checked: 'idle' };
export const LANDED_KEY: Record<string, string> = { ok: 'ok', pending: 'pending', not_found: 'notFound', not_measured: 'notMeasured' };
/** Properties listed in a plan row before "+N more". */
const PROPS_SHOWN = 3;

export const LANDED_TONE: Record<string, Tone> = { ok: 'ok', pending: 'run', not_found: 'bad', not_measured: 'idle' };

/** /tracking-agent/plan/[owner]/[repo]: the registry on the default branch (VERIFY.md §14). */
export function PlanPage({ owner, repo }: { owner: string; repo: string }) {
  const { session, client, ready, unknown, retry } = useGitHubSession();
  const [data, setData] = useState<PlanData | null>(null);
  const [failure, setFailure] = useState<'restricted' | 'notFound' | 'failed' | null>(null);
  const auth = useMaybeAccount()?.authHeader;
  const load = useCallback(async () => {
    if (!client) return;
    setFailure(null);
    try {
      // Read on the server with the Datalyze App (one call); in the browser only when it can't be.
      const server = await screenFromServer<PlanData>(auth, 'plan', { owner, repo });
      setData(server ? server.data : await loadPlan(client, { owner, repo }));
    } catch (error) {
      setFailure(isOAuthRestricted(error) ? 'restricted' : (error as { status?: number }).status === 404 ? 'notFound' : 'failed');
    }
  }, [auth, client, owner, repo]);
  useEffect(() => void load(), [load]);

  if (!ready) return unknown ? <GitHubUnknownPanel onRetry={retry} /> : <div className={a.skeleton} style={{ height: 240 }} aria-busy="true" />;
  if (!session || !hasScopes(session, REVIEW_SCOPES)) return <SignInPanel returnTo={planPath({ owner, repo })} needsScopes={Boolean(session)} />;
  if (failure) {
    return (
      <>
        <section className={a.card}>
          <C k={`trackingPlan.failures.${failure}`} as="p" className={a.cardBody} vars={{ repo: `${owner}/${repo}` }} />
          <div className={a.cardActions}>
            <button type="button" className={a.button} onClick={() => void load()}>
              <C k="trackingPlan.reload" />
            </button>
          </div>
        </section>
        {failure === 'restricted' ? <RestrictedHelp restricted={[owner]} /> : null}
      </>
    );
  }
  if (!data) return <div className={a.skeleton} style={{ height: 320 }} aria-busy="true" />;
  return <PlanView data={data} />;
}

export function PlanView({ data }: { data: PlanData }) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [intent, setIntent] = useState('');
  const [verified, setVerified] = useState<Verified>('all');
  const shown = useMemo(() => filterPlan(data.events, { q, area, intent, verified }), [data.events, q, area, intent, verified]);
  const name = `${data.repo.owner}/${data.repo.repo}`;
  return (
    <>
      <ScreenHead
        crumbs={<><Link href={PLAN_PATH}><C k="trackingPlan.crumb" /></Link> / {name}</>}
        title={<C k="trackingPlan.title" />}
        meta={<C k="trackingPlan.meta" vars={{ branch: data.defaultBranch, registry: data.registry }} />}
        actions={<Link className={a.button} href={verifyPath(data.repo)}><C k="trackingPlan.verifyLink" /></Link>}
      />
      {!data.events.length ? (
        <div className={t2.emptyState}><C k="trackingPlan.empty" as="p" vars={{ branch: data.defaultBranch }} /></div>
      ) : (
        <>
          <div className={s.filters} style={{ flexWrap: 'wrap', marginBottom: 12 }} role="group" aria-label={t('trackingPlan.filters.label')}>
            <input className={a.input} style={{ flex: '1 1 180px', width: 'auto', minWidth: 0 }} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('trackingPlan.search')} aria-label={t('trackingPlan.search')} />
            <select className={s.select} style={{ flex: '1 1 180px', width: 'auto', minWidth: 0 }} value={area} onChange={(e) => setArea(e.target.value)} aria-label={t('trackingPlan.filters.areaAll')}>
              <option value="">{t('trackingPlan.filters.areaAll')}</option>
              {data.areas.map((ar) => <option key={ar} value={ar}>{ar}</option>)}
            </select>
            <select className={s.select} style={{ flex: '1 1 180px', width: 'auto', minWidth: 0 }} value={intent} onChange={(e) => setIntent(e.target.value)} aria-label={t('trackingPlan.filters.statusAll')}>
              <option value="">{t('trackingPlan.filters.statusAll')}</option>
              {(['live', 'planned', 'deprecated'] as const).map((k) => <option key={k} value={k}>{t(`trackingPlan.intents.${k}`)}</option>)}
            </select>
            <select className={s.select} style={{ flex: '1 1 180px', width: 'auto', minWidth: 0 }} value={verified} onChange={(e) => setVerified(e.target.value as Verified)} aria-label={t('trackingPlan.filters.verifiedAll')}>
              <option value="all">{t('trackingPlan.filters.verifiedAll')}</option>
              <option value="never">{t('trackingPlan.filters.never')}</option>
              <option value="failed">{t('trackingPlan.filters.failed')}</option>
              <option value="passed">{t('trackingPlan.filters.passed')}</option>
            </select>
            <C k="trackingPlan.count" className={t2.faint} vars={{ n: String(shown.length) }} />
          </div>
          <div className={t2.tableWrap}>
            <table className={t2.table}>
              <thead>
                <tr>
                  <C k="trackingPlan.columns.event" as="th" />
                  <C k="trackingPlan.columns.area" as="th" />
                  <C k="trackingPlan.columns.properties" as="th" />
                  <C k="trackingPlan.columns.firesAt" as="th" />
                  <C k="trackingPlan.columns.verified" as="th" />
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.name}>
                    <td style={{ minWidth: 260, maxWidth: 480 }}>
                      <span className={s.mono} style={{ overflowWrap: 'normal' }}>{e.name}</span>
                      {e.intent !== 'live' ? <> <Chip tone="idle"><C k={`trackingPlan.intents.${e.intent}`} /></Chip></> : null}
                      {e.description ? <Description text={e.description} /> : null}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.area}</td>
                    <td>
                      <PropList props={e.properties} />
                    </td>
                    <td style={{ minWidth: 180 }}>{e.fires_at.length ? <span className={t2.clamp} style={{ whiteSpace: 'pre-line' }} title={firesAtText(e.fires_at)}>{firesAtText(e.fires_at)}</span> : <C k="trackingPlan.noFiresAt" className={t2.faint} />}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {e.last ? (
                        <>
                          <Chip tone={STATUS_TONE[e.last.status]}><C k={`verify.statuses.${STATUS_KEY[e.last.status]}`} /></Chip>{' '}
                          <span className={t2.faint}><When iso={e.last.date} day /></span>
                        </>
                      ) : <C k="trackingPlan.never" className={t2.faint} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/** Descriptions longer than this get a "Show more" toggle. */
const DESCRIPTION_CLAMP = 70;

/** An event's description: one line, and the whole of it behind "Show more", like the properties. */
export function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > DESCRIPTION_CLAMP;
  return (
    <>
      <div className={open || !long ? t2.faint : `${t2.faint} ${t2.clamp1}`} style={{ marginTop: 2, whiteSpace: 'normal' }} title={open ? undefined : text}>{text}</div>
      {long ? (
        <button type="button" className={x.moreEvents} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <C k={open ? 'trackingPlan.lessDescription' : 'trackingPlan.moreDescription'} />
        </button>
      ) : null}
    </>
  );
}

/** A row's properties: the first few, and the rest (with their conditions) behind "+N more". */
function PropList({ props }: { props: PlanProperty[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? props : props.slice(0, PROPS_SHOWN);
  return (
    <>
      {shown.map((p) => (
        <div key={p.name} style={{ whiteSpace: 'nowrap' }} title={p.only_when ? t('trackingPlan.onlyWhen', { when: p.only_when }) : undefined}>
          <span className={s.mono} style={{ overflowWrap: 'normal' }}>{p.name}</span> <span className={t2.faint}>{p.type}</span>
          {all && p.only_when ? <div className={t2.faint} style={{ whiteSpace: 'normal' }}><C k="trackingPlan.onlyWhen" vars={{ when: p.only_when }} /></div> : null}
        </div>
      ))}
      {props.length > PROPS_SHOWN ? (
        <button type="button" className={x.moreEvents} aria-expanded={all} onClick={() => setAll((v) => !v)}>
          <C k={all ? 'trackingPlan.fewerProps' : 'trackingPlan.moreProps'} vars={{ n: String(props.length - PROPS_SHOWN) }} />
        </button>
      ) : null}
    </>
  );
}
