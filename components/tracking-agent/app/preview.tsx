'use client';

import a from '@/components/account/account.module.css';
import { PREVIEW_REPOS } from '@/lib/tracking-agent/fixtures';
import { actionItems, type RepoFacts } from '@/lib/tracking-agent/repos';
import type { TeamView } from '@/lib/tracking-agent/setup/datalyze-api';
import { ClaudeCodePanel } from './claude-code';
import { AuditsPreview } from './audits';
import { GitHubCard } from './shared';
import { SetupView } from './setup';
import { TeamSection } from './team';

/**
 * The paid app's Audits and Setup pages from fixtures (/tracking-agent/dashboard/preview), for
 * the /admin editor: no sign-in, no GitHub, nothing written. A repo per stage, so each state shows.
 */

const repo = (id: number, name: string, over: Partial<RepoFacts>): RepoFacts => ({
  ...PREVIEW_REPOS[0]!,
  id,
  fullName: `acme/${name}`,
  htmlUrl: `https://github.com/acme/${name}`,
  proposals: [],
  runs: [],
  ...over,
});

const REPOS: RepoFacts[] = [
  ...PREVIEW_REPOS,
  // Still on v1: Update the workflow moves it to the plugin.
  repo(103, 'api', { workflow: 'v1', checksRequired: false }),
  // Set up, the first audit not run yet; and one whose first audit failed.
  repo(104, 'checkout-service', { hasPlan: false, latestAudit: null }),
  repo(105, 'billing', {
    hasPlan: false,
    latestAudit: null,
    runs: [{ id: 9, job: 'audit', pr: null, findings: [], state: 'failed', conclusion: 'failure', url: '#', actor: 'priya', event: 'workflow_dispatch', createdAt: '2026-11-03T09:00:00Z', title: '' }],
  }),
  // The setup pull request open; and one closed unmerged.
  repo(106, 'marketing-site', { configOnDefault: false, config: null, hasPlan: false, setupPr: { state: 'open', url: '#', number: 3 }, latestAudit: null }),
  repo(107, 'docs', { configOnDefault: false, config: null, hasPlan: false, setupConfig: 'registry: analytics/registry\n', setupPr: { state: 'closed', url: '#', number: 4 }, latestAudit: null }),
  // GitHub didn't answer: its config, so where it stands; and its runs and audit, so its status.
  repo(108, 'admin-panel', { unread: ['config'], configOnDefault: false, config: null, hasPlan: false, latestAudit: null }),
  repo(109, 'search', { unread: ['runs', 'audit'], latestAudit: null }),
];

const noop = () => undefined;

const TEAM: TeamView = {
  role: 'owner',
  you: 'u1',
  workspace: 'acme.com',
  people: [
    { userId: 'u1', email: 'priya@acme.com', role: 'owner', joinedAt: '2026-10-01T09:00:00Z' },
    { userId: 'u2', email: 'dev-lead@acme.com', role: 'admin', joinedAt: '2026-10-12T09:00:00Z' },
    { userId: 'u3', email: 'maria@acme.com', role: 'member', joinedAt: '2026-10-20T09:00:00Z' },
  ],
  invites: [{ id: 'i1', email: 'sam@acme.com', role: 'member', createdAt: '2026-10-27T09:00:00Z' }],
  inviteLink: 'https://www.joindatalyze.com/account/signup?next=%2Ftracking-agent%2Faudits&invite=sam%40acme.com',
};

export function AppPreview() {
  return (
    <main className={a.main}>
      <AuditsPreview items={actionItems({ repos: REPOS, paymentFailed: true })} repos={REPOS} />
      <hr style={{ margin: '64px 0', border: 0, borderTop: '1px solid var(--border-default)' }} />
      {/* The GitHub sign-in couldn't be checked (never shown as Connect GitHub). */}
      <GitHubCard returnTo="/tracking-agent/audits" unknown onRetry={noop} />
      <hr style={{ margin: '64px 0', border: 0, borderTop: '1px solid var(--border-default)' }} />
      <SetupView repos={REPOS} unread={1} gh={null} login="octocat" authHeader={null} onChanged={noop} preview={{ appInstalled: 4, modelSaved: '2026-10-20T12:00:00Z', analyticsSaved: '2026-10-20T12:00:00Z', sheet: false }} />
      {/* The Team section as an admin sees it, just after an invite with no email sent; then as a member. */}
      <TeamSection authHeader={null} preview={{ team: TEAM, invited: { email: 'sam@acme.com', emailed: false, link: TEAM.inviteLink } }} />
      <TeamSection authHeader={null} preview={{ team: { ...TEAM, role: 'member', you: 'u3' } }} />
      {/* The "Use in Claude Code" popup, as an admin sees it (the button is fixed to the page's corner). */}
      <hr style={{ margin: '64px 0', border: 0, borderTop: '1px solid var(--border-default)' }} />
      <section className={a.card} style={{ maxWidth: 560 }}>
        <ClaudeCodePanel authHeader={null} admin />
      </section>
    </main>
  );
}
