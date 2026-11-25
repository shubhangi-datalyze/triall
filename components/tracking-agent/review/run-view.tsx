'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import a from '@/components/account/account.module.css';
import { useMaybeAccount } from '@/components/account/account-shell';
import { Chip, When, type Tone } from '@/components/tracking-agent/app/ui';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { VERIFY_PATH, verifyPath } from '@/lib/tracking-agent/verify';
import type { RunView as RunData } from '@/lib/tracking-agent/verify-runs/api';
import type { Step } from '@/lib/tracking-agent/verify-runs/record';
import { useFocusLayout } from '@/components/account/account-shell';
import { applyStep, ENDED_RUN, reportHref, initialView, liveTabLabel, nextLiveTabs, readSse, type ChatItem, type EventState, type LiveTab, type LiveTabs, type ViewState } from '@/lib/tracking-agent/verify-runs/view';
import { LANDED_KEY, LANDED_TONE } from './plan-view';
import { C, t } from './copy';
import { ScreenHead } from './screen';
import r from './run-view.module.css';

/**
 * /tracking-agent/verify/[owner]/[repo]/runs/[id]: a hosted verification run as it happens
 * (tracking-agent/VERIFY.md §11 Phase B, §14 "Run"). The live browser on the left, the chat on the
 * right, the picked events under it. Everything comes from the run record: the page streams its rows
 * from a cursor and writes the person's messages, Done and Skip back to it.
 */

type Auth = () => Promise<Record<string, string>>;
type Loaded = { run: RunData; canAct: boolean };
/** What the screen does to the run: the page sends it to the API, the preview to nowhere. */
export type RunActions = {
  /** false when Datalyze refused or didn't answer: the run is still going. */
  stop: () => Promise<boolean | void>;
  send: (body: Record<string, unknown>) => Promise<boolean>;
  live: (shard: number) => Promise<{ url: string; pages: LiveTab[] } | null>;
};

const RUN_TONE: Record<string, Tone> = { queued: 'idle', running: 'run', done: 'ok', failed: 'bad', stopped: 'warn' };
const EVENT_TONE: Record<EventState, Tone> = { waiting: 'idle', checking: 'run', passed: 'ok', problem: 'bad', needsYou: 'warn', couldntReach: 'warn', notChecked: 'idle' };

async function api<T>(auth: Auth, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(path, { ...init, cache: 'no-store', headers: { ...(await auth()), ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as T };
}

export function RunPage({ owner, repo, id }: { owner: string; repo: string; id: string }) {
  const auth = useMaybeAccount()?.authHeader;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<'notFound' | 'failed' | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [tick, setTick] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const viewRef = useRef<ViewState | null>(null);
  // A read that fails once the run is on screen keeps it there, as Reconnecting…, until the next read works.
  const [stale, setStale] = useState(false);
  const shown = useRef(false);

  const load = useCallback(async () => {
    if (!auth) return;
    const res = await api<Loaded & { error?: string }>(auth, `/api/tracking-agent/verify/runs/${encodeURIComponent(id)}`).catch(() => null);
    if (!res?.ok && shown.current) return setStale(true);
    if (!res) return setFailure('failed');
    if (res.status === 404 || res.status === 403) return setFailure('notFound');
    if (!res.ok) return setFailure('failed');
    shown.current = true;
    setStale(false);
    setFailure(null);
    setLoaded(res.body);
    if (!viewRef.current) {
      viewRef.current = initialView(res.body.run.shards);
      setView(viewRef.current);
    }
  }, [auth, id]);
  useEffect(() => void load(), [load]);

  // The stream: rows from the cursor on, reconnecting until the server says the run has ended.
  const started = Boolean(loaded);
  useEffect(() => {
    if (!auth || !started) return;
    let alive = true;
    const abort = new AbortController();
    void (async () => {
      for (let tries = 0; alive; tries++) {
        try {
          const after = viewRef.current?.lastSeq ?? 0;
          const res = await fetch(`/api/tracking-agent/verify/runs/${encodeURIComponent(id)}/stream?after=${after}`, { headers: await auth(), cache: 'no-store', signal: abort.signal });
          if (!res.ok || !res.body) throw new Error(String(res.status));
          setReconnecting(false);
          tries = 0;
          let statusSeen = false;
          const how = await readSse(res.body, {
            step: (row: Step) => {
              if (!viewRef.current) return;
              applyStep(viewRef.current, row);
              if (row.kind === 'status' && row.body.shard) statusSeen = true;
              setTick((n) => n + 1);
              // A shard moved on: its row (live view, status, cost) is read again.
              if (statusSeen) {
                statusSeen = false;
                void load();
              }
            },
          });
          if (how === 'end') {
            void load();
            return;
          }
        } catch {
          if (!alive) return;
          setReconnecting(true);
        }
        await new Promise((res) => setTimeout(res, Math.min(10_000, 1000 * 2 ** Math.min(tries, 3))));
      }
    })();
    return () => {
      alive = false;
      abort.abort();
    };
  }, [auth, started, id, load]);

  const actions = useMemo(() => (auth ? actionsFor(auth, id, load) : null), [auth, id, load]);

  if (failure) {
    return (
      <section className={a.card}>
        <C k={`verify.run.errors.${failure}`} as="p" className={a.cardBody} />
        <div className={a.cardActions}>
          <button type="button" className={a.button} onClick={() => void load()}><C k="verify.run.errors.retry" /></button>
        </div>
      </section>
    );
  }
  if (!loaded || !view || !actions) return <div className={a.skeleton} style={{ height: 420 }} aria-busy="true" />;
  return <RunScreen owner={owner} repo={repo} data={loaded} view={view} actions={actions} reconnecting={reconnecting || stale} tick={tick} />;
}

function actionsFor(auth: Auth, id: string, reload: () => Promise<void>): RunActions {
  const base = `/api/tracking-agent/verify/runs/${encodeURIComponent(id)}`;
  return {
    stop: async () => {
      const res = await api(auth, `${base}/stop`, { method: 'POST', body: '{}' }).catch(() => null);
      await reload();
      return Boolean(res?.ok);
    },
    send: async (body) => Boolean((await api(auth, `${base}/messages`, { method: 'POST', body: JSON.stringify(body) }).catch(() => null))?.ok),
    live: async (shard) => {
      const res = await api<{ url?: string; pages?: LiveTab[] }>(auth, `${base}/live?shard=${shard}`).catch(() => null);
      return res?.ok && res.body.url ? { url: res.body.url, pages: res.body.pages ?? [] } : null;
    },
  };
}

/** The ended card's counts: the picked events by where they ended. */
function endCounts(view: ViewState): Record<string, string> {
  const n = (st: string) => String(view.events.filter((e) => e.state === st).length);
  return { passed: n('passed'), problems: n('problem') };
}

export function RunScreen({ owner, repo, data, view, actions, reconnecting = false, tick = 0 }: { owner: string; repo: string; data: Loaded; view: ViewState; actions: RunActions; reconnecting?: boolean; tick?: number }) {
  const { run, canAct } = data;
  const ended = ENDED_RUN.includes(run.status);
  // While the run goes, the app's sidebar folds away and the browser takes most of the width (VERIFY.md §24 point 6).
  useFocusLayout(!ended);
  const [stopping, setStopping] = useState(false);
  const [stopFailed, setStopFailed] = useState(false);
  const stop = async () => {
    if (!window.confirm(t('verify.run.stopConfirm'))) return;
    setStopping(true);
    setStopFailed(false);
    const ok = await actions.stop();
    setStopFailed(ok === false);
    setStopping(false);
  };
  const ref = { owner, repo };
  return (
    <>
      <ScreenHead
        crumbs={<><Link href={VERIFY_PATH}><C k="verify.crumb" /></Link> / <Link href={verifyPath(ref)}>{`${owner}/${repo}`}</Link> / <C k="verify.run.crumb" /></>}
        title={<C k="verify.run.title" />}
        meta={(
          <>
            <Chip tone={RUN_TONE[run.status] ?? 'idle'}><C k={`verify.run.statuses.${run.status}`} /></Chip>{' '}
            <C k="verify.run.on" vars={{ environment: run.environment }} />, <When iso={run.createdAt} />
            {run.startedBy ? <>, <C k="verify.run.startedBy" vars={{ who: run.startedBy }} /></> : null}
            {view.costUsd ? <> · <C k="verify.run.cost" vars={{ usd: view.costUsd.toFixed(2) }} /></> : null}
            {view.browserMinutes != null ? <> · <C k="verify.run.browserMinutes" vars={{ minutes: view.browserMinutes.toFixed(1) }} /></> : null}
            {view.captured ? <> · <C k="verify.run.captured" vars={{ captured: String(view.captured) }} /></> : null}
            {reconnecting && !ended ? <> · <C k="verify.run.reconnecting" /></> : null}
          </>
        )}
        actions={canAct && !ended ? (
          <>
            {stopFailed ? <C k="verify.run.stopFailed" className={a.error} /> : null}
            <button type="button" className={a.button} disabled={stopping} onClick={() => void stop()}>{stopping ? <C k="verify.run.stopping" /> : <C k="verify.run.stop" />}</button>
          </>
        ) : undefined}
      />
      {ended ? (
        <section className={`${a.card} ${r.endCard}`}>
          <C k={view.published && run.status === 'done' ? 'verify.run.ended.complete' : `verify.run.ended.${run.status}`} as="p" className={a.cardBody} vars={endCounts(view)} />
          {view.published ? (
            <div className={a.cardActions}>
              <Link className={`${a.button} ${a.buttonPrimary}`} href={reportHref(ref, view.report)}><C k="verify.run.ended.proceed" /></Link>
            </div>
          ) : <C k="verify.run.ended.noReport" as="p" className={a.cardBody} />}
        </section>
      ) : null}
      <div className={`${r.split}${ended ? '' : ` ${r.splitWide}`}`}>
        <LiveBrowser run={run} canAct={canAct} live={actions.live} />
        <Chat run={run} view={view} canAct={canAct} send={actions.send} ended={ended} tick={tick} />
      </div>
      <Events view={view} ended={ended} />
    </>
  );
}

function LiveBrowser({ run, canAct, live: liveUrl }: { run: RunData; canAct: boolean; live: RunActions['live'] }) {
  const [shard, setShard] = useState(0);
  const s = run.shards.find((x) => x.shard === shard) ?? run.shards[0];
  // The session's open tabs: a popup (Google's sign-in) is a tab of its own, so the person can switch to it.
  const [tabs, setTabs] = useState<LiveTabs>({ tabs: [], selected: null });
  const [single, setSingle] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const live = Boolean(s?.live);
  const which = s?.shard ?? null;
  // Reload asks for fresh URLs for every tab; the poll below only adds and drops tabs.
  const fetchTabs = useCallback(async (fresh: boolean) => {
    if (which === null) return;
    if (fresh) setState('loading');
    const got = await liveUrl(which);
    if (!got) {
      if (fresh) setState('failed');
      return;
    }
    setSingle(got.url);
    setTabs((prev) => nextLiveTabs(fresh ? { tabs: [], selected: prev.selected } : prev, got.pages));
    setState('idle');
  }, [liveUrl, which]);
  useEffect(() => {
    if (!canAct || !live) {
      setTabs({ tabs: [], selected: null });
      setSingle(null);
      return;
    }
    void fetchTabs(true);
    // New tabs (a sign-in popup) show up within a few seconds; only while the page is in view.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void fetchTabs(false); }, 4000);
    return () => clearInterval(timer);
  }, [canAct, live, fetchTabs]);
  const tab = tabs.tabs.find((x) => x.id === tabs.selected) ?? null;
  const url = tab?.live ?? single;
  const ended = !s || ['done', 'failed', 'stopped'].includes(s.status);
  return (
    <section className={r.browser} aria-label={t('verify.run.live.title')}>
      <div className={r.paneHead}>
        <C k="verify.run.live.title" as="h2" className={t2.sectionTitle} />
        {run.shards.length > 1 ? (
          <span className={r.parts}>
            {run.shards.map((x) => (
              <button key={x.shard} type="button" className={`${r.part} ${x.shard === shard ? r.partOn : ''}`} onClick={() => setShard(x.shard)}><C k="verify.run.live.part" vars={{ n: String(x.shard + 1) }} /></button>
            ))}
          </span>
        ) : null}
        {url ? <button type="button" className={t2.link} onClick={() => void fetchTabs(true)}><C k="verify.run.live.reload" /></button> : null}
      </div>
      {tabs.tabs.length > 1 && !ended ? (
        <div className={r.parts} role="tablist" aria-label={t('verify.run.live.tabs')}>
          {tabs.tabs.map((x, i) => (
            <button key={x.id} type="button" role="tab" aria-selected={x.id === tabs.selected} title={x.url}
              className={`${r.part} ${x.id === tabs.selected ? r.partOn : ''}`} onClick={() => setTabs((p) => ({ ...p, selected: x.id }))}>
              {liveTabLabel(x, i + 1, (n) => t('verify.run.live.tab', { n: String(n) }))}
            </button>
          ))}
        </div>
      ) : null}
      {!canAct ? <C k="verify.run.live.noWrite" as="p" className={r.empty} />
        : ended ? <C k="verify.run.live.ended" as="p" className={r.empty} />
          : !live ? <C k="verify.run.live.notYet" as="p" className={r.empty} />
            : state === 'failed' ? <C k="verify.run.live.failed" as="p" className={r.empty} />
              : url ? (
                <>
                  <iframe key={tab?.id ?? 'single'} className={r.frame} src={url} title={t('verify.run.live.title')} sandbox="allow-same-origin allow-scripts" allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer" />
                  <C k="verify.run.live.hint" as="p" className={r.askHint} />
                </>
              ) : <div className={a.skeleton} style={{ height: 360 }} aria-busy="true" />}
    </section>
  );
}

function Chat({ run, view, canAct, send: post, ended, tick }: { run: RunData; view: ViewState; canAct: boolean; send: RunActions['send']; ended: boolean; tick: number }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  // Typing goes to the shard that's asking, else the first one still going.
  const target = useMemo(() => {
    const asking = [...view.openAsk.keys()][0];
    if (asking !== undefined) return asking;
    return run.shards.find((s) => !['done', 'failed', 'stopped'].includes(s.status))?.shard ?? 0;
  }, [view, run.shards, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- view is mutated in place; tick says it changed
  useEffect(() => {
    const el = list.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  }, [tick]);
  const send = async (body: Record<string, unknown>) => {
    setSending(true);
    setFailed(false);
    const ok = await post(body);
    setSending(false);
    if (!ok) setFailed(true);
    return ok;
  };
  const submit = async () => {
    const said = text.trim();
    if (!said) return;
    if (await send({ shard: target, text: said })) setText('');
  };
  const open = canAct && !ended;
  return (
    <section className={r.chat} aria-label={t('verify.run.chat.title')}>
      <div className={r.paneHead}><C k="verify.run.chat.title" as="h2" className={t2.sectionTitle} /></div>
      <ol className={r.messages} ref={list} aria-live="polite">
        {!view.items.length ? <li><C k="verify.run.chat.empty" as="p" className={r.empty} /></li> : null}
        {view.items.map((item) => <Item key={item.seq} item={item} canAnswer={open && !sending} onAnswer={(answer) => void send({ shard: item.shard, answer, event: item.kind === 'ask' ? item.event : null, path: item.kind === 'ask' ? item.path : 0 })} />)}
      </ol>
      {open ? (
        <form className={r.compose} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <textarea
            className={a.input}
            rows={2}
            value={text}
            maxLength={4000}
            placeholder={t('verify.run.chat.placeholder')}
            aria-label={t('verify.run.chat.placeholder')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }}
          />
          <button type="submit" className={`${a.button} ${a.buttonPrimary}`} disabled={sending || !text.trim()}>{sending ? <C k="verify.run.chat.sending" /> : <C k="verify.run.chat.send" />}</button>
          {failed ? <C k="verify.run.chat.failed" as="p" className={r.error} /> : null}
        </form>
      ) : <C k={ended ? 'verify.run.chat.ended' : 'verify.run.chat.noWrite'} as="p" className={r.empty} />}
    </section>
  );
}

function Item({ item, canAnswer, onAnswer }: { item: ChatItem; canAnswer: boolean; onAnswer: (a: 'done' | 'skip') => void }) {
  if (item.kind === 'agent') {
    return (
      <li className={r.agent}>
        <C k="verify.run.chat.agent" className={r.who} />
        <p className={r.text}>{item.text}</p>
      </li>
    );
  }
  if (item.kind === 'person') {
    return (
      <li className={r.person}>
        <span className={r.who}>{item.by ?? <C k="verify.run.chat.you" />}</span>
        <p className={r.text}>{item.text}</p>
      </li>
    );
  }
  if (item.kind === 'ask') {
    return (
      <li className={r.ask}>
        <C k="verify.run.ask.title" className={r.askTitle} />
        {item.event ? <span className={`${t2.mono} ${t2.faint}`}> {item.event}</span> : null}
        <p className={r.text}>{item.ask}</p>
        {item.answer ? (
          <p className={r.askHint}><C k={`verify.run.ask.answered.${item.answer}`} />{item.by ? ` (${item.by})` : ''}</p>
        ) : (
          <>
            <C k="verify.run.ask.hint" as="p" className={r.askHint} />
            <div className={r.askButtons}>
              <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={!canAnswer} onClick={() => onAnswer('done')}><C k="verify.run.ask.done" /></button>
              <button type="button" className={a.button} disabled={!canAnswer} onClick={() => onAnswer('skip')}><C k="verify.run.ask.skip" /></button>
            </div>
          </>
        )}
      </li>
    );
  }
  if (item.kind === 'tools') {
    const counts = new Map<string, number>();
    for (const n of item.names) counts.set(n, (counts.get(n) ?? 0) + 1);
    const tools = [...counts].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ');
    return <li className={r.note}><C k="verify.run.chat.tools" vars={{ tools }} /></li>;
  }
  if (item.kind === 'error') return <li className={r.error}>{item.text}</li>;
  return <li className={r.note}><C k={`verify.run.notes.${item.note}`} vars={item.vars} /></li>;
}

/** The picked events: a one-line strip with the counts while the run goes (open it for the list), the list once it ends. */
function Events({ view, ended }: { view: ViewState; ended: boolean }) {
  const n = (st: EventState) => view.events.filter((e) => e.state === st).length;
  const counts = (['passed', 'problem', 'needsYou', 'checking'] as const).filter((st) => n(st) > 0);
  return (
    <details className={r.events} open={ended || undefined}>
      <summary className={r.eventsHead}>
        <C k="verify.run.events.title" className={t2.sectionTitle} /> <span className={t2.faint}>{view.events.length}</span>
        {counts.map((st) => <span key={st} className={t2.faint}> · <C k={`verify.run.events.count.${st}`} vars={{ n: String(n(st)) }} /></span>)}
      </summary>
      <div className={t2.tableWrap}>
        <table className={t2.table}>
          <tbody>
            {view.events.map((e) => (
              <tr key={`${e.shard}:${e.key}`}>
                <td className={`${t2.mono} ${t2.main}`}>{e.key}</td>
                <td style={{ whiteSpace: 'nowrap' }}><Chip tone={EVENT_TONE[e.state]}><C k={`verify.run.events.states.${e.state}`} /></Chip></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {e.landed ? <><C k="verify.run.events.landed" className={t2.faint} /> <Chip tone={LANDED_TONE[e.landed] ?? 'idle'}><C k={`verify.landed.${LANDED_KEY[e.landed] ?? 'notMeasured'}`} /></Chip></> : null}
                </td>
                <td className={t2.faint}>{e.why ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
