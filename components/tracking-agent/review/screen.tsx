'use client';

import type { ReactNode } from 'react';
import a from '@/components/account/account.module.css';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { Chip, type Tone } from '@/components/tracking-agent/app/ui';
import { C, t } from './copy';
import x from './audit.module.css';
import s from './review.module.css';

/**
 * The parts the PR review screen and the audit screen share, so the two read as one flow: Datalyze
 * proposes, you decide, it builds, Continue carries on what's left. Same header, same Proposed /
 * Built tabs, same question card, same "Anything else" note, same Save / Build it bar and the same
 * Built panel with Continue. Copy is under `screen` in content/tracking-agent-review.json.
 */

/** Tabs with counts: `items` are [key, copy key, count, the copy's {vars}]. */
export function Tabs<K extends string>({ label, items, value, onChange }: { label: string; items: [K, string, number | null, Record<string, string>?][]; value: K; onChange: (k: K) => void }) {
  return (
    <div className={a.tabs} role="tablist" aria-label={label}>
      {items.map(([key, k, n, vars]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} className={`${a.tab} ${value === key ? a.tabActive : ''}`} onClick={() => onChange(key)}>
          <C k={k} vars={vars} />
          {n !== null ? <span className={t2.tabCount}>{n}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Two or three choices side by side, one lit. */
export function Segmented<V>({ label, options, value, onChoose, render }: { label: string; options: V[]; value: V; onChoose?: (v: V) => void; render: (v: V) => ReactNode }) {
  return (
    <div className={x.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={value === o} className={value === o ? x.segOn : undefined} disabled={!onChoose} onClick={() => onChoose?.(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/** Crumb, title with its owner line, and the actions on the right. */
export function ScreenHead({ crumbs, title, owner, meta, actions }: { crumbs: ReactNode; title: ReactNode; owner?: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header>
      <p className={t2.crumb}>{crumbs}</p>
      <div className={t2.titleRow}>
        <h1 className={a.pageTitle}>
          {title}
          {owner ? <span className={t2.titleOwner}>{owner}</span> : null}
        </h1>
        {actions ? <span className={t2.headActions}>{actions}</span> : null}
      </div>
      {meta ? <p className={t2.faint} style={{ margin: '6px 0 18px', whiteSpace: 'normal' }}>{meta}</p> : null}
    </header>
  );
}

export type Stat = { k: string; value: ReactNode; big?: boolean };

/** One row of numbers under the title. */
export function Stats({ stats }: { stats: Stat[] }) {
  return (
    <dl className={t2.stats}>
      {stats.map((st) => (
        <div key={st.k} className={t2.stat}>
          <C k={st.k} as="dt" />
          <dd className={st.big ? t2.statBig : undefined}>{st.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type BuiltTab = { k: 'built' | 'builtWaiting' | 'builtReady' | 'builtMerged'; done: number; total: number; waiting: number };

/** Proposed | Built: the two tabs at the top of both screens once something is approved. */
export function ScreenTabs({ value, onChange, built }: { value: 'proposed' | 'built'; onChange: (v: 'proposed' | 'built') => void; built: BuiltTab }) {
  return (
    <Tabs
      label={t('screen.tabs.label')}
      items={[
        ['proposed', 'screen.tabs.proposed', null],
        ['built', `screen.tabs.${built.k}`, null, { done: String(built.done), total: String(built.total), n: String(built.waiting) }],
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

export type QuestionOption = { key: string; text: string };

/**
 * One question: its options as radios with the recommendation marked, then (when allowed) Decide later
 * and the person's own words. `value` is an option's key, the own text, or null for Decide later.
 */
export function QuestionCard({
  question,
  id,
  about,
  chip,
  options,
  recommended,
  value,
  onAnswer,
  readOnly,
  later,
  own,
}: {
  question: string;
  id?: string;
  about?: ReactNode;
  chip?: ReactNode;
  options: QuestionOption[];
  /** The recommended option's key (none: no recommendation). */
  recommended: string | null;
  value: { pick: string } | { own: string } | null;
  onAnswer: (v: { pick: string } | { own: string } | null) => void;
  readOnly: boolean;
  /** Offer Decide later (the audit: left out of what's built). */
  later?: boolean;
  /** Offer the person's own words. */
  own?: boolean;
}) {
  const picked = value && 'pick' in value ? value.pick : null;
  const ownText = value && 'own' in value ? value.own : '';
  const choices: { key: string | null; text: string }[] = [...options, ...(later && !readOnly ? [{ key: null, text: '' }] : [])];
  return (
    <article className={s.questionCard}>
      <p className={s.itemTitle}>
        {id ? <span className={s.mono}>{id}</span> : null} {question} {chip}
      </p>
      {about ? <p className={a.note}>{about}</p> : null}
      <div className={s.choices} role="radiogroup" aria-label={question}>
        {choices.map((o, i) => {
          const on = o.key === null ? value === null : picked === o.key;
          return (
            <button key={o.key ?? 'later'} type="button" role="radio" aria-checked={on} className={`${s.choice} ${on ? s.choiceOn : ''}`} disabled={readOnly} onClick={() => onAnswer(o.key === null ? null : { pick: o.key })}>
              <span className={s.choiceKey}>{o.key === null ? '–' : String.fromCharCode(65 + i)}</span>
              <span>
                {o.key === null ? <C k="screen.later" /> : o.text} {o.key !== null && o.key === recommended ? <C k="screen.recommended" className={s.badge} /> : null}
              </span>
            </button>
          );
        })}
        {own && (!readOnly || ownText) ? (
          <label className={s.rejectBox}>
            <C k="screen.ownAnswer" />
            <input className={a.input} value={ownText} placeholder={t('screen.ownAnswerPlaceholder')} disabled={readOnly} onChange={(e) => onAnswer(e.target.value ? { own: e.target.value } : recommended === null ? null : { pick: recommended })} />
          </label>
        ) : null}
      </div>
    </article>
  );
}

/** "Anything else": what the person wants done that no item or question covers, in their words. */
export function NoteBox({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  return <textarea className={s.textarea} value={value} maxLength={10_000} rows={5} placeholder={t('screen.notePlaceholder')} aria-label={t('screen.sections.note')} disabled={readOnly} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * The sticky bar on the Proposed tab: a line saying what's chosen (or what just happened), Save and
 * Build it. Build it shows `summary` first, with Back and Build it to confirm.
 */
export function ActionBar({
  line,
  summary,
  confirming,
  onConfirming,
  onSave,
  onBuild,
  saveDisabled,
  buildDisabled,
  busy,
  saveHint,
}: {
  line: ReactNode;
  summary: ReactNode;
  confirming: boolean;
  onConfirming: (v: boolean) => void;
  onSave: () => void;
  onBuild: () => void;
  saveDisabled: boolean;
  buildDisabled: boolean;
  busy: 'save' | 'build' | null;
  saveHint?: string;
}) {
  return (
    <>
      <div className={s.barSpacer} />
      <div className={s.bar}>
        <div className={s.barGrid}>
          <div style={{ minWidth: 0 }}>{confirming ? summary : line}</div>
          <div className={s.barButtons}>
            {confirming ? (
              <>
                <button type="button" className={a.button} onClick={() => onConfirming(false)}>
                  <C k="screen.back" />
                </button>
                <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={busy !== null} onClick={() => (onConfirming(false), onBuild())}>
                  <C k="screen.build" />
                </button>
              </>
            ) : (
              <>
                <button type="button" className={a.button} disabled={saveDisabled || busy !== null} onClick={onSave} title={saveHint}>
                  <C k={busy === 'save' ? 'screen.saving' : 'screen.save'} />
                </button>
                <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={buildDisabled || busy !== null} onClick={() => onConfirming(true)}>
                  <C k={busy === 'build' ? 'screen.buildBusy' : 'screen.build'} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The Built tab's head on both screens: where it stands as a chip, how much is built, the pull
 * request, and Continue (hidden once there's nothing to continue).
 */
export function BuiltHead({ tone, chipKey, count, extra, showContinue, continueDisabled, continueBusy, onContinue }: { tone: Tone; chipKey: string; count: ReactNode; extra?: ReactNode; showContinue: boolean; continueDisabled: boolean; continueBusy: boolean; onContinue: () => void }) {
  return (
    <div className={t2.titleRow} style={{ marginBottom: 8 }}>
      <p className={t2.faint} style={{ margin: '4px 0 0', whiteSpace: 'normal' }}>
        <Chip tone={tone}>
          <C k={chipKey} />
        </Chip>{' '}
        {count}
        {extra}
      </p>
      {showContinue ? (
        <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={continueDisabled || continueBusy} onClick={onContinue}>
          <C k={continueBusy ? 'screen.continueBusy' : 'screen.continue'} />
        </button>
      ) : null}
    </div>
  );
}

/** Not built | Built, and the items of the one picked. */
export function BuiltLists<I>({ notDone, done, value, onChange, render, notDoneBody }: { notDone: I[]; done: I[]; value: 'notDone' | 'done'; onChange: (v: 'notDone' | 'done') => void; render: (item: I) => ReactNode; /** Shown on Not built instead of the list (the PR screen's table and questions). */ notDoneBody?: ReactNode }) {
  const list = value === 'notDone' ? notDone : done;
  return (
    <>
      <Tabs
        label={t('screen.builtTabs.label')}
        items={[
          ['notDone', 'screen.builtTabs.notDone', notDone.length],
          ['done', 'screen.builtTabs.done', done.length],
        ]}
        value={value}
        onChange={onChange}
      />
      {value === 'notDone' && notDoneBody && list.length ? notDoneBody : list.length ? <ul className={x.fixList}>{list.map(render)}</ul> : <C k={`screen.builtTabs.empty.${value}`} as="p" className={a.note} />}
    </>
  );
}

/** One row of the Built tab: its id, short name and what came of it, with the full text under Details. */
export function WorkRow({ id, title, summary, full, details, onDetails, children }: { id: string; title: ReactNode; summary?: ReactNode; full?: ReactNode; details: boolean; onDetails?: () => void; children?: ReactNode }) {
  return (
    <li className={x.fixItem}>
      <div className={x.fixHead}>
        <div style={{ minWidth: 0 }}>
          <p className={x.fixTitle}>
            <span className={x.fixId}>{id}</span> {title}
          </p>
          {summary ? <div className={x.fixSummary}>{summary}</div> : null}
        </div>
        {onDetails ? (
          <button type="button" className={x.why} aria-expanded={details} onClick={onDetails}>
            <C k="screen.details" /> {details ? '▾' : '▸'}
          </button>
        ) : null}
      </div>
      {details && full ? <div className={x.fixFull}>{full}</div> : null}
      {children}
    </li>
  );
}
