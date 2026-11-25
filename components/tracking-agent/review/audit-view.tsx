'use client';

import { auditLocked } from '@/lib/tracking-agent/audit-stage';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import a from '@/components/account/account.module.css';
import {
  answeredHeldBack,
  AUDITS_PATH,
  auditPath,
  canContinue,
  canWrite,
  closeAudit,
  continueFix,
  dispatchErrorKey,
  fixOverall,
  groupAuditFindings,
  keyRejected,
  problemsElsewhere,
  publishKeptAudit,
  type ElsewhereProblem,
  type KeptAudit,
  loadAudit,
  saveAnswers,
  saveFixAnswers,
  sameAsFix,
  sentForFix,
  startAudit,
  startDecisions,
  statusReason,
  type AuditData,
  type FixProgress,
} from '@/lib/tracking-agent/audit';
import { useMaybeAccount } from '@/components/account/account-shell';
import { hasScopes, REVIEW_SCOPES, useGitHubSession } from '@/lib/tracking-agent/github/session';
import { screenFromServer } from '@/lib/tracking-agent/screen-client';
import { isOAuthRestricted } from '@/lib/tracking-agent/review/inbox';
import { actionsUrl, active, failureKey, type Run } from '@/lib/tracking-agent/runs';
import { answersSummary, hasWork, type AuditAnswers, type SuggestionChoice } from '@/tracking-agent/src/audit/answers';
import { fixTally, type FixItem } from '@/tracking-agent/src/audit/fixes';
import type { AuditEvidence, AuditRecord, ConditionChoice, DropCandidate, NoDataItem, PropertyCondition, PropertySuggestion, TrackingChoice } from '@/tracking-agent/src/audit/record';
import { EventsTable } from './events-table';
import { unreadText } from '@/tracking-agent/src/scan/unread-text';
import { hasReviewText } from '@/lib/content/trackingAgentReview';
import { C, camel, t } from './copy';
import { RestrictedHelp } from './inbox-view';
import { codeLink } from './item-card';
import { GitHubUnknownPanel, SignInPanel } from './review-shell';
import { RunList } from './runs';
import { LatestRun } from './run-record';
import { ActionBar, BuiltHead, BuiltLists, NoteBox, QuestionCard, ScreenHead, ScreenTabs, Segmented, Stats, Tabs, WorkRow, type BuiltTab } from './screen';
import { Chip, When, shortDay, type Tone } from '@/components/tracking-agent/app/ui';
import t2 from '@/components/tracking-agent/app/app.module.css';
import x from './audit.module.css';
import s from './review.module.css';
import { useWhileGoing } from '../use-while-going';

type Act = 'audit' | 'save' | 'fix' | 'continue' | 'publish' | 'close';
/** What happened to the last thing the screen started. */
export type AuditStatus = { busy: Act } | { sent: Act } | { error: 'notFound' | 'forbidden' | 'failed' | 'saveFailed'; message: string };
/** Starts an audit, or saves the answers (and, for Fix, starts the one fix run); Continue starts the fix run as it is. */
export type OnRun = (what: Act, answers?: AuditAnswers) => Promise<AuditStatus>;
/** Saves a held-back item's answer in the fix's work list: null when saved, else GitHub's message. */
/** Saves answers to held-back items, by item id, in one commit; returns GitHub's error, or null. */
export type OnFixAnswer = (answers: Record<string, number | string>) => Promise<string | null>;

const WHILE_RUNNING_MS = 15_000;
/** How long a just-started audit is waited for before the page stops looking for its run. */
const STARTED_WAIT_MS = 3 * 60_000;

/**
 * /tracking-agent/audits/[owner]/[repo]: the latest audit from `datalyze/audit`. Once the
 * first plan is merged, the person answers its questions, ticks findings and no-data items, adds a
 * note, and saves (answers.json) or fixes (one run, one pull request).
 */
export function AuditPage({ owner, repo, at, started = false }: { owner: string; repo: string; at?: string | null; started?: boolean }) {
  const [startedAt] = useState(() => (started ? Date.now() : null));
  // Build it or Continue just sent: the page reads again until GitHub lists the build's run.
  const [builtAt, setBuiltAt] = useState<number | null>(null);
  const { session, client, ready, unknown, retry } = useGitHubSession();
  const [data, setData] = useState<AuditData | null>(null);
  const [failure, setFailure] = useState<'restricted' | 'notFound' | 'failed' | null>(null);

  const auth = useMaybeAccount()?.authHeader;
  // Which audit is on screen: a poll that fails while it shows keeps it, rather than swapping in the error page.
  const shown = useRef<string | null>(null);
  const load = useCallback(async () => {
    if (!client || !session) return;
    const key = `${owner}/${repo}@${at ?? ''}`;
    setFailure(null);
    try {
      // Read on the server with the Datalyze App (one call); in the browser only when it can't be.
      const server = await screenFromServer<AuditData>(auth, 'audit', { owner, repo, at, login: session.login });
      if (server) {
        const canRun = server.canRun ?? (await client.permission({ owner, repo }, session.login).then(canWrite).catch(() => false));
        setData({ ...server.data, canRun });
      } else setData(await loadAudit(client, { owner, repo }, session.login, at));
      shown.current = key;
    } catch (error) {
      if (shown.current === key) return;
      setFailure(isOAuthRestricted(error) ? 'restricted' : (error as { status?: number }).status === 404 ? 'notFound' : 'failed');
    }
  }, [auth, client, session, owner, repo, at]);

  useEffect(() => {
    void load();
  }, [load]);

  // Just started from onboarding: GitHub lists the run a few seconds later, so the page waits for it.
  const waiting = startedAt !== null && Boolean(data) && !data!.runs.some((r) => r.job === 'audit') && Date.now() - startedAt < STARTED_WAIT_MS;
  // A minute back: the run's time is GitHub's clock, not this browser's.
  const buildListed = builtAt !== null && Boolean(data?.runs.some((r) => r.job === 'fix' && Date.parse(r.createdAt) >= builtAt - 60_000));
  const buildWaiting = builtAt !== null && !buildListed && Date.now() - builtAt < STARTED_WAIT_MS;
  const going = Boolean(data?.runs.some(active)) || waiting || buildWaiting;
  useWhileGoing(going, load, waiting || buildWaiting ? 5_000 : WHILE_RUNNING_MS);

  const run = useCallback<OnRun>(
    async (what, answers) => {
      if (!client || !data) return { error: 'failed', message: 'not signed in' };
      try {
        if (what === 'audit') await startAudit(client, data);
        else if (what === 'publish') {
          if (!data.kept) return { error: 'failed', message: 'nothing kept to publish' };
          await publishKeptAudit(client, data, data.kept);
        }
        else if (what === 'continue') await continueFix(client, data);
        else if (what === 'close') {
          if (!data.record || !session) return { error: 'failed', message: 'no audit to close' };
          await closeAudit(client, data, data.record.generated_at, session.login);
        }
        else if (!answers) return { error: 'failed', message: 'no answers' };
        else if (what === 'save') {
          try {
            await saveAnswers(client, data, answers);
          } catch (error) {
            return { error: 'saveFailed', message: (error as Error)?.message ?? String(error) };
          }
        } else await startDecisions(client, data, answers);
        if (what === 'fix' || what === 'continue') setBuiltAt(Date.now());
        setTimeout(() => void load(), what === 'save' || what === 'close' ? 500 : 5000);
        return { sent: what };
      } catch (error) {
        return { error: dispatchErrorKey(error), message: (error as Error)?.message ?? String(error) };
      }
    },
    [client, data, load, session],
  );

  const answerFix = useCallback<OnFixAnswer>(
    async (answers) => {
      if (!client || !data?.fix || !session) return 'not signed in';
      try {
        await saveFixAnswers(client, data, data.fix, answers, session.login);
      } catch (error) {
        return (error as Error)?.message ?? String(error);
      }
      setTimeout(() => void load(), 500);
      return null;
    },
    [client, data, session, load],
  );

  if (!ready) return unknown ? <GitHubUnknownPanel onRetry={retry} /> : <div className={a.skeleton} style={{ height: 240 }} aria-busy="true" />;
  if (!session || !hasScopes(session, REVIEW_SCOPES)) return <SignInPanel returnTo={auditPath({ owner, repo })} needsScopes={Boolean(session)} />;
  if (failure) {
    return (
      <>
        <section className={a.card}>
          <C k={`audit.failures.${failure}`} as="p" className={a.cardBody} vars={{ repo: `${owner}/${repo}` }} />
          <div className={a.cardActions}>
            <button type="button" className={a.button} onClick={() => void load()}>
              <C k="audit.reload" />
            </button>
          </div>
        </section>
        {failure === 'restricted' ? <RestrictedHelp restricted={[owner]} /> : null}
      </>
    );
  }
  if (!data) return <div className={a.skeleton} style={{ height: 320 }} aria-busy="true" />;
  return <AuditView data={data} login={session.login} onRun={run} onFixAnswer={answerFix} starting={waiting} building={buildWaiting} />;
}


/**
 * An audit that's running: the page it will be, its tabs empty until it finishes, and its run on GitHub.
 */
function RunningAudit({ url }: { url: string }) {
  const [section, setSection] = useState<'findings' | 'events' | 'questions'>('findings');
  return (
    <>
      <Tabs
        label={t('audit.sections.label')}
        items={[
          ['findings', 'audit.sections.findings', null],
          ['events', 'audit.sections.events', null],
          ['questions', 'audit.sections.questions', null],
        ]}
        value={section}
        onChange={setSection}
      />
      <div className={t2.emptyState}>
        <C k="audit.empty.running" as="p" />
        <a href={url} target="_blank" rel="noopener noreferrer" className={a.button}>
          <C k="audit.empty.github" /> ↗
        </a>
      </div>
    </>
  );
}

/**
 * Where the audit stands, in one line with its one action (audit-stage.ts): building (its run on
 * GitHub), built and waiting to be merged (merging completes it), complete (start a new audit to
 * carry on), or nothing built yet (close it with nothing to build).
 */
function StageBanner({ data, building, fixRun, open, busy, onClose }: { data: AuditData; building: boolean; fixRun: Run | undefined; open: boolean; busy: boolean; onClose: () => void }) {
  const [asking, setAsking] = useState(false);
  const box = (tone: 'run' | 'warn' | 'ok', body: ReactNode, action: ReactNode) => (
    <div className={t2.failBox} style={tone === 'warn' ? { borderColor: 'rgba(224, 164, 88, 0.4)', background: 'rgba(224, 164, 88, 0.06)' } : { borderColor: 'var(--border-strong)', background: 'transparent' }}>
      <div>{body}</div>
      <span className={t2.headActions}>{action}</span>
    </div>
  );
  const stage = building && data.stage === 'choose' ? 'building' : data.stage;
  if (stage === 'building') {
    return box(
      'run',
      <>
        <Chip tone="run">
          <C k="audit.stage.building" />
        </Chip>{' '}
        <C k="audit.stage.buildingBody" />
      </>,
      <a href={fixRun && active(fixRun) ? fixRun.url : actionsUrl(data.repo)} target="_blank" rel="noopener noreferrer" className={a.button}>
        <C k="audit.empty.github" /> ↗
      </a>,
    );
  }
  if (stage === 'toMerge' && data.fix?.pr) {
    return box(
      'warn',
      <C k="audit.stage.toMerge" as="strong" />,
      <a href={data.fix.pr.url} target="_blank" rel="noopener noreferrer" className={`${a.button} ${a.buttonPrimary}`}>
        <C k="audit.stage.merge" vars={{ n: String(data.fix.pr.number) }} />
      </a>,
    );
  }
  if (stage === 'complete') {
    return box(
      'ok',
      <>
        <Chip tone="ok">
          <C k="audit.stage.complete" />
        </Chip>{' '}
        <C k={data.closed ? 'audit.stage.closedBody' : 'audit.stage.completeBody'} vars={{ login: data.closed?.by ?? '' }} />
      </>,
      <Link href={AUDITS_PATH} className={a.button}>
        <C k="audit.stage.newAudit" />
      </Link>,
    );
  }
  if (stage === 'choose' && open) {
    return box(
      'run',
      <C k={asking ? 'audit.stage.closeConfirm' : 'audit.stage.closeHint'} />,
      asking ? (
        <>
          <button type="button" className={a.button} onClick={() => setAsking(false)}>
            <C k="audit.stage.closeCancel" />
          </button>
          <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={busy} onClick={onClose}>
            <C k="audit.stage.closeYes" />
          </button>
        </>
      ) : (
        <button type="button" className={a.button} onClick={() => setAsking(true)}>
          <C k="audit.stage.close" />
        </button>
      ),
    );
  }
  return null;
}

/** The screen's choices: saved answers when there are some, else every question's recommendation and nothing ticked. */
function initialChoices(record: AuditRecord | null, saved: AuditAnswers | null) {
  const choice: Record<string, string | null> = {};
  for (const q of record?.questions ?? []) {
    const had = saved?.answers.find((x) => x.question === q.id);
    choice[q.id] = had ? had.option : q.recommended;
  }
  // Saved answers leave out what was left for later; with none saved, the audit's recommendation.
  const tracking: Record<string, TrackingChoice | null> = {};
  for (const d of record?.drop_candidates ?? []) tracking[d.name] = saved ? (saved.tracking.find((x) => x.event === d.name)?.choice ?? null) : d.recommended;
  // A suggestion starts undecided: adding a property is the team's call, not the audit's.
  const suggestions: Record<string, SuggestionChoice | null> = {};
  for (const sg of record?.property_suggestions ?? []) suggestions[sg.id] = saved?.suggestions.find((x) => x.id === sg.id)?.choice ?? null;
  // A condition starts undecided too: the audit's decision stands until the team keeps it or says every path.
  const conditions: Record<string, ConditionChoice | null> = {};
  for (const c of record?.property_conditions ?? []) conditions[c.id] = saved?.conditions?.find((x) => x.id === c.id)?.choice ?? null;
  return { choice, tracking, suggestions, conditions, picked: new Set(saved?.findings ?? []), lookInto: new Set(saved?.look_into ?? []), note: saved?.note ?? '' };
}

const toggled = (set: Set<string>, id: string) => (set.has(id) ? new Set([...set].filter((v) => v !== id)) : new Set([...set, id]));

type Section = 'findings' | 'events' | 'questions' | 'suggestions' | 'conditions' | 'noData' | 'tracking' | 'note';

/**
 * The audit screen from its data, so the preview can pass fixtures: the repo and its numbers, a
 * failed audit with its way out, then the findings, questions and other choices in tabs, one sticky
 * bar to fix them, and the runs. Once there's a fix, Audit and Fix are two tabs at the top.
 */
export function AuditView({ data, login, onRun, onFixAnswer, starting = false, building = false }: { data: AuditData; login: string; onRun: OnRun; onFixAnswer?: OnFixAnswer; starting?: boolean; building?: boolean }) {
  const record = data.record;
  const start0 = initialChoices(record, data.answers);
  const [choice, setChoice] = useState(start0.choice);
  const [picked, setPicked] = useState<Set<string>>(start0.picked);
  const [lookInto, setLookInto] = useState<Set<string>>(start0.lookInto);
  const [tracking, setTracking] = useState(start0.tracking);
  const [suggestions, setSuggestions] = useState(start0.suggestions);
  const [conditions, setConditions] = useState(start0.conditions);
  const [note, setNote] = useState(start0.note);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const [section, setSection] = useState<Section>('findings');
  const repoName = `${data.repo.owner}/${data.repo.repo}`;
  const groups = record ? groupAuditFindings(record) : [];
  // What a fix run (going, or done) already took from this audit.
  const sent = sentForFix(data, record?.generated_at ?? null);
  const fixGoing = data.runs.some((r) => r.job === 'fix' && active(r));
  // The fix's work list, when there is one: what became of each item it was sent.
  const fixItem = (id: string) => data.fix?.file.items.find((i) => i.id === id);
  // Answering and fixing wait for the first plan's merge: a fix is built against the plan. An earlier
  // audit is only read: answers and fixes go on the latest one.
  const past = Boolean(data.past);
  // A complete audit is final (audit-stage.ts): its fix merged or closed, or closed with nothing to build.
  const locked = auditLocked(data.stage, past);
  const open = data.canRun && !data.firstPlanPr && !locked;
  const busy = status && 'busy' in status ? status.busy : null;
  // Two tabs once there's a fix: what the audit found and what you chose, and where the fix stands.
  const [tabPicked, setTabPicked] = useState<'proposed' | 'built'>(data.fix ? 'built' : 'proposed');
  // After Build it, the Built tab: where the build stands, as soon as it has a work list. A tab picked by hand wins.
  const [followBuild, setFollowBuild] = useState(false);
  const tab = followBuild && data.fix ? 'built' : tabPicked;
  const setTab = (v: 'proposed' | 'built') => {
    setFollowBuild(false);
    setTabPicked(v);
  };
  const onAudit = !data.fix || tab === 'proposed';
  const fixT = data.fix ? fixTally(data.fix.file) : null;
  const fixWaiting = data.fix ? data.fix.file.items.filter((i) => i.state === 'held_back' && !answeredHeldBack(i)).length : 0;
  // The Built tab says where the fix stands: merged, ready to merge, waiting on your answers, or how far it got.
  const builtTab: BuiltTab = {
    k: !data.fix ? 'built' : fixOverall(data.fix) === 'merged' ? 'builtMerged' : fixOverall(data.fix) === 'ready' ? 'builtReady' : fixWaiting && !fixT!.todo ? 'builtWaiting' : 'built',
    done: fixT?.done ?? 0,
    total: fixT?.total ?? 0,
    waiting: fixWaiting,
  };

  // The newest audit run, when it failed after the audit shown (or there's none): the page leads with it.
  const newestAudit = data.runs.find((r) => r.job === 'audit');
  const auditGoing = !past && Boolean(newestAudit && active(newestAudit));
  const auditFailed = !past && newestAudit && (newestAudit.state === 'failed' || newestAudit.state === 'cancelled') && (!record || Date.parse(newestAudit.createdAt) > Date.parse(record.generated_at)) ? newestAudit : null;
  // That failed audit finished, and its results are kept on the run: publish them rather than run it again.
  const kept = auditFailed && data.kept && data.kept.run.id === auditFailed.id ? data.kept : null;
  // An audit running, the first one or a new one: its page, empty until it finishes (the last one is on Audits).
  const runningView = !past && (data.stage === 'running' || starting);
  // The newest fix run, for its log while it builds.
  const fixRun = data.runs.find((r) => r.job === 'fix');

  const answers = (): AuditAnswers => ({
    version: 1,
    audit: record?.generated_at ?? '',
    saved_by: login,
    saved_at: new Date().toISOString(),
    answers: (record?.questions ?? []).map((q) => ({ question: q.id, option: choice[q.id] ?? null })),
    findings: [...picked],
    look_into: [...lookInto],
    tracking: (record?.drop_candidates ?? []).flatMap((d) => (tracking[d.name] ? [{ event: d.name, choice: tracking[d.name]! }] : [])),
    suggestions: (record?.property_suggestions ?? []).flatMap((sg) => (suggestions[sg.id] ? [{ id: sg.id, choice: suggestions[sg.id]! }] : [])),
    conditions: (record?.property_conditions ?? []).flatMap((c) => (conditions[c.id] ? [{ id: c.id, choice: conditions[c.id]! }] : [])),
    note: note.trim(),
  });
  const draft = answers();
  const work = hasWork(draft);
  // With a fix under way, Fix sends only changes: the same choices again would build nothing.
  const unchanged = Boolean(data.fix && record) && sameAsFix(draft, record!, data.fix!);
  const sum = answersSummary(draft);
  const start = async (what: Act) => {
    setConfirming(false);
    if (what === 'fix') setFollowBuild(true);
    setStatus({ busy: what });
    setStatus(await onRun(what, what === 'audit' || what === 'publish' ? undefined : answers()));
  };
  // An audit started here reports under the header; the bar reports saves and fixes.
  const auditStatus = status && (('sent' in status && (status.sent === 'audit' || status.sent === 'publish')) || ('error' in status && busy === null && !confirming && !work)) ? status : null;

  return (
    <>
      <ScreenHead
        crumbs={
          <>
            <Link href={AUDITS_PATH}>
              <C k="audit.crumb" />
            </Link>{' '}
            / {data.repo.repo}
            {past && record ? (
              <>
                {' '}
                / <When iso={record.generated_at} day />
              </>
            ) : null}
          </>
        }
        title={data.repo.repo}
        owner={data.repo.owner}
        actions={
          <>
            <a href={`https://github.com/${repoName}`} target="_blank" rel="noopener noreferrer" className={a.button}>
              <C k="screen.github" /> ↗
            </a>
            {/* No audit starts here: an audit screen shows one audit. Audits start from the Audits page. */}
          </>
        }
      />

      {auditStatus ? <StatusLine status={auditStatus} work={false} branch={data.defaultBranch} /> : null}

      {past && record ? (
        <div className={t2.failBox} style={{ borderColor: 'var(--border-strong)', background: 'transparent' }}>
          <C k="audit.past.body" as="p" vars={{ date: shortDay(record.generated_at) }} />
          <Link href={auditPath(data.repo)} className={a.button}>
            <C k="audit.past.latest" />
          </Link>
        </div>
      ) : null}

      {runningView ? <RunningAudit url={auditGoing && newestAudit ? newestAudit.url : actionsUrl(data.repo)} /> : null}

      {kept ? (
        <KeptBox kept={kept} canRun={data.canRun} busy={busy === 'publish'} onPublish={() => void start('publish')} />
      ) : auditFailed ? (
        <div className={t2.failBox}>
          <div>
            <Chip tone={auditFailed.state === 'cancelled' ? 'idle' : 'bad'}>
              <C k={auditFailed.state === 'cancelled' ? 'audit.failed.cancelled' : 'audit.failed.title'} />
            </Chip>{' '}
            <span className={t2.faint}>
              <When iso={auditFailed.createdAt} />
              {auditFailed.actor ? ` · @${auditFailed.actor}` : ''}
            </span>
            {failureKey(auditFailed) && failureKey(auditFailed) !== 'failed' && failureKey(auditFailed) !== 'cancelled' ? <C k={`runs.reasons.${failureKey(auditFailed)}`} as="p" /> : <C k="audit.failed.why" as="p" />}
          </div>
          <span className={t2.headActions}>
            <a href={auditFailed.url} target="_blank" rel="noopener noreferrer" className={a.button}>
              <C k="runs.log" />
            </a>
          </span>
        </div>
      ) : null}

      {!runningView && !past ? <StageBanner data={data} building={building} fixRun={fixRun} open={open} busy={busy === 'close'} onClose={() => void start('close')} /> : null}

      {data.firstPlanPr && !runningView ? (
        <div className={t2.failBox} style={{ borderColor: 'rgba(224, 164, 88, 0.4)', background: 'rgba(224, 164, 88, 0.06)' }}>
          <div>
            <C k="audit.firstPlan.title" as="strong" />
            <C k="audit.firstPlan.body" as="p" />
          </div>
          <a href={data.firstPlanPr.url} target="_blank" rel="noopener noreferrer" className={`${a.button} ${a.buttonPrimary}`}>
            <C k="audit.firstPlan.open" />
          </a>
        </div>
      ) : null}

      {!data.canRun && !past ? <C k="audit.noWrite" as="p" className={a.notice} vars={{ repo: repoName }} /> : null}

      {runningView ? null : !record ? (
        auditFailed ? null : (
          <div className={t2.emptyState}>
            <C k="audit.empty.title" as="p" />
          </div>
        )
      ) : (
        <>
          <Stats
            stats={[
              { k: 'audit.stats.health', value: record.health === null ? '–' : `${record.health}%`, big: true },
              { k: 'audit.stats.findings', value: record.findings.length, big: true },
              { k: 'audit.stats.questions', value: record.questions.length, big: true },
              { k: 'audit.stats.audited', value: <When iso={record.generated_at} day /> },
              {
                k: 'audit.stats.data',
                value: record.snapshot_source ? (
                  <C
                    k={record.snapshot_source.project ? 'audit.source' : 'audit.sourceNoProject'}
                    vars={{ tool: toolLabel(record.snapshot_source.tool), project: record.snapshot_source.project ?? '', days: String(record.snapshot_source.window_days) }}
                  />
                ) : (
                  <C k="audit.sourceNone" />
                ),
              },
              { k: 'audit.stats.scope', value: record.scope ?? <C k="audit.scopeAll" /> },
            ]}
          />
          {keyRejected(record) ? <C k="audit.keyRejected" as="p" className={a.notice} /> : null}
          {record.incomplete_areas.length ? <C k="audit.unfinished" as="p" className={a.notice} vars={{ count: String(record.incomplete_areas.length), areas: record.incomplete_areas.map((x) => x.area).join(', ') }} /> : null}

          {data.fix ? <ScreenTabs value={tab} onChange={setTab} built={builtTab} /> : null}

          {data.fix && tab === 'built' ? <FixPanel fix={data.fix} record={record} canRun={data.canRun && !locked} fixGoing={fixGoing} onRun={onRun} onFixAnswer={onFixAnswer} /> : null}

          {data.fix && tab === 'built' && data.fixPrs.length > 1 ? (
            <section className={s.section}>
              <C k="audit.fixPrs.title" as="h2" className={s.sectionTitle} />
              <ul className={s.list}>
                {data.fixPrs.map((p) => (
                  <li key={p.number}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className={t2.link}>
                      <C k="audit.fixPrs.row" vars={{ n: String(p.number), title: p.title }} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {onAudit ? (
            <>
              {record.not_read?.length ? <C k="audit.notRead" as="p" className={a.notice} vars={{ groups: record.not_read.map(unreadText).join(', ') }} /> : null}
              {data.fix ? <C k="audit.changeNote" as="p" className={a.note} /> : null}
              {data.firstPlanPr ? <C k="audit.locked" as="p" className={a.note} /> : null}
              <Tabs
                label={t('audit.sections.label')}
                items={(
                  [
                    ['findings', 'audit.sections.findings', record.findings.length],
                    ['events', 'audit.sections.events', record.events?.length ?? null],
                    ['questions', 'audit.sections.questions', record.questions.length],
                    ['suggestions', 'audit.sections.suggestions', record.property_suggestions.length],
                    ['conditions', 'audit.sections.conditions', record.property_conditions.length],
                    ['noData', 'audit.sections.noData', record.no_data.length],
                    ['tracking', 'audit.sections.tracking', record.drop_candidates.length],
                    ['note', 'screen.sections.note', null],
                  ] as [Section, string, number | null][]
                ).filter(([key, , n]) => key === 'findings' || key === 'events' || (key === 'note' ? open : Boolean(n)))}
                value={section}
                onChange={setSection}
              />

              {section === 'findings' ? (
                record.findings.length ? (
                  <FindingsTable groups={groups} elsewhere={problemsElsewhere(record)} onGoTo={setSection} repoName={repoName} sha={data.defaultBranch} picked={picked} sent={sent} fixItem={fixItem} onToggle={open ? (id) => setPicked((p) => toggled(p, id)) : undefined} onAll={open ? (all) => setPicked(all ? new Set(record.findings.map((f) => f.id).filter((id) => !sent.has(id))) : new Set()) : undefined} />
                ) : (
                  <C k="audit.findings.none" as="p" className={a.note} />
                )
              ) : null}
              {section === 'findings' && record.not_proposed?.length ? (
                <details className={x.dismissed}>
                  <C k="audit.notProposed.title" as="summary" vars={{ n: String(record.not_proposed.length) }} />
                  <C k="audit.notProposed.intro" as="p" className={a.note} />
                  {[...new Set(record.not_proposed.map((n) => n.area))].map((area) => (
                    <Fragment key={area}>
                      <p className={`${s.mono} ${t2.faint}`}>{area}</p>
                      <ul>
                        {record.not_proposed!.filter((n) => n.area === area).map((n, i) => {
                          const ev = n.evidence.find((e) => 'code' in e);
                          const code = ev && 'code' in ev ? ev.code : undefined;
                          const href = code ? codeLink(code, repoName, data.defaultBranch) : null;
                          return (
                            <li key={i}>
                              <strong>{n.action}</strong>
                              {code ? (href ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${s.mono} ${t2.faint}`}> {code}</a> : <span className={`${s.mono} ${t2.faint}`}> {code}</span>) : null}
                              <span className={x.cardWhy}>{n.reason}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </Fragment>
                  ))}
                </details>
              ) : null}
              {section === 'findings' && record.dismissed?.length ? (
                <details className={x.dismissed}>
                  <C k="audit.dismissed.title" as="summary" vars={{ n: String(record.dismissed.length) }} />
                  <C k="audit.dismissed.intro" as="p" className={a.note} />
                  <ul>
                    {record.dismissed.map((d, i) => (
                      <li key={i}>
                        <strong>{d.title}</strong>
                        {d.items?.length ? <span className={`${s.mono} ${t2.faint}`}> {d.items.join(', ')}</span> : null}
                        <span className={x.cardWhy}>{d.reason}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {section === 'events' ? (
                record.events ? (
                  <>
                    {record.incomplete_areas.length ? <C k="events.incomplete" as="p" className={a.notice} vars={{ areas: record.incomplete_areas.map((x) => x.area).join(', ') }} /> : null}
                    <EventsTable cards={record.events} repoName={repoName} sha={data.defaultBranch} intro="events.auditIntro" linkTo={(c) => c.finding ?? null} warnings={(name) => record.items.find((i) => i.name === name)?.checks ?? []} sentBy={(name) => record.items.find((i) => i.name === name)?.sent_by} />
                  </>
                ) : (
                  <C k="events.old" as="p" className={a.note} />
                )
              ) : null}

              {section === 'suggestions' ? (
                <>
                  <C k="audit.suggestions.intro" as="p" className={a.note} />
                  <ChoiceTable head={['audit.suggestions.columns.property', 'audit.suggestions.columns.event', 'audit.suggestions.columns.question', 'audit.columns.choice']}>
                    {record.property_suggestions.map((sg) => (
                      <SuggestionRow key={sg.id} sg={sg} repoName={repoName} sha={data.defaultBranch} value={suggestions[sg.id] ?? null} onChoose={open ? (v) => setSuggestions((c) => ({ ...c, [sg.id]: v })) : undefined} />
                    ))}
                  </ChoiceTable>
                </>
              ) : null}

              {section === 'conditions' ? (
                <>
                  <C k="audit.conditions.intro" as="p" className={a.note} />
                  <ChoiceTable head={['audit.conditions.columns.property', 'audit.conditions.columns.event', 'audit.conditions.columns.when', 'audit.columns.choice']}>
                    {record.property_conditions.map((c) => (
                      <ConditionRow key={c.id} c={c} repoName={repoName} sha={data.defaultBranch} value={conditions[c.id] ?? null} onChoose={open ? (v) => setConditions((was) => ({ ...was, [c.id]: v })) : undefined} />
                    ))}
                  </ChoiceTable>
                </>
              ) : null}

              {section === 'questions' ? (
                <div className={s.questions}>
                  {record.questions.map((q) => (
                    <QuestionCard
                      key={q.id}
                      id={q.id}
                      question={q.question}
                      chip={
                        sent.answers ? (
                          <Chip tone="run">
                            <C k="audit.status.inFix" />
                          </Chip>
                        ) : null
                      }
                      about={
                        q.why || q.findings?.length ? (
                          <>
                            {q.findings?.length ? <C k="audit.questions.about" vars={{ ids: q.findings.join(', ') }} /> : null}
                            {q.findings?.length && q.why ? ' · ' : ''}
                            {q.why}
                          </>
                        ) : undefined
                      }
                      options={q.options.map((o) => ({ key: o.id, text: o.text }))}
                      recommended={q.recommended}
                      value={choice[q.id] ? { pick: choice[q.id]! } : null}
                      onAnswer={(v) => setChoice((c) => ({ ...c, [q.id]: v && 'pick' in v ? v.pick : null }))}
                      readOnly={!open}
                      later
                    />
                  ))}
                </div>
              ) : null}

              {section === 'noData' ? (
                <ChoiceTable head={['audit.columns.event', 'audit.noData.why', 'audit.columns.choice']}>
                  {record.no_data.map((n) => (
                    <NoDataRow key={n.name} n={n} looking={lookInto.has(n.name)} onLook={open ? (v) => setLookInto((l) => (v === l.has(n.name) ? l : toggled(l, n.name))) : undefined} />
                  ))}
                </ChoiceTable>
              ) : null}

              {section === 'tracking' ? (
                <ChoiceTable head={['audit.columns.event', 'audit.tracking.why', 'audit.columns.choice']}>
                  {record.drop_candidates.map((d) => (
                    <DropRow key={d.name} d={d} repoName={repoName} sha={data.defaultBranch} value={tracking[d.name] ?? null} onChoose={open ? (v) => setTracking((c) => ({ ...c, [d.name]: v })) : undefined} />
                  ))}
                </ChoiceTable>
              ) : null}

              {section === 'note' && open ? (
                <NoteBox value={note} onChange={setNote} />
              ) : null}
            </>
          ) : null}

          {open && onAudit ? (
            <ActionBar
              line={
                fixGoing && !status ? (
                  <C k="audit.fix.going" as="p" className={s.barNotice} />
                ) : unchanged && !status ? (
                  <C k="audit.fix.unchanged" as="p" className={s.barNotice} />
                ) : (
                  <StatusLine status={status && status !== auditStatus ? status : null} work={work} branch={data.defaultBranch} summary={sum} />
                )
              }
              summary={<C k={sum.note ? 'audit.fix.summaryNote' : 'audit.fix.summary'} as="p" className={s.barNotice} vars={{ findings: String(sum.findings), answers: String(sum.answered), added: String(sum.added), skipped: String(sum.skipped), lookInto: String(sum.lookInto), dropped: String(sum.dropped), kept: String(sum.kept) }} />}
              confirming={confirming}
              onConfirming={setConfirming}
              onSave={() => void start('save')}
              onBuild={() => void start('fix')}
              saveDisabled={busy !== null}
              buildDisabled={!work || unchanged || fixGoing || busy !== null}
              busy={busy === 'save' ? 'save' : busy === 'fix' ? 'build' : null}
            />
          ) : null}
        </>
      )}

      <LatestRun runs={data.runs} />
      {data.runs.length ? (
        <section className={s.section}>
          <C k="runs.title" as="h2" className={s.sectionTitle} />
          <RunList runs={data.runs.slice(0, 8)} />
        </section>
      ) : null}
    </>
  );
}

export const SEVERITY_CLASS = { high: 'sevHigh', medium: 'sevMedium', low: 'sevLow' } as const;

/** What became of a finding: done, held back or in the fix (from its work list), or sent to a run. */
function findingState(id: string, sent: Set<string>, fixItem: (id: string) => FixItem | undefined): { tone: Tone; k: string } | null {
  const item = fixItem(id);
  if (item?.state === 'done') return { tone: 'ok', k: 'audit.status.done' };
  if (item?.state === 'held_back') return { tone: 'warn', k: 'audit.status.heldBack' };
  if (item || sent.has(id)) return { tone: 'run', k: 'audit.status.inFix' };
  return null;
}

/**
 * A finding's events: the first three, then "+N more" to see the rest. Events its fix adds, which don't
 * exist yet (`proposed_events`), come after the existing ones, each marked as new.
 */
export function FindingEvents({ items, proposed = [] }: { items: string[]; proposed?: string[] }) {
  const [all, setAll] = useState(false);
  const names = [...items.map((name) => ({ name, isNew: false })), ...proposed.filter((n) => !items.includes(n)).map((name) => ({ name, isNew: true }))];
  const shown = all ? names : names.slice(0, 3);
  return (
    <div className={x.findingEvents}>
      {shown.map(({ name, isNew }) => (
        <span key={`${isNew ? 'new' : 'old'}:${name}`} className={`${s.mono} ${t2.main}`}>
          {name}
          {isNew ? (
            <>
              {' '}
              <C k="audit.findings.proposed" className={t2.faint} />
            </>
          ) : null}
        </span>
      ))}
      {names.length > 3 ? (
        <button type="button" className={x.moreEvents} onClick={() => setAll((v) => !v)} aria-expanded={all}>
          <C k={all ? 'audit.findings.fewer' : 'audit.findings.more'} vars={{ n: String(names.length - 3) }} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The findings, grouped by what they're about (the check most of a finding's card checks are): tick,
 * every event it covers, the problem, severity, where it stands, Why ▸. Last, the problems on the event
 * cards that no finding covers, with the tab each one is decided on, so every problem is here.
 */
function FindingsTable({
  groups,
  elsewhere,
  onGoTo,
  repoName,
  sha,
  picked,
  sent,
  fixItem,
  onToggle,
  onAll,
}: {
  groups: ReturnType<typeof groupAuditFindings>;
  elsewhere: ElsewhereProblem[];
  onGoTo: (section: Section) => void;
  repoName: string;
  sha: string;
  picked: Set<string>;
  sent: Set<string>;
  fixItem: (id: string) => FixItem | undefined;
  onToggle?: (id: string) => void;
  onAll?: (all: boolean) => void;
}) {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const all = groups.flatMap((g) => g.findings).filter((f) => !sent.has(f.id));
  const allOn = all.length > 0 && all.every((f) => picked.has(f.id));
  const cols = onToggle ? 6 : 5;
  return (
    <div className={t2.tableWrap}>
      <table className={t2.table}>
        <thead>
          <tr>
            {onToggle ? (
              <th style={{ width: '1%' }}>
                <input type="checkbox" className={x.check} checked={allOn} onChange={() => onAll?.(!allOn)} aria-label={t('audit.findings.selectAll')} />
              </th>
            ) : null}
            <C k="audit.columns.event" as="th" />
            <C k="audit.columns.problem" as="th" />
            <C k="audit.columns.severity" as="th" />
            <C k="audit.columns.status" as="th" />
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.category}>
              <tr className={t2.groupRow}>
                <th colSpan={cols}>
                  <C k={g.category === 'other' || g.category === 'missing' ? `audit.groups.${g.category}` : `events.checks.${camel(g.category)}`} />
                </th>
              </tr>
              {g.findings.map((f) => {
                const st = findingState(f.id, sent, fixItem);
                const isOpen = openRow === f.id;
                const item = fixItem(f.id);
                return (
                  <Fragment key={f.id}>
                    <tr>
                      {onToggle ? (
                        <td style={{ width: '1%' }}>
                          <input type="checkbox" className={x.check} checked={picked.has(f.id)} disabled={sent.has(f.id)} onChange={() => onToggle(f.id)} aria-label={f.title} />
                        </td>
                      ) : null}
                      <td className={x.findingEventsCell}>
                        <FindingEvents items={f.items} proposed={f.proposed_events} />
                      </td>
                      <td className={t2.main}>
                        {f.title}
                        {f.began ? <C k="audit.finding.began" vars={{ date: beganDate(f.began) }} /> : null}
                      </td>
                      <td>
                        <C k={`audit.severity.${f.severity}`} className={x[SEVERITY_CLASS[f.severity]]} />
                      </td>
                      <td>
                        {st ? (
                          <Chip tone={st.tone}>
                            <C k={st.k} />
                          </Chip>
                        ) : null}
                      </td>
                      <td className={t2.right}>
                        <button type="button" className={x.why} aria-expanded={isOpen} onClick={() => setOpenRow(isOpen ? null : f.id)}>
                          <C k="screen.why" /> {isOpen ? '▾' : '▸'}
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className={x.drawer}>
                        <td colSpan={cols}>
                          <p className={x.findingFix}>
                            <C k="audit.finding.fixLabel" as="strong" /> {f.fix}
                          </p>
                          {item?.summary ? <p className={x.findingFix}>{item.summary}</p> : null}
                          {f.explanation ? <p className={x.findingFix}>{f.explanation}</p> : null}
                          {f.evidence?.length ? <FindingEvidence evidence={f.evidence} repoName={repoName} sha={sha} /> : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
          {elsewhere.length ? (
            <>
              <tr className={t2.groupRow}>
                <th colSpan={cols}>
                  <C k="audit.elsewhere.title" />
                </th>
              </tr>
              {elsewhere.map((p) => (
                <tr key={`${p.event}.${p.check}`}>
                  {onToggle ? <td /> : null}
                  <td className={`${s.mono} ${t2.main}`}>{p.event}</td>
                  <td className={t2.main}>
                    <C k={`events.checks.${camel(p.check)}`} as="strong" />
                    {p.why ? <span className={x.cardWhy}>{p.why}</span> : null}
                    {p.reason && !p.tab ? <span className={`${x.cardWhy} ${x.wrap} ${t2.faint}`}>{p.reason}</span> : null}
                  </td>
                  <td />
                  <td colSpan={2} className={t2.right}>
                    {p.tab ? (
                      <button type="button" className={x.why} onClick={() => onGoTo(p.tab!)}>
                        <C k={`audit.elsewhere.${p.tab}`} vars={{ id: p.question ?? '' }} /> ▸
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** A finding's `began` as the screen says it: "4 Nov". */
export const beganDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A table of choices, with a header naming each column. */
function ChoiceTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className={t2.tableWrap}>
      <table className={t2.table}>
        <thead>
          <tr>
            {head.map((k, i) => (
              <C key={k} k={k} as="th" className={i === head.length - 1 ? t2.right : undefined} />
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** An item with no data that isn't a finding: its name, the audit's reason in two lines, Leave it or Look into it. */
function NoDataRow({ n, looking, onLook }: { n: NoDataItem; looking: boolean; onLook?: (v: boolean) => void }) {
  return (
    <tr>
      <td className={`${s.mono} ${t2.main}`} style={{ whiteSpace: 'nowrap' }}>
        {n.name}
      </td>
      <td>
        <span className={`${t2.clamp} ${t2.faint}`} style={{ whiteSpace: 'normal' }} title={n.reason}>
          {n.reason}
        </span>
      </td>
      <td className={t2.right}>
        <Segmented label={n.name} options={[false, true]} value={looking} onChoose={onLook} render={(v) => <C k={v ? 'audit.noData.look' : 'audit.noData.leave'} />} />
      </td>
    </tr>
  );
}

/**
 * A tracked event the audit thinks may not be needed: the rule it breaks and why, then Keep, Stop
 * tracking, Fold into (only when the audit named a target) or Decide later, the recommendation marked.
 */
function DropRow({ d, repoName, sha, value, onChoose }: { d: DropCandidate; repoName: string; sha: string; value: TrackingChoice | null; onChoose?: (v: TrackingChoice | null) => void }) {
  const choices: (TrackingChoice | null)[] = ['keep', 'drop', ...(d.fold_into ? (['fold'] as const) : []), ...(onChoose ? [null] : [])];
  return (
    <tr>
      <td style={{ minWidth: 200 }}>
        <span className={`${s.mono} ${t2.main}`}>{d.name}</span>
        <div className={t2.faint} style={{ whiteSpace: 'normal' }}>
          {d.rule}
          {d.volume !== undefined ? (
            <>
              {' · '}
              <C k="audit.tracking.volume" vars={{ n: d.volume.toLocaleString('en-US') }} />
            </>
          ) : null}
          {d.fold_into ? (
            <>
              {' · '}
              <C k="audit.tracking.foldTarget" vars={{ target: d.fold_into }} />
            </>
          ) : null}
        </div>
      </td>
      <td>
        <span className={`${t2.clamp} ${t2.faint}`} style={{ whiteSpace: 'normal' }} title={d.reason}>
          {d.reason}
        </span>
        {d.evidence.length ? (
          <details className={s.disclosure}>
            <C k="audit.tracking.where" as="summary" />
            <FindingEvidence evidence={d.evidence} repoName={repoName} sha={sha} />
          </details>
        ) : null}
      </td>
      <td className={t2.right}>
        <Segmented
          label={d.name}
          options={choices}
          value={value}
          onChoose={onChoose}
          render={(c) => (
            <>
              <C k={`audit.tracking.${c ?? 'later'}`} vars={{ target: d.fold_into ?? '' }} />
              {c !== null && c === d.recommended ? <span className={x.recDot} title={t('screen.recommended')} aria-label={t('screen.recommended')} /> : null}
            </>
          )}
        />
      </td>
    </tr>
  );
}

/** C10: a property an event could carry, the question it answers and the value at the call. Add or Skip; undecided until picked. */
function SuggestionRow({ sg, repoName, sha, value, onChoose }: { sg: PropertySuggestion; repoName: string; sha: string; value: SuggestionChoice | null; onChoose?: (v: SuggestionChoice | null) => void }) {
  const choices: (SuggestionChoice | null)[] = ['add', 'skip', ...(onChoose ? [null] : [])];
  return (
    <tr className={x.suggestRow}>
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className={`${s.mono} ${t2.main}`} style={{ overflowWrap: 'normal' }}>
          {sg.property}
        </span>
        <div className={t2.faint}>{sg.type}</div>
      </td>
      <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
        {sg.event}
      </td>
      <td>
        <span className={t2.faint} style={{ whiteSpace: 'normal' }}>
          {sg.question}
        </span>
        {sg.evidence.length ? (
          <details className={s.disclosure}>
            <C k="audit.suggestions.where" as="summary" />
            <FindingEvidence evidence={sg.evidence} repoName={repoName} sha={sha} />
          </details>
        ) : null}
      </td>
      <td className={t2.right}>
        <Segmented label={`${sg.event}.${sg.property}`} options={choices} value={value} onChoose={onChoose} render={(c) => <C k={c ? `audit.suggestions.${c}` : 'audit.tracking.later'} />} />
      </td>
    </tr>
  );
}

/** A property the audit decided applies only sometimes: when, why, and the calls. Keep it or say Every path; undecided until picked. */
function ConditionRow({ c, repoName, sha, value, onChoose }: { c: PropertyCondition; repoName: string; sha: string; value: ConditionChoice | null; onChoose?: (v: ConditionChoice | null) => void }) {
  const choices: (ConditionChoice | null)[] = ['keep', 'always', ...(onChoose ? [null] : [])];
  return (
    <tr className={x.suggestRow}>
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className={`${s.mono} ${t2.main}`} style={{ overflowWrap: 'normal' }}>
          {c.property}
        </span>
        <C k={c.in_plan ? 'audit.conditions.inPlan' : 'audit.conditions.proposed'} as="div" className={t2.faint} />
      </td>
      <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
        {c.event}
      </td>
      <td>
        <C k="audit.conditions.onlyWhen" as="span" className={t2.main} vars={{ when: c.only_when }} />
        <div className={t2.faint} style={{ whiteSpace: 'normal' }}>
          {c.why}
        </div>
        {c.evidence.length ? (
          <details className={s.disclosure}>
            <C k="audit.conditions.where" as="summary" />
            <FindingEvidence evidence={c.evidence} repoName={repoName} sha={sha} />
          </details>
        ) : null}
      </td>
      <td className={t2.right}>
        <Segmented label={`${c.event}.${c.property}`} options={choices} value={value} onChoose={onChoose} render={(v) => <C k={v ? `audit.conditions.${v}` : 'audit.tracking.later'} />} />
      </td>
    </tr>
  );
}

/**
 * A failed audit whose results are kept on its run (KeptAudit): Publish puts them on the repo with
 * nothing run again, then the box follows the publish run until the audit shows.
 */
function KeptBox({ kept, canRun, busy, onPublish }: { kept: KeptAudit; canRun: boolean; busy: boolean; onPublish: () => void }) {
  const publish = kept.publish;
  const going = Boolean(publish && active(publish));
  const failed = !going && publish?.state === 'failed';
  const run = going || failed ? publish! : kept.run;
  return (
    <div className={t2.failBox} style={going ? { borderColor: 'var(--border-strong)', background: 'transparent' } : undefined}>
      <div>
        <Chip tone={going ? 'run' : 'bad'}>
          <C k={going ? 'audit.kept.publishing' : failed ? 'audit.kept.publishFailed' : 'audit.kept.title'} />
        </Chip>{' '}
        <span className={t2.faint}>
          <When iso={run.createdAt} />
          {run.actor ? ` · @${run.actor}` : ''}
        </span>
        {going ? (
          <C k="audit.kept.publishingBody" as="p" vars={{ date: shortDay(kept.run.createdAt) }} />
        ) : failed ? (
          <C k="audit.kept.publishFailedBody" as="p" />
        ) : (
          <>
            <C k="audit.kept.body" as="p" vars={{ date: kept.expiresAt ? shortDay(kept.expiresAt) : '' }} />
            {kept.why ? <C k="audit.kept.why" as="p" className={t2.faint} vars={{ why: kept.why }} /> : null}
            {!canRun ? <C k="audit.kept.noWrite" as="p" className={t2.faint} /> : null}
          </>
        )}
      </div>
      <span className={t2.headActions}>
        <a href={run.url} target="_blank" rel="noopener noreferrer" className={a.button}>
          <C k="runs.log" />
        </a>
        {canRun && !going ? (
          <button type="button" className={`${a.button} ${a.buttonPrimary}`} onClick={onPublish} disabled={busy} aria-busy={busy}>
            <C k={failed ? 'audit.kept.retry' : 'audit.kept.publish'} />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function StatusLine({ status, work, branch, summary }: { status: AuditStatus | null; work: boolean; branch: string; summary?: ReturnType<typeof answersSummary> }) {
  const cls = s.barNotice;
  if (status && 'sent' in status) return <C k={`audit.sent.${status.sent}`} as="p" className={cls} />;
  if (status && 'error' in status) return <C k={`audit.errors.${status.error}`} as="p" className={`${cls} ${s.barNoticeWarn}`} vars={{ branch, message: status.message }} />;
  if (work && summary) return <C k="audit.fix.selected" as="p" className={cls} vars={{ n: String(summary.findings + summary.answered + summary.lookInto + summary.dropped + summary.kept + summary.conditions + (summary.note ? 1 : 0)) }} />;
  return <C k={work ? 'audit.fix.hint' : 'audit.fix.nothing'} as="p" className={cls} />;
}

/** The tool's name from the copy, or as the audit wrote it. */
const toolLabel = (tool: string) => (hasReviewText(`audit.tools.${tool}`) ? t(`audit.tools.${tool}`) : tool);

function FindingEvidence({ evidence, repoName, sha }: { evidence: AuditEvidence[]; repoName: string; sha: string }) {
  return (
    <ul className={s.evidence}>
      {evidence.map((e, i) =>
        'code' in e ? (
          <li key={i}>
            {codeLink(e.code, repoName, sha) ? (
              <a href={codeLink(e.code, repoName, sha)!} target="_blank" rel="noopener noreferrer" className={s.mono}>
                {e.code}
              </a>
            ) : (
              <span className={s.mono}>{e.code}</span>
            )}
            <code className={s.quote}>{e.quote}</code>
          </li>
        ) : (
          <li key={i}>
            <C k="audit.finding.query" vars={{ query: e.query }} className={s.mono} />
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * A work-list item's name in a few words: a question's topic (the words before its colon), or the
 * start of what was asked. The full text is under Details.
 */
export function shortTitle(item: Pick<FixItem, 'id' | 'kind' | 'title'>, record: Pick<AuditRecord, 'questions' | 'findings'> | null): string {
  const cut = (text: string, max = 72) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max) > 30 ? text.lastIndexOf(' ', max) : max).replace(/[,;:.\s]+$/, '')}…`);
  if (item.kind === 'question') {
    const q = record?.questions.find((y) => y.id === item.id)?.question ?? item.title;
    const colon = q.indexOf(':');
    return colon > 0 && colon <= 48 ? q.slice(0, colon) : cut(q, 60);
  }
  if (item.kind === 'finding') return cut(record?.findings.find((f) => f.id === item.id)?.title ?? item.title);
  return cut(item.title);
}

const OVERALL_TONE: Record<string, Tone> = { ready: 'ok', merged: 'ok', heldBack: 'warn', unfinished: 'warn', mergedLeft: 'warn', needsPerson: 'bad', closed: 'idle', building: 'run' };
/** Where the fix stands needs a sentence only when the counts and the chip don't say it. */
const OVERALL_SENTENCE = new Set(['needsPerson', 'mergedLeft', 'closed', 'building']);

/**
 * The Built tab: where the fix stands (chip, done of total, how many need you, its pull request),
 * Continue, and the items as Not built and Built. A held-back item shows its question to answer; a
 * built one says in a line what changed, with the full ask under Details.
 */
export function FixPanel({ fix, record, canRun, fixGoing, onRun, onFixAnswer }: { fix: FixProgress; record: AuditRecord | null; canRun: boolean; fixGoing: boolean; onRun: OnRun; onFixAnswer?: OnFixAnswer }) {
  const [status, setStatus] = useState<AuditStatus | null>(null);
  const overall = fixOverall(fix);
  const tally = fixTally(fix.file);
  const why = statusReason(fix.status?.description);
  const vars = { done: String(tally.done), total: String(tally.total), n: String(tally.heldBack), left: String(tally.todo + tally.heldBack), why, branch: fix.branch, pr: String(fix.pr?.number ?? '') };
  const continuable = canRun && canContinue(fix);
  const waiting = fix.file.items.filter((i) => i.state === 'held_back' && !answeredHeldBack(i)).length;
  const sentNow = status && 'sent' in status;
  const notDone = fix.file.items.filter((i) => i.state !== 'done');
  const done = fix.file.items.filter((i) => i.state === 'done');
  const [tab, setTab] = useState<'notDone' | 'done'>(notDone.length ? 'notDone' : 'done');
  // Every held-back question's answer on screen: the saved one, else the recommended pick.
  const held = fix.file.items.filter((i) => i.state === 'held_back' && i.question);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const shown = (i: FixItem) => answers[i.id] ?? i.question!.answer ?? i.question!.recommended;
  // What Save and Build it write: each shown answer that isn't saved yet (an empty own answer isn't one).
  const unsaved = Object.fromEntries(held.filter((i) => shown(i) !== '' && shown(i) !== i.question!.answer).map((i) => [i.id, shown(i)]));
  const [saving, setSaving] = useState<'save' | 'build' | null>(null);
  const [saved, setSaved] = useState<{ built: boolean } | { error: string } | null>(null);
  const canAnswer = canRun && Boolean(onFixAnswer) && !fixGoing;
  // Its run is listed: the button waits on that run now, and shows again if the fix is still unfinished after it.
  useEffect(() => {
    if (fixGoing) setStatus(null);
  }, [fixGoing]);
  const go = async () => {
    setStatus({ busy: 'continue' });
    setStatus(await onRun('continue'));
  };
  // One Save and one Build it for all the questions: Save commits the answers, Build it also starts the run.
  const send = async (build: boolean) => {
    if (!onFixAnswer) return;
    setSaving(build ? 'build' : 'save');
    const error = Object.keys(unsaved).length ? await onFixAnswer(unsaved) : null;
    setSaving(null);
    // The picks stay as they are: the reload after a save brings them back as the saved answers.
    setSaved(error ? { error } : { built: build });
    if (!error && build) await go();
  };
  return (
    <section className={s.section}>
      <BuiltHead
        tone={OVERALL_TONE[overall] ?? 'idle'}
        chipKey={`screen.chips.${overall}`}
        count={<C k="screen.count" vars={vars} />}
        extra={
          <>
            {waiting ? (
              <>
                {' · '}
                <C k="audit.fixProgress.waiting" vars={{ n: String(waiting) }} className={x.warnText} />
              </>
            ) : null}
            {fix.pr ? (
              <>
                {' · '}
                <a href={fix.pr.url} target="_blank" rel="noopener noreferrer" className={t2.link}>
                  <C k="audit.fixProgress.pr" vars={{ n: String(fix.pr.number), title: fix.pr.title }} />
                </a>
                {fix.pr.state === 'open' && fix.pr.draft ? (
                  <>
                    {' '}
                    <C k="audit.fixProgress.draft" className={s.badge} />
                  </>
                ) : null}
              </>
            ) : (
              <>
                {' · '}
                <C k="audit.fixProgress.noPr" vars={vars} />
              </>
            )}
          </>
        }
        // Ready to merge: nothing to continue, so no button; the line below says to review and merge.
        showContinue={canRun && overall !== 'merged' && overall !== 'ready'}
        continueDisabled={!continuable || fixGoing || Boolean(sentNow)}
        continueBusy={Boolean(status && 'busy' in status)}
        onContinue={() => void go()}
      />
      {OVERALL_SENTENCE.has(overall) ? <C k={`audit.fixProgress.overall.${overall === 'needsPerson' && !why ? 'needsPersonNoReason' : overall}`} as="p" className={a.note} vars={vars} /> : null}
      {canRun && overall !== 'merged' ? (
        status && 'sent' in status ? (
          <C k="audit.sent.continue" as="p" className={a.note} />
        ) : status && 'error' in status ? (
          <C k={`audit.errors.${status.error}`} as="p" className={a.error} vars={{ branch: fix.branch, message: status.message }} />
        ) : fixGoing ? (
          <C k="audit.fix.going" as="p" className={a.note} />
        ) : continuable ? (
          <C k="screen.continueHint" as="p" className={a.note} />
        ) : (
          // Why there's nothing to continue: a question to answer first, or everything built.
          <C k={waiting ? 'audit.fixProgress.blocked.answerFirst' : 'audit.fixProgress.blocked.allBuilt'} as="p" className={a.note} vars={{ n: String(waiting), pr: String(fix.pr?.number ?? '') }} />
        )
      ) : null}
      {fix.pr?.state === 'open' && notDone.length && (overall === 'heldBack' || overall === 'unfinished' || overall === 'needsPerson') ? <C k="audit.fixProgress.mergeHint" as="p" className={a.note} /> : null}

      <BuiltLists<FixItem>
        notDone={notDone}
        done={done}
        value={tab}
        onChange={setTab}
        render={(item) => <FixItemRow key={item.id} item={item} record={record} canAnswer={canAnswer} value={item.question ? shown(item) : undefined} onAnswer={(v) => (setAnswers((c) => ({ ...c, [item.id]: v })), setSaved(null))} />}
      />
      {canAnswer && held.length && tab === 'notDone' ? (
        <ActionBar
          line={
            saved && 'error' in saved ? (
              <C k="audit.errors.answerFailed" as="p" className={a.error} vars={{ message: saved.error }} />
            ) : saved?.built ? (
              <C k="audit.fixProgress.answeredBuilding" as="p" className={s.barNotice} />
            ) : saved ? (
              <C k="audit.fixProgress.answered" as="p" className={s.barNotice} />
            ) : (
              <C k="audit.fixProgress.barLine" as="p" className={s.barNotice} />
            )
          }
          summary={null}
          // No confirm step here: Build it saves the answers and starts the run straight away.
          confirming={false}
          onConfirming={(v) => v && void send(true)}
          onSave={() => void send(false)}
          onBuild={() => void send(true)}
          saveDisabled={!Object.keys(unsaved).length}
          buildDisabled={Boolean(sentNow)}
          busy={saving}
        />
      ) : null}
    </section>
  );
}

/** One work-list item: its short name and what came of it; a held-back one shows its question to answer. Saving is the panel's one bar. */
function FixItemRow({ item, record, canAnswer, value, onAnswer }: { item: FixItem; record: AuditRecord | null; canAnswer: boolean; value?: number | string; onAnswer: (v: number | string) => void }) {
  const q = item.question;
  const [details, setDetails] = useState(false);
  const short = shortTitle(item, record);
  return (
    <WorkRow
      id={item.id}
      title={short}
      summary={item.summary ? item.summary : item.state === 'todo' ? <C k="audit.fixProgress.notBuilt" /> : null}
      full={item.title}
      details={details}
      onDetails={item.state !== 'held_back' && short !== item.title ? () => setDetails((v) => !v) : undefined}
    >
      {item.state === 'held_back' && q && value !== undefined ? (
        <div style={{ marginTop: 10 }}>
          <QuestionCard
            question={q.text}
            options={q.options.map((o, i) => ({ key: String(i), text: o }))}
            recommended={String(q.recommended)}
            value={typeof value === 'string' ? { own: value } : { pick: String(value) }}
            onAnswer={(v) => onAnswer(v && 'own' in v ? v.own : v ? Number(v.pick) : q.recommended)}
            readOnly={!canAnswer}
            own
          />
          {answeredHeldBack(item) ? <C k="audit.fixProgress.answered" as="p" className={a.note} /> : null}
        </div>
      ) : null}
    </WorkRow>
  );
}
