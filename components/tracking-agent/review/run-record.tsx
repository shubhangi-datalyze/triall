'use client';

import { useEffect, useState } from 'react';
import { Chip, type Tone } from '@/components/tracking-agent/app/ui';
import t from '@/components/tracking-agent/app/app.module.css';
import { useGitHubSession } from '@/lib/tracking-agent/github/session';
import { issues, loadRunRecord, repoOfRunUrl, type RecordResult, type RecordStep, type RunRecord, type StepStatus } from '@/lib/tracking-agent/run-record';
import type { Run } from '@/lib/tracking-agent/runs';
import { C, camel } from './copy';
import s from './review.module.css';

const TONE: Record<StepStatus, Tone> = { ok: 'ok', warn: 'warn', failed: 'bad', skipped: 'idle' };
const OUTCOME_TONE: Record<RunRecord['outcome'], Tone> = { ok: 'ok', ok_with_warnings: 'warn', failed: 'bad' };

type Load = { kind: 'loading' } | { kind: 'error' } | RecordResult;

/** A run's record, read once it's asked for. */
function useRecord(run: Run | null): Load | null {
  const { client } = useGitHubSession();
  const [got, setGot] = useState<Load | null>(null);
  // By the run's id and link, not the object: the screens reload their runs while one is going.
  const id = run?.id ?? null;
  const url = run?.url ?? null;
  useEffect(() => {
    const repo = url ? repoOfRunUrl(url) : null;
    if (id === null || !client || !repo) return;
    let live = true;
    setGot((g) => (g?.kind === 'record' ? g : { kind: 'loading' }));
    loadRunRecord(client, repo, id).then(
      (r) => live && setGot(r),
      () => live && setGot({ kind: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [id, url, client]);
  return got;
}

function StepTable({ steps, crossPage }: { steps: RecordStep[]; crossPage?: boolean }) {
  return (
    <div className={t.tableWrap}>
      <table className={t.table}>
        <thead>
          <tr>
            <C k="runs.record.columns.status" as="th" crossPage={crossPage} />
            <C k="runs.record.columns.step" as="th" crossPage={crossPage} />
            <C k="runs.record.columns.what" as="th" crossPage={crossPage} />
          </tr>
        </thead>
        <tbody>
          {steps.map((st, i) => (
            <tr key={`${st.id}-${st.area ?? ''}-${i}`}>
              <td>
                <Chip tone={TONE[st.status]}>
                  <C k={`runs.record.statuses.${st.status}`} crossPage={crossPage} />
                </Chip>
              </td>
              <td className={t.main}>
                <span className={s.mono}>{st.id}</span> {st.title}
              </td>
              <td className={t.faint}>{st.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How a run went: its outcome, the steps that need a look, and every step folded away. */
export function RecordView({ record, crossPage, compact }: { record: RunRecord; crossPage?: boolean; compact?: boolean }) {
  const look = issues(record);
  const c = record.counts;
  return (
    <div className={s.runRecord}>
      <p className={s.runRecordHead}>
        <Chip tone={OUTCOME_TONE[record.outcome]}>
          <C k={`runs.record.outcomes.${camel(record.outcome)}`} crossPage={crossPage} />
        </Chip>{' '}
        <C k="runs.record.counts" vars={{ ok: String(c.ok), warn: String(c.warn), failed: String(c.failed), skipped: String(c.skipped) }} className={t.faint} crossPage={crossPage} />
      </p>
      {look.length ? (
        <>
          <C k="runs.record.needsLook" as="h3" className={s.runRecordTitle} crossPage={crossPage} />
          <StepTable steps={look} crossPage={crossPage} />
        </>
      ) : null}
      {compact ? null : (
        <details className={s.runRecordAll}>
          <C k="runs.record.allSteps" as="summary" crossPage={crossPage} />
          <StepTable steps={record.steps} crossPage={crossPage} />
        </details>
      )}
    </div>
  );
}

/** The record of one run in the runs list, read when the row is opened. */
export function RunSteps({ run, crossPage }: { run: Run; crossPage?: boolean }) {
  const got = useRecord(run);
  if (!got || got.kind === 'loading') return <C k="runs.record.loading" as="p" className={s.muted} crossPage={crossPage} />;
  if (got.kind === 'error') return <C k="runs.record.error" as="p" className={s.muted} crossPage={crossPage} />;
  if (got.kind === 'none') return <C k="runs.record.none" as="p" className={s.muted} crossPage={crossPage} />;
  return <RecordView record={got.record} crossPage={crossPage} />;
}

/** Whether a run has finished, so it may have a record. */
export const finished = (r: Run) => r.state === 'done' || r.state === 'failed';

/**
 * How the newest finished run among `runs` went, above the runs list: on the audit screen the last
 * audit, on a pull request its last review or build. Nothing shows until its record is read, and
 * nothing at all for a run without one.
 */
export function LatestRun({ runs, crossPage }: { runs: Run[]; crossPage?: boolean }) {
  const run = runs.find(finished) ?? null;
  const got = useRecord(run);
  if (!run || !got || got.kind !== 'record') return null;
  return (
    <section className={s.section}>
      <C k="runs.record.latestTitle" as="h2" className={s.sectionTitle} crossPage={crossPage} />
      <RecordView record={got.record} crossPage={crossPage} compact />
    </section>
  );
}
