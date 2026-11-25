'use client';

import { useState } from 'react';
import type { GhRepo } from '@/lib/tracking-agent/github/client';
import { analyticsReady, analyticsSecretNames, appInstallUrl, modelReady, onboardingDraft } from '@/lib/tracking-agent/onboarding/flow';
import type { Draft, SecretValues } from '@/lib/tracking-agent/setup/draft';
import { AnalyticsScreen, ContextScreen, FirstAuditScreen, GitHubScreen, InstallScreen, ModelScreen, PayScreen, ReposScreen, SetupPrScreen, SheetScreen } from './screens';
import s from './onboarding.module.css';

/**
 * Every onboarding screen from fixtures (/tracking-agent/start/preview), for
 * the /admin editor: no sign-in, no GitHub, nothing saved. The fields work,
 * so each screen's states can be seen.
 */

const repo = (id: number, name: string, extra: Partial<GhRepo> = {}): GhRepo => ({
  id,
  name,
  full_name: `acme/${name}`,
  owner: { login: 'acme', id: 1, type: 'Organization' },
  private: true,
  archived: false,
  default_branch: 'main',
  pushed_at: null,
  permissions: { admin: true, push: true, pull: true },
  ...extra,
});

const REPOS = [repo(101, 'web'), repo(102, 'api'), repo(103, 'mobile', { private: false }), repo(104, 'docs'), repo(105, 'checkout-service'), repo(106, 'marketing-site')];
const noop = () => undefined;
const SERVICE_ACCOUNT = 'datalyze@datalyze-sheets.iam.gserviceaccount.com';
const SHEET = {
  githubRepoId: 101,
  spreadsheetId: '1abcDEFghiJKLmnoPQRstuVWXyz0123456789',
  url: 'https://docs.google.com/spreadsheets/d/1abcDEFghiJKLmnoPQRstuVWXyz0123456789/edit',
  title: 'Acme tracking plan',
  sharedBy: 'priya@acme.com',
  connectedAt: '2026-10-28T10:00:00Z',
  lastSyncAt: null,
  lastSyncError: null,
};
const sheetProps = { onUrl: noop, onConnect: noop, onChange: noop, onDisconnect: noop, onBack: noop, onContinue: noop };

export function OnboardingPreview() {
  const [picked, setPicked] = useState<number[]>([101, 102]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>(() => ({ ...onboardingDraft(), analytics: { tool: 'mixpanel', region: 'eu', projectId: '123456' } }));
  const [values, setValues] = useState<SecretValues>({});
  const setValue = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));
  const choice = { draft, setDraft, values, setValue, onBack: noop, onContinue: noop };

  return (
    <div className={s.previewStack}>
      <GitHubScreen session={null} needsScopes={false} working={false} error={null} onConnect={noop} onSwitch={noop} onContinue={noop} />
      <GitHubScreen session={{ login: 'octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/583231' }} needsScopes={false} working={false} error={null} onConnect={noop} onSwitch={noop} onContinue={noop} />
      <GitHubScreen session={null} needsScopes={false} working={false} error="startFailed" onConnect={noop} onSwitch={noop} onContinue={noop} />
      <ReposScreen
        repos={REPOS}
        failed={false}
        onRetry={noop}
        picked={picked}
        onToggle={(id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
        query={query}
        onQuery={setQuery}
        onBack={noop}
        onContinue={noop}
        planLimited={[102]}
      />
      <ModelScreen {...choice} ready={modelReady(draft, values)} />
      <ModelScreen {...choice} ready={false} keysAgain />
      <AnalyticsScreen {...choice} secretNames={analyticsSecretNames(draft)} ready={analyticsReady(draft, values)} onSkip={noop} />
      <AnalyticsScreen
        {...choice}
        draft={{ ...draft, analytics: { tool: 'mixpanel', region: 'eu', projectId: 'acme-prod' } }}
        values={{ MIXPANEL_SA_USERNAME: 'datalyze', MIXPANEL_SA_SECRET: 'datalyze.123456.mp-service-account' }}
        secretNames={['MIXPANEL_SA_USERNAME', 'MIXPANEL_SA_SECRET']}
        ready={false}
        keysAgain
        check={{ state: 'refused', status: 401 }}
        onSkip={noop}
      />
      <SheetScreen {...sheetProps} serviceAccount={SERVICE_ACCOUNT} rows={[{ id: 101, name: 'acme/web', url: '', busy: false }]} />
      <SheetScreen
        {...sheetProps}
        serviceAccount={SERVICE_ACCOUNT}
        rows={[
          { id: 101, name: 'acme/web', url: SHEET.url, busy: false, sheet: SHEET },
          { id: 102, name: 'acme/api', url: 'https://docs.google.com/spreadsheets/d/1zyx/edit', busy: false, problem: 'viewOnly' },
          { id: 103, name: 'acme/mobile', url: 'https://docs.google.com/spreadsheets/d/1qrs/edit', busy: false, problem: 'notShared' },
        ]}
      />
      <SheetScreen {...sheetProps} serviceAccount={null} rows={[]} />
      <ContextScreen draft={draft} setDraft={setDraft} onBack={noop} onContinue={noop} />
      <InstallScreen
        started
        onStart={noop}
        app={{ state: 'waiting', missing: ['acme/api'] }}
        owner="acme"
        installUrl={appInstallUrl(1, [101, 102])}
        onRecheck={noop}
        repos={[
          { id: 101, name: 'acme/web', state: 'done' },
          { id: 102, name: 'acme/api', state: 'failed', error: 'errorForbidden' },
        ]}
        onRetry={noop}
        valuesGone={false}
        onBackToModel={noop}
        done={false}
        onBack={noop}
        onContinue={noop}
      />
      <InstallScreen started={false} onStart={noop} app={{ state: 'waiting', missing: [] }} installUrl="#" onRecheck={noop} repos={[]} onRetry={noop} valuesGone onBackToModel={noop} done={false} onBack={noop} onContinue={noop} />
      <InstallScreen started={false} onStart={noop} app={{ state: 'done', missing: [] }} installUrl="#" onRecheck={noop} repos={[]} onRetry={noop} valuesGone returned onBackToModel={noop} done={false} onBack={noop} onContinue={noop} />
      <SetupPrScreen
        rows={[
          { id: 101, name: 'acme/web', opening: false, failed: false, pr: { number: 42, url: '#' }, run: { state: 'started', url: '#' }, connections: { model: { state: 'ok' }, analytics: { state: 'unchecked', detail: 'Mixpanel /api/query/events/names answered 503: Service Unavailable' } } },
          { id: 102, name: 'acme/api', opening: false, failed: false, pr: { number: 7, url: '#' }, run: { state: 'failed', url: '#' }, connections: { model: { state: 'unchecked' }, analytics: { state: 'unchecked' } } },
          { id: 103, name: 'acme/mobile', opening: true, failed: false },
          { id: 104, name: 'acme/docs', opening: false, failed: true },
          { id: 105, name: 'acme/site', opening: false, failed: true, linkProblem: 'noGithub' },
          { id: 106, name: 'acme/ios', opening: false, failed: true, linkProblem: 'notMaintainer' },
          { id: 107, name: 'acme/android', opening: false, failed: true, linkProblem: 'notFound' },
          { id: 108, name: 'acme/infra', opening: false, failed: true, linkProblem: 'unchecked' },
        ]}
        draftGone={false}
        onBackToModel={noop}
        onRetry={noop}
        toFix={{ model: false, analytics: false }}
        fix={null}
        onFix={noop}
        onCheckAgain={noop}
        done={false}
        onBack={noop}
        onContinue={noop}
      />
      <SetupPrScreen
        rows={[
          { id: 101, name: 'acme/web', opening: false, failed: false, pr: { number: 42, url: '#' }, run: { state: 'started', url: '#' }, connections: { model: { state: 'ok' }, analytics: { state: 'failed', detail: 'Mixpanel refused the key (401)' } } },
          { id: 102, name: 'acme/api', opening: false, failed: false, pr: { number: 7, url: '#' }, run: { state: 'running', url: '#' }, connections: { model: { state: 'checking' }, analytics: { state: 'checking' } } },
        ]}
        draftGone={false}
        onBackToModel={noop}
        onRetry={noop}
        toFix={{ model: false, analytics: true }}
        fix={null}
        onFix={noop}
        onCheckAgain={null}
        done
        onBack={noop}
        onContinue={noop}
      />
      <SetupPrScreen
        rows={[{ id: 101, name: 'acme/web', opening: false, failed: false, pr: { number: 42, url: '#' }, run: { state: 'started', url: '#' }, connections: { model: { state: 'failed', detail: 'anthropic: 401 invalid x-api-key' }, analytics: { state: 'ok' } } }]}
        draftGone={false}
        onBackToModel={noop}
        onRetry={noop}
        toFix={{ model: true, analytics: false }}
        fix={{ kind: 'model', ...choice, ready: modelReady(draft, values), secretNames: [], saving: false, saveFailed: false, onSave: noop, onCancel: noop }}
        onFix={noop}
        onCheckAgain={null}
        done
        onBack={noop}
        onContinue={noop}
      />
      <PayScreen busy={false} message={null} onPay={noop} onBack={noop} />
      <PayScreen busy={false} message="pending" onPay={noop} onBack={noop} />
      <FirstAuditScreen rows={[{ id: 101, name: 'acme/web', state: 'ready' }]} onRun={noop} onOpen={noop} onCheckAgain={noop} />
      <FirstAuditScreen rows={[{ id: 101, name: 'acme/web', state: 'unmerged', setupPr: { number: 12, url: 'https://github.com/acme/web/pull/12' } }, { id: 102, name: 'acme/api', state: 'started' }]} onRun={noop} onOpen={noop} onCheckAgain={noop} />
    </div>
  );
}
