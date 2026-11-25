'use client';

import { Fragment, useState } from 'react';
import { Chip, When, type Tone } from '@/components/tracking-agent/app/ui';
import t from '@/components/tracking-agent/app/app.module.css';
import { fromAnswers } from '@/lib/tracking-agent/audit';
import { failureKey, type Run } from '@/lib/tracking-agent/runs';
import { C } from './copy';
import { finished, RunSteps } from './run-record';
import s from './review.module.css';

const TONE: Record<Run['state'], Tone> = { queued: 'run', running: 'run', done: 'ok', failed: 'bad', cancelled: 'idle' };

/**
 * Runs as GitHub Actions reports them, one row each: state, what it ran, who started it, when, and
 * its log. A failure GitHub explains (a refused workflow file, a time-out) says so in a few words
 * under the run; a plain failure's reason is in its log. A finished run's Steps opens its record
 * (RUN-LOG.md): every step it went through and what needs a look. `repoOf`: a Repo column, on the dashboard.
 * `crossPage`: shown on the dashboard, whose own copy is another file.
 */
export function RunList({ runs, crossPage, repoOf }: { runs: Run[]; crossPage?: boolean; repoOf?: (r: Run) => string }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  if (!runs.length) return <C k="runs.empty" as="p" className={s.muted} crossPage={crossPage} />;
  const toggle = (id: number) => setOpen((o) => {
    const next = new Set(o);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const columns = repoOf ? 6 : 5;
  return (
    <div className={t.tableWrap}>
      <table className={t.table}>
        <thead>
          <tr>
            <C k="runs.columns.state" as="th" crossPage={crossPage} />
            <C k="runs.columns.run" as="th" crossPage={crossPage} />
            {repoOf ? <C k="runs.columns.repo" as="th" crossPage={crossPage} /> : null}
            <C k="runs.columns.by" as="th" crossPage={crossPage} />
            <C k="runs.columns.when" as="th" crossPage={crossPage} />
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => {
            const reason = failureKey(r);
            const shown = open.has(r.id);
            return (
              <Fragment key={r.id}>
              <tr>
                <td>
                  <Chip tone={TONE[r.state]}>
                    <C k={`runs.states.${r.state}`} crossPage={crossPage} />
                  </Chip>
                </td>
                <td className={t.main}>
                  <C k={`runs.jobs.${r.job}`} crossPage={crossPage} />
                  {r.pr !== null ? (
                    <>
                      {' '}
                      <C k="runs.forPr" vars={{ n: String(r.pr) }} crossPage={crossPage} />
                    </>
                  ) : fromAnswers(r) ? (
                    <>
                      {' '}
                      <C k="runs.forAnswers" crossPage={crossPage} />
                    </>
                  ) : r.findings.length ? (
                    <>
                      {' '}
                      <C k="runs.forFindings" vars={{ ids: r.findings.join(', ') }} crossPage={crossPage} />
                    </>
                  ) : null}
                  {reason && reason !== 'failed' && reason !== 'cancelled' ? <C k={`runs.reasons.${reason}`} as="div" className={t.faint} crossPage={crossPage} /> : null}
                </td>
                {repoOf ? <td className={s.mono}>{repoOf(r)}</td> : null}
                <td>{r.actor ? `@${r.actor}` : ''}</td>
                <td className={t.faint}>
                  <When iso={r.createdAt} />
                </td>
                <td className={t.right}>
                  {finished(r) ? (
                    <>
                      <button type="button" className={s.runStepsToggle} aria-expanded={shown} onClick={() => toggle(r.id)}>
                        <C k={shown ? 'runs.hideSteps' : 'runs.steps'} crossPage={crossPage} />
                      </button>{' '}
                    </>
                  ) : null}
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className={t.link}>
                    <C k="runs.log" crossPage={crossPage} />
                  </a>
                </td>
              </tr>
              {shown ? (
                <tr className={s.runStepsRow}>
                  <td colSpan={columns}>
                    <RunSteps run={r} crossPage={crossPage} />
                  </td>
                </tr>
              ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
