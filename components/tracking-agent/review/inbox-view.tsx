'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import a from '@/components/account/account.module.css';
import { useMaybeAccount } from '@/components/account/account-shell';
import { useLinkedRepos } from '@/components/tracking-agent/app/shared';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { Chip, When, type Tone } from '@/components/tracking-agent/app/ui';
import { active } from '@/lib/tracking-agent/runs';
import { auditPath } from '@/lib/tracking-agent/audit';
import type { GitHubClient } from '@/lib/tracking-agent/github/client';
import { loadPrHistory, MAX_PRS, type PrEntry } from '@/lib/tracking-agent/history';
import { hasScopes, REVIEW_SCOPES, useGitHubSession } from '@/lib/tracking-agent/github/session';
import { mapLimit, parsePrLink, reviewPath } from '@/lib/tracking-agent/review/inbox';
import type { OpenProposal, ProposalState, RepoFacts } from '@/lib/tracking-agent/repos';
import { C, t } from './copy';
import { GitHubUnknownPanel, SignInPanel } from './review-shell';
import s from './review.module.css';

/**
 * /tracking-agent/review, the Pull requests tab: the proposals waiting in the workspace's linked repos
 * (12.2: only those), then every pull request Datalyze checked there and how it ended. A reviewer
 * signed in with GitHub alone has no workspace, so they open a review by its link.
 */
export function InboxPage() {
  const account = useMaybeAccount();
  const { session, ready, unknown, retry } = useGitHubSession();
  if (!ready) return unknown ? <GitHubUnknownPanel onRetry={retry} /> : <div className={a.skeleton} style={{ height: 240 }} aria-busy="true" />;
  if (!session || !hasScopes(session, REVIEW_SCOPES)) return <SignInPanel returnTo="/tracking-agent/review" needsScopes={Boolean(session)} />;
  return account ? <WorkspaceInbox /> : <GitHubOnlyInbox />;
}

function WorkspaceInbox() {
  const linked = useLinkedRepos();
  return <InboxView repos={linked.repos} loading={linked.loading} error={linked.error} onReload={linked.reload} gh={linked.gh} />;
}

function GitHubOnlyInbox() {
  return (
    <>
      <InboxHead />
      <C k="inbox.noWorkspace" as="p" className={a.notice} />
      <PasteLink />
      <RestrictedHelp restricted={[]} />
    </>
  );
}

/** The title, and (in a workspace) "Open a PR by link" as a small button that opens the paste box. */
function InboxHead({ action }: { action?: ReactNode }) {
  return (
    <header className={`${a.pageHead} ${t2.titleRow}`} style={{ marginBottom: 28 }}>
      <C k="inbox.title" as="h1" className={a.pageTitle} />
      {action}
    </header>
  );
}

const TONE: Record<ProposalState, Tone> = { awaiting: 'warn', approved: 'run', heldBack: 'warn', needsPerson: 'bad', unfinished: 'warn', toMerge: 'ok' };

/** The inbox from its data, so the preview can pass fixtures. `repos` null while loading. */
export function InboxView({ repos, loading, error, onReload, gh }: { repos: RepoFacts[] | null; loading?: boolean; error?: boolean; onReload?: () => void; gh?: GitHubClient | null }) {
  const [pasting, setPasting] = useState(false);
  const rows = (repos ?? []).flatMap((r) => r.proposals.map((p) => ({ repo: r, p }))).sort((x, y) => y.p.since.localeCompare(x.p.since));
  return (
    <>
      <InboxHead
        action={
          <button type="button" className={a.button} aria-expanded={pasting} onClick={() => setPasting((v) => !v)}>
            <C k="inbox.pasteLabel" />
          </button>
        }
      />
      {pasting ? <PasteLink /> : null}
      {error ? (
        <section className={a.card}>
          <C k="inbox.error" as="p" className={a.cardBody} />
          {onReload ? (
            <div className={a.cardActions}>
              <button type="button" className={a.button} onClick={onReload}>
                <C k="inbox.reload" />
              </button>
            </div>
          ) : null}
        </section>
      ) : !repos || (loading && !rows.length) ? (
        <div aria-busy="true">
          <C k="inbox.loading" as="p" className={a.note} />
          <div className={a.skeleton} style={{ height: 56, marginTop: 12 }} />
        </div>
      ) : (
        <>
          <section className={t2.section} style={{ marginTop: 0 }}>
            <div className={t2.sectionHead}>
              <C k="inbox.waiting" as="h2" className={t2.sectionTitle} />
              <span className={t2.faint}>{rows.length}</span>
            </div>
            {!rows.length ? (
              <C k="inbox.empty" as="p" className={t2.faint} />
            ) : (
              <div className={t2.tableWrap}>
                <table className={t2.table}>
                  <thead>
                    <tr>
                      <C k="inbox.columns.pr" as="th" />
                      <C k="inbox.columns.repo" as="th" />
                      <C k="inbox.columns.status" as="th" />
                      <C k="inbox.columns.by" as="th" />
                      <C k="inbox.columns.updated" as="th" />
                      <th aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ repo, p }) => (
                      <ProposalRow key={`${repo.fullName}#${p.number}`} repo={repo} p={p} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {gh ? <PrHistory repos={repos} gh={gh} done={!loading} /> : null}
        </>
      )}
    </>
  );
}

const PR_STATE_TONE: Record<PrEntry['state'], Tone> = { open: 'run', merged: 'ok', closed: 'idle' };

/**
 * Every pull request Datalyze checked in the linked repos, open or not, newest first, each with what
 * Datalyze made of it and a way into its page: the review screen, or the audit for an audit's fix.
 */
function PrHistory({ repos, gh, done }: { repos: RepoFacts[]; gh: GitHubClient; done: boolean }) {
  const [rows, setRows] = useState<PrEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [only, setOnly] = useState('');
  // Read again once the repos have all arrived, and when their open proposals change.
  const key = done ? repos.map((r) => `${r.fullName}:${r.proposals.map((p) => `${p.number}${p.state}`).join('.')}`).join(',') : '';

  useEffect(() => {
    if (!key) return;
    let live = true;
    setRows(null);
    setFailed(false);
    const read = repos.filter((r) => r.configOnDefault || r.setupPr);
    mapLimit(read, 3, (r) => {
      const [owner = '', repo = ''] = r.fullName.split('/');
      return loadPrHistory(gh, { owner, repo });
    })
      .then((lists) => live && setRows(lists.flat().sort((x, y) => y.createdAt.localeCompare(x.createdAt))))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // The key stands for the repos and their proposals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh, key]);

  const names = [...new Set(repos.map((r) => r.fullName))];
  const shown = (rows ?? []).filter((r) => !only || r.repo === only);

  return (
    <section className={t2.section}>
      <div className={t2.sectionHead}>
        <C k="inbox.history.title" as="h2" className={t2.sectionTitle} />
        {names.length > 1 ? (
          <select className={`${a.input} ${t2.small}`} style={{ width: 'auto' }} value={only} onChange={(e) => setOnly(e.target.value)} aria-label={t('inbox.history.filter')}>
            <option value="">{t('inbox.history.allRepos')}</option>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <C k="inbox.history.intro" as="p" className={a.note} vars={{ n: String(MAX_PRS) }} />
      {failed ? (
        <C k="inbox.history.error" as="p" className={a.error} />
      ) : !rows ? (
        <div aria-busy="true">
          <C k="inbox.history.loading" as="p" className={a.note} />
        </div>
      ) : !shown.length ? (
        <C k="inbox.history.empty" as="p" className={t2.faint} />
      ) : (
        <div className={t2.tableWrap}>
          <table className={t2.table}>
            <thead>
              <tr>
                <C k="inbox.history.columns.pr" as="th" />
                {names.length > 1 ? <C k="inbox.history.columns.repo" as="th" /> : null}
                <C k="inbox.history.columns.raised" as="th" />
                <C k="inbox.history.columns.checks" as="th" />
                <C k="inbox.history.columns.person" as="th" />
                <C k="inbox.history.columns.prState" as="th" />
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <HistoryRow key={`${p.repo}#${p.number}`} p={p} manyRepos={names.length > 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const CHECKS_TONE: Record<PrEntry['checks'], Tone> = { passed: 'ok', pending: 'warn', failed: 'bad' };

function HistoryRow({ p, manyRepos }: { p: PrEntry; manyRepos: boolean }) {
  const [owner = '', name = ''] = p.repo.split('/');
  // An audit's fix lives on its audit screen; every other pull request opens its review page, which
  // says what it is when it has no proposal (a first plan, another fix).
  const href = p.kind === 'auditFix' ? auditPath({ owner, repo: name }) : reviewPath({ owner, repo: name, number: p.number });
  return (
    <tr>
      <td className={t2.main}>
        <Link href={href} className={t2.link}>
          {p.title} <span className={s.muted}>#{p.number}</span>
        </Link>
      </td>
      {manyRepos ? (
        <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
          {p.repo}
        </td>
      ) : null}
      <td className={t2.faint} style={{ whiteSpace: 'nowrap' }}>
        <When iso={p.createdAt} day />
      </td>
      {/* What Datalyze made of it is the chip's tooltip: the checks are the column. */}
      <td title={p.description}>
        <Chip tone={CHECKS_TONE[p.checks]}>
          <C k={`inbox.history.checks.${p.checks}`} />
        </Chip>
      </td>
      <td>
        <C k={p.neededPerson ? 'inbox.history.person.yes' : 'inbox.history.person.no'} />
      </td>
      <td>
        <Chip tone={PR_STATE_TONE[p.state]}>
          <C k={`inbox.history.states.${p.state}`} />
        </Chip>
      </td>
      <td>
        <span className={t2.cellActions}>
          <a href={p.url} target="_blank" rel="noopener noreferrer" className={`${a.button} ${t2.small}`}>
            <C k="inbox.history.github" />
          </a>
          <Link href={href} className={`${a.button} ${t2.small}`}>
            <C k="inbox.history.open" />
          </Link>
        </span>
      </td>
    </tr>
  );
}

function ProposalRow({ repo, p }: { repo: RepoFacts; p: OpenProposal }) {
  const [owner = '', name = ''] = repo.fullName.split('/');
  // A run going for it (a fix carrying on, an approval being built): it's building, whatever its status said.
  const state: ProposalState = repo.runs.some((x) => x.pr === p.number && active(x)) ? 'approved' : p.state;
  const title = (
    <>
      {p.title} <span className={s.muted}>#{p.number}</span>
    </>
  );
  const btn = `${a.button} ${t2.small} ${state === 'approved' ? '' : a.buttonPrimary}`;
  const label = <C k={`inbox.open.${state}`} />;
  return (
    <tr>
      <td className={t2.main}>
        {p.auditFix ? (
          <Link href={auditPath({ owner, repo: name })} className={t2.link}>
            {title}
          </Link>
        ) : p.fix ? (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className={t2.link}>
            {title}
          </a>
        ) : (
          <Link href={reviewPath({ owner, repo: name, number: p.number })} className={t2.link}>
            {title}
          </Link>
        )}
      </td>
      <td className={s.mono} style={{ whiteSpace: 'nowrap' }}>
        {repo.fullName}
      </td>
      <td>
        <Chip tone={TONE[state]}>
          <C k={`inbox.states.${state}`} />
        </Chip>
      </td>
      <td>@{p.author.replace(/\[bot\]$/, '')}</td>
      <td className={t2.faint}>{p.since ? <When iso={p.since} day /> : ''}</td>
      <td>
        <span className={t2.cellActions}>
          {p.auditFix ? (
            <Link href={auditPath({ owner, repo: name })} className={btn}>
              {label}
            </Link>
          ) : p.fix ? (
            <a href={p.url} target="_blank" rel="noopener noreferrer" className={btn}>
              {label}
            </a>
          ) : (
            <Link href={reviewPath({ owner, repo: name, number: p.number })} className={btn}>
              {label}
            </Link>
          )}
        </span>
      </td>
    </tr>
  );
}

function PasteLink() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ref = parsePrLink(value);
    if (!ref) return setBad(true);
    router.push(reviewPath(ref));
  };
  return (
    <form className={`${a.card} ${s.paste}`} onSubmit={submit}>
      <label className={a.fieldLabel}>
        <C k="inbox.pasteLabel" />
        <input
          className={a.input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setBad(false);
          }}
          placeholder={t('inbox.pastePlaceholder')}
          inputMode="url"
          aria-invalid={bad}
          aria-describedby={bad ? 'paste-error' : undefined}
        />
      </label>
      <button type="submit" className={a.button}>
        <C k="inbox.pasteButton" />
      </button>
      {bad ? (
        <p id="paste-error" className={a.error} role="alert" style={{ flexBasis: '100%' }}>
          <C k="inbox.pasteError" />
        </p>
      ) : null}
    </form>
  );
}

/** Why an organisation's repos may be hidden (GitHub's OAuth app access restrictions), and what its admin does. */
export function RestrictedHelp({ restricted }: { restricted: string[] }) {
  return (
    <details className={s.help} open={restricted.length > 0}>
      <summary>
        <C k="inbox.restricted.title" />
      </summary>
      {restricted.length ? <C k="inbox.restricted.found" as="p" vars={{ orgs: restricted.join(', ') }} /> : null}
      <C k="inbox.restricted.body" as="p" />
      <ol>
        <C k="inbox.restricted.steps.0" as="li" />
        <C k="inbox.restricted.steps.1" as="li" />
        <C k="inbox.restricted.steps.2" as="li" />
      </ol>
      <C k="inbox.restricted.meanwhile" as="p" />
    </details>
  );
}
