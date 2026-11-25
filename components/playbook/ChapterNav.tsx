'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import styles from './ChapterNav.module.css';

/**
 * The chapter list. On desktop it is a left sidebar behind a hamburger button,
 * collapsed by default so the chapter sits alone in the middle of the page;
 * the reader's choice is remembered. Below 1024px it is a sheet behind a
 * button in the sticky header.
 *
 * The current chapter expands to show its H2s, which is the table of contents.
 * There is no third column: the contents live inside the one nav, where a
 * reader already is.
 *
 * Scroll spy runs off IntersectionObserver and only ever adds a highlight. The
 * list is in the HTML even while collapsed, so it is still a complete set of
 * working links for crawlers.
 */

const EXPANDED_KEY = 'playbook:nav-expanded';
const EXPANDED_EVENT = 'playbook:nav-expanded';

function readExpanded(): boolean {
  try {
    return window.localStorage.getItem(EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}

function subscribeExpanded(onChange: () => void): () => void {
  window.addEventListener(EXPANDED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EXPANDED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function writeExpanded(expanded: boolean): void {
  try {
    window.localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0');
  } catch {
    // Not remembering the choice is a nuisance, not a failure.
  }
  window.dispatchEvent(new Event(EXPANDED_EVENT));
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        d="M2 4.5h14M2 9h14M2 13.5h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type NavPart = {
  part: string;
  label: string;
  chapters: { slug: string; title: string; order: number }[];
};

export default function ChapterNav({
  parts,
  currentSlug,
  headings,
  labels,
}: {
  parts: NavPart[];
  currentSlug?: string;
  headings?: { id: string; text: string }[];
  labels: {
    allChapters: string;
    openChapters: string;
    closeChapters: string;
    showChapters: string;
    hideChapters: string;
    inThisChapter: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetId = useId();
  const listId = useId();
  // The server has no stored choice, so it renders collapsed; a reader who
  // left the list open sees it open once the page hydrates, and straight away
  // on every chapter they move to after that.
  const expanded = useSyncExternalStore(subscribeExpanded, readExpanded, () => false);

  // Scroll spy. rootMargin pulls the trigger line up near the top of the
  // viewport, so a heading becomes "current" as it reaches the top rather than
  // when it first appears at the bottom.
  useEffect(() => {
    if (!headings?.length) return;
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );

    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [headings]);

  // The sheet is a dialog in everything but name: Escape closes it, focus goes
  // into it on open and back to the button on close, and Tab cannot leave it.
  useEffect(() => {
    if (!open) return;

    const sheet = sheetRef.current;
    const focusable = sheet?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusable?.[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const list = (
    <nav className={styles.nav} aria-label={labels.allChapters}>
      {parts.map((part) => (
        // Part labels are plain text, not headings: the nav comes before the
        // chapter's H1 in the HTML, and headings here would open the page's outline.
        <div key={part.part} className={styles.part}>
          <p className={styles.partLabel}>
            <Link href={`/playbook/part/${part.part}`} className={styles.partLink}>
              {part.label}
            </Link>
          </p>
          <ol className={styles.chapters}>
            {part.chapters.map((chapter) => {
              const current = chapter.slug === currentSlug;
              return (
                <li key={chapter.slug}>
                  <Link
                    href={`/playbook/${chapter.slug}`}
                    className={current ? styles.chapterCurrent : styles.chapter}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <span className={styles.number}>{chapter.order}</span>
                    {chapter.title}
                  </Link>

                  {current && headings && headings.length > 0 ? (
                    <ul className={styles.headings} aria-label={labels.inThisChapter}>
                      {headings.map((heading) => (
                        <li key={heading.id}>
                          <a
                            href={`#${heading.id}`}
                            className={
                              activeHeading === heading.id ? styles.headingActive : styles.heading
                            }
                            aria-current={activeHeading === heading.id ? 'true' : undefined}
                            onClick={() => setOpen(false)}
                          >
                            {heading.text}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* data-nav is what the page layout reads (with :has) to make room for
          the list or to centre the chapter. */}
      <div className={styles.sidebar} data-nav={expanded ? 'open' : 'closed'}>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={expanded ? labels.hideChapters : labels.showChapters}
          title={expanded ? labels.hideChapters : labels.showChapters}
          onClick={() => writeExpanded(!expanded)}
        >
          <MenuIcon />
        </button>
        <div id={listId} className={styles.sidebarList}>
          {list}
        </div>
      </div>

      <div className={styles.bar}>
        <button
          ref={buttonRef}
          type="button"
          className={styles.toggle}
          aria-expanded={open}
          aria-controls={sheetId}
          onClick={() => setOpen((was) => !was)}
        >
          <MenuIcon />
          {open ? labels.closeChapters : labels.openChapters}
        </button>
      </div>

      {open ? (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div
            ref={sheetRef}
            id={sheetId}
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-label={labels.allChapters}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.sheetHead}>
              <button
                type="button"
                className={styles.sheetClose}
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
              >
                {labels.closeChapters}
              </button>
            </div>
            {list}
          </div>
        </div>
      ) : null}
    </>
  );
}
