'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import a from '@/components/account/account.module.css';
import { useAccount } from '@/components/account/account-shell';
import { rich } from '@/lib/content/rich';
import { trackingAgentDashboardContent } from '@/lib/content/trackingAgentDashboard';
import { workspaceAdmin } from '@/lib/tracking-agent/onboarding/flow';
import { createKey, type AuthHeader } from '@/lib/tracking-agent/setup/datalyze-api';
import { plain, T, text } from './shared';
import s from './claude-code.module.css';

const DOCS = '/tracking-agent/docs/claude-code';

/**
 * "Use in Claude Code": a button fixed to the bottom right of every signed-in Tracking Agent page
 * (rendered by the app shell), opening a popup with how to install the plugin on a laptop, a key
 * for it (REBUILD §5.3), and what to ask it.
 */
export function ClaudeCodeLauncher() {
  const { authHeader, account } = useAccount();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={s.launcher} onClick={() => setOpen(true)} aria-haspopup="dialog" data-ck="claudeCode.button">
        <TerminalIcon />
        {rich(text('claudeCode.button'))}
      </button>
      {open ? <ClaudeCodeDialog authHeader={authHeader} admin={workspaceAdmin(account)} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ClaudeCodeDialog({ authHeader, admin, onClose }: { authHeader: AuthHeader; admin: boolean; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} tabIndex={-1} className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="claude-code-title">
        <button type="button" className={s.close} onClick={onClose} aria-label={plain('claudeCode.close')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <ClaudeCodePanel authHeader={authHeader} admin={admin} titleId="claude-code-title" />
      </div>
    </div>
  );
}

/**
 * The popup's contents. `authHeader` null (the /admin preview): Make a key does nothing.
 */
export function ClaudeCodePanel({ authHeader, admin, titleId }: { authHeader: AuthHeader | null; admin: boolean; titleId?: string }) {
  const c = trackingAgentDashboardContent.claudeCode;
  return (
    <div className={s.panel}>
      <h2 id={titleId} className={s.title} data-ck="claudeCode.title">
        {rich(c.title)}
      </h2>
      <T k="claudeCode.intro" as="p" className={s.intro} />

      <section className={s.step}>
        <T k="claudeCode.install.title" as="h3" className={s.stepTitle} />
        <T k="claudeCode.install.body" as="p" className={s.body} />
        <Code k="claudeCode.install.code" />
        <T k="claudeCode.install.note" as="p" className={a.note} />
      </section>

      <section className={s.step}>
        <T k="claudeCode.key.title" as="h3" className={s.stepTitle} />
        <T k="claudeCode.key.body" as="p" className={s.body} />
        <KeyMaker authHeader={authHeader} admin={admin} />
      </section>

      <section className={s.step}>
        <T k="claudeCode.ask.title" as="h3" className={s.stepTitle} />
        <T k="claudeCode.ask.body" as="p" className={s.body} />
        <ul className={s.commands}>
          {c.ask.commands.map((cmd, i) => (
            <li key={i}>
              <code className={s.command} data-ck={`claudeCode.ask.commands.${i}.command`}>
                {cmd.command}
              </code>
              <span className={s.body} data-ck={`claudeCode.ask.commands.${i}.what`}>
                {rich(cmd.what)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Link href={DOCS} className={s.docs} data-ck="claudeCode.docs">
        {rich(c.docs)}
      </Link>
    </div>
  );
}

/** Make a key (shown once, as on Setup), then the export line to copy. */
function KeyMaker({ authHeader, admin }: { authHeader: AuthHeader | null; admin: boolean }) {
  const [state, setState] = useState<{ phase: 'idle' | 'busy' | 'failed' } | { phase: 'shown'; key: string }>({ phase: 'idle' });
  const make = () => {
    if (!authHeader) return;
    setState({ phase: 'busy' });
    createKey(authHeader).then(
      ({ key }) => setState({ phase: 'shown', key }),
      () => setState({ phase: 'failed' }),
    );
  };
  if (state.phase === 'shown') {
    return (
      <>
        <Code value={`export DATALYZE_KEY=${state.key}`} />
        <T k="claudeCode.key.shown" as="p" className={a.notice} />
      </>
    );
  }
  if (!admin) return <T k="claudeCode.key.adminOnly" as="p" className={a.note} />;
  return (
    <>
      <button type="button" className={`${a.button} ${a.buttonPrimary}`} onClick={make} disabled={state.phase === 'busy' || !authHeader} data-ck={state.phase === 'busy' ? 'claudeCode.key.busy' : 'claudeCode.key.button'}>
        {rich(text(state.phase === 'busy' ? 'claudeCode.key.busy' : 'claudeCode.key.button'))}
      </button>
      {state.phase === 'failed' ? <T k="claudeCode.key.failed" as="p" className={a.error} /> : null}
    </>
  );
}

/** A code block with a Copy button: content from `k`, or a literal `value`. */
function Code({ k, value }: { k?: string; value?: string }) {
  const body = value ?? text(k!);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(body).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };
  return (
    <div className={s.code}>
      <pre data-ck={k}>{body}</pre>
      <button type="button" className={s.copy} onClick={copy} data-ck={copied ? 'claudeCode.copied' : 'claudeCode.copy'}>
        {rich(text(copied ? 'claudeCode.copied' : 'claudeCode.copy'))}
      </button>
    </div>
  );
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17l6-5-6-5" />
      <path d="M12 19h8" />
    </svg>
  );
}
