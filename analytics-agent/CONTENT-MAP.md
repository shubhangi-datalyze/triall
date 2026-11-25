# Content map

What the knowledge base holds, which workflow uses what, and where it is thin. Built 6 Oct 2026 from `content/playbook/` (28 chapters) and the Ghost blog (78 public posts). The question bank now has 392 questions across 55 problems, including M8 (pull a specific number), added to test the pull-number workflow. Rebuild the chunks with `npm run agent:knowledge`.

## Playbook chapters (28)

Used by = the workflows and modules that list the chapter in their `knowledge` field. Problems = question bank problem IDs that expect it (`tests/routing.csv`).

| # | Chapter | Part | Used by | Problems |
|---|---|---|---|---|
| 1 | what-is-product-analytics | foundations | answer-question | - |
| 2 | product-vs-business-analytics | foundations | answer-question | X6 |
| 3 | product-analyst-mindset | foundations | answer-question, explain-change, find-opportunities | D1, D2, D5, M4, X6 |
| 4 | product-funnel | foundations | explain-change, find-opportunities, funnel-deep-dive, judge-result, plan | D3, D4, D11, M2 |
| 5 | product-analytics-by-stage | foundations | analytics-strategy, answer-question, plan, tracking-plan | S1, S2, S3, S10, X4, X5, X6 |
| 6 | north-star-metric | what-to-measure | analytics-strategy, explain-change, judge-result, metric-tree-rate-mix, plan | D8, M1, M2, M3, M5, X1, X5 |
| 7 | analytics-strategy | what-to-measure | analytics-strategy, judge-result, plan | D11, M1, M2, M3, M4, M6, F9, S3, S13 |
| 8 | creating-a-tracking-plan | trustworthy-data | answer-question, audit, plan, tracking-plan | D5, D8, M6, F3, F4, F5, F10, F11, S3, S4, X6 |
| 9 | event-verification | trustworthy-data | answer-question, audit, data-health-check, tracking-plan | D6, F2, F3, F4, F5, F10, F11, S4, S5, S16 |
| 10 | data-accuracy-as-a-system | trustworthy-data | answer-question, audit, data-health-check, reconcile-numbers | D6, M4, F1, F3, F4, F5, F10, F12 |
| 11 | data-loss | trustworthy-data | answer-question, audit, data-health-check, reconcile-numbers, tracking-plan | F1, F2, F5, F7, F14, S5, S6 |
| 12 | identity-stitching | trustworthy-data | answer-question, audit, data-health-check, reconcile-numbers, tracking-plan | M4, F1, F2, F10, F13, S5, S7 |
| 13 | mmp-and-utm-tracking | trustworthy-data | answer-question, audit, judge-result, reconcile-numbers, tracking-plan | F8, S5, S8, S9, X1 |
| 14 | unifying-data | your-data-stack | answer-question, audit, judge-result, reconcile-numbers | F1, F8, S8, S10, S11, S15, X1 |
| 15 | data-modelling | your-data-stack | answer-question, plan | M7, F12, F13, S1, S10, S11, S14 |
| 16 | product-problem-framework | reading-the-data | explain-change, find-opportunities, funnel-deep-dive | D1, D2, D3, D4, D5, D9, D10, X4 |
| 17 | metric-definitions | reading-the-data | analytics-strategy, audit, data-health-check, explain-change, plan, pull-number, reconcile-numbers | D3, D6, M3, M4, M5, M8, F1, F4, F6, F9, F10, F14, S14 |
| 18 | rate-and-mix-analysis | reading-the-data | explain-change, metric-tree-rate-mix | D1, D3, D7, D8 |
| 19 | segment-analysis | reading-the-data | explain-change, find-opportunities, funnel-deep-dive | D2, D4, D5, D10 |
| 20 | reading-data | reading-the-data | analytics-strategy, explain-change, metric-tree-rate-mix, plan, pull-number, story-output | D1, D5, D6, D7, M3, M4, M5, M8, S13 |
| 21 | qual-plus-quant-analysis | reading-the-data | answer-question, explain-change, find-opportunities, funnel-deep-dive, judge-result, story-output | D2, D3, D9, D10, X5 |
| 22 | correlation-is-not-causation | reading-the-data | find-opportunities, funnel-deep-dive, judge-result | D2, D4, D10, D11, X5 |
| 23 | sense-checking-numbers | reading-the-data | analytics-strategy, data-health-check, explain-change, pull-number | D1, D6, M8 |
| 24 | experimentation | acting-on-what-you-find | answer-question, funnel-deep-dive, judge-result | D11, X4, X5 |
| 25 | incremental-testing | acting-on-what-you-find | answer-question, judge-result | X1, X2 |
| 26 | media-mix-modelling | acting-on-what-you-find | answer-question, judge-result | X1, X2, X3 |
| 27 | data-storytelling | acting-on-what-you-find | plan, story-output | S13 |
| 28 | analytics-and-ai | acting-on-what-you-find | answer-question | S14 |

## Ghost blog (78 public posts)

| Group | Posts | Use |
|---|---|---|
| Blog posts (`source: blog`) | 33. Method and opinion posts (retention framework, aha moment, vanity metrics, analytics debt, gamification, cheapest channel, branded search, PostHog love-hate, problem statements), the 7-part Indian D2C Playbook, and 10 older Mixpanel how-tos | Searchable like chapters. Several fill playbook gaps: analytics debt for F11, the PostHog post for S2, the D2C series for S15 and X1 to X3. |
| Case studies (`source: case-study`) | 17 | Proof points. Should rank below method content; good for "has this worked for anyone?". |
| Learning Mixpanel, Week 1 to 28 (`source: tutorial`) | 28 | Tool how-tos. Tagged `tutorial` so they don't outrank method content on strategy questions. |

## Open questions from the spec, answered

**1. Which chapters hold the audit checklist, the funnel deep dive, the metric tree and the "how far apart" numbers?**

- **Audit checklist:** no chapter has one. `workflows/audit.md` is now an explicit 10-area checklist built from event-verification (three layers), identity-stitching, data-loss, data-accuracy-as-a-system, metric-definitions, creating-a-tracking-plan and mmp-and-utm-tracking.
- **Funnel deep dive:** product-problem-framework (find who, find what, combine, prove), with segment-analysis for many factors, qual-plus-quant-analysis for replays, and correlation-is-not-causation for testing. The blog posts "Solving Retention Problems" and "Finding the AHA moment" use the same method.
- **Metric tree:** north-star-metric (the revenue tree and counter metrics). Rate vs mix: rate-and-mix-analysis.
- **How far apart analytics and database numbers should be:** data-loss (a gap of 1 to 2% is timing noise; double digits means client-side tracking is blocked; ad blockers take at least 15 to 20% of client-side web events) and data-accuracy-as-a-system (a steady 5 to 10% gap is fine, a gap that suddenly widens means something broke). identity-stitching covers the opposite case, analytics higher than the database.

**2. Significance threshold for principle 6.** The playbook doesn't set one. segment-analysis says "enough users that the numbers are significant" and its example ignores a 38-user segment. Ansh set it: be cautious below 30 users or 10 conversions (`principles.md`, principle 7). The site's A/B test calculator (`lib/ab-test/stats.ts`) is the reference for tests.

**3. Which topics need a suspects note?** Four are drafted (`problems:` lists match `tests/routing.csv`): retention (with churn), activation-onboarding (signup, onboarding, activation, trial to paid), payments-revenue, attribution. All four were approved by Ansh on 6 Oct 2026.

**4. Whole workflow or step by step?** Whole for v1, as suggested. The files are short enough: principles plus the longest workflow (audit) is about 2,100 words.

## Gaps

`tests/routing.csv` grades each problem's coverage. Five problems have no playbook coverage (M6, F6, F13, S7, S12), and M7 and F14 are only partly covered. Ansh decided on 6 Oct 2026 that no new content is needed for them: the workflows still route them, and answers lean on the blog and general knowledge.

## Content decisions (6 Oct 2026)

- **metric-definitions:** the four-line definition card now matches the quoted definition and the figure: users who complete account creation, out of new users who land on any page of the website, within one day of first landing, excluding internal traffic and known bots.
- **Gated playbook text:** serving full chapter text through the connector is intended.
