'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import a from '@/components/account/account.module.css';
import { useAccount } from '@/components/account/account-shell';
import { adminRepos, AnalyticsFields, SheetFields, type SheetRow } from '@/components/tracking-agent/onboarding/screens';
import { Field } from '@/components/tracking-agent/setup/ui';
import { rich } from '@/lib/content/rich';
import { trackingAgentDashboardContent } from '@/lib/content/trackingAgentDashboard';
import { auditPath } from '@/lib/tracking-agent/audit';
import type { GhRepo, GitHubClient } from '@/lib/tracking-agent/github/client';
import { appInstallUrl, workspaceAdmin } from '@/lib/tracking-agent/onboarding/flow';
import { chosenConfig, isStale, isUnread, newestRun, oldestAsOf, reopenSetupPr, repoStage, runFirstAudit, type RepoFacts, type RepoStage } from '@/lib/tracking-agent/repos';
import { active, startedBySetup } from '@/lib/tracking-agent/runs';
import { verifyPath } from '@/lib/tracking-agent/verify';
import { APP_INSTALL_URL, appInstalledOn, connectSheet, createKey, disconnectSheet, getSheets, linkProblem, linkRepoIds, type AuthHeader, type LinkProblem, type SheetView } from '@/lib/tracking-agent/setup/datalyze-api';
import { checkAnalyticsLive, analyticsFormatIssues, type LiveCheck } from '@/lib/tracking-agent/setup/check-analytics';
import { draftProblems, type Draft, type PickedRepo, type SecretValues } from '@/lib/tracking-agent/setup/draft';
import { openSetupPr, requireChecksFor, saveSecrets } from '@/lib/tracking-agent/setup/install';
import { addAnalytics, analyticsSecrets, canCheckKeys, freshKeyResult, keyCheckResult, startKeyCheck, type CheckedKey, type StartedCheck, draftFromConfig, modelSecret, openContextPr, openMovePr, pickedOf, secretSavedAt, workflowFacts, WORKFLOW_PATH } from '@/lib/tracking-agent/setup-page';
import { parseContext, type ContextAnswers, type ContextId } from '@/tracking-agent/src/setup/context';
import { MODEL_KEY, SETUP_BRANCH } from '@/tracking-agent/src/setup/core';
import { toolName } from './dashboard';
import { When } from './ui';
import { ConnectForChanges, GitHubCard, PageHead, T, UnreadNotice, day, plain, text, useLinkedRepos } from './shared';
import { TeamSection } from './team';
import s from './app.module.css';

const SHEET_DOCS = '/tracking-agent/docs/google-sheet';

/**
 * /tracking-agent/setup (REBUILD §6): the connections (GitHub, the Anthropic key, analytics, the
 * team's context, the Google Sheet), the repos with each one's next step, and the
 * team. Everything is read from and written to GitHub in this browser with the person's own
 * sign-in; a new key goes straight to the repos' secrets and old values are never shown.
 */
export function SetupPage() {
  // Setup shows no proposals: their statuses aren't read here (fewer GitHub calls per load).
  const linked = useLinkedRepos({ proposals: false });
  const { authHeader, account } = useAccount();
  if (linked.needsGitHub) {
    return (
      <>
        <PageHead title="setup.title" intro="setup.intro" />
        <GitHubCard returnTo="/tracking-agent/setup" />
      </>
    );
  }
  return <SetupView repos={linked.repos} loading={linked.loading} unseen={linked.unseen} unread={linked.unread} gh={linked.gh} login={linked.login} authHeader={authHeader} onChanged={linked.reload} admin={workspaceAdmin(account)} notice={<ConnectForChanges linked={linked} returnTo="/tracking-agent/setup" />} />;
}

/** `keySecret`: the organisation secret the workflow reads the Anthropic key from, when it isn't the repo's own. */
type Facts = { appInstalled: number | null; modelSaved: string | null; analyticsSaved: string | null; sheet: boolean | null; keySecret?: string | null; refused?: Partial<Record<CheckedKey, boolean>> };

/** Which saved keys the runner's last check refused, when that check is newer than the keys (so a reload keeps showing it). */
async function refusedKeys(gh: GitHubClient, r: RepoFacts, savedAt: (string | null)[]): Promise<Partial<Record<CheckedKey, boolean>>> {
  if (!canCheckKeys(r)) return {};
  const [owner = '', repo = ''] = r.fullName.split('/');
  const ref = { owner, repo };
  const result = await freshKeyResult(gh, ref, await gh.branchSha(ref, r.defaultBranch), savedAt);
  return { model: result?.model?.state === 'failure', analytics: result?.analytics?.state === 'failure' };
}

/**
 * The Setup page from its data, so the preview can pass fixtures (`gh` null there: nothing is written).
 * `admin`: may make licence keys, so add repos (members can't; the server refuses them too).
 */
export function SetupView({ repos: all, loading = false, unseen = 0, unread = 0, gh, login, authHeader, onChanged, preview, admin = true, notice }: { notice?: ReactNode; repos: RepoFacts[] | null; loading?: boolean; unseen?: number; unread?: number; gh: GitHubClient | null; login: string | null; authHeader: AuthHeader | null; onChanged: () => void; preview?: Facts; admin?: boolean }) {
  const [facts, setFacts] = useState<Facts>(preview ?? { appInstalled: null, modelSaved: null, analyticsSaved: null, sheet: null });
  // The connections (keys, analytics, context) are read from and written to repos whose setup was
  // read: one GitHub couldn't be asked about would read as "no config" and be written over.
  // Nor from a saved record: it has no config text to keep.
  const repos = useMemo(() => all?.filter((r) => !isUnread(r, 'config', 'setupConfig', 'context', 'workflow', 'setupPr') && !isStale(r, 'config', 'setupConfig', 'context', 'workflow', 'setupPr')) ?? null, [all]);
  // A repo whose setup PR isn't merged yet still says what setup chose. One that reads an analytics
  // tool comes first: a repo added without analytics mustn't make the workspace look like it has none.
  const first =
    repos?.find((r) => r.config && r.analytics) ??
    repos?.find((r) => r.analytics) ??
    repos?.find((r) => r.config) ??
    repos?.find((r) => r.setupConfig) ??
    repos?.[0] ??
    null;
  const draft = draftFromConfig(first ? chosenConfig(first) : null);

  useEffect(() => {
    if (preview || !repos?.length || !authHeader) return;
    let live = true;
    const ref = first ? { owner: first.fullName.split('/')[0]!, repo: first.fullName.split('/')[1]! } : null;
    const analytics = analyticsSecrets(draft)[0];
    // The workflow names the secret the key is in (an organisation secret has its own name).
    const branch = first?.configOnDefault ? first.defaultBranch : SETUP_BRANCH;
    Promise.all([
      appInstalledOn(authHeader, repos.map((r) => r.fullName)).then((x) => x.installed.length, () => null),
      // The secrets are read with this browser's GitHub sign-in only: without one they show as such, never "Not set".
      ref && gh ? secretSavedAt(gh, ref, MODEL_KEY) : Promise.resolve(null),
      ref && gh && analytics ? secretSavedAt(gh, ref, analytics) : Promise.resolve(null),
      ref && gh ? secretSavedAt(gh, ref, 'DATALYZE_SHEET_URL').then(Boolean) : Promise.resolve(null),
      ref && gh ? gh.file(ref, WORKFLOW_PATH, branch).then((f) => (f ? workflowFacts(f.text).keySecret : null), () => null) : Promise.resolve(null),
    ]).then(async ([appInstalled, modelSaved, analyticsSaved, sheet, keySecret]) => {
      if (!live) return;
      setFacts({ appInstalled, modelSaved, analyticsSaved, sheet, keySecret });
      // A refused key stays shown after a reload: the last check's result, if it's newer than the keys.
      const refused = first && gh ? await refusedKeys(gh, first, [modelSaved, analyticsSaved]).catch(() => ({})) : {};
      if (live) setFacts((f) => ({ ...f, refused }));
    });
    return () => {
      live = false;
    };
    // The first repo's config decides the draft; re-read when the repos change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh, repos, authHeader, preview]);

  return (
    <>
      <PageHead title="setup.title" intro="setup.intro" />
      {notice}
      {!repos ? (
        <div className={a.skeleton} style={{ height: 280 }} aria-busy="true" />
      ) : (
        <>
          <Connections repos={repos} draft={draft} first={first} facts={facts} gh={gh} login={login} authHeader={authHeader} admin={admin} onKeySaved={(which) => setFacts((f) => ({ ...f, refused: { ...f.refused, [which]: false } }))} />
          <Repos repos={all ?? []} gh={gh} authHeader={authHeader} draft={draft} loading={loading} unseen={unseen} unread={unread} onChanged={onChanged} admin={admin} />
        </>
      )}
      {preview ? null : <TeamSection authHeader={authHeader} />}
    </>
  );
}

function Row({ label, value, children, inline }: { label: string; value: ReactNode; children?: ReactNode; inline?: ReactNode }) {
  return (
    <li className={s.row}>
      <div className={s.rowMain}>
        <T k={label} className={s.rowTitle} />
        <div className={s.rowMeta}>{value}</div>
      </div>
      <div className={s.rowSide}>{children}</div>
      {inline ? <div className={s.inline}>{inline}</div> : null}
    </li>
  );
}

type Editing = 'model' | 'analytics' | 'context' | 'sheet';

function Connections({ repos, draft, first, facts, gh, login, authHeader, admin, onKeySaved }: { repos: RepoFacts[]; draft: Draft; first: RepoFacts | null; facts: Facts; gh: GitHubClient | null; login: string | null; authHeader: AuthHeader | null; admin: boolean; onKeySaved: (which: CheckedKey) => void }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const sheets = useSheets(authHeader);
  // Sheets through Datalyze, per repo; an Apps Script Sheet (the older route) counts once.
  const sheetCount = sheets.data?.sheets.filter((x) => repos.some((r) => r.id === x.githubRepoId)).length || (facts.sheet ? 1 : 0);
  const orgSecret = facts.keySecret && facts.keySecret !== MODEL_KEY ? facts.keySecret : null;
  const model = orgSecret ? null : modelSecret(draft);
  const analytics = analyticsSecrets(draft);
  const changeButton = (what: Editing, label = 'setup.change') => (
    <button type="button" className={a.button} onClick={() => setEditing(editing === what ? null : what)} data-ck={editing === what ? 'setup.cancel' : label}>
      {rich(text(editing === what ? 'setup.cancel' : label))}
    </button>
  );
  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <T k="setup.connectionsTitle" as="h2" className={s.sectionTitle} />
      </div>
      <ul className={s.rows} role="list">
        <Row label="setup.github.label" value={<T k={login ? 'setup.github.value' : 'setup.github.valueNoLogin'} vars={{ login: login ?? '', n: facts.appInstalled === null ? '…' : String(facts.appInstalled), total: String(repos.length) }} />}>
          <a href={APP_INSTALL_URL} target="_blank" rel="noreferrer" className={a.button} data-ck="setup.github.manage">
            {rich(text('setup.github.manage'))}
          </a>
        </Row>
        <Row
          label="setup.model.label"
          value={
            <>
              {orgSecret ? <T k="setup.model.orgSecret" vars={{ name: orgSecret }} /> : facts.modelSaved ? <T k="setup.model.saved" vars={{ date: day(facts.modelSaved) }} /> : <T k={gh ? 'setup.notSet' : 'setup.needsGitHub'} />}
              {facts.refused?.model ? <> · <T k="setup.refused" className={a.error} /></> : null}
            </>
          }
          inline={editing === 'model' && model ? <KeyForm names={[model]} repos={repos} gh={gh} which="model" onDone={() => setEditing(null)} onSaved={() => onKeySaved('model')} /> : null}
        >
          {model ? changeButton('model', 'setup.model.changeKey') : null}
        </Row>
        <Row
          label="setup.analytics.label"
          value={
            draft.analytics.tool === 'none' ? (
              <T k="setup.analytics.none" />
            ) : (
              <>
                {toolName(draft.analytics.tool)} · {(draft.analytics.region ?? 'us').toUpperCase()} ·{' '}
                {facts.analyticsSaved ? <T k="setup.analytics.saved" vars={{ date: day(facts.analyticsSaved) }} /> : <T k={gh ? 'setup.notSet' : 'setup.needsGitHub'} />}
                {facts.refused?.analytics ? <> · <T k="setup.refused" className={a.error} /></> : null}
              </>
            )
          }
          inline={editing === 'analytics' ? <AnalyticsForm current={draft} repos={repos} gh={gh} onSaved={() => onKeySaved('analytics')} /> : null}
        >
          {changeButton('analytics', analytics.length ? 'setup.change' : 'setup.analytics.add')}
        </Row>
        <Row
          label="setup.context.label"
          value={first?.context ? <T k="setup.context.written" vars={{ n: String(Object.keys(parseContext(first.context)).filter((k) => k !== 'other').length) }} /> : <T k="setup.context.none" />}
          inline={editing === 'context' ? <ContextForm current={first?.context ?? null} repos={repos} gh={gh} /> : null}
        >
          {changeButton('context')}
        </Row>
        <Row
          label="setup.sheet.label"
          value={sheets.failed && !sheets.data && !facts.sheet ? <T k="setup.sheet.loadFailed" className={a.error} /> : facts.sheet === null && !sheets.data ? '…' : sheetCount ? <T k="setup.sheet.connected" vars={{ n: String(sheetCount), total: String(repos.length) }} /> : <T k="setup.sheet.notConnected" />}
          inline={
            editing === 'sheet' && !repos.length ? (
              <T k="setup.sheet.noRepos" as="p" className={a.note} />
            ) : editing === 'sheet' && sheets.failed && !sheets.data ? (
              <SheetFields serviceAccount={null} rows={[]} onUrl={() => undefined} onConnect={() => undefined} onChange={() => undefined} onDisconnect={() => undefined} loadFailed onRetry={sheets.retry} />
            ) : editing === 'sheet' && sheets.data ? (
              <SheetPanel repos={repos} authHeader={authHeader} data={sheets.data} onSheets={sheets.set} />
            ) : null
          }
        >
          {changeButton('sheet', sheetCount ? 'setup.change' : 'setup.sheet.connect')}
        </Row>
        <LaptopKeyRow authHeader={authHeader} admin={admin} />
      </ul>
    </section>
  );
}

const LAPTOP_DOCS = '/tracking-agent/docs/claude-code';

/**
 * A key for the plugin on a laptop (REBUILD §5.3): made on the server and shown once, since Datalyze
 * keeps only its hash. Each one is a new live key; the repos' own keys are untouched.
 */
function LaptopKeyRow({ authHeader, admin }: { authHeader: AuthHeader | null; admin: boolean }) {
  const [state, setState] = useState<{ phase: 'idle' | 'busy' | 'failed' } | { phase: 'shown'; key: string }>({ phase: 'idle' });
  const make = () => {
    if (!authHeader) return;
    setState({ phase: 'busy' });
    createKey(authHeader).then(
      ({ key }) => setState({ phase: 'shown', key }),
      () => setState({ phase: 'failed' }),
    );
  };
  return (
    <Row
      label="setup.laptopKey.label"
      value={<T k="setup.laptopKey.value" />}
      inline={
        state.phase === 'shown' ? (
          <>
            <code className={s.secretOnce}>{state.key}</code>
            <T k="setup.laptopKey.shown" as="p" className={a.note} />
            <Link href={LAPTOP_DOCS} className={a.note} data-ck="setup.laptopKey.docs">
              {rich(text('setup.laptopKey.docs'))}
            </Link>
          </>
        ) : state.phase === 'failed' ? (
          <T k="setup.laptopKey.failed" as="p" className={a.notice} />
        ) : !admin ? (
          <T k="setup.laptopKey.adminOnly" as="p" className={a.note} />
        ) : null
      }
    >
      {admin && state.phase !== 'shown' ? (
        <button type="button" className={a.button} onClick={make} disabled={state.phase === 'busy' || !authHeader} data-ck={state.phase === 'busy' ? 'setup.laptopKey.busy' : 'setup.laptopKey.button'}>
          {rich(text(state.phase === 'busy' ? 'setup.laptopKey.busy' : 'setup.laptopKey.button'))}
        </button>
      ) : null}
    </Row>
  );
}

type SheetsData = { serviceAccount: string | null; sheets: SheetView[] };

/** The workspace's Sheets from Datalyze (null until loaded, and in the preview). */
function useSheets(authHeader: AuthHeader | null) {
  const [data, set] = useState<SheetsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!authHeader) return;
    let live = true;
    getSheets(authHeader).then(
      (d) => {
        if (!live) return;
        setFailed(false);
        set(d);
      },
      // A failed load isn't "no Sheets": it says so, with a retry.
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [authHeader, attempt]);
  return { data, set, failed, retry: () => setAttempt((n) => n + 1) };
}

/**
 * Setup's Google Sheet panel (tracking-agent/SPEC.md, the Google Sheet): the onboarding fields for each linked repo
 * and each Sheet's last sync. v2's workflow syncs the Sheet on every merge to the default branch, so
 * a Sheet connected here fills after the next one.
 */
function SheetPanel({ repos, authHeader, data, onSheets }: { repos: RepoFacts[]; authHeader: AuthHeader | null; data: SheetsData; onSheets: (d: SheetsData) => void }) {
  const [rows, setRows] = useState<Record<number, Partial<SheetRow>>>({});
  const [after, setAfter] = useState<Record<number, string>>({});
  const update = (id: number, change: Partial<SheetRow>) => setRows((m) => ({ ...m, [id]: { ...m[id], ...change } }));
  const sheetOf = (id: number) => data.sheets.find((x) => x.githubRepoId === id);
  const save = (id: number, sheet: SheetView | null) => onSheets({ ...data, sheets: [...data.sheets.filter((x) => x.githubRepoId !== id), ...(sheet ? [sheet] : [])] });

  const connect = async (r: RepoFacts) => {
    if (!authHeader) return;
    update(r.id, { busy: true, problem: undefined, detail: undefined, failed: false });
    try {
      const res = await connectSheet(authHeader, r.id, rows[r.id]?.url ?? '');
      if ('sheet' in res) {
        update(r.id, { busy: false, sheet: res.sheet });
        save(r.id, res.sheet);
        setAfter((m) => ({ ...m, [r.id]: r.configOnDefault ? 'setup.sheet.nextMerge' : 'setup.sheet.notSetUp' }));
      } else update(r.id, { busy: false, problem: res.problem, detail: res.detail });
    } catch {
      update(r.id, { busy: false, failed: true });
    }
  };
  const disconnect = async (id: number) => {
    if (!authHeader) return;
    update(id, { busy: true, failed: false });
    try {
      onSheets({ ...data, sheets: await disconnectSheet(authHeader, id) });
      update(id, { busy: false, url: '' });
      setAfter(({ [id]: _gone, ...rest }) => rest);
    } catch {
      update(id, { busy: false, failed: true });
    }
  };

  const status = (r: RepoFacts) => {
    const sh = sheetOf(r.id);
    const vars = { repo: r.fullName };
    if (after[r.id]) return <T k={after[r.id]!} vars={vars} as="p" className={a.note} />;
    if (!sh) return null;
    if (sh.lastSyncError) return <T k="setup.sheet.syncError" vars={{ ...vars, error: sh.lastSyncError }} as="p" className={a.error} />;
    return sh.lastSyncAt ? <T k="setup.sheet.lastSync" vars={{ ...vars, date: day(sh.lastSyncAt) }} as="p" className={a.note} /> : <T k="setup.sheet.neverSynced" vars={vars} as="p" className={a.note} />;
  };

  return (
    <>
      <SheetFields
        serviceAccount={data.serviceAccount}
        rows={repos.map((r) => {
          const row = rows[r.id] ?? {};
          const sheet = row.sheet === undefined && 'sheet' in row ? undefined : sheetOf(r.id);
          return { id: r.id, name: r.fullName, url: row.url ?? sheetOf(r.id)?.url ?? '', busy: false, ...row, sheet };
        })}
        onUrl={(id, url) => update(id, { url, problem: undefined, failed: false })}
        onConnect={(id) => {
          const r = repos.find((x) => x.id === id);
          if (r) void connect(r);
        }}
        onChange={(id) => update(id, { sheet: undefined, failed: false })}
        onDisconnect={(id) => void disconnect(id)}
      />
      {repos.map((r) => (
        <div key={r.id}>{status(r)}</div>
      ))}
      <p className={a.note}>
        <Link href={SHEET_DOCS} data-ck="setup.sheet.docs">
          {rich(text('setup.sheet.docs'))}
        </Link>
      </p>
    </>
  );
}

/** A secret's input: masked, except a username, which isn't a secret (masking it only hides a typo). */
function SecretInput({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <label>
      <span className={`${s.fieldLabel} ${s.mono}`}>{name}</span>
      <input className={`${s.input} ${s.mono}`} type={/_USERNAME$/.test(name) ? 'text' : 'password'} autoComplete={/_USERNAME$/.test(name) ? 'off' : 'new-password'} spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** New values for some secrets, sealed and written to every repo given, then checked on each repo's runner. Old values are never shown. */
function KeyForm({ names, repos, gh, onDone, onSaved, which }: { names: string[]; repos: RepoFacts[]; gh: GitHubClient | null; onDone: () => void; onSaved?: () => void; which: CheckedKey }) {
  const [values, setValues] = useState<SecretValues>({});
  const [state, setState] = useState<{ busy: boolean; saved?: number; failed?: string[]; checks?: CheckRow[] }>({ busy: false });
  const ready = names.every((n) => values[n]?.trim());
  const save = async () => {
    if (!gh) return;
    setState({ busy: true });
    const failed: string[] = [];
    const saved: RepoFacts[] = [];
    for (const r of repos) {
      try {
        await saveSecrets(gh, draftFromConfig(chosenConfig(r)), pickedOf(r), values);
        saved.push(r);
      } catch {
        failed.push(r.fullName);
      }
    }
    setValues({});
    if (saved.length) onSaved?.();
    const checks = await startChecks(gh, saved);
    setState({ busy: false, saved: saved.length, failed, checks });
    // Nothing to wait for: close once it has said so. A check still running keeps the form open.
    if (!failed.length && !checks.some((c) => typeof c.started !== 'string')) setTimeout(onDone, 1500);
  };
  return (
    <>
      {names.map((n) => (
        <SecretInput key={n} name={n} value={values[n] ?? ''} onChange={(v) => setValues((x) => ({ ...x, [n]: v }))} />
      ))}
      <T k="setup.keyHint" as="p" className={a.note} />
      <div>
        <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={!ready || state.busy || !gh} onClick={() => void save()} data-ck={state.busy ? 'setup.saving' : 'setup.saveTo'}>
          {rich(text(state.busy ? 'setup.saving' : 'setup.saveTo', { n: String(repos.length) }))}
        </button>
      </div>
      {state.saved ? <T k="setup.savedTo" vars={{ n: String(state.saved) }} as="p" className={a.note} /> : null}
      {state.failed?.length ? <T k="setup.saveFailed" vars={{ repos: state.failed.join(', ') }} as="p" className={a.error} /> : null}
      {state.checks?.length ? <KeyCheck rows={state.checks} which={which} gh={gh} /> : null}
    </>
  );
}

/** One repo's check: started, or why it wasn't (an older workflow without the `check` job, or GitHub refused to start it). */
type CheckRow = { repo: string; started: StartedCheck | 'outdated' | 'notStarted' };

/** Starts the key check on each repo that can run it. A repo whose setup PR isn't merged yet has nothing to run it with, and is left out. */
async function startChecks(gh: GitHubClient, repos: RepoFacts[]): Promise<CheckRow[]> {
  const rows: CheckRow[] = [];
  for (const r of repos) {
    if (!r.configOnDefault) continue;
    if (!canCheckKeys(r)) {
      rows.push({ repo: r.fullName, started: 'outdated' });
      continue;
    }
    rows.push({ repo: r.fullName, started: await startKeyCheck(gh, r).catch(() => 'notStarted' as const) });
  }
  return rows;
}

const CHECK_EVERY_MS = 5_000;
/** A runner usually starts within a minute; past this, the page stops waiting and says where to look. */
const CHECK_GIVE_UP_MS = 5 * 60_000;

type CheckResult = Awaited<ReturnType<typeof keyCheckResult>>;

/** Each repo's key check, as GitHub's runner reports it: the statuses the `check` job posts on the default branch. */
function KeyCheck({ rows, which, gh }: { rows: CheckRow[]; which: CheckedKey; gh: GitHubClient | null }) {
  const [results, setResults] = useState<Record<string, CheckResult | 'slow'>>({});
  useEffect(() => {
    if (!gh) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const done: Record<string, CheckResult | 'slow'> = {};
    const t0 = Date.now();
    const tick = async () => {
      let waiting = false;
      for (const r of rows) {
        if (typeof r.started === 'string' || done[r.repo]) continue;
        const res = await keyCheckResult(gh, r.started, which);
        if (res) done[r.repo] = res;
        else waiting = true;
      }
      if (!live) return;
      if (waiting && Date.now() - t0 > CHECK_GIVE_UP_MS) for (const r of rows) if (typeof r.started !== 'string' && !done[r.repo]) done[r.repo] = 'slow';
      setResults({ ...done });
      if (waiting && Date.now() - t0 <= CHECK_GIVE_UP_MS) timer = setTimeout(() => void tick(), CHECK_EVERY_MS);
    };
    timer = setTimeout(() => void tick(), CHECK_EVERY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [rows, which, gh]);
  return (
    <ul className={s.checkList} role="list">
      {rows.map((r) => {
        const res = results[r.repo];
        const k =
          r.started === 'outdated' ? 'outdated'
          : r.started === 'notStarted' ? 'notStarted'
          : !res ? 'checking'
          : res === 'slow' ? 'slow'
          : res.state === 'success' ? 'passed'
          : res.state === 'failure' ? 'failed'
          : 'unsure';
        const vars = { repo: r.repo, result: res && res !== 'slow' ? res.description : '' };
        return (
          <li key={r.repo}>
            <T k={`setup.keyCheck.${k}`} vars={vars} className={k === 'failed' || k === 'notStarted' ? a.error : a.note} />
          </li>
        );
      })}
    </ul>
  );
}

type PrsState = { busy: boolean; urls?: string[]; failed?: string[] };

/** The PRs a form opened, and the repos it couldn't open one on. */
function Opened({ state, k = 'setup.opened' }: { state: PrsState; k?: string }) {
  return (
    <>
      {state.urls ? (
        <p className={a.note}>
          <T k={k} vars={{ n: String(state.urls.length) }} />{' '}
          {state.urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" className={s.mono}>
              {u.replace('https://github.com/', '')}{' '}
            </a>
          ))}
        </p>
      ) : null}
      {state.failed?.length ? <T k="setup.saveFailed" vars={{ repos: state.failed.join(', ') }} as="p" className={a.error} /> : null}
    </>
  );
}

/** One small PR per repo: each returns its URL, or null when nothing changed there. */
async function perRepo(targets: RepoFacts[], open: (r: RepoFacts) => Promise<{ url: string } | null>): Promise<PrsState> {
  const urls: string[] = [];
  const failed: string[] = [];
  for (const r of targets) {
    try {
      const pr = await open(r);
      if (pr) urls.push(pr.url);
    } catch {
      failed.push(r.fullName);
    }
  }
  return { busy: false, urls, failed };
}

const CONTEXT_QUESTIONS = trackingAgentDashboardContent.setup.context.questions;

/**
 * What the team tells the agent (`.datalyze/context.md`), all twelve questions (onboarding asks
 * eight): the first repo's answers, or the defaults when it has no file, and a small PR per repo.
 */
function ContextForm({ current, repos, gh }: { current: string | null; repos: RepoFacts[]; gh: GitHubClient | null }) {
  const [answers, setAnswers] = useState<ContextAnswers>(() => {
    const parsed = parseContext(current);
    return Object.fromEntries(CONTEXT_QUESTIONS.map((q) => [q.id, current ? parsed[q.id as ContextId] ?? '' : q.default]));
  });
  const [state, setState] = useState<PrsState>({ busy: false });
  const open = async () => {
    if (!gh) return;
    setState({ busy: true });
    setState(await perRepo(repos.filter((x) => x.config), (r) => openContextPr(gh, r, answers, plain('setup.context.prTitle'))));
  };
  return (
    <>
      <T k="setup.context.explain" as="p" className={a.note} />
      {CONTEXT_QUESTIONS.map((q, i) => (
        <Field key={q.id} label={q.label} ck={`setup.context.questions.${i}.label`} value={answers[q.id as ContextId] ?? ''} onChange={(v) => setAnswers((x) => ({ ...x, [q.id]: v }))} hint={q.hint} hintCk={`setup.context.questions.${i}.hint`} multiline wide />
      ))}
      <div>
        <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={state.busy || !gh} onClick={() => void open()} data-ck={state.busy ? 'setup.saving' : 'setup.context.open'}>
          {rich(text(state.busy ? 'setup.saving' : 'setup.context.open'))}
        </button>
      </div>
      <Opened state={state} />
    </>
  );
}

/** The analytics settings Setup writes. */
const sameAnalytics = (x: Draft['analytics'], y: Draft['analytics']) =>
  x.tool === y.tool && (x.tool === 'none' || ((x.region ?? 'us') === (y.region ?? 'us') && (x.projectId ?? '') === (y.projectId ?? '') && (x.host ?? '') === (y.host ?? '')));

type AnalyticsState = PrsState & { handEdited?: string[]; check?: LiveCheck; keysSaved?: number; checks?: CheckRow[] };

/**
 * The analytics tool, its region, project and keys, added or changed: the same fields as onboarding's
 * Analytics screen, filled with what's set now. Old keys are never shown: with the same tool they
 * can stay blank (the saved ones are kept); a new tool needs its own. Typed keys are tried from this
 * browser first and a refusal saves nothing. Then each repo gets the keys, and a changed tool, region
 * or project goes into `.datalyze/config.yaml` and the workflow, as a commit on a setup PR that isn't
 * merged yet or a small PR of its own. That PR runs the connection check (datalyze/analytics) with the
 * saved keys, so every change is checked again before it counts. A v1 repo is moved to v2 first.
 */
function AnalyticsForm({ current, repos, gh, onSaved }: { current: Draft; repos: RepoFacts[]; gh: GitHubClient | null; onSaved?: () => void }) {
  const [next, setNext] = useState<Draft>(current.analytics.tool === 'none' ? { ...current, analytics: { tool: 'mixpanel', region: 'us' } } : current);
  const [values, setValues] = useState<SecretValues>({});
  const [state, setState] = useState<AnalyticsState>({ busy: false });
  // Repos with a config to change (merged, or on a setup PR that's still open) and v2's workflow.
  const targets = repos.filter((r) => (r.config || (r.setupPr?.state === 'open' && r.setupConfig)) && r.workflow !== 'v1');
  const names = analyticsSecrets(next);
  const typed = names.filter((n) => values[n]?.trim());
  const sameTool = next.analytics.tool === current.analytics.tool;
  const settingsChanged = !sameAnalytics(next.analytics, current.analytics);
  // A new tool needs its keys; the same tool keeps the saved ones unless all of them are typed again.
  const keysOk = next.analytics.tool === 'none' || (typed.length === names.length || (sameTool && !typed.length));
  const ready =
    (settingsChanged || typed.length > 0) &&
    keysOk &&
    (next.analytics.tool === 'none' || (!draftProblems(next, values).core.length && !analyticsFormatIssues(next, values).length));
  const open = async () => {
    if (!gh) return;
    setState({ busy: true });
    // New keys are tried from this browser first (Mixpanel and PostHog answer it; Amplitude is left to the PR's check).
    const check = typed.length ? await checkAnalyticsLive(next, values) : undefined;
    if (check?.state === 'refused') return setState({ busy: false, check });
    const handEdited: string[] = [];
    const keysOnly: RepoFacts[] = [];
    let keysSaved = 0;
    const done = await perRepo(targets, async (r) => {
      // Each repo keeps its own settings; only the analytics change.
      const own = draftFromConfig(chosenConfig(r));
      const analytics: Draft['analytics'] = next.analytics.tool === 'none' ? { tool: 'none' } : { ...next.analytics };
      const draft = { ...own, analytics };
      const save = async (repo: PickedRepo) => {
        if ((await saveSecrets(gh, draft, repo, values)).length) keysSaved++;
      };
      // New keys only: nothing in the repo changes, so there's no PR. The repo's runner checks them instead (below).
      if (sameAnalytics(own.analytics, analytics)) {
        await save(pickedOf(r));
        keysOnly.push(r);
        return null;
      }
      const pr = await addAnalytics(gh, r, draft, plain('setup.analytics.prTitle'), save);
      if (pr !== 'handEdited') return pr;
      handEdited.push(r.fullName);
      return null;
    });
    setValues({});
    if (keysSaved) onSaved?.();
    const checks = typed.length ? await startChecks(gh, keysOnly) : [];
    setState({ ...done, handEdited, check, keysSaved, checks });
  };
  if (!targets.length) return <T k="setup.analytics.noRepos" as="p" className={a.note} />;
  const tool = next.analytics.tool === 'none' ? '' : toolName(next.analytics.tool);
  return (
    <>
      <AnalyticsFields
        draft={next}
        setDraft={(fn) => {
          setState({ busy: false });
          setNext(fn);
        }}
        values={values}
        setValue={(n, v) => {
          setState({ busy: false });
          setValues((x) => ({ ...x, [n]: v }));
        }}
        secretNames={names}
      />
      {sameTool && names.length ? <T k="setup.analytics.keepKeys" as="p" className={a.note} /> : null}
      <T k="setup.analytics.explain" as="p" className={a.note} />
      <div>
        <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={state.busy || !gh || !ready} onClick={() => void open()} data-ck={state.busy ? 'setup.saving' : 'setup.analytics.open'}>
          {rich(text(state.busy ? 'setup.saving' : 'setup.analytics.open', { n: String(targets.length) }))}
        </button>
      </div>
      {state.check?.state === 'refused' ? (
        <T k={state.check.status === 401 ? 'setup.analytics.refusedKey' : 'setup.analytics.refusedAccess'} vars={{ tool, status: String(state.check.status) }} as="p" className={a.error} />
      ) : null}
      {state.keysSaved && !state.urls?.length ? <T k="setup.analytics.keysSaved" vars={{ n: String(state.keysSaved) }} as="p" className={a.note} /> : null}
      {state.checks?.length ? <KeyCheck rows={state.checks} which="analytics" gh={gh} /> : null}
      <Opened state={state} k="setup.analytics.opened" />
      {state.handEdited?.length ? <T k="setup.analytics.handEdited" vars={{ repos: state.handEdited.join(', ') }} as="p" className={a.error} /> : null}
    </>
  );
}

const STAGE_PILL: Record<RepoStage, string> = { setupPrOpen: s.pillNeedsApproval, setupPrClosed: s.pillNeedsApproval, notSetUp: '', needsAudit: s.pillNeedsApproval, planPrOpen: s.pillNeedsApproval, readyToGoLive: s.pillNeedsApproval, live: s.pillLive, unknown: '' };

type Busy = 'audit' | 'auditDone' | 'auditFailed' | 'live' | 'liveFailed' | 'reopening' | 'reopenFailed';
type MoveState = 'opening' | 'failed' | 'nothing' | { url: string; needsKey: boolean };

/** The move PR's title and body (content: setup.move), with its files listed. */
const moveText = (files: string[]) => {
  const list = files.map((f) => `\`${f}\``);
  return { title: plain('setup.move.prTitle'), body: text('setup.move.prBody', { files: list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0] ?? '' }) };
};

function Repos({ repos, gh, authHeader, draft, loading, unseen, unread, onChanged, admin }: { repos: RepoFacts[]; gh: GitHubClient | null; authHeader: AuthHeader | null; draft: Draft; loading: boolean; unseen: number; unread: number; onChanged: () => void; admin: boolean }) {
  const [busy, setBusy] = useState<Record<number, Busy>>({});
  const [move, setMove] = useState<Record<number, MoveState>>({});
  const [adding, setAdding] = useState(false);
  // "Set up again" on a repo whose setup PR was closed and its branch deleted: Add a repo, with it picked.
  const [redo, setRedo] = useState<number | null>(null);
  const mark = (id: number, b: Busy) => setBusy((m) => ({ ...m, [id]: b }));

  const reopen = async (r: RepoFacts) => {
    if (!gh) return;
    mark(r.id, 'reopening');
    await reopenSetupPr(gh, r).then(onChanged, () => mark(r.id, 'reopenFailed'));
  };
  const audit = async (r: RepoFacts) => {
    if (!gh) return;
    mark(r.id, 'audit');
    await runFirstAudit(gh, r).then(
      () => mark(r.id, 'auditDone'),
      () => mark(r.id, 'auditFailed'),
    );
  };
  const goLive = async (r: RepoFacts) => {
    if (!gh) return;
    mark(r.id, 'live');
    const result = await requireChecksFor(gh, r.fullName).catch(() => ({ ok: false as const, reason: 'refused' as const }));
    // A plan that can't require checks: the repo is live anyway (checksNeedPlan), so re-read it.
    if (result.ok || result.reason === 'plan') onChanged();
    else mark(r.id, 'liveFailed');
  };
  const moveToV2 = async (r: RepoFacts) => {
    if (!gh) return;
    setMove((m) => ({ ...m, [r.id]: 'opening' }));
    await openMovePr(gh, r, moveText).then(
      (pr) => setMove((m) => ({ ...m, [r.id]: pr ?? 'nothing' })),
      () => setMove((m) => ({ ...m, [r.id]: 'failed' })),
    );
  };

  const action = (r: RepoFacts) => {
    const stage = repoStage(r);
    const b = busy[r.id];
    const btn = (ck: string, onClick: () => void, disabled = false) => (
      <button type="button" className={`${a.button} ${a.buttonPrimary}`} onClick={onClick} disabled={disabled || !gh} data-ck={ck}>
        {rich(text(ck))}
      </button>
    );
    const link = (ck: string, href: string) => (
      <a href={href} target="_blank" rel="noreferrer" className={`${a.button} ${a.buttonPrimary}`} data-ck={ck}>
        {rich(text(ck))}
      </a>
    );
    const retry = () => (
      <button type="button" className={a.button} onClick={onChanged} data-ck="setup.repoActions.retry">
        {rich(text('setup.repoActions.retry'))}
      </button>
    );
    // Where it stands couldn't be read, or comes from Datalyze's saved record: Retry, never a step
    // worked out from a guess or from facts that may be days old.
    if (stage === 'unknown' || oldestAsOf(r)) return retry();
    if (stage === 'setupPrOpen') return link('setup.repoActions.mergeSetup', r.setupPr!.url);
    // Whether the closed PR's branch still has its config can't be told: no "Set up again" on a guess.
    if (stage === 'setupPrClosed' && isUnread(r, 'setupConfig')) return retry();
    if (stage === 'setupPrClosed' && r.setupConfig) return btn(b === 'reopening' ? 'setup.repoActions.reopening' : 'setup.repoActions.reopenSetup', () => void reopen(r), b === 'reopening');
    if (stage === 'setupPrClosed' || stage === 'notSetUp') return btn('setup.repoActions.setupAgain', () => setRedo(redo === r.id ? null : r.id));
    // A v1 repo moves to v2 before anything else: its own workflow can't run what comes next.
    if (isUnread(r, 'workflow')) return retry();
    if (r.workflow === 'v1') {
      const m = move[r.id];
      if (m && typeof m === 'object') return link('setup.repoActions.openMovePr', m.url);
      return btn(m === 'opening' ? 'setup.repoActions.updatingWorkflow' : 'setup.repoActions.updateWorkflow', () => void moveToV2(r), m === 'opening');
    }
    if (stage === 'needsAudit') {
      // Whether an audit is already going can't be told: no second one started from here.
      if (isUnread(r, 'runs')) return retry();
      const run = newestRun(r, 'audit');
      if (b === 'auditDone') return <T k="setup.repoActions.auditStarted" className={a.note} />;
      if (run && active(run)) return link('setup.repoActions.watchAudit', run.url);
      return btn(run?.state === 'failed' || run?.state === 'cancelled' ? 'setup.repoActions.rerunFirstAudit' : 'setup.repoActions.runFirstAudit', () => void audit(r), b === 'audit');
    }
    if (stage === 'planPrOpen') return link('setup.repoActions.reviewPlan', r.firstPlanPr!.url);
    if (stage === 'readyToGoLive') return btn(b === 'live' ? 'setup.repoActions.goingLive' : 'setup.repoActions.goLive', () => void goLive(r), b === 'live');
    if (stage === 'live') {
      const [owner = '', repo = ''] = r.fullName.split('/');
      return (
        <>
          <Link href={`${verifyPath({ owner, repo })}/setup`} className={a.button} data-ck="setup.verifyLink">
            {rich(text('setup.verifyLink'))}
          </Link>
          <Link href={auditPath({ owner, repo })} className={a.button} data-ck="setup.repoActions.audit">
            {rich(text('setup.repoActions.audit'))}
          </Link>
        </>
      );
    }
    return null;
  };

  /** What the row says under the repo's name: a failure, the plan's limit, the move to v2. */
  const notes = (r: RepoFacts) => {
    const stage = repoStage(r);
    const b = busy[r.id];
    const run = newestRun(r, 'audit');
    const m = move[r.id];
    return (
      <>
        {r.noApp ? <T k="setup.repoActions.installApp" as="div" className={a.note} /> : null}
        {oldestAsOf(r) ? (
          <div className={a.note}>
            <T k="setup.repoActions.asOf" /> <When iso={oldestAsOf(r)!} />
          </div>
        ) : null}
        {b === 'liveFailed' ? <T k="setup.repoActions.goLiveFailed" as="div" className={a.error} /> : null}
        {stage === 'live' && r.checksNeedPlan ? <T k="setup.repoActions.goLivePlan" as="div" className={a.warning} /> : null}
        {b === 'auditFailed' ? <T k="actions.dispatchFailed" as="div" className={a.error} /> : null}
        {stage === 'needsAudit' && r.workflow !== 'v1' && b !== 'auditDone' && (run?.state === 'failed' || run?.state === 'cancelled' || (run?.state === 'done' && !startedBySetup(run))) ? (
          <div className={run.state === 'cancelled' ? a.note : a.error}>
            <T k={run.state === 'failed' ? 'setup.repoActions.firstAuditFailed' : run.state === 'cancelled' ? 'setup.repoActions.firstAuditCancelled' : 'setup.repoActions.firstAuditNoResult'} />{' '}
            <a href={run.url} target="_blank" rel="noreferrer" data-ck="setup.repoActions.seeRun">
              {rich(text('setup.repoActions.seeRun'))}
            </a>
          </div>
        ) : null}
        {b === 'reopenFailed' ? <T k="setup.repoActions.reopenFailed" as="div" className={a.error} /> : null}
        {r.configOnDefault && r.workflow === 'outdated' ? (
          <div className={a.note}>
            <T k={m && typeof m === 'object' ? 'setup.repoActions.refreshPr' : 'setup.repoActions.refreshOutdated'} />{' '}
            {m && typeof m === 'object' ? (
              <a href={m.url} target="_blank" rel="noreferrer" data-ck="setup.repoActions.openMovePr">
                {rich(text('setup.repoActions.openMovePr'))}
              </a>
            ) : (
              <button type="button" className={a.button} onClick={() => void moveToV2(r)} disabled={m === 'opening' || !gh} data-ck={m === 'opening' ? 'setup.repoActions.updatingWorkflow' : 'setup.repoActions.updateWorkflow'}>
                {rich(text(m === 'opening' ? 'setup.repoActions.updatingWorkflow' : 'setup.repoActions.updateWorkflow'))}
              </button>
            )}
            {m === 'failed' ? <T k="setup.repoActions.workflowPrFailed" as="div" className={a.error} /> : null}
            {m === 'nothing' ? <T k="setup.repoActions.moveNothing" as="div" /> : null}
          </div>
        ) : null}
        {r.configOnDefault && r.workflow === 'v1' ? (
          <div className={a.note}>
            <T k={m && typeof m === 'object' ? 'setup.repoActions.movePr' : 'setup.repoActions.moveOutdated'} />
            {m && typeof m === 'object' && m.needsKey ? <T k="setup.repoActions.moveNeedsKey" as="div" className={a.warning} /> : null}
            {m === 'failed' ? <T k="setup.repoActions.workflowPrFailed" as="div" className={a.error} /> : null}
            {m === 'nothing' ? <T k="setup.repoActions.moveNothing" as="div" /> : null}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <T k="setup.reposTitle" as="h2" className={s.sectionTitle} />
        <button
          type="button"
          className={a.button}
          onClick={() => {
            setAdding((v) => !v);
            setRedo(null);
          }}
          data-ck={adding ? 'setup.cancel' : 'setup.add.button'}
        >
          {rich(text(adding ? 'setup.cancel' : 'setup.add.button'))}
        </button>
      </div>
      {(adding || redo !== null) && !admin ? (
        <T k="setup.add.adminOnly" as="p" className={a.notice} />
      ) : (adding || redo !== null) && gh && authHeader ? (
        <AddRepo
          key={redo ?? 'add'}
          gh={gh}
          authHeader={authHeader}
          linked={repos.map((r) => r.id).filter((id) => id !== redo)}
          pick={redo ?? undefined}
          draft={draft}
          loading={loading}
          onDone={() => {
            setAdding(false);
            setRedo(null);
            onChanged();
          }}
        />
      ) : null}
      {unseen && !loading ? <T k={unseen === 1 ? 'dashboard.unseenOne' : 'dashboard.unseen'} vars={{ n: String(unseen) }} as="p" className={a.notice} /> : null}
      {unread && !loading ? <UnreadNotice n={unread} onRetry={onChanged} /> : null}
      <ul className={s.rows} role="list">
        {repos.map((r) => {
          const stage = repoStage(r);
          return (
            <li key={r.id} className={s.row}>
              <div className={s.rowMain}>
                <a href={r.htmlUrl} target="_blank" rel="noreferrer" className={`${s.rowTitle} ${s.mono}`}>
                  {r.fullName}
                </a>
                {notes(r)}
              </div>
              <div className={s.rowSide}>
                <span className={`${s.pill} ${STAGE_PILL[stage]}`} data-ck={`setup.stages.${stage}`}>
                  {rich(text(`setup.stages.${stage}`))}
                </span>
                {action(r)}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** `pr` null when done: the repo was already set up, so only the secrets were saved. */
type AddState = { phase: 'pick' | 'keys' | 'app' | 'working' | 'failed' | 'done'; pr?: string | null; linkProblem?: LinkProblem };

/** Why the server refused to link the repo (datalyze-api.ts `linkProblem`), as its copy key. */
const LINK_KEY: Record<LinkProblem, string> = {
  noGithub: 'setup.add.linkNoGithub',
  notMaintainer: 'setup.add.linkNotMaintainer',
  notFound: 'setup.add.linkNotFound',
  unchecked: 'setup.add.linkUnchecked',
};

/**
 * "+ Add a repo", inline: pick one of the person's repos, type its keys (the same Anthropic key and
 * analytics as the others; keys are never stored, so they're typed again), install the Datalyze App
 * on it, then save the secrets with a new licence key (older repos keep theirs), open its setup PR
 * and link it.
 */
/** A load that failed: one short line and Try again. */
function LoadFailed({ k, onRetry }: { k: string; onRetry: () => void }) {
  return (
    <p className={a.error}>
      <T k={k} />{' '}
      <button type="button" className={a.linkButton} onClick={onRetry} data-ck="setup.add.retry">
        {rich(text('setup.add.retry'))}
      </button>
    </p>
  );
}

function AddRepo({ gh, authHeader, linked, pick, draft: workspaceDraft, loading, onDone }: { gh: GitHubClient; authHeader: AuthHeader; linked: number[]; pick?: number; draft: Draft; loading: boolean; onDone: () => void }) {
  const [all, setAll] = useState<GhRepo[] | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<GhRepo | null>(null);
  const [values, setValues] = useState<SecretValues>({});
  const [state, setState] = useState<AddState>({ phase: 'pick' });
  // A repo set up before keeps its own choices (analytics, reviewers) from the config on its
  // default branch, so setting it up again asks for its keys and opens no PR undoing them.
  // A failed read is never taken for "no config": that would set the repo up over its own choices.
  const [own, setOwn] = useState<{ id: number; config: string | null; failed?: boolean } | null>(null);
  const [ownAttempt, setOwnAttempt] = useState(0);
  useEffect(() => {
    if (!picked) return;
    let live = true;
    gh.file({ owner: picked.owner.login, repo: picked.name }, '.datalyze/config.yaml', picked.default_branch).then(
      (f) => live && setOwn({ id: picked.id, config: f?.text ?? null }),
      () => live && setOwn({ id: picked.id, config: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [gh, picked, ownAttempt]);
  const ownFailed = Boolean(picked && own?.id === picked.id && own.failed);
  const ownRead = Boolean(picked && own?.id === picked.id && !own.failed);
  const draft = ownRead && own!.config ? draftFromConfig(own!.config) : workspaceDraft;
  const names = [modelSecret(draft), ...analyticsSecrets(draft)].filter((n): n is string => Boolean(n));

  // A failed list is never taken for "every repo is linked".
  const [reposFailed, setReposFailed] = useState(false);
  const [reposAttempt, setReposAttempt] = useState(0);
  useEffect(() => {
    setReposFailed(false);
    gh.repos()
      .then((list) => {
        const open = adminRepos(list).filter((r) => !linked.includes(r.id));
        setAll(open);
        if (pick) setPicked((cur) => cur ?? open.find((r) => r.id === pick) ?? null);
      })
      .catch(() => setReposFailed(true));
  }, [gh, linked, pick, reposAttempt]);

  const repo = (r: GhRepo): PickedRepo => ({ id: r.id, owner: r.owner.login, name: r.name, defaultBranch: r.default_branch, private: r.private });

  const install = async () => {
    if (!picked) return;
    setState({ phase: 'working' });
    try {
      const { missing } = await appInstalledOn(authHeader, [picked.full_name]);
      if (missing.length) return setState({ phase: 'app' });
      // Linked before the PR, so its first run gets the Datalyze App's token (see onboarding), and
      // before the keys, so a repo the server refuses (it checks admin or maintain with GitHub) gets none.
      await linkRepoIds(authHeader, [picked.id]);
      // A new key for this repo; the workspace's older keys stay live.
      const { key } = await createKey(authHeader);
      await saveSecrets(gh, draft, repo(picked), { ...values, DATALYZE_KEY: key });
      setValues({});
      const { pull } = await openSetupPr(gh, draft, repo(picked));
      setState({ phase: 'done', pr: pull?.html_url ?? null });
    } catch (error) {
      setState({ phase: 'failed', linkProblem: linkProblem(error, picked.id) ?? undefined });
    }
  };

  const q = query.trim().toLowerCase();
  const shown = (all ?? []).filter((r) => !q || r.full_name.toLowerCase().includes(q)).slice(0, 100);

  return (
    <div className={a.card} style={{ marginBottom: 16 }}>
      <T k="setup.add.title" as="h3" className={a.cardTitle} />
      {state.phase === 'done' ? (
        <>
          <T k={state.pr ? 'setup.add.done' : 'setup.add.doneAlreadySetUp'} vars={{ repo: picked?.full_name ?? '' }} as="p" className={a.cardBody} />
          <div className={a.cardActions}>
            {state.pr ? (
              <a href={state.pr} target="_blank" rel="noreferrer" className={`${a.button} ${a.buttonPrimary}`} data-ck="setup.add.openPr">
                {rich(text('setup.add.openPr'))}
              </a>
            ) : null}
            <button type="button" className={a.button} onClick={onDone} data-ck="setup.cancel">
              {rich(text('setup.cancel'))}
            </button>
          </div>
        </>
      ) : !picked ? (
        <>
          <label>
            <T k="setup.add.search" className={s.fieldLabel} />
            <input className={s.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={plain('setup.add.pick')} />
          </label>
          {reposFailed && !all ? (
            <LoadFailed k="setup.add.reposFailed" onRetry={() => setReposAttempt((n) => n + 1)} />
          ) : !all ? (
            <div className={a.skeleton} style={{ height: 120, marginTop: 10 }} />
          ) : !all.length ? (
            <T k="setup.add.none" as="p" className={a.note} />
          ) : (
            <ul className={s.pickList} style={{ marginTop: 10 }} role="list">
              {shown.map((r) => (
                <li key={r.id}>
                  <button type="button" className={`${s.pick} ${s.mono}`} onClick={() => setPicked(r)}>
                    {r.full_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className={s.inline} style={{ paddingTop: 0 }}>
          <p className={`${s.rowTitle} ${s.mono}`}>{picked.full_name}</p>
          {loading ? (
            // The workspace's analytics come from the other repos' config: until every one is read,
            // the keys it needs aren't known, and a repo added now would be set up without analytics.
            <T k="setup.add.reading" as="p" className={a.note} />
          ) : names.length ? (
            <T k="setup.add.keysIntro" as="p" className={a.note} />
          ) : null}
          {loading ? null : names.map((n) => (
            <SecretInput key={n} name={n} value={values[n] ?? ''} onChange={(v) => setValues((x) => ({ ...x, [n]: v }))} />
          ))}
          {ownFailed ? <LoadFailed k="setup.add.configFailed" onRetry={() => setOwnAttempt((n) => n + 1)} /> : null}
          {state.phase === 'app' ? (
            <>
              <T k="setup.add.app" as="p" className={a.notice} />
              <div className={a.cardActions}>
                <a href={appInstallUrl(picked.owner.id, [picked.id])} target="_blank" rel="noreferrer" className={a.button} data-ck="setup.add.appInstall">
                  {rich(text('setup.add.appInstall'))}
                </a>
                <button type="button" className={`${a.button} ${a.buttonPrimary}`} onClick={() => void install()} data-ck="setup.add.appRecheck">
                  {rich(text('setup.add.appRecheck'))}
                </button>
              </div>
            </>
          ) : (
            <div>
              <button
                type="button"
                className={`${a.button} ${a.buttonPrimary}`}
                disabled={loading || state.phase === 'working' || !ownRead || !names.every((n) => values[n]?.trim())}
                onClick={() => void install()}
                data-ck={state.phase === 'working' ? 'setup.add.working' : state.phase === 'failed' ? 'setup.add.retry' : 'setup.add.installOn'}
              >
                {rich(text(state.phase === 'working' ? 'setup.add.working' : state.phase === 'failed' ? 'setup.add.retry' : 'setup.add.installOn', { repo: picked.full_name }))}
              </button>
            </div>
          )}
          {state.phase === 'failed' ? <T k={state.linkProblem ? LINK_KEY[state.linkProblem] : 'setup.add.failed'} as="p" className={a.error} /> : null}
        </div>
      )}
    </div>
  );
}
