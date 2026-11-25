import type { ElementType, ReactNode } from 'react';
import { rich, stripRich } from '@/lib/content/rich';
import { reviewText } from '@/lib/content/trackingAgentReview';
import { trackingAgentGithubContent } from '@/lib/content/trackingAgentGithub';

/**
 * Copy for the review screens: every string comes from
 * content/tracking-agent-review.json, rendered through rich() on an element
 * carrying its data-ck path, so /admin can click-to-edit it.
 */

/** Plain text for attributes (placeholder, aria-label, title). */
export const t = (k: string, vars?: Record<string, string>) => stripRich(reviewText(k, vars));

/** `crossPage`: on a page whose own content file is another one (the dashboard), so /admin edits this file. */
export function C({ k, as, vars, className, children, crossPage }: { k: string; as?: ElementType; vars?: Record<string, string>; className?: string; children?: ReactNode; crossPage?: boolean }) {
  const Tag = as ?? 'span';
  return (
    <Tag className={className} data-ck={k} {...(crossPage ? { 'data-ck-page': 'trackingAgentReview' } : {})}>
      {rich(reviewText(k, vars))}
      {children}
    </Tag>
  );
}

type GithubKey = keyof typeof trackingAgentGithubContent.signIn;

/** Shared GitHub sign-in copy (content/tracking-agent-github.json). */
export function G({ k, as, className }: { k: GithubKey; as?: ElementType; className?: string }) {
  const Tag = as ?? 'span';
  return (
    <Tag className={className} data-ck={`signIn.${k}`} data-ck-page="trackingAgentGithub">
      {rich(trackingAgentGithubContent.signIn[k])}
    </Tag>
  );
}

/** snake_case (field names, stages) to the camelCase keys the content file uses. */
export const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
