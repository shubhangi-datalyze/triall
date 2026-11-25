import type { ReactNode } from 'react';
import CopyButton from './CopyButton';
import styles from './blocks.module.css';

/**
 * A fenced code block with its language shown and a copy button.
 *
 * The <pre> comes from markdown, so the code is in the DOM and selectable
 * whatever happens to the script. The copy button is the only part that needs
 * JavaScript, and it renders nothing until it can actually work.
 */

/** The text inside a <pre><code>, for the clipboard. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

/** "language-sql" on the inner <code> is where markdown records the language. */
function languageOf(node: ReactNode): string | null {
  if (node && typeof node === 'object' && 'props' in node) {
    const className = (node as { props: { className?: string } }).props.className ?? '';
    const match = className.match(/language-([\w-]+)/);
    if (match && match[1] !== 'text') return match[1];
  }
  return null;
}

export default function CodeBlock({ children }: { children?: ReactNode }) {
  const code = textOf(children);
  const language = languageOf(children);

  return (
    <div className={styles.codeWrap}>
      <div className={styles.codeBar}>
        <span className={styles.codeLang}>{language ?? ''}</span>
        <CopyButton value={code} label="Copy" copiedLabel="Copied" />
      </div>
      <pre className={styles.codePre}>{children}</pre>
    </div>
  );
}
