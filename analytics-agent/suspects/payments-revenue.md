---
id: payments-revenue
name: Usual suspects for revenue or payments that dropped or are low
topic: revenue, orders, payment success rate, ARPU, LTV, revenue or conversion to paid that is low
problems: [D8]
status: approved
---

# Usual suspects: revenue or payments dropped

Build the metric tree first (`modules/metric-tree-rate-mix`): revenue = users who paid × average amount paid, then new against recurring, plan, channel. Then check in this order.

1. **The revenue source changed, not revenue.** Refunds, taxes, currency conversion, discounts, or a switch between gross and net. A different date field (order date, payment date, payout date) moves revenue between periods. Compare against the billing system or the order table.
2. **Revenue tracking broke.** The purchase event stopped firing on one platform, lost its amount property, or started firing twice. Check daily counts against the backend.
3. **Payment success rate fell.** Split by provider, method (card, UPI, wallet), bank, platform and country. A provider outage or a change in 3-D Secure or OTP flows shows up in one branch. Use rate vs mix: volume shifting to a provider that converts lower can drop the overall rate even if no provider got worse.
4. **Fewer people reached checkout.** The drop is upstream: traffic, signup or activation fell. Follow the tree up and switch to the activation suspects.
5. **Fewer people bought, at the same traffic.** A price change, a plan change, a removed discount, a paywall change. Check the date against pricing changes.
6. **Average order value or plan mix changed.** More users on cheaper plans or monthly instead of yearly, smaller baskets, fewer add-ons.
7. **Recurring revenue fell.** More failed renewals or cancels. Split churn into voluntary and failed payments (`suspects/retention`).
8. **A channel's users stopped paying after month one.** A new channel or campaign brought users who paid once and didn't renew. Look at revenue at months 1, 2 and 3 by channel.
9. **Seasonality.** Sale periods, festivals, month-end, payday cycles. Compare with the same period last year.

## Knowledge
- Case study: "CRED: Improving PSR (+7%), reducing cost (12%) and outage (93%)".
- "Rate and mix analysis" (the Razorpay, Stripe and PayU example), "North star metric, metric tree and counter metrics", "The art of reading data" (churn as due-to-pay and didn't).

## If revenue or conversion to paid is low rather than dropping

There is no "before", so build the metric tree and find the weakest branch against something you agree with the user: their best segment, a target, last year. Check the first two before reading it as user behaviour.

1. **Revenue isn't all where you're looking.** Payments through a sales team, invoices, app stores, a second provider or offline orders don't reach the analytics tool. Compare against billing.
2. **The purchase event under-counts.** Client-side purchase events lose 15 to 20% on web to ad blockers, and app store purchases often don't fire one at all. Compare counts with the backend.
3. **Few users reach the point of paying.** The leak is upstream, in activation or the paywall's position. Follow the tree up (`suspects/activation-onboarding`).
4. **Users reach checkout and don't finish.** Payment failures by provider, method and country, a surprise price, a forced account step, missing local payment methods.
5. **Free is good enough.** Free credits or limits cover what most users need, so they never hit the wall. Look at how many users reach the limit, and what they do then.
6. **The price or packaging doesn't fit the segment.** Conversion is fine for one plan, country or use case and poor for the rest. Break conversion and average amount down by segment.
7. **People pay once and don't come back.** Revenue per user is low because repeat purchases or renewals are rare (`suspects/retention`).
