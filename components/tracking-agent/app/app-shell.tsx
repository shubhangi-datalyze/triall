'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AccountShell } from '@/components/account/account-shell';
import { DashboardGate } from '@/components/tracking-agent/onboarding/onboarding';
import { PLAN_PATH, VERIFY_PATH } from '@/lib/tracking-agent/verify';
import { AUDITS_PATH } from '@/lib/tracking-agent/audit';
import { SETUP_PAGE } from '@/lib/tracking-agent/repos';
import { TRACKING_ACCOUNT_ENDPOINT } from '@/lib/tracking-agent/app-account';
import { trackingAgentDashboardContent } from '@/lib/content/trackingAgentDashboard';
import { ClaudeCodeLauncher } from './claude-code';

/** Pages that render from fixtures with no sign-in, for /admin. */
const PREVIEWS = new Set(['/tracking-agent/dashboard/preview']);

/**
 * The paid app's frame: the shared Datalyze shell with a
 * sidebar (Audits, Plan, Verification, Pull requests, Setup under the Tracking Agent;
 * Billing is the shared /billing), behind the routing gate, so unpaid accounts
 * go back to onboarding. Used by the shared layout of /tracking-agent/audits,
 * /tracking-agent/setup and the review pages (app/tracking-agent/(app)/layout.tsx),
 * ungated on the review pages for an owner with live access. It loads the
 * account with onboarding and the GitHub sign-in in one call (lib/tracking-agent/app-account.ts).
 */
export function TrackingAgentApp({ children, gated = true }: { children: ReactNode; gated?: boolean }) {
  const nav = trackingAgentDashboardContent.nav;
  const pathname = usePathname();
  if (PREVIEWS.has(pathname)) return <>{children}</>;
  return (
    <AccountShell
      place="tracking_agent"
      endpoint={TRACKING_ACCOUNT_ENDPOINT}
      links={[
        { href: AUDITS_PATH, label: nav.audits, ck: 'nav.audits' },
        { href: PLAN_PATH, label: nav.plan, ck: 'nav.plan' },
        { href: VERIFY_PATH, label: nav.verify, ck: 'nav.verify' },
        { href: '/tracking-agent/review', label: nav.review, ck: 'nav.review' },
        { href: SETUP_PAGE, label: nav.setup, ck: 'nav.setup' },
      ]}
    >
      {gated ? <DashboardGate>{children}</DashboardGate> : children}
      <ClaudeCodeLauncher />
    </AccountShell>
  );
}
