'use client';

import type { ReactNode } from 'react';
import account from '@/components/account/account.module.css';
import { rich } from '@/lib/content/rich';
import s from './setup.module.css';

/** Fills `{name}` placeholders in a content string. */
export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

export type Option = { id: string; label: string; hint?: string };

/** One step's card: title and one or two plain sentences on what it does. */
export function StepCard({ ck, title, body, children }: { ck: string; title: string; body: string; children?: ReactNode }) {
  return (
    <section className={`${account.card} ${s.stepCard}`}>
      <header className={s.stepHead}>
        <h2 className={s.stepTitle} data-ck={`${ck}.title`}>
          {rich(title)}
        </h2>
        <p className={s.stepBody} data-ck={`${ck}.body`}>
          {rich(body)}
        </p>
      </header>
      {children}
    </section>
  );
}

export function Section({ title, ck, children }: { title?: string; ck?: string; children: ReactNode }) {
  return (
    <div className={s.section}>
      {title ? (
        <h3 className={s.sectionTitle} data-ck={ck}>
          {rich(title)}
        </h3>
      ) : null}
      {children}
    </div>
  );
}

/** Radio cards. `ck` is the options array's path, e.g. "model.providers". */
export function Choices({
  name,
  options,
  value,
  onChange,
  ck,
  disabled = [],
}: {
  name: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  ck: string;
  disabled?: string[];
}) {
  return (
    <div className={s.choices} role="radiogroup">
      {options.map((o, i) => {
        const off = disabled.includes(o.id);
        return (
          <label key={o.id} className={`${s.choice}${value === o.id ? ` ${s.choiceOn}` : ''}${off ? ` ${s.choiceDisabled}` : ''}`}>
            <input type="radio" name={name} value={o.id} checked={value === o.id} disabled={off} onChange={() => onChange(o.id)} />
            <span className={s.choiceText}>
              <span className={s.choiceLabel} data-ck={`${ck}.${i}.label`}>
                {rich(o.label)}
              </span>
              {o.hint ? (
                <span className={s.choiceHint} data-ck={`${ck}.${i}.hint`}>
                  {rich(o.hint)}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/** A labelled text input, its hint between the label and the box. `label` may be a content string (with `ck`) or a fixed name like a secret's. */
export function Field({
  label,
  ck,
  value,
  onChange,
  hint,
  hintCk,
  type = 'text',
  wide,
  multiline,
  mono,
  placeholder,
  autoComplete,
  error,
  errorCk,
}: {
  label: string;
  ck?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  hintCk?: string;
  /** What's wrong with the value, shown under the input (a content string with `errorCk`). */
  error?: string;
  errorCk?: string;
  type?: 'text' | 'password' | 'url';
  wide?: boolean;
  multiline?: boolean;
  mono?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className={`${account.fieldLabel}${wide ? ` ${s.fieldWide}` : ''}`}>
      <span data-ck={ck} className={mono ? s.mono : undefined}>
        {ck ? rich(label) : label}
      </span>
      {hint ? (
        <span className={account.fieldHint} data-ck={hintCk}>
          {hintCk ? rich(hint) : hint}
        </span>
      ) : null}
      {multiline ? (
        <textarea className={`${account.input} ${s.textarea}`} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoComplete={autoComplete ?? 'off'} placeholder={placeholder} />
      ) : (
        <input
          className={account.input}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          // Chrome ignores "off" on a password field and fills in a saved site password; "new-password" it respects.
          autoComplete={autoComplete ?? (type === 'password' ? 'new-password' : 'off')}
          placeholder={placeholder}
        />
      )}
      {error ? (
        <span className={account.error} role="alert" data-ck={errorCk}>
          {errorCk ? rich(error) : error}
        </span>
      ) : null}
    </label>
  );
}

export function Checkbox({ checked, onChange, label, ck, hint, hintCk }: { checked: boolean; onChange: (v: boolean) => void; label: string; ck: string; hint?: string; hintCk?: string }) {
  return (
    <label className={s.checkboxRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={s.choiceText}>
        <span data-ck={ck}>{rich(label)}</span>
        {hint ? (
          <span className={s.choiceHint} data-ck={hintCk}>
            {rich(hint)}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export function Button({
  children,
  onClick,
  primary,
  disabled,
  ck,
  href,
  external,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  ck?: string;
  href?: string;
  external?: boolean;
}) {
  const className = `${account.button}${primary ? ` ${account.buttonPrimary}` : ''}`;
  if (href) {
    return (
      <a className={className} href={href} data-ck={ck} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} data-ck={ck}>
      {children}
    </button>
  );
}
