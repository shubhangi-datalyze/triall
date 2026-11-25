---
id: retention
name: Usual suspects for retention that dropped or is low
topic: retention, churn, users not coming back, retention that is low
problems: [D1, D5]
status: approved
---

# Usual suspects: retention dropped

Check in this order. The first three are cheap to rule out and explain a large share of "retention drops" that turn out not to be real.

1. **The return event changed or broke.** The event that counts as "came back" stopped firing, fires on fewer platforms, or was renamed in a release. Check its daily volume and the date the drop started against release dates.
2. **The definition shifted.** Someone changed the retention day, switched bounded and unbounded, or changed what counts as a return (any app open against a meaningful action). Compare the definition behind both numbers.
3. **Identity broke.** If returning users get a new ID (`identify` called before login or signup, client and server events carrying different user IDs, or the cookie not shared between the marketing site and the app), they look like new users who never came back. Check whether the analytics user count rose against the database at the same time.
4. **The mix of new users changed.** A new channel, campaign or market brought users who retain worse. Retention for each channel stayed flat, but there are more of the worse ones. Split retention by signup cohort and by source, and run rate vs mix.
5. **New users stopped reaching first value.** An onboarding change, a slower first session, or a bug in the core action means fewer new users get to the point where the product works for them. Compare first-session behaviour of retained and non-retained users before and after.
6. **Something changed for existing users.** A release, a removed or moved feature, a pricing change, a bug on one platform or plan. Check whether the drop sits in one cohort, plan or platform.
7. **Seasonality or the calendar.** Holidays, exam periods, month-end for B2B, payday cycles. Compare with the same period last year if there is one.
8. **The product had a novelty spike before.** A launch or a gamification mechanic lifted retention for a while, and it is now settling back. Look at the longer trend, not just the last two periods.

## If retention is low rather than dropping

There is no "before" to compare with, so compare groups instead: retained against not retained, one product or plan against another. Agree with the user what "low" is measured against (their own best segment, last year, a target) before you call it low. Check in this order; the first three make retention look lower than it is.

1. **Returns happen where the tracking can't see them.** Users come back through an API, a scheduled job, a mobile app, an integration or email, and none of it fires the return event, or the start event fires on one platform only so cohorts miss the others. Check which platforms and libraries send the start event and the return event.
2. **Identity splits returning users.** The same person gets a new ID on a new device, after logging in, or between web and app, and looks like a user who never came back. Compare the analytics user count against the database for the same period.
3. **The definition is stricter than the product's rhythm.** Bounded day 7 for a product used monthly, or a return event narrower than real use. Compare bounded with unbounded, and a week or month window with a day.
4. **The cohort includes people who never meant to stay.** One-off jobs, test sign-ups, free-credit hunters, internal users, bots. Split by first action or use case: a one-off use case can look like low retention when it is the product doing its job.
5. **Users never reached first value.** Compare retention of users who activated with users who didn't. If the gap is large, the problem is activation, not retention (`suspects/activation-onboarding`).
6. **Nothing brings them back.** No setup, saved work, integration, team invite, notification or recurring need. Compare retention of users who set something up in their first week with those who didn't, and treat the gap as a hypothesis to test (principle 12).
7. **The core action fails or runs out.** Errors, slow or failed jobs, or credits and free limits running out after the first use. Split by whether users hit a failure or ran out of credits.
8. **The mix of new users is weak.** A channel, market or campaign brings users who retain worse than the rest. Break retention down by source and country.

## For subscription churn specifically

- **The denominator moved, not churn.** Cancellations divided by active users falls after a spike in new payers with no real change. Use users who were due to pay this month and didn't.
- **Failed payments, not cancels.** Split churn into voluntary cancels and failed renewals. Card expiry, a payment provider issue or a new card-on-file rule can raise churn with no change in what users want.
- **Plan mix.** More users on monthly plans than yearly raises churn without anyone being less happy.
- **They paid but never used it.** Users who paid and never reached the core action churn at the first renewal. Check usage after payment for the churned group.
- **Credits ran out.** In credit or usage-based products, separate users who stopped because they ran out from users who stopped while they still had credits left.

## Knowledge
- "How to hire a product analyst" (the retention drop walkthrough), "The art of reading data" (churn definition), "Rate and mix analysis", "A framework for any product problem", "Identity stitching", "Metric definitions".
- Blog: "Solving Retention Problems: A Strategic Framework", "Gamification is a multiplier".
