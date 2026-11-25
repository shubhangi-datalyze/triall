---
id: audit
name: Audit
use_when: The user wants their tracking setup or data checked as a whole, or says they don't trust their data. Also a request to inspect their events, properties, UTMs or identity for problems, or to clean up too many events.
not_for: A how-to with no request to inspect their setup, such as "how do I stop an event firing twice?" (answer-question). One specific pair of numbers that disagree (reconcile-numbers). One named metric that moved (explain-change).
examples:
  - "Can you go through our PostHog project and tell us what's broken?"
  - "Nobody on the team believes our dashboards any more."
  - "Check whether the events our devs shipped last sprint are right."
  - "We have hundreds of events and no idea which ones matter."
modules: [data-health-check, story-output]
suspects: [attribution]
knowledge: [event-verification, data-accuracy-as-a-system, identity-stitching, data-loss, metric-definitions, creating-a-tracking-plan, mmp-and-utm-tracking, unifying-data]
---

# Audit

This is the audit Datalyze runs with every new client: the three steps from "Analytics Debt: The Silent Killer", the three verification layers from "Event verification" (playbook chapter 9), the three accuracy habits from "Data accuracy as a system" (chapter 10), then a detailed checklist built from the identity stitching, data loss, metric definitions, tracking plan and UTM chapters. Cite those in the findings. Where a blog post and the playbook disagree, follow the playbook.

## Step 1: Before you start
<!-- step
id: setup
report: The tool and the production project, what the connected tools let you do (list events and properties, query them, see individual users' event streams), whether there is a tracking plan and whether you have it, and the review window. Give the user's answers, or that they told you to go ahead.
ask: true
knowledge: [creating-a-tracking-plan, data-accuracy-as-a-system]
-->

Ask, in one batch:
1. Which tool and which project (production, not staging)?
2. What access do you have through the connected tools? Can you list events and properties, query them, and see individual users' event streams?
3. Is there a tracking plan? If yes, ask for it. If no, note it as the first finding.

Pick a review window: the last 30 days, plus the last 90 days for trends.

## Step 2: The five-question test
<!-- step
id: five-questions
report: Whether the five people answered, and if so each one's answers and where they differ, and who could say how they know the number is right. Or that the user can't run it now and it is noted as a follow-up.
knowledge: [metric-definitions, data-accuracy-as-a-system]
-->

Ask the user to put these to five people (product, engineering, marketing, the founder, and one individual contributor):

- What's our activation rate?
- What's our weekly retention at 4 weeks?
- Which acquisition channel has the best payback period?
- What percentage of users hit our core value action in their first session?
- How do you know that number is right?

Different answers to any of the first four, or no answer to the fifth, means material analytics debt. If the user can't run it now, note it as a follow-up and carry on.

## Step 3: The event audit
<!-- step
id: event-audit
report: How many events there are, the events that haven't fired in 30 or more days, each volume spike or drop with its date and whether a product change matches it, and each group of events tracking the same action under different names with the one to keep.
knowledge: [event-verification, creating-a-tracking-plan]
-->

Pull the full event list with volumes and last-seen dates.

- **Last fired:** events that haven't fired in 30 or more days are broken, or track something nobody uses. Flag them.
- **Volume spikes and drops:** a big change with no matching product change means something broke. Find when.
- **Naming:** list events that track the same action under different names (`sign_up`, `signup`, `user_signed_up`, `registration_complete`). Pick one, deprecate the rest.

## Step 4: The funnel walk
<!-- step
id: funnel-walk
report: The journey you walked with the users at each step, any step that isn't tracked, any step with more users than the step before, and whether the funnel breaks down by platform and cuts by weekly cohort.
knowledge: [product-funnel, event-verification]
-->

Take the most important journey (signup → activation → first value → retention) and check:

- Every step is tracked.
- The numbers make mathematical sense: no step has more users than the step before.
- Each step breaks down by platform (web, iOS, Android).
- The funnel can be cut by weekly cohort.

## Step 5: Verify the events (Event verification)
<!-- step
id: verify
checklist: [layer_1_fired, layer_2_correct_and_identity, layer_3_every_surface]
report: Who has been doing verification. Layer 1: the map of plan events fired and not fired and properties seen and missing, or the event list and the missing plan. Layer 2: the four checks for each core event the user triggered and the result of each identity walk-through step, or that the user couldn't do it now. Layer 3: the surfaces checked, the surfaces with no volume or implausible values, and the surfaces left unchecked.
knowledge: [event-verification, identity-stitching]
-->

Verification checks that what arrives in the tool is what the tracking plan asked for. It is done by the tracking plan owner, not the engineer who wrote the code: someone checking their own work checks it against what they built, not against what was asked for. Note who has been doing it.

**Layer 1: what fired, and what didn't.** You can do this through the connector. Compare the tracking plan against what's arriving and produce the map:
- events in the plan that have fired
- events in the plan that haven't fired at all
- properties that are coming through
- properties you can't see anywhere

No tracking plan means no layer 1; list the events that exist instead and flag the missing plan. Layer 1 only says what exists, not whether it's right.

**Layer 2: is it right.** Ask the user to trigger the core events the way a user would while you watch them land (the tool's live event feed: Mixpanel Events view, PostHog Activity, Amplitude user lookup). For each event check four things: did it fire, did it fire in the right order, is the name right, are the property values right (a sign-up clicked on the home page must not say `pricing`). Then check identity with them:
1. Visit the product logged out and click around.
2. Sign up.
3. Open that user's profile and confirm the logged-out clicks are under it.
4. Log in on a second browser or phone, do something, and check it lands on the same profile.

If identity is broken, every per-user number is wrong in a way that looks reasonable on a chart. That goes to the top of the findings.

**Layer 3: every surface.** For an event that fires from several places (a sign-up button on ten pages), check each surface, not just one or two; the broken ones are usually in the ones nobody checked. Through a connector, break the event down by its entry point or surface property and look for surfaces with no volume or implausible values. Many teams skip full layer 3; if a couple of surfaces check out and the breakdown by surface holds up, say so and mark the rest as unchecked rather than passed.

## Step 6: Check the accuracy system (Data accuracy as a system)
<!-- step
id: accuracy-system
checklist: [alerts, new_events_verified, backend_comparison]
report: For each of the three habits, whether it exists and the evidence: which of the five alert types are set up on the core events, recent events with obvious problems, and the analytics against database comparison with its gap if you ran it.
knowledge: [data-accuracy-as-a-system]
-->

Verification shows the data worked on the day it was checked. Staying accurate takes three habits. Check whether each one exists:

1. **Alerts on events and properties, running continuously.** Are there alerts for each of these on the core events?
   - an event spiking or dropping, including all the way to zero
   - a property that stops showing up with an event
   - a property value changing
   - a property's distribution shifting (Google going from 50% to 10% of sign-ups)
   - identity breaking, so one person shows up as several

   Event-count alerts alone miss property problems, because a broken property doesn't move the count. Most teams have, at best, the first one.
2. **Every new event verified, every time it ships,** as a rule rather than a habit. Look for recent events (added in the last 90 days) that have obvious problems; those are the ones nobody checked.
3. **Analytics compared against the backend database every couple of months,** on a few core numbers (sign-ups, orders, payments). Run the comparison now if you can: a steady 5 to 10% gap is fine, a gap that suddenly widens means something broke, analytics above the database means identity.

## Step 7: The detailed checklist: tracking plan, events, properties and identity
<!-- step
id: checklist-events
fields: [tool_limits]
checklist: [area_1_tracking_plan, area_2_events_fire_once, area_3_properties, area_4_identity]
report: Pass, fail or could not check for every check in areas 1 to 4, each with its evidence: the events missing from the plan or the tool, names off convention, days a core event dropped, events firing twice or out of order, null rates and format problems per key property, and the identity findings.
modules: [data-health-check]
knowledge: [creating-a-tracking-plan, event-verification, identity-stitching]
-->

Work through every area. For each check, record pass, fail or could not check, with the evidence.

### 1. Tracking plan
- A tracking plan exists, in one place, with an owner (a PM or analyst, not the developer).
- Every event in the tool is in the plan, and every event in the plan is in the tool. List both differences.
- Event names follow one convention, casing included. List the ones that don't.

### 2. Events fire, and fire once
- Every core event (signup, activation, payment, core feature use) has volume every day of the window. Flag any day it dropped or went to zero.
- Events per user is stable over time. A step up means an event started firing twice.
- Events that should happen once per user (signup, first purchase) happen once per user. Count users with more than one.
- Events are in a sensible order (a purchase does not land before the checkout started).

### 3. Properties
- Each core event carries the properties the plan says it should.
- Null or "not set" rates per key property, and whether they changed during the window. Server-side events lose auto-captured properties (UTMs, country, browser) unless they're set by hand.
- One property, one format: no mix of `iOS`/`ios`/`IOS`, prices as numbers not strings, consistent units and currency.

### 4. Identity
- `identify` is called at signup and login, not on page load or app open.
- `identify` uses the internal database user ID, not email or phone, which change and split the user.
- Client and server events carry the same user ID.
- The analytics user count for a period is close to the database count for the same definition. Analytics meaningfully higher means one person is counted as several.
- Logged-out activity merges into the profile after signup (the Step 5 identity walk-through, plus a few existing profiles).
- Marketing site and app share identity (cookie shared across subdomains, or the same root domain).

## Step 8: The detailed checklist: data loss and attribution
<!-- step
id: checklist-loss-attribution
fields: [tool_limits]
checklist: [area_5_data_loss, area_6_attribution_utms]
report: Pass, fail or could not check for every check in areas 5 and 6, each with its evidence: the core count in analytics and in the database with the gap, whether there is a proxy and server-side core events, the UTM convention problems, the share of signups with no source and its trend, where first-touch source is stored, and whether an app has an MMP.
suspects: true
knowledge: [data-loss, mmp-and-utm-tracking]
-->

### 5. Data loss
- Compare a core count (signups yesterday) between analytics and the database. A 1 to 2% gap is noise; a double-digit gap means client-side tracking is being blocked.
- On web: is tracking routed through a proxy on the company's own domain?
- Are core events (signups, payments) sent server side?

### 6. Attribution and UTMs
- UTM values follow one convention (lowercase, fixed list of sources and mediums), and `utm_campaign` carries the ad platform's campaign ID, not a typed name.
- Share of signups with no source, and whether it is growing.
- First-touch source is stored on the user, not only on the session.
- If there is a mobile app: is an MMP in place for install attribution?

## Step 9: The detailed checklist: clean data, definitions and analytics debt
<!-- step
id: checklist-hygiene
checklist: [area_7_clean_data, area_8_definitions, area_9_analytics_debt]
report: Pass, fail or could not check for every check in areas 7 to 9, each with its evidence: how test, internal, bot and staging traffic is kept out, which core metrics have one written definition, reports that show the same metric with different numbers, and unused events and broken or abandoned dashboards.
knowledge: [metric-definitions, data-accuracy-as-a-system]
-->

### 7. Clean data
- Test, internal and bot traffic are excluded, through a filter or cohort everyone uses.
- Staging and development events do not land in the production project.

### 8. Definitions
- The core metrics (signup rate, activation, retention, churn, revenue) each have one written definition in one place.
- Dashboards use those definitions. Flag two reports showing the same metric with different numbers.

### 9. Analytics debt
- Events nobody uses in any report or dashboard, if the tool shows this.
- Dashboards and reports that are broken or abandoned.

## Step 10: Output
<!-- step
id: output
fields: [write_up]
report: That the audit was written up for the user: a score per area, the fixes ranked by severity with the evidence, fix, owner and chapter for each, the phased plan with a named owner, and what you could not check and why.
modules: [story-output]
knowledge: [data-accuracy-as-a-system, data-storytelling]
-->

1. **A score per area:** Good, Needs work, or Broken, with one line on why.
2. **Fixes ranked by severity:**
   - **Breaks decisions:** the numbers are wrong today (identity broken, core event missing or double-firing, large data loss).
   - **Misleading:** the numbers are right but easy to misread (no written definitions, test traffic included, UTMs messy).
   - **Cleanup:** debt that slows people down (unused events, naming drift).
3. For each fix: what is wrong, the evidence, the fix, who does it (engineer, analyst, marketer), and the chapter to read.
4. **A phased plan, not a fix-everything list:** weeks 1 to 2, define five core metrics; weeks 3 to 4, fix tracking for only those five; weeks 5 to 6, build one verified dashboard the team reviews weekly; then expand. Name an owner who reviews the tracking plan with every release.
5. What you could not check, and why.
