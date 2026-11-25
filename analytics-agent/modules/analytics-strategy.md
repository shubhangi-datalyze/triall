---
id: analytics-strategy
name: Analytics strategy
used_by: [plan]
source: analytics-strategy-creator skill, updated 6 Oct 2026
knowledge: [analytics-strategy, north-star-metric, metric-definitions, reading-data, product-analytics-by-stage, sense-checking-numbers]
---

# Analytics strategy

Turn "I want to understand X" into one north star and 3 to 5 decision metrics. The output is a first list for the founder to check metric by metric, not a dashboard to plot unchecked. A 30-metric dashboard is not a strategy.

## Intake (in this order, at most 3 questions at a time; skip what the connected tools already answer)

1. **The decision.** "What decision are you trying to make, or what can't you answer today?" Test every candidate metric with: what would you do if it went up, and what if it went down? If the action is the same either way, it isn't a decision metric. Push back on:
   - "Track DAU": on its own it's vanity. Split by channel, country or feature, or read as stickiness (DAU/WAU, or WAU/MAU for products not used daily), it becomes a retention metric.
   - "Understand engagement": a category, not a question. Which part: finding value in a feature, coming back, or doing the action that leads to revenue?
   - "Track everything": not a strategy, and not a good tracking plan either. Every event costs developer time and tool spend.

   If they can't name a decision, offer frames by funnel stage: which channels bring sign-ups worth paying for (Awareness, Acquisition); where we lose users in sign-up or onboarding (Acquisition); are people finding the core value (Activation); are users coming back (Retention); what drives or blocks revenue (Revenue); are users bringing others (Referral).
2. **The product.** What it does, who uses it, the core action, and the business model. Recap your understanding and get it confirmed before going on.
3. **Sign-ups a month,** which sets the advice:
   - Under 1,000: one product analytics tool on its free tier, 10 to 15 events in total, replays and talking to users. No deep drop-off analysis or experiments yet; the samples are too small.
   - 1,000 to 20,000: all the core actions, plus a warehouse.
   - Above 20,000: the same, maybe with a BI tool on top.
4. **What the business is proving:** that people want the product, or that it makes money. This picks the north star.
5. **What's already set up:** nothing, basic web analytics, product analytics, or a full stack. Use the connected tools to see their existing events and saved metrics where you can, instead of asking.

## Output

1. **The decision this informs,** in one or two concrete sentences.
2. **North star:** one metric matched to what the business is proving (sign-ups or activated users; revenue or paying subscribers), its metric tree down to the branch you'd point at when it moves, its counter metric (sign-ups → activation; revenue → revenue at months 1, 2 and 3 by channel; paying subscribers → renewals at months 2 and 3), and which branch the decision acts on.
3. **3 to 5 primary metrics.** For each:
   - Funnel stage (Awareness, Acquisition, Activation, Retention, Revenue, Referral)
   - The question it answers
   - Why it fits the decision
   - The definition in four lines: counted, out of, window, excludes
   - A counter metric that catches gaming or a hidden trade-off
   - 2 to 4 segments to split it by
   - What you'd do if it rose, and if it fell
   - What good looks like: a baseline from the last 90 days, sense-checked against numbers they already know
   - How often to look at it
4. **Vanity metrics you're skipping,** 2 to 4, each with a reason specific to this product.
5. **The events and properties needed,** in the plan's naming convention. Under 1,000 sign-ups a month, stay within 10 to 15 events. Offer `modules/tracking-plan` for the full plan.
6. **What to check first:** count yesterday's sign-ups in the database and in the tool (1 to 2% apart is noise, double digits is a problem), confirm the key events fire with the right properties, then pull the 90-day baseline.
7. **When to revisit:** every 3 to 6 months, or when the decision changes or a counter metric moves against them.

## Quality bar

- Every metric ties to the decision; no more than 5.
- Every metric has a counter metric and at least 2 segments.
- Every metric passes the "what moved" test: when it moves, can you say exactly what moved and which users to look at? Churn as cancellations over active users fails (a spike in new users makes it look better); users due to pay this month who didn't pay passes.
- Recommendations fit their sign-ups a month and their stack.
- It fits on one or two printed pages.
