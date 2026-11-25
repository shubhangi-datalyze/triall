'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import a from '@/components/account/account.module.css';
import { Chip, shortDay, When, type Tone } from '@/components/tracking-agent/app/ui';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { useMaybeAccount } from '@/components/account/account-shell';
import { canWrite, dispatchErrorKey, saveFixAnswers } from '@/lib/tracking-agent/audit';
import { hasScopes, REVIEW_SCOPES, useGitHubSession } from '@/lib/tracking-agent/github/session';
import { isOAuthRestricted } from '@/lib/tracking-agent/review/inbox';
import { active, loadRuns } from '@/lib/tracking-agent/runs';
import { reviveVerify, screenFromServer, type SerializedVerify } from '@/lib/tracking-agent/screen-client';
import { costEstimate, type CostRates } from '@/lib/tracking-agent/verify-runs/estimate';
import {
  changedSinceVerified, continueVerifyFix, estimate, runFromQuery, saveVerifyNotes, sinceRun, type FixNotes, failedLast, filterPlan, findingStatuses, fixedToReverify, loadVerification, loadVerifyRun, neverVerified, pendingLanding, planPath, verifyRun,
  startCommand, startRecheck, startSheet, startVerifyFix, VERIFY_BRANCH, VERIFY_PATH, verifyPath, type PlanEvent, type Picked, type VerifyData,
} from '@/lib/tracking-agent/verify';
import type { Status } from '@/tracking-agent/src/verify/check';
import type { FindingState, FindingStatus, HistoryRun } from '@/tracking-agent/src/verify/history';
import type { Evidence, VerifyFinding, VerifyReport } from '@/tracking-agent/src/verify/report';
import { FindingEvents, FixPanel, SEVERITY_CLASS, type AuditStatus, type OnFixAnswer } from './audit-view';
import { C, t } from './copy';
import { useWhileGoing } from '../use-while-going';
import { RestrictedHelp } from './inbox-view';
import { codeLink } from './item-card';
import { Description, LANDED_KEY, LANDED_TONE, STATUS_KEY, STATUS_TONE } from './plan-view';
import { GitHubUnknownPanel, SignInPanel } from './review-shell';
import { RunList } from './runs';
import { NoteBox, ScreenHead, Stats, Tabs } from './screen';
import x from './audit.module.css';
import s from './review.module.css';

type Act = 'fix' | 'recheck' | 'continue' | 'sheet';
export type VerifyStatus = { busy: Act } | { sent: Act } | { error: 'notFound' | 'forbidden' | 'failed'; message: string };
export type OnVerifyRun = (what: Act, ids?: string[], said?: FixNotes) => Promise<VerifyStatus>;

const WHILE_RUNNING_MS = 15_000;

/** /tracking-agent/verify/[owner]/[repo]: the latest verification report, every run before it, and a run's picks (VERIFY.md §14, §20). */
export function VerifyPage({ owner, repo }: { owner: string; repo: string }) {
  const { session, client, ready, unknown, retry } = useGitHubSession();
  const [data, setData] = useState<VerifyData | null>(null);
  const [failure, setFailure] = useState<'restricted' | 'notFound' | 'failed' | null>(null);
  const auth = useMaybeAccount()?.authHeader;
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const load = useCallback(async () => {
    if (!client || !session) return;
    setFailure(null);
    try {
      // Read on the server with the Datalyze App (one call); in the browser only when it can't be.
      const server = await screenFromServer<SerializedVerify>(auth, 'verify', { owner, repo, login: session.login });
      if (server) {
        const canRun = server.canRun ?? (await client.permission({ owner, repo }, session.login).then(canWrite).catch(() => false));
        setData({ ...reviveVerify(server.data), canRun });
      } else setData(await loadVerification(client, { owner, repo }, session.login));
    } catch (error) {
      setFailure(isOAuthRestricted(error) ? 'restricted' : (error as { status?: number }).status === 404 ? 'notFound' : 'failed');
    }
  }, [auth, client, session, owner, repo]);
  useEffect(() => void load(), [load]);
  const going = Boolean(data?.runs.some(active));
  // While a run is going, only the runs list is read (one call); everything once a run ends.
  const readRuns = useCallback(() => {
    if (!client) return;
    void loadRuns(client, { owner, repo }).then((runs) => {
      const mine = runs.filter(verifyRun);
      const before = dataRef.current?.runs ?? [];
      // A run that was going has ended: what it changed (a fix, a recheck) is read in full.
      if (before.some((r) => active(r) && !mine.some((m) => m.id === r.id && active(m)))) void load();
      else setData((d) => (d ? { ...d, runs: mine } : d));
    }).catch(() => undefined);
  }, [client, owner, repo, load]);
  useWhileGoing(going && Boolean(client), readRuns, WHILE_RUNNING_MS);

  // An earlier run's full report, read when it's opened from History.
  const loadRun = useCallback(async (sha: string): Promise<VerifyReport | null> => {
    if (!client || !data) return null;
    const server = await screenFromServer<VerifyReport | null>(auth, 'verifyRun', { owner, repo, registry: data.registry, sha, login: session?.login });
    return server ? server.data : loadVerifyRun(client, { owner, repo }, data.registry, sha).catch(() => null);
  }, [auth, client, data, owner, repo, session]);

  const run = useCallback<OnVerifyRun>(async (what, ids, said) => {
    if (!client || !data) return { error: 'failed', message: 'not signed in' };
    try {
      if (what === 'fix') {
        // The notes go first, so the implement run finds them (VERIFY.md §24 point 7).
        if (data.report && session) await saveVerifyNotes(client, data, data.report, ids ?? [], said ?? { notes: {}, note: '' }, session.login);
        await startVerifyFix(client, data, ids ?? []);
      }
      else if (what === 'continue') await continueVerifyFix(client, data);
      else if (what === 'sheet') await startSheet(client, data);
      else await startRecheck(client, data);
      setTimeout(() => void load(), 5000);
      return { sent: what };
    } catch (error) {
      return { error: dispatchErrorKey(error), message: (error as Error)?.message ?? String(error) };
    }
  }, [client, data, load, session]);

  // Answers to the fix's held-back questions, committed to its work list as the audit's are.
  const answer = useCallback<OnFixAnswer>(async (answers) => {
    if (!client || !session || !data?.fix) return 'not signed in';
    try {
      await saveFixAnswers(client, data, data.fix, answers, session.login);
      await load();
      return null;
    } catch (error) {
      return (error as Error)?.message ?? String(error);
    }
  }, [client, session, data, load]);

  if (!ready) return unknown ? <GitHubUnknownPanel onRetry={retry} /> : <div className={a.skeleton} style={{ height: 240 }} aria-busy="true" />;
  if (!session || !hasScopes(session, REVIEW_SCOPES)) return <SignInPanel returnTo={verifyPath({ owner, repo })} needsScopes={Boolean(session)} />;
  if (failure) {
    return (
      <>
        <section className={a.card}>
          <C k={`trackingPlan.failures.${failure}`} as="p" className={a.cardBody} vars={{ repo: `${owner}/${repo}` }} />
          <div className={a.cardActions}>
            <button type="button" className={a.button} onClick={() => void load()}><C k="trackingPlan.reload" /></button>
          </div>
        </section>
        {failure === 'restricted' ? <RestrictedHelp restricted={[owner]} /> : null}
      </>
    );
  }
  if (!data) return <div className={a.skeleton} style={{ height: 320 }} aria-busy="true" />;
  // A first visit, nothing set up and nothing verified: setup is the only way in (FirstVisit sends them there).
  if (!data.environments.length && !data.history.length && data.canRun) return <FirstVisit to={`${verifyPath({ owner, repo })}/setup`} />;
  return <VerifyView data={data} onRun={run} onFixAnswer={answer} onLoadRun={loadRun} />;
}

function FirstVisit({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => router.replace(to), [router, to]);
  return <div className={a.skeleton} style={{ height: 320 }} aria-busy="true" />;
}

/** Statuses that mean the run didn't check the event: shown together as Skipped. */
const SKIPPED: Status[] = ['not_checked', 'couldnt_reach', 'waiting_on_person'];

const countOf = (r: VerifyReport) => {
  const all = [...r.results.map((x) => x.status), ...(r.not_done ?? []).map((n) => n.status as Status)];
  const n = (...st: Status[]) => all.filter((x) => st.includes(x)).length;
  return { passed: n('passed'), problem: n('problem'), skipped: n(...SKIPPED) };
};

type Tab = 'report' | 'history' | 'start';

export function VerifyView({ data, onRun, onFixAnswer, onLoadRun, copy }: { data: VerifyData; onRun: OnVerifyRun; onFixAnswer?: OnFixAnswer; onLoadRun?: (sha: string) => Promise<VerifyReport | null>; copy?: (text: string) => Promise<void> }) {
  const [tab, setTab] = useState<Tab>(data.report ? 'report' : 'start');
  // The run the Report tab shows: the latest unless one was opened from History.
  const [viewing, setViewing] = useState<string | null>(null);
  // Events to pick when Start opens from "Verify again".
  const [preset, setPreset] = useState<{ names: string[]; n: number } | null>(null);
  // Earlier runs' full reports, read when opened: the history file holds only a short one (VERIFY.md §20).
  const [full, setFull] = useState<Record<string, VerifyReport | 'loading' | 'missing'>>({});
  const name = `${data.repo.owner}/${data.repo.repo}`;
  const newest = data.history[0] ?? null;
  const picked = (viewing ? data.history.find((h) => h.key === viewing) : null) ?? newest;
  const got = picked ? full[picked.key] : undefined;
  const shown = picked && typeof got === 'object' ? { ...picked, report: got, slim: false } : picked;
  const open = (key: string, remember = true) => {
    setViewing(key);
    setTab('report');
    // The run's own address: the same result after a refresh, and what the Run view's Proceed opens.
    if (remember && typeof window !== 'undefined') window.history.replaceState(null, '', `${verifyPath(data.repo)}?${new URLSearchParams({ report: key })}`);
    const h = data.history.find((x) => x.key === key);
    if (!h?.slim || !h.sha || !onLoadRun || full[key]) return;
    setFull((f) => ({ ...f, [key]: 'loading' }));
    void onLoadRun(h.sha).then((rep) => setFull((f) => ({ ...f, [key]: rep ?? 'missing' })), () => setFull((f) => ({ ...f, [key]: 'missing' })));
  };
  // ?report=<run id> (Proceed, a refresh) or ?commit=<sha> (an older worker's Proceed) opens that run.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const q = new URLSearchParams(window.location.search);
    const key = runFromQuery(data.history, q.get('report'), q.get('commit'));
    if (key) open(key, false);
    // Once, on the first load: later loads keep what the person chose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const r = data.report;
  const problems = r ? countOf(r).problem : null;
  const verifyAgain = (names: string[]) => {
    setPreset((p) => ({ names, n: (p?.n ?? 0) + 1 }));
    setTab('start');
  };
  return (
    <>
      <ScreenHead
        crumbs={<><Link href={VERIFY_PATH}><C k="verify.crumb" /></Link> / {name}</>}
        title={<C k="verify.title" />}
        meta={r ? (
          <>
            <C k="verify.meta" vars={{ date: shortDay(r.run.date), environment: r.run.environment }} />
            {r.run.served?.commit && r.run.served.matches === false ? <> <C k="verify.servedOther" vars={{ served: r.run.served.commit.slice(0, 7) }} /></> : null}
          </>
        ) : undefined}
        actions={<Link className={a.button} href={planPath(data.repo)}><C k="trackingPlan.title" /></Link>}
      />
      <Tabs<Tab>
        label={t('verify.tabs.label')}
        items={[['report', 'verify.tabs.report', problems || null], ['history', 'verify.tabs.history', data.history.length > 1 ? data.history.length : null], ['start', 'verify.tabs.start', null]]}
        value={tab}
        onChange={(k) => {
          if (k === 'report') {
            setViewing(null);
            window.history.replaceState(null, '', verifyPath(data.repo));
          }
          setTab(k);
        }}
      />
      {tab === 'report' ? (
        got === 'loading' ? <div className={a.skeleton} style={{ height: 320 }} aria-busy="true" /> : <Report data={data} run={shown} onRun={onRun} onFixAnswer={onFixAnswer} onStart={() => setTab('start')} onBack={() => { setViewing(null); window.history.replaceState(null, '', verifyPath(data.repo)); }} onVerifyAgain={verifyAgain} />
      ) : tab === 'history' ? (
        <History data={data} onOpen={open} />
      ) : (
        <Start key={preset?.n ?? 0} data={data} copy={copy} initial={preset?.names ?? []} />
      )}
      {data.runs.length ? (
        <section className={t2.section}>
          <div className={t2.sectionHead}><C k="verify.runs" as="h2" className={t2.sectionTitle} /></div>
          <RunList runs={data.runs} />
        </section>
      ) : null}
    </>
  );
}

function Report({ data, run, onRun, onFixAnswer, onStart, onBack, onVerifyAgain }: {
  data: VerifyData;
  run: HistoryRun | null;
  onRun: OnVerifyRun;
  onFixAnswer?: OnFixAnswer;
  onStart: () => void;
  onBack: () => void;
  onVerifyAgain: (names: string[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // The person's notes for Fix: one per finding, and one for the whole fix (as the audit's note).
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<VerifyStatus | null>(null);
  const statuses = useMemo(() => (run ? findingStatuses(data, run) : new Map<string, FindingStatus>()), [data, run]);
  const again = useMemo(() => fixedToReverify(data), [data]);
  if (!run) {
    return (
      <div className={t2.emptyState}>
        <C k="verify.empty" as="p" />
        <button type="button" className={`${a.button} ${a.buttonPrimary}`} onClick={onStart}><C k="verify.tabs.start" /></button>
      </div>
    );
  }
  const r = run.report;
  const latest = run.key === data.history[0]?.key;
  // Fix, Continue, Recheck landing and Update the Sheet act on the latest run: an earlier one is to read.
  const canAct = data.canRun && latest;
  const name = `${data.repo.owner}/${data.repo.repo}`;
  const n = countOf(r);
  const open = r.findings.filter((f) => statuses.get(f.id)?.state === 'open');
  const toggle = (id: string) => setPicked((p) => { const m = new Set(p); if (m.has(id)) m.delete(id); else m.add(id); return m; });
  const go = async (what: Act, ids?: string[]) => {
    setStatus({ busy: what });
    const out = await onRun(what, ids, what === 'fix' ? { notes, note } : undefined);
    setStatus(out);
    if ('sent' in out && what === 'fix') {
      setPicked(new Set());
      setNotes({});
      setNote('');
    }
    return out;
  };
  const busy = status !== null && 'busy' in status;
  const fixGoing = data.runs.some((x) => x.job === 'fix' && active(x));
  return (
    <>
      {!latest ? (
        <div className={a.notice} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
          <C k="verify.viewing.earlier" vars={{ date: shortDay(r.run.date), environment: r.run.environment }} />
          <button type="button" className={`${a.button} ${t2.small}`} onClick={onBack}><C k="verify.viewing.back" /></button>
        </div>
      ) : null}
      <Stats stats={[
        { k: 'verify.stats.passed', value: String(n.passed), big: true },
        { k: 'verify.stats.problem', value: String(n.problem), big: true },
        { k: 'verify.stats.skipped', value: String(n.skipped), big: true },
      ]} />
      {!data.canRun ? <C k="verify.noWrite" as="p" className={a.notice} vars={{ repo: name }} /> : null}
      {/* The fix's pull request open: the verification isn't over until it's merged (merging it updates the plan). */}
      {latest && data.fix?.pr?.state === 'open' ? (
        <div className={t2.failBox} style={{ borderColor: 'rgba(224, 164, 88, 0.4)', background: 'rgba(224, 164, 88, 0.06)' }}>
          <C k="verify.open.body" as="strong" vars={{ n: String(data.fix.pr.number) }} />
          <span className={t2.headActions}>
            <a href={data.fix.pr.url} target="_blank" rel="noopener noreferrer" className={`${a.button} ${a.buttonPrimary}`}>
              <C k="verify.open.merge" vars={{ n: String(data.fix.pr.number) }} />
            </a>
          </span>
        </div>
      ) : null}
      {latest && again.length ? (
        <div className={a.notice} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 }}>
          <C k={again.length === 1 ? 'verify.reverify.lineOne' : 'verify.reverify.line'} vars={{ n: String(again.length) }} />
          <button type="button" className={`${a.button} ${a.buttonPrimary} ${t2.small}`} onClick={() => onVerifyAgain(again)}><C k="verify.reverify.button" /></button>
        </div>
      ) : null}

      <section className={t2.section}>
        <div className={t2.sectionHead}>
          <C k="verify.findings.title" as="h2" className={t2.sectionTitle} />
          {canAct && open.length ? (
            <span className={t2.cellActions}>
              <button type="button" className={`${a.button} ${t2.small}`} onClick={() => setPicked(new Set(open.map((f) => f.id)))}><C k="verify.findings.selectAll" /></button>
              <button type="button" className={`${a.button} ${a.buttonPrimary} ${t2.small}`} disabled={!picked.size || busy} onClick={() => void go('fix', [...picked].sort((p, q) => Number(p.slice(1)) - Number(q.slice(1))))}>
                {!picked.size ? <C k="verify.findings.fixNone" /> : picked.size === 1 ? <C k="verify.findings.fixOne" /> : <C k="verify.findings.fix" vars={{ n: String(picked.size) }} />}
              </button>
            </span>
          ) : null}
        </div>
        {!r.findings.length ? <C k="verify.findings.none" as="p" className={a.note} /> : (
          <Findings findings={r.findings} statuses={statuses} picked={picked} onToggle={canAct ? toggle : null} repo={name} sha={r.run.commit} notes={notes} onNote={(id, v) => setNotes((m) => ({ ...m, [id]: v }))} />
        )}
        {canAct && picked.size ? (
          <div style={{ marginTop: 16 }}>
            <C k="verify.findings.fixNote" as="h3" className={t2.sectionTitle} />
            <NoteBox value={note} onChange={setNote} />
            <C k="verify.findings.fixNoteHint" as="p" className={a.note} />
          </div>
        ) : null}
      </section>

      {latest && data.fix ? (
        <section className={t2.section}>
          <div className={t2.sectionHead}><C k="verify.fixTitle" as="h2" className={t2.sectionTitle} /></div>
          <FixPanel
            fix={data.fix}
            record={null}
            canRun={data.canRun}
            fixGoing={fixGoing}
            onRun={async () => (await go('continue')) as AuditStatus}
            onFixAnswer={onFixAnswer}
          />
        </section>
      ) : null}

      <section className={t2.section}>
        <div className={t2.sectionHead}>
          <C k="verify.results" as="h2" className={t2.sectionTitle} />
          {canAct && pendingLanding(r) ? (
            <button type="button" className={`${a.button} ${t2.small}`} disabled={busy} onClick={() => void go('recheck')}><C k="verify.recheck.button" /></button>
          ) : null}
        </div>
        {pendingLanding(r) ? <C k="verify.recheck.hint" as="p" className={a.note} vars={{ tool: toolName(r) }} /> : null}
        {r.landing_checked ? <C k="verify.recheck.checked" as="p" className={a.note} vars={{ date: r.landing_checked.slice(0, 10) }} /> : null}
        <Results report={r} />
      </section>

      {latest ? (
        <section className={t2.section}>
          <div className={t2.sectionHead}><C k="verify.allEvents.title" as="h2" className={t2.sectionTitle} /></div>
          <AllEvents data={data} newest={run} onVerify={onVerifyAgain} />
        </section>
      ) : null}

      {r.not_done?.length ? (
        <section className={t2.section}>
          <div className={t2.sectionHead}><C k="verify.notDone.title" as="h2" className={t2.sectionTitle} /></div>
          <C k="verify.notDone.intro" as="p" className={a.note} />
          <div className={t2.tableWrap} style={{ marginTop: 12 }}>
            <table className={t2.table}>
              <thead>
                <tr>
                  <C k="verify.columns.event" as="th" />
                  <C k="verify.columns.status" as="th" />
                  <C k="verify.columns.why" as="th" />
                </tr>
              </thead>
              <tbody>
                {r.not_done.map((nd) => (
                  <tr key={`${nd.event}#${nd.path ?? ''}`}>
                    <td className={`${t2.mono} ${t2.main}`} style={{ whiteSpace: 'nowrap' }}>{nd.event}</td>
                    <td><Chip tone={STATUS_TONE[nd.status as Status] ?? 'idle'}><C k={`verify.statuses.${STATUS_KEY[nd.status as Status] ?? 'notChecked'}`} /></Chip></td>
                    <td>{nd.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canAct ? (
        <section className={t2.section}>
          <div className={t2.sectionHead}>
            <C k="verify.sheet.hint" as="p" className={a.note} />
            <button type="button" className={`${a.button} ${t2.small}`} disabled={busy} onClick={() => void go('sheet')}><C k="verify.sheet.button" /></button>
          </div>
        </section>
      ) : null}
      {status && 'sent' in status && status.sent !== 'continue' ? <C k={`verify.sent.${status.sent}`} as="p" className={a.notice} /> : null}
      {status && 'error' in status ? <C k={`verify.errors.${status.error}`} as="p" className={a.error} vars={{ message: status.message }} /> : null}
    </>
  );
}

/** The analytics tool's name as people write it: "Mixpanel", "PostHog". */
const TOOL_NAMES: Record<string, string> = { mixpanel: 'Mixpanel', posthog: 'PostHog', amplitude: 'Amplitude', ga4: 'GA4', segment: 'Segment' };
const toolName = (r: VerifyReport) => TOOL_NAMES[r.run.analytics.tool.toLowerCase()] ?? r.run.analytics.tool;

/** Where a finding stands, as a chip: nothing while it's open. */
const STATE_TONE: Record<FindingState, Tone> = { open: 'idle', sent: 'run', notBuilt: 'run', heldBack: 'warn', built: 'run', reverify: 'warn', fixed: 'ok', stillBroken: 'bad' };

function StateChip({ st }: { st: FindingStatus | undefined }) {
  if (!st || st.state === 'open') return null;
  const date = st.by ? shortDay(st.by.date) : '';
  return <Chip tone={STATE_TONE[st.state]}><C k={`verify.findings.states.${st.state}`} vars={{ date }} /></Chip>;
}

/** The findings as the audit shows its own: tick, events, problem, severity, where it stands now, Why ▸ with the fix and evidence. */
function Findings({ findings, statuses, picked, onToggle, repo, sha, notes = {}, onNote }: { findings: VerifyFinding[]; statuses: Map<string, FindingStatus>; picked: Set<string>; onToggle: ((id: string) => void) | null; repo: string; sha: string | null; notes?: Record<string, string>; onNote?: (id: string, v: string) => void }) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  // Which picked findings have their note box open.
  const [noting, setNoting] = useState<Set<string>>(new Set());
  const cols = onToggle ? 6 : 5;
  return (
    <div className={t2.tableWrap}>
      <table className={t2.table}>
        <thead>
          <tr>
            {onToggle ? <th aria-hidden="true" /> : null}
            <C k="verify.columns.event" as="th" />
            <C k="verify.findings.problem" as="th" />
            <C k="verify.findings.severity" as="th" />
            <th aria-hidden="true" />
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {findings.map((f) => {
            const isOpen = openRow === f.id;
            const st = statuses.get(f.id);
            const why = st && (st.state === 'fixed' || st.state === 'stillBroken' || st.state === 'reverify') ? st.state : null;
            return (
              <Fragment key={f.id}>
                <tr>
                  {onToggle ? (
                    <td style={{ width: '1%' }}>
                      <input type="checkbox" className={x.check} checked={picked.has(f.id)} disabled={st?.state !== 'open'} onChange={() => onToggle(f.id)} aria-label={f.title} />
                    </td>
                  ) : null}
                  <td className={x.findingEventsCell}><FindingEvents items={f.items} /></td>
                  <td className={t2.main}>{f.title}</td>
                  <td><C k={`audit.severity.${f.severity}`} className={x[SEVERITY_CLASS[f.severity]]} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <StateChip st={st} />
                    {st?.fix?.pr ? (
                      <>
                        {' '}
                        <a href={st.fix.pr.url} target="_blank" rel="noopener noreferrer" className={t2.link}><C k="verify.findings.pr" vars={{ n: String(st.fix.pr.number) }} /></a>
                      </>
                    ) : null}
                  </td>
                  <td className={t2.right} style={{ whiteSpace: 'nowrap' }}>
                    {onToggle && onNote && picked.has(f.id) ? (
                      <button type="button" className={x.why} aria-expanded={noting.has(f.id)} onClick={() => setNoting((n) => { const m = new Set(n); if (m.has(f.id)) m.delete(f.id); else m.add(f.id); return m; })}>
                        <C k={notes[f.id]?.trim() ? 'verify.findings.editNote' : 'verify.findings.addNote'} /> {noting.has(f.id) ? '▾' : '▸'}
                      </button>
                    ) : null}
                    <button type="button" className={x.why} aria-expanded={isOpen} onClick={() => setOpenRow(isOpen ? null : f.id)}>
                      <C k="screen.why" /> {isOpen ? '▾' : '▸'}
                    </button>
                  </td>
                </tr>
                {onToggle && onNote && picked.has(f.id) && noting.has(f.id) ? (
                  <tr className={x.drawer}>
                    <td colSpan={cols}>
                      <textarea className={s.textarea} rows={2} maxLength={2000} value={notes[f.id] ?? ''} placeholder={t('verify.findings.notePlaceholder')} aria-label={t('verify.findings.noteLabel', { id: f.id })} onChange={(e) => onNote(f.id, e.target.value)} />
                    </td>
                  </tr>
                ) : null}
                {isOpen ? (
                  <tr className={x.drawer}>
                    <td colSpan={cols}>
                      {why ? <C k={`verify.findings.stateWhy.${why}`} as="p" className={x.findingFix} vars={{ date: st?.by ? shortDay(st.by.date) : '', environment: st?.by?.environment ?? '' }} /> : null}
                      {st?.item?.summary ? <p className={x.findingFix}><C k="verify.findings.done" as="strong" /> {st.item.summary}</p> : null}
                      <p className={x.findingFix}><C k="audit.finding.fixLabel" as="strong" /> {f.fix}</p>
                      {f.explanation ? <p className={x.findingFix}>{f.explanation}</p> : null}
                      {f.evidence.length ? <VerifyEvidence evidence={f.evidence} repo={repo} sha={sha} /> : null}
                      {f.verifier ? <p className={x.findingFix}><C k="verify.findings.verifier" as="strong" /> {f.verifier}</p> : null}
                      <C k="verify.findings.ref" as="p" className={x.findingFix} vars={{ id: f.id }} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Every run, newest first: when, where, the counts, where its findings stand now, and Open. */
function History({ data, onOpen }: { data: VerifyData; onOpen: (key: string) => void }) {
  if (!data.history.length) return <C k="verify.history.empty" as="p" className={t2.emptyState} />;
  return (
    <>
      <C k="verify.history.intro" as="p" className={a.note} />
      <div className={t2.tableWrap} style={{ marginTop: 12 }}>
        <table className={t2.table}>
          <thead>
            <tr>
              <C k="verify.history.columns.run" as="th" />
              <C k="verify.history.columns.where" as="th" />
              <C k="verify.history.columns.commit" as="th" />
              <C k="verify.history.columns.passed" as="th" className={t2.right} />
              <C k="verify.history.columns.problems" as="th" className={t2.right} />
              <C k="verify.history.columns.skipped" as="th" className={t2.right} />
              <C k="verify.history.columns.findings" as="th" />
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {data.history.map((h, i) => {
              const n = countOf(h.report);
              return (
                <tr key={h.key}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <When iso={h.at} /> {i === 0 ? <Chip tone="idle"><C k="verify.history.latest" /></Chip> : null}
                  </td>
                  <td>{h.report.run.environment}</td>
                  <td className={t2.mono}>{(h.report.run.commit ?? '').slice(0, 7)}</td>
                  <td className={t2.right}>{n.passed}</td>
                  <td className={t2.right}>{n.problem}</td>
                  <td className={t2.right}>{n.skipped}</td>
                  <td><FindingsSummary data={data} run={h} /></td>
                  <td className={t2.right}>
                    <button type="button" className={`${a.button} ${t2.small}`} onClick={() => onOpen(h.key)}><C k="verify.history.open" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.historyCut ? <C k="verify.history.limit" as="p" className={a.note} vars={{ n: String(data.history.length), branch: VERIFY_BRANCH }} /> : null}
    </>
  );
}

/** "1 fixed · 2 to verify again": where a run's findings stand now. */
function FindingsSummary({ data, run }: { data: VerifyData; run: HistoryRun }) {
  const states = [...findingStatuses(data, run).values()].map((st) => st.state);
  if (!states.length) return <C k="verify.history.summary.none" className={t2.faint} />;
  const groups: [string, number][] = [
    ['fixed', states.filter((st) => st === 'fixed').length],
    ['reverify', states.filter((st) => st === 'reverify').length],
    ['stillBroken', states.filter((st) => st === 'stillBroken').length],
    ['inFix', states.filter((st) => st === 'sent' || st === 'notBuilt' || st === 'heldBack' || st === 'built').length],
    ['open', states.filter((st) => st === 'open').length],
  ];
  return (
    <>
      {groups.filter(([, c]) => c).map(([k, c], i) => (
        <Fragment key={k}>
          {i ? ' · ' : null}
          <C k={`verify.history.summary.${k}`} vars={{ n: String(c) }} />
        </Fragment>
      ))}
    </>
  );
}

function VerifyEvidence({ evidence, repo, sha }: { evidence: Evidence[]; repo: string; sha: string | null }) {
  return (
    <ul className={s.evidence} style={{ marginTop: 8 }}>
      {evidence.map((e, i) =>
        'code' in e ? (
          <li key={i}>
            <CodeRef code={e.code} repo={repo} sha={sha} />
            <code className={s.quote}>{e.quote}</code>
          </li>
        ) : 'data' in e ? (
          <li key={i} className={x.findingFix}>{e.data.result}</li>
        ) : null,
      )}
    </ul>
  );
}

/** A `file:line` as a link to that line at the verified commit, or plain when it can't be one. */
function CodeRef({ code, repo, sha }: { code: string; repo: string; sha: string | null }) {
  const href = sha ? codeLink(code, repo, sha) : null;
  return href ? <a className={s.mono} href={href} target="_blank" rel="noreferrer">{code}</a> : <span className={s.mono}>{code}</span>;
}

function Results({ report }: { report: VerifyReport }) {
  return (
    <div className={t2.tableWrap} style={{ marginTop: 12 }}>
      <table className={t2.table}>
        <thead>
          <tr>
            <C k="verify.columns.event" as="th" />
            <C k="verify.columns.status" as="th" />
            <C k="verify.columns.landed" as="th" vars={{ tool: toolName(report) }} />
            <C k="verify.columns.reachedBy" as="th" />
            <C k="verify.columns.why" as="th" />
          </tr>
        </thead>
        <tbody>
          {report.results.map((r) => (
            <tr key={`${r.event}#${r.path}`}>
              <td className={`${t2.mono} ${t2.main}`} style={{ whiteSpace: 'nowrap' }}>{r.event}</td>
              <td><Chip tone={STATUS_TONE[r.status]}><C k={`verify.statuses.${STATUS_KEY[r.status]}`} /></Chip></td>
              <td><Chip tone={LANDED_TONE[r.landed] ?? 'idle'}><C k={`verify.landed.${LANDED_KEY[r.landed] ?? 'notMeasured'}`} /></Chip></td>
              <td style={{ whiteSpace: 'nowrap' }}><C k={`verify.reached.${r.reached_by}`} /></td>
              <td style={{ minWidth: 240 }}><Why text={r.why} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Every event any run has checked, each with its newest result (lastByEvent): the newest run's
 * Results list only what that run picked, so this keeps earlier runs' events in view.
 */
function AllEvents({ data, newest, onVerify }: { data: VerifyData; newest: HistoryRun; onVerify: (names: string[]) => void }) {
  const live = useMemo(() => data.events.filter((e) => e.intent === 'live'), [data.events]);
  const since = useMemo(() => sinceRun(data.events, newest), [data.events, newest]);
  const changed = useMemo(() => changedSinceVerified(data.events), [data.events]);
  // Problems first, then what wasn't settled, then never verified, then passes; by area, as the plan is.
  const rank = (e: PlanEvent) => (e.last ? RANK_OF[e.last.status] : 0.5);
  const groups = useMemo(() => {
    const out: { area: string; events: PlanEvent[] }[] = [];
    for (const e of [...live].sort((p, q) => p.area.localeCompare(q.area) || rank(q) - rank(p) || p.name.localeCompare(q.name))) {
      const g = out.at(-1);
      if (g && g.area === e.area) g.events.push(e);
      else out.push({ area: e.area, events: [e] });
    }
    return out;
  }, [live]);
  if (!live.length) return <C k="verify.allEvents.none" as="p" className={a.note} />;
  const parts = ([['plan', since.plan], ['code', since.code], ['added', since.added], ['gone', since.gone]] as const).filter(([, n]) => n > 0);
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <p className={a.note} style={{ margin: 0 }}>
          <C k="verify.allEvents.intro" vars={{ n: String(live.length), verified: String(live.filter((e) => e.last).length) }} />{' '}
          {parts.length ? (
            <>
              <C k="verify.allEvents.since" />{' '}
              {parts.map(([k, n], i) => <Fragment key={k}>{i ? ', ' : ''}<C k={`verify.allEvents.sinceParts.${k}`} vars={{ n: String(n) }} /></Fragment>)}.
            </>
          ) : <C k="verify.allEvents.sinceNothing" />}
        </p>
        {data.canRun && changed.length ? (
          <button type="button" className={`${a.button} ${t2.small}`} onClick={() => onVerify(changed)}>
            <C k={changed.length === 1 ? 'verify.allEvents.verifyChangedOne' : 'verify.allEvents.verifyChanged'} vars={{ n: String(changed.length) }} />
          </button>
        ) : null}
      </div>
      <div className={t2.tableWrap} style={{ marginTop: 12 }}>
        <table className={t2.table}>
          <thead>
            <tr>
              <C k="verify.columns.event" as="th" />
              <C k="verify.columns.status" as="th" />
              <C k="verify.columns.landed" as="th" vars={{ tool: data.report ? toolName(data.report) : '' }} />
              <C k="verify.allEvents.checked" as="th" />
              <C k="verify.columns.why" as="th" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.area || '-'}>
                {groups.length > 1 || g.area ? (
                  <tr className={t2.groupRow}><th colSpan={5}>{g.area || <C k="verify.start.noArea" />}</th></tr>
                ) : null}
                {g.events.map((e) => {
                  const l = e.last;
                  return (
                    <tr key={e.name}>
                      <td className={`${t2.mono} ${t2.main}`} style={{ whiteSpace: 'nowrap' }}>{e.name}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {l ? <Chip tone={STATUS_TONE[l.status]}><C k={`verify.statuses.${STATUS_KEY[l.status]}`} /></Chip> : <C k="verify.start.shortcuts.never" className={t2.faint} />}
                      </td>
                      <td>{l ? <Chip tone={LANDED_TONE[l.landed] ?? 'idle'}><C k={`verify.landed.${LANDED_KEY[l.landed] ?? 'notMeasured'}`} /></Chip> : null}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {l ? <>{shortDay(l.date)} · {l.environment} {l.run === newest.key ? <Chip tone="idle"><C k="verify.allEvents.thisRun" /></Chip> : null}</> : null}
                        {e.changed ? <div className={t2.faint} title={changedTitle(e.changed)}><C k="verify.allEvents.changed" /></div> : null}
                      </td>
                      <td style={{ minWidth: 240 }}>{l ? <Why text={l.why} /> : null}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Problems first, then what wasn't settled, then passes. */
const RANK_OF: Record<Status, number> = { problem: 4, couldnt_reach: 3, waiting_on_person: 2, not_checked: 1, passed: 0 };

/** Reasons longer than this get a "Show more" toggle. */
const WHY_CLAMP = 120;

/** A result's reason: two lines, and the whole of it behind "Show more". */
function Why({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > WHY_CLAMP;
  return (
    <>
      <div className={open || !long ? undefined : t2.clamp} style={{ whiteSpace: 'normal' }} title={open ? undefined : text}>{text}</div>
      {long ? (
        <button type="button" className={x.moreEvents} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <C k={open ? 'trackingPlan.lessDescription' : 'trackingPlan.moreDescription'} />
        </button>
      ) : null}
    </>
  );
}

/** Start a run, in three steps: pick events, where to check, the command. A bar keeps the count and Copy in view. */
function Start({ data, copy, initial = [] }: { data: VerifyData; copy?: (text: string) => Promise<void>; initial?: string[] }) {
  const live = useMemo(() => data.events.filter((e) => e.intent === 'live'), [data.events]);
  const reverify = useMemo(() => fixedToReverify(data), [data]);
  const changed = useMemo(() => changedSinceVerified(data.events), [data.events]);
  const [picked, setPicked] = useState<Map<string, Set<string> | null>>(() => new Map(initial.map((n) => [n, null])));
  const [env, setEnv] = useState(data.environments[0]?.name ?? '');
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const shown = useMemo(() => filterPlan(live, { q, area, intent: '', verified: 'all' }), [live, q, area]);
  const groups = useMemo(() => {
    const out: { area: string; events: PlanEvent[] }[] = [];
    for (const e of shown) {
      const last = out[out.length - 1];
      if (last && last.area === e.area) last.events.push(e);
      else out.push({ area: e.area, events: [e] });
    }
    return out;
  }, [shown]);
  const picks: Picked[] = [...picked].map(([event, props]) => ({ event, ...(props?.size ? { properties: [...props] } : {}) }));
  const command = startCommand(picks, data.environments.length > 1 ? env : null);
  const est = estimate(picks, data.events);
  const set = (names: string[]) => setPicked(new Map(names.map((n) => [n, null])));
  const toggle = (name: string) => setPicked((p) => { const n = new Map(p); if (n.has(name)) n.delete(name); else n.set(name, null); return n; });
  const toggleProp = (event: string, prop: string) => setPicked((p) => {
    const n = new Map(p);
    const cur = new Set(n.get(event) ?? []);
    if (cur.has(prop)) cur.delete(prop); else cur.add(prop);
    n.set(event, cur);
    return n;
  });
  const doCopy = async () => {
    await (copy ?? ((text: string) => navigator.clipboard.writeText(text)))(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const one = data.environments.length === 1 ? data.environments[0] : null;
  const hosted = useHosted(data);
  const runEnv = data.environments.length > 1 ? env : (one?.name ?? '');
  // Production: a warning, and Verify only where the repo allows it (VERIFY.md §15 #4).
  const chosen = data.environments.find((e) => e.name === runEnv) ?? null;
  return (
    <>
      <C k="verify.start.intro" as="p" className={a.note} />

      <section className={t2.section} style={{ marginTop: 24 }}>
        <div className={t2.sectionHead}><C k="verify.start.steps.pick" as="h2" className={t2.sectionTitle} /></div>
        <div className={s.filters} style={{ marginTop: 0, marginBottom: 12 }}>
          <div className={s.filterChips} style={{ alignItems: 'center' }} role="group" aria-label={t('verify.start.shortcuts.label')}>
            <C k="verify.start.shortcuts.label" className={t2.faint} />
            {reverify.length ? <button type="button" className={s.filterChip} onClick={() => set(reverify)}><C k="verify.start.shortcuts.reverify" /></button> : null}
            {changed.length ? <button type="button" className={s.filterChip} onClick={() => set(changed)}><C k="verify.start.shortcuts.changed" /></button> : null}
            <button type="button" className={s.filterChip} onClick={() => set(neverVerified(data.events))}><C k="verify.start.shortcuts.never" /></button>
            <button type="button" className={s.filterChip} onClick={() => set(failedLast(data.events))}><C k="verify.start.shortcuts.failed" /></button>
            <button type="button" className={s.filterChip} onClick={() => set(live.map((e) => e.name))}><C k="verify.start.shortcuts.all" /></button>
            {picked.size ? <button type="button" className={s.filterChip} onClick={() => setPicked(new Map())}><C k="verify.start.shortcuts.clear" /></button> : null}
          </div>
          <div className={s.filters} style={{ marginTop: 0, flex: '1 1 360px', justifyContent: 'flex-end', gap: 12 }}>
            <input className={a.input} style={{ flex: '1 1 180px', width: 'auto', minWidth: 0 }} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('trackingPlan.search')} aria-label={t('trackingPlan.search')} />
            {data.areas.length > 1 ? (
              <select className={s.select} style={{ flex: '0 1 200px', width: 'auto', minWidth: 0 }} value={area} onChange={(e) => setArea(e.target.value)} aria-label={t('trackingPlan.filters.areaAll')}>
                <option value="">{t('trackingPlan.filters.areaAll')}</option>
                {data.areas.map((ar) => <option key={ar} value={ar}>{ar}</option>)}
              </select>
            ) : null}
          </div>
        </div>
        {!shown.length ? <C k="verify.start.noMatch" as="p" className={t2.emptyState} /> : (
          <div className={t2.tableWrap}>
            <table className={t2.table}>
              <thead>
                <tr>
                  <th aria-hidden="true" />
                  <C k="verify.columns.event" as="th" />
                  <C k="verify.start.last" as="th" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.area || '-'}>
                    {groups.length > 1 || g.area ? (
                      <tr className={t2.groupRow}>
                        <th colSpan={3}>{g.area || <C k="verify.start.noArea" />}</th>
                      </tr>
                    ) : null}
                    {g.events.map((e) => {
                      const on = picked.has(e.name);
                      return (
                        <tr key={e.name}>
                          <td style={{ width: '1%' }}>
                            <input id={`pick-${e.name}`} type="checkbox" className={x.check} checked={on} onChange={() => toggle(e.name)} />
                          </td>
                          <td style={{ minWidth: 0 }}>
                            <label htmlFor={`pick-${e.name}`} className={`${t2.mono} ${t2.main}`} style={{ cursor: 'pointer' }}>{e.name}</label>
                            {e.description ? <Description text={e.description} /> : null}
                            {on && e.properties.length ? (
                              <details className={t2.propPicker}>
                                <C k="verify.start.properties" as="summary" />
                                <div className={t2.propList}>
                                  {e.properties.map((p) => (
                                    <label key={p.name} className={t2.propItem}>
                                      <input type="checkbox" className={x.check} checked={Boolean(picked.get(e.name)?.has(p.name))} onChange={() => toggleProp(e.name, p.name)} /> <span className={t2.mono}>{p.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </details>
                            ) : null}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {e.last ? (
                              <>
                                <Chip tone={STATUS_TONE[e.last.status]}><C k={`verify.statuses.${STATUS_KEY[e.last.status]}`} /></Chip> <span className={t2.faint}><When iso={e.last.date} day /></span>
                                {e.changed ? <> <span className={t2.faint} title={changedTitle(e.changed)}><C k="verify.start.changed" /></span></> : null}
                              </>
                            ) : <C k="verify.start.never" className={t2.faint} />}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={t2.section}>
        <div className={t2.sectionHead}><C k="verify.start.steps.environment" as="h2" className={t2.sectionTitle} /></div>
        {data.environments.length > 1 ? (
          <select className={s.select} style={{ maxWidth: 420 }} value={env} onChange={(e) => setEnv(e.target.value)} aria-label={t('verify.start.steps.environment')}>
            {data.environments.map((e) => <option key={e.name} value={e.name}>{`${e.name} (${e.url})`}</option>)}
          </select>
        ) : one ? (
          <p className={a.note}><strong>{one.name}</strong> <span className={t2.mono}>{one.url}</span></p>
        ) : <C k="verify.start.noEnv" as="p" className={a.note} />}
        <C k="verify.start.setupWhere" as="p" className={a.note} />
        <p className={a.note}><Link href={`${verifyPath(data.repo)}/setup`}><C k="verify.start.setupLink" /></Link></p>
      </section>

      <section className={t2.section}>
        <div className={t2.sectionHead}><C k={hosted.ready ? 'verify.start.steps.runHosted' : 'verify.start.steps.run'} as="h2" className={t2.sectionTitle} /></div>
        {hosted.ready ? <C k="verify.start.hosted" as="p" className={a.note} /> : null}
        {chosen?.kind === 'production' ? <C k={chosen.allowed === false ? 'verify.start.productionNotAllowed' : 'verify.start.production'} as="p" className={chosen.allowed === false ? a.error : a.notice} /> : null}
        {hosted.error ? <C k={`verify.start.startErrors.${hosted.error}`} as="p" className={a.note} /> : null}
        {hosted.loadFailed ? (
          <p className={a.error}>
            <C k="verify.start.hostedLoadFailed" />{' '}
            <button type="button" className={a.linkButton} onClick={hosted.retry}><C k="verify.run.errors.retry" /></button>
          </p>
        ) : null}
        {picks.length ? (
          <>
            <code className={t2.command}>{command}</code>
            {est.shards > 1 ? <C k="verify.start.shards" as="p" className={a.note} vars={{ shards: String(est.shards) }} /> : null}
          </>
        ) : <C k="verify.start.none" as="p" className={a.note} />}
        <C k="verify.start.paste" as="p" className={a.note} vars={{ branch: VERIFY_BRANCH }} />
        {hosted.runs.length ? (
          <>
            <C k="verify.start.hostedRuns" as="h3" className={t2.sectionTitle} />
            <ul className={t2.rows} style={{ marginTop: 8 }}>
              {hosted.runs.map((run) => (
                <li key={run.id} className={t2.row}>
                  <Link className={t2.rowTitle} href={`${verifyPath(data.repo)}/runs/${run.id}`}><C k="verify.start.hostedRunLine" vars={{ events: String(run.events), environment: run.environment }} /></Link>
                  <span className={t2.rowSide}><Chip tone={RUN_TONE[run.status] ?? 'idle'}><C k={`verify.run.statuses.${run.status}`} /></Chip> <span className={t2.faint}><When iso={run.createdAt} /></span></span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <div className={s.barSpacer} />
      <div className={s.bar}>
        <div className={s.barGrid}>
          <div style={{ minWidth: 0 }}>
            {picks.length ? (
              <>
                <C k={picks.length === 1 ? 'verify.start.pickedOne' : 'verify.start.picked'} vars={{ events: String(est.events), journeys: String(est.journeys) }} />
                {est.data ? <> <C k="verify.start.fromData" vars={{ data: String(est.data) }} /></> : null}
                {hosted.ready && hosted.rates ? <CostLine rates={hosted.rates} picks={picks.reduce((n, p) => n + (p.properties?.length || 1), 0)} shards={est.shards} /> : null}
              </>
            ) : <C k="verify.start.none" className={t2.faint} />}
          </div>
          <div className={s.barButtons}>
            {hosted.ready ? (
              <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={!picks.length || !runEnv || hosted.starting || chosen?.allowed === false} onClick={() => void hosted.start(picks, runEnv)}>{hosted.starting ? <C k="verify.start.starting" /> : <C k="verify.start.verify" />}</button>
            ) : null}
            <button type="button" className={hosted.ready ? a.button : `${a.button} ${a.buttonPrimary}`} disabled={!picks.length} onClick={() => void doCopy()}>{copied ? <C k="verify.start.copied" /> : <C k="verify.start.copy" />}</button>
          </div>
        </div>
      </div>
    </>
  );
}

/** What changed, for the mark's tooltip: the plan's changelog lines, then the files. */
const changedTitle = (c: { plan: string[]; files: string[] }) => [...c.plan, ...c.files].join('\n');

/** Start's estimate for a run on Datalyze, from past parts (lib/tracking-agent/verify-runs/estimate.ts). */
function CostLine({ rates, picks, shards }: { rates: CostRates; picks: number; shards: number }) {
  const est = costEstimate(rates, { picks, shards });
  const vars = { usd: est.usd.toFixed(2), minutes: String(est.minutes ?? ''), past: String(rates.shards) };
  return <> <C k={est.minutes == null ? 'verify.start.costNoMinutes' : 'verify.start.cost'} vars={vars} /></>;
}

const RUN_TONE: Record<string, Tone> = { queued: 'idle', running: 'run', done: 'ok', failed: 'bad', stopped: 'warn' };
type HostedRun = { id: string; environment: string; status: string; events: number; createdAt: string };
const START_ERROR: Record<string, string> = { no_key: 'noKey', no_write: 'noWrite', too_many: 'tooMany', not_set_up: 'notSetUp', launch: 'launch', production_not_allowed: 'productionNotAllowed' };

/** Runs on Datalyze (VERIFY.md §11 Phase B): whether the repo is set up for them, its recent runs, and Start. */
function useHosted(data: VerifyData) {
  const auth = useMaybeAccount()?.authHeader;
  const router = useRouter();
  const [info, setInfo] = useState<{ hosted: boolean; canAct: boolean; runs: HostedRun[]; rates?: CostRates | null } | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Datalyze didn't answer (offline, a 5xx): said, with Try again. A refusal (not this workspace's repo) just hides Verify.
  const [loadFailed, setLoadFailed] = useState(false);
  const { owner, repo } = data.repo;
  const latest = useRef(0);
  const load = useCallback(async () => {
    if (!auth) return;
    const n = ++latest.current;
    const res = await fetch(`/api/tracking-agent/verify/runs?${new URLSearchParams({ owner, repo })}`, { headers: await auth(), cache: 'no-store' }).catch(() => null);
    if (n !== latest.current) return;
    if (!res || res.status >= 500) return setLoadFailed(true);
    setLoadFailed(false);
    if (res.ok) setInfo((await res.json()) as { hosted: boolean; canAct: boolean; runs: HostedRun[]; rates?: CostRates | null });
  }, [auth, owner, repo]);
  useEffect(() => void load(), [load]);
  // A run started here is followed on its own page; this list keeps its status as it changes.
  useWhileGoing(Boolean(info?.runs.some((r) => r.status === 'queued' || r.status === 'running')), load);
  const start = async (picks: Picked[], environment: string) => {
    if (!auth) return;
    setStarting(true);
    setError(null);
    const res = await fetch('/api/tracking-agent/verify/runs', { method: 'POST', headers: { ...(await auth()), 'content-type': 'application/json' }, body: JSON.stringify({ owner, repo, environment, picks }) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    if (res?.ok && body?.id) {
      router.push(`${verifyPath(data.repo)}/runs/${body.id}`);
      return;
    }
    setStarting(false);
    setError(START_ERROR[body?.error ?? ''] ?? 'failed');
  };
  return { ready: Boolean(info?.hosted && info.canAct), runs: info?.runs ?? [], rates: info?.rates ?? null, starting, error, start, loadFailed, retry: () => void load() };
}
