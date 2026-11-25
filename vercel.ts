import { type VercelConfig } from '@vercel/config/v1';

// Scheduled jobs.
//
// Two entries, deliberately different modes - this split is load-bearing:
//
//   weekly  (incremental) picks up new Ghost posts and the last 30 days of
//           LinkedIn. It does NOT reconcile deletes, because an incremental
//           pull returns a recent slice and treating everything it didn't
//           return as deleted would tombstone the entire back catalogue.
//
//   monthly (full) pulls the complete history and reconciles deletes. This is
//           the only run allowed to mark anything deleted.
//
// See lib/kb/sources/linkedin.ts for the full reasoning.
export const config: VercelConfig = {
  // Skip the build only when nothing outside pravix/ changed since the last
  // successful deployment of this branch. pravix/ is its own Vercel project
  // (pravix/vercel.json). Vercel reads exit 0 as skip, 1 as build and anything
  // else as a failed deployment, so every other outcome (no previous SHA, a SHA
  // the shallow clone lacks, no git) is turned into 1: build.
  ignoreCommand:
    'if [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \':(exclude)pravix\' 2>/dev/null; then exit 0; fi; exit 1',
  crons: [
    { path: '/api/kb/sync', schedule: '0 3 * * 1' },
    // Same path as the weekly run. The route tells them apart by the
    // `x-vercel-cron-schedule` header, so this string must stay in sync with
    // FULL_RUN_SCHEDULE in app/api/kb/sync/route.ts.
    { path: '/api/kb/sync', schedule: '0 4 1 * *' },
    // An hour after the weekly sync, so the digest reflects a fresh index.
    { path: '/api/kb/digest', schedule: '0 4 * * 1' },
    // Daily: tell IndexNow (Bing, and the AI search built on it) about pages
    // whose lastmod changed in the last few days.
    { path: '/api/indexnow/cron', schedule: '30 5 * * *' },
    // Every six hours: saved Tracking Agent repo records a webhook missed, or a
    // day old, are read again (app/api/tracking-agent/github/refresh-facts).
    { path: '/api/tracking-agent/github/refresh-facts', schedule: '15 */6 * * *' },
    // Every minute: queued verification shards start as others end, under each workspace's limit
    // (app/api/tracking-agent/verify/dispatch).
    { path: '/api/tracking-agent/verify/dispatch', schedule: '* * * * *' },
  ],
};
