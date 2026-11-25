---
id: metric-tree-rate-mix
name: Metric tree and rate vs mix
used_by: [explain-change, judge-result]
knowledge: [north-star-metric, rate-and-mix-analysis, reading-data]
---

# Metric tree and rate vs mix

## 1. Build the metric tree

Break the number into the parts that multiply or add up to it, then break each part down again until you can point at the branch that moved.

- Revenue = users who paid × average amount paid.
  - Users who paid → new against recurring → plan → channel → where they paid (pricing page, in-app prompt).
- Orders = sessions × conversion rate; or customers × orders per customer.
- Payment success rate = completed ÷ initiated, by provider, method, platform, bank or country.
- Subscribers = last period's subscribers + new − churned (split churned into voluntary cancels and failed payments).

Pull every branch for the period before and the period after the change. Find the branch that moved. If revenue rose but the channel you spent on stayed flat, the spend didn't cause it.

## 2. Split rate from mix

When a rate moved and you've broken it down by a segment, two things can have moved it: the rate inside each segment, and how much volume each segment got. Two segments can improve while the overall rate falls.

1. **Build one table** with both periods side by side, by segment: volume, share of volume, successes, rate. Then the overall row.
2. **Rate effect:** keep this period's rates, put last period's mix back. The gap between last period's actual rate and this counterfactual is the rate effect.
3. **Mix effect:** keep last period's rates, put this period's mix in. The gap between last period's actual rate and this counterfactual is the mix effect.
4. **Report both orders.** The two splits disagree when a segment's rate and its share moved together. That overlap goes to the side you held still: hold the mix still and mix absorbs it; hold the rates still and rate absorbs it. In each order the second effect is the remainder (the actual change minus the first effect). Neither is wrong; say how big the overlap is.
5. **Name the segment.** Split each effect per segment so the parts add up to the actual change (this is the hold-the-mix-still order):
   - rate effect for a segment = its last-period share × its change in rate
   - mix effect for a segment = its change in share × (its this-period rate − the overall this-period rate)

   Subtracting the overall rate doesn't change the total (the shares' changes sum to zero), but it makes each segment's mix number readable: a segment that grew and converts below average shows a negative mix effect.

## 3. Say it in one sentence

The output is a sentence in points. With the playbook's payment example (Razorpay 50% → 30% of volume and 84% → 78% success; Stripe 30% → 30% and 80% → 82%; PayU 20% → 40% and 70% → 71%): "The success rate fell 3.6 points, from 80.0% to 76.4%. Razorpay's success rate falling cost 3.0 points, and volume moving from Razorpay to PayU, which converts below average, cost 1.4. Stripe and PayU improving won back 0.8."

Cite "Rate and mix analysis: why your conversion rate moved" and "North star metric, metric tree and counter metrics".
