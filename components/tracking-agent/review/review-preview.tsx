'use client';

import { useMemo, useState } from 'react';
import a from '@/components/account/account.module.css';
import { PREVIEW_AUDIT, PREVIEW_PLAN, PREVIEW_REPOS, PREVIEW_RUN, PREVIEW_SCREENS, PREVIEW_VERIFY, previewReview, type PreviewScreen } from '@/lib/tracking-agent/fixtures';
import type { SaveResult } from '@/lib/tracking-agent/review/proposal';
import { AuditView } from './audit-view';
import { C, t } from './copy';
import { InboxView } from './inbox-view';
import { PlanView } from './plan-view';
import { ProposalScreen } from './proposal-screen';
import { RunScreen } from './run-view';
import { viewOf } from '@/lib/tracking-agent/verify-runs/view';
import type { Step } from '@/lib/tracking-agent/verify-runs/record';
import { VerifyView } from './verify-view';
import s from './review.module.css';

/**
 * /tracking-agent/review/preview: each review screen from fixtures, switchable with tabs. /admin
 * previews the copy here, and it's how the screens can be checked without a GitHub sign-in.
 * Nothing is sent.
 */
export function ReviewPreview() {
  const [screen, setScreen] = useState<PreviewScreen>('awaiting');
  const data = useMemo(() => (screen === 'inbox' || screen === 'audit' || screen === 'plan' || screen === 'verify' || screen === 'run' ? null : previewReview(screen)), [screen]);
  const fake = async (): Promise<SaveResult> => ({ ok: true, commit: null, dropped: [], merged: false });

  return (
    <>
      <C k="preview.note" as="p" className={`${a.notice} ${s.previewNote}`} />
      <div className={a.tabs} role="tablist" aria-label={t('preview.tabsLabel')}>
        {PREVIEW_SCREENS.map((key) => (
          <button key={key} type="button" role="tab" aria-selected={screen === key} className={`${a.tab} ${screen === key ? a.tabActive : ''}`} onClick={() => setScreen(key)}>
            <C k={`preview.tabs.${key}`} />
          </button>
        ))}
      </div>
      <div role="tabpanel" style={{ marginTop: 32 }}>
        {screen === 'inbox' ? (
          <InboxView repos={PREVIEW_REPOS} />
        ) : screen === 'plan' ? (
          <PlanView data={PREVIEW_PLAN} />
        ) : screen === 'verify' ? (
          <VerifyView data={PREVIEW_VERIFY} onRun={async (what) => ({ sent: what })} onFixAnswer={async () => null} copy={async () => {}} />
        ) : screen === 'run' ? (
          <RunScreen
            owner="acme"
            repo="shop"
            data={PREVIEW_RUN}
            view={viewOf(PREVIEW_RUN.run.shards, PREVIEW_RUN.rows as Step[])}
            // The live browser isn't shown here: there's no real session.
            actions={{ stop: async () => {}, send: async () => true, live: async () => null }}
          />
        ) : screen === 'audit' ? (
          <AuditView data={PREVIEW_AUDIT} login="ana" onRun={async (what) => ({ sent: what })} onFixAnswer={async () => null} />
        ) : data ? (
          <ProposalScreen key={screen} data={data} onSave={fake} onContinue={async () => true} />
        ) : null}
      </div>
    </>
  );
}
