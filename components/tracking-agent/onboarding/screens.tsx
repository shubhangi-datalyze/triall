'use client';

import { useState, type ReactNode } from 'react';
import account from '@/components/account/account.module.css';
import { rich, stripRich } from '@/lib/content/rich';
import { trackingAgentOnboardingContent } from '@/lib/content/trackingAgentOnboarding';
import type { GhRepo } from '@/lib/tracking-agent/github/client';
import { ANALYTICS_REGIONS, contextAnswers, STEPS, type Connection, type Connections, type ConnectionState, type RunState, type StepId } from '@/lib/tracking-agent/onboarding/flow';
import type { LinkProblem, SheetProblem, SheetView } from '@/lib/tracking-agent/setup/datalyze-api';
import { analyticsFormatIssues } from '@/lib/tracking-agent/setup/check-analytics';
import type { Draft, SecretValues } from '@/lib/tracking-agent/setup/draft';
import { MODEL_KEY, type AnalyticsTool } from '@/tracking-agent/src/setup/core';
import { Button, Field, fill } from '../setup/ui';
import s from './onboarding.module.css';

/**
 * The nine onboarding screens, drawn from plain props so the
 * live flow (onboarding.tsx) and the /admin preview (preview.tsx) render the
 * same thing. Copy: content/tracking-agent-onboarding.json.
 */

const C = trackingAgentOnboardingContent;

// ---- the frame ------------------------------------------------------------------------------

export function Progress({ step }: { step: StepId }) {
  const n = STEPS.indexOf(step);
  const meta = fill(C.page.stepOf, { n: n + 1, total: STEPS.length });
  return (
    <nav className={s.progress} aria-label={stripRich(meta)}>
      <span className={s.progressMeta} data-ck="page.stepOf">
        {rich(meta)}
      </span>
      <ol className={s.track}>
        {STEPS.map((id, i) => (
          <li
            key={id}
            className={`${s.segment}${i < n ? ` ${s.segmentDone}` : ''}${i === n ? ` ${s.segmentCurrent}` : ''}`}
            aria-current={i === n ? 'step' : undefined}
            title={stripRich(C.page.steps[i]!.label)}
          />
        ))}
      </ol>
    </nav>
  );
}

/** One screen: the progress line and a centred card with its title, its body (and `points` under it, a list), the content and the buttons. */
export function Screen({ step, ck, title, body, points, children, foot }: { step: StepId; ck: string; title: string; body: string; points?: string[]; children?: ReactNode; foot: ReactNode }) {
  return (
    <div className={s.frame}>
      <Progress step={step} />
      <section className={`${account.card} ${s.card}`}>
        <header className={s.head}>
          <h1 className={s.title} data-ck={`${ck}.title`}>
            {rich(title)}
          </h1>
          <p className={s.body} data-ck={`${ck}.body`}>
            {rich(body)}
          </p>
          {points?.length ? (
            <ul className={s.points}>
              {points.map((point, i) => (
                <li key={i} data-ck={`${ck}.points.${i}`}>
                  {rich(point)}
                </li>
              ))}
            </ul>
          ) : null}
        </header>
        {children ? <div className={s.content}>{children}</div> : null}
        <div className={s.foot}>{foot}</div>
      </section>
    </div>
  );
}

function Foot({ onBack, children }: { onBack?: () => void; children?: ReactNode }) {
  return (
    <>
      {onBack ? (
        <button type="button" className={account.linkButton} onClick={onBack} data-ck="page.back">
          {rich(C.page.back)}
        </button>
      ) : null}
      <div className={s.footRight}>{children}</div>
    </>
  );
}

function Select({ label, ck, value, options, optionsCk, onChange }: { label: string; ck: string; value: string; options: { id: string; label: string }[]; optionsCk: string; onChange: (id: string) => void }) {
  return (
    <label className={account.fieldLabel}>
      <span data-ck={ck}>{rich(label)}</span>
      <select className={`${account.input} ${s.select}`} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o, i) => (
          <option key={o.id} value={o.id} data-ck={`${optionsCk}.${i}.label`}>
            {stripRich(o.label)}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---- 1. GitHub --------------------------------------------------------------------------------

export type GitHubScreenProps = {
  session: { login: string; avatarUrl: string } | null;
  needsScopes: boolean;
  working: boolean;
  error: 'notConfigured' | 'startFailed' | null;
  onConnect: () => void;
  onSwitch: () => void;
  onContinue: () => void;
};

export function GitHubScreen(p: GitHubScreenProps) {
  const ok = Boolean(p.session && !p.needsScopes);
  return (
    <Screen
      step="github"
      ck="github"
      title={C.github.title}
      body={C.github.body}
      foot={
        <Foot>
          {ok ? (
            <Button primary onClick={p.onContinue} ck="github.continue">
              {rich(C.github.continue)}
            </Button>
          ) : (
            <Button primary onClick={p.onConnect} disabled={p.working} ck={p.working ? 'github.working' : p.error ? 'github.retry' : 'github.button'}>
              {rich(p.working ? C.github.working : p.error ? C.github.retry : C.github.button)}
            </Button>
          )}
        </Foot>
      }
    >
      {p.session && ok ? (
        <div className={s.connected}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.avatar} src={p.session.avatarUrl} alt="" />
          <span data-ck="github.connected">{rich(fill(C.github.connected, { login: p.session.login }))}</span>
        </div>
      ) : null}
      {p.session && p.needsScopes ? (
        <p className={account.notice} data-ck="github.needsScopes">
          {rich(C.github.needsScopes)}
        </p>
      ) : null}
      {p.error ? (
        <p className={account.error} role="alert" data-ck={`github.${p.error}`}>
          {rich(C.github[p.error])}
        </p>
      ) : null}
      {p.session ? (
        <button type="button" className={account.linkButton} onClick={p.onSwitch} data-ck="github.switchAccount">
          {rich(C.github.switchAccount)}
        </button>
      ) : null}
    </Screen>
  );
}

// ---- 2. Repos ---------------------------------------------------------------------------------

export type ReposScreenProps = {
  repos: GhRepo[] | null;
  failed: boolean;
  onRetry: () => void;
  picked: number[];
  onToggle: (id: number) => void;
  query: string;
  onQuery: (q: string) => void;
  onBack: () => void;
  onContinue: () => void;
  /** Picked private repos whose owner's GitHub plan can't require checks (rulesetsAllowed). */
  planLimited?: number[];
};

/** Repos the person can admin and that aren't archived: setup has to add secrets. */
export const adminRepos = (repos: GhRepo[]) => repos.filter((r) => !r.archived && r.permissions?.admin);

export function ReposScreen(p: ReposScreenProps) {
  const usable = p.repos ? adminRepos(p.repos) : [];
  const q = p.query.trim().toLowerCase();
  const shown = q ? usable.filter((r) => r.full_name.toLowerCase().includes(q)) : usable;
  const owner = usable.find((r) => p.picked.includes(r.id))?.owner.login ?? null;
  const n = p.picked.length;
  return (
    <Screen
      step="repos"
      ck="repos"
      title={C.repos.title}
      body={C.repos.body}
      foot={
        <Foot onBack={p.onBack}>
          <Button primary disabled={!n} onClick={p.onContinue} ck={n === 1 ? 'repos.continueOne' : 'repos.continue'}>
            {rich(n === 1 ? C.repos.continueOne : fill(C.repos.continue, { n }))}
          </Button>
        </Foot>
      }
    >
      {p.failed ? (
        <div>
          <p className={account.error} role="alert" data-ck="repos.failed">
            {rich(C.repos.failed)}
          </p>
          <button type="button" className={account.linkButton} onClick={p.onRetry} data-ck="repos.retry">
            {rich(C.repos.retry)}
          </button>
        </div>
      ) : !p.repos ? (
        <p className={s.hint} data-ck="repos.loading">
          {rich(C.repos.loading)}
        </p>
      ) : !usable.length ? (
        <p className={s.hint} data-ck="repos.none">
          {rich(C.repos.none)}
        </p>
      ) : (
        <>
          <input className={account.input} type="search" value={p.query} onChange={(e) => p.onQuery(e.target.value)} placeholder={stripRich(C.repos.search)} aria-label={stripRich(C.repos.search)} data-ck="repos.search" />
          {p.planLimited?.some((id) => p.picked.includes(id)) ? (
            <p className={account.note} data-ck="repos.planNote">
              {rich(C.repos.planNote)}
            </p>
          ) : null}
          {owner ? (
            <p className={s.hint} data-ck="repos.otherOwner">
              {rich(fill(C.repos.otherOwner, { owner }))}
            </p>
          ) : null}
          {n ? (
            <p className={s.hint} data-ck="repos.chosen">
              {/* Full names, so web and web-e2e can't be mistaken for each other. */}
              {rich(fill(C.repos.chosen, { repos: usable.filter((r) => p.picked.includes(r.id)).map((r) => `\`${r.full_name}\``).join(', ') }))}
            </p>
          ) : null}
          {shown.length ? (
            <ul className={s.list}>
              {shown.map((r) => {
                const off = Boolean(owner && r.owner.login !== owner);
                return (
                  <li key={r.id}>
                    <label className={`${s.repo}${off ? ` ${s.repoOff}` : ''}`}>
                      <input type="checkbox" checked={p.picked.includes(r.id)} disabled={off} onChange={() => p.onToggle(r.id)} />
                      <span className={s.repoName} title={r.full_name}>
                        {r.full_name}
                      </span>
                      {r.private ? (
                        <span className={account.badge} data-ck="repos.private">
                          {rich(C.repos.private)}
                        </span>
                      ) : null}
                      {p.planLimited?.includes(r.id) ? (
                        <span className={account.badge} data-ck="repos.planBadge">
                          {rich(C.repos.planBadge)}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={s.hint} data-ck="repos.noMatch">
              {rich(C.repos.noMatch)}
            </p>
          )}
        </>
      )}
    </Screen>
  );
}

// ---- 3. Model ---------------------------------------------------------------------------------

export type ChoiceProps = {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  values: SecretValues;
  setValue: (name: string, value: string) => void;
  ready: boolean;
  onBack: () => void;
  onContinue: () => void;
  /** The choices came back from another tab or visit, but keys never do: say so. */
  keysAgain?: boolean;
};

export function ModelScreen(p: ChoiceProps) {
  return (
    <Screen
      step="model"
      ck="model"
      title={C.model.title}
      body={C.model.body}
      foot={
        <Foot onBack={p.onBack}>
          <Button primary disabled={!p.ready} onClick={p.onContinue} ck="model.continue">
            {rich(C.model.continue)}
          </Button>
        </Foot>
      }
    >
      {p.keysAgain && !p.values[MODEL_KEY]?.trim() ? (
        <p className={account.notice} data-ck="model.keysAgain">
          {rich(C.model.keysAgain)}
        </p>
      ) : null}
      <ModelFields draft={p.draft} setDraft={p.setDraft} values={p.values} setValue={p.setValue} />
    </Screen>
  );
}

/** The Anthropic API key (Claude only, REBUILD §2.6): onboarding's key screen, and changing a refused key on the Setup PR screen. */
export function ModelFields(p: Pick<ChoiceProps, 'draft' | 'setDraft' | 'values' | 'setValue'>) {
  // An organisation secret already holds the key: nothing to type here.
  if (p.draft.model.keyIn === 'org') return null;
  return (
    <div className={s.fields}>
      <Field label={C.model.keyLabel} ck="model.keyLabel" type="password" value={p.values[MODEL_KEY] ?? ''} onChange={(v) => p.setValue(MODEL_KEY, v)} placeholder="sk-ant-…" hint={C.model.keyHint} hintCk="model.keyHint" wide />
    </div>
  );
}

// ---- 4. Analytics -----------------------------------------------------------------------------

/** The keys tried from this browser on Continue (lib/tracking-agent/setup/check-analytics.ts). */
export type AnalyticsCheck = { state: 'idle' | 'checking' | 'unchecked' | 'ok' } | { state: 'refused'; status: number };

export function AnalyticsScreen(p: ChoiceProps & { secretNames: string[]; onSkip: () => void; check?: AnalyticsCheck }) {
  const tool = C.analytics.tools.find((t) => t.id === p.draft.analytics.tool)?.label ?? '';
  const check = p.check ?? { state: 'idle' };
  const keysMissing = p.secretNames.some((n) => !p.values[n]?.trim());
  return (
    <Screen
      step="analytics"
      ck="analytics"
      title={C.analytics.title}
      body={C.analytics.body}
      foot={
        <Foot onBack={p.onBack}>
          <button type="button" className={account.linkButton} onClick={p.onSkip} data-ck="analytics.skip">
            {rich(C.analytics.skip)}
          </button>
          <Button primary disabled={!p.ready || check.state === 'checking'} onClick={p.onContinue} ck="analytics.continue">
            {rich(C.analytics.continue)}
          </Button>
        </Foot>
      }
    >
      {p.keysAgain && p.draft.analytics.tool !== 'none' && keysMissing ? (
        <p className={account.notice} data-ck="analytics.keysAgain">
          {rich(C.analytics.keysAgain)}
        </p>
      ) : null}
      <AnalyticsFields draft={p.draft} setDraft={p.setDraft} values={p.values} setValue={p.setValue} secretNames={p.secretNames} />
      {check.state === 'checking' ? (
        <p className={s.hint} role="status" data-ck="analytics.checking">
          {rich(fill(C.analytics.checking, { tool }))}
        </p>
      ) : check.state === 'refused' ? (
        <p className={account.error} role="alert" data-ck={check.status === 401 ? 'analytics.refusedKey' : 'analytics.refusedAccess'}>
          {rich(fill(check.status === 401 ? C.analytics.refusedKey : C.analytics.refusedAccess, { tool, status: check.status }))}
        </p>
      ) : null}
    </Screen>
  );
}

/** The tool, its region and its key fields: onboarding's Analytics screen, and changing a refused key on the Setup PR screen. */
export function AnalyticsFields(p: Pick<ChoiceProps, 'draft' | 'setDraft' | 'values' | 'setValue'> & { secretNames: string[] }) {
  const a = p.draft.analytics;
  const setA = (patch: Partial<Draft['analytics']>) => p.setDraft((d) => ({ ...d, analytics: { ...d.analytics, ...patch } }));
  const regions: readonly string[] | undefined = a.tool !== 'none' ? ANALYTICS_REGIONS[a.tool] : undefined;
  const hintFor = (name: string) => C.analytics.keyHints.findIndex((h) => h.id === name);
  const projectHint = C.analytics.projectIdHints.findIndex((h) => h.id === a.tool);
  // Only a filled-in field is judged; an empty one isn't wrong, just not done.
  const issues = analyticsFormatIssues(p.draft, p.values);
  const issue = (field: string) => issues.find((x) => x.field === field)?.problem;
  const problem = (field: string) => {
    const k = issue(field);
    return k ? { error: C.analytics.formatProblems[k], errorCk: `analytics.formatProblems.${k}` } : {};
  };
  return (
    <>
      <Select
        label={C.analytics.toolLabel}
        ck="analytics.toolLabel"
        value={a.tool}
        options={C.analytics.tools}
        optionsCk="analytics.tools"
        onChange={(id) => p.setDraft((d) => ({ ...d, analytics: id === 'none' ? { tool: 'none' } : { tool: id as AnalyticsTool, region: 'us' } }))}
      />
      {regions ? (
        <>
          <div>
            <span className={s.label} data-ck="analytics.regionLabel">
              {rich(C.analytics.regionLabel)}
            </span>
            <div className={s.chips} role="radiogroup">
              {C.analytics.regions.map((r, i) =>
                regions.includes(r.id) ? (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={(a.region ?? 'us') === r.id}
                    className={`${s.chip}${(a.region ?? 'us') === r.id ? ` ${s.chipOn}` : ''}`}
                    onClick={() => setA({ region: r.id as 'us' | 'eu' | 'in' })}
                    data-ck={`analytics.regions.${i}.label`}
                  >
                    {rich(r.label)}
                  </button>
                ) : null,
              )}
            </div>
          </div>
          <div className={s.fields}>
            <Field
              label={C.analytics.projectId}
              ck="analytics.projectId"
              value={a.projectId ?? ''}
              onChange={(v) => setA({ projectId: v.trim() || undefined })}
              hint={projectHint >= 0 ? C.analytics.projectIdHints[projectHint]!.hint : undefined}
              hintCk={projectHint >= 0 ? `analytics.projectIdHints.${projectHint}.hint` : undefined}
              {...problem('projectId')}
            />
            {a.tool === 'posthog' || a.tool === 'amplitude' ? (
              <Field label={C.analytics.host} ck="analytics.host" value={a.host ?? ''} onChange={(v) => setA({ host: v.trim() || undefined })} placeholder="https://" />
            ) : null}
            {p.secretNames.map((name) => {
              const i = hintFor(name);
              return (
                <Field
                  key={name}
                  label={name}
                  mono
                  // A username isn't a secret: masking it only hides a typo.
                  type={/_USERNAME$/.test(name) ? 'text' : 'password'}
                  value={p.values[name] ?? ''}
                  onChange={(v) => p.setValue(name, v)}
                  hint={i >= 0 ? C.analytics.keyHints[i]!.hint : undefined}
                  hintCk={i >= 0 ? `analytics.keyHints.${i}.hint` : undefined}
                  {...problem(name)}
                  wide
                />
              );
            })}
          </div>
          <p className={s.hint} data-ck="analytics.keysNote">
            {rich(C.analytics.keysNote)}
          </p>
          {a.tool === 'amplitude' ? (
            <p className={s.hint} data-ck="analytics.amplitudeNote">
              {rich(C.analytics.amplitudeNote)}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

// ---- 5. Install -------------------------------------------------------------------------------

// ---- 5. Google Sheet (tracking-agent/SPEC.md, the Google Sheet) ---------------------------------------------------

/** One repo's line: the link typed, and the Sheet once connected or why Connect refused. */
export type SheetRow = { id: number; name: string; url: string; busy: boolean; sheet?: SheetView; problem?: SheetProblem; detail?: string; failed?: boolean };

const PROBLEM_KEY: Record<Exclude<SheetProblem, 'notConfigured'>, keyof typeof C.sheet> = {
  badUrl: 'problemBadUrl',
  notShared: 'problemNotShared',
  notASheet: 'problemNotASheet',
  viewOnly: 'problemViewOnly',
  writeFailed: 'problemWriteFailed',
  taken: 'problemTaken',
};

export type SheetFieldsProps = {
  /** The service account's email; null when the site has none yet. */
  serviceAccount: string | null;
  rows: SheetRow[];
  onUrl: (id: number, url: string) => void;
  onConnect: (id: number) => void;
  /** Change: back to the link field. */
  onChange: (id: number) => void;
  onDisconnect: (id: number) => void;
  /** Loading the Sheets failed: shown instead of the fields, with a retry. */
  loadFailed?: boolean;
  onRetry?: () => void;
};

/** Share with the service account, then a link per repo and Connect. Onboarding's Sheet screen and Setup's Google Sheet row. */
export function SheetFields(p: SheetFieldsProps) {
  const [copied, setCopied] = useState(false);
  if (p.loadFailed) {
    return (
      <div className={s.lineActions}>
        <span className={s.lineError} data-ck="sheet.loadFailed">
          {rich(C.sheet.loadFailed)}
        </span>
        {p.onRetry ? (
          <button type="button" className={account.linkButton} onClick={p.onRetry} data-ck="sheet.retry">
            {rich(C.sheet.retry)}
          </button>
        ) : null}
      </div>
    );
  }
  if (!p.serviceAccount) {
    return (
      <p className={account.notice} data-ck="sheet.notConfigured">
        {rich(C.sheet.notConfigured)}
      </p>
    );
  }
  const email = p.serviceAccount;
  const copy = () => {
    void navigator.clipboard?.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className={s.sheet}>
      <div>
        <p className={s.label} data-ck="sheet.shareStep">
          {rich(C.sheet.shareStep)}
        </p>
        <div className={s.lineActions}>
          <code className={`${s.mono} ${s.sheetEmail}`}>{email}</code>
          <button type="button" className={account.linkButton} onClick={copy} data-ck={copied ? 'sheet.copied' : 'sheet.copy'}>
            {rich(copied ? C.sheet.copied : C.sheet.copy)}
          </button>
        </div>
      </div>
      <p className={s.label} data-ck="sheet.pasteStep">
        {rich(C.sheet.pasteStep)}
      </p>
      <ul className={s.lines}>
        {p.rows.map((r) => (
          <li key={r.id} className={s.line}>
            {r.sheet ? (
              <>
                <div className={s.lineHead}>
                  <span data-ck="sheet.urlLabel">{rich(fill(C.sheet.urlLabel, { repo: r.name }))}</span>
                  <Pill state="done" />
                </div>
                <div className={s.lineActions}>
                  <span className={s.hint} data-ck="sheet.connected">
                    {rich(fill(C.sheet.connected, { title: r.sheet.title.replace(/[[\]]/g, ''), url: r.sheet.url }))}
                  </span>
                  <button type="button" className={account.linkButton} onClick={() => p.onChange(r.id)} data-ck="sheet.change">
                    {rich(C.sheet.change)}
                  </button>
                  <button type="button" className={account.linkButton} disabled={r.busy} onClick={() => p.onDisconnect(r.id)} data-ck="sheet.disconnect">
                    {rich(C.sheet.disconnect)}
                  </button>
                  {r.failed ? (
                    <span className={s.lineError} data-ck="sheet.failed">
                      {rich(C.sheet.failed)}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <Field
                  label={fill(C.sheet.urlLabel, { repo: r.name })}
                  ck="sheet.urlLabel"
                  value={r.url}
                  onChange={(v) => p.onUrl(r.id, v)}
                  placeholder={C.sheet.urlPlaceholder}
                  wide
                />
                <div className={s.lineActions}>
                  <Button primary disabled={!r.url.trim() || r.busy} onClick={() => p.onConnect(r.id)} ck={r.busy ? 'sheet.checking' : 'sheet.connect'}>
                    {rich(r.busy ? C.sheet.checking : C.sheet.connect)}
                  </Button>
                  {r.problem && r.problem !== 'notConfigured' ? (
                    <span className={s.lineError} data-ck={`sheet.${PROBLEM_KEY[r.problem]}`}>
                      {rich(fill(C.sheet[PROBLEM_KEY[r.problem]], { email, detail: r.detail ?? '' }))}
                    </span>
                  ) : r.problem === 'notConfigured' ? (
                    <span className={s.lineError} data-ck="sheet.notConfigured">
                      {rich(C.sheet.notConfigured)}
                    </span>
                  ) : r.failed ? (
                    <span className={s.lineError} data-ck="sheet.failed">
                      {rich(C.sheet.failed)}
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SheetScreen(p: SheetFieldsProps & { onBack: () => void; onContinue: () => void }) {
  const any = p.rows.some((r) => r.sheet);
  return (
    <Screen
      step="sheet"
      ck="sheet"
      title={C.sheet.title}
      body={C.sheet.body}
      foot={
        <Foot onBack={p.onBack}>
          {any ? null : (
            <button type="button" className={account.linkButton} onClick={p.onContinue} data-ck="sheet.skip">
              {rich(C.sheet.skip)}
            </button>
          )}
          <Button primary disabled={!any} onClick={p.onContinue} ck="sheet.continue">
            {rich(C.sheet.continue)}
          </Button>
        </Foot>
      }
    >
      <SheetFields {...p} />
      <p className={s.hint} data-ck="sheet.later">
        {rich(C.sheet.later)}
      </p>
    </Screen>
  );
}

// ---- 6. Context ------------------------------------------------------------------------------

/**
 * What the team tells the agent (`.datalyze/context.md`): each question starts with its default.
 * Continue keeps every answer as shown, defaults included, in the draft for the setup PR.
 */
export function ContextScreen(p: Pick<ChoiceProps, 'draft' | 'setDraft' | 'onBack' | 'onContinue'>) {
  const answers = contextAnswers(C.context.questions, p.draft.context);
  const set = (id: string, v: string) => p.setDraft((d) => ({ ...d, context: { ...contextAnswers(C.context.questions, d.context), [id]: v } }));
  return (
    <Screen
      step="context"
      ck="context"
      title={C.context.title}
      body={C.context.body}
      foot={
        <Foot onBack={p.onBack}>
          <Button
            primary
            onClick={() => {
              p.setDraft((d) => ({ ...d, context: contextAnswers(C.context.questions, d.context) }));
              p.onContinue();
            }}
            ck="context.continue"
          >
            {rich(C.context.continue)}
          </Button>
        </Foot>
      }
    >
      <div className={s.fields}>
        {C.context.questions.map((q, i) => (
          <Field key={q.id} label={q.label} ck={`context.questions.${i}.label`} value={answers[q.id as keyof typeof answers] ?? ''} onChange={(v) => set(q.id, v)} hint={q.hint} hintCk={`context.questions.${i}.hint`} multiline wide />
        ))}
      </div>
      <p className={s.hint} data-ck="context.file">
        {rich(C.context.file)}
      </p>
    </Screen>
  );
}

export type LineState = 'waiting' | 'working' | 'done' | 'failed';

const PILL: Record<LineState, string> = { waiting: '', working: s.pillWorking, done: s.pillDone, failed: s.pillFailed };

function Pill({ state }: { state: LineState }) {
  return (
    <span className={`${s.pill} ${PILL[state]}`} data-ck={`install.${state}`}>
      {rich(C.install[state])}
    </span>
  );
}

export type InstallError = 'errorForbidden' | 'errorNetwork' | 'errorOther';

export type InstallScreenProps = {
  started: boolean;
  onStart: () => void;
  app: { state: LineState; missing: string[] };
  /** The account the repos are in, for the App's settings on GitHub. */
  owner?: string;
  installUrl: string;
  onRecheck: () => void;
  repos: { id: number; name: string; state: LineState; error?: InstallError }[];
  onRetry: () => void;
  valuesGone: boolean;
  /** This tab is GitHub's return from installing the App; the keys are in the tab setup started in. */
  returned?: boolean;
  onBackToModel: () => void;
  done: boolean;
  onBack: () => void;
  onContinue: () => void;
};

export function InstallScreen(p: InstallScreenProps) {
  return (
    <Screen
      step="install"
      ck="install"
      title={C.install.title}
      body={C.install.body}
      foot={
        <Foot onBack={p.onBack}>
          {p.done ? (
            <Button primary onClick={p.onContinue} ck="install.continue">
              {rich(C.install.continue)}
            </Button>
          ) : !p.started ? (
            <Button primary disabled={p.valuesGone} onClick={p.onStart} ck="install.start">
              {rich(C.install.start)}
            </Button>
          ) : null}
        </Foot>
      }
    >
      {p.returned && !p.done ? (
        <p className={account.notice} data-ck="install.returned">
          {rich(C.install.returned)}
        </p>
      ) : p.valuesGone && !p.done ? (
        <div>
          <p className={account.notice} data-ck="install.valuesGone">
            {rich(C.install.valuesGone)}
          </p>
          <button type="button" className={account.linkButton} onClick={p.onBackToModel} data-ck="install.valuesGoneLink">
            {rich(C.install.valuesGoneLink)}
          </button>
        </div>
      ) : null}
      {p.started || p.done ? (
        <ul className={s.lines}>
          <li className={s.line}>
            <div className={s.lineHead}>
              <span data-ck={p.repos.length === 1 ? 'install.appLineOne' : 'install.appLine'}>{rich(p.repos.length === 1 ? C.install.appLineOne : fill(C.install.appLine, { n: p.repos.length }))}</span>
              <Pill state={p.app.state} />
            </div>
            {p.app.state === 'failed' || p.app.missing.length ? (
              <div className={s.lineActions}>
                {p.app.missing.length ? (
                  <span className={s.hint} data-ck="install.appMissing">
                    {rich(fill(C.install.appMissing, { repos: p.app.missing.join(', '), owner: p.owner ?? p.app.missing[0]?.split('/')[0] ?? '' }))}
                  </span>
                ) : null}
                <Button primary href={p.installUrl} external ck="install.appOpen">
                  {rich(C.install.appOpen)}
                </Button>
                <button type="button" className={account.linkButton} onClick={p.onRecheck} data-ck="install.appRecheck">
                  {rich(C.install.appRecheck)}
                </button>
              </div>
            ) : null}
          </li>
          {p.repos.map((r) => (
            <li key={r.id} className={s.line}>
              <div className={s.lineHead}>
                <span data-ck="install.secretsLine">{rich(fill(C.install.secretsLine, { repo: r.name }))}</span>
                <Pill state={r.state} />
              </div>
              {r.state === 'failed' ? (
                <div className={s.lineActions}>
                  {r.error ? (
                    <span className={s.lineError} data-ck={`install.${r.error}`}>
                      {rich(C.install[r.error])}
                    </span>
                  ) : null}
                  <button type="button" className={account.linkButton} onClick={p.onRetry} data-ck="install.retry">
                    {rich(C.install.retry)}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Screen>
  );
}

// ---- 6. Setup PR ------------------------------------------------------------------------------

/** `alreadySetUp`: the default branch already has these setup files, so no PR was opened and nothing runs. */
/** Why linking the repo was refused (datalyze-api.ts `linkProblem`), as its setupPr copy key. */
const LINK_KEY = { noGithub: 'linkNoGithub', notMaintainer: 'linkNotMaintainer', notFound: 'linkNotFound', unchecked: 'linkUnchecked' } as const satisfies Record<LinkProblem, string>;

export type SetupPrRow = { id: number; name: string; opening: boolean; failed: boolean; linkProblem?: LinkProblem; pr?: { number: number; url: string }; alreadySetUp?: boolean; run?: RunState; connections?: Connections };

/** Changing a refused key in place: the same fields as the Model or Analytics screen, on a copy of the draft. */
export type FixPanel = Pick<ChoiceProps, 'draft' | 'setDraft' | 'values' | 'setValue' | 'ready'> & {
  kind: 'model' | 'analytics';
  secretNames: string[];
  saving: boolean;
  saveFailed: boolean;
  /** New analytics keys tried from this browser before they're saved. */
  check?: AnalyticsCheck;
  onSave: () => void;
  onCancel: () => void;
};

export type SetupPrScreenProps = {
  rows: SetupPrRow[];
  draftGone: boolean;
  onBackToModel: () => void;
  onRetry: () => void;
  /** Which refused connections the person can change, and the panel when one is open. */
  toFix: { model: boolean; analytics: boolean };
  fix: FixPanel | null;
  onFix: (kind: 'model' | 'analytics') => void;
  /** Runs the check again on every repo whose result was unclear; null when there's none. */
  onCheckAgain: (() => void) | null;
  /** A key check still going: Continue waits for it. */
  checking?: boolean;
  done: boolean;
  onBack: () => void;
  onContinue: () => void;
};

const RUN_LINE: Record<RunState['state'], { key: 'runWaiting' | 'runRunning' | 'runStarted' | 'runFailed'; state: LineState }> = {
  waiting: { key: 'runWaiting', state: 'waiting' },
  running: { key: 'runRunning', state: 'working' },
  started: { key: 'runStarted', state: 'done' },
  failed: { key: 'runFailed', state: 'failed' },
};

const CONN_PILL: Record<Exclude<ConnectionState, 'skipped'>, { key: 'connChecking' | 'connOk' | 'connFailed' | 'connUnchecked'; className: string }> = {
  checking: { key: 'connChecking', className: s.pillWorking },
  ok: { key: 'connOk', className: s.pillDone },
  failed: { key: 'connFailed', className: s.pillFailed },
  unchecked: { key: 'connUnchecked', className: '' },
};

/** One connection's line under a repo: its name, a pill, and the runner's reason when it isn't working. */
function ConnectionLine({ index, c }: { index: number; c: Connection }) {
  if (c.state === 'skipped') return null;
  const pill = CONN_PILL[c.state];
  return (
    <div className={s.lineActions}>
      <span className={s.hint} data-ck={`setupPr.connections.${index}.label`}>
        {rich(C.setupPr.connections[index]!.label)}
      </span>
      <span className={`${s.pill} ${pill.className}`} data-ck={`setupPr.${pill.key}`}>
        {rich(C.setupPr[pill.key])}
      </span>
      {/* The runner's own words (a status description from GitHub): data, not page copy. */}
      {c.detail && (c.state === 'failed' || c.state === 'unchecked') ? <span className={c.state === 'failed' ? s.lineError : s.hint}>{c.detail}</span> : null}
    </div>
  );
}

export function SetupPrScreen(p: SetupPrScreenProps) {
  const blocked = p.toFix.model || p.toFix.analytics;
  const unchecked = p.rows.some((r) => r.connections && (r.connections.model.state === 'unchecked' || r.connections.analytics.state === 'unchecked'));
  // Merging the PR is the step's real action, so its button leads and Continue steps back.
  const toMerge = p.rows.some((r) => r.pr);
  return (
    <Screen
      step="setup-pr"
      ck="setupPr"
      title={C.setupPr.title}
      body={C.setupPr.body}
      points={C.setupPr.points}
      foot={
        <Foot onBack={p.onBack}>
          {blocked ? (
            <span className={s.hint} data-ck="setupPr.blocked">
              {rich(C.setupPr.blocked)}
            </span>
          ) : null}
          <Button primary={!toMerge} disabled={!p.done || blocked || p.checking} onClick={p.onContinue} ck="setupPr.continue">
            {rich(C.setupPr.continue)}
          </Button>
        </Foot>
      }
    >
      {p.draftGone ? (
        <div>
          <p className={account.notice} data-ck="setupPr.draftGone">
            {rich(C.setupPr.draftGone)}
          </p>
          <button type="button" className={account.linkButton} onClick={p.onBackToModel} data-ck="setupPr.draftGoneLink">
            {rich(C.setupPr.draftGoneLink)}
          </button>
        </div>
      ) : (
        <>
          <ul className={s.lines}>
            {p.rows.map((r) => {
              const run = r.run ? RUN_LINE[r.run.state] : null;
              return (
                <li key={r.id} className={s.line}>
                  <div className={s.lineHead}>
                    <span>{r.name}</span>
                    {r.pr ? (
                      <a href={r.pr.url} target="_blank" rel="noreferrer" data-ck="setupPr.prOpen">
                        {rich(fill(C.setupPr.prOpen, { n: r.pr.number }))}
                      </a>
                    ) : r.alreadySetUp ? (
                      <Pill state="done" />
                    ) : (
                      <Pill state={r.failed ? 'failed' : r.opening ? 'working' : 'waiting'} />
                    )}
                  </div>
                  {r.alreadySetUp ? (
                    <span className={s.hint} data-ck="setupPr.alreadySetUp">
                      {rich(C.setupPr.alreadySetUp)}
                    </span>
                  ) : null}
                  {!r.pr && r.opening ? (
                    <span className={s.hint} data-ck="setupPr.opening">
                      {rich(C.setupPr.opening)}
                    </span>
                  ) : null}
                  {r.failed ? (
                    <div className={s.lineActions}>
                      <span className={s.lineError} data-ck={`setupPr.${r.linkProblem ? LINK_KEY[r.linkProblem] : 'failed'}`}>
                        {rich(C.setupPr[r.linkProblem ? LINK_KEY[r.linkProblem] : 'failed'])}
                      </span>
                      <button type="button" className={account.linkButton} onClick={p.onRetry} data-ck="setupPr.retry">
                        {rich(C.setupPr.retry)}
                      </button>
                    </div>
                  ) : null}
                  {run ? (
                    <div className={s.lineActions}>
                      <span className={run.state === 'failed' ? s.lineError : s.hint} data-ck={`setupPr.${run.key}`}>
                        {rich(C.setupPr[run.key])}
                      </span>
                      {r.run?.url ? (
                        <a href={r.run.url} target="_blank" rel="noreferrer" data-ck="setupPr.runLink">
                          {rich(C.setupPr.runLink)}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                  {r.connections ? (
                    <>
                      <ConnectionLine index={0} c={r.connections.model} />
                      <ConnectionLine index={1} c={r.connections.analytics} />
                    </>
                  ) : null}
                  {r.pr ? (
                    <div className={s.lineActions}>
                      <Button primary={!blocked} href={r.pr.url} external ck="setupPr.merge">
                        {rich(fill(C.setupPr.merge, { n: r.pr.number }))}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {unchecked && !blocked ? (
            <div className={s.lineActions}>
              <span className={s.hint} data-ck="setupPr.uncheckedHint">
                {rich(C.setupPr.uncheckedHint)}
              </span>
              {p.onCheckAgain ? (
                <button type="button" className={account.linkButton} onClick={p.onCheckAgain} data-ck="setupPr.checkAgain">
                  {rich(C.setupPr.checkAgain)}
                </button>
              ) : null}
            </div>
          ) : null}
          {blocked && !p.fix ? (
            <div>
              <p className={account.notice} data-ck="setupPr.fixBody">
                {rich(C.setupPr.fixBody)}
              </p>
              <div className={s.lineActions}>
                {p.toFix.model ? (
                  <Button onClick={() => p.onFix('model')} ck="setupPr.fixModel">
                    {rich(C.setupPr.fixModel)}
                  </Button>
                ) : null}
                {p.toFix.analytics ? (
                  <Button onClick={() => p.onFix('analytics')} ck="setupPr.fixAnalytics">
                    {rich(C.setupPr.fixAnalytics)}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {p.fix ? (
            <div className={s.fixPanel}>
              {p.fix.kind === 'model' ? (
                <ModelFields draft={p.fix.draft} setDraft={p.fix.setDraft} values={p.fix.values} setValue={p.fix.setValue} />
              ) : (
                <AnalyticsFields draft={p.fix.draft} setDraft={p.fix.setDraft} values={p.fix.values} setValue={p.fix.setValue} secretNames={p.fix.secretNames} />
              )}
              {p.fix.check?.state === 'refused' ? (
                <p className={account.error} role="alert" data-ck={p.fix.check.status === 401 ? 'analytics.refusedKey' : 'analytics.refusedAccess'}>
                  {rich(fill(p.fix.check.status === 401 ? C.analytics.refusedKey : C.analytics.refusedAccess, { tool: C.analytics.tools.find((t) => t.id === p.fix!.draft.analytics.tool)?.label ?? '', status: p.fix.check.status }))}
                </p>
              ) : null}
              {p.fix.saveFailed ? (
                <p className={account.error} role="alert" data-ck="setupPr.saveFailed">
                  {rich(C.setupPr.saveFailed)}
                </p>
              ) : null}
              <div className={s.lineActions}>
                <Button primary disabled={!p.fix.ready || p.fix.saving} onClick={p.fix.onSave} ck={p.fix.saving ? 'setupPr.saving' : 'setupPr.save'}>
                  {rich(p.fix.saving ? C.setupPr.saving : C.setupPr.save)}
                </Button>
                <button type="button" className={account.linkButton} onClick={p.fix.onCancel} data-ck="setupPr.cancel">
                  {rich(C.setupPr.cancel)}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Screen>
  );
}

// ---- 7. Pay -----------------------------------------------------------------------------------

export type PayMessage = 'received' | 'pending' | 'notConfigured' | 'error' | 'hasSubscription';

export function PayScreen({ busy, message, onPay, onBack }: { busy: boolean; message: PayMessage | null; onPay: () => void; onBack: () => void }) {
  const bad = message === 'notConfigured' || message === 'error' || message === 'hasSubscription';
  return (
    <Screen
      step="pay"
      ck="pay"
      title={C.pay.title}
      body={C.pay.body}
      foot={
        <Foot onBack={onBack}>
          <Button primary disabled={busy || message === 'received'} onClick={onPay} ck={busy ? 'pay.working' : 'pay.button'}>
            {rich(busy ? C.pay.working : C.pay.button)}
          </Button>
        </Foot>
      }
    >
      <div className={s.price}>
        <span className={s.priceAmount} data-ck="pay.price">
          {rich(C.pay.price)}
        </span>
        <span className={s.priceUnit} data-ck="pay.per">
          {rich(C.pay.per)}
        </span>
      </div>
      {message ? (
        <p className={bad ? account.error : account.notice} role={bad ? 'alert' : 'status'} data-ck={`pay.${message}`}>
          {rich(C.pay[message])}
        </p>
      ) : null}
    </Screen>
  );
}

// ---- 10. The first audit -------------------------------------------------------------------------

/**
 * One repo on the first-audit screen:
 *   checking   reading whether the setup PR is merged
 *   unmerged   the setup PR isn't merged: the audit runs the workflow it brings, so merge it first
 *   ready      Run audit
 *   starting   the dispatch is being sent
 *   started    an audit is already going or done on this repo: open it
 *   failed     the dispatch was refused or the repo couldn't be read
 */
export type FirstAuditRow = { id: number; name: string; state: 'checking' | 'unmerged' | 'ready' | 'starting' | 'started' | 'failed'; setupPr?: { number: number; url: string } };

export function FirstAuditScreen({ rows, onRun, onOpen, onCheckAgain }: { rows: FirstAuditRow[]; onRun: (id: number) => void; onOpen: (id: number) => void; onCheckAgain: () => void }) {
  const unmerged = rows.some((r) => r.state === 'unmerged');
  const busy = rows.some((r) => r.state === 'starting');
  return (
    <Screen step="first-audit" ck="firstAudit" title={C.firstAudit.title} body={C.firstAudit.body} points={C.firstAudit.points} foot={<Foot />}>
      <ul className={s.lines}>
        {rows.map((r) => (
          <li key={r.id} className={s.line}>
            <div className={s.lineHead}>
              <span>{r.name}</span>
              {r.state === 'checking' ? <Pill state="working" /> : r.state === 'failed' ? <Pill state="failed" /> : null}
            </div>
            {r.state === 'unmerged' ? (
              <span className={s.hint} data-ck="firstAudit.unmerged">
                {rich(C.firstAudit.unmerged)}
              </span>
            ) : null}
            {r.state === 'failed' ? (
              <span className={s.lineError} data-ck="firstAudit.failed">
                {rich(C.firstAudit.failed)}
              </span>
            ) : null}
            <div className={s.lineActions}>
              {r.state === 'unmerged' && r.setupPr ? (
                <Button primary href={r.setupPr.url} external ck="firstAudit.merge">
                  {rich(fill(C.firstAudit.merge, { n: r.setupPr.number }))}
                </Button>
              ) : null}
              {r.state === 'ready' || r.state === 'starting' || r.state === 'failed' ? (
                <Button primary disabled={busy} onClick={() => onRun(r.id)} ck={r.state === 'starting' ? 'firstAudit.starting' : 'firstAudit.run'}>
                  {rich(r.state === 'starting' ? C.firstAudit.starting : C.firstAudit.run)}
                </Button>
              ) : null}
              {r.state === 'started' ? (
                <Button primary onClick={() => onOpen(r.id)} ck="firstAudit.open">
                  {rich(C.firstAudit.open)}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {unmerged ? (
        <div className={s.lineActions}>
          <button type="button" className={account.linkButton} onClick={onCheckAgain} data-ck="firstAudit.checkAgain">
            {rich(C.firstAudit.checkAgain)}
          </button>
        </div>
      ) : null}
    </Screen>
  );
}
