'use client';

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import a from '@/components/account/account.module.css';
import { useAccount, useMaybeAccount } from '@/components/account/account-shell';
import { fill } from '@/lib/content/account';
import { rich, stripRich } from '@/lib/content/rich';
import { trackingAgentDashboardContent } from '@/lib/content/trackingAgentDashboard';
import type { TrackingAccount } from '@/lib/tracking-agent/app-account';
import { loadAllRepoFacts, type LoadOptions, type RepoFacts } from '@/lib/tracking-agent/repos';
import { mapLimit } from '@/lib/tracking-agent/review/inbox';
import type { GitHubClient } from '@/lib/tracking-agent/github/client';
import { SETUP_SCOPES, githubEndedHere, hasScopes, startSignIn, useGitHubSession } from '@/lib/tracking-agent/github/session';
import { DatalyzeApiError, getLinkedRepos, getRepoFacts } from '@/lib/tracking-agent/setup/datalyze-api';

/** A string from content/tracking-agent-dashboard.json by its dotted path, with {vars} filled. */
export function text(path: string, vars: Record<string, string> = {}): string {
  let node: unknown = trackingAgentDashboardContent;
  for (const part of path.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return fill(typeof node === 'string' ? node : '', vars);
}

/** Plain text, for attributes. */
export const plain = (path: string, vars?: Record<string, string>) => stripRich(text(path, vars));

/** One string, through rich() on an element carrying its data-ck path, so /admin can edit it in place. */
export function T({ k, vars, as, className, children }: { k: string; vars?: Record<string, string>; as?: ElementType; className?: string; children?: ReactNode }) {
  const Tag = as ?? 'span';
  return (
    <Tag className={className} data-ck={k}>
      {rich(text(k, vars))}
      {children}
    </Tag>
  );
}

export const day = (iso: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

/** The page's heading block. */
export function PageHead({ title, intro, action }: { title: string; intro?: string; action?: ReactNode }) {
  return (
    <header className={a.pageHead} style={{ marginBottom: intro ? undefined : 28, ...(action ? { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' } : {}) }}>
      <div>
        <T k={title} as="h1" className={a.pageTitle} />
        {intro ? <T k={intro} as="p" className={a.pageIntro} /> : null}
      </div>
      {action}
    </header>
  );
}

/** "Connect GitHub": the paid app reads repos, PRs and checks with the person's own GitHub sign-in. */
/**
 * Connect GitHub, or, when the sign-in couldn't be checked (`unknown`), says so with Retry: a
 * failure on our side, at Firebase or at GitHub is never shown as signed out.
 */
export function GitHubCard({ returnTo, unknown = false, onRetry, forChanges = false }: { returnTo: string; unknown?: boolean; onRetry?: () => void; forChanges?: boolean }) {
  // Why the saved sign-in ended on its own (GitHub refused it, or six months unused), from the page-load call.
  const loaded = useMaybeAccount<TrackingAccount>()?.account?.githubEnded ?? null;
  const ended = githubEndedHere() ?? loaded;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await startSignIn(SETUP_SCOPES, returnTo);
    } catch {
      setBusy(false);
      setFailed(true);
    }
  };
  if (unknown) {
    return (
      <section className={a.card}>
        <T k="github.unknown.title" as="h2" className={a.cardTitle} />
        <T k="github.unknown.body" as="p" className={a.cardBody} />
        {onRetry ? (
          <div className={a.cardActions}>
            <button type="button" className={a.button} onClick={onRetry} data-ck="github.unknown.retry">
              {rich(text('github.unknown.retry'))}
            </button>
          </div>
        ) : null}
      </section>
    );
  }
  return (
    <section className={a.card}>
      <T k={forChanges ? 'github.forChanges.title' : 'github.title'} as="h2" className={a.cardTitle} />
      <T k={forChanges ? 'github.forChanges.body' : 'github.body'} as="p" className={a.cardBody} />
      {ended ? <T k={ended === 'revoked' ? 'github.ended.revoked' : 'github.ended.unused'} as="p" className={a.notice} /> : null}
      {failed ? <T k="github.error" as="p" className={a.error} /> : null}
      <div className={a.cardActions}>
        <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={busy} onClick={() => void go()} data-ck={busy ? 'github.working' : 'github.button'}>
          {rich(text(busy ? 'github.working' : 'github.button'))}
        </button>
      </div>
    </section>
  );
}

/** How many repos one call to the server reads. */
const FACTS_BATCH = 10;

/**
 * Above a page whose repos the Datalyze App read: Connect GitHub, to make changes (or "couldn't
 * check" while the sign-in can't be told), and how many repos only a sign-in can read. Nothing
 * when this browser's GitHub sign-in can make changes.
 */
export function ConnectForChanges({ linked, returnTo }: { linked: Linked; returnTo: string }) {
  if (linked.canWrite || !(linked.githubReady || linked.githubUnknown)) return null;
  return (
    <>
      <GitHubCard returnTo={returnTo} unknown={linked.githubUnknown} onRetry={linked.retryGitHub} forChanges />
      {linked.waiting ? <T k={linked.waiting === 1 ? 'dashboard.waitingOne' : 'dashboard.waiting'} vars={{ n: String(linked.waiting) }} as="p" className={a.notice} /> : null}
    </>
  );
}

/** Linked repos GitHub couldn't be asked about this time, with Retry: never "not there". */
export function UnreadNotice({ n, onRetry }: { n: number; onRetry?: () => void }) {
  return (
    <p className={a.notice}>
      <T k={n === 1 ? 'dashboard.unreadOne' : 'dashboard.unread'} vars={{ n: String(n) }} />{' '}
      {onRetry ? (
        <button type="button" className={a.button} onClick={onRetry} data-ck="dashboard.retry">
          {rich(text('dashboard.retry'))}
        </button>
      ) : null}
    </p>
  );
}

export type Linked = {
  gh: GitHubClient | null;
  login: string | null;
  /** The session lacks the scopes the paid app needs: show GitHubCard. */
  needsGitHub: boolean;
  /** The sign-in couldn't be checked: GitHubCard says so, with `retryGitHub`, never Connect GitHub. */
  githubUnknown: boolean;
  retryGitHub: () => void;
  /** A GitHub sign-in with Setup's scopes: changes (PRs, keys, runs) can be made. */
  canWrite: boolean;
  /** The GitHub sign-in is known (signed in or not). */
  githubReady: boolean;
  /** Linked repos without the Datalyze App, which only a GitHub sign-in here can read. */
  waiting: number;
  /** Each linked repo's facts as they arrive, in the linked order; null until the first is asked for. */
  repos: RepoFacts[] | null;
  /** Still reading some repos. */
  loading: boolean;
  /** How many linked repos GitHub says this sign-in can't see. */
  unseen: number;
  /** How many linked repos GitHub couldn't be asked about this time (Retry is `reload`). */
  unread: number;
  error: boolean;
  reload: () => void;
  /** The repos only, not the account: for polling while a run goes. */
  refresh: () => void;
};

/**
 * The linked repos (Datalyze knows their ids) and their facts (lib/tracking-agent/repos.ts), read
 * from GitHub in this browser, each repo shown as it resolves. The first load takes the ids from the
 * account the shell loaded; a reload, after a change made here, asks Datalyze again and refreshes
 * that account.
 */
export function useLinkedRepos(options: LoadOptions = {}): Linked {
  const { account, authHeader, logOut, reload: reloadAccount } = useAccount<TrackingAccount>();
  const { session, client: gh, ready, unknown, retry } = useGitHubSession();
  const [repos, setRepos] = useState<RepoFacts[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [unread, setUnread] = useState(0);
  // Repos only the relay can read (no Datalyze App there), waiting for a GitHub sign-in.
  const [waiting, setWaiting] = useState(0);
  const withProposals = options.proposals ?? true;
  const [error, setError] = useState(false);
  const usable = Boolean(gh && hasScopes(session, SETUP_SCOPES));
  // The GitHub sign-in is settled: known (signed in or not), or couldn't be checked. Repos load
  // either way: the server reads them with the Datalyze App.
  const settled = ready || unknown;
  const fromAccount = useRef(account.linkedRepoIds ?? null);
  // A newer load (a reload) makes an older one's late answers stale.
  const generation = useRef(0);

  // quiet (polling while something runs): what's shown stays until the new facts are all in, and a
  // failed refresh keeps it, so the page never blanks to its loading state every few seconds.
  const load = useCallback(
    (fresh: boolean, quiet = false) => {
      if (!settled) return;
      const mine = ++generation.current;
      const current = () => generation.current === mine;
      if (!quiet) {
        setRepos(null);
        setLoading(true);
        setError(false);
        setWaiting(0);
        setUnseen(0);
        setUnread(0);
      }
      const known = fresh ? null : fromAccount.current;
      fromAccount.current = null;
      (known ? Promise.resolve(known) : getLinkedRepos(authHeader).then((rows) => rows.map((r) => r.githubRepoId)))
        .then(async (ids) => {
          const order = new Map(ids.map((id, i) => [id, i]));
          const sorted = (list: RepoFacts[]) => [...list].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
          let shown: RepoFacts[] = [];
          const show = (more: RepoFacts[]) => {
            shown = sorted([...shown.filter((x) => !more.some((m) => m.id === x.id)), ...more]);
            if (current() && !quiet) setRepos(shown);
          };
          if (!quiet) setRepos([]);
          if (!ids.length) return void (current() && setRepos([]));
          // The server first, in batches of ten (each shown as it arrives), read with the Datalyze App.
          // A batch the server fails as a whole is read the old way, through this browser.
          let [seen, failed] = [0, 0];
          const viaRelay: { id: number; noApp: boolean }[] = [];
          const batches = Array.from({ length: Math.ceil(ids.length / FACTS_BATCH) }, (_, i) => ids.slice(i * FACTS_BATCH, (i + 1) * FACTS_BATCH));
          await mapLimit(batches, 2, async (batch) => {
            const server = await getRepoFacts(authHeader, batch, withProposals).catch((e: unknown) => {
              if (e instanceof DatalyzeApiError && e.status === 401) throw e;
              return null;
            });
            if (!current()) return;
            if (!server) return void viaRelay.push(...batch.map((id) => ({ id, noApp: false })));
            seen += server.unseen;
            failed += server.unread;
            viaRelay.push(...server.fallback.map((f) => ({ id: f.id, noApp: f.reason === 'noApp' })));
            show(server.repos);
          });
          if (!current()) return;
          const noApp = new Set(viaRelay.filter((x) => x.noApp).map((x) => x.id));
          const tag = (f: RepoFacts): RepoFacts => ({ ...f, via: 'relay', ...(noApp.has(f.id) ? { noApp: true } : {}) });
          if (viaRelay.length && gh && usable) {
            const got = await loadAllRepoFacts(gh, viaRelay.map((x) => x.id).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)), (f) => show([tag(f)]), { proposals: withProposals });
            if (!current()) return;
            show(got.repos.map(tag));
            seen += got.unseen;
            failed += got.unread;
          }
          setWaiting(viaRelay.length && !(gh && usable) ? viaRelay.length : 0);
          setUnseen(seen);
          setUnread(failed);
          setError(false);
          setRepos(shown);
        })
        .catch((e) => current() && (e instanceof DatalyzeApiError && e.status === 401 ? logOut() : quiet || setError(true)))
        // Quiet too: it may have replaced a first load that was still going.
        .finally(() => current() && setLoading(false));
    },
    [settled, gh, usable, authHeader, logOut, withProposals],
  );
  // The shell's account is read again too, so the next page's first load has the new ids.
  const reload = useCallback(() => {
    // After a change, what's shown stays until the new facts are in; Try again after an error shows its loading state.
    void reloadAccount().catch(() => undefined);
    load(true, !error);
  }, [load, reloadAccount, error]);
  const refresh = useCallback(() => load(true, true), [load]);

  useEffect(() => load(false), [load]);
  return {
    gh,
    login: session?.login ?? null,
    // Only when some repo can't be read without it: the rest show, read by the Datalyze App.
    needsGitHub: ready && !usable && waiting > 0 && !repos?.length,
    canWrite: usable,
    githubReady: ready,
    githubUnknown: unknown,
    retryGitHub: retry,
    repos,
    loading,
    unseen,
    unread,
    waiting,
    error,
    reload,
    refresh,
  };
}
