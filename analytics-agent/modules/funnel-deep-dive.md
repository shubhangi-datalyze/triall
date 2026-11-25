---
id: funnel-deep-dive
name: Funnel deep dive
used_by: [explain-change, find-opportunities]
knowledge: [product-funnel, product-problem-framework, segment-analysis, correlation-is-not-causation, qual-plus-quant-analysis, experimentation]
---

# Funnel deep dive

Use this on one funnel step: activation, onboarding, signup, trial to paid, or any step inside a feature. It is the Datalyze four-question framework: find who, find what, combine them, then prove it.

1. **Find who converts.** Put the users who made it through the step on one side and those who didn't on the other. Compare how much of each group comes from each segment:
   - persona: signup method, marketing channel, platform and device, country or city, plan, role, every onboarding answer, the product they picked at signup.
   - You are looking for a gap you can't miss, such as 80% of converters from Google against 10% of non-converters.
2. **Find what converters did.** Compare behaviour before the step, within a fixed window ("did X within 3 days of signup"). Without a window, users who have been around longer look like better converters just because they had more time. Start with:
   - first session length,
   - whether they reached the core action at all,
   - how many separate days they came back in the first week,
   - which features they used first.
3. **Combine the strongest segments and behaviours.** Build a cohort for each combination (segment + behaviour) and check its conversion against the baseline. Some combinations will convert far above the rest; some strong segments will convert badly with a given behaviour. Keep going until you can say which combinations convert, which don't, and what separates them.
   - With many factors and a lot of data, a decision tree over a one-row-per-user table (one column per factor, plus the outcome) finds the combinations faster than testing them one at a time. If you can't run code, give the user the query for that table and a short script to run.
   - Ignore combinations too small to trust (principle 7), and say you did.
4. **Find out why non-converters stop.** First split them into buckets by where they stopped (left right after signup, reached the page and did nothing, tried and hit an error) and start with the biggest bucket. Then pull links to 5 to 10 session replays from that bucket (and a few converters for contrast), summarise what the tool exposes about them, and ask the user to watch them and talk to a few of those users. Numbers say where and how many; replays and conversations say why. When a replay shows a problem first, go back to the numbers to check how many users it affects.
5. **Treat every finding as a hypothesis.** "Users who do X convert 3x more" is a correlation. First check what converters who never did X did instead; if other behaviours explain them, it isn't just X. Test segment and behaviour separately, because you reach them differently: you can buy more of a segment, but you can only push people into a behaviour.
6. **Write up the findings and the experiments to run,** ranked by size of gap × users affected:
   - Segment experiment: bring in more of the best segment and watch overall conversion.
   - Behaviour experiment: push existing users to do X in their first days and watch whether conversion moves.
   - Fixes for anything broken you saw in replays.
7. **Cite the playbook chapter** "A framework for any product problem: four questions", and "Correlation is not causation" for the testing step.
