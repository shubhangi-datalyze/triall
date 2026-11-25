'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import a from '@/components/account/account.module.css';
import t2 from '@/components/tracking-agent/app/app.module.css';
import type { Tone } from '@/components/tracking-agent/app/ui';
import {
  answerOf,
  buildProgress,
  CONTINUABLE,
  DECIDING,
  decisionOf,
  hasEdits,
  heldQuestions,
  notBuiltRows,
  noDecisions,
  noteOf,
  openItems,
  pendingEdits,
  screenState,
  tally,
  type Decisions,
  type NotBuiltRow,
  type ItemEdit,
  type Refusal,
  type ReviewData,
  type SaveResult,
  type ScreenState,
} from '@/lib/tracking-agent/review/proposal';
import type { GhPull } from '@/lib/tracking-agent/github/client';
import { active, type Run } from '@/lib/tracking-agent/runs';
import type { ProposalItem, ProposalQuestion } from '@/tracking-agent/src/proposal';
import { C, t } from './copy';
import { EventsTable, type EventsCard } from './events-table';
import { ITEM_COLUMNS, ItemRow } from './item-card';
import { RunList } from './runs';
import { LatestRun } from './run-record';
import { ActionBar, BuiltHead, BuiltLists, NoteBox, QuestionCard, ScreenHead, ScreenTabs, Stats, Tabs, WorkRow, type BuiltTab } from './screen';
import s from './review.module.css';

export type SaveFn = (decisions: Decisions, approve: boolean) => Promise<SaveResult>;

type Notice = { key: string; vars?: Record<string, string>; warn?: boolean } | { refusal: Refusal } | null;
type Section = 'changes' | 'existing' | 'questions' | 'checked' | 'note';

/** States the Built tab shows for: an approval, and what its build made of it. */
const BUILT_STATES: ScreenState[] = ['approved', 'building', 'heldBack', 'needsPerson', 'unfinished', 'implemented'];
/** Where the build stands, as the Built tab's chip (the same chips as an audit's fix). */
const CHIP: Partial<Record<ScreenState, [Tone, string]>> = {
  approved: ['run', 'building'],
  building: ['run', 'building'],
  heldBack: ['warn', 'heldBack'],
  needsPerson: ['bad', 'needsPerson'],
  unfinished: ['warn', 'unfinished'],
  implemented: ['ok', 'ready'],
  notCurrent: ['warn', 'notCurrent'],
  reviewing: ['run', 'reviewing'],
};
/** States whose sentence the screen leads with: there's nothing to decide, or something to know first. */
const LEAD: ScreenState[] = ['fork', 'reviewing', 'notCurrent', 'noProposal', 'noPlan', 'invalid', 'noChange'];

/**
 * One pull request's proposal, laid out like the audit screen: the title and its numbers, then
 * Proposed (the changes as a table, the questions, what was checked, Anything else) and Built (what
 * the build made of it, with Continue). Save and Build it sit in one bar; Build it approves.
 */
export function ProposalScreen({
  data,
  onSave,
  onReviewAgain,
  onContinue,
  approved: approvedHere,
  preview,
}: {
  data: ReviewData;
  onSave: SaveFn;
  onReviewAgain?: () => Promise<boolean>;
  /** Continue the build: an `implement` run for the pull request. */
  onContinue?: () => Promise<boolean>;
  /** Approved from this page a moment ago: the build's run may not be listed yet. */
  approved?: boolean;
  preview?: boolean;
}) {
  const [decisions, setDecisions] = useState<Decisions>(noDecisions);
  const [busy, setBusy] = useState<'save' | 'build' | 'review' | 'continue' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [continued, setContinued] = useState<'started' | 'failed' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [sentHere, setSent] = useState(false);
  const sent = sentHere || Boolean(approvedHere);
  const [reviewStarted, setReviewStarted] = useState(false);
  const pr = data.pull;
  const p = data.proposal?.proposal ?? null;
  const state = screenState(data);
  // Approved here and the build not listed yet: nothing to decide until it shows (no second build).
  // Merged or closed is final: nothing more is decided or built on it.
  const deciding = Boolean(p) && pr.state === 'open' && DECIDING.includes(state) && !(sent && state === 'awaiting') && !preview;
  const edits = useMemo(() => (p ? pendingEdits(p, decisions) : noDecisions()), [p, decisions]);
  const counts = p ? tally(p, decisions) : null;
  // Problems that were already there are their own section: they don't hold the pull request.
  const allOpen = p ? openItems(p) : [];
  const open = allOpen.filter((i) => !i.existing);
  const existingOpen = allOpen.filter((i) => i.existing);
  const cards = (p?.checked ?? []).filter((c) => c.checks && typeof c.checks === 'object') as EventsCard[];
  const repoName = `${data.repo.owner}/${data.repo.repo}`;

  const hasBuilt = Boolean(p) && (BUILT_STATES.includes(state) || Boolean(p?.approved_by) || sent);
  const [tab, setTab] = useState<'proposed' | 'built'>(hasBuilt && (!DECIDING.includes(state) || state === 'needsPerson' || state === 'heldBack') ? 'built' : 'proposed');
  const onProposed = !hasBuilt || tab === 'proposed';
  const sections = (
    [
      ['changes', 'screen.sections.changes', open.length],
      ['existing', 'screen.sections.existing', existingOpen.length],
      ['questions', 'screen.sections.questions', p?.questions.length ?? 0],
      ['checked', cards.length ? 'audit.sections.events' : 'screen.sections.checked', cards.length || (p?.checked.length ?? 0)],
      ['note', 'screen.sections.note', null],
    ] as [Section, string, number | null][]
  ).filter(([key, , n]) => (key === 'note' ? deciding || Boolean(p?.note) : Boolean(n)));
  // Held back: the held-back questions are what needs answering, so open on them.
  const [section, setSection] = useState<Section>(state === 'heldBack' && p?.questions.length ? 'questions' : (sections[0]?.[0] ?? 'changes'));
  const shownSection = sections.some(([k]) => k === section) ? section : (sections[0]?.[0] ?? 'changes');

  const editItem = (id: string, e: ItemEdit) => {
    setNotice(null);
    setDecisions((d) => ({ ...d, items: { ...d.items, [id]: e } }));
  };
  const answer = (q: ProposalQuestion, v: number | string) => {
    setNotice(null);
    setDecisions((d) => ({ ...d, answers: { ...d.answers, [q.id]: v } }));
  };

  const send = async (approve: boolean) => {
    setBusy(approve ? 'build' : 'save');
    setNotice(null);
    const res = await onSave(edits, approve);
    setBusy(null);
    if (!res.ok) return setNotice({ refusal: res.refusal });
    setDecisions(noDecisions());
    if (approve) {
      setSent(true);
      // A dropped or merged notice stays where it was read, on Proposed with the bar.
      if (!res.dropped.length && !res.merged) setTab('built');
    }
    if (res.dropped.length) setNotice({ key: 'sent.dropped', vars: { ids: res.dropped.join(', ') }, warn: true });
    else if (res.merged) setNotice({ key: 'sent.merged' });
    else if (!approve) setNotice({ key: 'footer.saved' });
  };

  const progress = p ? buildProgress(p) : { built: 0, total: 0 };
  const held = p ? heldQuestions(p) : new Map<string, ProposalQuestion[]>();
  // The questions holding items back, once each (one question can hold more than one item).
  const heldList = [...new Map([...held.values()].flat().map((q) => [q.id, q])).values()];
  const heldAnswered = heldList.every((q) => decisions.answers[q.id] !== undefined || q.answer !== undefined);
  const stateVars: Record<string, string> = { login: p?.approved_by ?? '', description: data.status?.description ?? '', built: String(progress.built), total: String(progress.total), held: String(held.size) };
  // A build is going (or one just started from here): nothing to continue until it ends.
  const canContinue = Boolean(p) && CONTINUABLE.includes(state) && !preview && continued !== 'started';
  useEffect(() => {
    if (state === 'building') setContinued(null);
  }, [state]);
  const startContinue = async () => {
    if (!onContinue) return;
    setBusy('continue');
    setContinued((await onContinue()) ? 'started' : 'failed');
    setBusy(null);
  };
  // Continue on Not built: the answers are saved as an approval, one commit whose run is the build (it
  // carries on from what's built). Answers already saved make that commit a no-op, so then it's a plain Continue.
  const continueHeld = async () => {
    setBusy('continue');
    setNotice(null);
    const res = await onSave(edits, true);
    if (res.ok) {
      setDecisions(noDecisions());
      setSent(true);
      setContinued('started');
    } else if (res.refusal.code === 'nothingNew' && onContinue) {
      setContinued((await onContinue()) ? 'started' : 'failed');
    } else setNotice({ refusal: res.refusal });
    setBusy(null);
  };
  const reviewAgain = async () => {
    if (!onReviewAgain) return;
    setBusy('review');
    setReviewStarted(await onReviewAgain());
    setBusy(null);
  };

  const undecided = counts?.undecided ?? 0;
  const countLine = counts
    ? [
        counts.approved ? t(counts.approved === 1 ? 'footer.counts.keptOne' : 'footer.counts.kept', { n: String(counts.approved) }) : null,
        counts.rejected ? t(counts.rejected === 1 ? 'footer.counts.rejectedOne' : 'footer.counts.rejected', { n: String(counts.rejected) }) : null,
        undecided ? t(undecided === 1 ? 'footer.counts.undecidedOne' : 'footer.counts.undecided', { n: String(undecided) }) : null,
      ].filter(Boolean)
    : [];
  const note = p ? noteOf(p, decisions) : '';
  // Build it keeps the undecided items: the summary counts them as kept.
  const summaryVars = { kept: String((counts?.approved ?? 0) + undecided), rejected: String(counts?.rejected ?? 0), answers: String(p?.questions.length ?? 0) };

  // What the build made of it: the wanted items (not rejected), built or not.
  const wanted = p ? p.items.filter((i) => i.implemented || (i.existing ? i.decision === 'approved' : i.decision !== 'rejected')) : [];
  const notBuilt = wanted.filter((i) => !i.implemented);
  const builtItems = wanted.filter((i) => i.implemented);
  const [builtList, setBuiltList] = useState<'notDone' | 'done'>(notBuilt.length && state !== 'implemented' ? 'notDone' : 'done');
  const builtTab: BuiltTab = { k: state === 'implemented' ? 'builtReady' : 'built', done: progress.built, total: progress.total, waiting: 0 };
  const [chipTone, chipKey] = CHIP[state] ?? (sent ? (['run', 'building'] as [Tone, string]) : (['idle', 'unfinished'] as [Tone, string]));

  const itemsTable = (list: ProposalItem[]) => (
    <div className={t2.tableWrap}>
      <table className={t2.table}>
        <thead>
          <tr>
            {ITEM_COLUMNS.map((k) => (
              <C key={k} k={k} as="th" />
            ))}
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {list.map((it) => (
            <ItemRow
              key={it.id}
              item={it}
              edit={decisions.items[it.id]}
              decision={decisionOf(it, decisions)}
              onEdit={(e) => editItem(it.id, e)}
              registry={data.registry}
              repoFullName={repoName}
              sha={pr.head.sha}
              readOnly={!deciding}
              cols={ITEM_COLUMNS.length + 1}
            />
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <ScreenHead
        crumbs={
          <>
            <Link href="/tracking-agent/review">
              <C k="pr.crumb" />
            </Link>{' '}
            / {data.repo.repo} #{pr.number}
          </>
        }
        title={pr.title}
        owner={`#${pr.number}`}
        meta={
          <>
            <span className={s.mono}>{repoName}</span> · <C k="pr.by" vars={{ login: pr.user.login }} /> · <C k="pr.branches" vars={{ head: pr.head.ref, base: pr.base.ref }} />
          </>
        }
        actions={
          <>
            <a href={pr.html_url} target="_blank" rel="noopener noreferrer" className={a.button}>
              <C k="screen.github" /> ↗
            </a>
            {(state === 'notCurrent' || state === 'noProposal') && onReviewAgain && !reviewStarted ? (
              <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={busy === 'review'} onClick={() => void reviewAgain()}>
                <C k={busy === 'review' ? 'state.reviewAgainBusy' : 'state.reviewAgain'} />
              </button>
            ) : null}
          </>
        }
      />

      {reviewStarted ? (
        <C k="state.reviewStarted" as="p" className={a.notice} />
      ) : LEAD.includes(state) ? (
        <div className={a.notice} role="status">
          <C k={`state.${state}`} as="p" vars={stateVars} />
          {state === 'invalid' ? (
            <ul className={s.list}>
              {data.proposalErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <PrStageBanner pull={pr} state={state} run={data.runs.find(active)} />

      {p ? (
        <>
          <Stats
            stats={[
              { k: 'screen.stats.changes', value: open.length, big: true },
              { k: 'screen.stats.questions', value: p.questions.length, big: true },
              { k: 'screen.stats.built', value: hasBuilt && progress.total ? `${progress.built}/${progress.total}` : '–', big: true },
              { k: 'screen.stats.checked', value: p.checked.length, big: true },
            ]}
          />
          <p className={s.summary}>{p.summary}</p>

          {hasBuilt ? <ScreenTabs value={tab} onChange={setTab} built={builtTab} /> : null}

          {hasBuilt && tab === 'built' ? (
            <section className={s.section}>
              <BuiltHead
                tone={chipTone}
                chipKey={`screen.chips.${chipKey}`}
                count={<C k="screen.count" vars={{ done: String(progress.built), total: String(progress.total) }} />}
                showContinue={CONTINUABLE.includes(state) && Boolean(onContinue) && !preview && !held.size}
                continueDisabled={!canContinue || busy !== null}
                continueBusy={busy === 'continue'}
                onContinue={() => void startContinue()}
              />
              {sent && (state === 'awaiting' || state === 'approved' || state === 'heldBack' || state === 'needsPerson') ? (
                <C k="sent.approved" as="p" className={a.note} />
              ) : LEAD.includes(state) ? null : notice && !('refusal' in notice) ? (
                <C k={notice.key} vars={notice.vars} as="p" className={notice.warn ? a.error : a.note} />
              ) : continued === 'started' && CONTINUABLE.includes(state) ? (
                <C k="state.continueStarted" as="p" className={a.note} />
              ) : continued === 'failed' ? (
                <C k="state.continueFailed" as="p" className={a.error} />
              ) : state === 'heldBack' ? null : (
                <C k={`state.${state}`} as="p" className={a.note} vars={stateVars} />
              )}
              <BuiltLists<ProposalItem>
                notDone={notBuilt}
                done={builtItems}
                value={builtList}
                onChange={setBuiltList}
                render={(i) => <BuiltRow key={i.id} item={i} />}
                notDoneBody={
                  <>
                    <NotBuiltTable rows={notBuiltRows(p)} />
                    {heldList.length ? (
                      <>
                        <C k="proposal.notBuiltAsk" as="p" className={a.note} />
                        <div className={s.questions}>
                          {heldList.map((q) => {
                            // Only a real answer shows as picked: Continue waits for one, and the recommended one is marked.
                            const v = decisions.answers[q.id] ?? q.answer;
                            return (
                              <QuestionCard
                                key={q.id}
                                question={q.question}
                                options={q.options.map((o, i) => ({ key: String(i), text: o }))}
                                recommended={String(q.recommended)}
                                value={v === undefined ? null : typeof v === 'string' ? { own: v } : { pick: String(v) }}
                                onAnswer={(next) => answer(q, next && 'own' in next ? next.own : next ? Number(next.pick) : q.recommended)}
                                readOnly={!deciding}
                                own
                              />
                            );
                          })}
                        </div>
                        <div className={s.actions}>
                          <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={!deciding || !heldAnswered || busy !== null || continued === 'started'} onClick={() => void continueHeld()}>
                            <C k={busy === 'continue' ? 'screen.continueBusy' : 'screen.continue'} />
                          </button>
                        </div>
                        {notice && 'refusal' in notice ? <RefusalLine refusal={notice.refusal} /> : null}
                      </>
                    ) : null}
                  </>
                }
              />
            </section>
          ) : null}

          {onProposed ? (
            <>
              {/* Held back or stopped: say why on Proposed too, where the answers are given. */}
              {deciding ? (
                <p className={a.note}>
                  <C k={state === 'heldBack' || state === 'needsPerson' ? `state.${state}` : hasBuilt ? 'proposal.changeNote' : 'state.awaiting'} vars={stateVars} />
                  {state === 'needsPerson' && onContinue && !preview ? (
                    <>
                      {' '}
                      <button type="button" className={a.button} style={{ padding: '2px 10px' }} disabled={!canContinue || busy !== null} onClick={() => void startContinue()}>
                        <C k={busy === 'continue' ? 'screen.continueBusy' : 'screen.continue'} />
                      </button>
                    </>
                  ) : null}
                </p>
              ) : null}
              {continued && state === 'needsPerson' ? <C k={continued === 'started' ? 'state.continueStarted' : 'state.continueFailed'} as="p" className={continued === 'started' ? a.note : a.error} /> : null}
              {sections.length > 1 ? <Tabs label={t('screen.sections.label')} items={sections} value={shownSection} onChange={setSection} /> : null}

              {shownSection === 'changes' && open.length ? itemsTable(open) : null}

              {shownSection === 'existing' && existingOpen.length ? (
                <>
                  <C k="proposal.existing.intro" as="p" className={a.note} />
                  {itemsTable(existingOpen)}
                </>
              ) : null}

              {shownSection === 'questions' ? (
                <div className={s.questions}>
                  {p.questions.map((q) => {
                    const v = answerOf(q, decisions);
                    const target = q.item ? p.items.find((i) => i.id === q.item)?.target : undefined;
                    return (
                      <QuestionCard
                        key={q.id}
                        question={q.question}
                        about={
                          target ? (
                            <>
                              <C k="proposal.forItem" /> <span className={s.mono}>{target}</span>
                            </>
                          ) : undefined
                        }
                        options={q.options.map((o, i) => ({ key: String(i), text: o }))}
                        recommended={String(q.recommended)}
                        value={typeof v === 'string' ? { own: v } : { pick: String(v) }}
                        onAnswer={(next) => answer(q, next && 'own' in next ? next.own : next ? Number(next.pick) : q.recommended)}
                        readOnly={!deciding}
                        own
                      />
                    );
                  })}
                </div>
              ) : null}

              {shownSection === 'checked' && cards.length ? <EventsTable cards={cards} repoName={repoName} sha={pr.head.sha} intro="events.prIntro" linkTo={(c) => c.item ?? null} /> : null}
              {shownSection === 'checked' && cards.length && p.checked.length > cards.length ? (
                <details className={s.unaffected}>
                  <C k="proposal.unaffected" as="summary" vars={{ n: String(p.checked.length - cards.length) }} />
                  <CheckedTable rows={p.checked.filter((c) => !(c.checks && typeof c.checks === 'object'))} />
                </details>
              ) : null}

              {shownSection === 'checked' && !cards.length ? (
                <>
                  <C k="proposal.checkedIntro" as="p" className={a.note} />
                  <CheckedTable rows={p.checked} />
                </>
              ) : null}

              {shownSection === 'note' ? <NoteBox value={note} readOnly={!deciding} onChange={(v) => (setNotice(null), setDecisions((d) => ({ ...d, note: v })))} /> : null}

              {deciding ? (
                <ActionBar
                  line={
                    <>
                      <p className={s.tally}>{countLine.length ? countLine.map((c) => <span key={c}>{c}</span>) : <C k="footer.counts.none" />}</p>
                      <BarNotice notice={notice} unsaved={hasEdits(edits)} undecided={undecided} allRejected={Boolean(counts && counts.open && counts.rejected === counts.open)} />
                    </>
                  }
                  summary={<C k={note.trim() ? 'footer.summaryNote' : 'footer.summary'} as="p" className={s.barNotice} vars={summaryVars} />}
                  confirming={confirming}
                  onConfirming={setConfirming}
                  onSave={() => void send(false)}
                  onBuild={() => void send(true)}
                  saveDisabled={!hasEdits(edits) || busy !== null}
                  buildDisabled={busy !== null}
                  busy={busy === 'save' || busy === 'build' ? busy : null}
                  saveHint={t('footer.saveHint')}
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <LatestRun runs={data.runs} />
      {data.runs.length ? (
        <section className={s.section}>
          <C k="runs.title" as="h2" className={s.sectionTitle} />
          <RunList runs={data.runs.slice(0, 6)} />
        </section>
      ) : null}
    </>
  );
}

/** Reached events with nothing to decide: the event, and why the change leaves it alone. */
function CheckedTable({ rows }: { rows: { name: string; why: string }[] }) {
  return (
    <div className={t2.tableWrap}>
      <table className={t2.table}>
        <thead>
          <tr>
            <C k="proposal.checkedColumns.event" as="th" />
            <C k="proposal.checkedColumns.why" as="th" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name}>
              <td className={`${s.mono} ${t2.main}`} style={{ whiteSpace: 'nowrap' }}>
                {c.name}
              </td>
              <td className={t2.faint} style={{ whiteSpace: 'normal' }}>
                {c.why}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A wanted item on the Built tab: built, or still to build. */
function BuiltRow({ item }: { item: ProposalItem }) {
  return <WorkRow id={item.id} title={<span className={s.mono}>{item.target}</span>} summary={item.implemented ? item.summary : (item.unproven ?? <C k="proposal.notBuilt" />)} details={false} />;
}

/** Not built: the event, the property, and why it wasn't built, one row per problem. */
function NotBuiltTable({ rows }: { rows: NotBuiltRow[] }) {
  return (
    <div className={t2.tableWrap}>
      <table className={t2.table}>
        <thead>
          <tr>
            <C k="proposal.notBuiltColumns.event" as="th" />
            <C k="proposal.notBuiltColumns.property" as="th" />
            <C k="proposal.notBuiltColumns.why" as="th" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={`${s.mono} ${t2.main}`} style={{ whiteSpace: 'nowrap' }}>
                {r.event ?? ''}
              </td>
              <td className={`${s.mono} ${t2.main}`} style={{ whiteSpace: 'nowrap' }}>
                {r.property ?? ''}
              </td>
              <td className={t2.faint} style={{ whiteSpace: 'normal' }}>
                {r.why ?? <C k="proposal.notBuilt" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The one line beside the buttons: what just happened, or what Build it will do. */
function BarNotice({ notice, unsaved, undecided, allRejected }: { notice: Notice; unsaved: boolean; undecided: number; allRejected: boolean }) {
  if (notice && 'refusal' in notice) return <RefusalLine refusal={notice.refusal} />;
  if (notice) return <C k={notice.key} vars={notice.vars} as="p" className={`${s.barNotice} ${notice.warn ? s.barNoticeWarn : ''}`} />;
  if (allRejected) return <C k="footer.allRejected" as="p" className={s.barNotice} />;
  if (undecided) return <C k={undecided === 1 ? 'footer.approveKeepsUndecidedOne' : 'footer.approveKeepsUndecided'} vars={{ n: String(undecided) }} as="p" className={s.barNotice} />;
  if (unsaved) return <C k="footer.unsaved" as="p" className={s.barNotice} />;
  return <p className={s.barNotice} />;
}

function RefusalLine({ refusal }: { refusal: Refusal }) {
  const cls = `${s.barNotice} ${s.barNoticeWarn}`;
  if (refusal.code === 'notReviewer') return <C k="refusals.notReviewer" as="p" className={cls} vars={{ reviewers: refusal.reviewers.join(', ') }} />;
  if (refusal.code === 'error') return <C k="refusals.error" as="p" className={cls} vars={{ message: refusal.message }} />;
  if (refusal.code === 'invalid')
    return (
      <div className={cls} role="alert">
        <C k="refusals.invalid" as="p" />
        <ul className={s.list}>
          {refusal.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  return <C k={`refusals.${refusal.code}`} as="p" className={cls} />;
}

/**
 * Where the pull request stands, in one line with its one action: Datalyze working on it (its run on
 * GitHub), built and waiting to be merged (it needs someone until it is), or merged or closed (done:
 * nothing more is built on it).
 */
function PrStageBanner({ pull, state, run }: { pull: Pick<GhPull, 'state' | 'merged_at' | 'html_url' | 'number'>; state: ScreenState; run: Run | undefined }) {
  const quiet = { borderColor: 'var(--border-strong)', background: 'transparent' };
  const amber = { borderColor: 'rgba(224, 164, 88, 0.4)', background: 'rgba(224, 164, 88, 0.06)' };
  if (pull.state !== 'open') {
    return (
      <div className={t2.failBox} style={quiet}>
        <C k={pull.merged_at ? 'pr.stage.merged' : 'pr.stage.closed'} as="p" />
      </div>
    );
  }
  if (run) {
    return (
      <div className={t2.failBox} style={quiet}>
        <C k="pr.stage.running" as="p" />
        <span className={t2.headActions}>
          <a href={run.url} target="_blank" rel="noopener noreferrer" className={a.button}>
            <C k="pr.stage.github" /> ↗
          </a>
        </span>
      </div>
    );
  }
  if (state === 'implemented') {
    return (
      <div className={t2.failBox} style={amber}>
        <C k="pr.stage.toMerge" as="strong" />
        <span className={t2.headActions}>
          <a href={pull.html_url} target="_blank" rel="noopener noreferrer" className={`${a.button} ${a.buttonPrimary}`}>
            <C k="pr.stage.merge" vars={{ n: String(pull.number) }} />
          </a>
        </span>
      </div>
    );
  }
  return null;
}
