---
id: story-output
name: Story output
used_by: [explain-change, find-opportunities, audit, plan, judge-result]
knowledge: [data-storytelling, reading-data, qual-plus-quant-analysis]
---

# Story output

Write for a non-technical founder who will read the first two lines and decide whether to read on. Each part answers the question the part before it raised.

1. **The headline finding,** in one sentence, with the number. "Activation fell from 34% to 26% because Android users stopped finishing onboarding after the 4.2 release."
2. **Two or three supporting points,** each with a number or a chart. Order them so they build: the number, the number broken down, the behaviour behind it.
3. **What to do,** in priority order: fixes first (things that are broken), then experiments (things you think will help), each with the metric it should move.
4. **Checked and ruled out:** the segments, breakdowns and hypotheses you looked at that made no difference, each with its number in a few words ("Country: 95% of users are in one country, and the rest convert the same"). This is how the user knows what was looked at, not just what was found.
5. **Caveats and assumptions:** small samples, data issues, definitions you assumed, answers that were your proposals because the user didn't answer or told you to decide, steps you skipped (no session replays, no access to billing).
6. **Appendix:** the definitions used (four lines each) and the queries or reports, so someone can rerun them.

## Rules

- Lead with the answer. Never open with what you did.
- Use plain words. Explain any term a founder might not know (mix effect, bounded retention) in one short clause the first time.
- Rates with their counts: "26% (1,040 of 4,000 signups)".
- Headline the number you trust most. If a stricter definition gives a different number, lead with the strict one and give the loose one as a caveat.
- Say how sure you are. "Confirmed", "likely" and "a hypothesis to test" mean different things; use the right one.
- If you are building a dashboard rather than a write-up, use the same order: headline number, the breakdown, the deeper behaviour, the answer.
