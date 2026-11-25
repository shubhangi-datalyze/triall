'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import account from '@/components/account/account.module.css';
import { useAccount } from '@/components/account/account-shell';
import { CheckoutModal, isStripeConfigured } from '@/components/account/checkout-modal';
import { forgetAccount } from '@/lib/account/load';
import { rich } from '@/lib/content/rich';
import { trackingAgentOnboardingContent } from '@/lib/content/trackingAgentOnboarding';
import type { TrackingAccount } from '@/lib/tracking-agent/app-account';
import type { GhRepo } from '@/lib/tracking-agent/github/client';
import { SETUP_SCOPES, hasScopes, signInErrorKey, startSignIn, useGitHubSession } from '@/lib/tracking-agent/github/session';
import {
  analyticsReady,
  analyticsSecretNames,
  appInstallUrl,
  connectionStates,
  connectionsFromResults,
  connectionsPending,
  connectionsToFix,
  gate,
  modelReady,
  notOwner,
  onboardingDraft,
  setupRunState,
  stepPath,
  uncheckedConnections,
  DONE,
  type OnboardingProgress,
  type Reached,
  type RunState,
  type StepId,
  workspacePaid,
} from '@/lib/tracking-agent/onboarding/flow';
import { appInstalledOn, connectSheet, createKey, disconnectSheet, getSheets, linkProblem, linkRepoIds, putOnboarding, type SheetView } from '@/lib/tracking-agent/setup/datalyze-api';
import { checkAnalyticsLive } from '@/lib/tracking-agent/setup/check-analytics';
import { upgradeDraft, type Draft, type PickedRepo, type SecretValues } from '@/lib/tracking-agent/setup/draft';
import { errorCode, openSetupPr, ref, rulesetsAllowed, saveSecrets } from '@/lib/tracking-agent/setup/install';
import { MODEL_KEY, SETUP_BRANCH, WORKFLOW_FILE } from '@/tracking-agent/src/setup/core';
import { auditPath } from '@/lib/tracking-agent/audit';
import { runFirstAudit } from '@/lib/tracking-agent/repos';
import { loadRuns } from '@/lib/tracking-agent/runs';
import { freshKeyResult, keyCheckResult, secretSavedAt, startKeyCheck, type StartedCheck } from '@/lib/tracking-agent/setup-page';
import { AnalyticsScreen, ContextScreen, FirstAuditScreen, GitHubScreen, InstallScreen, ModelScreen, PayScreen, ReposScreen, SetupPrScreen, SheetScreen, adminRepos, type AnalyticsCheck, type FirstAuditRow, type InstallError, type LineState, type PayMessage, type SetupPrRow, type SheetRow } from './screens';

/**
 * Onboarding's state and its screens. The provider sits in
 * /tracking-agent/start's layout, inside the account shell, so moving between
 * screens keeps what the person typed:
 *
 *   progress  the step reached and the chosen repo ids, on the server
 *   draft     the choices (analytics tool, region, project, context), in this browser's storage,
 *             so a step opened in a new tab keeps them; never a secret
 *   values    the keys typed, in memory only, dropped once saved to GitHub: a new tab asks again
 *
 * The routing gate (flow.ts `gate`) runs here: a paid account goes to the
 * dashboard, and nobody skips ahead of their first unfinished step.
 */

const C = trackingAgentOnboardingContent;
const DRAFT_KEY = 'datalyze.onboarding.draft';
const APP_POLL_MS = 5_000;
const RUN_POLL_MS = 8_000;

type Stored = { draft: Draft; confirmed: boolean };

/**
 * The draft is kept in localStorage, so a step opened in another tab (GitHub's return from
 * installing the App, a link) keeps the analytics tool and region; it holds no secret. A draft an
 * older onboarding kept in this tab's sessionStorage is read too.
 */
function loadStored(): Stored | null {
  for (const store of ['localStorage', 'sessionStorage'] as const) {
    try {
      const raw = window[store].getItem(DRAFT_KEY);
      const parsed = raw ? (JSON.parse(raw) as Stored) : null;
      if (parsed?.draft) return { draft: upgradeDraft(parsed.draft), confirmed: Boolean(parsed.confirmed) };
    } catch {}
  }
  return null;
}

function saveStored(stored: Stored) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
  } catch {}
}

const toPicked = (r: GhRepo): PickedRepo => ({ id: r.id, owner: r.owner.login, name: r.name, defaultBranch: r.default_branch, private: r.private });

type OnboardingState = {
  progress: OnboardingProgress;
  /** Saves the step reached (and the repos, when given), then goes there. */
  advance: (to: StepId, repoIds?: number[]) => Promise<void>;
  go: (to: StepId) => void;
  /** Saves the step reached and stays on this screen. */
  save: (to: Reached) => Promise<void>;
  /** Onboarding is over (the first audit started): saves DONE, then opens `path`. */
  finish: (path: string) => Promise<void>;
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  /** The model and analytics were chosen in this browser, so the draft can be written to GitHub. */
  confirmed: boolean;
  /** The draft came back from storage (another tab or visit) with its choices made: the keys must be typed again. */
  restored: boolean;
  confirm: () => void;
  values: SecretValues;
  setValue: (name: string, value: string) => void;
  /** Every chosen repo has its secrets saved in this visit. */
  installed: boolean;
  markInstalled: () => void;
  github: ReturnType<typeof useGitHubSession>;
  repos: GhRepo[] | null;
  reposFailed: boolean;
  loadRepos: () => Promise<void>;
  picked: GhRepo[];
};

const Ctx = createContext<OnboardingState | null>(null);

const useOnboarding = () => {
  const state = useContext(Ctx);
  if (!state) throw new Error('useOnboarding outside OnboardingProvider');
  return state;
};

/**
 * Onboarding's progress, from the account the shell loaded
 * (lib/tracking-agent/app-account.ts), so the gate asks the server nothing of
 * its own. Kept here once loaded: onboarding moves it on as the person goes.
 */
function useProgress() {
  const { account: acct } = useAccount<TrackingAccount>();
  const [progress, setProgress] = useState<OnboardingProgress | null>(() => acct.onboarding);
  return { progress, setProgress, loadFailed: !acct.onboarding };
}

function Loading() {
  return (
    <p className={account.note} data-ck="page.loading" data-ck-page="tracking-agent-onboarding">
      {rich(C.page.loading)}
    </p>
  );
}

/**
 * The dashboard's half of the routing gate: an account that hasn't finished
 * onboarding goes back to it (Billing aside), paid or not: free access still
 * sets a repo up first. If progress can't be loaded, a paid account passes.
 */
export function DashboardGate({ children }: { children: ReactNode }) {
  const { account: acct } = useAccount();
  const paid = workspacePaid(acct);
  const member = notOwner(acct);
  const pathname = usePathname();
  const router = useRouter();
  const { progress, loadFailed } = useProgress();
  const target = progress ? gate({ path: pathname, paid, progress, member }) : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  if (loadFailed) return <>{children}</>;
  if (!progress || target) return <Loading />;
  return <>{children}</>;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { account: acct, authHeader } = useAccount();
  const paid = workspacePaid(acct);
  const member = notOwner(acct);
  const pathname = usePathname();
  const router = useRouter();

  // ---- progress, from the server ----
  const { progress, setProgress, loadFailed } = useProgress();
  // A paid account waits for its progress too: with free access, onboarding isn't finished until Pay.
  const target = progress || member ? gate({ path: pathname, paid, progress, member }) : paid && loadFailed ? gate({ path: pathname, paid, progress: null }) : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  const advance = useCallback(
    async (to: StepId, repoIds?: number[]) => {
      if (!progress) return;
      const next = { ...progress, step: to, repoIds: repoIds ?? progress.repoIds };
      setProgress(next);
      // Progress is a convenience across devices: a failed save doesn't stop the person here.
      await putOnboarding(authHeader, { step: next.step, repoIds: next.repoIds }).catch(() => undefined);
      // The dashboard's gate reads the account again, with this step in it.
      forgetAccount();
      router.push(stepPath(to));
    },
    [progress, setProgress, authHeader, router],
  );
  const go = useCallback((to: StepId) => router.push(stepPath(to)), [router]);
  const save = useCallback(
    async (to: Reached) => {
      if (!progress || progress.step === to) return;
      setProgress({ ...progress, step: to });
      await putOnboarding(authHeader, { step: to, repoIds: progress.repoIds }).catch(() => undefined);
      forgetAccount();
    },
    [progress, setProgress, authHeader],
  );
  const finish = useCallback(
    async (path: string) => {
      if (progress) await putOnboarding(authHeader, { step: DONE, repoIds: progress.repoIds }).catch(() => undefined);
      // The app's gate reads the account again, with DONE in it.
      forgetAccount();
      router.push(path);
    },
    [progress, authHeader, router],
  );

  // ---- the draft, in this tab ----
  const [stored, setStored] = useState<Stored>({ draft: onboardingDraft(), confirmed: false });
  const restored = useRef(false);
  const [fromStorage, setFromStorage] = useState(false);
  useEffect(() => {
    const s = loadStored();
    if (s) {
      setStored(s);
      setFromStorage(s.confirmed);
    }
    restored.current = true;
  }, []);
  useEffect(() => {
    if (restored.current) saveStored(stored);
  }, [stored]);
  const setDraft = useCallback((fn: (d: Draft) => Draft) => setStored((s) => ({ ...s, draft: fn(s.draft) })), []);
  const confirm = useCallback(() => setStored((s) => ({ ...s, confirmed: true })), []);

  // ---- secret values, in memory ----
  const [values, setValues] = useState<SecretValues>({});
  const setValue = useCallback((name: string, value: string) => setValues((v) => ({ ...v, [name]: value })), []);
  const [installed, setInstalled] = useState(false);
  const markInstalled = useCallback(() => {
    setInstalled(true);
    setValues({});
  }, []);

  // ---- GitHub and the repos ----
  const github = useGitHubSession();
  const gh = github.client;
  const [repos, setRepos] = useState<GhRepo[] | null>(null);
  const [reposFailed, setReposFailed] = useState(false);
  const loadRepos = useCallback(async () => {
    if (!gh) return;
    setRepos(null);
    setReposFailed(false);
    try {
      setRepos(await gh.repos());
    } catch {
      setReposFailed(true);
    }
  }, [gh]);
  useEffect(() => {
    if (gh && hasScopes(github.session, SETUP_SCOPES) && !repos && !reposFailed) void loadRepos();
  }, [gh, github.session, repos, reposFailed, loadRepos]);

  const picked = useMemo(() => (repos && progress ? adminRepos(repos).filter((r) => progress.repoIds.includes(r.id)) : []), [repos, progress]);
  const draft = useMemo(() => ({ ...stored.draft, repos: picked.map(toPicked) }), [stored.draft, picked]);

  if (loadFailed) {
    return (
      <p className={account.error} role="alert" data-ck="page.loadFailed">
        {rich(C.page.loadFailed)}
      </p>
    );
  }
  if (!progress || target) return <Loading />;
  const value: OnboardingState = {
    progress,
    advance,
    go,
    save,
    finish,
    draft,
    setDraft,
    confirmed: stored.confirmed,
    restored: fromStorage,
    confirm,
    values,
    setValue,
    installed,
    markInstalled,
    github,
    repos,
    reposFailed,
    loadRepos,
    picked,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** GitHub sends people back to Install after installing the App, with these params. They're never trusted. */
const RETURN_PARAMS = ['installation_id', 'setup_action', 'code', 'state'];
const cameBackFromGitHub = () => typeof window !== 'undefined' && RETURN_PARAMS.some((p) => new URLSearchParams(window.location.search).has(p));

/** /tracking-agent/start/<step>. */
export function OnboardingStep({ step }: { step: StepId }) {
  const o = useOnboarding();
  const router = useRouter();
  // Screens after GitHub need the GitHub sign-in, which lives in this browser only.
  const needsGitHub = step === 'repos' || step === 'sheet' || step === 'install' || step === 'setup-pr' || step === 'first-audit';
  const signedOut = needsGitHub && o.github.ready && !hasScopes(o.github.session, SETUP_SCOPES);
  // GitHub's return from installing the App lands in a fresh tab with no GitHub
  // sign-in: say where setup carries on, rather than asking to sign in again.
  const [returned] = useState(() => step === 'install' && cameBackFromGitHub());
  useEffect(() => {
    if (signedOut && returned) router.replace(stepPath('install'));
    else if (signedOut) router.replace(stepPath('github'));
  }, [signedOut, returned, router]);
  if (signedOut && returned) return <InstallScreen started={false} onStart={() => undefined} app={{ state: 'done', missing: [] }} installUrl="#" onRecheck={() => undefined} repos={[]} onRetry={() => undefined} valuesGone returned onBackToModel={() => o.go('model')} done={false} onBack={() => o.go('context')} onContinue={() => undefined} />;
  if (signedOut) return null;
  // The sign-in couldn't be checked: said so, never taken as signed out (it's asked again on its own).
  if (needsGitHub && o.github.unknown) {
    return (
      <section className={account.card}>
        <h2 className={account.cardTitle} data-ck="github.unknown.title">
          {rich(C.github.unknown.title)}
        </h2>
        <p className={account.cardBody} data-ck="github.unknown.body">
          {rich(C.github.unknown.body)}
        </p>
        <div className={account.cardActions}>
          <button type="button" className={account.button} onClick={o.github.retry} data-ck="github.unknown.retry">
            {rich(C.github.unknown.retry)}
          </button>
        </div>
      </section>
    );
  }
  switch (step) {
    case 'github':
      return <GitHubStep />;
    case 'repos':
      return <ReposStep />;
    case 'model':
      return <ModelScreen draft={o.draft} setDraft={o.setDraft} values={o.values} setValue={o.setValue} ready={modelReady(o.draft, o.values)} keysAgain={o.restored} onBack={() => o.go('repos')} onContinue={() => void o.advance('analytics')} />;
    case 'analytics':
      return <AnalyticsStep />;
    case 'sheet':
      return <SheetStep />;
    case 'context':
      return <ContextScreen draft={o.draft} setDraft={o.setDraft} onBack={() => o.go('sheet')} onContinue={() => void o.advance('install')} />;
    case 'install':
      return <InstallStep />;
    case 'setup-pr':
      return <SetupPrStep />;
    case 'pay':
      return <PayStep />;
    case 'first-audit':
      return <FirstAuditStep />;
  }
}

// ---- 1. GitHub ----------------------------------------------------------------------------------

function GitHubStep() {
  const o = useOnboarding();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<'notConfigured' | 'startFailed' | null>(null);
  const connect = async () => {
    setWorking(true);
    setError(null);
    try {
      await startSignIn(SETUP_SCOPES, stepPath('github'));
    } catch (e) {
      setWorking(false);
      setError(signInErrorKey(e) === 'signIn.notConfigured' ? 'notConfigured' : 'startFailed');
    }
  };
  const session = o.github.session;
  return (
    <GitHubScreen
      session={session ? { login: session.login, avatarUrl: session.avatarUrl } : null}
      needsScopes={Boolean(session) && !hasScopes(session, SETUP_SCOPES)}
      working={working}
      error={error}
      onConnect={() => void connect()}
      onSwitch={o.github.signOut}
      onContinue={() => void o.advance('repos')}
    />
  );
}

// ---- 2. Repos -----------------------------------------------------------------------------------

function ReposStep() {
  const o = useOnboarding();
  const [picked, setPicked] = useState<number[]>(o.progress.repoIds);
  const [query, setQuery] = useState('');
  // Ids remembered from another visit that this sign-in can't see don't count.
  const visible = useMemo(() => (o.repos ? picked.filter((id) => adminRepos(o.repos!).some((r) => r.id === id)) : []), [o.repos, picked]);

  // Each picked private repo is asked once whether its owner's GitHub plan lets it require checks.
  const [allowed, setAllowed] = useState<Record<number, boolean | null>>({});
  const gh = o.github.client;
  useEffect(() => {
    if (!gh || !o.repos) return;
    for (const r of o.repos) {
      if (!r.private || !visible.includes(r.id) || r.id in allowed) continue;
      setAllowed((m) => ({ ...m, [r.id]: null }));
      void rulesetsAllowed(gh, { owner: r.owner.login, name: r.name }).then((ok) => setAllowed((m) => ({ ...m, [r.id]: ok })));
    }
  }, [gh, o.repos, visible, allowed]);
  const planLimited = Object.entries(allowed).filter(([, ok]) => ok === false).map(([id]) => Number(id));

  return (
    <ReposScreen
      repos={o.repos}
      failed={o.reposFailed}
      onRetry={() => void o.loadRepos()}
      picked={visible}
      onToggle={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
      query={query}
      onQuery={setQuery}
      onBack={() => o.go('github')}
      onContinue={() => void o.advance('model', visible)}
      planLimited={planLimited}
    />
  );
}

// ---- 4. Analytics -------------------------------------------------------------------------------

/**
 * The keys are tried on Continue, from this browser straight to the tool (Mixpanel and PostHog
 * answer browsers; never through Datalyze). A refusal stays on this screen; a check that couldn't
 * tell moves on, and the setup PR's own check tries again.
 */
function AnalyticsStep() {
  const o = useOnboarding();
  const [check, setCheck] = useState<AnalyticsCheck>({ state: 'idle' });
  const done = () => {
    o.confirm();
    void o.advance('sheet');
  };
  const tryKeys = async () => {
    if (o.draft.analytics.tool === 'none') return done();
    setCheck({ state: 'checking' });
    const result = await checkAnalyticsLive(o.draft, o.values);
    setCheck(result);
    if (result.state !== 'refused') done();
  };
  return (
    <AnalyticsScreen
      draft={o.draft}
      setDraft={(fn) => {
        setCheck({ state: 'idle' });
        o.setDraft(fn);
      }}
      values={o.values}
      setValue={(name, value) => {
        setCheck({ state: 'idle' });
        o.setValue(name, value);
      }}
      secretNames={analyticsSecretNames(o.draft)}
      ready={analyticsReady(o.draft, o.values)}
      check={check}
      keysAgain={o.restored}
      onBack={() => o.go('model')}
      onSkip={() => {
        o.setDraft((d) => ({ ...d, analytics: { tool: 'none' } }));
        done();
      }}
      onContinue={() => void tryKeys()}
    />
  );
}

// ---- 5. Google Sheet ----------------------------------------------------------------------------

/** One Sheet per picked repo, checked and saved by Datalyze (tracking-agent/SPEC.md, the Google Sheet). Optional. */
function SheetStep() {
  const o = useOnboarding();
  const { authHeader } = useAccount();
  const [serviceAccount, setServiceAccount] = useState<string | null | undefined>(undefined);
  const [rows, setRows] = useState<Record<number, Partial<SheetRow>>>({});
  const update = (id: number, change: Partial<SheetRow>) => setRows((m) => ({ ...m, [id]: { ...m[id], ...change } }));

  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    getSheets(authHeader).then(
      (d) => {
        if (!live) return;
        setLoadFailed(false);
        setServiceAccount(d.serviceAccount);
        setRows(Object.fromEntries(d.sheets.map((sh: SheetView) => [sh.githubRepoId, { url: sh.url, busy: false, sheet: sh }])));
      },
      // Not "Sheets isn't set up": a failed load says so, with a retry.
      () => {
        if (!live) return;
        setLoadFailed(true);
        setServiceAccount(null);
      },
    );
    return () => {
      live = false;
    };
  }, [authHeader, attempt]);

  const connect = async (id: number) => {
    update(id, { busy: true, problem: undefined, detail: undefined, failed: false });
    try {
      const r = await connectSheet(authHeader, id, rows[id]?.url ?? '');
      update(id, 'sheet' in r ? { busy: false, sheet: r.sheet } : { busy: false, problem: r.problem, detail: r.detail });
    } catch {
      update(id, { busy: false, failed: true });
    }
  };
  const disconnect = async (id: number) => {
    update(id, { busy: true, failed: false });
    try {
      await disconnectSheet(authHeader, id);
      update(id, { busy: false, sheet: undefined });
    } catch {
      update(id, { busy: false, failed: true });
    }
  };

  if (serviceAccount === undefined) return <Loading />;
  return (
    <SheetScreen
      serviceAccount={serviceAccount}
      rows={o.picked.map((r) => ({ id: r.id, name: r.full_name, url: '', busy: false, ...rows[r.id] }))}
      onUrl={(id, url) => update(id, { url, problem: undefined, failed: false })}
      onConnect={(id) => void connect(id)}
      onChange={(id) => update(id, { sheet: undefined, failed: false })}
      onDisconnect={(id) => void disconnect(id)}
      loadFailed={loadFailed}
      onRetry={() => {
        setServiceAccount(undefined);
        setAttempt((n) => n + 1);
      }}
      onBack={() => o.go('analytics')}
      onContinue={() => void o.advance('context')}
    />
  );
}

// ---- 5. Install ---------------------------------------------------------------------------------

const installError = (e: unknown): InstallError => {
  const code = errorCode(e).code;
  return code === 'forbidden' || code === 'not_found' ? 'errorForbidden' : code === 'network' ? 'errorNetwork' : 'errorOther';
};


function InstallStep() {
  const o = useOnboarding();
  const { authHeader } = useAccount();
  const router = useRouter();
  const gh = o.github.client;
  const [started, setStarted] = useState(o.installed);
  const [app, setApp] = useState<{ state: LineState; missing: string[] }>({ state: o.installed ? 'done' : 'waiting', missing: [] });
  const [rows, setRows] = useState<Record<number, { state: LineState; error?: InstallError }>>({});
  const keyRef = useRef<string | null>(null);
  const running = useRef(false);
  const valuesGone = !o.installed && (!o.confirmed || !modelReady(o.draft, o.values) || !analyticsReady(o.draft, o.values));
  // Keys typed again after Install (back on the key or analytics screen): saved again, or the repos keep the old ones.
  const resave = o.installed && Object.values(o.values).some((v) => v?.trim());
  const done = o.installed && !resave;

  const saveAll = useCallback(async () => {
    if (!gh || running.current) return;
    running.current = true;
    try {
      // The licence key is made here and goes straight to the repos' secrets: never shown (O8).
      // Saving new keys after Install keeps the licence key already saved: no second one.
      if (!keyRef.current && !o.installed) keyRef.current = (await createKey(authHeader)).key;
      const values = keyRef.current ? { ...o.values, DATALYZE_KEY: keyRef.current } : { ...o.values };
      let allDone = true;
      for (const repo of o.draft.repos) {
        if (rows[repo.id]?.state === 'done') continue;
        setRows((r) => ({ ...r, [repo.id]: { state: 'working' } }));
        try {
          await saveSecrets(gh, o.draft, repo, values);
          setRows((r) => ({ ...r, [repo.id]: { state: 'done' } }));
        } catch (e) {
          allDone = false;
          setRows((r) => ({ ...r, [repo.id]: { state: 'failed', error: installError(e) } }));
        }
      }
      if (allDone) o.markInstalled();
    } catch {
      setRows(Object.fromEntries(o.draft.repos.map((r) => [r.id, { state: 'failed' as const, error: 'errorOther' as const }])));
    } finally {
      running.current = false;
    }
  }, [gh, authHeader, o, rows]);

  const checkApp = useCallback(async () => {
    setApp((a) => ({ ...a, state: 'working' }));
    try {
      const { missing } = await appInstalledOn(authHeader, o.draft.repos.map((r) => `${r.owner}/${r.name}`));
      setApp({ state: missing.length ? 'waiting' : 'done', missing });
      if (!missing.length) void saveAll();
    } catch {
      setApp({ state: 'failed', missing: [] });
    }
  }, [authHeader, o.draft.repos, saveAll]);

  const start = useCallback(() => {
    setStarted(true);
    void checkApp();
  }, [checkApp]);

  // Back from GitHub's install page: drop its params (never trusted) and check the App again.
  // GitHub opens in a new tab, so this is usually that tab: the keys are in the
  // tab setup started in, which notices the App by itself (polling, focus).
  const handled = useRef(false);
  const [returnedHere, setReturnedHere] = useState(false);
  useEffect(() => {
    if (handled.current || !o.draft.repos.length) return;
    handled.current = true;
    if (!cameBackFromGitHub()) return;
    router.replace(stepPath('install'));
    if (valuesGone || o.installed) setReturnedHere(!o.installed);
    else start();
  }, [o.draft.repos.length, o.installed, valuesGone, router, start]);

  // While the App is missing, check again every few seconds and when the tab comes back.
  const waitingForApp = started && app.state === 'waiting' && app.missing.length > 0;
  useEffect(() => {
    if (!waitingForApp) return;
    const timer = setInterval(() => document.visibilityState === 'visible' && void checkApp(), APP_POLL_MS);
    const onFocus = () => void checkApp();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [waitingForApp, checkApp]);

  // Once per round of new keys; a failure leaves Retry to the person.
  const resaving = useRef(false);
  useEffect(() => {
    if (!resave) {
      resaving.current = false;
      return;
    }
    if (resaving.current) return;
    resaving.current = true;
    void saveAll();
  }, [resave, saveAll]);

  const lines = o.draft.repos.map((r) => ({ id: r.id, name: `${r.owner}/${r.name}`, state: done ? ('done' as const) : rows[r.id]?.state ?? 'waiting', error: rows[r.id]?.error }));
  return (
    <InstallScreen
      started={started}
      onStart={start}
      app={app}
      owner={o.picked[0]?.owner.login}
      installUrl={appInstallUrl(o.picked[0]?.owner.id, o.picked.map((r) => r.id))}
      onRecheck={() => void checkApp()}
      repos={lines}
      onRetry={() => void saveAll()}
      valuesGone={valuesGone}
      returned={returnedHere}
      onBackToModel={() => o.go('model')}
      done={done}
      onBack={() => o.go('context')}
      onContinue={() => void o.advance('setup-pr')}
    />
  );
}

// ---- 6. Setup PR --------------------------------------------------------------------------------

/** How long the Setup PR screen waits on a run or a key check before it stops holding Continue back (a runner can sit queued). */
const CHECK_GIVE_UP_MS = 5 * 60_000;

function SetupPrStep() {
  const o = useOnboarding();
  const { authHeader } = useAccount();
  const gh = o.github.client;
  const [rows, setRows] = useState<Record<number, SetupRow>>({});
  const running = useRef(false);
  const draftGone = !o.confirmed;
  const tool = o.draft.analytics.tool;
  const setRow = useCallback((id: number, patch: Partial<SetupRow>) => setRows((all) => ({ ...all, [id]: { ...all[id]!, ...patch } })), []);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  /**
   * Starts the runner's key check (the workflow's `check` job) on a branch: the setup PR's, or the
   * default branch once it's merged. It reads the keys as saved now, so it's how every re-check is
   * done: re-running an old run would check that run's files, and GitHub refuses runs past 30 days.
   */
  const startCheck = useCallback(
    async (repo: PickedRepo, branch: string, analyticsTool: string) => {
      if (!gh) return;
      try {
        const check = await startKeyCheck(gh, { fullName: `${repo.owner}/${repo.name}`, defaultBranch: branch });
        setRow(repo.id, { check, since: Date.now(), gaveUp: false, connections: connectionStates(undefined, [], analyticsTool) });
      } catch {
        // Couldn't start it: unknown, not refused. Check again is offered.
        setRow(repo.id, { check: undefined, connections: uncheckedConnections(analyticsTool) });
      }
    },
    [gh, setRow],
  );

  /** The keys' last result on a commit when it's newer than the keys themselves; otherwise a new check on its branch. */
  const resultOrCheck = useCallback(
    async (repo: PickedRepo, sha: string, branch: string) => {
      if (!gh) return;
      const r = ref(repo);
      const saved = await Promise.all([MODEL_KEY, ...analyticsSecretNames(o.draft)].map((n) => secretSavedAt(gh, r, n).catch(() => null)));
      const fresh = await freshKeyResult(gh, r, sha, saved).catch(() => null);
      if (fresh) setRow(repo.id, { check: undefined, connections: connectionsFromResults(fresh, tool) });
      else await startCheck(repo, branch, tool);
    },
    [gh, o.draft, tool, setRow, startCheck],
  );

  const openAll = useCallback(async () => {
    if (!gh || running.current || draftGone) return;
    running.current = true;
    try {
      for (const repo of o.draft.repos) {
        if (rows[repo.id]?.pr || rows[repo.id]?.alreadySetUp) continue;
        setRows((r) => ({ ...r, [repo.id]: { opening: true, failed: false } }));
        let opened: Awaited<ReturnType<typeof openSetupPr>>;
        try {
          // Linked first: opening the PR starts its run at once, and an unlinked repo's run gets no
          // Datalyze App token, so its checks would be posted as github-actions[bot].
          await linkRepoIds(authHeader, [repo.id]);
          opened = await openSetupPr(gh, o.draft, repo);
        } catch (error) {
          // A refused link says why (the server checks admin or maintain with GitHub); anything else is the plain failure.
          setRows((r) => ({ ...r, [repo.id]: { opening: false, failed: true, linkProblem: linkProblem(error, repo.id) ?? undefined } }));
          continue;
        }
        // From here the PR (or the setup) is there to show: a check that can't be read or started is
        // "unchecked" with Check again, never a lost PR or a pass.
        if (!opened.pull) {
          // Set up already (usually: the setup PR was merged). The keys are checked on the default branch.
          setRows((r) => ({ ...r, [repo.id]: { opening: false, failed: false, alreadySetUp: true, connections: connectionStates(undefined, [], tool) } }));
          try {
            await resultOrCheck(repo, await gh.branchSha(ref(repo), repo.defaultBranch), repo.defaultBranch);
          } catch {
            setRow(repo.id, { connections: uncheckedConnections(tool) });
          }
          continue;
        }
        const { pull, reused, updated } = opened;
        const shown: SetupRow = { opening: false, failed: false, pr: { number: pull.number, url: pull.html_url }, headRef: pull.head.ref, headSha: pull.head.sha };
        if (!reused || updated) {
          // A new commit: its run checks the keys.
          setRows((r) => ({ ...r, [repo.id]: { ...shown, run: { state: 'waiting' }, since: Date.now() } }));
          continue;
        }
        // An unchanged setup PR starts no run: its last result counts if it's newer than the keys, else they're checked again.
        setRows((r) => ({ ...r, [repo.id]: { ...shown, connections: connectionStates(undefined, [], tool) } }));
        try {
          const last = setupRunState(await gh.workflowRuns(ref(repo), WORKFLOW_FILE, pull.head.ref), pull.head.sha);
          if (last.state === 'waiting' || last.state === 'running') {
            setRow(repo.id, { run: last, since: Date.now(), connections: undefined });
            continue;
          }
          setRow(repo.id, { run: last });
          await resultOrCheck(repo, pull.head.sha, pull.head.ref);
        } catch {
          setRow(repo.id, { connections: uncheckedConnections(tool) });
        }
      }
    } finally {
      running.current = false;
    }
  }, [gh, draftGone, o.draft, rows, authHeader, tool, setRow, resultOrCheck]);

  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !o.draft.repos.length) return;
    opened.current = true;
    void openAll();
  }, [o.draft.repos.length, openAll]);

  // The workflow run on each PR, or a key check, until it has a result; then the connections it posted.
  const pending = Object.values(rows).some((r) => r.check || (r.headSha && !r.gaveUp && (r.run?.state === 'waiting' || r.run?.state === 'running')));
  useEffect(() => {
    if (!gh || !pending) return;
    const tick = async () => {
      for (const repo of o.draft.repos) {
        const r = rowsRef.current[repo.id];
        if (!r) continue;
        const late = r.since !== undefined && Date.now() - r.since > CHECK_GIVE_UP_MS;
        try {
          if (r.check) {
            const [model, analytics] = await Promise.all([keyCheckResult(gh, r.check, 'model'), tool === 'none' ? null : keyCheckResult(gh, r.check, 'analytics')]);
            if (model && (tool === 'none' || analytics)) setRow(repo.id, { check: undefined, connections: connectionsFromResults({ model, analytics }, tool) });
            else if (late) setRow(repo.id, { check: undefined, connections: uncheckedConnections(tool) });
            continue;
          }
          if (!r.headRef || !r.headSha || r.gaveUp || (r.run?.state !== 'waiting' && r.run?.state !== 'running')) continue;
          const run: RunState = setupRunState(await gh.workflowRuns(ref(repo), WORKFLOW_FILE, r.headRef), r.headSha, r.minAttempt);
          const finished = run.state === 'started' || run.state === 'failed';
          if (finished) setRow(repo.id, { run, connections: connectionStates(run, await gh.statuses(ref(repo), r.headSha), tool) });
          // Too long without a result: stop holding Continue back. A run that never started stops being polled
          // (Check again starts a check); one still running is still watched.
          else if (late) setRow(repo.id, { run, connections: uncheckedConnections(tool), gaveUp: run.state === 'waiting' });
          else setRow(repo.id, { run, connections: connectionStates(run, [], tool) });
        } catch {
          // A failed poll isn't a failed run: try again on the next tick.
        }
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), RUN_POLL_MS);
    return () => clearInterval(timer);
  }, [gh, pending, o.draft.repos, tool, setRow]);

  // ---- changing a refused key, in place ----
  const [fixKind, setFixKind] = useState<'model' | 'analytics' | null>(null);
  const [fixDraft, setFixDraft] = useState<Draft>(o.draft);
  const [fixValues, setFixValues] = useState<SecretValues>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [fixCheck, setFixCheck] = useState<AnalyticsCheck>({ state: 'idle' });
  const startFix = (kind: 'model' | 'analytics') => {
    setFixDraft(o.draft);
    setFixValues({});
    setSaveFailed(false);
    setFixCheck({ state: 'idle' });
    setFixKind(kind);
  };
  const saveFix = async () => {
    if (!gh || saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      // New analytics keys are tried from this browser first, as on the Analytics screen.
      if (fixKind === 'analytics' && fixDraft.analytics.tool !== 'none') {
        setFixCheck({ state: 'checking' });
        const result = await checkAnalyticsLive(fixDraft, fixValues);
        setFixCheck(result);
        if (result.state === 'refused') return;
      }
      const nextTool = fixDraft.analytics.tool;
      for (const repo of fixDraft.repos) {
        await saveSecrets(gh, fixDraft, repo, fixValues);
        const opened = await openSetupPr(gh, fixDraft, repo);
        // Still set up as it was (no PR): check the new keys on the default branch.
        if (!opened.pull) await startCheck(repo, repo.defaultBranch, nextTool);
        // A changed choice (project, region, tool) is a new commit, or a new setup PR on a merged repo: its run checks the keys.
        else if (opened.updated || !opened.reused) {
          const { pull } = opened;
          setRow(repo.id, { alreadySetUp: false, pr: { number: pull.number, url: pull.html_url }, headRef: pull.head.ref, headSha: pull.head.sha, run: { state: 'waiting' }, minAttempt: undefined, check: undefined, since: Date.now(), gaveUp: false, connections: connectionStates(undefined, [], nextTool) });
        }
        // The same PR, unchanged: check the new keys on its branch.
        else await startCheck(repo, opened.pull.head.ref, nextTool);
      }
      o.setDraft(() => fixDraft);
      setFixKind(null);
      setFixValues({});
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const list: SetupPrRow[] = o.draft.repos.map((r) => ({ id: r.id, name: `${r.owner}/${r.name}`, opening: rows[r.id]?.opening ?? !draftGone, failed: rows[r.id]?.failed ?? false, linkProblem: rows[r.id]?.linkProblem, pr: rows[r.id]?.pr, alreadySetUp: rows[r.id]?.alreadySetUp, run: rows[r.id]?.run, connections: rows[r.id]?.connections }));
  const toFix = connectionsToFix(list.map((r) => r.connections));
  // A PR whose run hasn't reported yet, or a check still going: Continue waits (at most CHECK_GIVE_UP_MS).
  const checking = list.some((r) => (r.pr && !r.connections) || connectionsPending(r.connections));
  const unclear = list.filter((r) => (r.pr || r.alreadySetUp) && r.connections && (r.connections.model.state === 'unchecked' || r.connections.analytics.state === 'unchecked'));
  const checkAgain = () =>
    void Promise.all(
      unclear.map((r) => {
        const repo = o.draft.repos.find((x) => x.id === r.id);
        const row = rows[r.id];
        return repo ? startCheck(repo, row?.pr && row.headRef ? row.headRef : repo.defaultBranch, tool) : undefined;
      }),
    );
  return (
    <SetupPrScreen
      rows={list}
      draftGone={draftGone}
      onBackToModel={() => o.go('model')}
      onRetry={() => void openAll()}
      toFix={toFix}
      fix={
        fixKind
          ? {
              kind: fixKind,
              draft: fixDraft,
              setDraft: (fn) => setFixDraft((d) => fn(d)),
              values: fixValues,
              setValue: (name, value) => {
                setFixCheck({ state: 'idle' });
                setFixValues((v) => ({ ...v, [name]: value }));
              },
              ready: fixKind === 'model' ? modelReady(fixDraft, fixValues) : analyticsReady(fixDraft, fixValues),
              check: fixCheck,
              secretNames: analyticsSecretNames(fixDraft),
              saving,
              saveFailed,
              onSave: () => void saveFix(),
              onCancel: () => setFixKind(null),
            }
          : null
      }
      onFix={startFix}
      onCheckAgain={unclear.length ? checkAgain : null}
      checking={checking}
      done={list.length > 0 && list.every((r) => r.pr || r.alreadySetUp)}
      onBack={() => o.go('install')}
      onContinue={() => void o.advance('pay')}
    />
  );
}

/** One repo on the Setup PR screen, with what polling needs: the PR's run, or a key check started on a branch. */
type SetupRow = Omit<SetupPrRow, 'id' | 'name'> & { headRef?: string; headSha?: string; minAttempt?: number; check?: StartedCheck; since?: number; gaveUp?: boolean };

// ---- 7. Pay -------------------------------------------------------------------------------------

function PayStep() {
  const o = useOnboarding();
  const { authHeader, reload, logOut } = useAccount();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<PayMessage | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // The first audit is the step after paying: saved now, so the gate sends a new subscriber there.
  const { save } = o;
  useEffect(() => {
    void save('first-audit');
  }, [save]);

  const pay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!isStripeConfigured) return setMessage('notConfigured');
      const res = await fetch('/api/account/checkout', {
        method: 'POST',
        headers: { ...(await authHeader()), 'content-type': 'application/json' },
        body: JSON.stringify({ planId: 'tracking-monthly' }),
      });
      if (res.status === 401) return logOut();
      const data = (await res.json().catch(() => ({}))) as { clientSecret?: string; code?: string };
      if (!res.ok || typeof data.clientSecret !== 'string') return setMessage(data.code === 'has_subscription' ? 'hasSubscription' : 'error');
      setClientSecret(data.clientSecret);
    } catch {
      setMessage('error');
    } finally {
      setBusy(false);
    }
  };

  // Stripe's webhook grants access; reload the account until it shows. The gate then opens the dashboard.
  const onPaid = async () => {
    setClientSecret(null);
    setMessage('received');
    await o.save('first-audit');
    // Onboarding is over: its choices needn't stay in this browser.
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {}
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const latest = await reload().catch(() => null);
      if (latest?.products.tracking_agent?.active) return;
    }
    setMessage('pending');
  };

  return (
    <>
      <PayScreen busy={busy} message={message} onPay={() => void pay()} onBack={() => o.go('setup-pr')} />
      {clientSecret ? <CheckoutModal clientSecret={clientSecret} label={C.pay.checkoutLabel} closeLabel={C.pay.close} onClose={() => setClientSecret(null)} onComplete={() => void onPaid()} /> : null}
    </>
  );
}

// ---- 8. The first audit -------------------------------------------------------------------------

/**
 * Run your first audit (25 Nov 2026): never started by itself, and nothing else opens until it is.
 * It needs the setup PR merged, since the audit runs the workflow that PR adds to the default branch.
 * A repo that already has an audit run (started by the setup merge before this screen existed) opens
 * it instead. Starting one finishes onboarding and opens that audit's page.
 */
function FirstAuditStep() {
  const o = useOnboarding();
  const gh = o.github.client;
  const [rows, setRows] = useState<Record<number, FirstAuditRow>>({});
  const read = useCallback(async () => {
    if (!gh) return;
    await Promise.all(
      o.picked.map(async (repo) => {
        const r = { owner: repo.owner.login, repo: repo.name };
        const row = (patch: Omit<FirstAuditRow, 'id' | 'name'>) => setRows((all) => ({ ...all, [repo.id]: { id: repo.id, name: repo.full_name, ...patch } }));
        row({ state: 'checking' });
        try {
          const [workflow, runs] = await Promise.all([gh.rawFile(r, `.github/workflows/${WORKFLOW_FILE}`, repo.default_branch), loadRuns(gh, r, 20).catch(() => [])]);
          if (runs.some((x) => x.job === 'audit')) return row({ state: 'started' });
          if (workflow !== null) return row({ state: 'ready' });
          const pulls = await gh.pulls(r, { head: `${r.owner}:${SETUP_BRANCH}`, state: 'open' }, 1).catch(() => []);
          row({ state: 'unmerged', setupPr: pulls[0] ? { number: pulls[0].number, url: pulls[0].html_url } : undefined });
        } catch {
          row({ state: 'failed' });
        }
      }),
    );
  }, [gh, o.picked]);
  useEffect(() => {
    void read();
  }, [read]);
  const repoOf = (id: number) => o.picked.find((p) => p.id === id);
  const open = (id: number) => {
    const repo = repoOf(id);
    if (repo) void o.finish(auditPath({ owner: repo.owner.login, repo: repo.name }));
  };
  const run = async (id: number) => {
    const repo = repoOf(id);
    if (!gh || !repo) return;
    setRows((all) => ({ ...all, [id]: { ...all[id]!, state: 'starting' } }));
    try {
      await runFirstAudit(gh, { fullName: repo.full_name, defaultBranch: repo.default_branch });
    } catch {
      return setRows((all) => ({ ...all, [id]: { ...all[id]!, state: 'failed' } }));
    }
    // The run takes a moment to be listed: the audit page waits for it.
    await o.finish(`${auditPath({ owner: repo.owner.login, repo: repo.name })}?started=1`);
  };
  const list = o.picked.map((p) => rows[p.id] ?? { id: p.id, name: p.full_name, state: 'checking' as const });
  if (!o.repos) return <Loading />;
  return <FirstAuditScreen rows={list} onRun={(id) => void run(id)} onOpen={open} onCheckAgain={() => void read()} />;
}
