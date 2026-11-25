---
id: pull-number
name: Pull a number
use_when: The user wants one metric, or a small set of metrics, for a period, including a breakdown or ranking (by channel, page, screen, plan). No "why" attached.
not_for: A number that moved and needs explaining (explain-change), or two sources that disagree (reconcile-numbers).
examples:
  - "What was 30-day retention for the July signup cohort?"
  - "How many people are on a paid plan right now?"
  - "Which landing pages bring the most activated users?"
  - "What's our average order value by country this quarter?"
modules: [data-health-check]
knowledge: [metric-definitions, reading-data, sense-checking-numbers]
---

# Pull a number

## Step 1: Pin the definition
<!-- step
id: definition
fields: [counted, out_of, window, excludes, confirmed_by]
report: The four-line definition of the number (counted, out of, window, excludes), the time zone, and how test and internal users are excluded. Say where each line came from: the user's request, the company's written definition, the user's answer to your question, or your assumption.
knowledge: [metric-definitions]
-->

Principle 2. Write the four lines: counted, out of, window, excludes, with the time zone and how test and internal users are excluded.

This is a lookup, so keep it quick. If the request and the company's written definition (a saved metric, the tracking plan) pin the number between them, use them and carry on: the definition goes back with the number in step 6, where the user can correct it.

Ask first, and wait for the answer, only when the request is ambiguous in a way that changes the number by more than rounding:
- no written definition, and more than one reasonable one;
- retention without the day, bounded or unbounded, or what counts as coming back;
- "active" or "users" without the action or the unit (users, accounts, workspaces);
- a written definition that doesn't match what they asked for.

## Step 2: Confirm the source of truth
<!-- step
id: source
report: The tool or table you will pull the number from, any other source that could answer it, and why you chose this one.
knowledge: [unifying-data, metric-definitions]
-->

Which tool or table owns this number? Payments and paid users usually belong to billing or the backend database. Behaviour belongs to the product analytics tool. If two sources could answer it, say which you are using and why.

## Step 3: Check the data
<!-- step
id: data-check
fields: [healthy, broken, not_checked, clean_subset]
checklist: [event_flowing, properties_filled, duplicate_firing, identity_holding, source_of_truth]
report: Each check you ran, on which events and over which dates, and what it found. Say whether checks 5 and 6 applied, any check you couldn't run and why, and plainly whether the data is healthy or broken.
modules: [data-health-check]
knowledge: [sense-checking-numbers, data-accuracy-as-a-system]
-->

Run checks 1, 2 and 4 of `modules/data-health-check` on the events the number depends on, over the period plus a few weeks before. Add checks 5 and 6 when the number is per user or a source of truth exists; otherwise mark them "doesn't apply" with the reason.

## Step 4: Pull the number
<!-- step
id: pull
fields: [definition_used, tool_limits]
report: The number with its period, and the query or report you ran to get it.
-->

Pull the number with the definition from step 1. If the tool can't run that definition exactly (a setting it won't take, a filter it rejects), tell the user what you can run instead before you hand anything over (principle 10).

## Step 5: Sense-check it
<!-- step
id: sense-check
report: What you checked the number against, the figure it was compared with, and whether it passed. If it failed, what looks off and what you did to verify it.
knowledge: [sense-checking-numbers]
-->

Sense-check it against something known: the last period, their own dashboard, their billing system, or a rebuild from rough counts. If it fails, do not hand it over as an answer. Say what looks off and verify it first.

## Step 6: Return the number with its definition and caveats together
<!-- step
id: answer
fields: [write_up]
report: That the number went to the user with all five parts: the number and period, the four-line definition, what it was checked against, the caveats, and the query or report.
knowledge: [reading-data]
-->

Never the number alone. Format:
- The number, with the period.
- The definition used, in four lines.
- What you checked it against.
- Caveats: small samples, data issues found, assumptions you made.
- The query or report you used, so they can rerun it.
