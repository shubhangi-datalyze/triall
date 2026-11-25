'use client';

import { useEffect, useState } from 'react';
import a from '@/components/account/account.module.css';
import { rich } from '@/lib/content/rich';
import { openWorkspace } from '@/components/account/account-shell';
import { DatalyzeApiError, getTeam, inviteToTeam, leaveTeam, removeFromTeam, setTeamRole, type AuthHeader, type TeamView } from '@/lib/tracking-agent/setup/datalyze-api';
import { T, day, plain, text } from './shared';
import s from './app.module.css';

/** The server's error codes (team-api.ts) and their words in content (team.errors). */
const ERRORS: Record<string, string> = { bad_email: 'badEmail', already_in: 'alreadyIn', admin_only: 'adminOnly', not_found: 'notFound', too_many: 'tooMany', owner_cannot_leave: 'ownerCannotLeave' };
const errorKey = (e: unknown) => `team.errors.${(e instanceof DatalyzeApiError && ERRORS[e.message]) || 'failed'}`;

type Invited = { email: string; emailed: boolean; link: string };

/**
 * Setup's Team section: the owner, admins and members, and pending invites.
 * Everyone in the workspace sees the list; admins (the owner counts as one)
 * invite by email, change roles and remove people. The server checks the role
 * on every change, so hiding the buttons is only for the eye. Anyone but the
 * owner can leave, after a second click to confirm; the page then opens
 * another workspace they're in (or their own).
 *
 * `preview` renders fixtures for /admin, with nothing sent.
 */
export function TeamSection({ authHeader, preview }: { authHeader: AuthHeader | null; preview?: { team: TeamView; invited?: Invited } }) {
  const [team, setTeam] = useState<TeamView | null>(preview?.team ?? null);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<Invited | null>(preview?.invited ?? null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (preview || !authHeader) return;
    let live = true;
    getTeam(authHeader).then(
      (t) => live && (setFailed(false), setTeam(t)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [authHeader, preview, attempt]);

  const run = async (id: string, change: () => Promise<TeamView | void>) => {
    if (!authHeader) return;
    setBusy(id);
    setError(null);
    try {
      const next = await change();
      if (next) setTeam(next);
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(null);
    }
  };

  const invite = () =>
    run('invite', async () => {
      const r = await inviteToTeam(authHeader!, email.trim(), role);
      setInvited({ email: r.invite.email, emailed: r.emailed, link: r.inviteLink });
      setEmail('');
      return getTeam(authHeader!);
    });

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const admin = team ? team.role !== 'member' : false;

  const leave = () =>
    run('leave', async () => {
      await leaveTeam(authHeader!);
      // Whichever workspace the server opens next: another they're in, or their own.
      openWorkspace(null);
    });

  return (
    <section className={s.section}>
      <div className={s.sectionHead}>
        <T k="team.title" as="h2" className={s.sectionTitle} />
      </div>
      <T k="team.intro" as="p" className={a.note} />
      {failed ? (
        <p className={a.error}>
          <T k="team.loadFailed" />{' '}
          <button type="button" className={a.linkButton} onClick={() => setAttempt((n) => n + 1)} data-ck="dashboard.retry">
            {rich(text('dashboard.retry'))}
          </button>
        </p>
      ) : !team ? (
        <div className={a.skeleton} style={{ height: 120 }} aria-busy="true" />
      ) : (
        <>
          <ul className={s.rows} role="list">
            {team.people.map((p) => (
              <li key={p.userId} className={s.row}>
                <div className={s.rowMain}>
                  <span className={s.rowTitle}>
                    {p.email}
                    {p.userId === team.you ? (
                      <>
                        {' '}
                        <span className={a.note}>
                          (<T k="team.you" />)
                        </span>
                      </>
                    ) : null}
                  </span>
                  <div className={s.rowMeta}>
                    <T k="team.joined" vars={{ date: day(p.joinedAt) }} />
                  </div>
                </div>
                <div className={s.rowSide}>
                  <span className={s.pill} data-ck={`team.roles.${p.role}`}>
                    {rich(text(`team.roles.${p.role}`))}
                  </span>
                  {/* Not on your own row: an admin can't lock themselves out by a slip. */}
                  {admin && p.role !== 'owner' && p.userId !== team.you ? (
                    <>
                      <button
                        type="button"
                        className={a.button}
                        disabled={busy !== null}
                        onClick={() => void run(p.userId, () => setTeamRole(authHeader!, p.userId, p.role === 'admin' ? 'member' : 'admin'))}
                        data-ck={p.role === 'admin' ? 'team.makeMember' : 'team.makeAdmin'}
                      >
                        {rich(text(p.role === 'admin' ? 'team.makeMember' : 'team.makeAdmin'))}
                      </button>
                      <button type="button" className={a.button} disabled={busy !== null} onClick={() => void run(p.userId, () => removeFromTeam(authHeader!, { userId: p.userId }))} data-ck="team.remove">
                        {rich(text('team.remove'))}
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
            {team.invites.map((i) => (
              <li key={i.id} className={s.row}>
                <div className={s.rowMain}>
                  <span className={s.rowTitle}>{i.email}</span>
                  <div className={s.rowMeta}>
                    <T k="team.invitedOn" vars={{ date: day(i.createdAt) }} />
                  </div>
                </div>
                <div className={s.rowSide}>
                  <span className={`${s.pill} ${s.pillNeedsApproval}`} data-ck="team.pending">
                    {rich(text('team.pending'))}
                  </span>
                  <span className={s.pill} data-ck={`team.roles.${i.role}`}>
                    {rich(text(`team.roles.${i.role}`))}
                  </span>
                  {admin ? (
                    <button type="button" className={a.button} disabled={busy !== null} onClick={() => void run(i.id, () => removeFromTeam(authHeader!, { inviteId: i.id }))} data-ck="team.cancelInvite">
                      {rich(text('team.cancelInvite'))}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {error ? <T k={error} as="p" className={a.error} /> : null}
          {admin ? (
            <div className={a.card} style={{ marginTop: 16 }}>
              <T k="team.inviteTitle" as="h3" className={a.cardTitle} />
              <T k="team.inviteHint" as="p" className={a.note} />
              <div className={s.inline}>
                <label>
                  <T k="team.emailLabel" className={s.fieldLabel} />
                  <input className={s.input} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={plain('team.emailPlaceholder')} />
                </label>
                <label>
                  <T k="team.roleLabel" className={s.fieldLabel} />
                  <select className={s.input} value={role} onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'member')}>
                    <option value="member">{plain('team.roles.member')}</option>
                    <option value="admin">{plain('team.roles.admin')}</option>
                  </select>
                </label>
                <div>
                  <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={busy !== null || !email.trim()} onClick={() => void invite()} data-ck={busy === 'invite' ? 'team.inviting' : 'team.invite'}>
                    {rich(text(busy === 'invite' ? 'team.inviting' : 'team.invite'))}
                  </button>
                </div>
                {invited ? (
                  <>
                    <T k={invited.emailed ? 'team.sent' : 'team.sendLink'} vars={{ email: invited.email }} as="p" className={a.note} />
                    <div className={a.cardActions}>
                      <input className={`${s.input} ${s.mono}`} readOnly value={invited.link} onFocus={(e) => e.currentTarget.select()} aria-label={plain('team.copy')} />
                      <button type="button" className={a.button} onClick={() => void copy(invited.link)} data-ck={copied ? 'team.copied' : 'team.copy'}>
                        {rich(text(copied ? 'team.copied' : 'team.copy'))}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <T k="team.memberNote" as="p" className={a.note} />
          )}
          {team.role !== 'owner' ? (
            <div className={a.cardActions}>
              {confirmLeave ? (
                <>
                  <T k="team.leaveConfirm" vars={{ workspace: team.workspace }} as="p" className={a.note} />
                  <button type="button" className={`${a.button} ${a.buttonPrimary}`} disabled={busy !== null} onClick={() => void leave()} data-ck={busy === 'leave' ? 'team.leaving' : 'team.leaveYes'}>
                    {rich(text(busy === 'leave' ? 'team.leaving' : 'team.leaveYes'))}
                  </button>
                  <button type="button" className={a.button} disabled={busy !== null} onClick={() => setConfirmLeave(false)} data-ck="team.leaveNo">
                    {rich(text('team.leaveNo'))}
                  </button>
                </>
              ) : (
                <button type="button" className={a.button} disabled={busy !== null || !authHeader} onClick={() => setConfirmLeave(true)} data-ck="team.leave">
                  {rich(text('team.leave'))}
                </button>
              )}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
