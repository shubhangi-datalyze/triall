'use client';

import { Fragment, useState } from 'react';
import a from '@/components/account/account.module.css';
import t2 from '@/components/tracking-agent/app/app.module.css';
import type { Check } from '@/tracking-agent/src/audit/match';
import { CHECK_KEYS, checkMark, warningId, type AuditEvidence, type CardCheck, type CheckKey, type EventCard } from '@/tracking-agent/src/audit/record';
import { rich } from '@/lib/content/rich';
import { C, camel, t } from './copy';
import { codeLink } from './item-card';
import x from './audit.module.css';
import s from './review.module.css';

/**
 * The event check as a table (EVENT-CHECK.md §3, §4): one row per event, one column per check, each cell
 * ✓ ok, ✗ problem, ◦ suggestion or – not measured. A row opens its card: the calls, each check's verdict with
 * its evidence and what fixes it, and the properties with their fill, null, empty and placeholder rates. The
 * audit screen shows every event; a pull request's, the events the change reaches.
 */

export type EventsCard = Pick<EventCard, 'name' | 'tier' | 'checks'> & Partial<Pick<EventCard, 'calls' | 'properties' | 'area' | 'warning_notes'>> & { why?: string };

const WARNING_KINDS = new Set(['stopped', 'volume_drop', 'outcome_exceeds_intent', 'platform_missing', 'platform_unexpected', 'double_firing', 'name_split', 'property_not_arriving', 'super_property_missing', 'property_low_fill', 'property_not_in_plan', 'property_null', 'property_empty', 'property_placeholder', 'property_platform_gap', 'type_split', 'type_mismatch', 'values_outside_plan', 'value_out_of_range', 'value_constant', 'value_high_cardinality', 'pii_values', 'stale_values']);

/** The words for one of match's warnings, filled from its own figures. */
export function warningText(w: Check): string {
  const v: Record<string, string> = {};
  for (const [k, val] of Object.entries(w)) {
    if (k === 'kind') continue;
    v[camel(k)] = Array.isArray(val) ? val.map((x) => (typeof x === 'object' && x ? `${(x as { value?: string }).value} ${pct((x as { share?: number }).share)}` : String(x))).join(', ') : typeof val === 'number' && /rate|share/.test(k) ? pct(val) : String(val);
  }
  const rate = 'null_rate' in w ? w.null_rate : 'fill_rate' in w ? w.fill_rate : 'empty_rate' in w ? w.empty_rate : 'duplicate_rate' in w ? w.duplicate_rate : 'stale_share' in w ? w.stale_share : undefined;
  if (rate !== undefined) v.rate = pct(rate);
  if (w.kind === 'stopped') v.lastSeen = w.last_seen ?? '?';
  if (w.kind === 'volume_drop') Object.assign(v, { recent: String(Math.round(w.recent_daily)), before: String(Math.round(w.before_daily)) });
  if (w.kind === 'outcome_exceeds_intent') Object.assign(v, { outcome: String(w.outcome_volume), intentVolume: String(w.intent_volume) });
  if (w.kind === 'property_placeholder') v.values = w.values.map((x) => `${x.value} ${pct(x.share)}`).join(', ');
  return WARNING_KINDS.has(w.kind) ? t(`events.warnings.kinds.${camel(w.kind)}`, v) : t('events.warnings.kinds.other', { kind: (w as { kind: string }).kind });
}

/**
 * match's warnings on one event, each with the card's note beside it (gap 14). They sit in the event's
 * card, not under its row, so the grid stays one line per event; the row shows how many there are.
 */
function Warnings({ warnings, notes, sentBy }: { warnings: Check[]; notes: EventsCard['warning_notes']; sentBy?: string }) {
  const noteOf = new Map((notes ?? []).map((n) => [n.warning, n.note]));
  return (
    <div className={x.warningBox}>
      <C k="events.warnings.title" as="strong" className={x.warningTitle} /> <C k="events.warnings.hint" className={x.warningHint} />
      <ul className={x.warningList}>
        {sentBy ? (
          <li>
            <C k="events.warnings.sentBy" vars={{ text: sentBy }} />
          </li>
        ) : null}
        {warnings.map((w) => {
          const note = noteOf.get(warningId(w));
          return (
            <li key={warningId(w)}>
              <span className={x.markWarn} aria-hidden="true">
                ⚠
              </span>{' '}
              {rich(warningText(w))}
              {note ? <C k="events.warnings.note" vars={{ note }} className={x.warningNote} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const MARK_TONE: Record<string, string> = { '✓': x.markOk, '✗': x.markBad, '◦': x.markSuggest, '–': x.markNone };
const pct = (n: number | undefined) => (n === undefined ? '–' : `${Math.round(n * 1000) / 10}%`);

function Mark({ check, k }: { check: CardCheck | undefined; k: CheckKey }) {
  const m = checkMark(check);
  const label = `${t(`events.checks.${camel(k)}`)}: ${t(`events.results.${check ? camel(check.result) : 'notChecked'}`)}`;
  return (
    <span className={MARK_TONE[m]} title={label} aria-label={label} role="img">
      {m}
    </span>
  );
}

function CodeRef({ code, quote, repoName, sha }: { code: string; quote?: string; repoName: string; sha: string }) {
  const href = codeLink(code, repoName, sha);
  return (
    <>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={s.mono}>
          {code}
        </a>
      ) : (
        <span className={s.mono}>{code}</span>
      )}
      {quote ? <code className={s.quote}>{quote}</code> : null}
    </>
  );
}

function CardDetail({ card, repoName, sha, linkTo, warnings, sentBy }: { card: EventsCard; repoName: string; sha: string; linkTo: (check: CardCheck) => string | null; warnings: Check[]; sentBy?: string }) {
  const shown = CHECK_KEYS.filter((k) => card.checks[k]);
  return (
    <div className={x.cardDetail}>
      {warnings.length || sentBy ? <Warnings warnings={warnings} notes={card.warning_notes} sentBy={sentBy} /> : null}
      {card.calls?.length ? (
        <>
          <C k="events.card.calls" as="h4" className={x.cardHeading} />
          <ul className={s.evidence}>
            {card.calls.map((c) => (
              <li key={c.code}>
                <CodeRef code={c.code} quote={c.quote} repoName={repoName} sha={sha} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <C k="events.card.checks" as="h4" className={x.cardHeading} />
      <ul className={x.cardChecks}>
        {shown.map((k) => {
          const c = card.checks[k]!;
          const link = linkTo(c);
          return (
            <li key={k}>
              <Mark check={c} k={k} /> <C k={`events.checks.${camel(k)}`} as="strong" />
              {link ? (
                <>
                  {' '}
                  <span className={t2.faint}>{link}</span>
                </>
              ) : null}
              {c.why ? <span className={x.cardWhy}>{c.why}</span> : null}
              {c.not_a_finding || c.not_an_item ? <span className={x.cardWhy}>{c.not_a_finding ?? c.not_an_item}</span> : null}
              {c.note ? <span className={`${x.cardWhy} ${x.wrap} ${t2.faint}`}>{c.note}</span> : null}
              {c.evidence?.length ? (
                <ul className={s.evidence}>
                  {c.evidence.map((e: AuditEvidence, n) => (
                    <li key={n}>{'code' in e ? <CodeRef code={e.code} quote={e.quote} repoName={repoName} sha={sha} /> : <span className={s.mono}>{e.query}</span>}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      {card.properties?.length ? (
        <>
          <C k="events.card.properties" as="h4" className={x.cardHeading} />
          <div className={t2.tableWrap}>
            <table className={t2.table}>
              <thead>
                <tr>
                  {(['property', 'filled', 'null', 'empty', 'placeholders', 'values'] as const).map((h) => (
                    <th key={h}>
                      <C k={`events.card.columns.${h}`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.properties.map((p) => (
                  <tr key={p.name}>
                    <td className={s.mono}>{p.name}</td>
                    <td>{pct(p.fill_rate)}</td>
                    <td className={p.null_rate ? x.markBad : undefined}>{pct(p.null_rate)}</td>
                    <td className={p.empty_rate ? x.markBad : undefined}>{pct(p.empty_rate)}</td>
                    <td className={s.mono}>{p.placeholders?.length ? p.placeholders.map((v) => `${v.value} ${pct(v.share)}`).join(', ') : '–'}</td>
                    <td className={`${s.mono} ${t2.faint}`} style={{ whiteSpace: 'normal' }}>
                      {p.top_values?.join(', ') ?? '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

const LEGEND = [
  ['✓', 'ok'],
  ['✗', 'problem'],
  ['◦', 'suggestion'],
  ['–', 'notMeasured'],
] as const;

/**
 * `linkTo`: what a check's problem points at, as text ("F3", "p2"), or null. `warnings`: match's checks for
 * an event (the audit's items), shown in its card with a ⚠ count on its row. The grid is a snapshot: one
 * line per event, every column in view; choosing what to fix happens elsewhere (the audit's Findings).
 */
export function EventsTable({ cards, repoName, sha, linkTo, intro, warnings, sentBy }: { cards: EventsCard[]; repoName: string; sha: string; linkTo: (check: CardCheck) => string | null; intro?: string; warnings?: (name: string) => Check[]; sentBy?: (name: string) => string | undefined }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {intro ? <C k={intro} as="p" className={x.eventsNote} /> : null}
      <p className={x.eventsBar}>
        {LEGEND.map(([mark, k]) => (
          <span key={k} className={x.legendItem}>
            <span className={MARK_TONE[mark]} aria-hidden="true">
              {mark}
            </span>{' '}
            <C k={`events.legend.${k}`} />
          </span>
        ))}
      </p>
      <div className={x.checkKey}>
        <C k="events.keyTitle" as="p" className={x.checkKeyTitle} />
        <ol className={x.checkKeyList}>
          {CHECK_KEYS.map((k) => (
            <li key={k}>
              <C k={`events.short.${camel(k)}`} className={x.checkKeyCode} />
              <C k={`events.checks.${camel(k)}`} />
            </li>
          ))}
        </ol>
      </div>
      <div className={t2.tableWrap}>
        <table className={`${t2.table} ${x.eventsGrid}`}>
          <thead>
            <tr>
              <th>
                <C k="events.columns.event" />
              </th>
              {CHECK_KEYS.map((k) => (
                <th key={k} className={x.checkCol} title={t(`events.checks.${camel(k)}`)}>
                  <C k={`events.short.${camel(k)}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const w = warnings?.(c.name) ?? [];
              const by = sentBy?.(c.name);
              return (
                <Fragment key={c.name}>
                  <tr className={x.eventRow} onClick={() => setOpen(open === c.name ? null : c.name)}>
                    <td className={`${s.mono} ${t2.main}`}>
                      <button type="button" className={x.eventName} aria-label={t('events.open', { event: c.name })} aria-expanded={open === c.name} aria-controls={`card-${c.name}`}>
                        {c.name}
                      </button>
                      {w.length ? (
                        <span className={x.warnCount} title={t('events.warnings.count', { n: String(w.length) })}>
                          ⚠ {w.length}
                        </span>
                      ) : null}
                    </td>
                    {CHECK_KEYS.map((k) => (
                      <td key={k} className={x.checkCol}>
                        <Mark check={c.checks[k]} k={k} />
                      </td>
                    ))}
                  </tr>
                  {open === c.name ? (
                    <tr id={`card-${c.name}`}>
                      <td colSpan={CHECK_KEYS.length + 1}>
                        <CardDetail card={c} repoName={repoName} sha={sha} linkTo={linkTo} warnings={w} sentBy={by} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!cards.length ? <C k="events.none" as="p" className={a.note} /> : null}
    </>
  );
}
