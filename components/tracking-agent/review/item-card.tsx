'use client';

import { Fragment, useState } from 'react';
import a from '@/components/account/account.module.css';
import { baseEntry, changedRows, planRows, planUnchanged, targetParts, type BaseRegistry } from '@/lib/tracking-agent/review/plan';
import type { ItemEdit } from '@/lib/tracking-agent/review/proposal';
import type { Evidence as EvidenceItem, ProposalItem } from '@/tracking-agent/src/proposal';
import { C, camel, t } from './copy';
import t2 from '@/components/tracking-agent/app/app.module.css';
import { Chip } from '@/components/tracking-agent/app/ui';
import { Segmented } from './screen';
import x from './audit.module.css';
import s from './review.module.css';

type Entry = Record<string, unknown>;

/** A link to the line in the file at the commit, for `file:line` evidence. */
export function codeLink(code: string, repoFullName: string, sha: string): string | null {
  const m = /^(.+):(\d+)$/.exec(code);
  if (!m || m[1]!.split('/').includes('..')) return null;
  return `https://github.com/${repoFullName}/blob/${sha}/${m[1]!.split('/').map(encodeURIComponent).join('/')}#L${m[2]}`;
}

export function Evidence({ evidence, repoFullName, sha }: { evidence: EvidenceItem[]; repoFullName: string; sha: string }) {
  return (
    <ul className={s.evidence}>
      {evidence.map((e, n) =>
        'code' in e ? (
          <li key={n}>
            {codeLink(e.code, repoFullName, sha) ? (
              <a href={codeLink(e.code, repoFullName, sha)!} target="_blank" rel="noopener noreferrer" className={s.mono}>
                {e.code}
              </a>
            ) : (
              <span className={s.mono}>{e.code}</span>
            )}
            <code className={s.quote}>{e.quote}</code>
          </li>
        ) : (
          <li key={n}>
            <C k="card.dataEvidence" className={s.muted} /> <span className={s.mono}>{e.data.tool}</span>
            <code className={s.quote}>{`${e.data.query}\n→ ${typeof e.data.result === 'string' ? e.data.result : JSON.stringify(e.data.result)}`}</code>
          </li>
        ),
      )}
    </ul>
  );
}

const fieldLabel = (k: string) => (t(`fields.${camel(k)}`) === `fields.${camel(k)}` ? k : t(`fields.${camel(k)}`));

/** Now and proposed, only the fields the item changes (12.2), every field on request. */
function PlanTable({ item, proposed, registry }: { item: ProposalItem; proposed: Entry; registry: BaseRegistry | null }) {
  const [all, setAll] = useState(false);
  const before = baseEntry(registry, item);
  const rows = planRows({ ...item, proposed }, before);
  if (before && planUnchanged(rows)) return <C k="plan.unchanged" as="p" className={s.why} />;
  const shown = all || !before ? rows : changedRows(rows);
  return (
    <div className={s.planWrap}>
      <table className={s.plan}>
        <thead>
          <tr>
            <C k="plan.field" as="th" />
            {before ? <C k="plan.before" as="th" /> : null}
            <C k="plan.after" as="th" />
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.field}>
              <td className={s.mono}>{r.field.startsWith('properties.') ? r.field : fieldLabel(r.field)}</td>
              {before ? <td className={s.planBefore}>{r.before || <C k="plan.none" className={s.muted} />}</td> : null}
              <td>{r.after || <C k="plan.removed" className={s.muted} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {before && !all && shown.length < rows.length ? (
        <button type="button" className={a.button} onClick={() => setAll(true)} style={{ margin: 8 }}>
          <C k="plan.showAll" />
        </button>
      ) : null}
    </div>
  );
}

export type RowProps = {
  item: ProposalItem;
  edit: ItemEdit | undefined;
  decision: 'approved' | 'rejected' | undefined;
  onEdit: (edit: ItemEdit) => void;
  registry: BaseRegistry | null;
  repoFullName: string;
  sha: string;
  /** Read only: no choices (the preview, a proposal that can't be decided now). */
  readOnly?: boolean;
  /** The table's column count, for the drawer. */
  cols: number;
};

/** The two choices' words: keep / reject on a change, Fix in this PR / Leave for the audit on a problem already there. */
const choiceText = (item: ProposalItem, v: 'approved' | 'rejected', chosen: boolean) =>
  item.existing ? (v === 'approved' ? 'proposal.existing.fix' : 'proposal.existing.leave') : chosen ? (v === 'approved' ? 'card.kept' : 'card.rejected') : v === 'approved' ? 'card.keep' : 'card.reject';

/** The columns ItemRow fills, in order (the table's head uses the same copy keys). */
export const ITEM_COLUMNS = ['proposal.columns.target', 'proposal.columns.property', 'proposal.columns.summary', 'proposal.columns.decision'] as const;

/**
 * One proposed change as a table row, like an audit finding: the event, the property (when one is
 * affected), what it changes, in a line, and Keep | Reject (picking the lit one again leaves it
 * undecided). Why ▸ opens the rest: the entry now and proposed, the evidence and a note for the build.
 * Rejecting opens it to ask why.
 */
export function ItemRow({ item, edit, decision, onEdit, registry, repoFullName, sha, readOnly, cols }: RowProps) {
  const [open, setOpen] = useState(false);
  const proposed = edit?.proposed ?? item.proposed;
  const note = edit?.note ?? item.note ?? '';
  const question = (typeof proposed.question === 'string' && proposed.question) || item.question;
  const { event, property } = targetParts(item);
  const choose = (v: 'approved' | 'rejected') => {
    const next = v === decision ? null : v;
    if (next === 'rejected') setOpen(true);
    onEdit({ ...edit, decision: next });
  };
  return (
    <Fragment>
      <tr id={`item-${item.id}`}>
        <td style={{ minWidth: 160 }}>{event ? <span className={`${s.mono} ${t2.main}`}>{event}</span> : <C k={`kinds.${camel(item.kind)}`} className={t2.faint} />}</td>
        <td style={{ minWidth: 120 }}>{property ? <span className={`${s.mono} ${t2.main}`}>{property}</span> : null}</td>
        <td>
          <span className={`${t2.clamp} ${t2.faint}`} style={{ whiteSpace: 'normal' }} title={item.summary}>
            {item.summary}
          </span>
        </td>
        <td>
          {readOnly ? (
            decision ? (
              <Chip tone={decision === 'approved' ? 'ok' : 'idle'}>
                <C k={choiceText(item, decision, true)} />
              </Chip>
            ) : null
          ) : (
            <Segmented<'approved' | 'rejected'> label={item.target} options={['approved', 'rejected']} value={decision as 'approved' | 'rejected'} onChoose={choose} render={(v) => <C k={choiceText(item, v, false)} />} />
          )}
        </td>
        <td className={t2.right}>
          <button type="button" className={x.why} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <C k="screen.why" /> {open ? '▾' : '▸'}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className={x.drawer}>
          <td colSpan={cols}>
            <p className={x.findingFix}>{item.summary}</p>
            {question || item.budget_reason ? (
              <dl className={s.facts}>
                {question ? (
                  <>
                    <C k="card.question" as="dt" />
                    <dd>{question}</dd>
                  </>
                ) : null}
                {item.budget_reason ? (
                  <>
                    <C k="card.budgetReason" as="dt" />
                    <dd>{item.budget_reason}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            <PlanTable item={item} proposed={proposed} registry={registry} />
            <details className={s.disclosure}>
              <C k="card.evidence" as="summary" />
              <Evidence evidence={item.evidence} repoFullName={repoFullName} sha={sha} />
            </details>
            {readOnly ? (
              item.note ? <p className={x.findingFix}>{item.note}</p> : null
            ) : (
              <label className={s.rejectBox}>
                <C k={decision === 'rejected' ? 'card.rejectReason' : 'card.note'} />
                <textarea className={s.textarea} rows={2} value={note} placeholder={t(decision === 'rejected' ? 'card.rejectPlaceholder' : 'card.notePlaceholder')} onChange={(e) => onEdit({ ...edit, note: e.target.value })} />
              </label>
            )}
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
