---
id: data-health-check
name: Data health check
used_by: [pull-number, explain-change, find-opportunities, judge-result, reconcile-numbers, audit]
knowledge: [data-accuracy-as-a-system, event-verification, identity-stitching, data-loss, sense-checking-numbers, metric-definitions]
---

# Data health check

Run this on every event, property and table the answer depends on, over the period in question plus a few weeks before it. It takes a few queries and saves you from explaining a tracking bug as user behaviour.

Run it even when the user says the data is accurate for the period; they may be right, and the check is how you know. If you found breaks earlier in the conversation, start by listing which fall inside this window and how they affect this question. Tell the user before you go on if any do.

1. **Is the event still flowing?** Plot daily volume. Look for a day it stopped, dropped sharply or spiked. A cliff on one date is a release, a tracking change or an outage. Check whether the events still fire correctly before calling it either way: a release that broke the signup flow is a real drop, not bad data.
2. **Are key properties still filled?** Plot the share of null or "not set" for each property you will break down by. A property that suddenly goes empty doesn't move the event count, so nothing else will catch it.
3. **Has a distribution shifted?** Look at the mix of platform, app version, country and source over time. Google going from 50% to 10% of signups can be real or a broken UTM capture; either way it changes the answer.
4. **Are events firing twice?** Plot events per user over time. A step up on one date means duplicate firing. For once-per-user events (signup, first purchase), count users with more than one.
5. **Is identity holding?** If the number is per user, compare the analytics user count with the database or billing count for the same definition. Analytics meaningfully higher means one person is being counted as several, which pulls every per-user rate down.
6. **Does it match the source of truth?** Where a database or billing count exists, compare. Analytics 1 to 2% below is timing noise, and a steady 5 to 10% below is acceptable. A double-digit gap, or one that suddenly widens, means something is blocked or broke.

In a step's checklist these are `event_flowing` (1), `properties_filled` (2), `distribution_shift` (3), `duplicate_firing` (4), `identity_holding` (5) and `source_of_truth` (6). One that doesn't apply (no database to compare with) is marked so, with the reason.

## If something is broken

If you are already in `workflows/reconcile-numbers` or `workflows/audit`, don't stop or switch: record what is broken and from which date as a finding, and carry on.

Otherwise, stop the analysis. Tell the user:
- what is broken (event, property, identity, duplicates),
- from which date,
- how it affects the number they asked about,
- whether any part of the analysis can still be done on clean data (a period before the break, a platform that is unaffected).

Don't present numbers that depend on the broken data as findings. Show them only to show the break.

Then switch to `workflows/reconcile-numbers` if there is a second source to compare against; otherwise run areas 2 to 4 of the detailed checklist in `workflows/audit` (Step 7) on the affected events only. Call `start_any_analytics_question_metrics_retention_funnels_tracking` with that task to get the workflow. Say why you switched.

## If you can't check

If the connected tool doesn't let you run a check, say which check was skipped and what it would have caught. Don't present the result as verified.
