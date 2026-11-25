---
id: find-opportunities
name: Find opportunities
use_when: The user wants to know where they are losing users or what to work on. Also a metric that is low (with no change over time) that they want to improve, and "what do users who convert or stay do differently?", where they are looking for a finding they don't have yet.
not_for: A named metric that moved over time (explain-change). A finding they already have and want to act on, such as "users who do X convert more, should we push X?" (judge-result).
examples:
  - "Where in our product are people giving up?"
  - "Our trial to paid rate is 3%. How do we get it up?"
  - "What separates the users who stick around from the ones who don't?"
  - "We have a few weeks of analyst time. What should we look at?"
modules: [data-health-check, funnel-deep-dive, story-output]
suspects: [activation-onboarding, retention, payments-revenue, attribution]
knowledge: [product-funnel, product-problem-framework, product-analyst-mindset, segment-analysis, qual-plus-quant-analysis, correlation-is-not-causation]
---

# Find opportunities

## Step 1: Sketch the core funnel
<!-- step
id: funnel
report: The core funnel for this product as steps in order, how it differs from the default and why, and what the user confirmed or changed.
knowledge: [product-funnel, product-analyst-mindset]
-->

Start from new user → signup → onboarding complete → activation → revenue → retention → referral. Adapt it to the product: a marketplace has two sides, a free tool may have no revenue step, an app starts at install.

Sketch it from what you know and the tool's metadata. Don't query yet: you confirm the funnel with the user in the next step's questions.

If the question is about one stage (retention is low, trial to paid is low), the rest of the funnel is context: keep it short and focus the work on that stage.

## Step 2: Get the definition of each step
<!-- step
id: definitions
fields: [funnel_events, retention, excludes, business_context, user_hunch, confirmed_by]
report: For each funnel step, the event or table that marks it and its filters, including what counts as signup, activation and retention, and how test and internal users are excluded. Give the user's answer in their words for each one you asked about, or that they told you to go ahead on your proposed defaults; say whether activation had to be defined first, what they said changed around the period, and what they think is causing it.
ask: true
knowledge: [metric-definitions, product-funnel]
-->

Which event or table marks it, with which filters? Ask especially what counts as signup, activation and retention, because these vary most between companies. Propose an answer for each from their saved metrics and Lexicon, and ask the user to confirm or correct it (principle 2).

Ask these three, in one message, each with your proposed answer:

1. **The definitions,** written out as lines, including how test and internal users are excluded. For retention: which day or week, bounded or unbounded, what counts as coming back (any visit, or the core action, and in which product), and new users only or everyone.
2. **Business context:** what changed around the period (releases, pricing, campaigns, tracking changes) (principle 4).
3. **Their hunch:** what they think is causing it, or what they have already checked. Their answer goes into the hypotheses in step 4.

If activation has no definition yet, offer to define it first (`workflows/plan`).

## Step 3: Check the data
<!-- step
id: data-check
fields: [healthy, broken, not_checked, clean_subset]
checklist: [event_flowing, properties_filled, distribution_shift, duplicate_firing, identity_holding, source_of_truth]
report: Each event behind each step that you checked, over which dates, and what you found. Say plainly whether the data is healthy or broken, and if broken, what is broken and from which date.
modules: [data-health-check]
knowledge: [sense-checking-numbers, event-verification]
-->

Check the data behind each step (`modules/data-health-check`). A step that looks like a cliff is often an event that stopped firing. Run it even if the user says the period is clean, and list any breaks found earlier in the conversation that fall inside it.

## Step 4: List hypotheses before breaking the data down
<!-- step
id: hypotheses
fields: [hypotheses]
suspects: true
suspects_list: low
report: The numbered hypotheses, each with the data that would confirm or rule it out, and where each came from (a usual suspect, the user's hunch, what the data check showed).
knowledge: [product-problem-framework, product-analyst-mindset]
-->

Principle 5. Write every plausible explanation as a numbered hypothesis (H1, H2...), each with the data that would confirm or rule it out. Start from the usual suspects below: each one either becomes a hypothesis or is ruled out now with the reason (the checklist). Add the user's hunch from step 2 and anything the data check turned up.

A hypothesis names something you can test: "API users come back through their own code, which the analytics tool never sees. Test: compare API usage in billing with the API return event", not "API retention is low".

## Step 5: Confirm the hypotheses with the user
<!-- step
id: confirm
fields: [hypotheses_to_test]
ask: true
report: The final numbered list after the user's answers: which they added, which they already know to be true or false, and which are left to test.
-->

Show the numbered list, ask what is missing, and ask which they already know to be true or false. Keep it to 3 questions. If they say "go ahead" or "you decide", test them all.

## Step 6: Build the funnel
<!-- step
id: build-funnel
fields: [definition_used, tool_limits]
report: The period you used, the number of users at each step and the conversion between each pair of steps, and the biggest drop-off.
knowledge: [product-funnel, reading-data]
-->

Build the funnel over a recent stable period (4 weeks is a good default) and find the biggest drop-off between steps.

## Step 7: Break the funnel down by the factors that matter
<!-- step
id: break-down
fields: [persona_segments, behaviour_segments, combined_segments, definition_used, tool_limits]
checklist: [new_vs_existing, platform_device, source, country_and_region, plan, signup_method, onboarding_answers, product_picked, core_action, setup_done, days_active, first_feature, first_session, combined]
report: The factors you broke the funnel down by, including any the user added, and the conversion at each step per segment with its number of users. Flag segments too small to trust. Say which hypotheses each breakdown speaks to.
knowledge: [segment-analysis, product-problem-framework]
-->

Break the funnel down by every factor in the checklist, and any the user added. The persona factors are who the users are: platform and device, marketing source, country (and region or city when most users are in one country), plan, signup method, onboarding answers, the product they picked. The behaviour factors are what they did in a fixed window after the start point: reached the core action, set something up, how many separate days they used it, the feature they used first, how long their first session was.

Behaviour is where the answer usually is, and it is the harder half: compare the two groups (converted and not, or came back and didn't) on each behaviour, with the share of each group that did it. If the tool can't build the two groups directly (no cohorts, breakdowns that attribute to the wrong event), build them another way: a funnel from the start event through the behaviour to the outcome, or a retention report whose start event is the behaviour. Report what you tried in `tool_limits` before giving up on one.

**When the question is retention** (who comes back and who doesn't), treat "came back" as the funnel step and compare the two groups:

1. **Split new users from existing users** first. Low retention among new users and among existing users are different problems.
2. **Compare behaviour** in a fixed window after the start point (the first day or week after signup or activation): reached the core action, set something up, how many separate days they used it, which product or feature they used first.
3. **Compare persona:** platform, source, country, plan, role, product picked at signup.
4. **Combine** the strongest behaviour and persona segments (`modules/funnel-deep-dive` step 3); single factors rarely give the answer on their own.
5. Check both the retained and the not-retained groups are big enough (principle 7), and that each user sits in only one cohort.

Every hypothesis from step 5 that a breakdown can test gets tested here; note in the report which breakdown speaks to which hypothesis.

## Step 8: Show the gaps, ranked by impact
<!-- step
id: rank-gaps
report: The gaps ranked by impact, each with the size of the drop, the number of users affected a week, and the two multiplied.
knowledge: [product-problem-framework]
-->

Show the gaps, ranked by impact: the size of the drop × the number of users affected. A 40% drop on 50 users a week matters less than a 10% drop on 5,000.

## Step 9: Offer a deep dive
<!-- step
id: deep-dive
fields: [deep_dive, replays]
checklist: [who_converts, what_converters_did, combined, where_non_converters_stop, alternative_explanations]
report: Whether the user wanted a deep dive and on which step. If you ran it, what each step of the deep dive found, with numbers and group sizes. If not, that it was offered and declined.
modules: [funnel-deep-dive]
knowledge: [segment-analysis, qual-plus-quant-analysis, correlation-is-not-causation]
-->

If the user wants to go deeper into one step, run `modules/funnel-deep-dive` on it. If their question already asks why users drop or stay, or what separates the two groups, that is a yes: run it on the biggest gap without asking again. For retention, the step is "came back", and the deep dive's step 4 (replays and conversations with users who didn't return) is where the why comes from.

## Step 10: Write it up
<!-- step
id: story
fields: [hypotheses_tested, ruled_out, write_up]
report: That the write-up was written for the user: the biggest gap first, then the next two, what was checked and ruled out, then what to look at or test.
modules: [story-output]
-->

First close every hypothesis from step 5 (principle 5): confirmed, ruled out, partly, or not tested and why. Then write it up with `modules/story-output`: the biggest gap first, then the next two, what was checked and ruled out, then what to look at or test.
