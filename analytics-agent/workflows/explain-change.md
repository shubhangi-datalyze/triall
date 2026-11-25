---
id: explain-change
name: Explain a change
use_when: A named metric moved over time (dropped, spiked, or has been sliding) and the user wants to know why, or wants to know whether the move is real or a tracking problem. Retention, activation, conversion, churn, revenue, payments, a funnel step.
not_for: A metric that is low with no change over time, or "where should we improve" (find-opportunities). Whether something the team did on purpose worked, such as a launch, more ad spend or a new feature (judge-result). A question about the whole tracking setup (audit).
examples:
  - "Our week 1 retention fell from 31% to 24% over the last month. What happened?"
  - "Activation was 34% in August and 26% now. Why?"
  - "Revenue is down 18% this month and nobody knows why."
  - "Checkout success rate dropped on Tuesday and hasn't recovered."
modules: [data-health-check, funnel-deep-dive, metric-tree-rate-mix, story-output]
suspects: [retention, activation-onboarding, payments-revenue, attribution]
knowledge: [product-analyst-mindset, reading-data, rate-and-mix-analysis, north-star-metric, product-problem-framework, segment-analysis, qual-plus-quant-analysis, sense-checking-numbers, product-funnel, metric-definitions]
---

# Explain a change

## Step 1: Pin the definition
<!-- step
id: definition
fields: [counted, out_of, window, excludes, business_context, user_hunch, confirmed_by]
report: The four-line definition of the metric (counted, out of, window, excludes), the time zone, how test and internal users are excluded, and for retention the day, bounded or unbounded, and what counts as coming back. Give the user's answer in their words, or that they told you to go ahead on your proposed definition, what they said changed around the dates, and what they think caused it.
ask: true
knowledge: [metric-definitions, product-analyst-mindset]
-->

Principle 2. Propose the four lines from their saved metrics and ask the user to confirm them. For retention, which day, bounded or unbounded, and what counts as coming back. Two people who mean different things by the metric will argue about the wrong thing.

In the same batch, ask what changed around the dates (principle 4), so step 3 has the business context, and what they think caused it or have already checked. Their hunch goes into the hypotheses in step 4.

## Step 2: Check the change is real
<!-- step
id: data-check
fields: [healthy, broken, not_checked, clean_subset]
checklist: [event_flowing, properties_filled, distribution_shift, duplicate_firing, identity_holding, source_of_truth]
report: Each event and property you checked, over which dates, and what you found. Say plainly whether the data is healthy or broken, and if broken, what is broken and from which date.
modules: [data-health-check]
knowledge: [sense-checking-numbers, reading-data]
-->

Run `modules/data-health-check` on every event and property behind the metric, from a few weeks before the change to now. If the data is broken, stop and follow that module's "If something is broken" step (principle 11). Don't assume a sudden drop is tracking either: a release that broke sign-up is a real drop.

## Step 3: Find out the shape of the change
<!-- step
id: shape
report: Whether the change was sudden (and from which date) or gradual (over which weeks), and the business context the user gave for that period: releases, pricing, campaigns, outages, tracking changes. If the start date turned out different from the dates you asked about, what they said about the new date.
knowledge: [reading-data, product-analyst-mindset]
-->

- Sudden, from one day: points to a release, a tracking change, an outage, a pricing change, or a campaign switching on or off.
- Gradual over weeks: points to mix (who is arriving), product, or market.
- Use the business context from step 1. If the change started on a different date from the one you asked about, ask about that date (principle 4).

## Step 4: List hypotheses before touching the data
<!-- step
id: hypotheses
fields: [hypotheses]
report: The numbered hypotheses, each written as something the data can confirm or rule out, with the data that would test it, and where each came from (a usual suspect, the user's hunch, the shape of the change).
suspects: true
suspects_list: dropped
knowledge: [product-problem-framework, product-analyst-mindset]
-->

Principle 5. Number them (H1, H2...). Start from the usual suspects below: each one either becomes a hypothesis or is ruled out now with the reason (the checklist). Add the user's hunch, what the shape of the change points to, and the knowledge base. Write each one as something the data can confirm or rule out.

## Step 5: Confirm the hypotheses with the user
<!-- step
id: confirm
fields: [hypotheses_to_test]
report: The final list of hypotheses after the user's answers: which they added, which they already know to be true or false, and which are left to test.
ask: true
-->

Show the list, ask what is missing, and ask which they already know to be true or false. Keep it to 3 questions.

## Step 6: Pull and break down the data
<!-- step
id: break-down
fields: [definition_used, tool_limits]
report: Which case below fits this change, and why.
branches: [funnel, retention, top-line, mix]
-->

Use the case below that fits. Pick one, then do that case's steps.

### Branch funnel: A funnel step dropped (activation, onboarding, signup, trial to paid)
<!-- branch
report: The segment or behaviour whose conversion or share changed between the periods, with the numbers before and after, and how much of the drop it explains (rate vs mix).
checklist: [who_converts, what_converters_did, combined, rate_vs_mix]
modules: [funnel-deep-dive, metric-tree-rate-mix]
knowledge: [product-funnel, segment-analysis, rate-and-mix-analysis]
-->

Run steps 1 to 3 of `modules/funnel-deep-dive` for the period before and the period after the change. Look for the segment or behaviour whose conversion or share changed, then size it with rate vs mix (`modules/metric-tree-rate-mix`).

### Branch retention: Retention dropped
<!-- branch
report: Whether new or existing users changed, the segments you broke retention down by with their numbers and group sizes, and the segment that dropped, or that no segment stands out.
checklist: [new_vs_existing, behaviour_compared, persona_compared, combined, existing_user_changes]
modules: [funnel-deep-dive]
knowledge: [segment-analysis, qual-plus-quant-analysis, correlation-is-not-causation]
-->

1. **Split new users from existing users.** Are new users retaining worse, or are existing users leaving? They are different problems with different fixes, and the overall number hides which one you have. Split the retention chart by signup cohort (week or month).
2. **If it is new users:** compare what the users who stayed did in their first session with what the ones who left did. Break the retention chart down by:
   - behaviour segments, such as a first session under 10 seconds against the rest, or did the core action in the first day against did not
   - persona segments, such as marketing source, device, platform, country, role or plan

   Then combine the strongest behaviour and persona segments (`modules/funnel-deep-dive` step 3); single factors rarely give the answer on their own. Check both the retained and the not-retained groups are big enough (principle 7).
3. **If it is existing users:** look at what changed in the product when the drop started (a release, a bug, a pricing change, a feature that moved), then check whether the drop is spread across everyone or sits in one plan, platform or cohort.
4. If one segment dropped, that segment points to the cause. Go deeper into it.
5. If no segment stands out, use the business context and `suspects/retention` to help the user list likely overall causes, then check them one by one.

### Branch top-line: A top-line number dropped suddenly (revenue, orders, payment success rate)
<!-- branch
report: The metric tree you built, the branch that moved with its numbers for both periods, and the rate effect and mix effect where a rate moved.
checklist: [metric_tree, every_branch_checked, rate_vs_mix]
modules: [metric-tree-rate-mix]
knowledge: [north-star-metric, rate-and-mix-analysis]
-->

1. Build the metric tree for the number (`modules/metric-tree-rate-mix`).
2. Check every branch for the same period. Find the branch that moved.
3. Where a rate moved, split it into rate effect and mix effect, so you can say "the rate fell 3.6 points and 3 of those points are one segment".

### Branch mix: An overall rate moved but the segments disagree
<!-- branch
report: The rate effect and mix effect with numbers, and for a per-active-user rate what you found when you checked the denominator.
modules: [metric-tree-rate-mix]
knowledge: [rate-and-mix-analysis]
-->

This is a mix shift. Go straight to the rate and mix split in `modules/metric-tree-rate-mix`. If the rate is something per active user (churn, cancellations), check the denominator first: a spike in new users makes the rate fall with no real change.

## Step 7: Look at session replays
<!-- step
id: replays
fields: [replays]
report: The replay links you pulled for affected and unaffected users, what the tool shows about them, and what you asked the user to watch. Or that the tool has no replays and this step was skipped.
knowledge: [qual-plus-quant-analysis]
-->

Look at session replays of the affected users if the tool has them (PostHog, Mixpanel and Amplitude do). You usually can't watch video through a connector: pull links to 5 to 10 replays of affected users and a few unaffected ones, summarise what the tool exposes about them (pages, clicks, errors, where they stopped), and ask the user to watch them. Numbers tell you what is happening; replays and user conversations tell you why. If there are no replays, say this step was skipped and suggest talking to a few affected users.

## Step 8: Know when to stop
<!-- step
id: stop
fields: [hypotheses_tested]
report: The segment or branch that moved and the action in the team's control. Or, if every hypothesis was ruled out, what was ruled out and what data would settle it.
knowledge: [product-problem-framework, correlation-is-not-causation]
-->

Close every hypothesis from step 5 first (principle 5): confirmed, ruled out, partly, or not tested and why.

Stop when you can name the segment or branch that moved and an action in the team's control. If every hypothesis is ruled out, widen the list to external factors (a competitor, seasonality, the market) and other features, tell the user what was ruled out, and say what data would settle it. Don't present a guess as the answer.

## Step 9: Write the story
<!-- step
id: story
fields: [ruled_out, write_up]
report: That the story was written for the user, with what was checked and ruled out.
modules: [story-output]
-->

Write the story with `modules/story-output`.
