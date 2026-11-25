---
id: reconcile-numbers
name: Reconcile two numbers
use_when: Two tools, two reports or two people give different numbers for what should be the same thing. Also user counts that look inflated, the same person showing up as two users, and ad platforms claiming more conversions than the backend.
not_for: One number that looks wrong with nothing to compare it to (pull-number, which checks and sense-checks it; explain-change if it moved over time). A general how-to on fixing tracking (answer-question).
examples:
  - "Mixpanel shows 1,180 sign-ups for September and our database shows 1,410."
  - "Shopify and GA4 disagree on last month's revenue."
  - "Product says activation is 22%, growth says 31%. Who is right?"
  - "Meta says it drove twice the orders our backend recorded."
modules: [data-health-check]
knowledge: [metric-definitions, data-loss, identity-stitching, data-accuracy-as-a-system, unifying-data, mmp-and-utm-tracking]
---

# Reconcile two numbers

## Step 1: Understand how each number is calculated
<!-- step
id: definitions
fields: [number_a, number_b, business_context, user_hunch]
report: For each number, the platform, the exact report or query behind it, and how it is calculated: what is counted, out of what, over which window, with which filters. Say which of these you read from the tool and which the user told you, when the gap started, and what the user thinks causes it.
ask: true
knowledge: [metric-definitions]
-->

Understand how each number is calculated on each platform: what is counted, out of what, over which window, with which filters. Get the exact report or query for each. Read what you can from the tools first, then ask, in one message, each with your proposed answer:

1. **Where each number comes from:** the report, dashboard or query, and who pulls it. Write out what you found, so they can just say yes.
2. **When the gap started,** or whether it has always been there, and what changed around then (a release, a tracking change, a new tool or proxy).
3. **Their hunch:** what they think causes it, or what they have already ruled out.

## Step 2: Decide whether they are comparable
<!-- step
id: comparable
report: Whether the two numbers are comparable and why, what you told the user, and whether this looks like a definition problem or a tracking problem.
knowledge: [metric-definitions, data-accuracy-as-a-system]
-->

Tell the user plainly. If several people bring different numbers for the same metric and each is correct for its own formula, it is a definition problem, not a tracking problem: write one definition down and keep it in one place. If everyone sees the same number and nothing moves it, suspect tracking instead.

## Step 3: Check the usual causes, in this order
<!-- step
id: causes
fields: [tool_limits]
checklist: [same_definition, same_unit, time_zone, duplicate_users, filters, lost_events, revenue_adjustments, ad_platforms, user_hunch]
report: Each of the eight causes in order, with what you checked and what you found, and which ones explain part of the gap. Mark the ones that don't apply (revenue, ad platforms) and any you couldn't check. Say what you found on the user's hunch.
knowledge: [identity-stitching, data-loss, mmp-and-utm-tracking]
-->

1. Same definition? (counted, out of, window, excludes)
2. Same unit? Users, events and sessions are not interchangeable.
3. Same time zone, and the same date boundaries?
4. Duplicate users? If analytics shows more users than the database, one person is probably counted as several. Look for `identify` called before login or signup, client and server events carrying different user IDs, or a cookie not shared across subdomains.
5. Filters: test users, internal traffic, bots, staging projects, one platform left out.
6. Lost events: ad blockers, consent banners and failed requests drop client-side web events. If analytics is lower than the database, this is the usual reason.
7. For revenue: taxes, refunds, currency, discounts, gross against net, and the date used (order date, payment date, payout date).
8. For ad platforms against your own data: they are not comparable, so don't try to make them match. Each platform credits itself for the same order, and Meta's default counts 7-day click plus 1-day view. Take only spend from the platforms, treat the backend and your own attribution as the source of truth, and read the gap as a diagnostic: a steady gap is normal, a gap that suddenly moves means your attribution, Conversions API or pixel broke.

## Step 4: If they are comparable, give a corrected version
<!-- step
id: corrected
report: Both numbers recalculated under the one shared definition, and the gap that remains between them. Or that they aren't comparable, and why no corrected version was made.
knowledge: [metric-definitions, unifying-data]
-->

If they are comparable, give a corrected version that matches on both sides: the same definition, applied to both, with the remaining gap.

## Step 5: Size the remaining gap and say whether it is normal
<!-- step
id: gap
report: The remaining gap as a percentage and which way it runs, whether it is steady or has widened over time, which case below it falls in, and what that means. If it widened, the date it widened and what the data health check found from there.
modules: [data-health-check]
knowledge: [data-loss, identity-stitching]
-->

- Analytics 1 to 2% below the database: timing noise. Not worth chasing.
- Analytics 5 to 10% below the database and steady over time: acceptable (typical with a proxy, or on mobile). Correct for it and check it stays put.
- Analytics more than 10% below on web: client-side tracking is being blocked. With no proxy, expect at least 15 to 20%, more with technical users. The fix is a proxy on their own domain for interactions and server-side tracking for core events (sign-ups, payments, core feature use). Cite the data loss chapter.
- A gap that suddenly widens: something broke between the two. Find the date it widened and run `modules/data-health-check` from there.
- Analytics higher than the database: usually identity. Cite the identity stitching chapter.

## Step 6: Recommend how to keep them aligned
<!-- step
id: keep-aligned
fields: [ruled_out, write_up]
report: The recommendations you gave: where the one written definition will live, when the next check of analytics against the database is due, and which core events need alerts.
knowledge: [data-accuracy-as-a-system]
-->

Recommend how to keep them aligned: one written definition, a check of analytics against the database every couple of months, and alerts on the core events. In the write-up, list the causes you checked and ruled out, with what you found, so the user doesn't re-check them.
