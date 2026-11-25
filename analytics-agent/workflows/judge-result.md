---
id: judge-result
name: Judge a result
use_when: The user names something the team did on purpose (a launch, a feature, an A/B test, a pricing change, more ad spend, a campaign or channel) and asks whether or why it worked. Also a finding they already have and want to act on ("users who do X convert more, should we push X?").
not_for: An unexpected change nobody caused on purpose (explain-change). How to design or run a test in general (answer-question), or designing one for their product (plan). Looking for a finding they don't have yet (find-opportunities).
examples:
  - "We shipped the new onboarding two weeks ago. Is it working?"
  - "Variant B has a 4% higher checkout rate after 9 days. Can we call it?"
  - "We tripled LinkedIn ads spend. Was it worth it?"
  - "People who invite a teammate retain far better. Should we force invites at signup?"
modules: [data-health-check, metric-tree-rate-mix, story-output]
suspects: [attribution, activation-onboarding, retention, payments-revenue]
knowledge: [experimentation, correlation-is-not-causation, incremental-testing, media-mix-modelling, north-star-metric, mmp-and-utm-tracking, unifying-data, qual-plus-quant-analysis, analytics-strategy, product-funnel]
---

# Judge a result

## Step 1: Pin what "worked" means
<!-- step
id: success-metric
fields: [counted, out_of, window, excludes, counter_metric, change_date, confirmed_by]
report: The one metric the change should move with its four-line definition, the counter metric that would catch a fake win, the date of the change, and anything else that changed around it. Give the user's answer in their words, or that they told you to go ahead on your proposals.
ask: true
knowledge: [north-star-metric, metric-definitions, experimentation]
-->

The one metric the change should move, its definition, and the counter metric that catches a fake win (activation for more sign-ups; month 2 and 3 revenue for a new channel). Propose all three and ask the user to confirm them, with the date of the change and what else shipped around it, in one batch. Deciding what counts as a win after seeing the data is how fake wins get called.

## Step 2: Check the data didn't change with the launch
<!-- step
id: data-check
fields: [healthy, broken, not_checked, clean_subset]
checklist: [event_flowing, properties_filled, distribution_shift, duplicate_firing, identity_holding, source_of_truth]
report: The events behind the metric, the checks you ran on them either side of the launch date, and what you found: any event renamed, moved or firing twice, and from which date. Say plainly whether the data is comparable across the launch.
modules: [data-health-check]
knowledge: [event-verification, sense-checking-numbers]
-->

Launches often ship tracking changes: an event renamed, moved, or firing twice. Run checks 1, 2 and 4 of `modules/data-health-check` on the events behind the metric, either side of the launch date.

## Step 3: List what else could explain the result
<!-- step
id: hypotheses
fields: [hypotheses]
ask: true
suspects: true
suspects_list: dropped
report: The numbered explanations other than the change itself, each with the data that would confirm or rule it out, and the user's answer on which they already know to be true or false and what is missing.
knowledge: [correlation-is-not-causation, experimentation]
-->

Principle 5. Before any significance test, write down everything other than the change that could explain the result, as numbered hypotheses (H1, H2...): another release or campaign at the same time, a holiday or seasonality, a novelty spike, a change in who arrived (mix), a tracking change shipped with the launch, an uneven split between groups, and the usual suspects below where the topic has them. Each gets the data that would confirm or rule it out.

Show the list to the user, ask what is missing and which they already know to be true or false, then wait. If they say "go ahead", test them all.

## Step 4: Check the sample size
<!-- step
id: sample-size
report: The users and conversions in each group, whether each clears principle 7's floor, and for a planned test the sample size it needs. If there isn't the traffic for a proper test, which alternative you suggested and why it is weaker.
knowledge: [experimentation]
-->

Enough users and conversions in each group to tell a real difference from noise? Use principle 7's thresholds as a floor. For a planned test, the A/B test calculator at joindatalyze.com/tools/ab-test-calculator gives the sample size needed.

- **No traffic for a proper A/B test:** a before/after on the one metric it should move, a held-back slice of users on the old version, or asking ten users who dropped off. Say which is weaker and why.

## Step 5: Check statistical significance
<!-- step
id: significance
fields: [definition_used, tool_limits]
report: The primary metric in each group, the difference, the confidence interval or p-value, and what that means in plain words. Say whether it is significant.
knowledge: [experimentation]
-->

Check statistical significance on the primary metric. Report the difference, the confidence interval or p-value, and what that means in plain words. Don't call a winner on a non-significant result.

## Step 6: Check for biases
<!-- step
id: biases
checklist: [random_split, other_changes, novelty_spike, control_group, correlation_alternatives]
report: For each bias check, what you compared and what you found: group sizes and mix against what you'd expect, anything else that changed at the same time, any novelty spike, and whether there is a control group. For a correlation, what users who converted without the action did instead, whether the action still stands out, and the test you proposed.
knowledge: [correlation-is-not-causation, experimentation]
-->

- Was the split between groups random and even? Compare group sizes and their mix (platform, country, source) against what you'd expect.
- Did anything else change at the same time: another release, a campaign, a price change, a holiday?
- Is it a novelty spike right after launch that fades after the first week or two?
- For a before/after comparison with no control group, say clearly that it is weaker evidence.

- **A correlation the user wants to act on:** first check what users who converted without the action did instead. If other behaviours explain them, it isn't just the action. If the action still stands out, test it: split non-converters at random, push one half to do it, compare. Up means causal, flat means correlation, down means the push itself gets in the way. Suggest talking to three cohorts: did it and converted, didn't and converted, did it and didn't convert.

## Step 7: Normalise and re-check
<!-- step
id: normalise
report: The rates for both sides over windows of the same length aligned on weekday, how you accounted for seasonality, and whether the result still holds.
knowledge: [reading-data]
-->

Compare rates, not raw counts. Use the same length of window on both sides, aligned on weekday, and account for seasonality.

## Step 8: Run rate and mix analysis
<!-- step
id: rate-mix
report: Whether a change in who arrived could explain the result, and if so the rate effect and mix effect with numbers. For a channel or campaign: its branch of the metric tree, its users' activation and revenue at months 1, 2 and 3, the cost per retained paying user, and whether it needs an incrementality test or media mix modelling to settle.
modules: [metric-tree-rate-mix]
knowledge: [rate-and-mix-analysis, incremental-testing, media-mix-modelling]
-->

Run rate and mix analysis (`modules/metric-tree-rate-mix`) if the overall result could come from a change in who arrived rather than in how they behaved.

- **Is a channel or campaign working:** look at the channel's branch of the metric tree and at its users' activation and revenue at months 1, 2 and 3, not just first conversion. Judge it on cost per retained paying user, not cost per signup; the cheapest signups often never activate or pay. Ad platform numbers can't settle this (`suspects/attribution`).
- **Does the channel create demand or only intercept it:** that needs an incrementality test. Split markets into two matched groups with several cities or regions on each side, not one against one; switch ads off in one; run at least 4 weeks; confirm nothing still reaches the holdout (retargeting, a national email, WhatsApp, an influencer). Worth running from about 200,000 new website users a month.
- **Channels with no link to track** (influencers, offline, brand): media mix modelling. It needs about ten weeks of weekly data per channel, and spend that varies week to week.

## Step 9: Give a verdict in plain words
<!-- step
id: verdict
fields: [hypotheses_tested, ruled_out, write_up]
report: The verdict (win, no clear effect, loss, or can't tell yet) with the numbers behind it, what would make it conclusive, and the other explanations you ruled out.
modules: [story-output]
knowledge: [correlation-is-not-causation, data-storytelling]
-->

Close every hypothesis from step 3 first (principle 5): an explanation you couldn't rule out weakens the verdict, so say so.

Give a verdict in plain words: win, no clear effect, loss, or can't tell yet. Say what would make it conclusive (more time, more users, a holdout).
