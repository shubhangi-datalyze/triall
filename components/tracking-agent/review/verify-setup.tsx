'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import a from '@/components/account/account.module.css';
import { useMaybeAccount } from '@/components/account/account-shell';
import { Chip } from '@/components/tracking-agent/app/ui';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { VERIFY_PATH, verifyPath } from '@/lib/tracking-agent/verify';
import { QUICK_PASSWORD, quickWeb, type RepoAnalytics } from '@/lib/tracking-agent/verify-runs/quick-setup';
import { C, camel, t } from './copy';
import { ScreenHead, Tabs } from './screen';
import r from './verify-setup.module.css';
import { productionAllowed } from '@/tracking-agent/src/verify/production';
import { allowProduction } from '@/lib/tracking-agent/verify';

/**
 * /tracking-agent/verify/[owner]/[repo]/setup: the Verification section of Setup for one repo
 * (tracking-agent/VERIFY.md §12, §11 build step 4). Web's fields, saved as `verify.web` in
 * .datalyze/config.yaml by the Datalyze App, and the repo's secrets, each sealed as it's saved and
 * never shown again. Android and iOS are Phase C.
 */

type Auth = () => Promise<Record<string, string>>;
type Web = Record<string, unknown>;
type Finding = { rule: string; severity: 'error' | 'warn'; where: string; text: string };
type Slot = { name: string; for: string; saved: boolean };
type Loaded = { hasConfig: boolean; web: Web | null; analytics?: RepoAnalytics | null; findings: Finding[]; slots: Slot[]; canAct: boolean; sealing: boolean; sha?: string | null };

const SAVE_ERROR: Record<string, string> = { rules: 'rules', changed: 'changed', protected: 'protected', no_config: 'noConfig', bad_yaml: 'badYaml', no_write: 'noWrite', not_found: 'notFound' };
const SECRET_ERROR: Record<string, string> = { not_set_up: 'notSetUp', old_format: 'oldFormat' };

async function call<T>(auth: Auth, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(path, { ...init, cache: 'no-store', headers: { ...(await auth()), ...(init.body ? { 'content-type': 'application/json' } : {}) } });
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

export function VerifySetupPage({ owner, repo }: { owner: string; repo: string }) {
  const auth = useMaybeAccount()?.authHeader;
  const [data, setData] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<'notFound' | 'failed' | null>(null);
  const q = new URLSearchParams({ owner, repo }).toString();
  const load = useCallback(async () => {
    if (!auth) return;
    const res = await call<Loaded>(auth, `/api/tracking-agent/verify/setup?${q}`).catch(() => null);
    if (!res) return setFailure('failed');
    if (res.status === 404) return setFailure('notFound');
    if (!res.ok) return setFailure('failed');
    setFailure(null);
    setData(res.body);
  }, [auth, q]);
  useEffect(() => void load(), [load]);
  if (failure) {
    return (
      <section className={a.card}>
        <C k={`verify.setup.errors.${failure}`} as="p" className={a.cardBody} />
        <div className={a.cardActions}><button type="button" className={a.button} onClick={() => void load()}><C k="verify.run.errors.retry" /></button></div>
      </section>
    );
  }
  if (!data || !auth) return <div className={a.skeleton} style={{ height: 420 }} aria-busy="true" />;
  const actions: SetupActions = {
    save: async (web, sha) => call(auth, `/api/tracking-agent/verify/setup?${q}`, { method: 'PUT', body: JSON.stringify({ web, sha }) }),
    secret: async (name, value) => call(auth, `/api/tracking-agent/verify/setup/secret?${q}`, { method: value === null ? 'DELETE' : 'PUT', body: JSON.stringify(value === null ? { name } : { name, value }) }),
    reload: load,
  };
  return <VerifySetupView owner={owner} repo={repo} data={data} actions={actions} />;
}

type Res<T> = Promise<{ ok: boolean; status: number; body: T }>;
export type SetupActions = {
  save: (web: Web, sha: string | null) => Res<{ commit?: string; error?: string; findings?: Finding[] }>;
  secret: (name: string, value: string | null) => Res<{ names?: string[]; error?: string }>;
  reload: () => Promise<void>;
};

export function VerifySetupView({ owner, repo, data, actions }: { owner: string; repo: string; data: Loaded; actions: SetupActions }) {
  const [tab, setTab] = useState<'web' | 'android' | 'ios'>('web');
  const ref = { owner, repo };
  return (
    <>
      <ScreenHead
        crumbs={<><Link href={VERIFY_PATH}><C k="verify.crumb" /></Link> / <Link href={verifyPath(ref)}>{`${owner}/${repo}`}</Link> / <C k="verify.setup.crumb" /></>}
        title={<C k="verify.setup.title" />}
      />
      <C k="verify.setup.intro" as="p" className={a.note} />
      {!data.canAct ? <C k="verify.setup.noWrite" as="p" className={a.notice} /> : null}
      <Tabs<'web' | 'android' | 'ios'>
        label={t('verify.setup.tabs.label')}
        items={[['web', 'verify.setup.tabs.web', null], ['android', 'verify.setup.tabs.android', null], ['ios', 'verify.setup.tabs.ios', null]]}
        value={tab}
        onChange={setTab}
      />
      {tab !== 'web' ? <C k="verify.setup.phaseC" as="p" className={a.note} /> : !data.hasConfig ? <C k="verify.setup.noConfig" as="p" className={a.notice} /> : (
        <>
          <QuickSetup data={data} actions={actions} owner={owner} repo={repo} />
          <Secrets data={data} actions={actions} />
          {/* Everything else the setup can say (more environments, roles, one-time codes, payments…), for who needs it. */}
          <details className={t2.section}>
            <C k="verify.setup.quick.advanced" as="summary" className={t2.sectionTitle} />
            <WebForm key={JSON.stringify(data.web ?? null)} data={data} actions={actions} />
          </details>
        </>
      )}
    </>
  );
}

// ---- The quick setup -------------------------------------------------------------------------------

function QuickSetup({ data, actions, owner, repo }: { data: Loaded; actions: SetupActions; owner: string; repo: string }) {
  const env = ((Array.isArray(data.web?.environments) ? data.web!.environments : []) as Record<string, unknown>[])[0] ?? {};
  const acc = ((Array.isArray(data.web?.accounts) ? data.web!.accounts : []) as Record<string, unknown>[])[0] ?? {};
  const [url, setUrl] = useState(typeof env.url === 'string' ? env.url : '');
  const [token, setToken] = useState(String(get(env, 'analytics.token') ?? ''));
  const [email, setEmail] = useState(typeof acc.username === 'string' ? acc.username : '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: true } | { error: string; findings: Finding[] } | null>(null);
  const tool = String(get(env, 'analytics.tool') ?? data.analytics?.tool ?? '');
  const project = String(get(env, 'analytics.project') ?? data.analytics?.project ?? '');
  const passwordSaved = data.slots.some((sl) => sl.saved && sl.name === (typeof acc.password === 'string' ? acc.password : QUICK_PASSWORD));
  const disabled = !data.canAct || saving;
  const save = async () => {
    setSaving(true);
    setResult(null);
    const q = quickWeb(data.web, { url, token, email }, data.analytics ?? null);
    const res = await actions.save(cleanWeb(q.web), data.sha ?? null).catch(() => null);
    if (!res?.ok || !res.body.commit) {
      setSaving(false);
      return setResult({ error: SAVE_ERROR[res?.body.error ?? ''] ?? 'failed', findings: res?.body.findings ?? [] });
    }
    // The password is sealed on its own; the config only names it.
    if (q.password && password.trim()) {
      const sec = await actions.secret(q.password, password).catch(() => null);
      if (!sec?.ok) {
        setSaving(false);
        return setResult({ error: `secret.${SECRET_ERROR[sec?.body.error ?? ''] ?? 'failed'}`, findings: [] });
      }
    }
    setSaving(false);
    setPassword('');
    setResult({ ok: true });
    void actions.reload();
  };
  return (
    <section className={t2.section}>
      <div className={t2.sectionHead}><C k="verify.setup.quick.title" as="h2" className={t2.sectionTitle} /></div>
      <div className={r.grid}>
        <label className={r.field} htmlFor="quick-url">
          <C k="verify.setup.quick.url" className={r.label} />
          <input id="quick-url" className={`${a.input} ${t2.mono}`} disabled={disabled} type="url" placeholder="https://staging.example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label className={r.field} htmlFor="quick-token">
          <C k="verify.setup.quick.token" className={r.label} vars={{ tool: tool || 'analytics', project: project || '?' }} />
          <input id="quick-token" className={`${a.input} ${t2.mono}`} disabled={disabled} autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
        <label className={r.field} htmlFor="quick-email">
          <C k="verify.setup.quick.email" className={r.label} />
          <input id="quick-email" className={a.input} disabled={disabled} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={r.field} htmlFor="quick-password">
          <C k={passwordSaved ? 'verify.setup.quick.passwordSaved' : 'verify.setup.quick.password'} className={r.label} />
          <input id="quick-password" className={a.input} disabled={disabled || !email.trim() || !data.sealing} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      </div>
      <C k="verify.setup.quick.optional" as="p" className={a.note} />
      {result && 'ok' in result ? (
        <p className={a.note} aria-live="polite">
          <C k="verify.setup.quick.saved" /> <Link href={verifyPath({ owner, repo })} className={t2.link}><C k="verify.setup.quick.next" /></Link>
        </p>
      ) : null}
      {result && 'error' in result ? (
        <section className={r.result} aria-live="polite">
          <C k={result.error.startsWith('secret.') ? `verify.setup.secrets.${result.error.slice(7)}` : `verify.setup.errors.${result.error}`} as="p" className={r.error} />
          {result.findings.length ? <Findings list={result.findings.filter((f) => f.severity === 'error')} /> : null}
        </section>
      ) : null}
      {data.canAct ? (
        <div className={r.actions}>
          <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={saving || !url.trim() || !token.trim()} onClick={() => void save()}>{saving ? <C k="verify.setup.saving" /> : <C k="verify.setup.save" />}</button>
        </div>
      ) : null}
    </section>
  );
}

// ---- The web block --------------------------------------------------------------------------------

type Field = { key: string; label: string; kind?: 'text' | 'number' | 'select'; options?: string[]; mono?: boolean; secret?: boolean };

const ENV_FIELDS: Field[] = [
  { key: 'name', label: 'name', mono: true },
  { key: 'url', label: 'url', mono: true },
  { key: 'kind', label: 'kind', kind: 'select', options: ['staging', 'preview', 'production'] },
  { key: 'analytics.tool', label: 'tool', kind: 'select', options: ['mixpanel', 'posthog', 'amplitude'] },
  { key: 'analytics.project', label: 'project', mono: true },
  { key: 'analytics.token', label: 'token', mono: true },
  { key: 'analytics.region', label: 'region', mono: true },
  { key: 'analytics.host', label: 'host', mono: true },
  { key: 'read_key', label: 'readKey', mono: true },
  { key: 'probe', label: 'probe', mono: true },
  { key: 'tag', label: 'tag', mono: true },
  { key: 'served_commit', label: 'servedCommit', mono: true },
  { key: 'bypass.kind', label: 'bypass', kind: 'select', options: ['none', 'vercel', 'basic_auth'] },
  { key: 'bypass.secret', label: 'bypassSecret', mono: true, secret: true },
  { key: 'bypass.username', label: 'bypassUsername', mono: true },
];
const ACCOUNT_FIELDS: Field[] = [
  { key: 'role', label: 'role', mono: true },
  { key: 'login', label: 'login', kind: 'select', options: ['email_password', 'magic_link', 'phone_otp', 'google', 'sso', 'other'] },
  { key: 'username', label: 'username', mono: true },
  { key: 'password', label: 'password', mono: true, secret: true },
  { key: 'otp', label: 'otp', kind: 'select', options: ['none', 'fixed', 'totp', 'ask'] },
  { key: 'otp_secret', label: 'otpSecret', mono: true, secret: true },
  { key: 'pool', label: 'pool', kind: 'number' },
  { key: 'distinct_id', label: 'distinctId', mono: true },
];
const PAY_VALUES: Field[] = [{ key: 'card', label: 'card' }, { key: 'expiry', label: 'expiry' }, { key: 'cvv', label: 'cvv' }, { key: 'upi', label: 'upi' }];

const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);
function set(o: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [k, ...rest] = path.split('.');
  const next = { ...o };
  if (!rest.length) next[k!] = value;
  else next[k!] = set((o[k!] && typeof o[k!] === 'object' ? o[k!] : {}) as Record<string, unknown>, rest.join('.'), value);
  return next;
}

/** What the form holds, as the config writes it: empty fields left out, numbers as numbers, `none` as no field. */
export function cleanWeb(web: Web): Web {
  const prune = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(prune).filter((x) => x !== undefined);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) {
        const p = prune(x);
        if (p !== undefined) out[k] = p;
      }
      return Object.keys(out).length ? out : undefined;
    }
    if (typeof v === 'string') return v.trim() === '' ? undefined : v.trim();
    return v ?? undefined;
  };
  const w = (prune(web) ?? {}) as Web;
  // An account with no one-time code has no otp field.
  if (Array.isArray(w.accounts)) w.accounts = w.accounts.map((acc) => {
    const x = { ...(acc as Record<string, unknown>) };
    if (x.otp === 'none') delete x.otp;
    if (typeof x.pool === 'string') x.pool = Number(x.pool);
    return x;
  });
  if (!w.environments) w.environments = [];
  return w;
}

function Fields({ fields, value, onChange, disabled, prefix }: { fields: Field[]; value: Record<string, unknown>; onChange: (path: string, v: unknown) => void; disabled: boolean; prefix: string }) {
  return (
    <div className={r.grid}>
      {fields.map((f) => {
        const id = `${prefix}-${f.key}`;
        const v = get(value, f.key);
        return (
          <label key={f.key} className={r.field} htmlFor={id}>
            <C k={`verify.setup.fields.${f.label}`} className={r.label} />
            {f.kind === 'select' ? (
              <select id={id} className={a.input} disabled={disabled} value={String(v ?? (f.options![0] === 'none' ? 'none' : ''))} onChange={(e) => onChange(f.key, e.target.value)}>
                {f.options![0] === 'none' ? null : <option value="" />}
                {f.options!.map((o) => <option key={o} value={o}>{t(`verify.setup.options.${f.label === 'bypass' ? 'bypass' : f.label}.${camel(o)}`)}</option>)}
              </select>
            ) : (
              <input id={id} className={`${a.input} ${f.mono ? t2.mono : ''}`} disabled={disabled} type={f.kind === 'number' ? 'number' : 'text'} value={v == null ? '' : String(v)} onChange={(e) => onChange(f.key, f.kind === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : f.secret ? e.target.value.toUpperCase() : e.target.value)} />
            )}
          </label>
        );
      })}
    </div>
  );
}

function WebForm({ data, actions }: { data: Loaded; actions: SetupActions }) {
  const [web, setWeb] = useState<Web>(() => data.web ?? { environments: [] });
  const [sha, setSha] = useState<string | null>(data.sha ?? null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ commit?: string; error?: string; findings: Finding[] } | null>(data.findings.length ? { findings: data.findings } : null);
  const disabled = !data.canAct || saving;
  const envs = (Array.isArray(web.environments) ? web.environments : []) as Record<string, unknown>[];
  const accounts = (Array.isArray(web.accounts) ? web.accounts : []) as Record<string, unknown>[];
  const setList = (key: 'environments' | 'accounts', list: Record<string, unknown>[]) => setWeb((w) => ({ ...w, [key]: list }));
  const save = async () => {
    setSaving(true);
    const res = await actions.save(cleanWeb(web), sha).catch(() => null);
    setSaving(false);
    if (res?.ok && res.body.commit) {
      setSha((res.body as { sha?: string }).sha ?? null);
      setResult({ commit: res.body.commit, findings: res.body.findings ?? [] });
      void actions.reload();
    } else setResult({ error: SAVE_ERROR[res?.body.error ?? ''] ?? 'failed', findings: res?.body.findings ?? [] });
  };
  const errors = result?.findings.filter((f) => f.severity === 'error') ?? [];
  const warnings = result?.findings.filter((f) => f.severity === 'warn') ?? [];
  const pay = (web.payments ?? {}) as Record<string, unknown>;
  return (
    <>
      <section className={t2.section}>
        <div className={t2.sectionHead}><C k="verify.setup.environments.title" as="h2" className={t2.sectionTitle} /></div>
        <C k="verify.setup.environments.hint" as="p" className={a.note} />
        {envs.map((e, i) => (
          <fieldset key={i} className={r.item}>
            <legend className={r.legend}><C k="verify.setup.environments.item" vars={{ n: String(i + 1) }} /></legend>
            <Fields fields={ENV_FIELDS} value={e} disabled={disabled} prefix={`env${i}`} onChange={(p, v) => setList('environments', envs.map((x, j) => (j === i ? set(x, p, v) : x)))} />
            {e.kind === 'production' ? (
              <>
                <label className={r.check}>
                  <input type="checkbox" disabled={disabled} checked={productionAllowed(web, e)} onChange={(ev) => setWeb((w) => allowProduction(w, i, ev.target.checked))} /> <C k="verify.setup.allowProduction" />
                </label>
                {productionAllowed(web, e) ? <C k="verify.setup.allowProductionWarning" as="p" className={a.notice} /> : null}
              </>
            ) : null}
            {data.canAct ? <button type="button" className={t2.link} onClick={() => setList('environments', envs.filter((_, j) => j !== i))}><C k="verify.setup.environments.remove" /></button> : null}
          </fieldset>
        ))}
        {data.canAct ? <button type="button" className={a.button} onClick={() => setList('environments', [...envs, { kind: 'staging', analytics: { tool: 'mixpanel' } }])}><C k="verify.setup.environments.add" /></button> : null}
      </section>

      <section className={t2.section}>
        <div className={t2.sectionHead}><C k="verify.setup.accounts.title" as="h2" className={t2.sectionTitle} /></div>
        <C k="verify.setup.accounts.hint" as="p" className={a.note} />
        {accounts.map((acc, i) => (
          <fieldset key={i} className={r.item}>
            <legend className={r.legend}><C k="verify.setup.accounts.item" vars={{ n: String(i + 1) }} /></legend>
            <Fields fields={ACCOUNT_FIELDS} value={acc} disabled={disabled} prefix={`acc${i}`} onChange={(p, v) => setList('accounts', accounts.map((x, j) => (j === i ? set(x, p, v) : x)))} />
            {data.canAct ? <button type="button" className={t2.link} onClick={() => setList('accounts', accounts.filter((_, j) => j !== i))}><C k="verify.setup.accounts.remove" /></button> : null}
          </fieldset>
        ))}
        {data.canAct ? <button type="button" className={a.button} onClick={() => setList('accounts', [...accounts, { role: 'member', login: 'email_password' }])}><C k="verify.setup.accounts.add" /></button> : null}
      </section>

      <section className={t2.section}>
        <div className={t2.sectionHead}><C k="verify.setup.payments.title" as="h2" className={t2.sectionTitle} /></div>
        <Fields fields={[{ key: 'provider', label: 'provider', kind: 'select', options: ['none', 'stripe', 'razorpay', 'other'] }, { key: 'mode', label: 'mode', kind: 'select', options: ['test', 'ask'] }]} value={pay} disabled={disabled} prefix="pay" onChange={(p, v) => setWeb((w) => set(w, `payments.${p}`, v))} />
        {pay.provider && pay.provider !== 'none' ? (
          <>
            <C k="verify.setup.payments.success" as="p" className={r.sub} />
            <Fields fields={PAY_VALUES} value={(pay.success ?? {}) as Record<string, unknown>} disabled={disabled} prefix="paysuccess" onChange={(p, v) => setWeb((w) => set(w, `payments.success.${p}`, v))} />
            <C k="verify.setup.payments.failure" as="p" className={r.sub} />
            <Fields fields={PAY_VALUES} value={(pay.failure ?? {}) as Record<string, unknown>} disabled={disabled} prefix="payfailure" onChange={(p, v) => setWeb((w) => set(w, `payments.failure.${p}`, v))} />
          </>
        ) : null}
      </section>

      <section className={t2.section}>
        <div className={t2.sectionHead}><C k="verify.setup.exclude.title" as="h2" className={t2.sectionTitle} /></div>
        <C k="verify.setup.exclude.hint" as="p" className={a.note} />
        <Fields fields={[{ key: 'property', label: 'property', mono: true }, { key: 'op', label: 'op', kind: 'select', options: ['equals', 'starts_with', 'ends_with', 'contains'] }, { key: 'value', label: 'value', mono: true }]} value={(web.exclude_test_users ?? {}) as Record<string, unknown>} disabled={disabled} prefix="exclude" onChange={(p, v) => setWeb((w) => set(w, `exclude_test_users.${p}`, v))} />
      </section>

      <section className={t2.section}>
        <div className={t2.sectionHead}><C k="verify.setup.notesTitle" as="h2" className={t2.sectionTitle} /></div>
        <textarea className={a.input} rows={3} disabled={disabled} value={typeof web.notes === 'string' ? web.notes : ''} aria-label={t('verify.setup.notesTitle')} onChange={(e) => setWeb((w) => ({ ...w, notes: e.target.value }))} />
      </section>

      {result ? (
        <section className={r.result} aria-live="polite">
          {result.commit ? <C k="verify.setup.saved" as="p" className={a.note} vars={{ commit: result.commit.slice(0, 7) }} /> : null}
          {result.error ? <C k={`verify.setup.errors.${result.error}`} as="p" className={r.error} /> : null}
          {errors.length ? <><C k="verify.setup.findingsTitle" as="p" className={r.sub} /><Findings list={errors} /></> : null}
          {warnings.length ? <><C k="verify.setup.warningsTitle" as="p" className={r.sub} /><Findings list={warnings} /></> : null}
        </section>
      ) : null}
      {data.canAct ? (
        <div className={r.actions}>
          <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={saving} onClick={() => void save()}>{saving ? <C k="verify.setup.saving" /> : <C k="verify.setup.save" />}</button>
        </div>
      ) : null}
    </>
  );
}

/** The setup rules' findings: their own words, from the plugin (tracking-agent/src/verify/config.ts). */
function Findings({ list }: { list: Finding[] }) {
  return (
    <ul className={r.findings}>
      {list.map((f, i) => <li key={i}><span className={t2.mono}>{f.rule}</span> <span className={t2.faint}>{f.where}</span> {f.text}</li>)}
    </ul>
  );
}

// ---- Secrets ---------------------------------------------------------------------------------------

function Secrets({ data, actions }: { data: Loaded; actions: SetupActions }) {
  const [slots, setSlots] = useState<Slot[]>(data.slots);
  useEffect(() => setSlots(data.slots), [data.slots]);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apply = (names?: string[]) => {
    if (!names) return;
    const have = new Set(names);
    setSlots((s) => s.filter((x) => x.for !== 'unused' || have.has(x.name)).map((x) => ({ ...x, saved: have.has(x.name) })));
  };
  const save = async (name: string, v: string | null) => {
    setBusy(true);
    setError(null);
    const res = await actions.secret(name, v).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      apply(res.body.names);
      setEditing(null);
      setValue('');
    } else setError(SECRET_ERROR[res?.body.error ?? ''] ?? 'failed');
  };
  return (
    <section className={t2.section}>
      <div className={t2.sectionHead}><C k="verify.setup.secrets.title" as="h2" className={t2.sectionTitle} /></div>
      <C k="verify.setup.secrets.hint" as="p" className={a.note} />
      {!data.sealing && data.canAct ? <C k="verify.setup.secrets.notSetUp" as="p" className={a.notice} /> : null}
      <ul className={t2.rows}>
        {slots.map((s) => (
          <li key={s.name} className={t2.row}>
            <div className={t2.rowMain}>
              <span className={`${t2.mono} ${t2.main}`}>{s.name}</span>
              <span className={t2.rowMeta}>
                {s.for === 'anthropic' ? <C k="verify.setup.secrets.anthropic" /> : s.for === 'unused' ? <C k="verify.setup.secrets.unused" /> : s.for}
              </span>
              {editing === s.name ? (
                <form className={r.secretForm} onSubmit={(e) => { e.preventDefault(); if (value.trim()) void save(s.name, value); }}>
                  <input className={`${a.input} ${t2.mono}`} type="password" autoComplete="off" spellCheck={false} value={value} placeholder={t('verify.setup.secrets.placeholder')} aria-label={s.name} onChange={(e) => setValue(e.target.value)} autoFocus />
                  <button type="submit" className={`${a.button} ${a.buttonPrimary}`} disabled={busy || !value.trim()}><C k="verify.setup.secrets.save" /></button>
                  <button type="button" className={a.button} onClick={() => { setEditing(null); setValue(''); }}><C k="verify.setup.secrets.cancel" /></button>
                </form>
              ) : null}
            </div>
            <div className={t2.rowSide}>
              <Chip tone={s.saved ? 'ok' : 'warn'}><C k={s.saved ? 'verify.setup.secrets.saved' : 'verify.setup.secrets.missing'} /></Chip>
              {data.canAct && data.sealing && editing !== s.name && s.for !== 'unused' ? (
                <button type="button" className={t2.link} onClick={() => { setEditing(s.name); setValue(''); }}><C k={s.saved ? 'verify.setup.secrets.replace' : 'verify.setup.secrets.add'} /></button>
              ) : null}
              {data.canAct && s.saved && s.for === 'unused' ? (
                <button type="button" className={t2.link} disabled={busy} onClick={() => void save(s.name, null)}><C k="verify.setup.secrets.remove" /></button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {error ? <C k={`verify.setup.secrets.${error}`} as="p" className={r.error} /> : null}
    </section>
  );
}
