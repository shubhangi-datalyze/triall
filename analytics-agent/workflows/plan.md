---
id: plan
name: Plan
use_when: The user wants an artifact for their own product, such as a metric list or analytics strategy, a north star with its tree, a definition of activation or retention, a tracking plan, a dashboard spec, or a test design.
not_for: General "when, which or what is" questions, such as which tool or warehouse to use (answer-question). Checking an existing setup (audit).
examples:
  - "We're a two-sided marketplace for tutors. Which numbers should we watch weekly?"
  - "Help us pick what counts as an activated user for our design tool."
  - "Write the events we need for our new checkout flow."
  - "Lay out a weekly growth dashboard for our leadership meeting."
modules: [analytics-strategy, tracking-plan, story-output]
knowledge: [analytics-strategy, north-star-metric, metric-definitions, reading-data, creating-a-tracking-plan, data-storytelling, product-analytics-by-stage, product-funnel, data-modelling]
---

# Plan

## Step 1: Get product context and pick the kind of plan
<!-- step
id: kind
fields: [write_up]
report: What the product does and for whom, the business model, the main user actions in order, and sign-ups a month, with the user's answers in their words, or that they told you to go ahead on what you proposed. Then which kind of plan below fits the request, and why.
ask: true
knowledge: [product-analyst-mindset, product-funnel, product-analytics-by-stage]
branches: [strategy, tracking-plan, dashboard]
-->

Start with principle 1 (product context) every time. A plan without the product's funnel is generic. Write down what you already know, and ask the user to confirm or correct it, with anything you don't know, in one batch.

Then use the case below that fits. Pick one, then do that case's steps.

### Branch strategy: Metrics and strategy
<!-- branch
report: The decision the plan informs, the north star with its metric tree and counter metric and the branch the decision acts on, and 3 to 5 decision metrics, each with its four-line definition and counter metric, plus the vanity metrics skipped. For an activation definition, the action and window you chose with the retained and not-retained group sizes behind it; for a retention definition, the day, bounded or unbounded, and the action that counts as coming back.
modules: [analytics-strategy]
knowledge: [analytics-strategy, north-star-metric, metric-definitions]
-->

Follow `modules/analytics-strategy`: the decision first, one north star with its tree and counter metric, then 3 to 5 decision metrics with four-line definitions.

#### Defining activation
Activation is the moment a new user first gets real value. Find it from data: compare users who retained with users who didn't, and find the early action, or combination of actions, within a fixed window (the first day or week) that separates them most. List the candidate actions first (every core action the product has, not just the obvious one), then report the share of retained and not-retained users who did each. Check both groups are big enough (principle 7), and talk to users from both groups to validate it. Then write it down with the window ("created a project and invited a teammate within 7 days of signup"). Treat it as a hypothesis until a test confirms that pushing users to it raises retention.

#### Defining retention
Pick the day that matches how often the product should be used (D1 for daily apps, D7 or D30 for weekly or monthly tools), say bounded or unbounded, and define "came back" as a meaningful action, not just an app open.

### Branch tracking-plan: Tracking plan
<!-- branch
report: The intake answers (scope, web or app, sign-ups a month, naming convention, detailed or simple), the product map the user confirmed, the plan as a table with every event's properties and real example values, the profile and super properties table, and the open questions with your recommended answer for each.
modules: [tracking-plan]
knowledge: [creating-a-tracking-plan, event-verification, identity-stitching]
-->

Follow `modules/tracking-plan`.

### Branch dashboard: Dashboard
<!-- branch
report: The one question the dashboard answers and who reads it, the four-line definition of each major metric, the question each chart answers, the order of the charts as a story, and the decision each chart serves. Name any chart you left off because it served no question or decision.
modules: [story-output]
knowledge: [data-storytelling, metric-definitions, reading-data]
-->

1. **Get a clear objective:** the one question this dashboard answers, and who reads it. One dashboard per audience.
2. **Get the definitions** of the major metrics on it (four lines each).
3. **Write the hypotheses or questions** it should answer before choosing any chart. Every chart answers a named question; a chart with no question stays off.
4. **Order it as a story:** the headline number first, then the number broken down (by channel, country, segment), then deeper behaviour, then the answer.
5. **Ask what decisions** they want to make from it, and check every chart serves one.
